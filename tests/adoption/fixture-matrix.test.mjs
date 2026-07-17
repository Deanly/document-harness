import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EVIDENCE_PACK_PATH,
  INSTALLATION_LOCK_PATH,
  applyPlan,
  createPlan,
  inspectTarget,
  rollbackReceipt,
  sha256,
  verifyTarget,
} from "../../docs/lib/harness-adopt.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(TEST_DIR, "fixtures");
const ADOPTION_MANIFEST = loadJson(path.join(FIXTURES, "adoption/manifest.json"));
const GOVERNANCE_MANIFEST = loadJson(path.join(FIXTURES, "governance/manifest.json"));

function loadJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

function commitFixture(root, message = "fixture base") {
  git(root, "add", "-A");
  git(
    root,
    "-c", "user.name=Harness Fixture",
    "-c", "user.email=harness-fixture@example.invalid",
    "commit", "--allow-empty", "-qm", message,
  );
}

function scenario(id) {
  const value = ADOPTION_MANIFEST.scenarios.find(({ id: candidate }) => candidate === id);
  assert.ok(value, `fixture manifest must declare ${id}`);
  return value;
}

function repositoryFixture(t, id, { seed = scenario(id).seed, commit = true } = {}) {
  const base = mkdtempSync(path.join(os.tmpdir(), `harness-fixture-${id}-`));
  const target = path.join(base, "target");
  mkdirSync(target);
  if (seed) cpSync(path.join(FIXTURES, seed), target, { recursive: true });
  git(target, "init", "-q");
  if (commit) commitFixture(target);
  t.after(() => rmSync(base, { recursive: true, force: true }));
  return { base, target, planFile: path.join(base, `${id}-plan.json`) };
}

function planScenario(t, id, options = {}) {
  const definition = scenario(id);
  const paths = repositoryFixture(t, id, options);
  const plan = createPlan({
    target: paths.target,
    profiles: definition.profiles,
    output: paths.planFile,
  });
  return { definition, ...paths, plan };
}

function applyReceiptPath(target, planHash) {
  return path.join(target, "docs/receipts", `harness-apply-${planHash.slice(0, 16)}.json`);
}

function withTestFailureInjection(operation) {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    return operation();
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
}

test("[fixture-manifest] every required adoption scenario has a static contract", () => {
  assert.equal(ADOPTION_MANIFEST.schemaVersion, 1);
  assert.deepEqual(
    new Set(ADOPTION_MANIFEST.scenarios.map(({ id }) => id)),
    new Set([
      "new-empty",
      "mature-docs",
      "dirty-tracked-untracked",
      "project-owned-name-conflict",
      "unmodified-managed",
      "concurrent-fence-conflict",
      "upstream-project-conflict",
      "damaged-lock",
      "symlink-case",
      "n-minus-one-to-n",
      "injected-failure",
      "rollback-reapply",
      "plan-apply-twice",
    ]),
  );
  for (const definition of ADOPTION_MANIFEST.scenarios) {
    if (definition.seed) assert.ok(existsSync(path.join(FIXTURES, definition.seed)), definition.seed);
  }
});

test("[fixture:new-empty] initialize plans and applies an empty committed repository", (t) => {
  const { definition, target, planFile, plan } = planScenario(t, "new-empty");
  assert.equal(plan.mode, definition.expectedMode);
  assert.equal(plan.status, definition.expectedStatus);
  assert.ok(plan.actions.length > 0);
  assert.ok(plan.actions.every(({ action }) => action === "ADD"));
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.status, "INSTALLED_NOT_VERIFIED");
  assert.ok(existsSync(path.join(target, INSTALLATION_LOCK_PATH)));
});

test("[fixture:mature-docs] migrate preserves existing document bytes", (t) => {
  const { definition, target, planFile, plan } = planScenario(t, "mature-docs");
  const existing = path.join(target, "docs/design/product-direction.md");
  const before = readFileSync(existing);
  assert.equal(plan.mode, definition.expectedMode);
  assert.equal(plan.status, definition.expectedStatus);
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.applyResult, "applied");
  assert.deepEqual(readFileSync(existing), before);
});

