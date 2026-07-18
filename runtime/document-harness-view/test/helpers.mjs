import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function git(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "View Fixture",
      GIT_AUTHOR_EMAIL: "view-fixture@example.invalid",
      GIT_COMMITTER_NAME: "View Fixture",
      GIT_COMMITTER_EMAIL: "view-fixture@example.invalid"
    }
  });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

export async function createFixture(options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "document-harness-view-"));
  await mkdir(path.join(root, "config"), { recursive: true });
  await mkdir(path.join(root, "docs", "governance"), { recursive: true });
  await mkdir(path.join(root, "docs", "initiatives"), { recursive: true });
  await mkdir(path.join(root, "docs", "projects"), { recursive: true });
  git(root, ["init", "--quiet"]);
  await writeFile(path.join(root, "source.md"), "# Current policy\n", "utf8");
  git(root, ["add", "source.md"]);
  git(root, ["commit", "--quiet", "-m", "seed source"]);
  const seedCommit = git(root, ["rev-parse", "HEAD"]);
  const capturedBase = options.capturedBase ?? seedCommit;

  const config = {
    schemaVersion: 1,
    project: { id: options.projectId ?? "fixture", name: options.projectName ?? "Fixture", description: "Fixture repository" },
    governanceCatalog: "docs/governance/catalog.json",
    initiativeRegister: "docs/governance/initiatives.json",
    qualityCommands: { fast: "./verify-fast", full: "./verify-full", continuous: "./verify-continuous" },
    probes: options.probes ?? []
  };
  await writeFile(path.join(root, "config", "view.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const sourceRef = {
    path: "source.md",
    heading: "Current policy",
    lineStart: 1,
    lineEnd: 1,
    evidenceKind: "current_design",
    capturedSha256: sha256("# Current policy\n"),
    capturedRepositoryRevision: capturedBase
  };
  const migration = {
    status: "awaiting_human_review",
    capturedRepository: {
      baseCommit: capturedBase,
      workingTreeState: options.capturedWorkingTreeState ?? "dirty"
    },
    capturedAt: "2026-07-16T00:00:00.000Z",
    approvalRule: "AI-extracted candidates remain unapproved until a human decision receipt exists."
  };
  if (options.receiptRef) migration.receiptRef = options.receiptRef;
  const catalog = {
    schemaVersion: 1,
    migration,
    direction: ["Keep repository truth source-linked and human-governed."],
    policies: [{
      id: "POL-1",
      kind: "policy",
      title: "Keep source authority explicit",
      humanSummary: "Every candidate links to an exact repository source.",
      authorityClass: "current_design",
      authorityState: "proposed",
      approvalState: "unreviewed",
      enforcement: "enforced",
      confidence: "high",
      effectiveRef: null,
      decisionReceiptRef: null,
      conflicts: [],
      sourceRefs: [sourceRef]
    }],
    guidelines: [{
      id: "GUIDE-1",
      kind: "observation",
      title: "Validate captured source hashes",
      humanSummary: "Compare captured and current source bytes without self-approving policy.",
      policyRefs: ["POL-1"],
      authorityClass: "code_observation",
      authorityState: "proposed",
      approvalState: "unreviewed",
      enforcement: "partially_enforced",
      confidence: "high",
      effectiveRef: null,
      decisionReceiptRef: null,
      conflicts: [],
      sourceRefs: [sourceRef]
    }],
    attention: [],
    gaps: []
  };
  await writeFile(path.join(root, "docs", "governance", "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  const initiativeRegister = {
    schemaVersion: 1,
    initiatives: [{
      id: "I0001",
      kind: "initiative",
      title: "Keep the fixture source-linked",
      humanSummary: "Turn the fixture policy into one bounded delivery direction.",
      outcome: "The fixture remains traceable from policy to project.",
      whyNow: "Projection tests need a real initiative relationship.",
      lifecycleState: "draft",
      approvalState: "review_requested",
      owner: "Fixture Owner",
      currentFocus: "Review the proposed policy, guideline, and project relationship.",
      policyRefs: ["POL-1"],
      policyRelationships: [{
        policyId: "POL-1",
        relation: "advances",
        rationale: "The initiative turns the policy direction into a bounded outcome.",
        exceptionRef: null
      }],
      guidelineRefs: ["GUIDE-1"],
      guidelineRelationships: [{
        guidelineId: "GUIDE-1",
        adoption: "recommended",
        rationale: "The proposed guideline describes how evidence should be collected.",
        verification: "Review the linked project evidence before activation."
      }],
      guidelineDisposition: "needs_review",
      guidelineDispositionReason: "The guideline is still a review candidate and must not be presented as effective.",
      legacyProjectRefs: [],
      successSignals: ["The linked project is visible without inferred progress."],
      risks: ["The candidate has not been approved."],
      documentRef: "docs/initiatives/I0001-fixture.md",
      effectiveRef: null,
      decisionReceiptRef: null,
      sourceRevision: capturedBase,
      sourceRefs: [sourceRef]
    }]
  };
  await writeFile(path.join(root, "docs", "governance", "initiatives.json"), `${JSON.stringify(initiativeRegister, null, 2)}\n`, "utf8");
  await writeFile(path.join(root, "docs", "initiatives", "I0001-fixture.md"), `---\ntype: initiative\ndoc_id: I0001\ninitiative_contract: v1\nstatus: draft\napproval_status: review_requested\nissuance_approval_ref: DECISION-FIXTURE\napproval_ref:\npolicy_refs:\n  - POL-1\nguideline_refs:\n  - GUIDE-1\nguideline_disposition: needs_review\nguideline_disposition_reason: The guideline is still a review candidate and must not be presented as effective.\n---\n\n# I0001 Fixture\n\n## Policy Alignment\n\n| Policy Ref | Relation | Rationale | Exception Ref |\n| --- | --- | --- | --- |\n| POL-1 | advances | The initiative turns the policy direction into a bounded outcome. | |\n\n## Guideline Disposition\n\n| Guideline Ref | Adoption | Rationale | Verification |\n| --- | --- | --- | --- |\n| GUIDE-1 | recommended | The proposed guideline describes how evidence should be collected. | Review the linked project evidence before activation. |\n`, "utf8");
  await writeFile(path.join(root, "docs", "projects", "P0001-fixture.md"), `---\ntype: project\ndoc_id: P0001\ntitle: Fixture Delivery\nstatus: active\nlineage_contract: v2\nrelated_initiative: I0001\ninitiative_relation: delivers\ncurrent_focus: Keep projection behavior source-linked.\n---\n\n# P0001 Fixture Delivery\n`, "utf8");
  return { root, seedCommit, configPath: "config/view.json", config, catalog, initiativeRegister };
}

export async function advanceHead(root) {
  await writeFile(path.join(root, "unrelated.txt"), "later change\n", "utf8");
  git(root, ["add", "unrelated.txt"]);
  git(root, ["commit", "--quiet", "-m", "advance head"]);
  return git(root, ["rev-parse", "HEAD"]);
}
