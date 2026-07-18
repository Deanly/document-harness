import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { applyPlan, createPlan } from "../../docs/lib/harness-adopt.mjs";

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

function run(root, executable, args = []) {
  return execFileSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function humanDecision({ decisionId, candidateId, sourceRevision, sourceHashes, effectiveRef, effectiveBytes }) {
  return {
    schemaVersion: 1,
    decisionId,
    candidateId,
    decision: "approved",
    decidedBy: { actorKind: "human", identifier: "fixture-human@example.invalid" },
    decidedAt: "2026-07-18T00:00:00Z",
    sourceFence: { repositoryRevision: sourceRevision, sourceHashes },
    effectiveRef,
    effectiveSha256: sha256(effectiveBytes),
    reason: "Fixture human approval",
  };
}

function assertInstalledReferenceClosure(target, manifest) {
  const installedMarkdown = new Set([
    "AGENTS.md",
    "CLAUDE.md",
    "docs/README.md",
    ...manifest.files
      .map(({ targetPath }) => targetPath)
      .filter((targetPath) => targetPath.endsWith(".md")),
  ]);
  const generatedLater = [
    /^docs\/checkpoints\//,
    /^docs\/receipts\//,
    /^docs\/(?:initiatives|projects|tasks|reports|qa)\//,
  ];
  const intentionallyAbsent = new Set([
    // The operations guide names this rejected legacy mirror to state that it must not exist.
    "docs/guide/execution-loop-operations.md\0docs/_indexes/execution-checkpoint.json",
  ]);
  const concreteRef = /(?:^|[`(\s])((?:docs|runtime|\.agents|\.claude)\/[A-Za-z0-9_.\/-]+(?:\.md|\.json|\.yaml|\.yml|\.mjs|\.sh|human-view|harness-adopt))/gm;
  const dangling = [];

  for (const sourcePath of [...installedMarkdown].sort()) {
    const absolute = path.join(target, sourcePath);
    assert.equal(existsSync(absolute), true, `installed markdown: ${sourcePath}`);
    const source = readFileSync(absolute, "utf8");
    for (const match of source.matchAll(concreteRef)) {
      const reference = match[1].replace(/[.,;:)]+$/, "");
      if (existsSync(path.join(target, reference))) continue;
      if (generatedLater.some((pattern) => pattern.test(reference))) continue;
      if (intentionallyAbsent.has(`${sourcePath}\0${reference}`)) continue;
      dangling.push({ sourcePath, reference });
    }
  }
  assert.deepEqual(dangling, [], `installed docs contain dangling concrete refs: ${JSON.stringify(dangling)}`);
}

function activateInitiative(file, approvalRef) {
  const dispositionReason = "승인된 예시 지침을 적용하고 검증 근거를 남깁니다.";
  const source = readFileSync(file, "utf8")
    .replace(/^status: draft$/m, "status: active")
    .replace(/^approval_status: unreviewed$/m, "approval_status: approved")
    .replace(/^approval_ref:\s*$/m, `approval_ref: ${approvalRef}`)
    .replace(/^policy_refs: \[\]$/m, "policy_refs:\n  - POL-EXAMPLE")
    .replace(/^guideline_refs: \[\]$/m, "guideline_refs:\n  - GUIDE-EXAMPLE")
    .replace(/^guideline_disposition: needs_review$/m, "guideline_disposition: linked")
    .replace(/^guideline_disposition_reason:\s*$/m, `guideline_disposition_reason: ${dispositionReason}`)
    .replace(/^- Status: draft$/m, "- Status: active")
    .replace(/^- Approval Status: unreviewed$/m, "- Approval Status: approved")
    .replace(/^- Approval Ref:\s*$/m, `- Approval Ref: ${approvalRef}`)
    .replace(/^- Guideline Disposition: needs_review$/m, "- Guideline Disposition: linked")
    .replace(/^- Guideline Disposition Reason:\s*$/m, `- Guideline Disposition Reason: ${dispositionReason}`);
  writeFileSync(file, source, "utf8");
}

test("fresh full-profile initialize installs and runs the reusable document authoring workflow", (t) => {
  const base = mkdtempSync(path.join(os.tmpdir(), "harness-fresh-authoring-"));
  const target = path.join(base, "target");
  mkdirSync(target);
  git(target, "init", "-q", "-b", "main");
  git(target, "config", "user.name", "Harness Fixture");
  git(target, "config", "user.email", "harness-fixture@example.invalid");
  git(target, "commit", "--allow-empty", "-qm", "fresh repository");
  t.after(() => rmSync(base, { recursive: true, force: true }));

  const planFile = path.join(base, "full-plan.json");
  const plan = createPlan({
    target,
    profiles: ["core", "governance", "view"],
    output: planFile,
  });
  assert.equal(plan.mode, "initialize");
  assert.equal(plan.status, "PLAN_READY");
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.status, "INSTALLED_AWAITING_REVIEW");

  const manifest = JSON.parse(readFileSync(path.join(target, "docs/releases/document-harness-v1.json"), "utf8"));
  for (const installedPath of [
    "docs/bin/new-doc.sh",
    "docs/bin/validate-closeout.sh",
    "docs/bin/close-doc.sh",
    "docs/_templates/initiative.md",
    "docs/_templates/project.md",
    "docs/_templates/task.md",
    "docs/_templates/design.md",
    "docs/_templates/guide.md",
    "docs/_templates/report.md",
    "docs/_templates/qa.md",
    "docs/design/ubiquitous-language.md",
    "docs/guide/goal-locked-completion.md",
    "docs/guide/project-cutting-and-execution.md",
    "docs/guide/umbrella-project-governance.md",
    "docs/guide/quality-axes.md",
    "docs/guide/qa-document-system.md",
  ]) {
    assert.equal(existsSync(path.join(target, installedPath)), true, installedPath);
    assert.ok(manifest.verification.requiredInstalledPaths.includes(installedPath), `verification requires ${installedPath}`);
  }

  for (const distributionOnlyPath of [
    "tests/adoption/run-all.sh",
    "docs/bin/validate-codex-readiness.sh",
    "docs/bin/validate-harness-foundation.sh",
    "docs/bin/validate-harness-adoption.sh",
    "docs/bin/validate-doc-retrieval.sh",
    "docs/tasks/T0001-retrieval-plane-baseline.md",
  ]) assert.equal(existsSync(path.join(target, distributionOnlyPath)), false, distributionOnlyPath);

  assertInstalledReferenceClosure(target, manifest);

  git(target, "add", "-A");
  git(target, "commit", "-qm", "install document harness");
  const newDoc = path.join(target, "docs/bin/new-doc.sh");

  for (const unsafeRef of [
    "DECISION-FIXTURE\nstatus: active",
    "[DECISION-FIXTURE](https://example.invalid)",
    "DECISION-FIXTURE | status: active",
    "docs/../private/decision.txt",
  ]) {
    const rejected = spawnSync(newDoc, ["initiative", "unsafe-approval-ref", unsafeRef], {
      cwd: target,
      encoding: "utf8",
    });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /unsafe characters|must not contain '\.\.' segments/);
    assert.equal(existsSync(path.join(target, "docs/initiatives/I0001-unsafe-approval-ref.md")), false);
    assert.equal(git(target, "status", "--porcelain"), "");
  }

  const initiativeCases = [
    { slug: "token-ref", ref: "DECISION-FIXTURE" },
    { slug: "path-ref", ref: "docs/receipts/initiative-issuance-42.json" },
    { slug: "url-ref", ref: "https://example.invalid/decisions/42?revision=1#approved" },
  ];
  for (const [index, fixture] of initiativeCases.entries()) {
    const number = String(index + 1).padStart(4, "0");
    const docId = `I${number}`;
    const initiativeOutput = run(target, newDoc, ["initiative", fixture.slug, fixture.ref]).trim();
    const initiativePath = path.join(target, `docs/initiatives/${docId}-${fixture.slug}.md`);
    assert.equal(path.basename(initiativeOutput), `${docId}-${fixture.slug}.md`);
    assert.match(readFileSync(initiativePath, "utf8"), new RegExp(`issuance_approval_ref: ${fixture.ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(git(target, "log", "-1", "--format=%s"), new RegExp(`^docs: issue ${docId} ${fixture.slug}$`, "m"));
    assert.equal(git(target, "status", "--porcelain"), "");

    if (docId === "I0001") {
      const draftParent = spawnSync(newDoc, ["project", "must-not-use-draft", docId], {
        cwd: target,
        encoding: "utf8",
      });
      assert.notEqual(draftParent.status, 0);
      assert.match(draftParent.stderr, /parent initiative must be active and approved/);
      assert.equal(existsSync(path.join(target, "docs/projects/P0001-must-not-use-draft.md")), false);
    }

    activateInitiative(initiativePath, `docs/receipts/${docId.toLowerCase()}-activation.json`);
    git(target, "add", initiativePath);
    git(target, "commit", "-qm", `docs: activate ${docId} fixture`);
  }

  const governanceSourceRef = "docs/design/control-plane.md";
  const governanceSourceBytes = readFileSync(path.join(target, governanceSourceRef));
  const governanceSourceHash = sha256(governanceSourceBytes);
  const governanceSourceRevision = git(target, "rev-parse", "HEAD").trim();
  const sourceRef = {
    path: governanceSourceRef,
    heading: "Purpose",
    lineStart: 1,
    lineEnd: 1,
    capturedSha256: governanceSourceHash,
    capturedRepositoryRevision: governanceSourceRevision,
  };
  mkdirSync(path.join(target, "docs", "receipts"), { recursive: true });
  const policyReceiptRef = "docs/receipts/POL-EXAMPLE.json";
  const guidelineReceiptRef = "docs/receipts/GUIDE-EXAMPLE.json";
  for (const [receiptRef, receipt] of [
    [policyReceiptRef, humanDecision({
      decisionId: "DECISION-POL-EXAMPLE",
      candidateId: "POL-EXAMPLE",
      sourceRevision: governanceSourceRevision,
      sourceHashes: [governanceSourceHash],
      effectiveRef: governanceSourceRef,
      effectiveBytes: governanceSourceBytes,
    })],
    [guidelineReceiptRef, humanDecision({
      decisionId: "DECISION-GUIDE-EXAMPLE",
      candidateId: "GUIDE-EXAMPLE",
      sourceRevision: governanceSourceRevision,
      sourceHashes: [governanceSourceHash],
      effectiveRef: governanceSourceRef,
      effectiveBytes: governanceSourceBytes,
    })],
  ]) writeFileSync(path.join(target, receiptRef), `${JSON.stringify(receipt, null, 2)}\n`);

  const catalogPath = path.join(target, "docs/_indexes/governance-catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  catalog.policies = [{
    id: "POL-EXAMPLE",
    kind: "policy",
    title: "Fixture Policy",
    humanSummary: "Fixture policy",
    authorityClass: "current_design",
    authorityState: "effective",
    approvalState: "approved",
    enforcement: "enforced",
    confidence: "high",
    effectiveRef: governanceSourceRef,
    decisionReceiptRef: policyReceiptRef,
    conflicts: [],
    sourceRefs: [sourceRef],
  }];
  catalog.guidelines = [{
    id: "GUIDE-EXAMPLE",
    kind: "guideline",
    title: "Fixture Guideline",
    humanSummary: "Fixture guideline",
    policyRefs: ["POL-EXAMPLE"],
    authorityClass: "normative_standard",
    authorityState: "effective",
    approvalState: "approved",
    enforcement: "enforced",
    confidence: "high",
    effectiveRef: governanceSourceRef,
    decisionReceiptRef: guidelineReceiptRef,
    conflicts: [],
    sourceRefs: [sourceRef],
  }];
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const dispositionReason = "승인된 예시 지침을 적용하고 검증 근거를 남깁니다.";
  const initiativeRegister = { schemaVersion: 1, initiatives: [] };
  for (const [index, fixture] of initiativeCases.entries()) {
    const docId = `I${String(index + 1).padStart(4, "0")}`;
    const documentRef = `docs/initiatives/${docId}-${fixture.slug}.md`;
    const documentBytes = readFileSync(path.join(target, documentRef));
    const activationReceiptRef = `docs/receipts/${docId.toLowerCase()}-activation.json`;
    writeFileSync(path.join(target, activationReceiptRef), `${JSON.stringify(humanDecision({
      decisionId: `DECISION-ACTIVATE-${docId}`,
      candidateId: docId,
      sourceRevision: governanceSourceRevision,
      sourceHashes: [governanceSourceHash],
      effectiveRef: documentRef,
      effectiveBytes: documentBytes,
    }), null, 2)}\n`);
    initiativeRegister.initiatives.push({
      id: docId,
      kind: "initiative",
      title: fixture.slug,
      humanSummary: "Fixture initiative",
      outcome: "Fixture authoring remains source fenced.",
      whyNow: "The E2E workflow verifies activation authority.",
      lifecycleState: "active",
      approvalState: "approved",
      owner: "Fixture Human",
      currentFocus: "Issue governed delivery",
      policyRefs: ["POL-EXAMPLE"],
      policyRelationships: [{ policyId: "POL-EXAMPLE", relation: "advances", rationale: "Fixture alignment", exceptionRef: null }],
      guidelineRefs: ["GUIDE-EXAMPLE"],
      guidelineRelationships: [{ guidelineId: "GUIDE-EXAMPLE", adoption: "required", rationale: "Fixture requirement", verification: "Run validators" }],
      guidelineDisposition: "linked",
      guidelineDispositionReason: dispositionReason,
      legacyProjectRefs: [],
      successSignals: ["Authoring succeeds"],
      risks: [],
      documentRef,
      effectiveRef: documentRef,
      decisionReceiptRef: activationReceiptRef,
      sourceRevision: governanceSourceRevision,
      sourceRefs: [sourceRef],
    });
  }
  writeFileSync(path.join(target, "docs/_indexes/initiative-register.json"), `${JSON.stringify(initiativeRegister, null, 2)}\n`);
  git(target, "add", "docs/_indexes/governance-catalog.json", "docs/_indexes/initiative-register.json", "docs/receipts");
  git(target, "commit", "-qm", "test: add source-fenced activation authority fixtures");

  const missingInitiative = spawnSync(newDoc, ["project", "missing-parent", "I9999"], {
    cwd: target,
    encoding: "utf8",
  });
  assert.notEqual(missingInitiative.status, 0);
  assert.match(missingInitiative.stderr, /parent does not exist: I9999/);

  const projectOutput = run(target, newDoc, ["project", "umbrella-project", "I0001"]).trim();
  assert.equal(path.basename(projectOutput), "P0001-umbrella-project.md");
  assert.match(git(target, "log", "-1", "--format=%s"), /^docs: issue P0001 umbrella-project$/m);
  assert.match(readFileSync(path.join(target, "docs/projects/P0001-umbrella-project.md"), "utf8"), /^related_initiative: I0001$/m);
  assert.match(readFileSync(path.join(target, "docs/projects/P0001-umbrella-project.md"), "utf8"), /^initiative_relation: delivers$/m);
  assert.equal(git(target, "status", "--porcelain"), "");

  const missingProject = spawnSync(newDoc, ["task", "missing-parent", "P9999"], {
    cwd: target,
    encoding: "utf8",
  });
  assert.notEqual(missingProject.status, 0);
  assert.match(missingProject.stderr, /parent does not exist: P9999/);

  const initiativePath = path.join(target, "docs/initiatives/I0001-token-ref.md");
  const activeInitiative = readFileSync(initiativePath, "utf8");
  writeFileSync(initiativePath, activeInitiative.replace(/^status: active$/m, "status: blocked"), "utf8");
  const blockedLineage = spawnSync(newDoc, ["task", "blocked-lineage", "P0001"], {
    cwd: target,
    encoding: "utf8",
  });
  assert.notEqual(blockedLineage.status, 0);
  assert.match(blockedLineage.stderr, /parent initiative must be active and approved/);
  writeFileSync(initiativePath, activeInitiative, "utf8");
  assert.equal(git(target, "status", "--porcelain"), "");

  const taskOutput = run(target, newDoc, ["task", "first-task", "P0001"]).trim();
  assert.equal(path.basename(taskOutput), "T0001-first-task.md");
  assert.match(git(target, "log", "-1", "--format=%s"), /^docs: issue T0001 first-task$/m);
  assert.match(readFileSync(path.join(target, "docs/tasks/T0001-first-task.md"), "utf8"), /^related_project: P0001$/m);
  assert.equal(git(target, "status", "--porcelain"), "");

  const legacyProjectPath = path.join(target, "docs/projects/P0002-legacy-parent.md");
  const legacyHeader = `---\ntype: project\ndoc_id: P0002\nstatus: active\nproject_role: umbrella\numbrella_initiative: Legacy Platform\nparent_umbrella_project: self\n---\n\n# P0002 Legacy Parent\n`;
  writeFileSync(
    legacyProjectPath,
    legacyHeader.replace("parent_umbrella_project: self\n", "related_initiative: I9999\nparent_umbrella_project: self\n"),
    "utf8",
  );
  const modernCannotFallback = spawnSync(newDoc, ["task", "must-not-fallback", "P0002"], {
    cwd: target,
    encoding: "utf8",
  });
  assert.notEqual(modernCannotFallback.status, 0);
  assert.match(modernCannotFallback.stderr, /parent does not exist: I9999/);

  writeFileSync(legacyProjectPath, legacyHeader.replace("parent_umbrella_project: self\n", ""), "utf8");
  const incompleteLegacy = spawnSync(newDoc, ["task", "incomplete-legacy", "P0002"], {
    cwd: target,
    encoding: "utf8",
  });
  assert.notEqual(incompleteLegacy.status, 0);
  assert.match(incompleteLegacy.stderr, /complete explicit legacy lineage/);

  writeFileSync(legacyProjectPath, legacyHeader, "utf8");
  git(target, "add", legacyProjectPath);
  git(target, "commit", "-qm", "test: add explicit legacy parent fixture");
  const legacyTaskOutput = run(target, newDoc, ["task", "legacy-child", "P0002"]).trim();
  const legacyTaskPath = path.join(target, "docs/tasks/T0002-legacy-child.md");
  assert.equal(path.basename(legacyTaskOutput), "T0002-legacy-child.md");
  assert.match(readFileSync(legacyTaskPath, "utf8"), /^related_project: P0002$/m);
  rmSync(legacyProjectPath);
  rmSync(legacyTaskPath);
  git(target, "add", "-A");
  git(target, "commit", "-qm", "test: remove legacy issuance fixtures");
  assert.equal(git(target, "status", "--porcelain"), "");

  const qaOutput = run(target, newDoc, ["qa", "first-test-strategy"]).trim();
  const qaPath = path.join(target, "docs/qa/QA0001-first-test-strategy.md");
  assert.equal(path.basename(qaOutput), "QA0001-first-test-strategy.md");
  let qa = readFileSync(qaPath, "utf8");
  qa = qa
    .replace(/^qa_type:\s*$/m, "qa_type: strategy")
    .replace(/^owner:\s*$/m, "owner: Human")
    .replace(/^- QA Type:\s*$/m, "- QA Type: strategy")
    .replace(/^- Owner:\s*$/m, "- Owner: Human");
  writeFileSync(qaPath, qa, "utf8");
  git(target, "add", qaPath);
  git(target, "commit", "-qm", "docs: configure QA0001 strategy");

  const designOutput = run(target, newDoc, ["design", "service-boundary"]).trim();
  const guideOutput = run(target, newDoc, ["guide", "operating-rule"]).trim();
  const reportOutput = run(target, newDoc, ["report", "investigation"]).trim();
  assert.equal(path.basename(designOutput), "service-boundary.md");
  assert.equal(path.basename(guideOutput), "operating-rule.md");
  assert.match(path.basename(reportOutput), /^\d{4}-\d{2}-\d{2}-investigation\.md$/);
  git(target, "add", "-A");
  git(target, "commit", "-qm", "docs: add reusable unnumbered drafts");

  assert.match(
    run(target, path.join(target, "docs/bin/validate-execution-loop.sh"), ["--all"]),
    /Validated execution loop surfaces/,
  );
  assert.match(
    run(target, path.join(target, "docs/bin/validate-closeout.sh"), ["--all"]),
    /Validated 6 doc\(s\)\./,
  );

  const prematureClose = spawnSync(
    path.join(target, "docs/bin/close-doc.sh"),
    [path.join(target, "docs/tasks/T0001-first-task.md"), "premature close must fail"],
    { cwd: target, encoding: "utf8" },
  );
  assert.notEqual(prematureClose.status, 0);
  assert.match(prematureClose.stderr, /closeout validation failed|cannot be done|requires/);
  assert.equal(git(target, "status", "--porcelain"), "");
});
