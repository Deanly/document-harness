import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { REFERENCE_VIEW_VERSION } from "../version.mjs";

export const VIEW_RUNTIME_CONTRACT = Object.freeze({
  stateDir: ".document-harness/runtime/view",
  runtimeProbes: ".document-harness/runtime/view/runtime-probes.json",
  executionCheckpoint: "docs/_indexes/execution-checkpoint.json",
  refreshIntervalMs: 2000,
  reconcileIntervalMs: 5000
});

const ALLOWED_AUTHORITY_STATES = new Set([
  "proposed",
  "accepted_for_promotion",
  "effective",
  "superseded"
]);

const ALLOWED_APPROVAL_STATES = new Set([
  "unreviewed",
  "review_requested",
  "approved",
  "rejected",
  "stale",
  "superseded"
]);

const ALLOWED_ENFORCEMENT = new Set([
  "enforced",
  "partially_enforced",
  "advisory",
  "not_implemented",
  "unknown"
]);

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function readJson(filePath, label) {
  let raw;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(`${label}을 읽을 수 없습니다: ${filePath} (${error.code ?? error.message})`);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} JSON이 올바르지 않습니다: ${filePath} (${error.message})`);
  }
}

function inputFence(captured) {
  return sha256(stableStringify({
    relativePath: captured.relativePath,
    state: captured.state,
    reason: captured.reason ?? null,
    realPath: captured.realPath ?? null,
    digest: captured.digest ?? null
  }));
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label}은 비어 있지 않은 문자열이어야 합니다.`);
  }
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label}은 배열이어야 합니다.`);
  }
  return value;
}

function pathIsInside(repoRoot, candidate) {
  const relative = path.relative(repoRoot, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolveExistingInsideRoot(repoRoot, relativePath, label) {
  const resolved = await resolveInsideRoot(repoRoot, relativePath);
  const resolvedRealPath = await realpath(resolved);
  if (!pathIsInside(repoRoot, resolvedRealPath)) {
    throw new Error(`${label} symlink가 저장소 경계를 벗어납니다: ${relativePath}`);
  }
  return resolvedRealPath;
}

async function captureRepositoryFile(repoRoot, relativePath, label) {
  let resolved;
  try {
    resolved = await resolveInsideRoot(repoRoot, relativePath);
  } catch (error) {
    const captured = { relativePath, state: "invalid", reason: "outside_repository" };
    return { ...captured, fence: inputFence(captured) };
  }
  let resolvedRealPath;
  try {
    resolvedRealPath = await realpath(resolved);
  } catch (error) {
    if (error.code === "ENOENT") {
      const captured = { relativePath, state: "missing", reason: "missing" };
      return { ...captured, fence: inputFence(captured) };
    }
    throw error;
  }
  if (!pathIsInside(repoRoot, resolvedRealPath)) {
    const captured = { relativePath, state: "invalid", reason: "outside_repository", realPath: resolvedRealPath };
    return { ...captured, fence: inputFence(captured) };
  }
  const fileStat = await stat(resolvedRealPath);
  if (!fileStat.isFile()) {
    const captured = { relativePath, state: "invalid", reason: "not_file", realPath: resolvedRealPath };
    return { ...captured, fence: inputFence(captured) };
  }
  const bytes = await readFile(resolvedRealPath);
  const captured = {
    relativePath,
    state: "file",
    reason: null,
    realPath: resolvedRealPath,
    digest: sha256(bytes)
  };
  return { ...captured, bytes, fence: inputFence(captured) };
}

function parseCapturedJson(captured, label) {
  if (captured.state !== "file") {
    const suffix = captured.reason === "outside_repository"
      ? "symlink가 저장소 경계를 벗어납니다"
      : "파일이 아니거나 존재하지 않습니다";
    throw new Error(`${label} ${suffix}: ${captured.relativePath}`);
  }
  try {
    return JSON.parse(captured.bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} JSON이 올바르지 않습니다: ${captured.relativePath} (${error.message})`);
  }
}

