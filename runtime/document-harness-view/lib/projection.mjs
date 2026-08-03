import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import {
  assessHumanPresentation,
  validateHumanPresentationReceipt
} from "../../../docs/lib/human-presentation-authority.mjs";
import { validateDomainSupervision } from "../../../docs/lib/domain-supervision-authority.mjs";
import { REFERENCE_VIEW_VERSION } from "../version.mjs";

export const VIEW_RUNTIME_CONTRACT = Object.freeze({
  stateDir: ".document-harness/runtime/view",
  runtimeProbes: ".document-harness/runtime/view/runtime-probes.json",
  domainDesignRoot: "docs/design",
  executionCheckpointRoot: "docs/checkpoints",
  projectRoot: "docs/projects",
  refreshIntervalMs: 2000,
  reconcileIntervalMs: 5000
});

const ALLOWED_LOOP_STATES = new Set([
  "ready",
  "running",
  "awaiting_user",
  "awaiting_external",
  "needs_review",
  "stopped",
  "succeeded"
]);
const ALLOWED_STOP_REASONS = new Set(["NO_PROGRESS", "BUDGET_EXCEEDED", "BLOCKED", "CONFLICT", "SAFETY"]);
const ALLOWED_NEXT_ACTORS = new Set(["agent", "user", "reviewer", "external", "none"]);
const TASK_STATUS_LOOP_STATES = new Map([
  ["draft", new Set(["ready"])],
  ["active", new Set(["ready", "running", "awaiting_user", "awaiting_external", "needs_review", "stopped", "succeeded"])],
  ["blocked", new Set(["awaiting_user", "awaiting_external", "needs_review", "stopped"])],
  ["done", new Set(["succeeded"])],
  ["closed", new Set(["succeeded"])],
  ["superseded", new Set(["stopped"])],
  ["cancelled", new Set(["stopped"])]
]);

const PRIVATE_EVIDENCE_PATH = /(?:^|\/)(?:\.git|\.env(?:\.[^/]*)?|secrets?|credentials?|private[-_.]?keys?|id_rsa(?:\.[^/]*)?|[^/]+\.(?:pem|key|p12|pfx))(?:\/|$)/i;

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

const ALLOWED_INITIATIVE_LIFECYCLE = new Set([
  "draft",
  "active",
  "blocked",
  "done",
  "cancelled",
  "superseded"
]);
const ALLOWED_PRESENTATION_STATUS = new Set(["missing", "review_requested", "ready"]);

const TAB_KEYS = ["overview", "domain", "policies", "guidelines", "initiatives", "review", "execution", "evidence"];
const DEFAULT_PRESENTATION = Object.freeze({
  displayName: "Board",
  locale: "en-US",
  sortLocale: "en",
  tabLabels: Object.freeze({
    overview: "Overview",
    domain: "Domain",
    policies: "Policies",
    guidelines: "Guidelines",
    initiatives: "Initiatives",
    review: "Review",
    execution: "Execution",
    evidence: "Evidence"
  })
});

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

function optionalNonEmptyString(value, fallback, label) {
  if (value === undefined || value === null || value === "") return fallback;
  return requireString(value, label);
}

function assertAllowedKeys(value, allowed, label) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${label}은 object여야 합니다.`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label}에 지원하지 않는 key가 있습니다: ${key}`);
  }
}

