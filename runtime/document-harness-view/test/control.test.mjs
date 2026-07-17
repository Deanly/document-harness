import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { sha256 } from "../lib/projection.mjs";
import { createFixture, git } from "./helpers.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONTROL_PATH = path.resolve(TEST_DIR, "..", "control.mjs");

function runControl(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CONTROL_PATH, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

test("view fixture: foreign PID is never stopped when lease and health identity mismatch", async (t) => {
  const fixture = await createFixture({ projectId: "control-fixture" });
  const dummy = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      repoFingerprint: "foreign",
      instanceId: "foreign",
      startedAt: "foreign",
      pid: process.pid,
      port: dummy.address().port
    }));
  });
  await new Promise((resolve, reject) => {
    dummy.once("error", reject);
    dummy.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  t.after(async () => {
    await new Promise((resolve) => dummy.close(resolve));
    await rm(fixture.root, { recursive: true, force: true });
  });

  const stateDir = path.join(fixture.root, ".document-harness", "runtime", "view");
  await mkdir(stateDir, { recursive: true });
  await writeFile(path.join(stateDir, "lease.json"), JSON.stringify({
    repoId: "control-fixture",
    repoFingerprint: "fixture-lease",
    instanceId: "fixture-instance",
    pid: process.pid,
    port: dummy.address().port,
    url: `http://127.0.0.1:${dummy.address().port}`,
    startedAt: "2026-07-16T00:00:00Z"
  }), "utf8");

  const urlResult = await runControl(["url", "--root", fixture.root, "--config", fixture.configPath]);
  assert.notEqual(urlResult.code, 0);
  assert.match(urlResult.stderr, /identity가 일치하지 않아 URL을 반환하지 않았습니다/);

  const result = await runControl(["stop", "--root", fixture.root, "--config", fixture.configPath]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /identity가 일치하지 않아 프로세스를 종료하지 않았습니다/);
  assert.equal(dummy.listening, true);
  assert.doesNotThrow(() => process.kill(process.pid, 0));
});

test("a foreign PID cannot be killed even when its loopback health and lease spoof every public identity field", async (t) => {
  const fixture = await createFixture({ projectId: "spoof-resistant-fixture" });
  const resolvedRoot = await realpath(fixture.root);
  const repoFingerprint = sha256(`${resolvedRoot}\nspoof-resistant-fixture`);
  const startTokenSha256 = "a".repeat(64);
  const processIdentity = { commandSha256: "b".repeat(64), startMarker: "spoofed-start" };
  const startedAt = "2026-07-16T00:00:00.000Z";
  const instanceId = "spoofed-instance";
  const dummy = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      repoFingerprint,
      instanceId,
      startTokenSha256,
      processIdentity,
      startedAt,
      pid: process.pid,
      port: dummy.address().port
    }));
  });
  await new Promise((resolve, reject) => {
    dummy.once("error", reject);
    dummy.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  t.after(async () => {
    await new Promise((resolve) => dummy.close(resolve));
    await rm(fixture.root, { recursive: true, force: true });
  });
  const stateDir = path.join(fixture.root, ".document-harness", "runtime", "view");
  await mkdir(stateDir, { recursive: true });
  await writeFile(path.join(stateDir, "lease.json"), JSON.stringify({
    repoId: "spoof-resistant-fixture",
    repoFingerprint,
    instanceId,
    startTokenSha256,
    processIdentity,
    pid: process.pid,
    port: dummy.address().port,
    url: `http://127.0.0.1:${dummy.address().port}`,
    startedAt
  }), "utf8");

  const result = await runControl(["stop", "--root", fixture.root, "--config", fixture.configPath]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /managed server command\/start token이 일치하지 않아 프로세스를 종료하지 않았습니다/);
  assert.equal(dummy.listening, true);
  assert.doesNotThrow(() => process.kill(process.pid, 0));
});

test("refresh persists only explicitly allowlisted scalar probe fields", async (t) => {
  const probeServer = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      status: "UP",
      secret: "must-not-be-stored",
      details: { count: 2, token: "must-not-be-stored" }
    }));
  });
  await new Promise((resolve, reject) => {
    probeServer.once("error", reject);
    probeServer.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const fixture = await createFixture({
    probes: [{
      id: "sanitized",
      label: "Sanitized probe",
      url: `http://127.0.0.1:${probeServer.address().port}/health`,
      fields: ["status", "details.count"]
    }]
  });
  t.after(async () => {
    await new Promise((resolve) => probeServer.close(resolve));
    await rm(fixture.root, { recursive: true, force: true });
  });

  const result = await runControl(["refresh", "--root", fixture.root, "--config", fixture.configPath]);
  assert.equal(result.code, 0, result.stderr);
  const probesPath = path.join(fixture.root, ".document-harness", "runtime", "view", "runtime-probes.json");
  const raw = await readFile(probesPath, "utf8");
  const probes = JSON.parse(raw);
  assert.deepEqual(probes.probes[0].data, { status: "UP", "details.count": 2 });
  assert.doesNotMatch(raw, /must-not-be-stored/);
  assert.doesNotMatch(git(fixture.root, ["status", "--porcelain=v1", "--untracked-files=all"]), /\.document-harness/);
});

