import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildProjection, sha256 } from "../lib/projection.mjs";
import { advanceHead, createFixture } from "./helpers.mjs";

test("projection keeps approval, migration fence, current repository, and source evidence separate", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath, snapshotSeq: 7 });

  assert.equal(result.snapshot.snapshot.seq, 7);
  assert.equal(result.snapshot.runtimeVersion, "1.0.0");
  assert.equal(result.snapshot.snapshot.freshness, "fresh");
  assert.equal(result.snapshot.migrationFence.state, "valid");
  assert.equal(result.snapshot.migrationFence.resolvedBaseCommit, fixture.seedCommit);
  assert.equal(result.snapshot.currentRepository.head, fixture.seedCommit);
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "fresh");
  assert.equal(result.snapshot.policies[0].evidenceState, "current");
  assert.equal(result.snapshot.policies[0].sourceRefs[0].capturedRepositoryRevision, fixture.seedCommit);
  assert.equal(result.snapshot.policies[0].approvalState, "unreviewed");
  assert.equal(result.snapshot.summary.approvedCount, 0);
  assert.equal(result.snapshot.execution.status, "not_configured");
  assert.equal(result.snapshot.snapshot.capabilities.write, false);
});

test("an unresolvable captured base degrades the migration fence and generates attention", async (t) => {
  const fixture = await createFixture({ capturedBase: "f".repeat(40) });
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.equal(result.snapshot.migrationFence.state, "invalid");
  assert.equal(result.snapshot.migrationFence.reason, "unresolvable_captured_base");
  assert.equal(result.snapshot.snapshot.freshness, "degraded");
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "fresh");
  assert.ok(result.snapshot.attention.some((item) => item.id === "ATTN-MIGRATION-FENCE"));
});

test("later HEAD movement does not stale unchanged source evidence", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const advancedHead = await advanceHead(fixture.root);
  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.notEqual(advancedHead, fixture.seedCommit);
  assert.equal(result.snapshot.currentRepository.head, advancedHead);
  assert.equal(result.snapshot.migrationFence.state, "valid");
  assert.equal(result.snapshot.migrationFence.reason, "current_head_advanced");
  assert.equal(result.snapshot.migrationFence.currentHeadAdvanced, true);
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "fresh");
  assert.equal(result.snapshot.snapshot.freshness, "fresh");
});

test("changed and escaped evidence are stale or degraded independently of migration validity", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  fixture.catalog.policies[0].sourceRefs[0].capturedSha256 = sha256("old");
  await writeFile(path.join(fixture.root, "docs", "governance", "catalog.json"), JSON.stringify(fixture.catalog), "utf8");
  const stale = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(stale.snapshot.migrationFence.state, "valid");
  assert.equal(stale.snapshot.snapshot.sourceFence.sourceEvidenceState, "stale");
  assert.equal(stale.snapshot.snapshot.freshness, "stale");

  fixture.catalog.policies[0].sourceRefs[0] = { ...fixture.catalog.policies[0].sourceRefs[0], path: "../outside.md" };
  fixture.catalog.guidelines[0].sourceRefs[0] = { ...fixture.catalog.guidelines[0].sourceRefs[0], path: "../outside.md" };
  await writeFile(path.join(fixture.root, "docs", "governance", "catalog.json"), JSON.stringify(fixture.catalog), "utf8");
  const degraded = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(degraded.snapshot.snapshot.sourceFence.sourceEvidenceState, "degraded");
  assert.equal(degraded.snapshot.policies[0].sourceRefs[0].state, "invalid");
});

test("a source symlink cannot escape the repository", async (t) => {
  const fixture = await createFixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), "document-harness-view-source-outside-"));
  t.after(() => Promise.all([
    rm(fixture.root, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true })
  ]));
  await writeFile(path.join(outside, "private.md"), "private\n", "utf8");
  await symlink(path.join(outside, "private.md"), path.join(fixture.root, "escaped.md"));
  fixture.catalog.policies[0].sourceRefs[0] = { ...fixture.catalog.policies[0].sourceRefs[0], path: "escaped.md" };
  fixture.catalog.guidelines[0].sourceRefs[0] = { ...fixture.catalog.guidelines[0].sourceRefs[0], path: "escaped.md" };
  await writeFile(path.join(fixture.root, "docs", "governance", "catalog.json"), JSON.stringify(fixture.catalog), "utf8");

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "degraded");
  assert.equal(result.snapshot.policies[0].sourceRefs[0].state, "invalid");
});