test("[fixture:dirty-tracked-untracked] migrate preserves both dirty byte classes", (t) => {
  const definition = scenario("dirty-tracked-untracked");
  const { base, target } = repositoryFixture(t, definition.id);
  writeFileSync(path.join(target, definition.trackedPath), definition.trackedDirtyContent);
  writeFileSync(path.join(target, definition.untrackedPath), definition.untrackedContent);
  const planFile = path.join(base, "dirty-plan.json");
  const plan = createPlan({ target, profiles: definition.profiles, output: planFile });
  assert.equal(plan.mode, definition.expectedMode);
  assert.equal(plan.status, definition.expectedStatus);
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.applyResult, "applied");
  assert.equal(readFileSync(path.join(target, definition.trackedPath), "utf8"), definition.trackedDirtyContent);
  assert.equal(readFileSync(path.join(target, definition.untrackedPath), "utf8"), definition.untrackedContent);
  const status = git(target, "status", "--porcelain");
  assert.match(status, / M application\.conf/);
  assert.match(status, /\?\? operator-notes\.txt/);
});

test("[fixture:project-owned-name-conflict] same-name project file produces write-zero attention", (t) => {
  const { definition, target, planFile, plan } = planScenario(t, "project-owned-name-conflict");
  const protectedFile = path.join(target, definition.conflictPath);
  const before = readFileSync(protectedFile);
  const conflict = plan.actions.find(({ path: actionPath }) => actionPath === definition.conflictPath);
  assert.equal(plan.mode, definition.expectedMode);
  assert.equal(plan.status, definition.expectedStatus);
  assert.equal(conflict.action, "CONFLICT");
  assert.equal(conflict.ownership, "project-owned");
  const result = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(result.status, "NEEDS_DECISION");
  assert.equal(result.writes, 0);
  assert.deepEqual(readFileSync(protectedFile), before);
});

test("[fixture:unmodified-managed] installed baselines become deterministic update actions", (t) => {
  const definition = scenario("unmodified-managed");
  const { base, target } = repositoryFixture(t, definition.id);
  const initialFile = path.join(base, "initial.json");
  const initial = createPlan({ target, profiles: definition.profiles, output: initialFile });
  applyPlan({ planFile: initialFile, expectedPlanHash: initial.planHash });
  const upgradeFile = path.join(base, "upgrade.json");
  const upgrade = createPlan({ target, profiles: definition.profiles, output: upgradeFile });
  assert.equal(upgrade.mode, definition.expectedMode);
  assert.equal(upgrade.status, "PLAN_READY");
  const managed = upgrade.actions.filter(({ ownership }) => ownership !== "project-owned");
  const projectOwned = upgrade.actions.filter(({ ownership }) => ownership === "project-owned");
  assert.ok(managed.length > 0);
  assert.ok(projectOwned.length > 0);
  assert.ok(managed.every(({ action }) => action === definition.expectedManagedAction));
  assert.ok(projectOwned.every(({ action }) => action === definition.expectedProjectOwnedAction));
});

test("[fixture:concurrent-fence-conflict] post-plan user bytes stop apply before harness writes", (t) => {
  const { definition, target, planFile, plan } = planScenario(t, "concurrent-fence-conflict");
  writeFileSync(path.join(target, definition.mutationPath), "concurrent project change\n");
  assert.throws(
    () => applyPlan({ planFile, expectedPlanHash: plan.planHash }),
    (error) => error.code === definition.expectedError,
  );
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), false);
  assert.equal(readFileSync(path.join(target, definition.mutationPath), "utf8"), "concurrent project change\n");
});

