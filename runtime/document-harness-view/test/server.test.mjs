import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import http from "node:http";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createFixture, git } from "./helpers.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.resolve(TEST_DIR, "..", "server.mjs");

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForLease(root, child, getErrors) {
  const leasePath = path.join(root, ".document-harness", "runtime", "view", "lease.json");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await sleep(50);
    if (child.exitCode !== null) throw new Error(`server exited before lease publication: ${child.exitCode}\n${getErrors()}`);
    try {
      return JSON.parse(await readFile(leasePath, "utf8"));
    } catch {
      // Atomic lease is not visible yet.
    }
  }
  throw new Error(`server lease was not published\n${getErrors()}`);
}

async function startFixtureServer(fixture) {
  const resolvedRoot = await realpath(fixture.root);
  const child = spawn(process.execPath, [
    SERVER_PATH,
    "--root", resolvedRoot,
    "--config", fixture.configPath,
    "--port", "auto",
    "--start-token", randomUUID()
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let errors = "";
  child.stderr.on("data", (chunk) => { errors += chunk.toString(); });
  const lease = await waitForLease(fixture.root, child, () => errors);
  return { child, lease, errors: () => errors };
}

async function stopChild(child) {
  if (child.exitCode !== null) return child.exitCode;
  child.kill("SIGTERM");
  return new Promise((resolve) => child.once("exit", (code) => resolve(code)));
}

async function waitForSnapshot(url, predicate) {
  let latest = null;
  for (let attempt = 0; attempt < 140; attempt += 1) {
    const response = await fetch(`${url}/api/v1/snapshot`, { cache: "no-store" });
    latest = await response.json();
    if (predicate(latest)) return latest;
    await sleep(50);
  }
  throw new Error(`snapshot did not converge: ${JSON.stringify(latest?.snapshot)}`);
}

function requestWithHost(url, host, method = "GET", origin = null) {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const headers = { Host: host };
    if (origin) headers.Origin = origin;
    const request = http.request({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method, headers }, (response) => {
      response.resume();
      response.once("end", () => resolve(response));
    });
    request.once("error", reject);
    request.end();
  });
}