function pathIsInside(repoRoot, candidate) {
  const relative = path.relative(repoRoot, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertPublicEvidencePath(relativePath, label) {
  requireString(relativePath, label);
  const normalized = relativePath.replaceAll("\\", "/");
  if (PRIVATE_EVIDENCE_PATH.test(normalized)) {
    throw new Error(`${label}는 private/credential 경로를 참조할 수 없습니다: ${relativePath}`);
  }
}

function normalizePresentation(value = {}) {
  if (value === undefined || value === null) value = {};
  assertAllowedKeys(value, new Set(["displayName", "locale", "sortLocale", "tabs", "tabLabels"]), "config.presentation");
  const rawTabs = value.tabLabels ?? value.tabs ?? {};
  if (Array.isArray(rawTabs)) {
    if (rawTabs.length !== TAB_KEYS.length) {
      throw new Error(`config.presentation.tabs는 ${TAB_KEYS.length}개 tab label을 가져야 합니다.`);
    }
  } else {
    assertAllowedKeys(rawTabs, new Set(TAB_KEYS), "config.presentation.tabs");
  }

  const tabLabels = {};
  for (const [index, key] of TAB_KEYS.entries()) {
    const candidate = Array.isArray(rawTabs) ? rawTabs[index] : rawTabs[key];
    tabLabels[key] = optionalNonEmptyString(candidate, DEFAULT_PRESENTATION.tabLabels[key], `config.presentation.tabs.${key}`);
  }

  return {
    displayName: optionalNonEmptyString(value.displayName, DEFAULT_PRESENTATION.displayName, "config.presentation.displayName"),
    locale: optionalNonEmptyString(value.locale, DEFAULT_PRESENTATION.locale, "config.presentation.locale"),
    sortLocale: optionalNonEmptyString(value.sortLocale, value.locale ?? DEFAULT_PRESENTATION.sortLocale, "config.presentation.sortLocale"),
    tabLabels
  };
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
    assertPublicEvidencePath(relativePath, label);
    resolved = await resolveInsideRoot(repoRoot, relativePath);
  } catch (error) {
    const captured = {
      relativePath,
      state: "invalid",
      reason: PRIVATE_EVIDENCE_PATH.test(String(relativePath).replaceAll("\\", "/"))
        ? "private_path"
        : "outside_repository"
    };
    return { ...captured, fence: inputFence(captured) };
  }
  try {
    const segments = path.relative(repoRoot, resolved).split(path.sep).filter(Boolean);
    let lexical = repoRoot;
    for (const [index, segment] of segments.entries()) {
      lexical = path.join(lexical, segment);
      const lexicalStat = await lstat(lexical);
      if (lexicalStat.isSymbolicLink()) {
        const captured = { relativePath, state: "invalid", reason: "symlink" };
        return { ...captured, fence: inputFence(captured) };
      }
      if (index < segments.length - 1 && !lexicalStat.isDirectory()) {
        const captured = { relativePath, state: "invalid", reason: "non_directory_parent" };
        return { ...captured, fence: inputFence(captured) };
      }
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      const captured = { relativePath, state: "missing", reason: "missing" };
      return { ...captured, fence: inputFence(captured) };
    }
    throw error;
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
      : captured.reason === "symlink"
        ? "symlink일 수 없습니다"
        : captured.reason === "private_path"
          ? "private/credential 경로를 참조할 수 없습니다"
          : "파일이 아니거나 존재하지 않습니다";
    throw new Error(`${label} ${suffix}: ${captured.relativePath}`);
  }
  try {
    return JSON.parse(captured.bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} JSON이 올바르지 않습니다: ${captured.relativePath} (${error.message})`);
  }
}

async function inspectHumanPresentation({
  repoRoot,
  documentInput,
  subjectKind,
  subjectId,
  displayTitle,
  humanSummary,
  declaredStatus,
  receiptRef,
  locale
}) {
  const effectiveStatus = declaredStatus
    ?? ((typeof displayTitle === "string" && displayTitle.trim() !== ""
      && typeof humanSummary === "string" && humanSummary.trim() !== "")
      ? "review_requested"
      : "missing");
  const assessment = assessHumanPresentation({
    displayTitle,
    humanSummary,
    declaredStatus: effectiveStatus
  });
  const base = {
    presentationStatus: assessment.state,
    presentationRef: receiptRef ?? null,
    presentationError: assessment.reason ?? null,
    displayTitle: assessment.displayTitle ?? null,
    humanSummary: assessment.humanSummary ?? null,
    presentationReviewedBy: null,
    presentationReviewedAt: null,
    visibleOnBoard: ["review_requested", "ready"].includes(assessment.state),
    input: null
  };
  if (assessment.state !== "ready") return base;
  if (typeof receiptRef !== "string" || receiptRef.trim() === "") {
    return {
      ...base,
      presentationStatus: "invalid",
      presentationError: "ready presentation에는 human presentation receipt가 필요합니다.",
      visibleOnBoard: false
    };
  }
  const receiptInput = await captureRepositoryFile(repoRoot, receiptRef, "human presentation review receipt");
  const input = {
    label: "human presentation review receipt",
    relativePath: receiptRef,
    fence: receiptInput.fence
  };
  try {
    const receipt = parseCapturedJson(receiptInput, "human presentation review receipt");
    const reviewed = validateHumanPresentationReceipt(receipt, {
      documentRef: documentInput.relativePath,
      documentSha256: documentInput.digest,
      subjectKind,
      subjectId,
      expectedLocale: locale
    });
    return {
      ...base,
      presentationStatus: "ready",
      presentationError: null,
      presentationReviewedBy: reviewed.decidedBy,
      presentationReviewedAt: reviewed.decidedAt,
      visibleOnBoard: true,
      input
    };
  } catch (error) {
    return {
      ...base,
      presentationStatus: "invalid",
      presentationError: error.message,
      visibleOnBoard: false,
      input
    };
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
  if (item.presentationStatus !== undefined && !ALLOWED_PRESENTATION_STATUS.has(item.presentationStatus)) {
    throw new Error(`${prefix}.presentationStatus 값이 지원되지 않습니다: ${item.presentationStatus}`);
  }
  if (item.presentationStatus === "ready") {
    requireString(item.presentationRef, `${prefix}.presentationRef`);
    assertPublicEvidencePath(item.presentationRef, `${prefix}.presentationRef`);
  } else if (item.presentationRef !== undefined && item.presentationRef !== null) {
    throw new Error(`${prefix}.presentationRef는 ready 상태에서만 사용할 수 있습니다.`);
  }
  if (item.sourceRefs.length === 0) {
    throw new Error(`${prefix}.sourceRefs는 최소 한 건의 근거를 포함해야 합니다.`);
  }
  for (const [sourceIndex, sourceRef] of item.sourceRefs.entries()) {
    requireString(sourceRef.path, `${prefix}.sourceRefs[${sourceIndex}].path`);
    assertPublicEvidencePath(sourceRef.path, `${prefix}.sourceRefs[${sourceIndex}].path`);
    requireString(sourceRef.heading, `${prefix}.sourceRefs[${sourceIndex}].heading`);
    if (!/^[a-f0-9]{64}$/.test(sourceRef.capturedSha256 ?? "")) {
      throw new Error(`${prefix}.sourceRefs[${sourceIndex}].capturedSha256가 SHA-256 형식이 아닙니다.`);
    }
    if (!/^[a-f0-9]{40}$/.test(sourceRef.capturedRepositoryRevision ?? "")) {
      throw new Error(`${prefix}.sourceRefs[${sourceIndex}].capturedRepositoryRevision이 Git commit 형식이 아닙니다.`);
    }
    for (const field of ["lineStart", "lineEnd"]) {
      if (!Number.isInteger(sourceRef[field]) || sourceRef[field] < 1) {
        throw new Error(`${prefix}.sourceRefs[${sourceIndex}].${field}는 1 이상의 정수여야 합니다.`);
      }
    }
    if (sourceRef.lineEnd < sourceRef.lineStart) {
      throw new Error(`${prefix}.sourceRefs[${sourceIndex}].lineEnd는 lineStart 이상이어야 합니다.`);
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
    "schemaVersion", "project", "governanceCatalog", "initiativeRegister", "bindHost", "portMode", "qualityCommands", "probes",
    "presentation", "stateDir", "runtimeProbes", "domainDesignRoot", "refreshIntervalMs", "reconcileIntervalMs"
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
  requireString(config.initiativeRegister, "config.initiativeRegister");
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
    presentation: normalizePresentation(config.presentation),
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

async function inspectSourceRef(repoRoot, sourceRef) {
  const result = {
    path: sourceRef.path,
    heading: sourceRef.heading ?? null,
    lineStart: sourceRef.lineStart ?? null,
    lineEnd: sourceRef.lineEnd ?? null,
    evidenceKind: sourceRef.evidenceKind ?? "source",
    note: sourceRef.note ?? null,
    capturedSha256: sourceRef.capturedSha256 ?? null,
    capturedRepositoryRevision: sourceRef.capturedRepositoryRevision,
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
    const revision = gitResult(repoRoot, ["rev-parse", "--verify", `${sourceRef.capturedRepositoryRevision}^{commit}`]);
    if (revision.status !== 0) {
      result.state = "invalid";
      result.error = `source ref revision을 확인할 수 없습니다: ${sourceRef.capturedRepositoryRevision}`;
      return result;
    }
    const committed = gitResult(repoRoot, ["show", `${sourceRef.capturedRepositoryRevision}:${sourceRef.path}`]);
    if (committed.status !== 0) {
      result.state = "invalid";
      result.error = `source ref를 captured revision에서 읽을 수 없습니다: ${sourceRef.path}`;
      return result;
    }
    if (sha256(committed.stdout) !== sourceRef.capturedSha256) {
      result.state = "invalid";
      result.error = `source ref hash가 captured revision bytes와 일치하지 않습니다: ${sourceRef.path}`;
      return result;
    }
    result.currentSha256 = captured.digest;
    const lineCount = captured.bytes.toString("utf8").split(/\r?\n/).length;
    if (sourceRef.lineEnd > lineCount) {
      result.state = "invalid";
      result.error = `source ref lineEnd가 현재 파일 범위를 벗어납니다: ${sourceRef.path}`;
      return result;
    }
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

function assertHumanDecisionReceipt(decision, item, capturedRepositoryRevision, effectiveSha256) {
  const label = `${item.id}.decisionReceiptRef`;
  if (
    decision?.schemaVersion !== 1
    || typeof decision.decisionId !== "string" || decision.decisionId.trim() === ""
    || decision.candidateId !== item.id
    || !["approved", "exception_accepted"].includes(decision.decision)
    || !["human", "human_delegated_system"].includes(decision.decidedBy?.actorKind)
    || typeof decision.decidedBy?.identifier !== "string" || decision.decidedBy.identifier.trim() === ""
    || typeof decision.decidedAt !== "string" || Number.isNaN(Date.parse(decision.decidedAt))
    || decision.sourceFence?.repositoryRevision !== capturedRepositoryRevision
    || !Array.isArray(decision.sourceFence?.sourceHashes)
    || decision.sourceFence.sourceHashes.length === 0
    || !decision.sourceFence.sourceHashes.every((digest) => /^[a-f0-9]{64}$/.test(digest))
    || decision.effectiveRef !== item.effectiveRef
    || decision.effectiveSha256 !== effectiveSha256
  ) {
    throw new Error(`${label}가 candidate, human actor, source fence와 effective ref bytes를 승인하지 않습니다.`);
  }
  const requiredSourceHashes = item.sourceRefs.map(({ capturedSha256 }) => capturedSha256);
  if (!requiredSourceHashes.every((digest) => decision.sourceFence.sourceHashes.includes(digest))) {
    throw new Error(`${label}가 candidate의 모든 source hash를 승인하지 않습니다.`);
  }
}

async function verifyApprovedItemEvidence(repoRoot, item, evidenceState) {
  if (evidenceState !== "current") {
    throw new Error(`${item.id} approved/effective 상태에는 current source fence가 필요합니다.`);
  }
  assertPublicEvidencePath(item.effectiveRef, `${item.id}.effectiveRef`);
  assertPublicEvidencePath(item.decisionReceiptRef, `${item.id}.decisionReceiptRef`);

  const [effective, decisionReceipt] = await Promise.all([
    captureRepositoryFile(repoRoot, item.effectiveRef, `${item.id}.effectiveRef`),
    captureRepositoryFile(repoRoot, item.decisionReceiptRef, `${item.id}.decisionReceiptRef`)
  ]);
  if (effective.state !== "file") {
    throw new Error(`${item.id}.effectiveRef가 안전한 repository regular file이 아닙니다: ${item.effectiveRef}`);
  }
  if (decisionReceipt.state !== "file") {
    throw new Error(`${item.id}.decisionReceiptRef가 안전한 repository regular file이 아닙니다: ${item.decisionReceiptRef}`);
  }
  const sourceRevisions = new Set(item.sourceRefs.map(({ capturedRepositoryRevision }) => capturedRepositoryRevision));
  if (sourceRevisions.size !== 1) {
    throw new Error(`${item.id} approved/effective source refs는 하나의 repository revision을 공유해야 합니다.`);
  }
  const [sourceRevision] = sourceRevisions;
  const decision = parseCapturedJson(decisionReceipt, `${item.id} human decision receipt`);
  assertHumanDecisionReceipt(decision, item, sourceRevision, effective.digest);
  return [
    { label: "effective governance ref", relativePath: item.effectiveRef, fence: effective.fence },
    { label: "human decision receipt", relativePath: item.decisionReceiptRef, fence: decisionReceipt.fence }
  ];
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

async function inspectItems(repoRoot, items, kind, documentInput, locale) {
  const approvalInputs = [];
  const presentationInputs = [];
  const inspected = await Promise.all(items.map(async (item, index) => {
    validateItem(item, kind, index);
    const sourceRefs = await Promise.all(item.sourceRefs.map((sourceRef) =>
      inspectSourceRef(repoRoot, sourceRef)
    ));
    const evidenceState = sourceRefs.some((ref) => ref.state === "missing" || ref.state === "invalid")
      ? "missing"
      : sourceRefs.some((ref) => ref.state === "changed")
        ? "stale"
        : "current";
    if (item.approvalState === "approved" || item.authorityState === "effective") {
      approvalInputs.push(...await verifyApprovedItemEvidence(
        repoRoot,
        item,
        evidenceState
      ));
    }
    const presentation = await inspectHumanPresentation({
      repoRoot,
      documentInput,
      subjectKind: item.kind === "observation" ? (kind === "policies" ? "policy" : "guideline") : item.kind,
      subjectId: item.id,
      displayTitle: item.title,
      humanSummary: item.humanSummary,
      declaredStatus: item.presentationStatus,
      receiptRef: item.presentationRef,
      locale
    });
    if (presentation.input) presentationInputs.push(presentation.input);
    return {
      ...item,
      sourceRefs,
      evidenceState,
      presentationStatus: presentation.presentationStatus,
      presentationRef: presentation.presentationRef,
      presentationError: presentation.presentationError,
      presentationReviewedBy: presentation.presentationReviewedBy,
      presentationReviewedAt: presentation.presentationReviewedAt,
      visibleOnBoard: presentation.visibleOnBoard
    };
  }));
  return { items: inspected, approvalInputs, presentationInputs };
}

function validateInitiative(initiative, index) {
  const prefix = `initiatives[${index}]`;
  assertAllowedKeys(initiative, new Set([
    "id", "kind", "title", "humanSummary", "outcome", "whyNow", "lifecycleState", "approvalState", "owner", "currentFocus",
    "policyRefs", "policyRelationships", "guidelineRefs", "guidelineRelationships", "guidelineDisposition", "guidelineDispositionReason", "legacyProjectRefs",
    "successSignals", "risks", "documentRef", "effectiveRef", "decisionReceiptRef", "sourceRevision", "sourceRefs",
    "presentationStatus", "presentationRef"
  ]), prefix);
  for (const field of ["id", "kind", "title", "humanSummary", "outcome", "whyNow", "lifecycleState", "approvalState", "owner", "currentFocus", "guidelineDisposition", "guidelineDispositionReason", "sourceRevision"]) {
    requireString(initiative[field], `${prefix}.${field}`);
  }
  const numbered = /^I[0-9]{4}$/.test(initiative.id);
  const migrationCandidate = /^INIT-[A-Z0-9][A-Z0-9-]*$/.test(initiative.id);
  if (!numbered && !migrationCandidate) {
    throw new Error(`${prefix}.id는 I#### 또는 INIT-* migration candidate 형식이어야 합니다.`);
  }
  if (initiative.kind !== "initiative") {
    throw new Error(`${prefix}.kind는 initiative여야 합니다.`);
  }
  if (!ALLOWED_INITIATIVE_LIFECYCLE.has(initiative.lifecycleState)) {
    throw new Error(`${prefix}.lifecycleState 값이 지원되지 않습니다: ${initiative.lifecycleState}`);
  }
  if (!ALLOWED_APPROVAL_STATES.has(initiative.approvalState)) {
    throw new Error(`${prefix}.approvalState 값이 지원되지 않습니다: ${initiative.approvalState}`);
  }
  if (initiative.presentationStatus !== undefined && !ALLOWED_PRESENTATION_STATUS.has(initiative.presentationStatus)) {
    throw new Error(`${prefix}.presentationStatus 값이 지원되지 않습니다: ${initiative.presentationStatus}`);
  }
  if (initiative.presentationStatus === "ready") {
    requireString(initiative.presentationRef, `${prefix}.presentationRef`);
    assertPublicEvidencePath(initiative.presentationRef, `${prefix}.presentationRef`);
  } else if (initiative.presentationRef !== undefined && initiative.presentationRef !== null) {
    throw new Error(`${prefix}.presentationRef는 ready 상태에서만 사용할 수 있습니다.`);
  }
  if (!/^[a-f0-9]{40}$/.test(initiative.sourceRevision)) {
    throw new Error(`${prefix}.sourceRevision이 Git commit 형식이 아닙니다.`);
  }
  for (const field of ["policyRefs", "policyRelationships", "guidelineRefs", "guidelineRelationships", "legacyProjectRefs", "successSignals", "risks", "sourceRefs"]) {
    requireArray(initiative[field], `${prefix}.${field}`);
  }
  if (initiative.policyRefs.length === 0) {
    throw new Error(`${prefix}.policyRefs는 최소 한 개의 정책을 직접 연결해야 합니다.`);
  }
  if (initiative.sourceRefs.length === 0) {
    throw new Error(`${prefix}.sourceRefs는 최소 한 건의 근거를 포함해야 합니다.`);
  }
  if (initiative.successSignals.length === 0) {
    throw new Error(`${prefix}.successSignals는 최소 한 건의 결과 판정 기준을 포함해야 합니다.`);
  }
  for (const [sourceIndex, sourceRef] of initiative.sourceRefs.entries()) {
    const sourcePrefix = `${prefix}.sourceRefs[${sourceIndex}]`;
    assertAllowedKeys(sourceRef, new Set([
      "path", "heading", "lineStart", "lineEnd", "evidenceKind", "note", "capturedSha256", "capturedRepositoryRevision"
    ]), sourcePrefix);
    requireString(sourceRef.path, `${sourcePrefix}.path`);
    assertPublicEvidencePath(sourceRef.path, `${sourcePrefix}.path`);
    requireString(sourceRef.heading, `${sourcePrefix}.heading`);
    if (!/^[a-f0-9]{64}$/.test(sourceRef.capturedSha256 ?? "")) {
      throw new Error(`${sourcePrefix}.capturedSha256가 SHA-256 형식이 아닙니다.`);
    }
    if (sourceRef.capturedRepositoryRevision !== initiative.sourceRevision) {
      throw new Error(`${sourcePrefix}.capturedRepositoryRevision이 initiative sourceRevision과 일치하지 않습니다.`);
    }
    for (const field of ["lineStart", "lineEnd"]) {
      if (!Number.isInteger(sourceRef[field]) || sourceRef[field] < 1) {
        throw new Error(`${sourcePrefix}.${field}는 1 이상의 정수여야 합니다.`);
      }
    }
    if (sourceRef.lineEnd < sourceRef.lineStart) {
      throw new Error(`${sourcePrefix}.lineEnd는 lineStart 이상이어야 합니다.`);
    }
  }
  for (const [field, values] of [["policyRefs", initiative.policyRefs], ["guidelineRefs", initiative.guidelineRefs]]) {
    const seen = new Set();
    for (const [refIndex, ref] of values.entries()) {
      requireString(ref, `${prefix}.${field}[${refIndex}]`);
      if (seen.has(ref)) throw new Error(`${prefix}.${field}에 중복 ID가 있습니다: ${ref}`);
      seen.add(ref);
    }
  }
  const policyRelationshipIds = new Set();
  for (const [relationshipIndex, relationship] of initiative.policyRelationships.entries()) {
    const relationshipPrefix = `${prefix}.policyRelationships[${relationshipIndex}]`;
    assertAllowedKeys(relationship, new Set(["policyId", "relation", "rationale", "exceptionRef"]), relationshipPrefix);
    requireString(relationship.policyId, `${relationshipPrefix}.policyId`);
    requireString(relationship.relation, `${relationshipPrefix}.relation`);
    requireString(relationship.rationale, `${relationshipPrefix}.rationale`);
    if (!["advances", "constrained-by", "exception-to"].includes(relationship.relation)) {
      throw new Error(`${relationshipPrefix}.relation 값이 지원되지 않습니다.`);
    }
    if (!initiative.policyRefs.includes(relationship.policyId) || policyRelationshipIds.has(relationship.policyId)) {
      throw new Error(`${relationshipPrefix}.policyId가 policyRefs와 1:1로 일치하지 않습니다.`);
    }
    policyRelationshipIds.add(relationship.policyId);
    if (relationship.relation === "exception-to") {
      requireString(relationship.exceptionRef, `${relationshipPrefix}.exceptionRef`);
      assertPublicEvidencePath(relationship.exceptionRef, `${relationshipPrefix}.exceptionRef`);
    } else if (relationship.exceptionRef !== null) {
      throw new Error(`${relationshipPrefix}.exceptionRef는 exception-to 관계에서만 사용할 수 있습니다.`);
    }
  }
  if (policyRelationshipIds.size !== initiative.policyRefs.length) {
    throw new Error(`${prefix}.policyRelationships는 policyRefs와 정확히 1:1이어야 합니다.`);
  }
  const guidelineRelationshipIds = new Set();
  for (const [relationshipIndex, relationship] of initiative.guidelineRelationships.entries()) {
    const relationshipPrefix = `${prefix}.guidelineRelationships[${relationshipIndex}]`;
    assertAllowedKeys(relationship, new Set(["guidelineId", "adoption", "rationale", "verification"]), relationshipPrefix);
    requireString(relationship.guidelineId, `${relationshipPrefix}.guidelineId`);
    requireString(relationship.adoption, `${relationshipPrefix}.adoption`);
    requireString(relationship.rationale, `${relationshipPrefix}.rationale`);
    requireString(relationship.verification, `${relationshipPrefix}.verification`);
    if (!["required", "recommended"].includes(relationship.adoption)) {
      throw new Error(`${relationshipPrefix}.adoption 값이 지원되지 않습니다.`);
    }
    if (!initiative.guidelineRefs.includes(relationship.guidelineId) || guidelineRelationshipIds.has(relationship.guidelineId)) {
      throw new Error(`${relationshipPrefix}.guidelineId가 guidelineRefs와 1:1로 일치하지 않습니다.`);
    }
    guidelineRelationshipIds.add(relationship.guidelineId);
  }
  if (guidelineRelationshipIds.size !== initiative.guidelineRefs.length) {
    throw new Error(`${prefix}.guidelineRelationships는 guidelineRefs와 정확히 1:1이어야 합니다.`);
  }
  if (numbered) {
    requireString(initiative.documentRef, `${prefix}.documentRef`);
    assertPublicEvidencePath(initiative.documentRef, `${prefix}.documentRef`);
    if (!new RegExp(`^docs/initiatives/${initiative.id}-.+\\.md$`).test(initiative.documentRef)) {
      throw new Error(`${prefix}.documentRef는 해당 I####의 canonical 문서 경로여야 합니다.`);
    }
  } else if (initiative.documentRef !== null) {
    throw new Error(`${prefix} migration candidate의 documentRef는 null이어야 합니다.`);
  }
  if (migrationCandidate && (
    initiative.lifecycleState !== "draft"
    || initiative.approvalState === "approved"
    || initiative.effectiveRef !== null
    || initiative.decisionReceiptRef !== null
    || initiative.legacyProjectRefs.length === 0
  )) {
    throw new Error(`${prefix} INIT-* migration candidate는 draft이며 승인되지 않은 상태여야 합니다.`);
  }
  if (!["linked", "no_applicable_guideline", "needs_review"].includes(initiative.guidelineDisposition)) {
    throw new Error(`${prefix}.guidelineDisposition 값이 지원되지 않습니다.`);
  }
  if (initiative.guidelineDisposition === "linked" && initiative.guidelineRefs.length === 0) {
    throw new Error(`${prefix}.guidelineDisposition이 linked이면 guidelineRefs가 필요합니다.`);
  }
  if (initiative.guidelineDisposition === "no_applicable_guideline" && initiative.guidelineRefs.length > 0) {
    throw new Error(`${prefix}.guidelineDisposition이 no_applicable_guideline이면 guidelineRefs는 비어 있어야 합니다.`);
  }
  const governedLifecycle = ["active", "done"].includes(initiative.lifecycleState);
  if (governedLifecycle && initiative.approvalState !== "approved") {
    throw new Error(`${prefix}.${initiative.lifecycleState} lifecycle에는 approved 상태가 필요합니다.`);
  }
  if (initiative.approvalState === "approved" && (
    typeof initiative.effectiveRef !== "string" || initiative.effectiveRef.trim() === ""
    || typeof initiative.decisionReceiptRef !== "string" || initiative.decisionReceiptRef.trim() === ""
  )) {
    throw new Error(`${prefix} approved 상태에는 effectiveRef와 decisionReceiptRef가 필요합니다.`);
  }
  const legacyIds = new Set();
  for (const [legacyIndex, projectRef] of initiative.legacyProjectRefs.entries()) {
    const legacyPrefix = `${prefix}.legacyProjectRefs[${legacyIndex}]`;
    assertAllowedKeys(projectRef, new Set(["id", "path"]), legacyPrefix);
    requireString(projectRef.id, `${legacyPrefix}.id`);
    requireString(projectRef.path, `${legacyPrefix}.path`);
    if (!/^P[0-9]{4}$/.test(projectRef.id)) throw new Error(`${legacyPrefix}.id는 P#### 형식이어야 합니다.`);
    if (legacyIds.has(projectRef.id)) throw new Error(`${prefix}.legacyProjectRefs에 중복 project가 있습니다: ${projectRef.id}`);
    legacyIds.add(projectRef.id);
    assertPublicEvidencePath(projectRef.path, `${legacyPrefix}.path`);
  }
}

async function inspectInitiativeProjects(repoRoot, projectRoot, initiativeIds) {
  const resolved = await resolveInsideRoot(repoRoot, projectRoot);
  let rootStat;
  try {
    rootStat = await lstat(resolved);
  } catch (error) {
    if (error.code === "ENOENT") return { byInitiative: new Map(), orphaned: [], inputs: [] };
    throw error;
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`initiative project root는 symlink가 아닌 directory여야 합니다: ${projectRoot}`);
  }
  const canonical = await realpath(resolved);
  if (!pathIsInside(repoRoot, canonical)) throw new Error(`initiative project root가 저장소 경계를 벗어납니다: ${projectRoot}`);
  const entries = (await readdir(canonical, { withFileTypes: true }))
    .filter(({ name }) => /^P[0-9]{4}-.+\.md$/.test(name))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  const byInitiative = new Map();
  const orphaned = [];
  const inputs = [];
  for (const entry of entries) {
    if (!entry.isFile()) throw new Error(`initiative project entry는 regular Markdown file이어야 합니다: ${entry.name}`);
    const relativePath = `${projectRoot}/${entry.name}`;
    const input = await captureRepositoryFile(repoRoot, relativePath, "initiative project");
    if (input.state !== "file") throw new Error(`initiative project를 안전하게 읽을 수 없습니다: ${relativePath}`);
    inputs.push({ label: "initiative project", relativePath, fence: input.fence });
    const project = parseMarkdownFrontmatter(input, "initiative project");
    if (project.type !== "project" || !/^P[0-9]{4}$/.test(project.doc_id ?? "")) continue;
    const initiativeRef = project.related_initiative;
    if (!initiativeRef) {
      if (project.lineage_contract === "v2") {
        orphaned.push({ id: project.doc_id, path: relativePath, initiativeRef: null, reason: "missing_initiative" });
      }
      continue;
    }
    if (!/^I[0-9]{4}$/.test(initiativeRef) || !initiativeIds.has(initiativeRef)) {
      orphaned.push({ id: project.doc_id, path: relativePath, initiativeRef, reason: "unknown_initiative" });
      continue;
    }
    const relation = project.initiative_relation;
    if (!["delivers", "supports", "explores"].includes(relation)) {
      orphaned.push({ id: project.doc_id, path: relativePath, initiativeRef, reason: "missing_or_invalid_relation" });
      continue;
    }
    const linked = byInitiative.get(initiativeRef) ?? [];
    linked.push({
      id: project.doc_id,
      path: relativePath,
      relation,
      linkState: "confirmed",
      state: "current",
      title: project.title ?? project.doc_id,
      status: project.status ?? "unknown",
      currentFocus: project.current_focus ?? null,
      relatedInitiative: initiativeRef,
      lineageContract: project.lineage_contract ?? "legacy"
    });
    byInitiative.set(initiativeRef, linked);
  }
  return { byInitiative, orphaned, inputs };
}