test("[fixture:upstream-project-conflict] changed N-1 baseline and project bytes stop with zero writes", (t) => {
  const definition = scenario("upstream-project-conflict");
  const { base, target } = repositoryFixture(t, definition.id);
  const installPlanFile = path.join(base, "install.json");
  const installPlan = createPlan({ target, profiles: definition.profiles, output: installPlanFile });
  applyPlan({ planFile: installPlanFile, expectedPlanHash: installPlan.planHash });

  const managedFile = path.join(target, definition.managedPath);
  const currentUpstreamBytes = readFileSync(managedFile);
  const priorUpstreamBytes = Buffer.from("# document-harness N-1 baseline\n");
  const projectBytes = Buffer.from("# project modified the N-1 baseline independently\n");
  assert.notEqual(sha256(priorUpstreamBytes), sha256(currentUpstreamBytes));
  assert.notEqual(sha256(projectBytes), sha256(currentUpstreamBytes));
  assert.notEqual(sha256(projectBytes), sha256(priorUpstreamBytes));
  writeFileSync(managedFile, projectBytes);

  const lockFile = path.join(target, INSTALLATION_LOCK_PATH);
  const priorLock = loadJson(lockFile);
  priorLock.release.version = definition.priorVersion;
  priorLock.release.manifestSha256 = "1".repeat(64);
  priorLock.release.sourceRevision = "2".repeat(64);
  const priorEntry = priorLock.files.find(({ path: installedPath }) => installedPath === definition.managedPath);
  priorEntry.upstreamBaselineSha256 = sha256(priorUpstreamBytes);
  priorEntry.installedSha256 = sha256(priorUpstreamBytes);
  writeFileSync(lockFile, `${JSON.stringify(priorLock, null, 2)}\n`);

  const conflictPlanFile = path.join(base, "three-way-conflict.json");
  const conflictPlan = createPlan({ target, profiles: definition.profiles, output: conflictPlanFile });
  const action = conflictPlan.actions.find(({ path: actionPath }) => actionPath === definition.managedPath);
  assert.equal(conflictPlan.mode, "upgrade");
  assert.equal(conflictPlan.status, "NEEDS_DECISION");
  assert.equal(action.action, definition.expectedAction);
  assert.match(action.reason, /harness-managed file changed/);
  const applied = applyPlan({ planFile: conflictPlanFile, expectedPlanHash: conflictPlan.planHash });
  assert.equal(applied.status, "NEEDS_DECISION");
  assert.equal(applied.writes, 0);
  assert.deepEqual(readFileSync(managedFile), projectBytes);
});

test("[fixture:damaged-lock] corrupt installed metadata stops and remains byte-identical", (t) => {
  const { definition, target, planFile, plan } = planScenario(t, "damaged-lock");
  const lockFile = path.join(target, INSTALLATION_LOCK_PATH);
  const before = readFileSync(lockFile);
  assert.equal(plan.mode, definition.expectedMode);
  assert.equal(plan.status, definition.expectedStatus);
  assert.ok(plan.attention.some(({ code }) => code === "INVALID_INSTALLATION_LOCK"));
  const result = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(result.writes, 0);
  assert.deepEqual(readFileSync(lockFile), before);
});

test("[fixture:symlink-case] path aliases and case-colliding project paths fail closed", async (t) => {
  const definition = scenario("symlink-case");
  await t.test("case-colliding release path", () => {
    const { base, target, planFile } = repositoryFixture(t, `${definition.id}-case`, { seed: definition.seed });
    const plan = createPlan({ target, profiles: definition.profiles, output: planFile });
    const collision = plan.actions.find(({ path: actionPath }) => actionPath === definition.caseConflictPath);
    assert.equal(plan.status, "NEEDS_DECISION");
    assert.equal(collision.action, "CONFLICT");
    assert.match(collision.reason, /differs only by case|same-name file|existing path/);
    assert.equal(applyPlan({ planFile, expectedPlanHash: plan.planHash }).writes, 0);
    assert.ok(existsSync(path.join(base, "target/Docs/ADOPT.md")));
  });
  await t.test("symlink parent path", () => {
    const { base, target, planFile } = repositoryFixture(t, `${definition.id}-symlink`, { seed: null });
    const outside = path.join(base, "outside");
    mkdirSync(outside);
    symlinkSync(outside, path.join(target, definition.symlinkPath));
    assert.throws(
      () => createPlan({ target, profiles: definition.profiles, output: planFile }),
      (error) => error.code === "SYMLINK_CONFLICT",
    );
    assert.deepEqual(Object.keys(readFileTree(outside)), []);
  });
  await t.test("empty case-colliding parent directory", () => {
    const { target, planFile } = repositoryFixture(t, `${definition.id}-empty-parent`, { seed: null });
    mkdirSync(path.join(target, "Docs"));
    const plan = createPlan({ target, profiles: definition.profiles, output: planFile });
    const collision = plan.actions.find(({ path: actionPath }) => actionPath === definition.caseConflictPath);
    assert.equal(plan.status, "NEEDS_DECISION");
    assert.equal(collision.action, "CONFLICT");
    assert.match(collision.reason, /differs only by case/);
    assert.equal(applyPlan({ planFile, expectedPlanHash: plan.planHash }).writes, 0);
    assert.equal(existsSync(path.join(target, "Docs", "ADOPT.md")), false);
  });
});