function validateItem(item, kind, index) {
  const prefix = `${kind}[${index}]`;
  requireString(item.id, `${prefix}.id`);
  requireString(item.title, `${prefix}.title`);
  requireString(item.humanSummary, `${prefix}.humanSummary`);
  requireString(item.authorityClass, `${prefix}.authorityClass`);
  requireString(item.authorityState, `${prefix}.authorityState`);
  requireString(item.approvalState, `${prefix}.approvalState`);
  requireString(item.enforcement, `${prefix}.enforcement`);
  requireString(item.confidence, `${prefix}.confidence`);
  requireArray(item.sourceRefs, `${prefix}.sourceRefs`);
  if (item.sourceRefs.length === 0) {
    throw new Error(`${prefix}.sourceRefs는 최소 한 건의 근거를 포함해야 합니다.`);
  }
  for (const [sourceIndex, sourceRef] of item.sourceRefs.entries()) {
    requireString(sourceRef.path, `${prefix}.sourceRefs[${sourceIndex}].path`);
    if (sourceRef.capturedSha256 !== undefined && !/^[a-f0-9]{64}$/.test(sourceRef.capturedSha256)) {
      throw new Error(`${prefix}.sourceRefs[${sourceIndex}].capturedSha256가 SHA-256 형식이 아닙니다.`);
    }
    for (const field of ["lineStart", "lineEnd"]) {
      if (sourceRef[field] !== undefined && (!Number.isInteger(sourceRef[field]) || sourceRef[field] < 1)) {
        throw new Error(`${prefix}.sourceRefs[${sourceIndex}].${field}는 1 이상의 정수여야 합니다.`);
      }
    }
  }

  if (!ALLOWED_AUTHORITY_STATES.has(item.authorityState)) {
    throw new Error(`${prefix}.authorityState 값이 지원되지 않습니다: ${item.authorityState}`);
  }
  if (!ALLOWED_APPROVAL_STATES.has(item.approvalState)) {
    throw new Error(`${prefix}.approvalState 값이 지원되지 않습니다: ${item.approvalState}`);
  }
  if (!ALLOWED_ENFORCEMENT.has(item.enforcement)) {
    throw new Error(`${prefix}.enforcement 값이 지원되지 않습니다: ${item.enforcement}`);
  }
  const observation = item.authorityClass === "code_observation" || item.authorityClass === "config_observation";
  if (observation && (
    item.kind !== "observation"
    || item.authorityState !== "proposed"
    || item.approvalState !== "unreviewed"
    || item.effectiveRef !== null
    || item.decisionReceiptRef !== null
  )) {
    throw new Error(`${prefix} code/config observation은 proposed/unreviewed observation으로만 표시할 수 있습니다.`);
  }
  if (item.approvalState === "approved" && (
    typeof item.effectiveRef !== "string" || item.effectiveRef.trim() === ""
    || typeof item.decisionReceiptRef !== "string" || item.decisionReceiptRef.trim() === ""
  )) {
    throw new Error(`${prefix} approved 상태에는 effectiveRef와 decisionReceiptRef가 필요합니다.`);
  }
  if (item.authorityState === "effective" && item.approvalState !== "approved") {
    throw new Error(`${prefix} effective authority에는 approved 상태와 decision refs가 필요합니다.`);
  }
  if (kind === "guidelines") {
    requireArray(item.policyRefs, `${prefix}.policyRefs`);
  }
}