async function inspectInitiatives(repoRoot, initiatives, policies, guidelines, projectRoot, documentInput, locale) {
  const policyIds = new Set(policies.map((item) => item.id));
  const guidelineIds = new Set(guidelines.map((item) => item.id));
  const policiesById = new Map(policies.map((item) => [item.id, item]));
  const guidelinesById = new Map(guidelines.map((item) => [item.id, item]));
  const initiativeIds = new Set();
  const approvalInputs = [];
  const stableInputs = [];
  const inspected = [];

  for (const [index, initiative] of initiatives.entries()) {
    validateInitiative(initiative, index);
    if (initiativeIds.has(initiative.id)) throw new Error(`initiative id가 중복됩니다: ${initiative.id}`);
    initiativeIds.add(initiative.id);
    for (const policyRef of initiative.policyRefs) {
      if (!policyIds.has(policyRef)) throw new Error(`${initiative.id}.policyRefs가 없는 policy를 참조합니다: ${policyRef}`);
    }
    for (const guidelineRef of initiative.guidelineRefs) {
      if (!guidelineIds.has(guidelineRef)) throw new Error(`${initiative.id}.guidelineRefs가 없는 guideline을 참조합니다: ${guidelineRef}`);
    }
    if (initiative.guidelineRefs.length > 0) {
      const linkedGuidelines = initiative.guidelineRefs.map((ref) => guidelines.find((item) => item.id === ref));
      if (!linkedGuidelines.every((guideline) => (guideline.policyRefs ?? []).some((ref) => initiative.policyRefs.includes(ref)))) {
        throw new Error(`${initiative.id}.guidelineRefs의 각 지침은 연결 policyRefs 중 하나를 구현해야 합니다.`);
      }
    }
    if (["active", "done"].includes(initiative.lifecycleState)) {
      for (const policyRef of initiative.policyRefs) {
        const policy = policiesById.get(policyRef);
        if (policy.authorityState !== "effective" || policy.approvalState !== "approved" || policy.evidenceState !== "current") {
          throw new Error(`${initiative.id} active/done 추진안은 current effective/approved policy만 사용할 수 있습니다: ${policyRef}`);
        }
      }
      if (initiative.guidelineDisposition === "needs_review") {
        throw new Error(`${initiative.id} active/done 추진안은 guidelineDisposition needs_review 상태일 수 없습니다.`);
      }
      for (const relationship of initiative.guidelineRelationships) {
        if (relationship.adoption !== "required") continue;
        const guideline = guidelinesById.get(relationship.guidelineId);
        if (guideline.authorityState !== "effective" || guideline.approvalState !== "approved" || guideline.evidenceState !== "current") {
          throw new Error(`${initiative.id} required guideline은 current effective/approved 상태여야 합니다: ${relationship.guidelineId}`);
        }
      }
      if (initiative.policyRelationships.some((relationship) => relationship.relation === "exception-to")) {
        throw new Error(`${initiative.id} exception-to 관계는 active exception receipt 검증 계약이 없으면 활성화할 수 없습니다.`);
      }
    }

    const sourceRefs = await Promise.all(initiative.sourceRefs.map((sourceRef) => {
      if (sourceRef.capturedRepositoryRevision !== initiative.sourceRevision) {
        throw new Error(`${initiative.id}.sourceRefs의 revision이 sourceRevision과 일치하지 않습니다.`);
      }
      return inspectSourceRef(repoRoot, sourceRef);
    }));
    const evidenceState = sourceRefs.some((ref) => ref.state === "missing" || ref.state === "invalid")
      ? "missing"
      : sourceRefs.some((ref) => ref.state === "changed")
        ? "stale"
        : "current";

    if (initiative.approvalState === "approved") {
      approvalInputs.push(...await verifyApprovedItemEvidence(
        repoRoot,
        initiative,
        evidenceState
      ));
    }
    const presentation = await inspectHumanPresentation({
      repoRoot,
      documentInput,
      subjectKind: "initiative",
      subjectId: initiative.id,
      displayTitle: initiative.title,
      humanSummary: initiative.humanSummary,
      declaredStatus: initiative.presentationStatus,
      receiptRef: initiative.presentationRef,
      locale
    });
    if (presentation.input) stableInputs.push(presentation.input);

    let documentState = "migration_candidate";
    if (initiative.documentRef) {
      const documentInput = await captureRepositoryFile(repoRoot, initiative.documentRef, `${initiative.id} initiative document`);
      if (documentInput.state !== "file") throw new Error(`${initiative.id}.documentRef를 읽을 수 없습니다: ${initiative.documentRef}`);
      const document = parseMarkdownFrontmatter(documentInput, `${initiative.id} initiative document`);
      if (document.type !== "initiative" || document.doc_id !== initiative.id || document.initiative_contract !== "v1") {
        throw new Error(`${initiative.id}.documentRef가 canonical initiative 문서를 가리키지 않습니다.`);
      }
      if (document.status !== initiative.lifecycleState
        || document.approval_status !== initiative.approvalState
        || document.guideline_disposition !== initiative.guidelineDisposition
        || document.guideline_disposition_reason !== initiative.guidelineDispositionReason) {
        throw new Error(`${initiative.id}.documentRef의 lifecycle/approval/guideline disposition이 register mirror와 일치하지 않습니다.`);
      }
      requireString(document.issuance_approval_ref, `${initiative.id}.documentRef issuance_approval_ref`);
      if (initiative.approvalState === "approved" && (
        initiative.effectiveRef !== initiative.documentRef
        || document.approval_ref !== initiative.decisionReceiptRef
      )) {
        throw new Error(`${initiative.id} approved 상태는 canonical document와 exact decision receipt를 함께 승인해야 합니다.`);
      }
      const documentPolicyRefs = [...(document.policy_refs ?? [])].sort();
      const documentGuidelineRefs = [...(document.guideline_refs ?? [])].sort();
      if (stableStringify(documentPolicyRefs) !== stableStringify([...initiative.policyRefs].sort())
        || stableStringify(documentGuidelineRefs) !== stableStringify([...initiative.guidelineRefs].sort())) {
        throw new Error(`${initiative.id}.documentRef의 policy/guideline refs가 register mirror와 일치하지 않습니다.`);
      }
      const policyRelationships = parseInitiativeRelationshipTable(documentInput, "## Policy Alignment", "policy", 1);
      const guidelineRelationships = parseInitiativeRelationshipTable(documentInput, "## Guideline Disposition", "guideline", 0);
      if (stableStringify(sortedRelationships(policyRelationships, "policyId"))
          !== stableStringify(sortedRelationships(initiative.policyRelationships, "policyId"))
        || stableStringify(sortedRelationships(guidelineRelationships, "guidelineId"))
          !== stableStringify(sortedRelationships(initiative.guidelineRelationships, "guidelineId"))) {
        throw new Error(`${initiative.id}.documentRef의 관계 표가 register relationship mirror와 일치하지 않습니다.`);
      }
      stableInputs.push({ label: "initiative document", relativePath: initiative.documentRef, fence: documentInput.fence });
      documentState = document.status ?? "draft";
    }
    const legacyProjects = [];
    for (const legacyRef of initiative.legacyProjectRefs) {
      const projectInput = await captureRepositoryFile(repoRoot, legacyRef.path, `${initiative.id} legacy project ref`);
      if (projectInput.state !== "file") throw new Error(`${initiative.id} legacy project를 읽을 수 없습니다: ${legacyRef.path}`);
      stableInputs.push({ label: "initiative legacy project", relativePath: legacyRef.path, fence: projectInput.fence });
      const project = parseMarkdownFrontmatter(projectInput, `${initiative.id} legacy project`);
      if (project.type !== "project" || project.doc_id !== legacyRef.id) {
        throw new Error(`${initiative.id} legacyProjectRefs가 해당 Project를 가리키지 않습니다: ${legacyRef.path}`);
      }
      legacyProjects.push({
        id: project.doc_id,
        path: legacyRef.path,
        relation: "migration_candidate",
        linkState: "legacy_candidate",
        state: "current",
        title: project.title ?? project.doc_id,
        status: project.status ?? "unknown",
        currentFocus: project.current_focus ?? null,
        relatedInitiative: null,
        lineageContract: "legacy"
      });
    }
    inspected.push({
      ...initiative,
      sourceRefs,
      evidenceState,
      documentState,
      projects: legacyProjects,
      presentationStatus: presentation.presentationStatus,
      presentationRef: presentation.presentationRef,
      presentationError: presentation.presentationError,
      presentationReviewedBy: presentation.presentationReviewedBy,
      presentationReviewedAt: presentation.presentationReviewedAt,
      visibleOnBoard: presentation.visibleOnBoard
    });
  }
  const projectInspection = await inspectInitiativeProjects(repoRoot, projectRoot, initiativeIds);
  stableInputs.push(...projectInspection.inputs);
  return {
    items: inspected.map((initiative) => ({
      ...initiative,
      projects: [...new Map([
        ...initiative.projects,
        ...(projectInspection.byInitiative.get(initiative.id) ?? [])
      ].map((project) => [project.id, project])).values()]
    })),
    approvalInputs,
    stableInputs,
    orphanedProjects: projectInspection.orphaned
  };
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

async function inspectMigrationFence(repoRoot, migration, currentRepository, catalogInput) {
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
      const receiptInput = await captureRepositoryFile(repoRoot, migration.receiptRef, "migration review receipt");
      Object.defineProperty(result, "receiptInput", {
        value: {
          label: "migration review receipt",
          relativePath: migration.receiptRef,
          fence: receiptInput.fence
        },
        enumerable: false
      });
      const receipt = parseCapturedJson(receiptInput, "migration review receipt");
      assertHumanDecisionReceipt(receipt, {
        id: "CATALOG-REVIEW",
        effectiveRef: catalogInput.relativePath,
        sourceRefs: [{ capturedSha256: catalogInput.digest }]
      }, result.resolvedBaseCommit, catalogInput.digest);
      result.receiptState = "matched";
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

function parseCheckpointScalar(raw, label) {
  const value = raw.trim();
  if (value === "") return null;
  if (value === "[]") return [];
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`${label} double-quoted scalar가 올바르지 않습니다.`);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (/^[0-9]+$/.test(value)) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) ? numeric : value;
  }
  if (value === "null" || value === "~") return null;
  return value;
}