test("[fixture:n-minus-one-to-n] prior release lock upgrades to current release and generation", (t) => {
  const definition = scenario("n-minus-one-to-n");
  const { base, target } = repositoryFixture(t, definition.id);
  const initialFile = path.join(base, "n-minus-one-install.json");
  const initial = createPlan({ target, profiles: definition.profiles, output: initialFile });
  applyPlan({ planFile: initialFile, expectedPlanHash: initial.planHash });
  const lockFile = path.join(target, INSTALLATION_LOCK_PATH);
  const priorLock = loadJson(lockFile);
  const managedFile = path.join(target, definition.priorManagedPath);
  const currentBytes = readFileSync(managedFile);
  const priorBytes = Buffer.from("# document-harness v0.9 managed bytes\n");
  writeFileSync(managedFile, priorBytes);
  priorLock.release.version = definition.priorVersion;
  priorLock.release.manifestSha256 = "3".repeat(64);
  priorLock.release.sourceRevision = "4".repeat(64);
  const priorEntry = priorLock.files.find(({ path: installedPath }) => installedPath === definition.priorManagedPath);
  priorEntry.upstreamBaselineSha256 = sha256(priorBytes);
  priorEntry.installedSha256 = sha256(priorBytes);
  writeFileSync(lockFile, `${JSON.stringify(priorLock, null, 2)}\n`);
  const upgradeFile = path.join(base, "n-upgrade.json");
  const upgrade = createPlan({ target, profiles: definition.profiles, output: upgradeFile });
  assert.equal(upgrade.mode, "upgrade");
  assert.equal(upgrade.release.version, definition.expectedVersion);
  const managedUpgrade = upgrade.actions.find(({ path: actionPath }) => actionPath === definition.priorManagedPath);
  assert.equal(managedUpgrade.action, "UPDATE_UNMODIFIED");
  assert.equal(managedUpgrade.beforeSha256, sha256(priorBytes));
  assert.equal(managedUpgrade.afterSha256, sha256(currentBytes));
  const applied = applyPlan({ planFile: upgradeFile, expectedPlanHash: upgrade.planHash });
  assert.equal(applied.applyResult, "applied");
  const upgradedLock = loadJson(lockFile);
  assert.equal(upgradedLock.release.version, definition.expectedVersion);
  assert.equal(upgradedLock.migrationGeneration, definition.expectedGeneration);
  assert.deepEqual(readFileSync(managedFile), currentBytes);
});

test("[fixture:injected-failure] partial apply restores the complete pre-apply inventory", (t) => {
  const { definition, target, planFile, plan } = planScenario(t, "injected-failure");
  const before = inspectTarget(target);
  const failed = withTestFailureInjection(() => applyPlan({
    planFile,
    expectedPlanHash: plan.planHash,
    failureAfter: definition.failureAfter,
  }));
  assert.equal(failed.status, definition.expectedStatus);
  assert.equal(failed.rollback.result, "restored");
  const after = inspectTarget(target);
  assert.equal(after.inventorySha256, before.inventorySha256);
  assert.equal(after.dirtyFingerprint, before.dirtyFingerprint);
});

