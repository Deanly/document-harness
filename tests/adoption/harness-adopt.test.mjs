import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readlinkSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
  mkdirSync,
  symlinkSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_ACTIONS,
  GOVERNANCE_CATALOG_PATH,
  INSTALLATION_LOCK_PATH,
  applyPlan,
  canonicalJson,
  createPlan,
  inspectTarget,
  rollbackReceipt,
  sha256,
  verifyTarget,
} from "../../docs/lib/harness-adopt.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, "../..");
const CLI = path.join(ROOT, "docs/bin/harness-adopt");
const SCHEMAS = path.join(ROOT, "docs/schemas");

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

function fixture(t, { mature = false } = {}) {
  const base = mkdtempSync(path.join(os.tmpdir(), "harness-adopt-test-"));
  const target = path.join(base, "target");
  mkdirSync(target);
  git(target, "init", "-q");
  git(
    target,
    "-c", "user.name=Harness Fixture",
    "-c", "user.email=harness-fixture@example.invalid",
    "commit", "--allow-empty", "-qm", "fixture base",
  );
  if (mature) {
    writeFileSync(path.join(target, "AGENTS.md"), "# Existing project contract\n", "utf8");
  }
  t.after(() => rmSync(base, { recursive: true, force: true }));
  return { base, target, planFile: path.join(base, "plan.json") };
}

function createCorePlan(t, options = {}) {
  const paths = fixture(t, options);
  const plan = createPlan({ target: paths.target, profiles: ["core"], output: paths.planFile });
  return { ...paths, plan };
}

function applyReceiptPath(target, planHash) {
  return path.join(target, "docs/receipts", `harness-apply-${planHash.slice(0, 16)}.json`);
}