export async function loadViewConfig(repoRoot, configPath) {
  const resolvedRoot = await realpath(repoRoot);
  const configCandidate = path.resolve(resolvedRoot, configPath);
  if (!pathIsInside(resolvedRoot, configCandidate)) {
    throw new Error(`View config가 저장소 경계를 벗어납니다: ${configPath}`);
  }
  const resolvedConfig = await realpath(configCandidate);
  if (!pathIsInside(resolvedRoot, resolvedConfig)) {
    throw new Error(`View config symlink가 저장소 경계를 벗어납니다: ${configPath}`);
  }
  const config = await readJson(resolvedConfig, "View config");

  const allowedConfigKeys = new Set([
    "schemaVersion", "project", "governanceCatalog", "bindHost", "portMode", "qualityCommands", "probes",
    "stateDir", "runtimeProbes", "executionCheckpoint", "refreshIntervalMs", "reconcileIntervalMs"
  ]);
  for (const key of Object.keys(config)) {
    if (!allowedConfigKeys.has(key)) throw new Error(`지원하지 않는 View config key입니다: ${key}`);
  }

  if (config.schemaVersion !== 1) {
    throw new Error(`지원하지 않는 View config schemaVersion입니다: ${config.schemaVersion}`);
  }
  requireString(config.project?.id, "config.project.id");
  requireString(config.project?.name, "config.project.name");
  requireString(config.project?.description, "config.project.description");
  if (Object.keys(config.project).some((key) => !["id", "name", "description"].includes(key))) {
    throw new Error("config.project에는 id, name, description만 허용됩니다.");
  }
  requireString(config.governanceCatalog, "config.governanceCatalog");
  if ((config.bindHost ?? "127.0.0.1") !== "127.0.0.1") {
    throw new Error("View config.bindHost는 정확히 127.0.0.1이어야 합니다.");
  }
  if ((config.portMode ?? "auto") !== "auto") {
    throw new Error("View config.portMode는 auto여야 합니다. fixed port는 명시적 CLI override로만 사용합니다.");
  }

  requireArray(config.probes ?? [], "config.probes");
  const probeIds = new Set();
  for (const [index, probe] of (config.probes ?? []).entries()) {
    if (Object.keys(probe).some((key) => !["id", "label", "url", "fields", "timeoutMs", "kind"].includes(key))) {
      throw new Error(`config.probes[${index}]에 지원하지 않는 key가 있습니다.`);
    }
    requireString(probe.id, `config.probes[${index}].id`);
    requireString(probe.label, `config.probes[${index}].label`);
    requireString(probe.url, `config.probes[${index}].url`);
    if (probeIds.has(probe.id)) throw new Error(`config.probes id가 중복됩니다: ${probe.id}`);
    probeIds.add(probe.id);
    const probeUrl = new URL(probe.url);
    const localHost = probeUrl.hostname === "127.0.0.1" || probeUrl.hostname === "localhost" || probeUrl.hostname === "[::1]";
    if (probeUrl.protocol !== "http:" || !localHost || probeUrl.username || probeUrl.password || !probeUrl.port || probeUrl.search || probeUrl.hash) {
      throw new Error(`config.probes[${index}].url은 credential 없는 explicit loopback HTTP endpoint여야 합니다.`);
    }
    requireArray(probe.fields ?? [], `config.probes[${index}].fields`);
    if ((probe.fields ?? []).length > 20) {
      throw new Error(`config.probes[${index}].fields는 20개를 초과할 수 없습니다.`);
    }
    for (const [fieldIndex, field] of (probe.fields ?? []).entries()) {
      requireString(field, `config.probes[${index}].fields[${fieldIndex}]`);
      if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(field)) {
        throw new Error(`config.probes[${index}].fields[${fieldIndex}]가 안전한 field path가 아닙니다.`);
      }
    }
    const timeoutMs = Number(probe.timeoutMs ?? 3000);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) {
      throw new Error(`config.probes[${index}].timeoutMs는 100~30000 사이 정수여야 합니다.`);
    }
  }
  if (config.qualityCommands !== undefined) {
    if (Object.keys(config.qualityCommands).some((key) => !["fast", "full", "continuous"].includes(key))) {
      throw new Error("config.qualityCommands에는 fast, full, continuous만 허용됩니다.");
    }
    for (const key of ["fast", "full", "continuous"]) {
      requireString(config.qualityCommands[key], `config.qualityCommands.${key}`);
    }
  } else {
    throw new Error("config.qualityCommands.fast, full, continuous가 필요합니다.");
  }

  for (const [key, fixedValue] of Object.entries(VIEW_RUNTIME_CONTRACT)) {
    if (config[key] !== undefined && config[key] !== fixedValue) {
      throw new Error(`config.${key}는 reference distribution 고정값 ${JSON.stringify(fixedValue)}이어야 합니다.`);
    }
  }

  return {
    ...config,
    ...VIEW_RUNTIME_CONTRACT,
    resolvedRoot,
    resolvedConfig
  };
}

async function resolveInsideRoot(repoRoot, relativePath) {
  requireString(relativePath, "sourceRefs.path");
  if (path.isAbsolute(relativePath)) {
    throw new Error(`source ref는 저장소 상대 경로여야 합니다: ${relativePath}`);
  }
  const resolved = path.resolve(repoRoot, relativePath);
  const relative = path.relative(repoRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`source ref가 저장소 경계를 벗어납니다: ${relativePath}`);
  }
  return resolved;
}

