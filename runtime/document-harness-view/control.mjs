#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, constants, openSync } from "node:fs";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildProjection, loadViewConfig, sha256 } from "./lib/projection.mjs";
import { managedProcessIdentity } from "./lib/process-identity.mjs";
import { ensureRuntimeStateDirectory } from "./lib/runtime-state.mjs";
import { REFERENCE_VIEW_VERSION } from "./version.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(SCRIPT_DIR, "server.mjs");
const TEST_DIR = path.join(SCRIPT_DIR, "test");
const MAX_PROBE_RESPONSE_BYTES = 64 * 1024;

function usage() {
  process.stdout.write(`Usage: human-view <command> [options]\n\nCommands:\n  doctor       Validate config, sources, runtime, and projection\n  refresh      Refresh allowlisted read-only repository/runtime probes\n  start        Start this repository's independent loopback View server\n  foreground   Run the View server in the foreground\n  status       Show the identity and health of this repository's View\n  url          Print the current View URL\n  snapshot     Build and print a fresh projection without starting a server\n  test         Run focused View runtime tests (no project config required)\n  stop         Stop only a View process whose lease and health identity match\n\nOptions:\n  --root PATH      Repository root (default: current directory)\n  --config PATH    Config path relative to root (default: runtime/document-harness-view/config.json)\n  --port auto      Reserved compatibility option; only OS-assigned ports are supported\n`);
}

function parseArgs(argv) {
  const command = argv[0] ?? "help";
  const options = {
    root: process.cwd(),
    config: process.env.DOCUMENT_HARNESS_VIEW_CONFIG ?? "runtime/document-harness-view/config.json",
    port: "auto"
  };
  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") options.root = argv[++index];
    else if (value === "--config") options.config = argv[++index];
    else if (value === "--port") options.port = argv[++index];
    else throw new Error(`알 수 없는 인자입니다: ${value}`);
  }
  if (options.port !== "auto") throw new Error("Reference View는 OS-assigned port만 지원합니다. --port auto를 사용하세요.");
  return { command, options };
}