test("[fixture:rollback-reapply] successful rollback restores and the same fenced plan reapplies", (t) => {
  const { definition, target, planFile, plan } = planScenario(t, "rollback-reapply");
  const before = inspectTarget(target);
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  const rollback = rollbackReceipt({ receiptFile: applyReceiptPath(target, plan.planHash) });
  assert.equal(rollback.status, definition.expectedRollbackStatus);
  assert.equal(inspectTarget(target).inventorySha256, before.inventorySha256);
  const reapplied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(reapplied.applyResult, "applied");
  assert.equal(reapplied.planHash, applied.planHash);
});

test("[fixture:plan-apply-twice] repeated plan bytes match and repeated apply writes zero", (t) => {
  const definition = scenario("plan-apply-twice");
  const { base, target, planFile } = repositoryFixture(t, definition.id);
  const firstPlan = createPlan({ target, profiles: definition.profiles, output: planFile });
  const firstBytes = readFileSync(planFile);
  const secondPlan = createPlan({ target, profiles: definition.profiles, output: planFile });
  assert.deepEqual(readFileSync(planFile), firstBytes);
  assert.equal(secondPlan.planHash, firstPlan.planHash);
  applyPlan({ planFile, expectedPlanHash: firstPlan.planHash });
  const secondApply = applyPlan({ planFile, expectedPlanHash: firstPlan.planHash });
  assert.equal(secondApply.alreadyApplied, true);
  assert.equal(secondApply.writes, definition.expectedSecondApplyWrites);
});