function walkFiles(root, current = "", output = []) {
  for (const entry of readdirSync(path.join(root, current), { withFileTypes: true })) {
    const relative = current ? `${current}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walkFiles(root, relative, output);
    else output.push(relative);
  }
  return output.sort();
}

test("all lifecycle schemas, release manifest, and adoption templates are valid JSON", () => {
  const schemaFiles = readdirSync(SCHEMAS).filter((name) => name.endsWith(".schema.json"));
  assert.deepEqual(schemaFiles.sort(), [
    "adoption-plan.schema.json",
    "apply-receipt.schema.json",
    "governance-catalog.schema.json",
    "harness-installation-lock.schema.json",
    "human-policy-decision-receipt.schema.json",
    "migration-evidence-pack.schema.json",
    "release-manifest.schema.json",
    "rollback-receipt.schema.json",
    "verification-receipt.schema.json",
  ]);
  for (const name of schemaFiles) {
    const schema = JSON.parse(readFileSync(path.join(SCHEMAS, name), "utf8"));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.type, "object");
  }
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "docs/releases/document-harness-v1.json"), "utf8"));
  assert.equal(manifest.releaseId, "document-harness-public-v1");
  assert.deepEqual(manifest.profileDependencies, {
    core: [],
    governance: ["core"],
    view: ["core", "governance"],
  });
  assert.deepEqual(manifest.verification.requiredProfiles, ["core", "governance", "view"]);
  assert.equal(new Set(manifest.files.map(({ targetPath }) => targetPath.toLowerCase())).size, manifest.files.length);
  const releaseTargets = new Set(manifest.files.map(({ targetPath }) => targetPath));
  for (const requiredPath of manifest.verification.requiredInstalledPaths) {
    assert.equal(releaseTargets.has(requiredPath), true, `verification path is release-managed: ${requiredPath}`);
  }
  const viewRoot = path.join(ROOT, "runtime/document-harness-view");
  const declaredViewSources = new Set(
    manifest.files
      .map(({ sourcePath }) => sourcePath)
      .filter((sourcePath) => sourcePath.startsWith("runtime/document-harness-view/")),
  );
  assert.deepEqual(
    walkFiles(viewRoot).filter((relative) => !declaredViewSources.has(`runtime/document-harness-view/${relative}`)),
    [],
    "every reference View distribution file must be release-managed",
  );
  for (const action of ALLOWED_ACTIONS) assert.match(readFileSync(path.join(SCHEMAS, "adoption-plan.schema.json"), "utf8"), new RegExp(action));
  for (const name of readdirSync(path.join(ROOT, "docs/_templates/adoption")).filter((entry) => entry.endsWith(".json"))) {
    JSON.parse(readFileSync(path.join(ROOT, "docs/_templates/adoption", name), "utf8"));
  }
});

test("plan is deterministic and does not change target bytes, index, runtime, or home", (t) => {
  const { base, target, planFile } = fixture(t);
  const tracked = path.join(target, "tracked.txt");
  writeFileSync(tracked, "tracked bytes\n");
  git(target, "add", "tracked.txt");
  git(target, "-c", "user.name=Harness Fixture", "-c", "user.email=harness-fixture@example.invalid", "commit", "-qm", "tracked fixture");
  const future = new Date(Date.now() + 5000);
  utimesSync(tracked, future, future);
  const indexBefore = readFileSync(path.join(target, ".git/index"));
  const before = inspectTarget(target);
  const homeSentinel = path.join(base, "home-sentinel");
  writeFileSync(homeSentinel, "unchanged\n");
  const first = createPlan({ target, profiles: ["view", "core", "governance", "core"], output: planFile });
  const firstBytes = readFileSync(planFile);
  const second = createPlan({ target, profiles: ["governance", "core", "view"], output: planFile });
  const indexAfter = readFileSync(path.join(target, ".git/index"));
  const after = inspectTarget(target);
  assert.deepEqual(first, second);
  assert.deepEqual(readFileSync(planFile), firstBytes);
  assert.equal(first.status, "PLAN_READY");
  assert.equal(first.mode, "migrate");
  assert.equal(first.repositoryState, "mature");
  assert.deepEqual(first.requestedProfiles, ["core", "governance", "view"]);
  assert.deepEqual(first.profiles, ["core", "governance", "view"]);
  assert.equal(first.target.locator, "target");
  assert.equal(first.target.identity.includes("/"), false);
  assert.equal(first.target.identity.includes(os.homedir()), false);
  assert.equal(canonicalJson(before.inventory), canonicalJson(after.inventory));
  assert.equal(before.dirtyFingerprint, after.dirtyFingerprint);
  assert.deepEqual(indexAfter, indexBefore);
  assert.equal(git(target, "status", "--porcelain"), "");
  assert.equal(readFileSync(homeSentinel, "utf8"), "unchanged\n");
});

test("plan refuses an output inside the target repository", (t) => {
  const { target } = fixture(t);
  assert.throws(
    () => createPlan({ target, profiles: ["core"], output: path.join(target, "plan.json") }),
    (error) => error.code === "PLAN_OUTPUT_IN_TARGET" && error.status === "NEEDS_DECISION",
  );
  assert.equal(existsSync(path.join(target, "plan.json")), false);
});

test("plan rejects an empty profile selection before writing a plan", (t) => {
  const { base, target } = fixture(t);
  const output = path.join(base, "empty-profile-plan.json");
  assert.throws(
    () => createPlan({ target, profiles: [], output }),
    (error) => error.code === "MISSING_PROFILE" && error.status === "NEEDS_DECISION",
  );
  assert.equal(existsSync(output), false);

  const cli = spawnSync(CLI, [
    "plan", "--target", target, "--profile", ",,", "--output", output,
  ], { cwd: target, encoding: "utf8" });
  assert.equal(cli.status, 2);
  const body = JSON.parse(cli.stdout);
  assert.equal(body.status, "NEEDS_DECISION");
  assert.equal(body.error.code, "MISSING_PROFILE");
  assert.equal(body.writes, 0);
  assert.equal(existsSync(output), false);
});

test("governance plan for an unborn repository stops before apply", (t) => {
  const { base, target } = fixture(t);
  rmSync(path.join(target, ".git"), { recursive: true, force: true });
  git(target, "init", "-q");
  const plan = createPlan({
    target,
    profiles: ["core", "governance"],
    output: path.join(base, "unborn-plan.json"),
  });
  assert.equal(plan.status, "NEEDS_DECISION");
  assert.equal(plan.mode, "initialize");
  assert.ok(plan.attention.some(({ code }) => code === "UNBORN_REPOSITORY"));
  const applied = applyPlan({ planFile: path.join(base, "unborn-plan.json"), expectedPlanHash: plan.planHash });
  assert.equal(applied.status, "NEEDS_DECISION");
  assert.equal(applied.writes, 0);
});

test("mature same-name project file becomes a no-write decision conflict", (t) => {
  const { target, planFile } = fixture(t, { mature: true });
  mkdirSync(path.join(target, "docs"));
  writeFileSync(path.join(target, "docs", "ADOPT.md"), "project-owned\n");
  const before = inspectTarget(target);
  const plan = createPlan({ target, profiles: ["core"], output: planFile });
  const after = inspectTarget(target);
  const conflict = plan.actions.find(({ path: actionPath }) => actionPath === "docs/ADOPT.md");
  assert.equal(plan.mode, "migrate");
  assert.equal(plan.status, "NEEDS_DECISION");
  assert.equal(conflict.action, "CONFLICT");
  assert.equal(conflict.ownership, "project-owned");
  assert.equal(readFileSync(path.join(target, "docs", "ADOPT.md"), "utf8"), "project-owned\n");
  assert.equal(before.dirtyFingerprint, after.dirtyFingerprint);
  const apply = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(apply.status, "NEEDS_DECISION");
  assert.equal(apply.writes, 0);
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), false);
});

test("dangling leaf and ancestor symlinks are plan conflicts and are never overwritten", (t) => {
  for (const scenario of [
    { path: "document-harness.yaml", actionPath: "document-harness.yaml" },
    { path: ".agents", actionPath: ".agents/skills/operate-document-harness/SKILL.md" },
  ]) {
    const { base, target } = fixture(t);
    const link = path.join(target, ...scenario.path.split("/"));
    symlinkSync("missing-project-owned-target", link);
    const planFile = path.join(base, `${scenario.path.replaceAll("/", "-")}-plan.json`);
    const plan = createPlan({ target, profiles: ["core"], output: planFile });
    const conflict = plan.actions.find(({ path: actionPath }) => actionPath === scenario.actionPath);
    assert.equal(plan.status, "NEEDS_DECISION");
    assert.equal(conflict.action, "CONFLICT");
    assert.match(conflict.reason, /unsafe|symlink/i);
    const result = applyPlan({ planFile, expectedPlanHash: plan.planHash });
    assert.equal(result.status, "NEEDS_DECISION");
    assert.equal(result.writes, 0);
    assert.equal(lstatSync(link).isSymbolicLink(), true);
    assert.equal(readlinkSync(link), "missing-project-owned-target");
  }
});

test("apply is fenced, installs atomically, and a second apply is a zero-write no-op", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  const first = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(first.status, "INSTALLED_NOT_VERIFIED");
  assert.equal(first.applyResult, "applied");
  assert.ok(first.mutations.length > 1);
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), true);
  const adoptionProfile = readFileSync(path.join(target, "document-harness.yaml"), "utf8");
  assert.match(adoptionProfile, /repository_id: "target"/);
  assert.match(adoptionProfile, /profiles:\n  - core\n/);
  assert.match(adoptionProfile, /installation_lock: docs\/_indexes\/harness-installation\.yaml/);
  assert.equal(adoptionProfile.includes("{{"), false);
  const firstReceiptBytes = readFileSync(applyReceiptPath(target, plan.planHash));
  const second = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(second.alreadyApplied, true);
  assert.equal(second.writes, 0);
  assert.deepEqual(readFileSync(applyReceiptPath(target, plan.planHash)), firstReceiptBytes);
});

test("already-applied fast path refuses unrelated post-apply target drift", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  applyPlan({ planFile, expectedPlanHash: plan.planHash });
  writeFileSync(path.join(target, "unrelated-after-apply.txt"), "user bytes\n");
  assert.throws(
    () => applyPlan({ planFile, expectedPlanHash: plan.planHash }),
    (error) => error.code === "TARGET_FENCE_MISMATCH" && error.status === "NEEDS_DECISION",
  );
  assert.equal(readFileSync(path.join(target, "unrelated-after-apply.txt"), "utf8"), "user bytes\n");
});

test("already-applied fast path rejects a forged successful status and lock mismatch", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  applyPlan({ planFile, expectedPlanHash: plan.planHash });
  const receiptFile = applyReceiptPath(target, plan.planHash);
  const receipt = JSON.parse(readFileSync(receiptFile, "utf8"));
  receipt.status = "MIGRATION_VERIFIED";
  writeFileSync(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`);
  assert.throws(
    () => applyPlan({ planFile, expectedPlanHash: plan.planHash }),
    (error) => error.code === "TARGET_FENCE_MISMATCH" && error.status === "NEEDS_DECISION",
  );
  assert.equal(JSON.parse(readFileSync(receiptFile, "utf8")).status, "MIGRATION_VERIFIED");
});