test("the governance catalog cannot escape through a symlink to a private outside file", async (t) => {
  const fixture = await createFixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), "document-harness-view-catalog-private-"));
  t.after(() => Promise.all([
    rm(fixture.root, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true })
  ]));
  const privateCatalog = path.join(outside, "private-governance.json");
  await writeFile(privateCatalog, JSON.stringify(fixture.catalog), "utf8");
  await rm(path.join(fixture.root, "docs", "governance", "catalog.json"));
  await symlink(privateCatalog, path.join(fixture.root, "docs", "governance", "catalog.json"));

  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /governance catalog symlink일 수 없습니다/
  );
});

test("canonical governance invariants reject promoted observations and unfenced decisions", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const catalogPath = path.join(fixture.root, "docs", "governance", "catalog.json");

  fixture.catalog.guidelines[0].authorityState = "effective";
  fixture.catalog.guidelines[0].approvalState = "approved";
  fixture.catalog.guidelines[0].effectiveRef = "docs/decisions/fake.md";
  fixture.catalog.guidelines[0].decisionReceiptRef = "docs/receipts/fake.json";
  await writeFile(catalogPath, JSON.stringify(fixture.catalog), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /code\/config observation은 proposed\/unreviewed observation/
  );

  fixture.catalog.guidelines[0].authorityState = "proposed";
  fixture.catalog.guidelines[0].approvalState = "unreviewed";
  fixture.catalog.guidelines[0].effectiveRef = null;
  fixture.catalog.guidelines[0].decisionReceiptRef = null;
  fixture.catalog.policies[0].approvalState = "approved";
  await writeFile(catalogPath, JSON.stringify(fixture.catalog), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /approved 상태에는 effectiveRef와 decisionReceiptRef/
  );

  fixture.catalog.policies[0].approvalState = "unreviewed";
  fixture.catalog.migration.status = "reviewed";
  delete fixture.catalog.migration.receiptRef;
  await writeFile(catalogPath, JSON.stringify(fixture.catalog), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /reviewed이면 receiptRef가 필요합니다/
  );
});

test("approved policy projection requires complete source fences and real matching decision evidence", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const catalogPath = path.join(fixture.root, "docs", "governance", "catalog.json");
  const policy = fixture.catalog.policies[0];
  policy.authorityState = "effective";
  policy.approvalState = "approved";
  policy.effectiveRef = "docs/design/effective-policy.md";
  policy.decisionReceiptRef = "docs/receipts/POL-1.json";
  policy.sourceRefs = [{
    path: "source.md",
    heading: "Current policy",
    lineStart: 1,
    lineEnd: 1,
    capturedRepositoryRevision: fixture.seedCommit
  }];
  await writeFile(catalogPath, JSON.stringify(fixture.catalog), "utf8");

  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /capturedSha256/
  );

  policy.sourceRefs = fixture.catalog.guidelines[0].sourceRefs.map((sourceRef) => ({ ...sourceRef }));
  await writeFile(catalogPath, JSON.stringify(fixture.catalog), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /effectiveRef가 안전한 repository regular file/
  );

  await mkdir(path.join(fixture.root, "docs", "design"), { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  await writeFile(path.join(fixture.root, policy.effectiveRef), "# Effective policy\n", "utf8");
  await writeFile(path.join(fixture.root, policy.decisionReceiptRef), JSON.stringify({
    schemaVersion: 1,
    decisionId: "DEC-POL-1",
    candidateId: policy.id,
    decision: "approved",
    decidedBy: { actorKind: "human", identifier: "fixture-human" },
    decidedAt: "2026-07-16T00:00:00.000Z",
    sourceFence: {
      repositoryRevision: fixture.seedCommit,
      sourceHashes: policy.sourceRefs.map(({ capturedSha256 }) => capturedSha256)
    },
    effectiveRef: policy.effectiveRef,
    effectiveSha256: sha256("# Effective policy\n"),
    reason: "fixture approval"
  }), "utf8");
  const approved = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(approved.snapshot.snapshot.freshness, "fresh");
  assert.equal(approved.snapshot.policies[0].approvalState, "approved");
  assert.equal(approved.snapshot.summary.approvedCount, 1);

  await writeFile(path.join(fixture.root, policy.effectiveRef), "# Effective policy changed after approval\n", "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /effective ref bytes를 승인하지 않습니다/
  );
});