async function approveFixturePolicy(fixture) {
  const policy = fixture.catalog.policies[0];
  policy.authorityState = "effective";
  policy.approvalState = "approved";
  policy.effectiveRef = "docs/design/effective-policy.md";
  policy.decisionReceiptRef = "docs/receipts/POL-1.json";
  await mkdir(path.join(fixture.root, "docs", "design"), { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  const effectiveBytes = "# Effective policy\n";
  await writeFile(path.join(fixture.root, policy.effectiveRef), effectiveBytes, "utf8");
  await writeFile(path.join(fixture.root, policy.decisionReceiptRef), `${JSON.stringify({
    schemaVersion: 1,
    decisionId: "DEC-POL-1",
    candidateId: policy.id,
    decision: "approved",
    decidedBy: { actorKind: "human", identifier: "fixture-human" },
    decidedAt: "2026-07-17T00:00:00.000Z",
    sourceFence: {
      repositoryRevision: fixture.seedCommit,
      sourceHashes: policy.sourceRefs.map(({ capturedSha256 }) => capturedSha256)
    },
    effectiveRef: policy.effectiveRef,
    effectiveSha256: createHash("sha256").update(effectiveBytes).digest("hex"),
    reason: "fixture approval"
  }, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(fixture.root, "docs", "governance", "catalog.json"),
    `${JSON.stringify(fixture.catalog, null, 2)}\n`,
    "utf8"
  );
}

test("server is loopback, read-only, host/origin checked, ETag-aware, and serves the exact eight-tab shell", async (t) => {
  const fixture = await createFixture({ projectId: "server-fixture" });
  await approveFixturePolicy(fixture);
  const server = await startFixtureServer(fixture);
  t.after(async () => {
    await stopChild(server.child);
    await rm(fixture.root, { recursive: true, force: true });
  });

  assert.equal(server.lease.bindHost, "127.0.0.1");
  assert.ok(server.lease.port > 0);
  assert.equal(server.lease.capabilities.write, false);
  assert.equal(server.lease.capabilities.execution, false);
  assert.equal(server.lease.capabilities.approval, false);
  assert.doesNotMatch(git(fixture.root, ["status", "--porcelain=v1", "--untracked-files=all"]), /\.document-harness/);

  const health = await fetch(`${server.lease.url}/healthz`);
  assert.equal(health.status, 200, server.errors());
  const healthBody = await health.json();
  assert.equal(healthBody.repoId, "server-fixture");
  assert.equal(healthBody.runtimeVersion, "1.5.0");

  const first = await fetch(`${server.lease.url}/api/v1/snapshot`);
  assert.equal(first.status, 200);
  const etag = first.headers.get("etag");
  const firstSnapshot = await first.json();
  assert.ok(etag);
  assert.equal(firstSnapshot.summary.approvedCount, 1);
  assert.equal(firstSnapshot.policies[0].approvalState, "approved");
  assert.equal((await fetch(`${server.lease.url}/api/v1/snapshot`, { headers: { "If-None-Match": etag } })).status, 304);
  assert.equal((await fetch(`${server.lease.url}/api/v1/snapshot`, { method: "POST" })).status, 405);
  assert.equal((await requestWithHost(`${server.lease.url}/healthz`, `example.com:${server.lease.port}`)).statusCode, 403);
  assert.equal((await requestWithHost(`${server.lease.url}/healthz`, `127.0.0.1:${server.lease.port}`, "GET", `http://example.com:${server.lease.port}`)).statusCode, 403);

  const pageBody = await (await fetch(server.lease.url)).text();
  assert.match(pageBody, /<html lang="en">/);
  assert.match(pageBody, /role="tablist"/);
  const tabLabels = [...pageBody.matchAll(/role="tab"[^>]*>([^<]+)(?:<span[^>]*>[^<]*<\/span>)?<\/button>/g)]
    .map((match) => match[1].trim());
  assert.deepEqual(tabLabels, ["Overview", "Domain", "Policies", "Guidelines", "Initiatives", "Review", "Execution", "Evidence"]);
  assert.match(pageBody, /<strong>Board<\/strong>/);
  assert.match(pageBody, /data-tab="initiatives">Initiatives<\/button>/);
  assert.match(pageBody, /id="panel-guidelines"/);
  assert.doesNotMatch(pageBody, /repository-selector|repo-selector|workspace-switcher|class="[^"]*sidebar/i);
  assert.doesNotMatch(pageBody, /https?:\/\//i);
  assert.match(pageBody, /execution-gap-copy/);

  for (const asset of ["/app.mjs?v=1", "/view-model.mjs?v=1", "/styles.css?v=1"]) {
    const response = await fetch(`${server.lease.url}${asset}`);
    assert.equal(response.status, 200);
  }
  assert.equal((await fetch(`${server.lease.url}/favicon.ico`)).status, 204);

  await writeFile(path.join(fixture.root, "docs", "governance", "catalog.json"), "{ invalid json", "utf8");
  const degraded = await waitForSnapshot(server.lease.url, (snapshot) => snapshot.snapshot.freshness === "degraded" && snapshot.projectionError);
  assert.equal(degraded.summary.policyCount, 1, "previous valid records remain visible");
  assert.equal(degraded.summary.initiativeCount, 1, "previous valid initiative remains visible");
  assert.equal(degraded.initiatives[0].projectionState, "last_known_unverified");
  assert.equal(degraded.snapshot.verificationState, "last_known_unverified");
  assert.equal(degraded.snapshot.sourceFence.sourceEvidenceState, "unverified");
  assert.equal(degraded.snapshot.sourceFence.evidenceCurrent, 0);
  assert.equal(degraded.snapshot.sourceFence.lastKnownEvidenceCurrent, 3);
  assert.equal(degraded.summary.state, "last_known_unverified");
  assert.equal(degraded.summary.approvedCount, 0);
  assert.equal(degraded.summary.reviewCount, 0);
  assert.equal(degraded.summary.unverifiedCount, 3);
  assert.equal(degraded.summary.lastKnown.approvedCount, 1);
  assert.equal(degraded.summary.lastKnown.reviewCount, 1);
  assert.equal(degraded.summary.attentionCount, degraded.attention.length);
  assert.equal(degraded.policies[0].approvalState, "unverified");
  assert.equal(degraded.policies[0].authorityState, "unverified");
  assert.equal(degraded.policies[0].enforcement, "unverified");
  assert.equal(degraded.policies[0].evidenceState, "unverified");
  assert.equal(degraded.policies[0].projectionState, "last_known_unverified");
  assert.equal(degraded.policies[0].lastKnown.approvalState, "approved");
  assert.ok(degraded.policies[0].sourceRefs.every(({ state }) => state === "unverified"));
  assert.equal(degraded.initiatives[0].lifecycleState, "unverified");
  assert.equal(degraded.initiatives[0].lastKnown.lifecycleState, "draft");
  assert.equal(degraded.initiatives[0].projects[0].status, "unverified");
  assert.equal(degraded.initiatives[0].projects[0].lastKnownStatus, "active");
  assert.equal(degraded.initiatives[0].projects[0].linkState, "unverified");
  assert.equal(degraded.initiatives[0].projects[0].lastKnownLinkState, "confirmed");
  assert.equal(degraded.execution.status, "unverified");
  assert.ok(degraded.attention.some((item) => item.id === "ATTN-PROJECTION-DEGRADED"));
  assert.doesNotMatch(degraded.projectionError.message, new RegExp(fixture.root));
  assert.equal((await fetch(`${server.lease.url}/readyz`)).status, 503);

  await writeFile(path.join(fixture.root, "docs", "governance", "catalog.json"), `${JSON.stringify(fixture.catalog, null, 2)}\n`, "utf8");
  const recovered = await waitForSnapshot(server.lease.url, (snapshot) => snapshot.snapshot.seq > degraded.snapshot.seq && snapshot.snapshot.freshness === "fresh");
  assert.equal(recovered.projectionError, undefined);
  assert.equal(recovered.snapshot.verificationState, undefined);
  assert.equal(recovered.summary.approvedCount, 1);
  assert.equal(recovered.policies[0].approvalState, "approved");
  assert.equal((await fetch(`${server.lease.url}/readyz`)).status, 200);
});

test("view fixture: two repositories receive distinct OS-assigned ports and fingerprints", async (t) => {
  const firstFixture = await createFixture({ projectId: "first" });
  const secondFixture = await createFixture({ projectId: "second" });
  const first = await startFixtureServer(firstFixture);
  const second = await startFixtureServer(secondFixture);
  t.after(async () => {
    await Promise.all([stopChild(first.child), stopChild(second.child)]);
    await Promise.all([rm(firstFixture.root, { recursive: true, force: true }), rm(secondFixture.root, { recursive: true, force: true })]);
  });

  assert.notEqual(first.lease.port, second.lease.port);
  assert.notEqual(first.lease.repoFingerprint, second.lease.repoFingerprint);
  assert.notEqual(first.lease.instanceId, second.lease.instanceId);
});

test("server refuses a runtime state directory symlink outside the repository", async (t) => {
  const fixture = await createFixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), "document-harness-view-state-outside-"));
  await mkdir(path.join(fixture.root, ".document-harness", "runtime"), { recursive: true });
  await symlink(outside, path.join(fixture.root, ".document-harness", "runtime", "view"));
  const child = spawn(process.execPath, [SERVER_PATH, "--root", fixture.root, "--config", fixture.configPath, "--port", "auto", "--start-token", randomUUID()], { stdio: ["ignore", "ignore", "pipe"] });
  let errors = "";
  child.stderr.on("data", (chunk) => { errors += chunk.toString(); });
  t.after(async () => {
    await stopChild(child);
    await Promise.all([rm(fixture.root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]);
  });

  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not reject escaped stateDir in time")), 2000);
    child.once("exit", (code) => { clearTimeout(timer); resolve(code); });
  });
  assert.notEqual(exitCode, 0);
  assert.match(errors, /View stateDir/);
  assert.deepEqual(await readdir(outside), []);
});
