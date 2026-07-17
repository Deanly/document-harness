#!/usr/bin/env node

import http from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildProjection, sha256 } from "./lib/projection.mjs";
import { managedProcessIdentity } from "./lib/process-identity.mjs";
import { ensureRuntimeStateDirectory } from "./lib/runtime-state.mjs";
import { REFERENCE_VIEW_VERSION } from "./version.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(SCRIPT_DIR, "public");
const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
  ["/view-model.mjs", ["view-model.mjs", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]]
]);
const LAST_KNOWN_UNVERIFIED = "last_known_unverified";

function markGovernanceItemUnverified(item) {
  const lastKnown = item.lastKnown ?? {
    authorityState: item.authorityState ?? null,
    approvalState: item.approvalState ?? null,
    enforcement: item.enforcement ?? null,
    evidenceState: item.evidenceState ?? null
  };
  return {
    ...item,
    projectionState: LAST_KNOWN_UNVERIFIED,
    lastKnown,
    authorityState: "unverified",
    approvalState: "unverified",
    enforcement: "unverified",
    evidenceState: "unverified",
    sourceRefs: (item.sourceRefs ?? []).map((sourceRef) => ({
      ...sourceRef,
      lastKnownState: sourceRef.lastKnownState ?? sourceRef.state ?? null,
      state: "unverified"
    }))
  };
}

function markSnapshotUnverified(degradedSnapshot) {
  const sourceFence = degradedSnapshot.snapshot.sourceFence ?? {};
  degradedSnapshot.snapshot.verificationState = LAST_KNOWN_UNVERIFIED;
  degradedSnapshot.snapshot.sourceFence = {
    ...sourceFence,
    lastKnownSourceEvidenceState: sourceFence.lastKnownSourceEvidenceState ?? sourceFence.sourceEvidenceState ?? null,
    lastKnownEvidenceCurrent: sourceFence.lastKnownEvidenceCurrent ?? sourceFence.evidenceCurrent ?? 0,
    lastKnownEvidenceChanged: sourceFence.lastKnownEvidenceChanged ?? sourceFence.evidenceChanged ?? 0,
    lastKnownEvidenceMissing: sourceFence.lastKnownEvidenceMissing ?? sourceFence.evidenceMissing ?? 0,
    sourceEvidenceState: "unverified",
    evidenceCurrent: 0,
    evidenceChanged: 0,
    evidenceMissing: 0,
    evidenceUnverified: [...(degradedSnapshot.policies ?? []), ...(degradedSnapshot.guidelines ?? [])]
      .flatMap((item) => item.sourceRefs ?? []).length
  };

  degradedSnapshot.policies = (degradedSnapshot.policies ?? []).map(markGovernanceItemUnverified);
  degradedSnapshot.guidelines = (degradedSnapshot.guidelines ?? []).map(markGovernanceItemUnverified);
  const governanceItemCount = degradedSnapshot.policies.length + degradedSnapshot.guidelines.length;
  const previousSummary = degradedSnapshot.summary ?? {};
  const lastKnownSummary = previousSummary.lastKnown ?? {
    approvedCount: previousSummary.approvedCount ?? 0,
    reviewCount: previousSummary.reviewCount ?? 0,
    enforcement: previousSummary.enforcement ?? {}
  };
  degradedSnapshot.summary = {
    ...previousSummary,
    state: LAST_KNOWN_UNVERIFIED,
    approvedCount: 0,
    reviewCount: 0,
    unverifiedCount: governanceItemCount,
    enforcement: governanceItemCount > 0 ? { unverified: governanceItemCount } : {},
    lastKnown: lastKnownSummary
  };

  if (degradedSnapshot.execution) {
    degradedSnapshot.execution = {
      ...degradedSnapshot.execution,
      projectionState: LAST_KNOWN_UNVERIFIED,
      lastKnownStatus: degradedSnapshot.execution.lastKnownStatus ?? degradedSnapshot.execution.status ?? null,
      status: "unverified"
    };
  }
}

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    config: process.env.DOCUMENT_HARNESS_VIEW_CONFIG ?? "runtime/document-harness-view/config.json",
    port: "auto",
    startToken: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") options.root = argv[++index];
    else if (value === "--config") options.config = argv[++index];
    else if (value === "--port") options.port = argv[++index];
    else if (value === "--start-token") options.startToken = argv[++index];
    else throw new Error(`알 수 없는 인자입니다: ${value}`);
  }
  if (options.port !== "auto") throw new Error("Reference View는 OS-assigned port만 지원합니다.");
  if (!/^[a-f0-9-]{32,64}$/.test(options.startToken ?? "")) {
    throw new Error("Reference View server에는 control이 발급한 start token이 필요합니다.");
  }
  return options;
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

function securityHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
  };
}

function parseHostHeader(hostHeader) {
  if (!hostHeader) return null;
  try {
    const parsed = new URL(`http://${hostHeader}`);
    return { hostname: parsed.hostname, port: parsed.port };
  } catch {
    return null;
  }
}

function requestIsLocal(req, port) {
  const parsedHost = parseHostHeader(req.headers.host);
  if (!parsedHost) return false;
  const allowedHost = parsedHost.hostname === "127.0.0.1" || parsedHost.hostname === "localhost" || parsedHost.hostname === "[::1]";
  if (!allowedHost || parsedHost.port !== String(port)) return false;

  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsedOrigin = new URL(origin);
    const originHost = parsedOrigin.hostname === "127.0.0.1" || parsedOrigin.hostname === "localhost" || parsedOrigin.hostname === "[::1]";
    return parsedOrigin.protocol === "http:" && originHost && parsedOrigin.port === String(port);
  } catch {
    return false;
  }
}

function sendJson(req, res, status, payload, headers = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    ...securityHeaders("application/json; charset=utf-8"),
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    ...headers
  });
  if (req.method !== "HEAD") res.end(body);
  else res.end();
}

function sendText(req, res, status, message) {
  const body = `${message}\n`;
  res.writeHead(status, {
    ...securityHeaders("text/plain; charset=utf-8"),
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  if (req.method !== "HEAD") res.end(body);
  else res.end();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let sequence = 1;
  let projection = await buildProjection({
    repoRoot: options.root,
    configPath: options.config,
    snapshotSeq: sequence
  });
  const repoRoot = projection.config.resolvedRoot;
  const stateDir = path.resolve(repoRoot, projection.config.stateDir ?? ".document-harness/runtime/view");
  const stateRelative = path.relative(repoRoot, stateDir);
  if (stateRelative.startsWith("..") || path.isAbsolute(stateRelative)) {
    throw new Error("View stateDir는 저장소 안에 있어야 합니다.");
  }
  await ensureRuntimeStateDirectory({ repoRoot, stateDir });

  const snapshotPath = path.join(stateDir, "snapshot.json");
  const leasePath = path.join(stateDir, "lease.json");
  const instanceId = randomUUID();
  const startedAt = new Date().toISOString();
  const repoFingerprint = sha256(`${repoRoot}\n${projection.config.project.id}`);
  const startTokenSha256 = sha256(options.startToken);
  let lastProjectionError = null;
  let lastReconcileAt = new Date().toISOString();
  let boundPort = null;
  let closing = false;
  let reconciling = false;
  let lease = null;

  await atomicWrite(snapshotPath, `${JSON.stringify(projection.snapshot, null, 2)}\n`);

  const server = http.createServer(async (req, res) => {
    if (!requestIsLocal(req, boundPort)) {
      sendText(req, res, 403, "Forbidden");
      return;
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...securityHeaders("text/plain; charset=utf-8"),
        Allow: "GET, HEAD, OPTIONS",
        "Cache-Control": "no-store"
      });
      res.end();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, {
        ...securityHeaders("text/plain; charset=utf-8"),
        Allow: "GET, HEAD, OPTIONS",
        "Cache-Control": "no-store"
      });
      res.end("Method Not Allowed\n");
      return;
    }

    const url = new URL(req.url ?? "/", `http://127.0.0.1:${boundPort}`);
    if (url.pathname === "/healthz" || url.pathname === "/readyz") {
      const ready = projection?.snapshot && !lastProjectionError;
      const payload = {
        status: ready ? "UP" : "DEGRADED",
        runtimeVersion: REFERENCE_VIEW_VERSION,
        ready,
        repoId: projection.config.project.id,
        repoFingerprint,
        instanceId,
        startTokenSha256,
        processIdentity: lease?.processIdentity ?? null,
        startedAt,
        pid: process.pid,
        bindHost: "127.0.0.1",
        port: boundPort,
        snapshotId: projection.snapshot.snapshot.id,
        snapshotSeq: projection.snapshot.snapshot.seq,
        freshness: projection.snapshot.snapshot.freshness,
        lastReconcileAt,
        lastProjectionError
      };
      sendJson(req, res, url.pathname === "/readyz" && !ready ? 503 : 200, payload);
      return;
    }

    if (url.pathname === "/api/v1/capabilities") {
      sendJson(req, res, 200, {
        repoId: projection.config.project.id,
        runtimeVersion: REFERENCE_VIEW_VERSION,
        transport: "etag-polling",
        bindHost: "127.0.0.1",
        readOnly: true,
        methods: ["GET", "HEAD", "OPTIONS"],
        mutation: false,
        execution: false,
        approval: false
      });
      return;
    }

    if (url.pathname === "/api/v1/snapshot") {
      const etag = `\"${projection.semanticHash}\"`;
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304, {
          ...securityHeaders("application/json; charset=utf-8"),
          ETag: etag,
          "Cache-Control": "no-cache"
        });
        res.end();
        return;
      }
      sendJson(req, res, 200, projection.snapshot, {
        ETag: etag,
        "Cache-Control": "no-cache"
      });
      return;
    }

    if (url.pathname === "/favicon.ico") {
      res.writeHead(204, {
        ...securityHeaders("image/x-icon"),
        "Cache-Control": "public, max-age=86400"
      });
      res.end();
      return;
    }

    const staticFile = STATIC_FILES.get(url.pathname);
    if (!staticFile) {
      sendText(req, res, 404, "Not Found");
      return;
    }
    const [fileName, contentType] = staticFile;
    const body = await readFile(path.join(PUBLIC_DIR, fileName));
    res.writeHead(200, {
      ...securityHeaders(contentType),
      "Cache-Control": fileName === "index.html" ? "no-cache" : "public, max-age=300",
      "Content-Length": body.length
    });
    if (req.method !== "HEAD") res.end(body);
    else res.end();
  });

  server.on("clientError", (_error, socket) => {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  });

  const requestedPort = options.port === "auto" ? 0 : Number(options.port);
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    throw new Error(`올바르지 않은 port입니다: ${options.port}`);
  }

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({ host: "127.0.0.1", port: requestedPort, exclusive: true });
  });
  boundPort = server.address().port;

  const managedIdentity = managedProcessIdentity({
    pid: process.pid,
    nodePath: process.execPath,
    serverPath: fileURLToPath(import.meta.url),
    repoRoot,
    configPath: options.config,
    startTokenSha256
  });
  if (!managedIdentity.matches) {
    await new Promise((resolve) => server.close(resolve));
    throw new Error(`View managed process identity를 확인할 수 없습니다: ${managedIdentity.reason}`);
  }

  lease = {
    schemaVersion: 1,
    runtimeVersion: REFERENCE_VIEW_VERSION,
    repoId: projection.config.project.id,
    repoFingerprint,
    instanceId,
    startTokenSha256,
    processIdentity: {
      commandSha256: managedIdentity.process.commandSha256,
      startMarker: managedIdentity.process.startMarker
    },
    pid: process.pid,
    bindHost: "127.0.0.1",
    port: boundPort,
    url: `http://127.0.0.1:${boundPort}`,
    startedAt,
    snapshotId: projection.snapshot.snapshot.id,
    capabilities: { read: true, write: false, execution: false, approval: false }
  };
  await atomicWrite(leasePath, `${JSON.stringify(lease, null, 2)}\n`);
  process.stdout.write(`${lease.url}\n`);

  const reconcile = async () => {
    if (closing || reconciling) return;
    reconciling = true;
    try {
      const candidate = await buildProjection({
        repoRoot,
        configPath: options.config,
        snapshotSeq: sequence + 1
      });
      lastReconcileAt = new Date().toISOString();
      lastProjectionError = null;
      if (candidate.semanticHash !== projection.semanticHash) {
        sequence += 1;
        projection = candidate;
        await atomicWrite(snapshotPath, `${JSON.stringify(projection.snapshot, null, 2)}\n`);
        lease.snapshotId = projection.snapshot.snapshot.id;
        await atomicWrite(leasePath, `${JSON.stringify(lease, null, 2)}\n`);
      }
    } catch (error) {
      lastReconcileAt = new Date().toISOString();
      const safeMessage = String(error.message ?? error).replaceAll(repoRoot, "<repository>");
      lastProjectionError = safeMessage;
      if (projection.snapshot.projectionError?.message !== safeMessage) {
        const baseSemanticHash = projection.snapshot.projectionError?.baseSemanticHash ?? projection.semanticHash;
        const degradedSemanticHash = sha256(`${baseSemanticHash}\nprojection-error\n${safeMessage}`);
        sequence += 1;
        const degradedSnapshot = structuredClone(projection.snapshot);
        degradedSnapshot.snapshot.id = `view-${String(sequence).padStart(8, "0")}-${degradedSemanticHash.slice(0, 10)}`;
        degradedSnapshot.snapshot.seq = sequence;
        degradedSnapshot.snapshot.generatedAt = new Date().toISOString();
        degradedSnapshot.snapshot.semanticHash = degradedSemanticHash;
        degradedSnapshot.snapshot.freshness = "degraded";
        degradedSnapshot.projectionError = {
          state: "degraded",
          message: safeMessage,
          baseSemanticHash,
          presentationState: LAST_KNOWN_UNVERIFIED
        };
        degradedSnapshot.attention = [
          {
            id: "ATTN-PROJECTION-DEGRADED",
            severity: "warning",
            title: "View projection could not read the latest source",
            humanSummary: safeMessage,
            relatedRefs: []
          },
          ...(degradedSnapshot.attention ?? []).filter((item) => item.id !== "ATTN-PROJECTION-DEGRADED")
        ];
        markSnapshotUnverified(degradedSnapshot);
        degradedSnapshot.summary.attentionCount = degradedSnapshot.attention.length;
        projection = { ...projection, snapshot: degradedSnapshot, semanticHash: degradedSemanticHash };
        await atomicWrite(snapshotPath, `${JSON.stringify(projection.snapshot, null, 2)}\n`);
        lease.snapshotId = projection.snapshot.snapshot.id;
        await atomicWrite(leasePath, `${JSON.stringify(lease, null, 2)}\n`);
      }
      process.stderr.write(`[projection] ${error.stack ?? error.message}\n`);
    } finally {
      reconciling = false;
    }
  };
  const timer = setInterval(reconcile, projection.config.reconcileIntervalMs);
  timer.unref();

  const shutdown = async (signal) => {
    if (closing) return;
    closing = true;
    clearInterval(timer);
    await new Promise((resolve) => server.close(resolve));
    try {
      const currentLease = JSON.parse(await readFile(leasePath, "utf8"));
      if (currentLease.pid === process.pid && currentLease.instanceId === instanceId) {
        await rm(leasePath, { force: true });
      }
    } catch {
      // A missing or replaced lease belongs to cleanup/recovery logic, not this process.
    }
    process.stderr.write(`[human-view] stopped by ${signal}\n`);
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exit(1);
});