test("projection retries torn catalog/source reads and never publishes mixed input hashes", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  let hookCalls = 0;
  const result = await buildProjection({
    repoRoot: fixture.root,
    configPath: fixture.configPath,
    beforeInputRecheck: async ({ attempt }) => {
      hookCalls += 1;
      if (attempt === 1) await writeFile(path.join(fixture.root, "source.md"), "# Changed during projection\n", "utf8");
    }
  });

  assert.equal(hookCalls, 2);
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "stale");
  assert.equal(result.snapshot.policies[0].sourceRefs[0].currentSha256, sha256("# Changed during projection\n"));

  await assert.rejects(
    buildProjection({
      repoRoot: fixture.root,
      configPath: fixture.configPath,
      inputStabilityAttempts: 2,
      beforeInputRecheck: async ({ attempt }) => {
        await writeFile(path.join(fixture.root, "source.md"), `# Torn attempt ${attempt}\n`, "utf8");
      }
    }),
    (error) => error.code === "VIEW_INPUT_CHANGED_DURING_BUILD"
  );
});

test("migration review requires a catalog-bound human decision and is torn-read safe", async (t) => {
  const fixture = await createFixture({ receiptRef: "docs/receipts/migration.json" });
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  fixture.catalog.migration.status = "reviewed";
  const catalogPath = path.join(fixture.root, "docs", "governance", "catalog.json");
  const catalogBytes = JSON.stringify(fixture.catalog);
  await writeFile(catalogPath, catalogBytes, "utf8");
  await writeFile(path.join(fixture.root, "docs", "receipts", "migration.json"), JSON.stringify({ targetSourceRevision: "0".repeat(40) }), "utf8");
  const invalid = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.equal(invalid.snapshot.migrationFence.reason, "receipt_missing_or_invalid");
  assert.equal(invalid.snapshot.migrationFence.receiptState, "missing_or_invalid");
  assert.equal(invalid.snapshot.snapshot.sourceFence.sourceEvidenceState, "fresh");
  assert.equal(invalid.snapshot.snapshot.freshness, "degraded");

  const receiptPath = path.join(fixture.root, "docs", "receipts", "migration.json");
  await writeFile(receiptPath, JSON.stringify({
    schemaVersion: 1,
    decisionId: "DEC-CATALOG-REVIEW",
    candidateId: "CATALOG-REVIEW",
    decision: "approved",
    decidedBy: { actorKind: "human", identifier: "fixture-human" },
    decidedAt: "2026-07-17T00:00:00.000Z",
    sourceFence: { repositoryRevision: fixture.seedCommit, sourceHashes: [sha256(catalogBytes)] },
    effectiveRef: "docs/governance/catalog.json",
    effectiveSha256: sha256(catalogBytes),
    reason: "fixture catalog review"
  }), "utf8");
  const valid = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(valid.snapshot.migrationFence.receiptState, "matched");
  assert.equal(valid.snapshot.snapshot.freshness, "fresh");

  let hookCalls = 0;
  const torn = await buildProjection({
    repoRoot: fixture.root,
    configPath: fixture.configPath,
    beforeInputRecheck: async () => {
      hookCalls += 1;
      await writeFile(receiptPath, "{}", "utf8");
    }
  });
  assert.equal(hookCalls, 2);
  assert.equal(torn.snapshot.migrationFence.receiptState, "missing_or_invalid");
  assert.equal(torn.snapshot.snapshot.freshness, "degraded");
});