async function inspectSourceRef(repoRoot, sourceRef, capturedRepositoryRevision) {
  const result = {
    path: sourceRef.path,
    heading: sourceRef.heading ?? null,
    lineStart: sourceRef.lineStart ?? null,
    lineEnd: sourceRef.lineEnd ?? null,
    evidenceKind: sourceRef.evidenceKind ?? "source",
    note: sourceRef.note ?? null,
    capturedSha256: sourceRef.capturedSha256 ?? null,
    capturedRepositoryRevision: sourceRef.capturedRepositoryRevision ?? capturedRepositoryRevision ?? null,
    currentSha256: null,
    state: "missing"
  };

  try {
    const captured = await captureRepositoryFile(repoRoot, sourceRef.path, "source ref");
    Object.defineProperty(result, "inputFence", { value: captured.fence, enumerable: false });
    if (captured.state === "missing") return result;
    if (captured.state !== "file") {
      result.state = "invalid";
      result.error = captured.reason === "outside_repository"
        ? `source ref symlink가 저장소 경계를 벗어납니다: ${sourceRef.path}`
        : `source ref가 파일이 아닙니다: ${sourceRef.path}`;
      return result;
    }
    result.currentSha256 = captured.digest;
    result.state = sourceRef.capturedSha256 && sourceRef.capturedSha256 !== result.currentSha256
      ? "changed"
      : "current";
    return result;
  } catch (error) {
    if (error.code === "ENOENT") {
      return result;
    }
    result.state = "invalid";
    result.error = error.message;
    return result;
  }
}

async function verifyStableInputs(repoRoot, inputs) {
  for (const input of inputs) {
    const current = await captureRepositoryFile(repoRoot, input.relativePath, input.label);
    if (current.fence !== input.fence) {
      const error = new Error(`View input changed while the projection was being built: ${input.relativePath}`);
      error.code = "VIEW_INPUT_CHANGED_DURING_BUILD";
      throw error;
    }
  }
}

async function inspectItems(repoRoot, items, kind, capturedRepositoryRevision) {
  return Promise.all(items.map(async (item, index) => {
    validateItem(item, kind, index);
    const sourceRefs = await Promise.all(item.sourceRefs.map((sourceRef) =>
      inspectSourceRef(repoRoot, sourceRef, capturedRepositoryRevision)
    ));
    const evidenceState = sourceRefs.some((ref) => ref.state === "missing" || ref.state === "invalid")
      ? "missing"
      : sourceRefs.some((ref) => ref.state === "changed")
        ? "stale"
        : "current";
    return { ...item, sourceRefs, evidenceState };
  }));
}

async function readRuntimeProbes(repoRoot, configuredPath) {
  const relativePath = configuredPath ?? ".document-harness/runtime/view/runtime-probes.json";
  let resolved;
  try {
    resolved = await resolveExistingInsideRoot(repoRoot, relativePath, "runtime probes");
    return await readJson(resolved, "runtime probes");
  } catch (error) {
    if (error.code === "ENOENT" || error.message.includes("ENOENT")) {
      return {
        schemaVersion: 1,
        observedAt: null,
        repository: { status: "not_observed", dirtyCount: null, changedPaths: [] },
        probes: []
      };
    }
    throw error;
  }
}