function parseMarkdownFrontmatter(captured, label) {
  const lines = captured.bytes.toString("utf8").split(/\r?\n/);
  if (lines[0] !== "---") {
    throw new Error(`${label}에 YAML frontmatter가 없습니다: ${captured.relativePath}`);
  }
  const end = lines.indexOf("---", 1);
  if (end < 2) {
    throw new Error(`${label} frontmatter가 닫히지 않았습니다: ${captured.relativePath}`);
  }
  const values = {};
  let parent = null;
  for (const line of lines.slice(1, end)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const listItem = line.match(/^ {2}-\s*(.+)$/);
    if (listItem && parent) {
      if (values[parent] === null) values[parent] = [];
      if (!Array.isArray(values[parent])) {
        throw new Error(`${captured.relativePath}#${parent}가 list와 scalar를 함께 사용합니다.`);
      }
      values[parent].push(parseCheckpointScalar(listItem[1], `${captured.relativePath}#${parent}`));
      continue;
    }
    const match = line.match(/^(\s*)([A-Za-z0-9_]+):(.*)$/);
    if (!match) continue;
    const [, indentation, key, rawValue] = match;
    if (indentation.length === 0) {
      const value = parseCheckpointScalar(rawValue, `${captured.relativePath}#${key}`);
      values[key] = value;
      parent = value === null ? key : null;
    } else if (indentation.length === 2 && parent) {
      if (values[parent] === null) values[parent] = {};
      if (!values[parent] || Array.isArray(values[parent]) || typeof values[parent] !== "object") {
        throw new Error(`${captured.relativePath}#${parent}가 mapping과 scalar를 함께 사용합니다.`);
      }
      values[parent][key] = parseCheckpointScalar(rawValue, `${captured.relativePath}#${parent}.${key}`);
    }
  }
  return values;
}

function markdownSectionLines(captured, heading) {
  const lines = captured.bytes.toString("utf8").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return [];
  const section = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    section.push(line);
  }
  return section;
}

function markdownHeadingSectionLines(captured, heading) {
  const lines = captured.bytes.toString("utf8").split(/\r?\n/);
  const headingPattern = new RegExp(`^(#{2,6})\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start < 0) return [];
  const level = lines[start].trim().match(/^#+/)[0].length;
  const section = [];
  for (const line of lines.slice(start + 1)) {
    const next = line.match(/^(#{2,6})\s+/);
    if (next && next[1].length <= level) break;
    section.push(line);
  }
  return section;
}

function markdownSectionBullets(captured, heading) {
  const bullets = [];
  for (const sourceLine of markdownSectionLines(captured, heading)) {
    const line = sourceLine.trim();
    if (line.startsWith("- ")) {
      const value = line.slice(2).trim();
      if (value) bullets.push(value);
      continue;
    }
    if (line && bullets.length > 0 && !line.startsWith("|") && !/^#{1,6}\s/.test(line)) {
      bullets[bullets.length - 1] = `${bullets.at(-1)} ${line}`;
    }
  }
  return bullets;
}

function markdownSectionNarrative(captured, heading) {
  const paragraphs = [];
  let current = [];
  for (const sourceLine of markdownSectionLines(captured, heading)) {
    const line = sourceLine.trim();
    if (!line) {
      if (current.length > 0) paragraphs.push(current.join(" "));
      current = [];
      continue;
    }
    if (line.startsWith("|") || line.startsWith("- ") || /^#{1,6}\s/.test(line)) continue;
    current.push(line);
  }
  if (current.length > 0) paragraphs.push(current.join(" "));
  return paragraphs.join("\n\n") || null;
}

function markdownSectionLabels(captured, heading) {
  return Object.fromEntries(markdownSectionBullets(captured, heading).flatMap((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) return [];
    return [[line.slice(0, separator).trim(), line.slice(separator + 1).trim()]];
  }));
}

function markdownTableRows(captured, heading) {
  const rows = markdownSectionLines(captured, heading)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));
  if (rows.length < 3) return [];
  return rows.slice(2).map((line) => line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim().replaceAll("`", "")));
}

function markdownHeadingTableRows(captured, heading) {
  const rows = markdownHeadingSectionLines(captured, heading)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));
  if (rows.length < 3) return [];
  return rows.slice(2).map((line) => line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim().replaceAll("`", "")));
}

function trackedSectionItems(captured, heading, idPrefix) {
  const fromBullets = markdownSectionBullets(captured, heading).flatMap((line) => {
    const match = line.match(new RegExp(`^\\\`?(${idPrefix}-[A-Z0-9-]+)\\\`?\\s*:\\s*(.+)$`));
    return match ? [{ id: match[1], text: match[2] }] : [];
  });
  if (fromBullets.length > 0) return fromBullets;
  return markdownTableRows(captured, heading).flatMap((cells) =>
    String(cells[0] ?? "").startsWith(`${idPrefix}-`) && cells[1]
      ? [{ id: cells[0], text: cells[1] }]
      : []
  );
}

function domainTerms(model, language) {
  const rows = language
    ? markdownTableRows(language.captured, "Terms")
    : markdownTableRows(model, "Ubiquitous Language");
  return rows.map((cells) => ({
    id: cells[0] ?? null,
    term: cells[1] ?? null,
    meaning: cells[2] ?? null,
    examples: cells[3] ?? null,
    counterexamples: cells.length >= 7 ? cells[4] ?? null : null,
    avoid: cells.length >= 7 ? cells[5] ?? null : cells[4] ?? null,
    source: cells.length >= 7 ? cells[6] ?? null : cells[5] ?? null
  }));
}

function domainScenarios(model, examples) {
  if (examples) {
    return markdownTableRows(examples.captured, "Business Examples").map((cells) => ({
      id: cells[0] ?? null,
      kind: cells[1] ?? null,
      actorGoal: cells[2] ?? null,
      given: cells[3] ?? null,
      request: cells[4] ?? null,
      outcome: cells[5] ?? null,
      rejectionReason: cells.length >= 8 ? cells[6] ?? null : null,
      trace: cells.length >= 8 ? cells[7] ?? null : cells[6] ?? null
    }));
  }
  return markdownTableRows(model, "Domain Scenarios").map((cells) => ({
    id: cells[0] ?? null,
    kind: null,
    actorGoal: cells[1] ?? null,
    given: cells[2] ?? null,
    request: cells[3] ?? null,
    outcome: cells[4] ?? null,
    rejectionReason: null,
    trace: cells[5] ?? null
  }));
}

function domainStateTransitions(captured) {
  return markdownTableRows(captured, "State Transitions").map((cells) => ({
    model: cells.length >= 7 ? cells[0] ?? null : null,
    current: cells.length >= 7 ? cells[1] ?? null : cells[0] ?? null,
    command: cells.length >= 7 ? cells[2] ?? null : cells[1] ?? null,
    guard: cells.length >= 7 ? cells[3] ?? null : null,
    next: cells.length >= 7 ? cells[4] ?? null : cells[2] ?? null,
    event: cells.length >= 7 ? cells[5] ?? null : cells[3] ?? null,
    rejection: cells.length >= 7 ? cells[6] ?? null : null
  }));
}

function domainRoleContracts(captured) {
  return markdownTableRows(captured, "Role Consumer Contract").map((cells) => ({
    role: cells[0] ?? null,
    decision: cells[1] ?? null
  }));
}

function domainModelCounts(captured) {
  const ids = captured.bytes.toString("utf8").match(/\b(?:TERM|AGG|ENT|VO|CMD|EVT|POL|BR|SCN)-[A-Z0-9-]+\b/g) ?? [];
  const unique = [...new Set(ids)];
  const count = (prefix) => unique.filter((id) => id.startsWith(`${prefix}-`)).length;
  return {
    terms: count("TERM"),
    aggregates: count("AGG"),
    entities: count("ENT"),
    valueObjects: count("VO"),
    commands: count("CMD"),
    events: count("EVT"),
    policies: count("POL"),
    rules: count("BR"),
    scenarios: count("SCN")
  };
}

function domainBoardModel(level, values) {
  switch (level) {
    case "bounded-context":
      return {
        columns: ["판단할 경계", "도메인 모델"],
        rows: [
          ["이 영역의 책임", values.responsibility],
          ["이 영역 밖의 책임", values.outOfScope],
          ...(values.boundaries ?? []).map((item) => ["경계", item]),
          ...(values.integrations ?? []).map((item) => ["다른 영역과의 관계", item])
        ].filter((row) => row[1])
      };
    case "aggregate":
      return {
        columns: ["Aggregate", "책임", "불변 조건", "일관성 경계", "추적 ID"],
        rows: markdownHeadingTableRows(values.captured, "Aggregates").map((cells) => [cells[1], cells[2], cells[3], cells[6], cells[0]])
      };
    case "entity":
      return {
        columns: ["Entity", "식별 기준", "수명주기", "소유 Aggregate", "추적 ID"],
        rows: markdownHeadingTableRows(values.captured, "Entities").map((cells) => [cells[1], cells[2], cells[3], cells[4], cells[0]])
      };
    case "value-object":
      return {
        columns: ["Value Object", "업무 의미", "유효성 / 불변성", "사용 위치", "추적 ID"],
        rows: markdownHeadingTableRows(values.captured, "Value Objects").map((cells) => [cells[1], cells[2], cells[3], cells[4], cells[0]])
      };
    case "business-rule":
      return {
        columns: ["업무 규칙", "업무 의미"],
        rows: (values.businessRules ?? []).map((item) => [item.id, item.text])
      };
    case "state-transition":
      return {
        columns: ["대상", "현재 상태", "요청", "조건", "다음 상태", "기록", "거절"],
        rows: (values.stateTransitions ?? []).map((item) => [item.model, item.current, item.command, item.guard, item.next, item.event, item.rejection])
      };
    case "ubiquitous-language":
      return {
        columns: ["용어", "이 영역에서의 뜻", "올바른 예", "잘못된 예 / 피할 말", "추적 ID"],
        rows: (values.terms ?? []).map((item) => [item.term, item.meaning, item.examples, [item.counterexamples, item.avoid].filter(Boolean).join(" / "), item.id])
      };
    case "scenario":
      return {
        columns: ["누가 / 원하는 결과", "상황", "요청", "결과", "거절 이유", "추적 ID"],
        rows: (values.scenarios ?? []).map((item) => [item.actorGoal, item.given, item.request, item.outcome, item.rejectionReason, item.id])
      };
    default:
      return { columns: [], rows: [] };
  }
}

async function inspectDomainDesignApproval(repoRoot, captured, design) {
  const authorityValidation = ["approved", "ai-validated"].includes(design.validation_status);
  if (design.status !== "current" && !authorityValidation) {
    return {
      state: design.validation_status ?? design.status ?? "review_requested",
      receiptRef: design.validation_ref ?? null,
      decidedBy: null,
      decidedAt: null,
      actorKind: null,
      authorityMode: design.authority_mode ?? null,
      input: null
    };
  }
  if (design.status !== "current" || !authorityValidation
    || typeof design.validation_ref !== "string" || design.validation_ref.trim() === "") {
    return {
      state: "invalid",
      receiptRef: design.validation_ref ?? null,
      decidedBy: null,
      decidedAt: null,
      actorKind: null,
      authorityMode: design.authority_mode ?? null,
      error: "current domain design metadata, approved|ai-validated state, and validation_ref must be present",
      input: null
    };
  }

  const receiptInput = await captureRepositoryFile(repoRoot, design.validation_ref, "domain design approval receipt");
  if (receiptInput.state !== "file") {
    return {
      state: "invalid",
      receiptRef: design.validation_ref,
      decidedBy: null,
      decidedAt: null,
      actorKind: null,
      authorityMode: design.authority_mode ?? null,
      error: `approval receipt is not a safe repository file: ${design.validation_ref}`,
      input: null
    };
  }
  try {
    const receipt = parseCapturedJson(receiptInput, "domain design approval receipt");
    const valid = [1, 2].includes(receipt.schemaVersion)
      && receipt.kind === "domain-design-approval"
      && receipt.decision === "approved"
      && receipt.documentRef === captured.relativePath
      && receipt.documentSha256 === captured.digest
      && receipt.modelRevision === design.model_revision
      && receipt.boundedContext === design.bounded_context
      && ["human", "ai-agent"].includes(receipt.decidedBy?.actorKind)
      && typeof receipt.decidedBy?.identifier === "string"
      && receipt.decidedBy.identifier.trim() !== ""
      && !Number.isNaN(Date.parse(receipt.decidedAt ?? ""));
    if (!valid) throw new Error("receipt does not approve the current model bytes and identity");
    let state = "approved_current";
    let authorityMode = "human-confirmed";
    let delegationInput = null;
    if (receipt.schemaVersion === 1) {
      if (receipt.decidedBy.actorKind !== "human") throw new Error("legacy receipt requires a human actor");
    } else {
      const levels = new Set(["bounded-context", "aggregate", "entity", "value-object", "business-rule", "state-transition", "ubiquitous-language", "scenario"]);
      if (!levels.has(receipt.modelingLevel) || receipt.modelingLevel !== design.board_review_level) {
        throw new Error("receipt modeling level does not match the Board review level");
      }
      if (receipt.authorityMode !== design.authority_mode || receipt.decisionTier !== design.decision_tier
        || !Array.isArray(receipt.evidenceRefs) || receipt.evidenceRefs.length === 0
        || typeof receipt.challengeSummary !== "string" || receipt.challengeSummary.trim() === "") {
        throw new Error("receipt authority, evidence, or challenge does not match the model");
      }
      authorityMode = receipt.authorityMode;
      if (receipt.decidedBy.actorKind === "human") {
        if (authorityMode !== "human-confirmed" || design.validation_status !== "approved" || design.board_review_status !== "confirmed") {
          throw new Error("human-confirmed authority does not match model/Board state");
        }
      } else {
        if (authorityMode !== "delegated-ai" || receipt.decisionTier !== "routine"
          || design.validation_status !== "ai-validated" || design.board_review_status !== "not_required") {
          throw new Error("delegated AI authority is limited to routine ai-validated models without Board review");
        }
        const delegation = await captureRepositoryFile(repoRoot, receipt.delegatedAuthorityRef, "domain authority delegation receipt");
        if (delegation.state !== "file" || delegation.digest !== receipt.delegationSha256) {
          throw new Error("delegated authority receipt is missing, unsafe, or stale");
        }
        const delegationReceipt = parseCapturedJson(delegation, "domain authority delegation receipt");
        const delegated = delegationReceipt.schemaVersion === 1
          && delegationReceipt.kind === "domain-authority-delegation"
          && delegationReceipt.decision === "approved"
          && delegationReceipt.allowedDecisionTier === "routine"
          && delegationReceipt.decidedBy?.actorKind === "human"
          && typeof delegationReceipt.decidedBy?.identifier === "string"
          && delegationReceipt.decidedBy.identifier.trim() !== ""
          && !Number.isNaN(Date.parse(delegationReceipt.decidedAt ?? ""));
        if (!delegated) throw new Error("delegated authority is not a human-approved routine fence");
        delegationInput = {
          label: "domain authority delegation receipt",
          relativePath: delegation.relativePath,
          fence: delegation.fence
        };
        state = "ai_current";
      }
    }
    return {
      state,
      receiptRef: design.validation_ref,
      decidedBy: receipt.decidedBy.identifier,
      decidedAt: receipt.decidedAt,
      actorKind: receipt.decidedBy.actorKind,
      authorityMode,
      decisionTier: receipt.decisionTier ?? design.decision_tier ?? null,
      delegationInput,
      input: {
        label: "domain design approval receipt",
        relativePath: receiptInput.relativePath,
        fence: receiptInput.fence
      }
    };
  } catch (error) {
    return {
      state: "invalid",
      receiptRef: design.validation_ref,
      decidedBy: null,
      decidedAt: null,
      actorKind: null,
      authorityMode: design.authority_mode ?? null,
      error: error.message,
      input: {
        label: "domain design approval receipt",
        relativePath: receiptInput.relativePath,
        fence: receiptInput.fence
      }
    };
  }
}