function taskMarkdown({ taskId, loopState, checkpointRef, status = "active", revision = 1 }) {
  return `---
type: task
doc_id: ${taskId}
status: ${status}
execution_contract: v1
task_contract_revision: ${revision}
loop_state: ${loopState}
checkpoint_ref: ${checkpointRef ?? ""}
---

# ${taskId}
`;
}

function yamlList(name, values) {
  if (values.length === 0) return `${name}: []`;
  return `${name}:\n${values.map((value) => `  - ${value}`).join("\n")}`;
}

function checkpointMarkdown({
  id,
  taskId,
  recordedAt,
  attemptSeq,
  checkpointSeq,
  nextAction,
  loopState = "running",
  nextActor = "agent",
  stopReason = null,
  evidence = [],
  attention = [],
  receipts = [],
  iterationsUsed = 2,
  iterationsMax = 8,
  elapsedMinutes = 4,
  timeLimitMinutes = 60,
  taskStatus = "active",
  taskCheckpointRef = `docs/checkpoints/${taskId}-execution.md`,
  sourceRevision = "working-tree",
  sourceHash = sha256(taskMarkdown({
    taskId,
    status: taskStatus,
    loopState,
    checkpointRef: taskCheckpointRef
  }))
}) {
  return `---
type: execution-checkpoint
execution_contract: v1
checkpoint_id: "${id}"
checkpoint_seq: ${checkpointSeq}
task_id: ${taskId}
task_contract_revision: 1
attempt_seq: ${attemptSeq}
loop_state: ${loopState}
stop_reason: ${stopReason ?? ""}
next_actor: ${nextActor}
current_hypothesis: Observe the canonical checkpoint.
last_action: Updated the canonical Markdown checkpoint.
next_action: ${nextAction}
resume_when: The next bounded action is available.
policy_refs:
  - docs/_indexes/execution-loop-policy.yaml
directive_refs: []
${yamlList("evidence", evidence)}
risks: []
${yamlList("attention", attention)}
${yamlList("receipts", receipts)}
budget:
  iterations_used: ${iterationsUsed}
  iterations_max: ${iterationsMax}
  elapsed_minutes: ${elapsedMinutes}
  time_limit_minutes: ${timeLimitMinutes}
source_refs: []
source_revision: ${sourceRevision}
source_hash: ${sourceHash}
recorded_at: "${recordedAt}"
tags:
  - docs/execution-checkpoint
---

# ${taskId} Execution Checkpoint
`;
}