test("target fence mismatch stops before the first harness write", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  writeFileSync(path.join(target, "user-change.txt"), "arrived after plan\n");
  assert.throws(
    () => applyPlan({ planFile, expectedPlanHash: plan.planHash }),
    (error) => error.code === "TARGET_FENCE_MISMATCH" && error.status === "NEEDS_DECISION",
  );
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), false);
  assert.equal(readFileSync(path.join(target, "user-change.txt"), "utf8"), "arrived after plan\n");
});

test("tampered plan bytes and an unexpected plan hash are rejected before writes", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  assert.throws(
    () => applyPlan({ planFile, expectedPlanHash: "0".repeat(64) }),
    (error) => error.code === "EXPECTED_PLAN_HASH_MISMATCH",
  );
  const tampered = JSON.parse(readFileSync(planFile, "utf8"));
  tampered.actions[0].reason = "tampered";
  writeFileSync(planFile, `${JSON.stringify(tampered, null, 2)}\n`);
  assert.throws(
    () => applyPlan({ planFile, expectedPlanHash: plan.planHash }),
    (error) => error.code === "PLAN_HASH_MISMATCH",
  );
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), false);
});

test("a self-rehashed forged action is rejected against the release calculation", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  const forged = structuredClone(plan);
  forged.actions[0].mode = forged.actions[0].mode === "0644" ? "0755" : "0644";
  delete forged.planHash;
  forged.planHash = sha256(canonicalJson(forged));
  writeFileSync(planFile, `${JSON.stringify(forged, null, 2)}\n`);
  assert.throws(
    () => applyPlan({ planFile, expectedPlanHash: forged.planHash }),
    (error) => error.code === "PLAN_ACTION_MISMATCH" && error.status === "NEEDS_DECISION",
  );
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), false);
});

test("a self-rehashed release fence with extra properties is rejected before propagation", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  const before = inspectTarget(target);
  const forged = structuredClone(plan);
  forged.release.untrustedDisplay = "looks-authoritative";
  delete forged.planHash;
  forged.planHash = sha256(canonicalJson(forged));
  writeFileSync(planFile, `${JSON.stringify(forged, null, 2)}\n`);

  assert.throws(
    () => applyPlan({ planFile, expectedPlanHash: forged.planHash }),
    (error) => error.code === "RELEASE_FENCE_MISMATCH" && error.status === "NEEDS_DECISION",
  );
  assert.equal(inspectTarget(target).inventorySha256, before.inventorySha256);
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), false);
});

test("self-rehashed decision tampering cannot bypass unborn repository attention", (t) => {
  const { base, target } = fixture(t);
  rmSync(path.join(target, ".git"), { recursive: true, force: true });
  git(target, "init", "-q");
  const planFile = path.join(base, "forged-unborn-plan.json");
  const plan = createPlan({ target, profiles: ["governance"], output: planFile });
  assert.ok(plan.attention.some(({ code }) => code === "UNBORN_REPOSITORY"));
  const forged = structuredClone(plan);
  forged.status = "PLAN_READY";
  forged.attention = [];
  delete forged.planHash;
  forged.planHash = sha256(canonicalJson(forged));
  writeFileSync(planFile, `${JSON.stringify(forged, null, 2)}\n`);
  assert.throws(
    () => applyPlan({ planFile, expectedPlanHash: forged.planHash }),
    (error) => error.code === "PLAN_DECISION_MISMATCH" && error.status === "NEEDS_DECISION",
  );
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), false);
});

test("index-only fence changes are detected even when worktree bytes do not change", (t) => {
  const { base, target, planFile } = fixture(t, { mature: true });
  const userFile = path.join(target, "user-owned.txt");
  writeFileSync(userFile, "same bytes\n");
  const plan = createPlan({ target, profiles: ["core"], output: planFile });
  git(target, "add", "user-owned.txt");
  assert.throws(
    () => applyPlan({ planFile, expectedPlanHash: plan.planHash }),
    (error) => error.code === "TARGET_FENCE_MISMATCH",
  );
  assert.equal(readFileSync(userFile, "utf8"), "same bytes\n");
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), false);
  assert.equal(existsSync(path.join(base, "plan.json")), true);
});

test("test-only partial failure restores preimages and permits a clean reapply", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  const before = inspectTarget(target);
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  let failed;
  try {
    failed = applyPlan({ planFile, expectedPlanHash: plan.planHash, failureAfter: 2 });
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
  assert.equal(failed.status, "APPLY_FAILED");
  assert.equal(failed.rollback.result, "restored");
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), false);
  const after = inspectTarget(target);
  assert.equal(after.inventorySha256, before.inventorySha256);
  assert.equal(after.dirtyFingerprint, before.dirtyFingerprint);
  const reapplied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(reapplied.applyResult, "applied");
  assert.equal(reapplied.status, "INSTALLED_NOT_VERIFIED");
});

test("CLI rejects failure injection unless NODE_ENV=test", (t) => {
  const { planFile, plan } = createCorePlan(t);
  const result = spawnSync(CLI, ["apply", "--plan", planFile, "--expect-plan-hash", plan.planHash], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "production", HARNESS_ADOPT_TEST_FAIL_AFTER: "1" },
  });
  assert.equal(result.status, 2);
  const body = JSON.parse(result.stdout);
  assert.equal(body.status, "NEEDS_DECISION");
  assert.equal(body.error.code, "TEST_HOOK_REJECTED");
  assert.equal(body.writes, 0);
});