async function readDomainDesign(repoRoot, domainRoot, locale) {
  const resolved = await resolveInsideRoot(repoRoot, domainRoot);
  let rootStat;
  try {
    rootStat = await lstat(resolved);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        domain: {
          configured: false,
          status: "not_configured",
          sourceRoot: domainRoot,
          sourceContract: "docs-design-only",
          discoveryRefs: [],
          landscape: null,
          contextMap: null,
          relationships: [],
          contexts: []
        },
        inputs: []
      };
    }
    throw error;
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    return {
      domain: {
        configured: true,
        status: "degraded",
        sourceRoot: domainRoot,
        sourceContract: "docs-design-only",
        discoveryRefs: [],
        error: `domain design root must be a non-symlink directory: ${domainRoot}`,
        landscape: null,
        contextMap: null,
        relationships: [],
        contexts: []
      },
      inputs: []
    };
  }

  try {
    const rootRealPath = await realpath(resolved);
    if (!pathIsInside(repoRoot, rootRealPath)) throw new Error(`domain design root escapes repository: ${domainRoot}`);
    const capturedDocs = [];
    const topEntries = (await readdir(rootRealPath, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of topEntries) {
      if (entry.isSymbolicLink()) throw new Error(`domain design entry cannot be a symlink: ${domainRoot}/${entry.name}`);
      if (entry.isFile() && ["domain-landscape.md", "context-map.md"].includes(entry.name)) {
        const relativePath = `${domainRoot}/${entry.name}`;
        const captured = await captureRepositoryFile(repoRoot, relativePath, "domain design");
        if (captured.state !== "file") throw new Error(`domain design is not a safe repository file: ${relativePath}`);
        capturedDocs.push(captured);
      }
    }

    const contextsRoot = `${domainRoot}/contexts`;
    const contextsResolved = await resolveInsideRoot(repoRoot, contextsRoot);
    let contextsStat = null;
    try {
      contextsStat = await lstat(contextsResolved);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (contextsStat) {
      if (contextsStat.isSymbolicLink() || !contextsStat.isDirectory()) {
        throw new Error(`domain contexts root must be a non-symlink directory: ${contextsRoot}`);
      }
      const contextEntries = (await readdir(contextsResolved, { withFileTypes: true }))
        .sort((left, right) => left.name.localeCompare(right.name, "en"));
      for (const contextEntry of contextEntries) {
        if (contextEntry.isSymbolicLink() || !contextEntry.isDirectory()) {
          throw new Error(`domain context entry must be a direct non-symlink directory: ${contextsRoot}/${contextEntry.name}`);
        }
        const contextRelativeRoot = `${contextsRoot}/${contextEntry.name}`;
        const contextRealRoot = await realpath(path.join(repoRoot, contextRelativeRoot));
        if (!pathIsInside(repoRoot, contextRealRoot)) throw new Error(`domain context escapes repository: ${contextRelativeRoot}`);
        const documentEntries = (await readdir(contextRealRoot, { withFileTypes: true }))
          .sort((left, right) => left.name.localeCompare(right.name, "en"));
        for (const documentEntry of documentEntries) {
          if (documentEntry.isSymbolicLink() || documentEntry.isDirectory()) {
            throw new Error(`domain context document must be a direct non-symlink file: ${contextRelativeRoot}/${documentEntry.name}`);
          }
          if (!documentEntry.isFile() || !documentEntry.name.endsWith(".md") || documentEntry.name === "README.md") continue;
          const relativePath = `${contextRelativeRoot}/${documentEntry.name}`;
          const captured = await captureRepositoryFile(repoRoot, relativePath, "domain context document");
          if (captured.state !== "file") throw new Error(`domain context document is not a safe repository file: ${relativePath}`);
          capturedDocs.push(captured);
        }
      }
    }

    const parsed = capturedDocs.map((captured) => ({
      captured,
      design: parseMarkdownFrontmatter(captured, "domain design")
    }));
    for (const { captured, design } of parsed) {
      if (design.type !== "design") throw new Error(`non-design document found under DDD root: ${captured.relativePath}`);
    }
    const landscapeEntry = parsed.find(({ design }) => design.design_kind === "domain-landscape") ?? null;
    const contextMapEntry = parsed.find(({ design }) => design.design_kind === "context-map") ?? null;
    const modelEntries = parsed.filter(({ design }) => design.design_kind === "bounded-context");
    const discoveryOnly = modelEntries.length === 0 && parsed.some(({ captured, design }) => (
      design.bounded_context_id === "DOMAIN-REPOSITORY"
      || design.bounded_context_id === "CONTEXT-MAP-REPOSITORY"
      || captured.bytes.toString("utf8").includes("BC-DISCOVERY")
    ));
    if (capturedDocs.length === 0 || discoveryOnly) {
      return {
        domain: {
          configured: false,
          status: "not_configured",
          sourceRoot: domainRoot,
          sourceContract: "docs-design-only",
          discoveryRefs: capturedDocs.map((captured) => captured.relativePath),
          landscape: null,
          contextMap: null,
          relationships: [],
          contexts: []
        },
        inputs: capturedDocs.map((captured) => ({
          label: "domain design discovery placeholder",
          relativePath: captured.relativePath,
          fence: captured.fence
        }))
      };
    }
    const approvalInputs = [];
    const presentationInputs = [];
    const contexts = [];
    for (const { captured, design } of modelEntries) {
      const approval = await inspectDomainDesignApproval(repoRoot, captured, design);
      if (approval.input) approvalInputs.push(approval.input);
      if (approval.delegationInput) approvalInputs.push(approval.delegationInput);
      const contextRoot = path.posix.dirname(captured.relativePath);
      const language = parsed.find(({ captured: item, design: itemDesign }) =>
        path.posix.dirname(item.relativePath) === contextRoot && itemDesign.design_kind === "ubiquitous-language"
      );
      const examples = parsed.find(({ captured: item, design: itemDesign }) =>
        path.posix.dirname(item.relativePath) === contextRoot && itemDesign.design_kind === "domain-examples"
      );
      const presentationEntry = [
        { captured, design },
        examples,
        language
      ].find((entry) => entry && (
        entry.design.presentation_status
        || entry.design.display_title
        || entry.design.human_summary
      )) ?? { captured, design };
      const presentation = await inspectHumanPresentation({
        repoRoot,
        documentInput: presentationEntry.captured,
        subjectKind: presentationEntry.design.design_kind,
        subjectId: design.bounded_context_id,
        displayTitle: presentationEntry.design.display_title,
        humanSummary: presentationEntry.design.human_summary,
        declaredStatus: presentationEntry.design.presentation_status,
        receiptRef: presentationEntry.design.presentation_ref,
        locale
      });
      if (presentation.input) presentationInputs.push(presentation.input);
      const humanReview = markdownSectionLabels(captured, "Human Review Summary");
      const boardReview = markdownSectionLabels(captured, "AI Domain Expert Board Review");
      const boundaries = markdownSectionBullets(captured, "Bounded Context Boundary");
      const failureSemantics = markdownSectionBullets(captured, "Failure And Exception Semantics");
      const openQuestions = markdownSectionBullets(captured, "Unknowns And Disputes");
      const withoutPrefix = (value, prefix) => value?.startsWith(prefix)
        ? value.slice(prefix.length).trim()
        : value ?? null;
      const responsibility = humanReview["이 영역의 책임"]
        ?? withoutPrefix(boundaries.find((item) => item.startsWith("포함:")), "포함:");
      const outOfScope = humanReview["포함하지 않는 것"]
        ?? withoutPrefix(boundaries.find((item) => item.startsWith("제외:")), "제외:");
      const terms = domainTerms(captured, language);
      const businessRules = trackedSectionItems(captured, "Business Rules And Invariants", "BR");
      const scenarios = domainScenarios(captured, examples);
      const stateTransitions = domainStateTransitions(captured);
      const integrations = markdownSectionBullets(captured, "Context Relationships And Integration");
      const boardReviewLevel = design.board_review_level ?? null;
      const boardModel = boardReviewLevel ? domainBoardModel(boardReviewLevel, {
        captured,
        responsibility,
        outOfScope,
        boundaries,
        integrations,
        terms,
        businessRules,
        scenarios,
        stateTransitions
      }) : { columns: [], rows: [] };
      const boardReviewShape = {
        recommendation: boardReview["권고 결정"] ?? null,
        level: boardReview["선택한 모델링 수준"] ?? boardReviewLevel,
        levelReason: boardReview["이 수준을 선택한 이유"] ?? null,
        humanDecision: boardReview["사람이 확인할 핵심"] ?? null,
        protectedOutcome: boardReview["승인하면 보호되는 결과"] ?? null,
        counterCondition: boardReview["반대하거나 수정해야 하는 조건"] ?? null
      };
      const declaredBoardReviewStatus = design.board_review_status ?? null;
      const boardReviewRequired = ["review_requested", "confirmed"].includes(declaredBoardReviewStatus);
      const boardReviewComplete = !boardReviewRequired || (
        boardReviewLevel
        && boardReviewShape.level === boardReviewLevel
        && Object.values(boardReviewShape).every((value) => typeof value === "string" && value.trim() !== "")
        && boardModel.rows.length > 0
      );
      const boardReviewStatus = boardReviewComplete ? declaredBoardReviewStatus : "invalid";
      contexts.push({
        id: design.bounded_context_id,
        name: design.bounded_context,
        title: design.title,
        displayTitle: presentation.displayTitle,
        humanSummary: presentation.humanSummary,
        presentationStatus: presentation.presentationStatus,
        presentationRef: presentation.presentationRef,
        presentationError: presentation.presentationError,
        presentationReviewedBy: presentation.presentationReviewedBy,
        presentationReviewedAt: presentation.presentationReviewedAt,
        visibleOnBoard: presentation.visibleOnBoard,
        responsibility,
        outOfScope,
        userVisibleFailure: humanReview["사용자에게 보이는 실패"] ?? failureSemantics[0] ?? null,
        pendingDecision: humanReview["아직 결정할 것"] ?? openQuestions[0] ?? null,
        purpose: markdownSectionNarrative(captured, "Domain Purpose And Customer Outcome"),
        boundaries,
        terms,
        businessRules,
        scenarios,
        counterexamples: examples ? markdownSectionBullets(examples.captured, "Counterexamples") : [],
        stateTransitions,
        integrations,
        failureSemantics,
        roleContracts: domainRoleContracts(captured),
        decisions: markdownSectionBullets(captured, "Decisions"),
        subdomainType: design.subdomain_type,
        owner: design.owner ?? null,
        status: design.status,
        modelRevision: design.model_revision,
        validationStatus: approval.state,
        validationRef: approval.receiptRef,
        validatedBy: approval.decidedBy,
        validatedAt: approval.decidedAt,
        validatedActorKind: approval.actorKind,
        validationError: approval.error ?? null,
        domainExpertAgent: design.domain_expert_agent ?? null,
        authorityMode: approval.authorityMode ?? design.authority_mode ?? null,
        decisionTier: approval.decisionTier ?? design.decision_tier ?? null,
        boardReviewLevel,
        boardReviewStatus,
        boardDecisionRef: design.board_decision_ref ?? null,
        boardReviewError: boardReviewComplete ? null : "AI Domain Expert Board review package is incomplete or its selected model slice is empty",
        boardReview: boardReviewShape,
        boardModel,
        domainExpertRoles: Array.isArray(design.domain_expert_roles) ? design.domain_expert_roles : [],
        roleViews: Array.isArray(design.role_views) ? design.role_views : [],
        openQuestions,
        counts: domainModelCounts(captured),
        modelRef: captured.relativePath,
        languageRef: language?.captured.relativePath ?? null,
        examplesRef: examples?.captured.relativePath ?? null,
        sourceSha256: captured.digest
      });
    }
    contexts.sort((left, right) => String(left.id).localeCompare(String(right.id), "en"));
    const landscapePresentation = landscapeEntry ? await inspectHumanPresentation({
      repoRoot,
      documentInput: landscapeEntry.captured,
      subjectKind: landscapeEntry.design.design_kind,
      subjectId: landscapeEntry.design.bounded_context_id,
      displayTitle: landscapeEntry.design.display_title,
      humanSummary: landscapeEntry.design.human_summary,
      declaredStatus: landscapeEntry.design.presentation_status,
      receiptRef: landscapeEntry.design.presentation_ref,
      locale
    }) : null;
    if (landscapePresentation?.input) presentationInputs.push(landscapePresentation.input);
    const contextMapPresentation = contextMapEntry ? await inspectHumanPresentation({
      repoRoot,
      documentInput: contextMapEntry.captured,
      subjectKind: contextMapEntry.design.design_kind,
      subjectId: contextMapEntry.design.bounded_context_id,
      displayTitle: contextMapEntry.design.display_title,
      humanSummary: contextMapEntry.design.human_summary,
      declaredStatus: contextMapEntry.design.presentation_status,
      receiptRef: contextMapEntry.design.presentation_ref,
      locale
    }) : null;
    if (contextMapPresentation?.input) presentationInputs.push(contextMapPresentation.input);
    const contextTitleById = new Map(contexts
      .filter((context) => context.visibleOnBoard)
      .map((context) => [context.id, context.displayTitle]));
    const relationships = contextMapEntry
      ? markdownTableRows(contextMapEntry.captured, "Context Relationships").map((cells) => {
          const humanShape = cells.length >= 7;
          const humanMeaning = humanShape ? cells[2] : null;
          const failureOwner = humanShape ? cells[3] : cells[5] ?? null;
          return {
            upstream: cells[0] ?? null,
            downstream: cells[1] ?? null,
            upstreamDisplayTitle: contextTitleById.get(cells[0]) ?? null,
            downstreamDisplayTitle: contextTitleById.get(cells[1]) ?? null,
            humanMeaning,
            failureOwner,
            pattern: humanShape ? cells[4] : cells[2] ?? null,
            contract: humanShape ? cells[5] : cells[3] ?? null,
            consistency: humanShape ? cells[6] : cells[4] ?? null,
            visibleOnBoard: Boolean(
              contextMapPresentation?.visibleOnBoard
              && typeof humanMeaning === "string"
              && humanMeaning.trim().length >= 12
            )
          };
        })
      : [];
    const currentAuthorityStates = new Set(["approved_current", "ai_current"]);
    const reviewCount = contexts.length === 0
      ? 1
      : contexts.filter((item) => !currentAuthorityStates.has(item.validationStatus)).length;
    const invalidCount = contexts.filter((item) => item.validationStatus === "invalid" || item.boardReviewStatus === "invalid").length;
    return {
      domain: {
        configured: true,
        status: invalidCount > 0 ? "degraded" : reviewCount > 0 ? "review_requested" : "current",
        sourceRoot: domainRoot,
        sourceContract: "docs-design-only",
        discoveryRefs: [],
        landscape: landscapeEntry ? {
          title: landscapeEntry.design.title,
          displayTitle: landscapePresentation.displayTitle,
          humanSummary: landscapePresentation.humanSummary,
          presentationStatus: landscapePresentation.presentationStatus,
          presentationRef: landscapePresentation.presentationRef,
          presentationError: landscapePresentation.presentationError,
          visibleOnBoard: landscapePresentation.visibleOnBoard,
          status: landscapeEntry.design.status,
          modelRevision: landscapeEntry.design.model_revision,
          source: landscapeEntry.captured.relativePath,
          openQuestions: markdownSectionBullets(landscapeEntry.captured, "Unknowns And Disputes")
        } : null,
        contextMap: contextMapEntry ? {
          title: contextMapEntry.design.title,
          displayTitle: contextMapPresentation.displayTitle,
          humanSummary: contextMapPresentation.humanSummary,
          presentationStatus: contextMapPresentation.presentationStatus,
          presentationRef: contextMapPresentation.presentationRef,
          presentationError: contextMapPresentation.presentationError,
          visibleOnBoard: contextMapPresentation.visibleOnBoard,
          status: contextMapEntry.design.status,
          modelRevision: contextMapEntry.design.model_revision,
          source: contextMapEntry.captured.relativePath,
          openQuestions: markdownSectionBullets(contextMapEntry.captured, "Unknowns And Disputes")
        } : null,
        relationships,
        contexts
      },
      inputs: [
        ...capturedDocs.map((captured) => ({
          label: "domain design",
          relativePath: captured.relativePath,
          fence: captured.fence
        })),
        ...approvalInputs,
        ...presentationInputs
      ]
    };
  } catch (error) {
    return {
      domain: {
        configured: true,
        status: "degraded",
        sourceRoot: domainRoot,
        sourceContract: "docs-design-only",
        discoveryRefs: [],
        error: error.message,
        landscape: null,
        contextMap: null,
        relationships: [],
        contexts: []
      },
      inputs: []
    };
  }
}

function parseInitiativeRelationshipTable(captured, heading, kind, minimumRows) {
  const lines = captured.bytes.toString("utf8").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) throw new Error(`${captured.relativePath}에 ${heading} 표가 없습니다.`);
  const tableLines = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    if (line.trim().startsWith("|")) tableLines.push(line.trim());
  }
  if (tableLines.length < 2) throw new Error(`${captured.relativePath}의 ${heading} 표 header가 올바르지 않습니다.`);
  const rows = tableLines.slice(1).filter((line) => !/^\|[\s:|-]+\|$/.test(line));
  if (rows.length < minimumRows) throw new Error(`${captured.relativePath}의 ${heading} 표에 필요한 관계 행이 없습니다.`);
  return rows.map((line, index) => {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/g, ""));
    if (cells.length !== 4 || cells[0] === "") {
      throw new Error(`${captured.relativePath}의 ${heading} ${index + 1}번째 관계 행이 올바르지 않습니다.`);
    }
    return kind === "policy"
      ? { policyId: cells[0], relation: cells[1], rationale: cells[2], exceptionRef: cells[3] || null }
      : { guidelineId: cells[0], adoption: cells[1], rationale: cells[2], verification: cells[3] };
  });
}