test("loopback probes never follow redirects and cap response bytes before persistence", async (t) => {
  let redirectedTargetHits = 0;
  const probeServer = http.createServer((request, response) => {
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "/redirected-target" });
      response.end();
      return;
    }
    if (request.url === "/redirected-target") {
      redirectedTargetHits += 1;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "SHOULD_NOT_BE_REACHED" }));
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write('{"status":"UP","padding":"');
    response.write("x".repeat(40 * 1024));
    response.write("x".repeat(40 * 1024));
    response.end('"}');
  });
  await new Promise((resolve, reject) => {
    probeServer.once("error", reject);
    probeServer.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const fixture = await createFixture({
    probes: [
      {
        id: "redirect",
        label: "Redirect probe",
        url: `http://127.0.0.1:${probeServer.address().port}/redirect`,
        fields: ["status"]
      },
      {
        id: "oversized",
        label: "Oversized probe",
        url: `http://127.0.0.1:${probeServer.address().port}/oversized`,
        fields: ["status"]
      }
    ]
  });
  t.after(async () => {
    await new Promise((resolve) => probeServer.close(resolve));
    await rm(fixture.root, { recursive: true, force: true });
  });

  const result = await runControl(["refresh", "--root", fixture.root, "--config", fixture.configPath]);
  assert.equal(result.code, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(redirectedTargetHits, 0);
  assert.equal(payload.probes[0].ok, false);
  assert.match(payload.probes[0].error, /redirects are not allowed/);
  assert.equal(payload.probes[1].ok, false);
  assert.match(payload.probes[1].error, /65536 byte limit/);
  const persisted = await readFile(path.join(fixture.root, ".document-harness", "runtime", "view", "runtime-probes.json"), "utf8");
  assert.ok(Buffer.byteLength(persisted) < 16 * 1024);
  assert.doesNotMatch(persisted, /x{128}/);
});

test("operator rejects fixed ports before creating runtime state", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const result = await runControl(["start", "--root", fixture.root, "--config", fixture.configPath, "--port", "54321"]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /OS-assigned port/);
  await assert.rejects(readFile(path.join(fixture.root, ".document-harness", "runtime", "view", "lease.json"), "utf8"), /ENOENT/);
});

test("operator fails closed when the runtime ignore marker has foreign bytes", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const stateDir = path.join(fixture.root, ".document-harness", "runtime", "view");
  await mkdir(stateDir, { recursive: true });
  await writeFile(path.join(stateDir, ".gitignore"), "project-owned marker\n", "utf8");

  const result = await runControl(["refresh", "--root", fixture.root, "--config", fixture.configPath]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /runtime \.gitignore marker가 distribution contract와 일치하지 않습니다/);
  assert.equal(await readFile(path.join(stateDir, ".gitignore"), "utf8"), "project-owned marker\n");
});

test("operator does not hide a foreign runtime-directory entry while creating the marker", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const stateDir = path.join(fixture.root, ".document-harness", "runtime", "view");
  await mkdir(stateDir, { recursive: true });
  await writeFile(path.join(stateDir, "custom-project-file.txt"), "must remain visible\n", "utf8");

  const result = await runControl(["refresh", "--root", fixture.root, "--config", fixture.configPath]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /foreign entry.*custom-project-file\.txt/);
  await assert.rejects(readFile(path.join(stateDir, ".gitignore"), "utf8"), /ENOENT/);
  assert.equal(await readFile(path.join(stateDir, "custom-project-file.txt"), "utf8"), "must remain visible\n");
});

test("start, status, url, refresh, and stop preserve one repository identity", async (t) => {
  const fixture = await createFixture({ projectId: "lifecycle-fixture" });
  t.after(async () => {
    await runControl(["stop", "--root", fixture.root, "--config", fixture.configPath]);
    await rm(fixture.root, { recursive: true, force: true });
  });

  const startedResult = await runControl(["start", "--root", fixture.root, "--config", fixture.configPath]);
  assert.equal(startedResult.code, 0, startedResult.stderr);
  const started = JSON.parse(startedResult.stdout);
  assert.equal(started.status, "started");
  assert.equal(started.repoId, "lifecycle-fixture");
  assert.equal(started.runtimeVersion, "1.1.0");
  assert.ok(started.port > 0);

  const statusResult = await runControl(["status", "--root", fixture.root, "--config", fixture.configPath]);
  assert.equal(statusResult.code, 0, statusResult.stderr);
  const status = JSON.parse(statusResult.stdout);
  assert.equal(status.status, "running");
  assert.equal(status.identityMatches, true);
  assert.equal(status.lease.instanceId, started.instanceId);

  const urlResult = await runControl(["url", "--root", fixture.root, "--config", fixture.configPath]);
  assert.equal(urlResult.code, 0, urlResult.stderr);
  assert.equal(urlResult.stdout.trim(), started.url);

  const refreshResult = await runControl(["refresh", "--root", fixture.root, "--config", fixture.configPath]);
  assert.equal(refreshResult.code, 0, refreshResult.stderr);
  assert.equal(JSON.parse(refreshResult.stdout).repository.status, "dirty");

  const stopResult = await runControl(["stop", "--root", fixture.root, "--config", fixture.configPath]);
  assert.equal(stopResult.code, 0, stopResult.stderr);
  assert.match(stopResult.stdout, /안전하게 중지했습니다/);
  const stopped = JSON.parse((await runControl(["status", "--root", fixture.root, "--config", fixture.configPath])).stdout);
  assert.equal(stopped.status, "stopped");
});
