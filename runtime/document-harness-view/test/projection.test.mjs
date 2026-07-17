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

  fixture.catalog.policies[0].sourceRefs[0] = { path: "../outside.md" };
  fixture.catalog.guidelines[0].sourceRefs[0] = { path: "../outside.md" };
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
  fixture.catalog.policies[0].sourceRefs[0] = { path: "escaped.md" };
  fixture.catalog.guidelines[0].sourceRefs[0] = { path: "escaped.md" };
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
    /governance catalog symlink가 저장소 경계를 벗어납니다/
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

test("migration receipt revision mismatch degrades without changing source hashes", async (t) => {
  const fixture = await createFixture({ receiptRef: "docs/receipts/migration.json" });
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  await writeFile(path.join(fixture.root, "docs", "receipts", "migration.json"), JSON.stringify({ targetSourceRevision: "0".repeat(40) }), "utf8");
  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.equal(result.snapshot.migrationFence.reason, "receipt_revision_mismatch");
  assert.equal(result.snapshot.migrationFence.receiptState, "mismatch");
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "fresh");
  assert.equal(result.snapshot.snapshot.freshness, "degraded");
});

test("execution checkpoint is explicit when configured and never inferred when absent", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await mkdir(path.join(fixture.root, "docs", "_indexes"), { recursive: true });
  await writeFile(path.join(fixture.root, "docs", "_indexes", "execution-checkpoint.json"), JSON.stringify({
    checkpoint_id: "CP-7",
    lifecycle_status: "active",
    loop_state: "verifying",
    next_actor: "Codex",
    next_action: "run full validation",
    budget: { iterationsUsed: 2, iterationsMax: 8 }
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
    checkpointId: "CP-7",
    nextAction: "run full validation"
  });
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
  fixture.config.executionCheckpoint = "docs/checkpoints/custom.json";
  await writeFile(path.join(fixture.root, "config", "view.json"), JSON.stringify(fixture.config), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /executionCheckpoint.*reference distribution 고정값/
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