function sortedRelationships(items, idField) {
  return [...items].sort((left, right) => String(left[idField]).localeCompare(String(right[idField]), "en"));
}

function parseExecutionCheckpoint(captured) {
  const checkpoint = parseMarkdownFrontmatter(captured, "execution checkpoint");

  const requiredStrings = [
    "checkpoint_id", "task_id", "loop_state", "next_actor", "next_action",
    "source_revision", "source_hash", "recorded_at"
  ];
  if (checkpoint.type !== "execution-checkpoint" || checkpoint.execution_contract !== "v1") {
    throw new Error(`execution checkpoint type/contract가 올바르지 않습니다: ${captured.relativePath}`);
  }
  for (const key of requiredStrings) {
    if (typeof checkpoint[key] !== "string" || checkpoint[key].trim() === "") {
      throw new Error(`execution checkpoint ${key}가 비어 있습니다: ${captured.relativePath}`);
    }
  }
  if (!/^T[0-9]{4}$/.test(checkpoint.task_id)) {
    throw new Error(`execution checkpoint task_id가 T#### 형식이 아닙니다: ${captured.relativePath}`);
  }
  for (const key of ["checkpoint_seq", "task_contract_revision", "attempt_seq"]) {
    if (!Number.isInteger(checkpoint[key]) || checkpoint[key] < 1) {
      throw new Error(`execution checkpoint ${key}가 positive integer가 아닙니다: ${captured.relativePath}`);
    }
  }
  if (!ALLOWED_LOOP_STATES.has(checkpoint.loop_state)) {
    throw new Error(`execution checkpoint loop_state가 지원되지 않습니다: ${captured.relativePath}`);
  }
  const recordedAtMs = Date.parse(checkpoint.recorded_at);
  if (Number.isNaN(recordedAtMs)) {
    throw new Error(`execution checkpoint recorded_at이 RFC3339 timestamp가 아닙니다: ${captured.relativePath}`);
  }
  for (const key of ["iterations_used", "iterations_max", "elapsed_minutes", "time_limit_minutes"]) {
    if (!Number.isInteger(checkpoint.budget?.[key]) || checkpoint.budget[key] < 0) {
      throw new Error(`execution checkpoint budget.${key}가 non-negative integer가 아닙니다: ${captured.relativePath}`);
    }
  }
  for (const key of ["iterations_max", "time_limit_minutes"]) {
    if (checkpoint.budget[key] < 1) {
      throw new Error(`execution checkpoint budget.${key}가 positive integer가 아닙니다: ${captured.relativePath}`);
    }
  }
  if (checkpoint.budget.iterations_used > checkpoint.budget.iterations_max) {
    throw new Error(`execution checkpoint iteration budget을 초과했습니다: ${captured.relativePath}`);
  }
  if (checkpoint.budget.elapsed_minutes > checkpoint.budget.time_limit_minutes) {
    throw new Error(`execution checkpoint time budget을 초과했습니다: ${captured.relativePath}`);
  }
  const budgetExhausted = checkpoint.budget.iterations_used >= checkpoint.budget.iterations_max
    || checkpoint.budget.elapsed_minutes >= checkpoint.budget.time_limit_minutes;
  if (budgetExhausted && !["stopped", "succeeded"].includes(checkpoint.loop_state)) {
    throw new Error(`execution checkpoint budget이 소진되어 BUDGET_EXCEEDED stop 또는 succeeded가 필요합니다: ${captured.relativePath}`);
  }
  if (checkpoint.loop_state === "stopped" && budgetExhausted && checkpoint.stop_reason !== "BUDGET_EXCEEDED") {
    throw new Error(`소진된 budget의 stopped checkpoint에는 BUDGET_EXCEEDED가 필요합니다: ${captured.relativePath}`);
  }
  if (checkpoint.loop_state === "stopped" && checkpoint.stop_reason === "BUDGET_EXCEEDED" && !budgetExhausted) {
    throw new Error(`BUDGET_EXCEEDED checkpoint가 declared budget limit에 도달하지 않았습니다: ${captured.relativePath}`);
  }
  if (!/^[a-f0-9]{64}$/.test(checkpoint.source_hash)) {
    throw new Error(`execution checkpoint source_hash가 SHA-256 형식이 아닙니다: ${captured.relativePath}`);
  }
  if (checkpoint.source_revision !== "working-tree" && !/^[a-f0-9]{40}$/.test(checkpoint.source_revision)) {
    throw new Error(`execution checkpoint source_revision이 working-tree 또는 full Git commit이 아닙니다: ${captured.relativePath}`);
  }
  if (!ALLOWED_NEXT_ACTORS.has(checkpoint.next_actor)) {
    throw new Error(`execution checkpoint next_actor가 지원되지 않습니다: ${captured.relativePath}`);
  }
  const expectedCheckpointId = `${checkpoint.task_id}:A${checkpoint.attempt_seq}:C${checkpoint.checkpoint_seq}`;
  if (checkpoint.checkpoint_id !== expectedCheckpointId) {
    throw new Error(`execution checkpoint_id가 task/attempt/sequence identity와 일치하지 않습니다: ${captured.relativePath}`);
  }
  if (checkpoint.loop_state === "stopped") {
    if (!ALLOWED_STOP_REASONS.has(checkpoint.stop_reason)) {
      throw new Error(`stopped execution checkpoint에는 유효한 stop_reason이 필요합니다: ${captured.relativePath}`);
    }
  } else if (checkpoint.stop_reason !== null && checkpoint.stop_reason !== "none") {
    throw new Error(`stopped가 아닌 checkpoint는 stop_reason을 선언할 수 없습니다: ${captured.relativePath}`);
  }
  const actorMatchesState = (
    (["ready", "running"].includes(checkpoint.loop_state) && checkpoint.next_actor === "agent")
    || (checkpoint.loop_state === "awaiting_user" && checkpoint.next_actor === "user")
    || (checkpoint.loop_state === "awaiting_external" && checkpoint.next_actor === "external")
    || (checkpoint.loop_state === "needs_review" && ["reviewer", "user"].includes(checkpoint.next_actor))
    || (checkpoint.loop_state === "stopped" && checkpoint.next_actor !== "none")
    || (checkpoint.loop_state === "succeeded" && checkpoint.next_actor === "none")
  );
  if (!actorMatchesState) {
    throw new Error(`execution checkpoint loop_state와 next_actor가 일치하지 않습니다: ${captured.relativePath}`);
  }
  for (const key of ["evidence", "attention", "receipts"]) {
    if (!Array.isArray(checkpoint[key])) {
      throw new Error(`execution checkpoint ${key}가 list가 아닙니다: ${captured.relativePath}`);
    }
  }
  if (["awaiting_user", "awaiting_external", "needs_review", "stopped"].includes(checkpoint.loop_state)
    && checkpoint.attention.length === 0) {
    throw new Error(`${checkpoint.loop_state} execution checkpoint에는 attention ref가 필요합니다: ${captured.relativePath}`);
  }
  if (checkpoint.loop_state === "succeeded" && (
    checkpoint.evidence.length === 0
    || checkpoint.receipts.length === 0
    || checkpoint.attention.length > 0
  )) {
    throw new Error(`succeeded execution checkpoint가 evidence/receipt/attention barrier를 충족하지 않습니다: ${captured.relativePath}`);
  }
  return { checkpoint, recordedAtMs };
}