test("execution projection selects the latest canonical Markdown checkpoint deterministically", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const checkpointRoot = path.join(fixture.root, "docs", "checkpoints");
  const taskRoot = path.join(fixture.root, "docs", "tasks");
  await mkdir(checkpointRoot, { recursive: true });
  await mkdir(taskRoot, { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  await writeFile(path.join(fixture.root, "docs", "receipts", "T0004-evidence.json"), "{\"result\":\"passed\"}\n", "utf8");
  const completedTask = taskMarkdown({
    taskId: "T0004",
    status: "done",
    loopState: "succeeded",
    checkpointRef: "docs/checkpoints/T0004-execution.md"
  });
  await writeFile(path.join(fixture.root, "docs", "receipts", "T0004-receipt.json"), JSON.stringify({
    receipt_id: "RCPT-T0004-C2",
    receipt_kind: "test",
    task_id: "T0004",
    checkpoint_seq: 2,
    actor: "validator",
    issued_at: "2026-07-19T00:00:00.000Z",
    scope: {},
    statement: "T0004 completion evidence passed.",
    evidence_refs: ["docs/receipts/T0004-evidence.json"],
    approval_fence: null,
    source_revision: "working-tree",
    source_hash: sha256(completedTask)
  }), "utf8");
  await writeFile(path.join(taskRoot, "T0001-first.md"), taskMarkdown({
    taskId: "T0001",
    loopState: "running",
    checkpointRef: "docs/checkpoints/T0001-execution.md"
  }), "utf8");
  await writeFile(path.join(taskRoot, "T0002-second.md"), taskMarkdown({
    taskId: "T0002",
    loopState: "running",
    checkpointRef: "docs/checkpoints/T0002-execution.md"
  }), "utf8");
  await writeFile(path.join(taskRoot, "T0004-completed.md"), completedTask, "utf8");
  await writeFile(path.join(checkpointRoot, "T0001-execution.md"), checkpointMarkdown({
    id: "T0001:A1:C9",
    taskId: "T0001",
    recordedAt: "2026-07-16T00:00:00.000Z",
    attemptSeq: 1,
    checkpointSeq: 9,
    nextAction: "older action"
  }), "utf8");
  await writeFile(path.join(checkpointRoot, "T0002-execution.md"), checkpointMarkdown({
    id: "T0002:A2:C1",
    taskId: "T0002",
    recordedAt: "2026-07-17T00:00:00.000Z",
    attemptSeq: 2,
    checkpointSeq: 1,
    nextAction: "run full validation"
  }), "utf8");
  await writeFile(path.join(checkpointRoot, "T9999-orphan-execution.md"), checkpointMarkdown({
    id: "T9999:A9:C9",
    taskId: "T9999",
    recordedAt: "2026-07-18T00:00:00.000Z",
    attemptSeq: 9,
    checkpointSeq: 9,
    nextAction: "orphan must not hijack the View"
  }), "utf8");
  await writeFile(path.join(checkpointRoot, "T0004-execution.md"), checkpointMarkdown({
    id: "T0004:A3:C2",
    taskId: "T0004",
    recordedAt: "2026-07-19T00:00:00.000Z",
    attemptSeq: 3,
    checkpointSeq: 2,
    nextAction: "historical completion must not hide active work",
    loopState: "succeeded",
    nextActor: "none",
    taskStatus: "done",
    evidence: ["docs/receipts/T0004-evidence.json"],
    receipts: ["docs/receipts/T0004-receipt.json"]
  }), "utf8");
  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.deepEqual({
    configured: result.snapshot.execution.configured,
    status: result.snapshot.execution.status,
    checkpointId: result.snapshot.execution.checkpointId,
    nextAction: result.snapshot.execution.nextAction
  }, {
    configured: true,
    status: "observed",
    checkpointId: "T0002:A2:C1",
    nextAction: "run full validation"
  });
  assert.equal(result.snapshot.execution.source, "docs/checkpoints/T0002-execution.md");
  assert.equal(result.snapshot.execution.selection.candidateCount, 3);
  assert.match(result.snapshot.execution.selection.strategy, /^active_non_succeeded/);
});

test("execution checkpoint symlinks fail closed without reading outside the repository", async (t) => {
  const fixture = await createFixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), "document-harness-view-checkpoint-outside-"));
  t.after(() => Promise.all([
    rm(fixture.root, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true })
  ]));
  const checkpointRoot = path.join(fixture.root, "docs", "checkpoints");
  const taskRoot = path.join(fixture.root, "docs", "tasks");
  await mkdir(checkpointRoot, { recursive: true });
  await mkdir(taskRoot, { recursive: true });
  await writeFile(path.join(taskRoot, "T0001-linked.md"), taskMarkdown({
    taskId: "T0001",
    loopState: "running",
    checkpointRef: "docs/checkpoints/T0001-execution.md"
  }), "utf8");
  const outsideCheckpoint = path.join(outside, "T0001-execution.md");
  await writeFile(outsideCheckpoint, checkpointMarkdown({
    id: "T0001:A1:C1",
    taskId: "T0001",
    recordedAt: "2026-07-17T00:00:00.000Z",
    attemptSeq: 1,
    checkpointSeq: 1,
    nextAction: "must not be read"
  }), "utf8");
  await symlink(outsideCheckpoint, path.join(checkpointRoot, "T0001-execution.md"));

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(result.snapshot.execution.configured, true);
  assert.equal(result.snapshot.execution.status, "degraded");
  assert.match(result.snapshot.execution.error, /안전한 repository regular file/);
  assert.equal(result.snapshot.snapshot.freshness, "degraded");
});