function gitResult(repoRoot, args) {
  return spawnSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function normalizeRelativePath(value) {
  return String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
}

function outsideRuntimeState(line, excludedRelativePath) {
  if (!excludedRelativePath) return true;
  const changedPath = normalizeRelativePath(line.slice(3).replace(/^"|"$/g, ""));
  const excluded = normalizeRelativePath(excludedRelativePath).replace(/\/$/, "");
  return changedPath !== excluded && !changedPath.startsWith(`${excluded}/`);
}

function inspectCurrentRepository(repoRoot, stateDir) {
  const headResult = gitResult(repoRoot, ["rev-parse", "--verify", "HEAD"]);
  const statusResult = gitResult(repoRoot, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const excludedRelativePath = stateDir ? path.relative(repoRoot, path.resolve(repoRoot, stateDir)) : null;
  const changedLines = statusResult.status === 0
    ? statusResult.stdout.split("\n").filter(Boolean).filter((line) => outsideRuntimeState(line, excludedRelativePath))
    : [];
  return {
    state: headResult.status === 0 && statusResult.status === 0 ? "observed" : "unknown",
    head: headResult.status === 0 ? headResult.stdout.trim() : null,
    workingTreeState: statusResult.status === 0 ? (changedLines.length > 0 ? "dirty" : "clean") : "unknown",
    dirtyCount: statusResult.status === 0 ? changedLines.length : null,
    error: headResult.status === 0 && statusResult.status === 0
      ? null
      : [headResult.stderr, statusResult.stderr].map((value) => value?.trim()).filter(Boolean).join("; ") || "Git repository state is unavailable."
  };
}

function receiptRevision(receipt) {
  return receipt?.targetSourceRevision
    ?? receipt?.target_source_revision
    ?? receipt?.repositoryRevision
    ?? receipt?.repository_revision
    ?? receipt?.target?.sourceRevision
    ?? receipt?.target?.source_revision
    ?? receipt?.capturedRepository?.baseCommit
    ?? null;
}

async function inspectMigrationFence(repoRoot, migration, currentRepository) {
  const capturedRepository = migration?.capturedRepository ?? {};
  const baseCommit = capturedRepository.baseCommit ?? null;
  const workingTreeState = capturedRepository.workingTreeState ?? null;
  const result = {
    state: "invalid",
    reason: "missing_captured_base",
    capturedRepository: {
      baseCommit,
      workingTreeState
    },
    resolvedBaseCommit: null,
    currentHeadAdvanced: false,
    receiptRef: migration?.receiptRef ?? null,
    receiptState: migration?.receiptRef ? "unchecked" : "not_configured"
  };

  if (typeof baseCommit !== "string" || !/^[a-f0-9]{40,64}$/.test(baseCommit)) {
    return result;
  }
  if (!["clean", "dirty", "unknown"].includes(workingTreeState)) {
    result.reason = "invalid_captured_working_tree_state";
    return result;
  }

  const resolveResult = gitResult(repoRoot, ["rev-parse", "--verify", `${baseCommit}^{commit}`]);
  if (resolveResult.status !== 0) {
    result.reason = "unresolvable_captured_base";
    return result;
  }
  result.resolvedBaseCommit = resolveResult.stdout.trim();
  result.currentHeadAdvanced = Boolean(currentRepository.head && currentRepository.head !== result.resolvedBaseCommit);

  if (migration?.receiptRef) {
    try {
      const receiptPath = await resolveExistingInsideRoot(repoRoot, migration.receiptRef, "migration receipt");
      const receipt = await readJson(receiptPath, "migration receipt");
      const revision = receiptRevision(receipt);
      result.receiptState = revision === result.resolvedBaseCommit ? "matched" : "mismatch";
      if (result.receiptState === "mismatch") {
        result.reason = "receipt_revision_mismatch";
        return result;
      }
    } catch (error) {
      result.receiptState = "missing_or_invalid";
      result.reason = "receipt_missing_or_invalid";
      result.error = error.message;
      return result;
    }
  }

  result.state = "valid";
  result.reason = result.currentHeadAdvanced ? "current_head_advanced" : "captured_head_current";
  return result;
}

async function readExecutionCheckpoint(repoRoot, configuredPath) {
  try {
    const resolved = await resolveExistingInsideRoot(repoRoot, configuredPath, "execution checkpoint");
    const checkpoint = await readJson(resolved, "execution checkpoint");
    return {
      configured: true,
      status: "observed",
      source: configuredPath,
      checkpointId: checkpoint.checkpoint_id ?? checkpoint.checkpointId ?? checkpoint.id ?? null,
      lifecycleStatus: checkpoint.lifecycle_status ?? checkpoint.lifecycleStatus ?? checkpoint.status ?? null,
      loopState: checkpoint.loop_state ?? checkpoint.loopState ?? null,
      nextActor: checkpoint.next_actor ?? checkpoint.nextActor ?? null,
      nextAction: checkpoint.next_action ?? checkpoint.nextAction ?? null,
      budget: checkpoint.budget ?? null,
      verification: checkpoint.verification ?? checkpoint.last_verification ?? null
    };
  } catch (error) {
    if (error.code === "ENOENT" || error.message.includes("ENOENT")) {
      return {
        configured: false,
        status: "not_configured",
        message: "No task checkpoint, next action, verification receipt, or budget source is configured."
      };
    }
    return {
      configured: true,
      status: "degraded",
      source: configuredPath,
      error: error.message
    };
  }
}

function createGeneratedAttention(register, policies, guidelines, migrationFence, execution) {
  const attention = [...(register.attention ?? [])];
  const staleItems = [...policies, ...guidelines].filter((item) => item.evidenceState !== "current");

  if (register.migration?.status === "awaiting_human_review") {
    attention.unshift({
      id: "ATTN-MIGRATION-REVIEW",
      severity: "decision",
      title: "초기 정책 이관 결과를 확인해 주세요",
      humanSummary: "현재 항목은 기존 문서와 코드에서 추출한 후보입니다. 사용자 확인 전에는 새 정책 승인으로 간주하지 않습니다.",
      relatedRefs: []
    });
  }

  if (staleItems.length > 0) {
    attention.unshift({
      id: "ATTN-SOURCE-FRESHNESS",
      severity: "warning",
      title: "정책 근거가 변경되었거나 사라졌습니다",
      humanSummary: `${staleItems.length}개 항목의 근거를 다시 읽고 후보를 재검토해야 합니다.`,
      relatedRefs: staleItems.map((item) => item.id)
    });
  }

  if (policies.length === 0 && guidelines.length === 0) {
    attention.unshift({
      id: "ATTN-GOVERNANCE-EMPTY",
      severity: "warning",
      title: "No source-backed governance candidates are available",
      humanSummary: "The View keeps this as an explicit extraction gap instead of inventing policy or guidance.",
      relatedRefs: []
    });
  }

  if (migrationFence.state !== "valid") {
    attention.unshift({
      id: "ATTN-MIGRATION-FENCE",
      severity: "warning",
      title: "Captured migration revision cannot be verified",
      humanSummary: `The migration fence is ${migrationFence.reason}. Review the installation receipt before relying on migration freshness.`,
      relatedRefs: migrationFence.receiptRef ? [migrationFence.receiptRef] : []
    });
  }

  if (execution.status === "degraded") {
    attention.unshift({
      id: "ATTN-EXECUTION-SOURCE",
      severity: "warning",
      title: "Execution checkpoint source is unavailable",
      humanSummary: execution.error,
      relatedRefs: execution.source ? [execution.source] : []
    });
  }

  return attention;
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const value = item[field] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

async function buildProjectionAttempt({ repoRoot, configPath, snapshotSeq = 1, attempt = 1, beforeInputRecheck }) {
  const config = await loadViewConfig(repoRoot, configPath);
  const registerInput = await captureRepositoryFile(config.resolvedRoot, config.governanceCatalog, "governance catalog");
  const register = parseCapturedJson(registerInput, "governance catalog");

  if (register.schemaVersion !== 1) {
    throw new Error(`지원하지 않는 governance catalog schemaVersion입니다: ${register.schemaVersion}`);
  }
  requireString(register.migration?.status, "register.migration.status");
  if (register.migration.status === "reviewed" && (
    typeof register.migration.receiptRef !== "string" || register.migration.receiptRef.trim() === ""
  )) {
    throw new Error("register.migration.status가 reviewed이면 receiptRef가 필요합니다.");
  }
  requireArray(register.policies, "register.policies");
  requireArray(register.guidelines, "register.guidelines");
  requireArray(register.attention ?? [], "register.attention");

  const allItems = [...register.policies, ...register.guidelines];
  const itemIds = new Set();
  for (const item of allItems) {
    if (itemIds.has(item.id)) throw new Error(`policy register item id가 중복됩니다: ${item.id}`);
    itemIds.add(item.id);
  }
  const policyIds = new Set(register.policies.map((item) => item.id));
  for (const guideline of register.guidelines) {
    for (const policyRef of guideline.policyRefs ?? []) {
      if (!policyIds.has(policyRef)) {
        throw new Error(`${guideline.id}.policyRefs가 없는 policy를 참조합니다: ${policyRef}`);
      }
    }
  }

  const currentRepository = inspectCurrentRepository(config.resolvedRoot, config.stateDir ?? ".document-harness/runtime/view");
  const migrationFence = await inspectMigrationFence(config.resolvedRoot, register.migration, currentRepository);
  const capturedRepositoryRevision = register.migration?.capturedRepository?.baseCommit ?? null;
  const policies = await inspectItems(config.resolvedRoot, register.policies, "policies", capturedRepositoryRevision);
  const guidelines = await inspectItems(config.resolvedRoot, register.guidelines, "guidelines", capturedRepositoryRevision);
  const runtime = await readRuntimeProbes(config.resolvedRoot, config.runtimeProbes);
  const execution = await readExecutionCheckpoint(config.resolvedRoot, config.executionCheckpoint);
  const attention = createGeneratedAttention(register, policies, guidelines, migrationFence, execution);
  const allRefs = [...policies, ...guidelines].flatMap((item) => item.sourceRefs);
  const sourceEvidenceState = allRefs.length === 0
    ? "unknown"
    : allRefs.some((ref) => ref.state === "missing" || ref.state === "invalid")
      ? "degraded"
      : allRefs.some((ref) => ref.state === "changed")
        ? "stale"
        : "fresh";
  const projectionState = migrationFence.state !== "valid" || execution.status === "degraded"
    ? "degraded"
    : sourceEvidenceState;
  const semantic = {
    project: config.project,
    direction: register.direction ?? [],
    migration: register.migration,
    policies,
    guidelines,
    attention,
    runtime,
    migrationFence,
    currentRepository,
    execution,
    qualityCommands: config.qualityCommands ?? {}
  };
  const semanticHash = sha256(stableStringify(semantic));
  const generatedAt = new Date().toISOString();
  const snapshotId = `view-${String(snapshotSeq).padStart(8, "0")}-${semanticHash.slice(0, 10)}`;

  const snapshot = {
    schemaVersion: 1,
    runtimeVersion: REFERENCE_VIEW_VERSION,
    snapshot: {
      id: snapshotId,
      seq: snapshotSeq,
      generatedAt,
      semanticHash,
      freshness: projectionState,
      sourceFence: {
        governanceCatalog: config.governanceCatalog,
        sourceEvidenceState,
        evidenceCurrent: allRefs.filter((ref) => ref.state === "current").length,
        evidenceChanged: allRefs.filter((ref) => ref.state === "changed").length,
        evidenceMissing: allRefs.filter((ref) => ref.state === "missing" || ref.state === "invalid").length
      },
      capabilities: {
        read: true,
        write: false,
        approvalIntents: false,
        execution: false
      }
    },
    project: config.project,
    direction: register.direction ?? [],
    migration: register.migration,
    migrationFence,
    currentRepository,
    summary: {
      policyCount: policies.length,
      guidelineCount: guidelines.length,
      approvedCount: [...policies, ...guidelines].filter((item) => item.approvalState === "approved").length,
      reviewCount: [...policies, ...guidelines].filter((item) => item.approvalState === "unreviewed" || item.approvalState === "review_requested").length,
      attentionCount: attention.length,
      enforcement: countBy([...policies, ...guidelines], "enforcement"),
      authority: countBy([...policies, ...guidelines], "authorityClass")
    },
    policies,
    guidelines,
    attention,
    runtime,
    execution,
    qualityCommands: config.qualityCommands ?? {},
    client: {
      refreshIntervalMs: config.refreshIntervalMs
    }
  };

  if (beforeInputRecheck) await beforeInputRecheck({ attempt, snapshot });
  const sourceInputs = [...policies, ...guidelines]
    .flatMap((item) => item.sourceRefs)
    .map((sourceRef) => ({
      label: "source ref",
      relativePath: sourceRef.path,
      fence: sourceRef.inputFence
    }));
  await verifyStableInputs(config.resolvedRoot, [
    {
      label: "governance catalog",
      relativePath: config.governanceCatalog,
      fence: registerInput.fence
    },
    ...sourceInputs
  ]);

  return { config, register, snapshot, semanticHash };
}

export async function buildProjection(options) {
  const attempts = Number(options.inputStabilityAttempts ?? 2);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new Error("inputStabilityAttempts는 1~3 사이 정수여야 합니다.");
  }
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await buildProjectionAttempt({ ...options, attempt });
    } catch (error) {
      if (error.code !== "VIEW_INPUT_CHANGED_DURING_BUILD") throw error;
      lastError = error;
    }
  }
  throw lastError;
}