async function atomicWrite(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(value, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporaryPath, filePath);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function readJsonIfPresent(filePath) {
  try {
    const fileStat = await lstat(filePath);
    if (fileStat.isSymbolicLink()) {
      throw new Error(`runtime identity file은 symlink일 수 없습니다: ${filePath}`);
    }
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function pathIsInside(repoRoot, candidate) {
  const relative = path.relative(repoRoot, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function ensureStateDir(ctx) {
  await ensureRuntimeStateDirectory({ repoRoot: ctx.config.resolvedRoot, stateDir: ctx.stateDir });
}

async function context(options) {
  const config = await loadViewConfig(options.root, options.config);
  const stateDir = path.resolve(config.resolvedRoot, config.stateDir ?? ".document-harness/runtime/view");
  const relative = path.relative(config.resolvedRoot, stateDir);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("View stateDir는 저장소 안에 있어야 합니다.");
  }
  try {
    const stateRealPath = await realpath(stateDir);
    if (!pathIsInside(config.resolvedRoot, stateRealPath)) {
      throw new Error("View stateDir symlink가 저장소 경계를 벗어납니다.");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return {
    config,
    stateDir,
    leasePath: path.join(stateDir, "lease.json"),
    probesPath: path.join(stateDir, "runtime-probes.json"),
    logPath: path.join(stateDir, "server.log"),
    repoFingerprint: sha256(`${config.resolvedRoot}\n${config.project.id}`)
  };
}

async function fetchJson(url, timeoutMs = 3000) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new Error(`probe redirects are not allowed (${response.status})`);
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROBE_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error(`probe response exceeds ${MAX_PROBE_RESPONSE_BYTES} byte limit`);
  }
  const chunks = [];
  let bytesRead = 0;
  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_PROBE_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error(`probe response exceeds ${MAX_PROBE_RESPONSE_BYTES} byte limit`);
      }
      chunks.push(Buffer.from(value));
    }
  }
  const text = Buffer.concat(chunks, bytesRead).toString("utf8");
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${response.status} ${response.statusText}: probe response is not JSON`);
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return body;
}

function fieldValue(payload, field) {
  let current = payload;
  for (const segment of field.split(".")) {
    if (!current || typeof current !== "object" || !Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

function sanitizeProbeData(payload, fields = []) {
  const sanitized = {};
  const requested = fields.length > 0 ? fields : ["status"];
  for (const field of requested) {
    const value = fieldValue(payload, field);
    if (["string", "number", "boolean"].includes(typeof value) || value === null) sanitized[field] = value;
  }
  if (Object.keys(sanitized).length === 0) sanitized.reachable = true;
  return sanitized;
}

function gitResult(repoRoot, args) {
  return spawnSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function refreshProbes(ctx) {
  await ensureStateDir(ctx);
  const statusResult = gitResult(ctx.config.resolvedRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const headResult = gitResult(ctx.config.resolvedRoot, ["rev-parse", "HEAD"]);
  const runtimeRelative = path.relative(ctx.config.resolvedRoot, ctx.stateDir).replaceAll("\\", "/").replace(/\/$/, "");
  const changedLines = statusResult.status === 0
    ? statusResult.stdout.split("\n").filter(Boolean).filter((line) => {
      const changedPath = line.slice(3).replace(/^"|"$/g, "").replaceAll("\\", "/");
      return changedPath !== runtimeRelative && !changedPath.startsWith(`${runtimeRelative}/`);
    })
    : [];
  const repository = {
    status: statusResult.status === 0 ? (changedLines.length > 0 ? "dirty" : "clean") : "unknown",
    head: headResult.status === 0 ? headResult.stdout.trim() : null,
    dirtyCount: statusResult.status === 0 ? changedLines.length : null,
    changedPaths: changedLines.map((line) => ({ state: line.slice(0, 2), path: line.slice(3) })),
    error: statusResult.status === 0 ? null : statusResult.stderr.trim()
  };

  const probes = [];
  for (const definition of ctx.config.probes ?? []) {
    const observedAt = new Date().toISOString();
    try {
      const probeUrl = new URL(definition.url);
      const localHost = probeUrl.hostname === "127.0.0.1" || probeUrl.hostname === "localhost" || probeUrl.hostname === "[::1]";
      if (probeUrl.protocol !== "http:" || !localHost || probeUrl.username || probeUrl.password || !probeUrl.port) {
        throw new Error(`probe URL은 credential 없는 explicit loopback HTTP endpoint여야 합니다: ${definition.url}`);
      }
      const data = sanitizeProbeData(
        await fetchJson(definition.url, Number(definition.timeoutMs ?? 3000)),
        definition.fields ?? []
      );
      probes.push({
        id: definition.id,
        label: definition.label,
        kind: definition.kind ?? "health",
        ok: true,
        observedAt,
        data
      });
    } catch (error) {
      probes.push({
        id: definition.id,
        label: definition.label,
        kind: definition.kind ?? "health",
        ok: false,
        observedAt,
        error: error.message
      });
    }
  }

  const payload = {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    repository,
    probes
  };
  await atomicWrite(ctx.probesPath, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

async function readHealth(lease) {
  return fetchJson(`${lease.url}/healthz`, 1500);
}

function healthMatches(ctx, lease, health) {
  return health?.repoFingerprint === ctx.repoFingerprint
    && health?.instanceId === lease.instanceId
    && health?.startedAt === lease.startedAt
    && health?.pid === lease.pid
    && health?.port === lease.port
    && health?.startTokenSha256 === lease.startTokenSha256
    && health?.processIdentity?.commandSha256 === lease.processIdentity?.commandSha256
    && health?.processIdentity?.startMarker === lease.processIdentity?.startMarker;
}

function inspectManagedLeaseProcess(ctx, lease) {
  const identity = managedProcessIdentity({
    pid: lease.pid,
    nodePath: process.execPath,
    serverPath: SERVER_PATH,
    repoRoot: ctx.config.resolvedRoot,
    configPath: path.relative(ctx.config.resolvedRoot, ctx.config.resolvedConfig) || path.basename(ctx.config.resolvedConfig),
    startTokenSha256: lease.startTokenSha256
  });
  if (!identity.matches) return identity;
  if (
    identity.process.commandSha256 !== lease.processIdentity?.commandSha256
    || identity.process.startMarker !== lease.processIdentity?.startMarker
  ) {
    return { ...identity, matches: false, reason: "lease_process_identity_mismatch" };
  }
  return identity;
}

async function doctor(ctx, options) {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 18) throw new Error(`Node 18+가 필요합니다. 현재: ${process.version}`);
  await Promise.all([
    stat(SERVER_PATH),
    stat(path.join(SCRIPT_DIR, "public", "index.html")),
    stat(path.join(SCRIPT_DIR, "public", "app.mjs")),
    stat(path.join(SCRIPT_DIR, "public", "styles.css"))
  ]);
  const projection = await buildProjection({
    repoRoot: ctx.config.resolvedRoot,
    configPath: options.config,
    snapshotSeq: 1
  });
  const result = {
    status: "ready",
    runtimeVersion: REFERENCE_VIEW_VERSION,
    node: process.version,
    repoId: ctx.config.project.id,
    repoFingerprint: ctx.repoFingerprint,
    bindPolicy: "127.0.0.1 + OS-assigned port",
    policyCount: projection.snapshot.summary.policyCount,
    guidelineCount: projection.snapshot.summary.guidelineCount,
    freshness: projection.snapshot.snapshot.freshness,
    migrationFence: projection.snapshot.migrationFence.state,
    sourceEvidence: projection.snapshot.snapshot.sourceFence.sourceEvidenceState,
    readOnly: true
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function start(ctx, options) {
  await ensureStateDir(ctx);
  const existing = await readJsonIfPresent(ctx.leasePath);
  if (existing) {
    if (isPidRunning(existing.pid)) {
      try {
        const health = await readHealth(existing);
        const processIdentity = inspectManagedLeaseProcess(ctx, existing);
        if (healthMatches(ctx, existing, health) && processIdentity.matches) {
          process.stdout.write(`${JSON.stringify({ status: "already_running", ...existing }, null, 2)}\n`);
          return;
        }
      } catch {
        // Identity mismatch below is intentionally fatal while the PID is live.
      }
      throw new Error("기존 lease의 PID가 살아 있지만 View identity가 일치하지 않습니다. 다른 프로세스를 종료하지 않았습니다.");
    }
    await rm(ctx.leasePath, { force: true });
  }

  await refreshProbes(ctx);
  const configArgument = path.relative(ctx.config.resolvedRoot, ctx.config.resolvedConfig) || path.basename(ctx.config.resolvedConfig);
  const startToken = randomUUID();
  const logFlags = constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | constants.O_NOFOLLOW;
  const stdoutFd = openSync(ctx.logPath, logFlags, 0o600);
  const stderrFd = openSync(ctx.logPath, logFlags, 0o600);
  const child = spawn(process.execPath, [
    SERVER_PATH,
    "--root", ctx.config.resolvedRoot,
    "--config", configArgument,
    "--port", options.port,
    "--start-token", startToken
  ], {
    cwd: ctx.config.resolvedRoot,
    detached: true,
    stdio: ["ignore", stdoutFd, stderrFd]
  });
  child.unref();
  closeSync(stdoutFd);
  closeSync(stderrFd);

  let lease = null;
  let lastError = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await sleep(100);
    lease = await readJsonIfPresent(ctx.leasePath);
    if (!lease || lease.pid !== child.pid) continue;
    try {
      const health = await readHealth(lease);
      const processIdentity = inspectManagedLeaseProcess(ctx, lease);
      if (healthMatches(ctx, lease, health) && processIdentity.matches) {
        process.stdout.write(`${JSON.stringify({ status: "started", ...lease }, null, 2)}\n`);
        return;
      }
    } catch (error) {
      lastError = error;
    }
  }
  if (child.exitCode === null) child.kill("SIGTERM");
  throw new Error(`View가 준비되지 않았습니다. log=${ctx.logPath}${lastError ? ` (${lastError.message})` : ""}`);
}

async function status(ctx) {
  const lease = await readJsonIfPresent(ctx.leasePath);
  if (!lease) {
    process.stdout.write(`${JSON.stringify({ status: "stopped", repoId: ctx.config.project.id }, null, 2)}\n`);
    return;
  }
  const pidRunning = isPidRunning(lease.pid);
  let health = null;
  let identityMatches = false;
  let processIdentity = { matches: false, reason: "pid_not_running" };
  if (pidRunning) {
    try {
      health = await readHealth(lease);
      processIdentity = inspectManagedLeaseProcess(ctx, lease);
      identityMatches = healthMatches(ctx, lease, health) && processIdentity.matches;
    } catch (error) {
      health = { error: error.message };
    }
  }
  process.stdout.write(`${JSON.stringify({
    status: pidRunning && identityMatches ? "running" : "stale_or_foreign",
    pidRunning,
    identityMatches,
    processIdentity: { matches: processIdentity.matches, reason: processIdentity.reason },
    lease,
    health
  }, null, 2)}\n`);
}

async function stop(ctx) {
  const lease = await readJsonIfPresent(ctx.leasePath);
  if (!lease) {
    process.stdout.write("View는 이미 중지되어 있습니다.\n");
    return;
  }
  if (!isPidRunning(lease.pid)) {
    await rm(ctx.leasePath, { force: true });
    process.stdout.write("종료된 View의 stale lease를 정리했습니다.\n");
    return;
  }
  const health = await readHealth(lease);
  if (!healthMatches(ctx, lease, health)) {
    throw new Error("lease와 health identity가 일치하지 않아 프로세스를 종료하지 않았습니다.");
  }
  const processIdentity = inspectManagedLeaseProcess(ctx, lease);
  if (!processIdentity.matches) {
    throw new Error(`OS process identity와 managed server command/start token이 일치하지 않아 프로세스를 종료하지 않았습니다: ${processIdentity.reason}`);
  }
  process.kill(lease.pid, "SIGTERM");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await sleep(100);
    if (!isPidRunning(lease.pid)) {
      await rm(ctx.leasePath, { force: true });
      process.stdout.write("View를 안전하게 중지했습니다.\n");
      return;
    }
  }
  throw new Error("SIGTERM 후에도 View가 종료되지 않았습니다. 강제 종료하지 않았습니다.");
}

async function runTests() {
  const tests = (await readdir(TEST_DIR))
    .filter((name) => name.endsWith(".test.mjs"))
    .sort()
    .map((name) => path.join(TEST_DIR, name));
  const result = spawnSync(process.execPath, ["--test", ...tests], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function foreground(ctx, options) {
  await refreshProbes(ctx);
  const configArgument = path.relative(ctx.config.resolvedRoot, ctx.config.resolvedConfig) || path.basename(ctx.config.resolvedConfig);
  const child = spawn(process.execPath, [
    SERVER_PATH,
    "--root", ctx.config.resolvedRoot,
    "--config", configArgument,
    "--port", options.port,
    "--start-token", randomUUID()
  ], { cwd: ctx.config.resolvedRoot, stdio: "inherit" });
  const exitCode = await new Promise((resolve) => child.once("exit", (code) => resolve(code ?? 1)));
  process.exit(exitCode);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }
  if (command === "test") {
    await runTests();
    return;
  }
  const ctx = await context(options);
  if (command === "doctor") await doctor(ctx, options);
  else if (command === "refresh") process.stdout.write(`${JSON.stringify(await refreshProbes(ctx), null, 2)}\n`);
  else if (command === "start") await start(ctx, options);
  else if (command === "foreground") await foreground(ctx, options);
  else if (command === "status") await status(ctx);
  else if (command === "url") {
    const lease = await readJsonIfPresent(ctx.leasePath);
    if (!lease) throw new Error("실행 중인 View lease가 없습니다.");
    if (!isPidRunning(lease.pid)) throw new Error("View lease의 PID가 실행 중이 아닙니다.");
    const health = await readHealth(lease);
    const processIdentity = inspectManagedLeaseProcess(ctx, lease);
    if (!healthMatches(ctx, lease, health) || !processIdentity.matches) {
      throw new Error("lease와 health identity가 일치하지 않아 URL을 반환하지 않았습니다.");
    }
    process.stdout.write(`${lease.url}\n`);
  } else if (command === "snapshot") {
    const projection = await buildProjection({ repoRoot: ctx.config.resolvedRoot, configPath: options.config, snapshotSeq: 1 });
    process.stdout.write(`${JSON.stringify(projection.snapshot, null, 2)}\n`);
  } else if (command === "stop") await stop(ctx);
  else throw new Error(`지원하지 않는 command입니다: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exit(1);
});