test("execution projection enforces task linkage, checkpoint identity, and succeeded barriers", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const checkpointRoot = path.join(fixture.root, "docs", "checkpoints");
  const taskRoot = path.join(fixture.root, "docs", "tasks");
  await mkdir(checkpointRoot, { recursive: true });
  await mkdir(taskRoot, { recursive: true });
  const taskPath = path.join(taskRoot, "T0003-close.md");
  const checkpointPath = path.join(checkpointRoot, "T0003-execution.md");
  await writeFile(taskPath, taskMarkdown({
    taskId: "T0003",
    status: "done",
    loopState: "running",
    checkpointRef: "docs/checkpoints/T0003-execution.md"
  }), "utf8");
  await writeFile(checkpointPath, checkpointMarkdown({
    id: "T0003:A1:C1",
    taskId: "T0003",
    recordedAt: "2026-07-16T00:00:00.000Z",
    attemptSeq: 1,
    checkpointSeq: 1,
    nextAction: "must not project an incompatible lifecycle"
  }), "utf8");
  const incompatibleLifecycle = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(incompatibleLifecycle.snapshot.execution.status, "degraded");
  assert.match(incompatibleLifecycle.snapshot.execution.error, /status.*loop_state.*호환되지/);

  await writeFile(taskPath, taskMarkdown({
    taskId: "T0003",
    loopState: "succeeded",
    checkpointRef: "docs/checkpoints/T0003-execution.md"
  }), "utf8");
  const checkpointOptions = {
    taskId: "T0003",
    recordedAt: "2026-07-17T00:00:00.000Z",
    attemptSeq: 2,
    checkpointSeq: 4,
    nextAction: "handoff verified result",
    loopState: "succeeded",
    nextActor: "none"
  };
  await writeFile(checkpointPath, checkpointMarkdown({ ...checkpointOptions, id: "FORGED-ID" }), "utf8");
  const forgedIdentity = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(forgedIdentity.snapshot.execution.status, "degraded");
  assert.match(forgedIdentity.snapshot.execution.error, /checkpoint_id.*identity/);

  await writeFile(checkpointPath, checkpointMarkdown({ ...checkpointOptions, id: "T0003:A2:C4" }), "utf8");
  const missingBarrier = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(missingBarrier.snapshot.execution.status, "degraded");
  assert.match(missingBarrier.snapshot.execution.error, /evidence\/receipt\/attention barrier/);

  await writeFile(checkpointPath, checkpointMarkdown({
    ...checkpointOptions,
    id: "T0003:A2:C4",
    evidence: ["docs/receipts/test-evidence.json"],
    receipts: ["docs/receipts/test-receipt.json"]
  }), "utf8");
  const missingSupport = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(missingSupport.snapshot.execution.status, "degraded");
  assert.match(missingSupport.snapshot.execution.error, /non-empty repository regular file/);

  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  await writeFile(path.join(fixture.root, "docs", "receipts", "test-evidence.json"), "{\"result\":\"passed\"}\n", "utf8");
  await writeFile(path.join(fixture.root, "docs", "receipts", "test-receipt.json"), "{\"receipt\":\"not-source-fenced\"}\n", "utf8");
  const unboundReceipt = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(unboundReceipt.snapshot.execution.status, "degraded");
  assert.match(unboundReceipt.snapshot.execution.error, /canonical fields/);
  await writeFile(path.join(fixture.root, "docs", "receipts", "test-receipt.json"), JSON.stringify({
    receipt_id: "RCPT-T0003-C4",
    receipt_kind: "review",
    task_id: "T0003",
    checkpoint_seq: 4,
    actor: "human",
    issued_at: "2026-07-17T00:00:00.000Z",
    scope: {},
    statement: "T0003 completion evidence reviewed.",
    evidence_refs: ["docs/receipts/test-evidence.json"],
    approval_fence: null,
    source_revision: "working-tree",
    source_hash: sha256(taskMarkdown({
      taskId: "T0003",
      loopState: "succeeded",
      checkpointRef: "docs/checkpoints/T0003-execution.md"
    }))
  }), "utf8");
  const valid = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(valid.snapshot.execution.status, "observed");
  assert.equal(valid.snapshot.execution.loopState, "succeeded");
  assert.equal(valid.snapshot.execution.lifecycleStatus, "active");
});