test("rollback refuses post-apply edits, then restores and supports reapply", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  const receiptFile = applyReceiptPath(target, plan.planHash);
  const managed = applied.mutations.find(({ path: mutationPath }) => mutationPath !== INSTALLATION_LOCK_PATH);
  const managedFile = path.join(target, ...managed.path.split("/"));
  const installedBytes = readFileSync(managedFile);
  writeFileSync(managedFile, "user changed after apply\n");
  const refused = rollbackReceipt({ receiptFile });
  assert.equal(refused.status, "NEEDS_DECISION");
  assert.equal(refused.writes, 0);
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), true);
  writeFileSync(managedFile, installedBytes);
  chmodSync(managedFile, 0o600);
  const modeRefused = rollbackReceipt({ receiptFile });
  assert.equal(modeRefused.status, "NEEDS_DECISION");
  assert.equal(modeRefused.writes, 0);
  chmodSync(managedFile, managed.afterMode);
  const rolledBack = rollbackReceipt({ receiptFile });
  assert.equal(rolledBack.status, "ROLLED_BACK");
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), false);
  const reapplied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(reapplied.applyResult, "applied");
});

test("rollback preserves empty parent directories that existed before apply", (t) => {
  const { target, planFile } = fixture(t);
  const preexistingDirectory = path.join(target, ".agents/skills");
  mkdirSync(preexistingDirectory, { recursive: true });
  const plan = createPlan({ target, profiles: ["core"], output: planFile });
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.applyResult, "applied");

  const rolledBack = rollbackReceipt({ receiptFile: applyReceiptPath(target, plan.planHash) });
  assert.equal(rolledBack.status, "ROLLED_BACK");
  assert.equal(lstatSync(path.join(target, ".agents")).isDirectory(), true);
  assert.equal(lstatSync(preexistingDirectory).isDirectory(), true);
  assert.equal(existsSync(path.join(preexistingDirectory, "document-harness/SKILL.md")), false);
});

test("rollback rejects copied or internally inconsistent receipts before writes", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  applyPlan({ planFile, expectedPlanHash: plan.planHash });
  const receiptFile = applyReceiptPath(target, plan.planHash);
  const receiptBytes = readFileSync(receiptFile);
  const copiedReceipt = path.join(target, "docs/receipts/copied-apply.json");
  writeFileSync(copiedReceipt, receiptBytes);
  assert.throws(
    () => rollbackReceipt({ receiptFile: copiedReceipt }),
    (error) => error.code === "RECEIPT_PATH_MISMATCH" && error.status === "NEEDS_DECISION",
  );
  const tampered = JSON.parse(receiptBytes.toString("utf8"));
  tampered.mutations[0].preimageBase64 = "AA==";
  writeFileSync(receiptFile, `${JSON.stringify(tampered, null, 2)}\n`);
  assert.throws(
    () => rollbackReceipt({ receiptFile }),
    (error) => error.code === "INVALID_APPLY_RECEIPT" && error.status === "NEEDS_DECISION",
  );
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), true);
});