function verifyTaskSourceFence(repoRoot, taskInput, checkpoint) {
  if (checkpoint.source_hash !== taskInput.digest) {
    throw new Error(`execution checkpoint source_hash가 linked task bytes와 일치하지 않습니다: ${taskInput.relativePath}`);
  }
  if (checkpoint.source_revision === "working-tree") return;
  const committedTask = spawnSync("git", ["-C", repoRoot, "show", `${checkpoint.source_revision}:${taskInput.relativePath}`], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (committedTask.status !== 0 || sha256(committedTask.stdout) !== taskInput.digest) {
    throw new Error(`execution checkpoint source_revision이 linked task bytes를 resolve하지 못합니다: ${taskInput.relativePath}`);
  }
}

async function captureSucceededSupport(repoRoot, checkpoint, checkpointPath) {
  const inputs = [];
  const captures = new Map();
  for (const key of ["evidence", "receipts"]) {
    const seen = new Set();
    for (const [index, reference] of checkpoint[key].entries()) {
      requireString(reference, `${checkpointPath}#${key}[${index}]`);
      if (seen.has(reference)) {
        throw new Error(`succeeded execution checkpoint ${key} ref가 중복됩니다: ${reference}`);
      }
      seen.add(reference);
      const captured = await captureRepositoryFile(repoRoot, reference, `execution ${key} ref`);
      if (captured.state !== "file" || captured.bytes.length === 0) {
        throw new Error(`succeeded execution checkpoint ${key} ref가 안전한 non-empty repository regular file이 아닙니다: ${reference}`);
      }
      captures.set(reference, captured);
      inputs.push({ label: `execution ${key} ref`, relativePath: reference, fence: captured.fence });
    }
  }

  const receiptIds = new Set();
  const boundEvidenceRefs = new Set();
  for (const reference of checkpoint.receipts) {
    const captured = captures.get(reference);
    let receipt;
    try {
      receipt = JSON.parse(captured.bytes.toString("utf8"));
    } catch {
      receipt = parseMarkdownFrontmatter(captured, "execution receipt");
    }
    const requiredOwnFields = ["receipt_id", "receipt_kind", "task_id", "checkpoint_seq", "actor", "issued_at", "scope", "statement", "evidence_refs", "approval_fence", "source_revision", "source_hash"];
    if (!requiredOwnFields.every((field) => Object.hasOwn(receipt, field))) {
      throw new Error(`succeeded execution receipt가 canonical fields를 모두 갖지 않습니다: ${reference}`);
    }
    if (
      typeof receipt.receipt_id !== "string" || receipt.receipt_id.trim() === ""
      || receiptIds.has(receipt.receipt_id)
      || !["command", "test", "review", "decision", "approval", "handoff"].includes(receipt.receipt_kind)
      || receipt.task_id !== checkpoint.task_id
      || receipt.checkpoint_seq !== checkpoint.checkpoint_seq
      || !["human", "agent", "validator", "external-system"].includes(receipt.actor)
      || typeof receipt.issued_at !== "string" || Number.isNaN(Date.parse(receipt.issued_at))
      || !receipt.scope || Array.isArray(receipt.scope) || typeof receipt.scope !== "object"
      || typeof receipt.statement !== "string" || receipt.statement.trim() === ""
      || !Array.isArray(receipt.evidence_refs)
      || receipt.source_revision !== checkpoint.source_revision
      || receipt.source_hash !== checkpoint.source_hash
    ) {
      throw new Error(`succeeded execution receipt identity/source fence가 checkpoint와 일치하지 않습니다: ${reference}`);
    }
    receiptIds.add(receipt.receipt_id);
    for (const evidenceRef of receipt.evidence_refs) {
      if (typeof evidenceRef !== "string" || evidenceRef.trim() === "") {
        throw new Error(`succeeded execution receipt evidence_refs가 올바르지 않습니다: ${reference}`);
      }
      boundEvidenceRefs.add(evidenceRef);
    }
  }
  if (!checkpoint.evidence.every((reference) => boundEvidenceRefs.has(reference))) {
    throw new Error(`succeeded execution receipt가 checkpoint evidence refs를 source-fenced linkage로 포함하지 않습니다: ${checkpointPath}`);
  }
  return inputs;
}

async function captureLoopEnabledTaskCheckpoints(repoRoot, checkpointRoot) {
  const taskRoot = "docs/tasks";
  const resolved = await resolveInsideRoot(repoRoot, taskRoot);
  let rootStat;
  try {
    rootStat = await lstat(resolved);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`execution task root는 symlink가 아닌 directory여야 합니다: ${taskRoot}`);
  }
  const canonical = await realpath(resolved);
  if (!pathIsInside(repoRoot, canonical)) {
    throw new Error(`execution task root가 저장소 경계를 벗어납니다: ${taskRoot}`);
  }
  const entries = (await readdir(canonical, { withFileTypes: true }))
    .filter(({ name }) => /^T[0-9]{4}-.+\.md$/.test(name))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  const candidates = [];
  for (const entry of entries) {
    if (entry.name.includes("/") || entry.name.includes("\\") || !entry.isFile()) {
      throw new Error(`execution task entry는 direct regular Markdown file이어야 합니다: ${entry.name}`);
    }
    const taskRelativePath = `${taskRoot}/${entry.name}`;
    const taskInput = await captureRepositoryFile(repoRoot, taskRelativePath, "execution task");
    if (taskInput.state !== "file") {
      throw new Error(`execution task가 안전한 repository regular file이 아닙니다: ${taskRelativePath}`);
    }
    const task = parseMarkdownFrontmatter(taskInput, "execution task");
    if (task.type !== "task" || task.execution_contract !== "v1") continue;
    if (!/^T[0-9]{4}$/.test(task.doc_id ?? "")
      || !Number.isInteger(task.task_contract_revision) || task.task_contract_revision < 1
      || !ALLOWED_LOOP_STATES.has(task.loop_state)) {
      throw new Error(`loop-enabled task identity/revision/state가 올바르지 않습니다: ${taskRelativePath}`);
    }
    if (!TASK_STATUS_LOOP_STATES.has(task.status)) {
      throw new Error(`loop-enabled task status가 지원되지 않습니다: ${taskRelativePath}`);
    }
    if (!TASK_STATUS_LOOP_STATES.get(task.status).has(task.loop_state)) {
      throw new Error(`loop-enabled task status와 loop_state가 호환되지 않습니다: ${taskRelativePath}`);
    }
    if (task.checkpoint_ref === null || task.checkpoint_ref === "") {
      if (task.status === "draft" && task.loop_state === "ready") continue;
      throw new Error(`loop-enabled task에 checkpoint_ref가 없습니다: ${taskRelativePath}`);
    }
    if (typeof task.checkpoint_ref !== "string"
      || !/^docs\/checkpoints\/[^/\\]+\.md$/.test(task.checkpoint_ref)) {
      throw new Error(`loop-enabled task checkpoint_ref가 canonical docs/checkpoints/*.md 경로가 아닙니다: ${taskRelativePath}`);
    }
    const checkpointInput = await captureRepositoryFile(repoRoot, task.checkpoint_ref, "execution checkpoint");
    if (checkpointInput.state !== "file") {
      throw new Error(`execution checkpoint가 안전한 repository regular file이 아닙니다: ${task.checkpoint_ref}`);
    }
    const parsed = parseExecutionCheckpoint(checkpointInput);
    if (parsed.checkpoint.task_id !== task.doc_id
      || parsed.checkpoint.task_contract_revision !== task.task_contract_revision
      || parsed.checkpoint.loop_state !== task.loop_state) {
      throw new Error(`execution checkpoint가 task id/revision/loop_state mirror와 일치하지 않습니다: ${task.checkpoint_ref}`);
    }
    verifyTaskSourceFence(repoRoot, taskInput, parsed.checkpoint);
    const supportInputs = parsed.checkpoint.loop_state === "succeeded"
      ? await captureSucceededSupport(repoRoot, parsed.checkpoint, task.checkpoint_ref)
      : [];
    candidates.push({
      ...parsed,
      input: checkpointInput,
      task,
      taskInput,
      supportInputs
    });
  }
  return candidates;
}

function executionSelectionPriority(candidate) {
  if (["active", "blocked"].includes(candidate.task.status) && candidate.checkpoint.loop_state !== "succeeded") return 0;
  if (candidate.task.status === "active" && candidate.checkpoint.loop_state === "succeeded") return 1;
  if (candidate.task.status === "draft") return 2;
  return 3;
}

async function readExecutionCheckpoint(repoRoot, checkpointRoot) {
  try {
    const candidates = await captureLoopEnabledTaskCheckpoints(repoRoot, checkpointRoot);
    if (candidates.length === 0) {
      return {
        execution: {
          configured: false,
          status: "not_configured",
          sourceRoot: checkpointRoot,
          message: "정규 docs/checkpoints/*.md 실행 체크포인트가 없습니다."
        },
        inputs: []
      };
    }
    candidates.sort((left, right) => (
      executionSelectionPriority(left) - executionSelectionPriority(right)
      || right.recordedAtMs - left.recordedAtMs
      || right.checkpoint.attempt_seq - left.checkpoint.attempt_seq
      || right.checkpoint.checkpoint_seq - left.checkpoint.checkpoint_seq
      || left.input.relativePath.localeCompare(right.input.relativePath, "en")
    ));
    const selected = candidates[0];
    return {
      execution: {
        configured: true,
        status: "observed",
        source: selected.input.relativePath,
        sourceRoot: checkpointRoot,
        selection: {
          strategy: "active_non_succeeded,active_succeeded,draft,historical;recorded_at_desc,attempt_seq_desc,checkpoint_seq_desc,path_asc",
          candidateCount: candidates.length
        },
        checkpointId: selected.checkpoint.checkpoint_id,
        taskId: selected.checkpoint.task_id,
        taskContractRevision: selected.checkpoint.task_contract_revision,
        attemptSeq: selected.checkpoint.attempt_seq,
        checkpointSeq: selected.checkpoint.checkpoint_seq,
        lifecycleStatus: selected.task.status ?? null,
        loopState: selected.checkpoint.loop_state,
        nextActor: selected.checkpoint.next_actor,
        nextAction: selected.checkpoint.next_action,
        recordedAt: selected.checkpoint.recorded_at,
        budget: selected.checkpoint.budget
      },
      inputs: candidates.flatMap(({ input, taskInput, supportInputs }) => ([
        {
          label: "execution task",
          relativePath: taskInput.relativePath,
          fence: taskInput.fence
        },
        {
          label: "execution checkpoint",
          relativePath: input.relativePath,
          fence: input.fence
        },
        ...supportInputs
      ]))
    };
  } catch (error) {
    return {
      execution: {
        configured: true,
        status: "degraded",
        sourceRoot: checkpointRoot,
        error: error.message
      },
      inputs: []
    };
  }
}

const DOMAIN_SUPERVISION_SUBJECT_STATUSES = new Set(["draft", "active", "blocked", "done", "closed", "current"]);