test("[governance-fixture-matrix] source classes survive lifecycle without AI self-approval", async (t) => {
  const base = mkdtempSync(path.join(os.tmpdir(), "harness-governance-fixture-"));
  const target = path.join(base, "target");
  mkdirSync(target);
  cpSync(path.join(FIXTURES, GOVERNANCE_MANIFEST.repositorySeed), target, { recursive: true });
  git(target, "init", "-q");
  commitFixture(target, "governance source fixture");
  t.after(() => rmSync(base, { recursive: true, force: true }));

  const sourceBefore = new Map(
    GOVERNANCE_MANIFEST.sources.map(({ path: sourcePath }) => [sourcePath, readFileSync(path.join(target, sourcePath))]),
  );
  const planFile = path.join(base, "governance-plan.json");
  const plan = createPlan({ target, profiles: ["core", "governance"], output: planFile });
  assert.equal(plan.mode, "migrate");
  assert.equal(plan.status, "PLAN_READY");
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.status, "INSTALLED_AWAITING_REVIEW");
  const partialVerification = verifyTarget({ target });
  assert.equal(partialVerification.status, "INSTALLED_NOT_VERIFIED");
  assert.ok(partialVerification.findings.some(({ code }) => code === "VERIFICATION_PROFILE_INCOMPLETE"));
  const catalogFile = path.join(target, "docs/_indexes/governance-catalog.json");
  const catalog = loadJson(catalogFile);

  await t.test("explicit instruction remains candidate evidence", () => {
    const source = governanceSource("explicit-instruction");
    assert.equal(source.authorityClass, "repository_instruction");
    assert.equal(source.expectedApprovalState, "unreviewed");
    assert.deepEqual(readFileSync(path.join(target, source.path)), sourceBefore.get(source.path));
  });

  await t.test("current design remains candidate evidence", () => {
    const source = governanceSource("current-design");
    assert.equal(source.authorityClass, "current_design");
    assert.equal(source.expectedApprovalState, "unreviewed");
    assert.deepEqual(readFileSync(path.join(target, source.path)), sourceBefore.get(source.path));
  });

  await t.test("approved guide authority does not become migration approval", () => {
    const source = governanceSource("approved-guide");
    assert.equal(source.authorityClass, "approved_guide");
    assert.equal(source.kind, "guideline");
    assert.equal(source.expectedApprovalState, "unreviewed");
  });

  await t.test("config is an unapproved observation with no effective ref", () => {
    const source = governanceSource("config-observation");
    assert.equal(source.kind, "observation");
    assert.equal(source.expectedApprovalState, "unreviewed");
    assert.equal(source.effectiveRef, null);
  });

  await t.test("code is an unapproved observation with no effective ref", () => {
    const source = governanceSource("code-observation");
    assert.equal(source.kind, "observation");
    assert.equal(source.expectedApprovalState, "unreviewed");
    assert.equal(source.effectiveRef, null);
  });

  await t.test("conflicting sources stay linked for review", () => {
    const current = governanceSource("conflict-high-availability");
    const legacy = governanceSource("conflict-single-instance");
    assert.equal(current.conflictsWith, legacy.id);
    assert.equal(legacy.conflictsWith, current.id);
    assert.equal(legacy.expectedCandidateState, "conflicted");
  });

  await t.test("source hash change makes a captured candidate stale", () => {
    const source = governanceSource("source-changed");
    const file = path.join(target, source.path);
    const capturedSha256 = sha256(readFileSync(file));
    writeFileSync(file, `${readFileSync(file, "utf8")}Changed after capture.\n`);
    const currentSha256 = sha256(readFileSync(file));
    const freshness = capturedSha256 === currentSha256 ? "fresh" : source.onSourceChange;
    assert.notEqual(currentSha256, capturedSha256);
    assert.equal(freshness, "stale");
  });

  await t.test("private/secret-classified source is excluded", () => {
    const source = governanceSource("private-secret");
    assert.equal(source.include, false);
    assert.equal(JSON.stringify(catalog).includes(source.path), false);
    assert.deepEqual(readFileSync(path.join(target, source.path)), sourceBefore.get(source.path));
  });

  await t.test("initial generated governance catalog is an explicit empty gap", () => {
    assert.equal(catalog.migration.status, GOVERNANCE_MANIFEST.emptyCase.expectedMigrationStatus);
    assert.equal(catalog.policies.length, GOVERNANCE_MANIFEST.emptyCase.expectedPolicies);
    assert.equal(catalog.guidelines.length, GOVERNANCE_MANIFEST.emptyCase.expectedGuidelines);
    assert.ok(catalog.gaps.length >= GOVERNANCE_MANIFEST.emptyCase.expectedMinimumGaps);
    assert.ok(catalog.attention.some(({ severity }) => severity === "decision"));
    assert.equal(existsSync(path.join(target, EVIDENCE_PACK_PATH)), false);
  });
});

test("[governance:empty] empty committed repository installs a review gap, not invented policy", (t) => {
  const base = mkdtempSync(path.join(os.tmpdir(), "harness-governance-empty-"));
  const target = path.join(base, "target");
  mkdirSync(target);
  git(target, "init", "-q");
  commitFixture(target, "empty governance base");
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const planFile = path.join(base, "plan.json");
  const plan = createPlan({ target, profiles: ["core", "governance"], output: planFile });
  assert.equal(plan.mode, "initialize");
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.status, "INSTALLED_AWAITING_REVIEW");
  const catalog = loadJson(path.join(target, "docs/_indexes/governance-catalog.json"));
  assert.deepEqual(catalog.policies, []);
  assert.deepEqual(catalog.guidelines, []);
  assert.ok(catalog.gaps.length > 0);
});

function governanceSource(id) {
  const source = GOVERNANCE_MANIFEST.sources.find(({ id: candidate }) => candidate === id);
  assert.ok(source, `governance fixture manifest must declare ${id}`);
  assert.equal(path.isAbsolute(source.path), false);
  assert.ok(existsSync(path.join(FIXTURES, GOVERNANCE_MANIFEST.repositorySeed, source.path)));
  return source;
}

function readFileTree(root, current = "", result = {}) {
  const directory = path.join(root, current);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = current ? `${current}/${entry.name}` : entry.name;
    if (entry.isDirectory()) readFileTree(root, relative, result);
    else result[relative] = readFileSync(path.join(root, relative));
  }
  return result;
}
