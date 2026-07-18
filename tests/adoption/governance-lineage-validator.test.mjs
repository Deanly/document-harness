import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..");

function run(script, args = []) {
  return execFileSync(script, args, {
    cwd: path.resolve(script, "..", "..", ".."),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

function rejected(script, args = []) {
  return spawnSync(script, args, {
    cwd: path.resolve(script, "..", "..", ".."),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

function render(templatePath, replacements) {
  let source = readFileSync(templatePath, "utf8");
  for (const [token, value] of Object.entries(replacements)) {
    source = source.replaceAll(`{{${token}}}`, value);
  }
  return source;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function writeDecisionReceipt(docs, relativePath, {
  decisionId,
  candidateId,
  sourceRevision,
  sourceHashes,
  effectiveRef,
  effectiveBytes,
  actorKind = "human",
}) {
  writeFileSync(path.join(docs, "..", relativePath), `${JSON.stringify({
    schemaVersion: 1,
    decisionId,
    candidateId,
    decision: "approved",
    decidedBy: { actorKind, identifier: "fixture-human@example.invalid" },
    decidedAt: "2026-07-18T00:00:00Z",
    sourceFence: { repositoryRevision: sourceRevision, sourceHashes },
    effectiveRef,
    effectiveSha256: sha256(effectiveBytes),
    reason: "Fixture human approval",
  }, null, 2)}\n`);
}

test("installed validators fail closed on modern governance lineage and preserve explicit legacy bridges", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "harness-governance-lineage-"));
  const docs = path.join(root, "docs");
  cpSync(path.join(REPO_ROOT, "docs"), docs, { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "Governance Fixture");
  git(root, "config", "user.email", "governance-fixture@example.invalid");

  const closeout = path.join(docs, "bin", "validate-closeout.sh");
  const execution = path.join(docs, "bin", "validate-execution-loop.sh");
  chmodSync(closeout, 0o755);
  chmodSync(execution, 0o755);
  mkdirSync(path.join(docs, "initiatives"), { recursive: true });
  mkdirSync(path.join(docs, "projects"), { recursive: true });
  mkdirSync(path.join(docs, "tasks"), { recursive: true });
  mkdirSync(path.join(docs, "receipts"), { recursive: true });
  mkdirSync(path.join(docs, "_indexes"), { recursive: true });

  const governanceSourceRef = "docs/design/governance-fixture-source.md";
  const governanceSource = "# Governance Fixture Source\n\nHuman-reviewed outcome and verification boundaries.\n";
  const policyEffectiveRef = "docs/design/governance-fixture-policy.md";
  const policyEffective = "# Effective fixture policy\n";
  const guidelineEffectiveRef = "docs/guide/governance-fixture-guideline.md";
  const guidelineEffective = "# Effective fixture guideline\n";
  writeFileSync(path.join(root, governanceSourceRef), governanceSource);
  writeFileSync(path.join(root, policyEffectiveRef), policyEffective);
  writeFileSync(path.join(root, guidelineEffectiveRef), guidelineEffective);
  git(root, "add", governanceSourceRef, policyEffectiveRef, guidelineEffectiveRef);
  git(root, "commit", "-qm", "fixture: add governance sources");
  const sourceRevision = git(root, "rev-parse", "HEAD");
  const sourceHash = sha256(governanceSource);

  const initiativePath = path.join(docs, "initiatives", "I9001-governed-outcome.md");
  const projectPath = path.join(docs, "projects", "P9001-governed-delivery.md");
  const taskPath = path.join(docs, "tasks", "T9001-governed-work.md");
  const activationReceiptRef = "docs/receipts/I9001-activation.json";
  const initiative = `---
type: initiative
doc_id: I9001
initiative_contract: v1
status: active
approval_status: approved
issuance_approval_ref: DECISION-ISSUE-I9001
approval_ref: ${activationReceiptRef}
policy_refs:
  - POL-FIXTURE
guideline_refs:
  - GUIDE-FIXTURE
guideline_disposition: linked
guideline_disposition_reason: 승인된 필수 지침을 적용합니다.
---

# I9001 Governed Outcome
`;
  const project = render(path.join(docs, "_templates", "project.md"), {
    DOC_ID: "P9001",
    TITLE: "governed-delivery",
    RELATED_INITIATIVE: "I9001",
    INITIATIVE_RELATION: "delivers",
    DATE: "2026-07-18",
  });
  const task = render(path.join(docs, "_templates", "task.md"), {
    DOC_ID: "T9001",
    TITLE: "governed-work",
    RELATED_PROJECT: "P9001",
    DATE: "2026-07-18",
  });
  writeFileSync(initiativePath, initiative);
  writeFileSync(projectPath, project);
  writeFileSync(taskPath, task);

  const initiativeRelative = path.relative(root, initiativePath).replaceAll(path.sep, "/");
  writeDecisionReceipt(docs, activationReceiptRef, {
    decisionId: "DECISION-ACTIVATE-I9001",
    candidateId: "I9001",
    sourceRevision,
    sourceHashes: [sourceHash],
    effectiveRef: initiativeRelative,
    effectiveBytes: initiative,
  });
  writeDecisionReceipt(docs, "docs/receipts/POL-FIXTURE.json", {
    decisionId: "DECISION-POL-FIXTURE",
    candidateId: "POL-FIXTURE",
    sourceRevision,
    sourceHashes: [sourceHash],
    effectiveRef: policyEffectiveRef,
    effectiveBytes: policyEffective,
  });
  writeDecisionReceipt(docs, "docs/receipts/GUIDE-FIXTURE.json", {
    decisionId: "DECISION-GUIDE-FIXTURE",
    candidateId: "GUIDE-FIXTURE",
    sourceRevision,
    sourceHashes: [sourceHash],
    effectiveRef: guidelineEffectiveRef,
    effectiveBytes: guidelineEffective,
  });

  const sourceRef = {
    path: governanceSourceRef,
    heading: "Governance Fixture Source",
    lineStart: 1,
    lineEnd: 3,
    capturedSha256: sourceHash,
    capturedRepositoryRevision: sourceRevision,
  };
  const catalog = {
    schemaVersion: 1,
    migration: {
      status: "awaiting_human_review",
      capturedRepository: { baseCommit: sourceRevision, workingTreeState: "clean" },
      capturedAt: "2026-07-18T00:00:00Z",
      approvalRule: "Fixture human approvals are source fenced.",
    },
    direction: [],
    policies: [{
      id: "POL-FIXTURE",
      kind: "policy",
      title: "Fixture Policy",
      humanSummary: "Fixture policy",
      authorityClass: "current_design",
      authorityState: "effective",
      approvalState: "approved",
      enforcement: "enforced",
      confidence: "high",
      effectiveRef: policyEffectiveRef,
      decisionReceiptRef: "docs/receipts/POL-FIXTURE.json",
      conflicts: [],
      sourceRefs: [sourceRef],
    }],
    guidelines: [{
      id: "GUIDE-FIXTURE",
      kind: "guideline",
      title: "Fixture Guideline",
      humanSummary: "Fixture guideline",
      policyRefs: ["POL-FIXTURE"],
      authorityClass: "normative_standard",
      authorityState: "effective",
      approvalState: "approved",
      enforcement: "enforced",
      confidence: "high",
      effectiveRef: guidelineEffectiveRef,
      decisionReceiptRef: "docs/receipts/GUIDE-FIXTURE.json",
      conflicts: [],
      sourceRefs: [sourceRef],
    }],
    attention: [],
    gaps: [],
  };
  const register = {
    schemaVersion: 1,
    initiatives: [{
      id: "I9001",
      kind: "initiative",
      title: "Governed Outcome",
      humanSummary: "Governed outcome",
      outcome: "Governed delivery remains source fenced.",
      whyNow: "The fixture verifies activation authority.",
      lifecycleState: "active",
      approvalState: "approved",
      owner: "Fixture Human",
      currentFocus: "Verify authority",
      policyRefs: ["POL-FIXTURE"],
      policyRelationships: [{ policyId: "POL-FIXTURE", relation: "advances", rationale: "Fixture alignment", exceptionRef: null }],
      guidelineRefs: ["GUIDE-FIXTURE"],
      guidelineRelationships: [{ guidelineId: "GUIDE-FIXTURE", adoption: "required", rationale: "Fixture requirement", verification: "Run validators" }],
      guidelineDisposition: "linked",
      guidelineDispositionReason: "승인된 필수 지침을 적용합니다.",
      legacyProjectRefs: [],
      successSignals: ["Authority validator passes"],
      risks: [],
      documentRef: initiativeRelative,
      effectiveRef: initiativeRelative,
      decisionReceiptRef: activationReceiptRef,
      sourceRevision,
      sourceRefs: [sourceRef],
    }],
  };
  const catalogPath = path.join(docs, "_indexes", "governance-catalog.json");
  const registerPath = path.join(docs, "_indexes", "initiative-register.json");
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);

  assert.match(run(execution, [taskPath]), /Validated execution loop surfaces/);
  assert.match(run(closeout, [projectPath, taskPath]), /Validated 2 doc\(s\)/);

  const selfDeclaredApproval = "DECISION-ACTIVATE-I9001";
  writeFileSync(initiativePath, initiative.replace(activationReceiptRef, selfDeclaredApproval));
  register.initiatives[0].decisionReceiptRef = selfDeclaredApproval;
  writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);
  const selfDeclared = rejected(execution, [taskPath]);
  assert.notEqual(selfDeclared.status, 0);
  assert.match(selfDeclared.stderr, /approval_ref must be a repository-relative JSON activation receipt/);
  writeFileSync(initiativePath, initiative);
  register.initiatives[0].decisionReceiptRef = activationReceiptRef;
  writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);

  const activationReceiptPath = path.join(root, activationReceiptRef);
  const activationReceipt = readFileSync(activationReceiptPath, "utf8");
  writeFileSync(activationReceiptPath, activationReceipt.replace('"actorKind": "human"', '"actorKind": "agent"'));
  const nonHumanActivation = rejected(closeout, [projectPath]);
  assert.notEqual(nonHumanActivation.status, 0);
  assert.match(nonHumanActivation.stderr, /required human actor/);
  writeFileSync(activationReceiptPath, activationReceipt);

  writeFileSync(initiativePath, initiative.replace("guideline_disposition: linked", "guideline_disposition: needs_review"));
  register.initiatives[0].guidelineDisposition = "needs_review";
  writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);
  const unresolvedGuideline = rejected(execution, [taskPath]);
  assert.notEqual(unresolvedGuideline.status, 0);
  assert.match(unresolvedGuideline.stderr, /cannot retain guideline_disposition: needs_review/);
  writeFileSync(initiativePath, initiative);
  register.initiatives[0].guidelineDisposition = "linked";
  writeFileSync(registerPath, `${JSON.stringify(register, null, 2)}\n`);

  catalog.guidelines[0].approvalState = "unreviewed";
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  const unapprovedRequiredGuideline = rejected(closeout, [projectPath]);
  assert.notEqual(unapprovedRequiredGuideline.status, 0);
  assert.match(unapprovedRequiredGuideline.stderr, /required guideline .* current effective\/approved governance/);
  catalog.guidelines[0].approvalState = "approved";
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  writeFileSync(path.join(root, governanceSourceRef), `${governanceSource}stale\n`);
  const staleFence = rejected(execution, [taskPath]);
  assert.notEqual(staleFence.status, 0);
  assert.match(staleFence.stderr, /is stale/);
  writeFileSync(path.join(root, governanceSourceRef), governanceSource);

  writeFileSync(initiativePath, initiative.replace("status: active", "status: draft"));
  const inactiveExecution = rejected(execution, [taskPath]);
  assert.notEqual(inactiveExecution.status, 0);
  assert.match(inactiveExecution.stderr, /parent initiative I9001 must be active and approved/);
  const inactiveCloseout = rejected(closeout, [projectPath]);
  assert.notEqual(inactiveCloseout.status, 0);
  assert.match(inactiveCloseout.stderr, /parent initiative I9001 must be active and approved/);
  writeFileSync(initiativePath, initiative);

  const missingParentTask = task
    .replace(/^related_project: P9001$/m, "related_project: P9999")
    .replace(/^- Related Project: P9001$/m, "- Related Project: P9999");
  writeFileSync(taskPath, missingParentTask);
  const missingProject = rejected(execution, [taskPath]);
  assert.notEqual(missingProject.status, 0);
  assert.match(missingProject.stderr, /missing canonical project document: P9999/);
  writeFileSync(taskPath, task);

  const invalidModernParent = project
    .replace(/^related_initiative: I9001$/m, "related_initiative: I9999")
    .replace(/^- Related Initiative: I9001$/m, "- Related Initiative: I9999")
    .replace(/^lineage_contract: v2$/m, "lineage_contract: v2\nproject_role: umbrella\numbrella_initiative: legacy fallback must not apply\nparent_umbrella_project: self");
  writeFileSync(projectPath, invalidModernParent);
  const noModernFallback = rejected(execution, [taskPath]);
  assert.notEqual(noModernFallback.status, 0);
  assert.match(noModernFallback.stderr, /missing canonical initiative document: I9999/);

  const legacyProject = `---
type: project
doc_id: P9001
status: active
project_role: umbrella
umbrella_initiative: Legacy Platform
parent_umbrella_project: self
---

# P9001 Legacy Platform
`;
  writeFileSync(projectPath, legacyProject);
  assert.match(run(execution, [taskPath]), /Validated execution loop surfaces/);
  assert.match(run(closeout, [taskPath]), /Validated 1 doc\(s\)/);

  const explicitLegacyTask = task
    .replace(/^lineage_contract: v2\n/m, "")
    .replace(/^related_project: P9001$/m, "related_umbrella_project: docs/projects/P9001-governed-delivery.md")
    .replace(/^- Related Project: P9001$/m, "- Related Umbrella Project: docs/projects/P9001-governed-delivery.md");
  writeFileSync(taskPath, explicitLegacyTask);
  assert.match(run(execution, [taskPath]), /Validated execution loop surfaces/);
  assert.match(run(closeout, [taskPath]), /Validated 1 doc\(s\)/);

  const roadcoreLegacyTask = task
    .replace(/^lineage_contract: v2\n/m, "")
    .replace(
      /^related_project: P9001$/m,
      "related_umbrella_project: P9001-governed-delivery\nrelated_project: docs/projects/P9001-governed-delivery.md",
    )
    .replace(
      /^- Related Project: P9001$/m,
      "- Related Umbrella Project: P9001-governed-delivery\n- Related Project: docs/projects/P9001-governed-delivery.md",
    );
  writeFileSync(taskPath, roadcoreLegacyTask);
  assert.match(run(execution, [taskPath]), /Validated execution loop surfaces/);
  assert.match(run(closeout, [taskPath]), /Validated 1 doc\(s\)/);

  const v2CannotUseLegacyPath = roadcoreLegacyTask.replace(
    /^type: task$/m,
    "type: task\nlineage_contract: v2",
  );
  writeFileSync(taskPath, v2CannotUseLegacyPath);
  const rejectedV2Path = rejected(execution, [taskPath]);
  assert.notEqual(rejectedV2Path.status, 0);
  assert.match(rejectedV2Path.stderr, /modern Related Project must match P####/);

  const canonicalModernCannotFallback = roadcoreLegacyTask
    .replace(
      /^related_project: docs\/projects\/P9001-governed-delivery\.md$/m,
      "related_project: P9999",
    )
    .replace(
      /^- Related Project: docs\/projects\/P9001-governed-delivery\.md$/m,
      "- Related Project: P9999",
    );
  writeFileSync(taskPath, canonicalModernCannotFallback);
  const rejectedCanonicalModern = rejected(execution, [taskPath]);
  assert.notEqual(rejectedCanonicalModern.status, 0);
  assert.match(rejectedCanonicalModern.stderr, /missing canonical project document: P9999/);
});