test("rollback rejects a receipt subset not matching the lock-anchored mutation set", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  const receiptFile = applyReceiptPath(target, plan.planHash);
  const managed = applied.mutations.find(({ path: mutationPath }) => mutationPath !== INSTALLATION_LOCK_PATH);
  const managedFile = path.join(target, ...managed.path.split("/"));
  const receipt = JSON.parse(readFileSync(receiptFile, "utf8"));
  receipt.mutations = receipt.mutations.filter(({ path: mutationPath }) => mutationPath === INSTALLATION_LOCK_PATH);
  receipt.writes = receipt.mutations.length + 1;
  writeFileSync(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`);
  assert.throws(
    () => rollbackReceipt({ receiptFile }),
    (error) => error.code === "RECEIPT_MUTATION_SET_MISMATCH" && error.status === "NEEDS_DECISION",
  );
  assert.equal(existsSync(managedFile), true);
  assert.equal(existsSync(path.join(target, INSTALLATION_LOCK_PATH)), true);
});

test("legacy v1 locks remain upgrade-readable but cannot authorize rollback before anchoring", (t) => {
  const { base, target, planFile, plan } = createCorePlan(t);
  applyPlan({ planFile, expectedPlanHash: plan.planHash });
  const receiptFile = applyReceiptPath(target, plan.planHash);
  const lockFile = path.join(target, INSTALLATION_LOCK_PATH);
  const legacyLock = JSON.parse(readFileSync(lockFile, "utf8"));
  delete legacyLock.applyMutationSet;
  writeFileSync(lockFile, `${JSON.stringify(legacyLock, null, 2)}\n`);
  assert.throws(
    () => rollbackReceipt({ receiptFile }),
    (error) => error.code === "RECEIPT_MUTATION_SET_UNANCHORED" && error.status === "NEEDS_DECISION",
  );
  const upgradeFile = path.join(base, "legacy-lock-upgrade.json");
  const upgrade = createPlan({ target, profiles: ["core"], output: upgradeFile });
  assert.equal(upgrade.status, "PLAN_READY");
  applyPlan({ planFile: upgradeFile, expectedPlanHash: upgrade.planHash });
  const anchoredLock = JSON.parse(readFileSync(lockFile, "utf8"));
  assert.equal(anchoredLock.migrationGeneration, legacyLock.migrationGeneration + 1);
  assert.match(anchoredLock.applyMutationSet.sha256, /^[a-f0-9]{64}$/);
});

test("successful mature migration preserves unrelated dirty tracked and untracked bytes", (t) => {
  const { target, planFile } = fixture(t, { mature: true });
  const tracked = path.join(target, "application.conf");
  const untracked = path.join(target, "work-in-progress.txt");
  writeFileSync(tracked, "original\n");
  git(target, "add", "AGENTS.md", "application.conf");
  git(target, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture");
  writeFileSync(tracked, "dirty tracked change\n");
  writeFileSync(untracked, "dirty untracked change\n");
  const plan = createPlan({ target, profiles: ["core"], output: planFile });
  assert.equal(plan.mode, "migrate");
  assert.equal(plan.status, "PLAN_READY");
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.applyResult, "applied");
  assert.equal(readFileSync(tracked, "utf8"), "dirty tracked change\n");
  assert.equal(readFileSync(untracked, "utf8"), "dirty untracked change\n");
});

test("valid installation lock selects upgrade and preserves release ownership", (t) => {
  const { base, target, planFile, plan } = createCorePlan(t);
  const first = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(first.applyResult, "applied");
  const upgradeFile = path.join(base, "upgrade-plan.json");
  const upgrade = createPlan({ target, profiles: ["core"], output: upgradeFile });
  assert.equal(upgrade.mode, "upgrade");
  assert.equal(upgrade.repositoryState, "installed");
  assert.equal(upgrade.status, "PLAN_READY");
  assert.ok(upgrade.actions.every(({ action }) => ["UPDATE_UNMODIFIED", "KEEP_PROJECT_OWNED"].includes(action)));
  const upgraded = applyPlan({ planFile: upgradeFile, expectedPlanHash: upgrade.planHash });
  assert.equal(upgraded.applyResult, "applied");
  const lock = JSON.parse(readFileSync(path.join(target, INSTALLATION_LOCK_PATH), "utf8"));
  assert.equal(lock.migrationGeneration, 2);
  assert.deepEqual(new Set(lock.files.map(({ ownership }) => ownership)), new Set(["harness-managed", "generated", "project-owned"]));
});

test("upgrade records, repairs, and can roll back a mode-only managed-file mutation", (t) => {
  const { base, target, planFile, plan } = createCorePlan(t);
  applyPlan({ planFile, expectedPlanHash: plan.planHash });
  const managedPath = "docs/ADOPT.md";
  const managedFile = path.join(target, ...managedPath.split("/"));
  chmodSync(managedFile, 0o600);
  const upgradeFile = path.join(base, "mode-only-upgrade.json");
  const upgrade = createPlan({ target, profiles: ["core"], output: upgradeFile });
  const action = upgrade.actions.find(({ path: actionPath }) => actionPath === managedPath);
  assert.equal(action.action, "UPDATE_UNMODIFIED");
  assert.equal(action.beforeSha256, action.afterSha256);
  assert.equal(action.beforeMode, 0o600);
  assert.equal(Number.parseInt(action.mode, 8), 0o644);
  assert.match(action.reason, /mode requires repair/);
  assert.equal(action.rollbackAction, "RESTORE_PREIMAGE");
  const actionSchema = JSON.parse(readFileSync(path.join(SCHEMAS, "adoption-plan.schema.json"), "utf8")).$defs.action.properties;
  assert.equal(actionSchema.beforeMode.minimum, 0);
  assert.equal(actionSchema.beforeMode.maximum, 0o777);
  assert.ok(action.beforeMode >= actionSchema.beforeMode.minimum && action.beforeMode <= actionSchema.beforeMode.maximum);
  const applied = applyPlan({ planFile: upgradeFile, expectedPlanHash: upgrade.planHash });
  assert.ok(applied.mutations.some(({ path: mutationPath }) => mutationPath === managedPath));
  assert.equal(lstatSync(managedFile).mode & 0o777, 0o644);
  const rolledBack = rollbackReceipt({ receiptFile: applyReceiptPath(target, upgrade.planHash) });
  assert.equal(rolledBack.status, "ROLLED_BACK");
  assert.equal(lstatSync(managedFile).mode & 0o777, 0o600);
});

test("upgrade refuses implicit profile removal with zero writes", (t) => {
  const { base, target } = fixture(t);
  const installFile = path.join(base, "install-full.json");
  const install = createPlan({ target, profiles: ["core", "governance", "view"], output: installFile });
  applyPlan({ planFile: installFile, expectedPlanHash: install.planHash });
  const before = inspectTarget(target);
  const downgradeFile = path.join(base, "downgrade.json");
  const downgrade = createPlan({ target, profiles: ["core"], output: downgradeFile });
  assert.equal(downgrade.status, "NEEDS_DECISION");
  assert.ok(downgrade.attention.some(({ code }) => code === "PROFILE_REMOVAL_UNSUPPORTED"));
  const result = applyPlan({ planFile: downgradeFile, expectedPlanHash: downgrade.planHash });
  assert.equal(result.writes, 0);
  assert.equal(inspectTarget(target).inventorySha256, before.inventorySha256);
});

test("self-rehashed decision tampering cannot bypass profile-removal attention", (t) => {
  const { base, target } = fixture(t);
  const installFile = path.join(base, "install-full-for-forgery.json");
  const install = createPlan({ target, profiles: ["view"], output: installFile });
  applyPlan({ planFile: installFile, expectedPlanHash: install.planHash });
  const downgradeFile = path.join(base, "forged-downgrade.json");
  const downgrade = createPlan({ target, profiles: ["core"], output: downgradeFile });
  assert.ok(downgrade.attention.some(({ code }) => code === "PROFILE_REMOVAL_UNSUPPORTED"));
  const before = inspectTarget(target);
  const forged = structuredClone(downgrade);
  forged.status = "PLAN_READY";
  forged.attention = [];
  delete forged.planHash;
  forged.planHash = sha256(canonicalJson(forged));
  writeFileSync(downgradeFile, `${JSON.stringify(forged, null, 2)}\n`);
  assert.throws(
    () => applyPlan({ planFile: downgradeFile, expectedPlanHash: forged.planHash }),
    (error) => error.code === "PLAN_DECISION_MISMATCH" && error.status === "NEEDS_DECISION",
  );
  assert.equal(inspectTarget(target).inventorySha256, before.inventorySha256);
});

test("upgrade preserves a reviewed governance catalog as project-owned state", (t) => {
  const { base, target } = fixture(t);
  const profiles = ["core", "governance", "view"];
  const installFile = path.join(base, "install-governance.json");
  const install = createPlan({ target, profiles, output: installFile });
  applyPlan({ planFile: installFile, expectedPlanHash: install.planHash });
  const catalogFile = path.join(target, GOVERNANCE_CATALOG_PATH);
  const catalog = JSON.parse(readFileSync(catalogFile, "utf8"));
  catalog.gaps.push({
    id: "GAP-PROJECT-REVIEW",
    summary: "Project review is in progress.",
    reason: "Fixture project state.",
  });
  const projectBytes = `${JSON.stringify(catalog, null, 2)}\n`;
  writeFileSync(catalogFile, projectBytes);
  const upgradeFile = path.join(base, "upgrade-governance.json");
  const upgrade = createPlan({ target, profiles, output: upgradeFile });
  const action = upgrade.actions.find(({ path: actionPath }) => actionPath === GOVERNANCE_CATALOG_PATH);
  assert.equal(upgrade.status, "PLAN_READY");
  assert.equal(action.action, "KEEP_PROJECT_OWNED");
  assert.equal(action.ownership, "project-owned");
  const applied = applyPlan({ planFile: upgradeFile, expectedPlanHash: upgrade.planHash });
  assert.equal(applied.applyResult, "applied");
  assert.equal(readFileSync(catalogFile, "utf8"), projectBytes);
  const lock = JSON.parse(readFileSync(path.join(target, INSTALLATION_LOCK_PATH), "utf8"));
  assert.equal(lock.files.find(({ path: filePath }) => filePath === GOVERNANCE_CATALOG_PATH).ownership, "project-owned");
});

test("installed repository-local CLI can plan its own core upgrade and verify fail-closed", (t) => {
  const { base, target, planFile, plan } = createCorePlan(t);
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.applyResult, "applied");
  const installedCli = path.join(target, "docs/bin/harness-adopt");
  const verify = spawnSync(installedCli, ["verify", "--target", target], {
    cwd: target,
    encoding: "utf8",
  });
  assert.equal(verify.status, 2);
  const verifyBody = JSON.parse(verify.stdout);
  assert.equal(verifyBody.status, "INSTALLED_NOT_VERIFIED");
  assert.ok(verifyBody.findings.some(({ code }) => code === "VERIFICATION_PROFILE_INCOMPLETE"));
  const installedLoopValidator = spawnSync(path.join(target, "docs/bin/validate-execution-loop.sh"), ["--all"], {
    cwd: target,
    encoding: "utf8",
  });
  assert.equal(installedLoopValidator.status, 0, installedLoopValidator.stdout || installedLoopValidator.stderr);
  const upgradeFile = path.join(base, "installed-cli-upgrade.json");
  const upgrade = spawnSync(installedCli, [
    "plan",
    "--target",
    target,
    "--profile",
    "core",
    "--output",
    upgradeFile,
  ], { cwd: target, encoding: "utf8" });
  assert.equal(upgrade.status, 0, upgrade.stdout || upgrade.stderr);
  const body = JSON.parse(upgrade.stdout);
  assert.equal(body.mode, "upgrade");
  assert.equal(body.status, "PLAN_READY");
  assert.equal(existsSync(upgradeFile), true);
});

test("corrupt installation lock stops migration and apply writes zero", (t) => {
  const { target, planFile } = fixture(t, { mature: true });
  const lockFile = path.join(target, INSTALLATION_LOCK_PATH);
  mkdirSync(path.dirname(lockFile), { recursive: true });
  writeFileSync(lockFile, "not-json\n");
  const lockBefore = readFileSync(lockFile);
  const plan = createPlan({ target, profiles: ["core"], output: planFile });
  assert.equal(plan.mode, "stopped");
  assert.equal(plan.repositoryState, "unknown");
  assert.equal(plan.status, "NEEDS_DECISION");
  const result = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(result.status, "NEEDS_DECISION");
  assert.equal(result.writes, 0);
  assert.deepEqual(readFileSync(lockFile), lockBefore);
});

test("case-colliding installation lock stops before apply with zero writes", (t) => {
  const { target, planFile } = fixture(t, { mature: true });
  const aliasPath = path.join(target, "docs/_indexes/Harness-Installation.yaml");
  mkdirSync(path.dirname(aliasPath), { recursive: true });
  writeFileSync(aliasPath, "project-owned alias bytes\n");
  const before = inspectTarget(target);
  const aliasBefore = readFileSync(aliasPath);

  const plan = createPlan({ target, profiles: ["core"], output: planFile });
  assert.equal(plan.mode, "stopped");
  assert.equal(plan.repositoryState, "unknown");
  assert.equal(plan.status, "NEEDS_DECISION");
  assert.ok(plan.attention.some(({ code, message }) => (
    code === "INVALID_INSTALLATION_LOCK" && /differs only by case/.test(message)
  )));

  const result = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(result.status, "NEEDS_DECISION");
  assert.equal(result.writes, 0);
  assert.deepEqual(readFileSync(aliasPath), aliasBefore);
  assert.equal(inspectTarget(target).inventorySha256, before.inventorySha256);
});

test("verification rejects an incomplete installation inventory", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  applyPlan({ planFile, expectedPlanHash: plan.planHash });
  const lockFile = path.join(target, INSTALLATION_LOCK_PATH);
  const lock = JSON.parse(readFileSync(lockFile, "utf8"));
  lock.files = [];
  writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
  const verification = verifyTarget({ target });
  assert.equal(verification.status, "INSTALLED_NOT_VERIFIED");
  assert.ok(verification.findings.some(({ code }) => code === "INSTALLATION_INVENTORY_MISSING"));
});

test("verification rejects arbitrary self-asserted gate ids and commands", (t) => {
  const { target, planFile, plan } = createCorePlan(t);
  applyPlan({ planFile, expectedPlanHash: plan.planHash });
  const lock = JSON.parse(readFileSync(path.join(target, INSTALLATION_LOCK_PATH), "utf8"));
  const evidenceDir = path.join(target, "docs/receipts");
  const gateBytes = `${JSON.stringify({
    schemaVersion: 1,
    gateId: "arbitrary-gate",
    result: "passed",
    command: "never executed",
    exitCode: 0,
    targetSourceRevision: lock.targetSourceRevision,
    releaseSourceRevision: lock.release.sourceRevision,
    observedAt: "2026-07-16T00:00:00.000Z",
  }, null, 2)}\n`;
  writeFileSync(path.join(evidenceDir, "arbitrary-gate.json"), gateBytes);
  writeFileSync(path.join(evidenceDir, "migration-evidence-pack.json"), `${JSON.stringify({
    schemaVersion: 1,
    release: lock.release,
    targetSourceRevision: lock.targetSourceRevision,
    installationReceiptRef: lock.receiptRef,
    humanDecisionReceiptRefs: [],
    gates: [{
      id: "arbitrary-gate",
      required: true,
      result: "passed",
      evidenceRef: "docs/receipts/arbitrary-gate.json",
      evidenceSha256: sha256(gateBytes),
    }],
    allRequiredGatesPassed: true,
    humanReviewComplete: true,
    rollbackRef: null,
  }, null, 2)}\n`);
  assert.equal(verifyTarget({ target }).status, "INSTALLED_NOT_VERIFIED");
});

test("view profile renders static repository identity and preserves modified config as project-owned", (t) => {
  const { base, target, planFile } = fixture(t);
  const plan = createPlan({ target, profiles: ["view"], output: planFile });
  assert.deepEqual(plan.requestedProfiles, ["view"]);
  assert.deepEqual(plan.profiles, ["core", "governance", "view"]);
  const configAction = plan.actions.find(({ path: actionPath }) => actionPath === "runtime/document-harness-view/config.json");
  assert.equal(configAction.action, "ADD");
  assert.equal(configAction.ownership, "generated");
  assert.equal(configAction.generator, "repository-view-config-v1");
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.applyResult, "applied");
  const configFile = path.join(target, "runtime/document-harness-view/config.json");
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  assert.deepEqual(config.project, {
    id: "target",
    name: "target",
    description: "target 저장소 전용 읽기 전용 document-harness 제어 화면입니다.",
  });
  const lock = JSON.parse(readFileSync(path.join(target, INSTALLATION_LOCK_PATH), "utf8"));
  assert.equal(lock.files.find(({ path: filePath }) => filePath === "runtime/document-harness-view/config.json").ownership, "generated");
  config.project.description = "Human-customized description";
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const upgrade = createPlan({ target, profiles: ["view"], output: path.join(base, "view-upgrade.json") });
  const conflict = upgrade.actions.find(({ path: actionPath }) => actionPath === "runtime/document-harness-view/config.json");
  assert.equal(upgrade.status, "PLAN_READY");
  assert.equal(conflict.action, "KEEP_PROJECT_OWNED");
  assert.equal(conflict.ownership, "project-owned");
});

test("verification is fail-closed until matching evidence and human review exist", (t) => {
  const { target, planFile } = fixture(t);
  const plan = createPlan({ target, profiles: ["core", "governance", "view"], output: planFile });
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.status, "INSTALLED_AWAITING_REVIEW");
  const awaiting = verifyTarget({ target });
  assert.equal(awaiting.status, "INSTALLED_AWAITING_REVIEW");
  const lock = JSON.parse(readFileSync(path.join(target, INSTALLATION_LOCK_PATH), "utf8"));
  const evidenceDir = path.join(target, "docs/receipts");
  const catalogFile = path.join(target, "docs/_indexes/governance-catalog.json");
  const catalog = JSON.parse(readFileSync(catalogFile, "utf8"));
  catalog.migration.status = "reviewed";
  catalog.migration.receiptRef = "docs/receipts/human-policy-decision.json";
  const effectivePolicyRef = "docs/design/fixture-effective-policy.md";
  const effectivePolicyBytes = "# Fixture effective policy\n";
  const candidateSourceRef = "docs/ADOPT.md";
  const candidateSourceBytes = readFileSync(path.join(target, candidateSourceRef));
  writeFileSync(path.join(target, effectivePolicyRef), effectivePolicyBytes);
  catalog.policies = [{
    id: "POL-EFFECTIVE-FIXTURE",
    kind: "policy",
    title: "Fixture effective policy",
    humanSummary: "A human-approved policy whose effective bytes are receipt-fenced.",
    authorityClass: "current_design",
    authorityState: "effective",
    approvalState: "approved",
    enforcement: "enforced",
    confidence: "high",
    effectiveRef: effectivePolicyRef,
    decisionReceiptRef: "docs/receipts/POL-EFFECTIVE-FIXTURE.json",
    sourceRefs: [{
      path: candidateSourceRef,
      heading: "Document Harness Adoption",
      lineStart: 1,
      lineEnd: 1,
      capturedSha256: sha256(candidateSourceBytes),
      capturedRepositoryRevision: lock.targetSourceRevision,
    }],
    conflicts: [],
  }];
  const catalogBytes = `${JSON.stringify(catalog, null, 2)}\n`;
  writeFileSync(catalogFile, catalogBytes);
  const gateCommands = new Map([
    ["view-doctor", "./runtime/document-harness-view/bin/human-view doctor"],
    ["view-test", "./runtime/document-harness-view/bin/human-view test"],
    ["quality-fast", "./runtime/document-harness-view/bin/human-view doctor"],
    ["quality-full", "./runtime/document-harness-view/bin/human-view test"],
    ["quality-continuous", "./runtime/document-harness-view/bin/human-view snapshot"],
  ]);
  const gateEvidence = new Map([...gateCommands].map(([id, command]) => [id, `${JSON.stringify({
    schemaVersion: 1,
    gateId: id,
    result: "passed",
    command,
    exitCode: 0,
    targetSourceRevision: lock.targetSourceRevision,
    releaseSourceRevision: lock.release.sourceRevision,
    observedAt: "2026-07-16T00:00:00.000Z",
  }, null, 2)}\n`]));
  writeFileSync(path.join(evidenceDir, "migration-evidence-pack.json"), `${JSON.stringify({
    schemaVersion: 1,
    release: lock.release,
    targetSourceRevision: lock.targetSourceRevision,
    installationReceiptRef: lock.receiptRef,
    humanDecisionReceiptRefs: [
      "docs/receipts/human-policy-decision.json",
      "docs/receipts/POL-EFFECTIVE-FIXTURE.json",
    ],
    gates: [...gateEvidence].map(([id, bytes]) => ({
      id,
      required: true,
      result: "passed",
      evidenceRef: `docs/receipts/${id}.json`,
      evidenceSha256: sha256(bytes),
    })),
    allRequiredGatesPassed: true,
    humanReviewComplete: true,
    rollbackRef: null,
  }, null, 2)}\n`);
  const missingReceipts = verifyTarget({ target });
  assert.equal(missingReceipts.status, "INSTALLED_AWAITING_REVIEW");
  for (const [id, bytes] of gateEvidence) writeFileSync(path.join(evidenceDir, `${id}.json`), bytes);
  writeFileSync(path.join(evidenceDir, "human-policy-decision.json"), `${JSON.stringify({
    schemaVersion: 1,
    candidateId: "CATALOG-REVIEW",
    decision: "approved",
    decidedBy: { actorKind: "human", identifier: "fixture-human" },
    sourceFence: { repositoryRevision: lock.targetSourceRevision, sourceHashes: [sha256(catalogBytes)] },
  }, null, 2)}\n`);
  assert.equal(verifyTarget({ target }).status, "INSTALLED_AWAITING_REVIEW");
  writeFileSync(path.join(evidenceDir, "human-policy-decision.json"), `${JSON.stringify({
    schemaVersion: 1,
    decisionId: "DEC-001",
    candidateId: "CATALOG-REVIEW",
    decision: "approved",
    decidedBy: { actorKind: "human", identifier: "fixture-human" },
    decidedAt: "2026-07-16T00:00:00.000Z",
    sourceFence: { repositoryRevision: lock.targetSourceRevision, sourceHashes: [sha256(catalogBytes)] },
    effectiveRef: "docs/_indexes/governance-catalog.json",
    effectiveSha256: sha256(catalogBytes),
    reason: "fixture review",
  }, null, 2)}\n`);
  writeFileSync(path.join(evidenceDir, "POL-EFFECTIVE-FIXTURE.json"), `${JSON.stringify({
    schemaVersion: 1,
    decisionId: "DEC-POL-EFFECTIVE-FIXTURE",
    candidateId: "POL-EFFECTIVE-FIXTURE",
    decision: "approved",
    decidedBy: { actorKind: "human", identifier: "fixture-human" },
    decidedAt: "2026-07-16T00:00:00.000Z",
    sourceFence: {
      repositoryRevision: lock.targetSourceRevision,
      sourceHashes: [sha256(candidateSourceBytes)],
    },
    effectiveRef: effectivePolicyRef,
    effectiveSha256: sha256(effectivePolicyBytes),
    reason: "fixture policy approval",
  }, null, 2)}\n`);
  const verified = verifyTarget({ target });
  assert.equal(verified.status, "MIGRATION_VERIFIED");
  writeFileSync(path.join(target, effectivePolicyRef), "# Changed after human approval\n");
  assert.equal(verifyTarget({ target }).status, "INSTALLED_AWAITING_REVIEW");
  writeFileSync(path.join(target, effectivePolicyRef), effectivePolicyBytes);
  assert.equal(verifyTarget({ target }).status, "MIGRATION_VERIFIED");
  writeFileSync(path.join(evidenceDir, "view-doctor.json"), `${gateEvidence.get("view-doctor")} `);
  const tamperedGate = verifyTarget({ target });
  assert.equal(tamperedGate.status, "INSTALLED_AWAITING_REVIEW");
});

test("governance verification rejects promoted observations, private evidence, conflicts, and stale source hashes", (t) => {
  const { base, target } = fixture(t, { mature: true });
  writeFileSync(path.join(target, ".env.local"), "API_TOKEN=fixture-secret\n");
  const planFile = path.join(base, "governance-boundary.json");
  const plan = createPlan({ target, profiles: ["core", "governance"], output: planFile });
  applyPlan({ planFile, expectedPlanHash: plan.planHash });
  const catalogFile = path.join(target, "docs/_indexes/governance-catalog.json");
  const catalog = JSON.parse(readFileSync(catalogFile, "utf8"));
  const baseCommit = catalog.migration.capturedRepository.baseCommit;
  const candidate = (overrides) => ({
    id: "POL-FIXTURE",
    kind: "policy",
    title: "Fixture policy",
    humanSummary: "A source-fenced fixture candidate.",
    authorityClass: "repository_instruction",
    authorityState: "proposed",
    approvalState: "unreviewed",
    enforcement: "unknown",
    confidence: "medium",
    effectiveRef: null,
    decisionReceiptRef: null,
    sourceRefs: [{
      path: "AGENTS.md",
      heading: "Existing project contract",
      lineStart: 1,
      lineEnd: 1,
      capturedSha256: sha256(readFileSync(path.join(target, "AGENTS.md"))),
      capturedRepositoryRevision: baseCommit,
    }],
    conflicts: [],
    ...overrides,
  });
  catalog.policies = [
    candidate({
      id: "OBS-PROMOTED",
      kind: "policy",
      authorityClass: "code_observation",
      approvalState: "approved",
      effectiveRef: "docs/receipts/fake.json",
      decisionReceiptRef: "docs/receipts/fake.json",
    }),
    candidate({
      id: "PRIVATE-SOURCE",
      sourceRefs: [{
        path: ".env.local",
        heading: "Secret",
        lineStart: 1,
        lineEnd: 1,
        capturedSha256: sha256(readFileSync(path.join(target, ".env.local"))),
        capturedRepositoryRevision: baseCommit,
      }],
    }),
    candidate({ id: "STALE-SOURCE", sourceRefs: [{
      path: "AGENTS.md",
      heading: "Existing project contract",
      lineStart: 1,
      lineEnd: 1,
      capturedSha256: "0".repeat(64),
      capturedRepositoryRevision: baseCommit,
    }] }),
    candidate({ id: "UNRESOLVED-CONFLICT", approvalState: "approved", effectiveRef: "x", decisionReceiptRef: "y", conflicts: ["OTHER"] }),
  ];
  writeFileSync(catalogFile, `${JSON.stringify(catalog, null, 2)}\n`);
  const verification = verifyTarget({ target });
  assert.equal(verification.status, "INSTALLED_NOT_VERIFIED");
  const codes = new Set(verification.findings.map(({ code }) => code));
  assert.ok(codes.has("OBSERVATION_PROMOTED_WITHOUT_POLICY_AUTHORITY"));
  assert.ok(codes.has("PRIVATE_SOURCE_EXCLUDED"));
  assert.ok(codes.has("STALE_OR_INVALID_SOURCE_REF"));
  assert.ok(codes.has("CONFLICTING_CANDIDATE_AUTO_RESOLVED"));
});
