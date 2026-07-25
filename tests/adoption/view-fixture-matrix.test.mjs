import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { buildProjection } from "../../runtime/document-harness-view/lib/projection.mjs";
import { runtimeSummary } from "../../runtime/document-harness-view/public/view-model.mjs";
import { createFixture } from "../../runtime/document-harness-view/test/helpers.mjs";

async function writeCatalog(fixture) {
  await writeFile(
    path.join(fixture.root, "docs", "governance", "catalog.json"),
    `${JSON.stringify(fixture.catalog, null, 2)}\n`,
    "utf8"
  );
}

test("view fixture: populated governance catalog", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const { snapshot } = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(snapshot.summary.policyCount, 1);
  assert.equal(snapshot.summary.guidelineCount, 1);
  assert.deepEqual(snapshot.policies.map(({ id }) => id), ["POL-1"]);
  assert.deepEqual(snapshot.guidelines.map(({ id }) => id), ["GUIDE-1"]);
  assert.equal(snapshot.direction.length, 1);
  assert.equal(snapshot.snapshot.sourceFence.sourceEvidenceState, "fresh");
});

test("view fixture: all candidates remain unreviewed", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const { snapshot } = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  const candidates = [...snapshot.policies, ...snapshot.guidelines];
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every(({ approvalState }) => approvalState === "unreviewed"));
  assert.equal(snapshot.summary.approvedCount, 0);
  assert.equal(snapshot.migration.status, "awaiting_human_review");
});

test("view fixture: execution checkpoint is explicitly not configured", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const { snapshot } = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.deepEqual(snapshot.execution, {
    configured: false,
    status: "not_configured",
    sourceRoot: "docs/checkpoints",
    message: "정규 docs/checkpoints/*.md 실행 체크포인트가 없습니다."
  });
});

test("view fixture: stale source evidence remains distinct from migration validity", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await writeFile(path.join(fixture.root, "source.md"), "# Changed policy meaning\n", "utf8");
  const { snapshot } = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(snapshot.migrationFence.state, "valid");
  assert.equal(snapshot.policies[0].evidenceState, "stale");
  assert.equal(snapshot.snapshot.sourceFence.sourceEvidenceState, "stale");
  assert.equal(snapshot.snapshot.freshness, "stale");
});

test("view fixture: degraded runtime probe remains failed and reviewable", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const runtimeDir = path.join(fixture.root, ".document-harness", "runtime", "view");
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(path.join(runtimeDir, "runtime-probes.json"), `${JSON.stringify({
    schemaVersion: 1,
    observedAt: "2026-07-16T00:00:00.000Z",
    repository: { status: "dirty", head: fixture.seedCommit, dirtyCount: 1, changedPaths: [] },
    probes: [{ id: "quality", label: "Quality", kind: "quality", ok: false, observedAt: "2026-07-16T00:00:00.000Z", error: "validator unavailable" }]
  }, null, 2)}\n`, "utf8");
  const { snapshot } = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(snapshot.runtime.probes[0].ok, false);
  assert.equal(snapshot.runtime.probes[0].error, "validator unavailable");
  assert.deepEqual(runtimeSummary(snapshot.runtime), {
    status: "DEGRADED",
    healthy: false,
    probeCount: 1,
    healthyProbes: 0,
    failedProbes: 1,
    observedAt: "2026-07-16T00:00:00.000Z",
    repositoryStatus: "dirty",
    dirtyCount: 1
  });
});

test("view fixture: empty governance source creates an explicit gap", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  fixture.catalog.policies = [];
  fixture.catalog.guidelines = [];
  fixture.initiativeRegister.initiatives = [];
  await writeCatalog(fixture);
  await writeFile(
    path.join(fixture.root, "docs", "governance", "initiatives.json"),
    `${JSON.stringify(fixture.initiativeRegister, null, 2)}\n`,
    "utf8"
  );
  const { snapshot } = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(snapshot.summary.policyCount, 0);
  assert.equal(snapshot.summary.guidelineCount, 0);
  assert.equal(snapshot.snapshot.sourceFence.sourceEvidenceState, "unknown");
  assert.equal(snapshot.snapshot.freshness, "unknown");
  assert.ok(snapshot.attention.some(({ id }) => id === "ATTN-GOVERNANCE-EMPTY"));
});

test("view fixture: long Korean and English content is preserved without truncating source truth", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const korean = "서비스는 장애 상황에서도 사용자가 현재 상태와 다음 조치를 이해할 수 있어야 합니다. ".repeat(12).trim();
  const english = "The repository must preserve provenance, migration fences, reversible operations, and explicit human review boundaries. ".repeat(10).trim();
  fixture.catalog.policies[0].title = `고가용성 및 운영 투명성 정책 — ${english}`;
  fixture.catalog.policies[0].humanSummary = `${korean} ${english}`;
  fixture.catalog.guidelines[0].title = `공유 상태와 복구 가능성을 검증한다 — ${korean}`;
  fixture.catalog.guidelines[0].humanSummary = `${english} ${korean}`;
  await writeCatalog(fixture);
  const { snapshot } = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(snapshot.policies[0].title, fixture.catalog.policies[0].title);
  assert.equal(snapshot.policies[0].humanSummary, fixture.catalog.policies[0].humanSummary);
  assert.equal(snapshot.guidelines[0].title, fixture.catalog.guidelines[0].title);
  assert.equal(snapshot.guidelines[0].humanSummary, fixture.catalog.guidelines[0].humanSummary);
  assert.ok(snapshot.policies[0].humanSummary.length > 1000);
});

test("view fixture: deleting runtime cache rebuilds the same logical projection from sources", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const first = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath, snapshotSeq: 11 });
  const runtimeDir = path.join(fixture.root, ".document-harness", "runtime", "view");
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(path.join(runtimeDir, "snapshot.json"), "corrupt derived cache\n", "utf8");
  await writeFile(path.join(runtimeDir, "lease.json"), "corrupt derived lease\n", "utf8");
  await rm(runtimeDir, { recursive: true, force: true });
  const rebuilt = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath, snapshotSeq: 1 });
  assert.deepEqual(rebuilt.snapshot.policies, first.snapshot.policies);
  assert.deepEqual(rebuilt.snapshot.guidelines, first.snapshot.guidelines);
  assert.deepEqual(rebuilt.snapshot.direction, first.snapshot.direction);
  assert.deepEqual(rebuilt.snapshot.migrationFence, first.snapshot.migrationFence);
  assert.equal(rebuilt.snapshot.snapshot.sourceFence.sourceEvidenceState, "fresh");
  await assert.rejects(readFile(path.join(runtimeDir, "snapshot.json"), "utf8"), /ENOENT/);
});