test("execution projection rejects exhausted active work and a task source fence mismatch", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await mkdir(path.join(fixture.root, "docs", "tasks"), { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "checkpoints"), { recursive: true });
  const task = taskMarkdown({
    taskId: "T0005",
    loopState: "running",
    checkpointRef: "docs/checkpoints/T0005-execution.md"
  });
  await writeFile(path.join(fixture.root, "docs", "tasks", "T0005-budget.md"), task, "utf8");
  const checkpointPath = path.join(fixture.root, "docs", "checkpoints", "T0005-execution.md");
  const options = {
    id: "T0005:A1:C1",
    taskId: "T0005",
    recordedAt: "2026-07-17T00:00:00.000Z",
    attemptSeq: 1,
    checkpointSeq: 1,
    nextAction: "must stop before another action"
  };
  await writeFile(checkpointPath, checkpointMarkdown({
    ...options,
    iterationsUsed: 8,
    iterationsMax: 8
  }), "utf8");
  const exhausted = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(exhausted.snapshot.execution.status, "degraded");
  assert.match(exhausted.snapshot.execution.error, /budget.*BUDGET_EXCEEDED/);

  await writeFile(checkpointPath, checkpointMarkdown({
    ...options,
    sourceHash: "f".repeat(64)
  }), "utf8");
  const forgedSource = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(forgedSource.snapshot.execution.status, "degraded");
  assert.match(forgedSource.snapshot.execution.error, /source_hash.*linked task bytes/);
});

test("runtime-local View files do not make the projected repository dirtier", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const before = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  const stateDir = path.join(fixture.root, ".document-harness", "runtime", "view");
  await mkdir(stateDir, { recursive: true });
  await writeFile(path.join(stateDir, "lease.json"), JSON.stringify({ pid: 1 }), "utf8");
  await writeFile(path.join(stateDir, "snapshot.json"), JSON.stringify({ snapshot: 1 }), "utf8");
  const after = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.equal(after.snapshot.currentRepository.dirtyCount, before.snapshot.currentRepository.dirtyCount);
  assert.equal(after.snapshot.currentRepository.workingTreeState, before.snapshot.currentRepository.workingTreeState);
});

test("config rejects remote probes and project overrides of distribution runtime constants", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  fixture.config.probes = [{ id: "remote", label: "Remote", url: "https://example.invalid/health" }];
  await writeFile(path.join(fixture.root, "config", "view.json"), JSON.stringify(fixture.config), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /explicit loopback HTTP endpoint/
  );

  fixture.config.probes = [];
  fixture.config.stateDir = "../outside";
  await writeFile(path.join(fixture.root, "config", "view.json"), JSON.stringify(fixture.config), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /stateDir.*reference distribution 고정값/
  );

  delete fixture.config.stateDir;
  fixture.config.executionCheckpointRoot = "docs/checkpoints/custom";
  await writeFile(path.join(fixture.root, "config", "view.json"), JSON.stringify(fixture.config), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /지원하지 않는 View config key.*executionCheckpointRoot/
  );
});

test("an empty governance catalog remains an explicit unknown gap", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  fixture.catalog.policies = [];
  fixture.catalog.guidelines = [];
  await writeFile(path.join(fixture.root, "docs", "governance", "catalog.json"), JSON.stringify(fixture.catalog), "utf8");
  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.equal(result.snapshot.summary.policyCount, 0);
  assert.equal(result.snapshot.summary.guidelineCount, 0);
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "unknown");
  assert.equal(result.snapshot.snapshot.freshness, "unknown");
  assert.ok(result.snapshot.attention.some((item) => item.id === "ATTN-GOVERNANCE-EMPTY"));
});