async function readDomainSupervision(repoRoot) {
  const reviews = [];
  const inputs = [];
  const roots = ["docs/projects", "docs/tasks", "docs/qa"];
  for (const subjectRoot of roots) {
    let resolved;
    try {
      resolved = await resolveInsideRoot(repoRoot, subjectRoot);
      const lexical = await lstat(resolved);
      if (!lexical.isDirectory() || lexical.isSymbolicLink()) throw new Error(`${subjectRoot}는 안전한 directory여야 합니다.`);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const entries = (await readdir(resolved, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const subjectRef = `${subjectRoot}/${entry.name}`;
      const subjectInput = await captureRepositoryFile(repoRoot, subjectRef, "domain supervision subject");
      if (subjectInput.state !== "file") continue;
      const subject = parseMarkdownFrontmatter(subjectInput, "domain supervision subject");
      if (!["project", "task", "qa"].includes(subject.type)
        || subject.domain_contract !== "v2"
        || !DOMAIN_SUPERVISION_SUBJECT_STATUSES.has(subject.status)) continue;
      inputs.push({ label: "domain supervision subject", relativePath: subjectRef, fence: subjectInput.fence });
      const reviewRef = subject.domain_supervision_ref;
      const decisionRef = subject.domain_decision_ref ?? null;
      if (typeof reviewRef !== "string" || reviewRef.trim() === "") {
        if (subject.status === "draft") continue;
        reviews.push({
          reviewId: `DSR-MISSING-${subject.doc_id ?? entry.name}`,
          reviewStatus: "invalid",
          subjectKind: subject.type,
          subjectId: subject.doc_id ?? entry.name,
          subjectTitle: subject.title ?? entry.name,
          subjectRef,
          problem: "AI Domain Expert supervision review가 연결되지 않았습니다.",
          error: "active/current domain_contract v2 subject requires domain_supervision_ref"
        });
        continue;
      }
      try {
        const reviewed = await validateDomainSupervision({
          root: repoRoot,
          subjectPath: subjectRef,
          reviewPath: reviewRef,
          decisionPath: decisionRef || null,
          closeout: false
        });
        reviews.push(reviewed);
        for (const relativePath of reviewed.inputRefs) {
          const input = await captureRepositoryFile(repoRoot, relativePath, "domain supervision input");
          inputs.push({ label: "domain supervision input", relativePath, fence: input.fence });
        }
      } catch (error) {
        reviews.push({
          reviewId: `DSR-INVALID-${subject.doc_id ?? entry.name}`,
          reviewStatus: "invalid",
          subjectKind: subject.type,
          subjectId: subject.doc_id ?? entry.name,
          subjectTitle: subject.title ?? entry.name,
          subjectRef,
          reviewRef,
          problem: "AI Domain Expert supervision 근거를 신뢰할 수 없습니다.",
          error: error.message
        });
        const reviewInput = await captureRepositoryFile(repoRoot, reviewRef, "domain supervision review");
        inputs.push({ label: "domain supervision review", relativePath: reviewRef, fence: reviewInput.fence });
        if (decisionRef) {
          const decisionInput = await captureRepositoryFile(repoRoot, decisionRef, "domain supervision decision");
          inputs.push({ label: "domain supervision decision", relativePath: decisionRef, fence: decisionInput.fence });
        }
      }
    }
  }
  reviews.sort((left, right) => (
    String(right.reviewedAt ?? "").localeCompare(String(left.reviewedAt ?? ""), "en")
    || String(left.reviewId).localeCompare(String(right.reviewId), "en")
  ));
  const invalidCount = reviews.filter((item) => item.reviewStatus === "invalid").length;
  const blockedCount = reviews.filter((item) => item.reviewStatus === "blocked-conflict").length;
  const decisionCount = reviews.filter((item) => item.reviewStatus === "decision-required" && !item.decision).length;
  const realignmentCount = reviews.filter((item) => item.reviewStatus === "decision-required"
    && item.decision
    && item.decision.selectedDisposition !== "temporary-deviation").length;
  const deviationCount = reviews.filter((item) => item.decision?.selectedDisposition === "temporary-deviation").length;
  return {
    supervision: {
      configured: reviews.length > 0,
      status: invalidCount > 0
        ? "degraded"
        : blockedCount > 0
          ? "blocked"
          : decisionCount > 0
            ? "decision-required"
            : realignmentCount > 0
              ? "alignment-pending"
              : "current",
      reviews,
      counts: {
        total: reviews.length,
        aligned: reviews.filter((item) => item.reviewStatus === "aligned").length,
        decisionRequired: decisionCount,
        alignmentPending: realignmentCount,
        blocked: blockedCount,
        invalid: invalidCount,
        temporaryDeviation: deviationCount
      }
    },
    inputs
  };
}

function createGeneratedAttention(register, policies, guidelines, initiatives, orphanedProjects, migrationFence, execution, domain, supervision) {
  const attention = [...(register.attention ?? [])];
  const staleItems = [...policies, ...guidelines, ...initiatives].filter((item) => item.evidenceState !== "current");
  const initiativeReviews = initiatives.filter((item) => ["unreviewed", "review_requested"].includes(item.approvalState));
  const hiddenGovernance = [...policies, ...guidelines, ...initiatives].filter((item) => !item.visibleOnBoard);
  const hiddenDomain = [
    ...(domain.landscape && !domain.landscape.visibleOnBoard ? [domain.landscape.source] : []),
    ...(domain.contextMap && !domain.contextMap.visibleOnBoard ? [domain.contextMap.source] : []),
    ...domain.contexts.filter((item) => !item.visibleOnBoard).map((item) => item.modelRef),
    ...(domain.relationships.some((item) => !item.visibleOnBoard) && domain.contextMap?.source
      ? [domain.contextMap.source]
      : [])
  ].filter(Boolean);

  if (hiddenGovernance.length > 0) {
    attention.unshift({
      id: "ATTN-HUMAN-PRESENTATION",
      severity: "decision",
      title: "사람용 설명이 필요합니다",
      humanSummary: `${hiddenGovernance.length}개 정책·지침·추진안은 사람이 바로 이해할 제목과 설명이 없거나 검토 근거가 올바르지 않습니다. 기술 ID나 경로를 대신 표시하지 않고 원문에서 사람용 문구를 작성해 달라고 요청합니다.`,
      relatedRefs: hiddenGovernance.map((item) => item.id)
    });
  }

  if (hiddenDomain.length > 0) {
    attention.unshift({
      id: "ATTN-DOMAIN-PRESENTATION",
      severity: "decision",
      title: "도메인에 사람용 설명이 필요합니다",
      humanSummary: `${new Set(hiddenDomain).size}개 도메인 원문은 사람이 바로 이해할 제목·요약 또는 관계 설명이 없습니다. 정상 Domain 목록에는 올리지 않고 exact source에서 문구 검토를 요청합니다.`,
      relatedRefs: [...new Set(hiddenDomain)]
    });
  }

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

  if (initiativeReviews.length > 0) {
    attention.unshift({
      id: "ATTN-INITIATIVE-REVIEW",
      severity: "decision",
      title: "추진안의 방향과 프로젝트 연결을 확인해 주세요",
      humanSummary: `${initiativeReviews.length}개 추진안은 아직 초안 상태입니다. 정책·지침·성과 기준과 연결 프로젝트를 확인한 뒤 승인 여부를 결정해야 합니다.`,
      relatedRefs: initiativeReviews.map((item) => item.id)
    });
  }

  if (orphanedProjects.length > 0) {
    attention.unshift({
      id: "ATTN-INITIATIVE-LINEAGE",
      severity: "decision",
      title: "프로젝트의 추진안 연결을 바로잡아 주세요",
      humanSummary: `${orphanedProjects.length}개 프로젝트가 알 수 없는 추진안, 누락된 추진안 또는 명시되지 않은 관계를 가리킵니다. 연결을 추론하지 말고 사람이 정한 계보로 수정해야 합니다.`,
      relatedRefs: orphanedProjects.flatMap((project) => [project.id, project.initiativeRef]).filter(Boolean)
    });
  }

  if (policies.length === 0 && guidelines.length === 0) {
    attention.unshift({
      id: "ATTN-GOVERNANCE-EMPTY",
      severity: "warning",
      title: "소스 근거가 있는 거버넌스 후보가 없습니다",
      humanSummary: "이 화면은 정책이나 지침을 임의로 만들지 않고 명시적인 추출 공백으로 표시합니다.",
      relatedRefs: []
    });
  }

  if (migrationFence.state !== "valid") {
    const migrationFenceReason = ({
      unresolvable_captured_base: "캡처한 초기 이관 기준을 확인할 수 없음",
      receipt_missing_or_invalid: "설치 영수증이 없거나 유효하지 않음",
      current_head_advanced: "초기 이관 이후 현재 HEAD가 변경됨",
      captured_head_current: "캡처한 HEAD가 현재와 일치함"
    })[migrationFence.reason] ?? "초기 이관 경계를 확인할 수 없음";
    attention.unshift({
      id: "ATTN-MIGRATION-FENCE",
      severity: "warning",
      title: "캡처된 초기 이관 리비전을 검증할 수 없습니다",
      humanSummary: `초기 이관 경계 상태는 '${migrationFenceReason}'입니다. 초기 이관 최신성을 신뢰하기 전에 설치 영수증을 검토해야 합니다.`,
      relatedRefs: migrationFence.receiptRef ? [migrationFence.receiptRef] : []
    });
  }

  if (execution.status === "degraded") {
    attention.unshift({
      id: "ATTN-EXECUTION-SOURCE",
      severity: "warning",
      title: "실행 체크포인트 소스를 사용할 수 없습니다",
      humanSummary: execution.error,
      relatedRefs: execution.source ? [execution.source] : []
    });
  }

  if (domain.status === "degraded") {
    attention.unshift({
      id: "ATTN-DOMAIN-DESIGN-INVALID",
      severity: "warning",
      title: "DDD 도메인 모델을 신뢰할 수 없습니다",
      humanSummary: domain.error
        ?? `${domain.contexts.filter((item) => item.validationStatus === "invalid" || item.boardReviewStatus === "invalid").length}개 bounded context의 authority receipt, current model bytes 또는 AI Domain Expert Board package가 올바르지 않습니다.`,
      relatedRefs: domain.contexts
        .filter((item) => item.validationStatus === "invalid" || item.boardReviewStatus === "invalid")
        .map((item) => item.modelRef)
    });
  } else if (!domain.configured) {
    attention.unshift({
      id: "ATTN-DOMAIN-DESIGN-NOT-CONFIGURED",
      severity: "warning",
      title: "근거가 있는 DDD 도메인 모델이 필요합니다",
      humanSummary: "Board는 도메인 모델을 만들거나 수정하지 않습니다. 별도의 도메인 모델링 작업에서 실제 업무 근거를 바탕으로 docs/design의 landscape, context map과 bounded-context model을 작성한 뒤 Board가 다시 읽어야 합니다.",
      relatedRefs: domain.discoveryRefs ?? []
    });
  } else if (domain.configured) {
    const reviewContexts = domain.contexts.filter((item) => !["approved_current", "ai_current"].includes(item.validationStatus));
    const boardReviewContexts = reviewContexts.filter((item) => item.boardReviewStatus === "review_requested");
    if (boardReviewContexts.length > 0) {
      attention.unshift({
        id: "ATTN-DOMAIN-DESIGN-REVIEW",
        severity: "decision",
        title: "AI Domain Expert의 도메인 모델 결정을 확인해 주세요",
        humanSummary: `${boardReviewContexts.length}개 중요한 모델링 판단을 AI Domain Expert가 사람이 읽을 최소 충분 수준으로 종합했습니다. 선택된 실제 모델, 이유, 보호 결과와 수정 조건을 읽고 승인·수정·거절을 결정해야 합니다.`,
        relatedRefs: boardReviewContexts.map((item) => item.modelRef)
      });
    } else if (reviewContexts.length > 0) {
      attention.unshift({
        id: "ATTN-DOMAIN-AUTHORITY",
        severity: "warning",
        title: "도메인 모델 권위를 완성해야 합니다",
        humanSummary: `${reviewContexts.length}개 bounded context가 current authority를 갖지 못했습니다. AI Domain Expert가 delegated-AI receipt 또는 필요한 Board package를 완성해야 합니다.`,
        relatedRefs: reviewContexts.map((item) => item.modelRef)
      });
    }
  }

  const invalidSupervision = supervision.reviews.filter((item) => item.reviewStatus === "invalid");
  const blockedSupervision = supervision.reviews.filter((item) => item.reviewStatus === "blocked-conflict");
  const decisionSupervision = supervision.reviews.filter((item) => item.reviewStatus === "decision-required" && !item.decision);
  const realignmentSupervision = supervision.reviews.filter((item) => item.reviewStatus === "decision-required"
    && item.decision
    && item.decision.selectedDisposition !== "temporary-deviation");
  const temporaryDeviations = supervision.reviews.filter((item) => item.decision?.selectedDisposition === "temporary-deviation");
  if (invalidSupervision.length > 0) {
    attention.unshift({
      id: "ATTN-DOMAIN-SUPERVISION-INVALID",
      severity: "critical",
      title: "도메인 감독 근거를 다시 확인해야 합니다",
      humanSummary: `${invalidSupervision.length}개 delivery의 AI Domain Expert review가 없거나 current task/model/implementation bytes와 일치하지 않습니다. closeout 전에 exact review를 다시 발행해야 합니다.`,
      relatedRefs: invalidSupervision.flatMap((item) => [item.subjectRef, item.reviewRef]).filter(Boolean)
    });
  }
  if (blockedSupervision.length > 0) {
    attention.unshift({
      id: "ATTN-DOMAIN-SUPERVISION-BLOCKED",
      severity: "critical",
      title: "도메인 의미 충돌로 delivery가 중단되었습니다",
      humanSummary: `${blockedSupervision.length}개 delivery에서 AI Domain Expert가 안전한 정렬 방향을 확정할 수 없습니다. source·ownership·모델 충돌을 해결해야 합니다.`,
      relatedRefs: blockedSupervision.map((item) => item.reviewId)
    });
  }
  if (decisionSupervision.length > 0) {
    attention.unshift({
      id: "ATTN-DOMAIN-SUPERVISION-DECISION",
      severity: "decision",
      title: "모델과 구현 사이의 방향을 결정해 주세요",
      humanSummary: `${decisionSupervision.length}개 delivery에서 AI Domain Expert가 문제·대안·engineering 권고를 준비했습니다. 사용자가 선택하기 전에는 구현 또는 closeout이 진행되지 않습니다.`,
      relatedRefs: decisionSupervision.map((item) => item.reviewId)
    });
  }
  if (realignmentSupervision.length > 0) {
    attention.unshift({
      id: "ATTN-DOMAIN-SUPERVISION-REALIGNMENT",
      severity: "warning",
      title: "선택한 방향으로 모델과 구현을 다시 맞춰야 합니다",
      humanSummary: `${realignmentSupervision.length}개 delivery는 사용자의 결정이 기록되었지만 후속 구현·모델 변경과 새 aligned review가 아직 완료되지 않았습니다. 선택 자체를 완료로 간주하지 않습니다.`,
      relatedRefs: realignmentSupervision.map((item) => item.reviewId)
    });
  }
  if (temporaryDeviations.length > 0) {
    attention.unshift({
      id: "ATTN-DOMAIN-TEMPORARY-DEVIATION",
      severity: "warning",
      title: "사람이 수용한 임시 도메인 편차가 있습니다",
      humanSummary: `${temporaryDeviations.length}개 delivery가 model/code 정렬 대신 만료 조건이 있는 임시 편차로 운영됩니다. 만료 전에 재정렬해야 합니다.`,
      relatedRefs: temporaryDeviations.map((item) => item.reviewId)
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
  const initiativeRegisterInput = await captureRepositoryFile(config.resolvedRoot, config.initiativeRegister, "initiative register");
  const initiativeRegister = parseCapturedJson(initiativeRegisterInput, "initiative register");

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
  if (initiativeRegister.schemaVersion !== 1) {
    throw new Error(`지원하지 않는 initiative register schemaVersion입니다: ${initiativeRegister.schemaVersion}`);
  }
  requireArray(initiativeRegister.initiatives, "initiativeRegister.initiatives");

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
  const migrationFence = await inspectMigrationFence(config.resolvedRoot, register.migration, currentRepository, registerInput);
  const policyInspection = await inspectItems(
    config.resolvedRoot,
    register.policies,
    "policies",
    registerInput,
    config.presentation.locale
  );
  const guidelineInspection = await inspectItems(
    config.resolvedRoot,
    register.guidelines,
    "guidelines",
    registerInput,
    config.presentation.locale
  );
  const policies = policyInspection.items;
  const guidelines = guidelineInspection.items;
  const initiativeInspection = await inspectInitiatives(
    config.resolvedRoot,
    initiativeRegister.initiatives,
    policies,
    guidelines,
    config.projectRoot,
    initiativeRegisterInput,
    config.presentation.locale
  );
  const initiatives = initiativeInspection.items;
  const runtime = await readRuntimeProbes(config.resolvedRoot, config.runtimeProbes);
  const executionInspection = await readExecutionCheckpoint(config.resolvedRoot, config.executionCheckpointRoot);
  const execution = executionInspection.execution;
  const domainInspection = await readDomainDesign(config.resolvedRoot, config.domainDesignRoot, config.presentation.locale);
  const domain = domainInspection.domain;
  const supervisionInspection = await readDomainSupervision(config.resolvedRoot);
  const supervision = supervisionInspection.supervision;
  const attention = createGeneratedAttention(
    register,
    policies,
    guidelines,
    initiatives,
    initiativeInspection.orphanedProjects,
    migrationFence,
    execution,
    domain,
    supervision
  );
  const allRefs = [...policies, ...guidelines, ...initiatives].flatMap((item) => item.sourceRefs);
  const sourceEvidenceState = allRefs.length === 0
    ? "unknown"
    : allRefs.some((ref) => ref.state === "missing" || ref.state === "invalid")
      ? "degraded"
      : allRefs.some((ref) => ref.state === "changed")
        ? "stale"
        : "fresh";
  const projectionState = migrationFence.state !== "valid" || execution.status === "degraded" || domain.status === "degraded" || supervision.status === "degraded"
    ? "degraded"
    : sourceEvidenceState;
  const semantic = {
    project: config.project,
    direction: register.direction ?? [],
    migration: register.migration,
    policies,
    guidelines,
    initiatives,
    domain,
    supervision,
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
        initiativeRegister: config.initiativeRegister,
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
      initiativeCount: initiatives.length,
      initiativeActiveCount: initiatives.filter((item) => item.lifecycleState === "active").length,
      initiativeReviewCount: initiatives.filter((item) => ["unreviewed", "review_requested"].includes(item.approvalState)).length,
      presentationMissingCount: [...policies, ...guidelines, ...initiatives].filter((item) => !item.visibleOnBoard).length,
      domainContextCount: domain.contexts.length,
      domainApprovedCount: domain.contexts.filter((item) => ["approved_current", "ai_current"].includes(item.validationStatus)).length,
      domainReviewCount: domain.contexts.filter((item) => !["approved_current", "ai_current"].includes(item.validationStatus)).length,
      domainPresentationMissingCount: domain.contexts.filter((item) => !item.visibleOnBoard).length,
      domainSupervisionCount: supervision.counts.total,
      domainSupervisionDecisionCount: supervision.counts.decisionRequired,
      domainSupervisionBlockedCount: supervision.counts.blocked,
      domainTemporaryDeviationCount: supervision.counts.temporaryDeviation,
      linkedProjectCount: new Set(initiatives.flatMap((item) => item.projects.map((project) => project.id))).size,
      approvedCount: [...policies, ...guidelines].filter((item) => item.approvalState === "approved").length,
      reviewCount: [...policies, ...guidelines].filter((item) => item.approvalState === "unreviewed" || item.approvalState === "review_requested").length,
      attentionCount: attention.length,
      enforcement: countBy([...policies, ...guidelines], "enforcement"),
      authority: countBy([...policies, ...guidelines], "authorityClass")
    },
    policies,
    guidelines,
    initiatives,
    domain,
    supervision,
    attention,
    runtime,
    execution,
    qualityCommands: config.qualityCommands ?? {},
    client: {
      refreshIntervalMs: config.refreshIntervalMs,
      presentation: config.presentation
    }
  };

  if (beforeInputRecheck) await beforeInputRecheck({ attempt, snapshot });
  const sourceInputs = [...policies, ...guidelines, ...initiatives]
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
    {
      label: "initiative register",
      relativePath: config.initiativeRegister,
      fence: initiativeRegisterInput.fence
    },
    ...sourceInputs,
    ...policyInspection.approvalInputs,
    ...policyInspection.presentationInputs,
    ...guidelineInspection.approvalInputs,
    ...guidelineInspection.presentationInputs,
    ...initiativeInspection.approvalInputs,
    ...initiativeInspection.stableInputs,
    ...domainInspection.inputs,
    ...supervisionInspection.inputs,
    ...(migrationFence.receiptInput ? [migrationFence.receiptInput] : []),
    ...executionInspection.inputs
  ]);

  return { config, register, initiativeRegister, snapshot, semanticHash };
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
