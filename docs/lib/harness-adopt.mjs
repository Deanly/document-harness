import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyInitiativeAuthority } from "./initiative-authority.mjs";

export const SCHEMA_VERSION = 1;
export const INSTALLATION_LOCK_PATH = "docs/_indexes/harness-installation.yaml";
export const EVIDENCE_PACK_PATH = "docs/receipts/migration-evidence-pack.json";
export const GOVERNANCE_CATALOG_PATH = "docs/_indexes/governance-catalog.json";
export const INITIATIVE_REGISTER_PATH = "docs/_indexes/initiative-register.json";
export const VIEW_CONFIG_PATH = "runtime/document-harness-view/config.json";
export const ALLOWED_ACTIONS = Object.freeze([
  "ADD",
  "UPDATE_UNMODIFIED",
  "KEEP_PROJECT_OWNED",
  "CONFLICT",
  "GRANDFATHER",
  "DEFER",
  "REMOVE_GENERATED",
]);
export const ALLOWED_STATUSES = Object.freeze([
  "PLAN_READY",
  "NEEDS_DECISION",
  "APPLY_FAILED",
  "INSTALLED_NOT_VERIFIED",
  "INSTALLED_AWAITING_REVIEW",
  "MIGRATION_VERIFIED",
  "ROLLED_BACK",
]);

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_ROOT = path.resolve(MODULE_DIR, "../..");
export const RELEASE_MANIFEST_PATH = path.join(
  PUBLIC_ROOT,
  "docs/releases/document-harness-v1.json",
);
const INITIATIVE_REGISTER_SCHEMA_PATH = path.join(
  PUBLIC_ROOT,
  "docs/schemas/initiative-register.schema.json",
);

const RECEIPT_RE = /^docs\/receipts\/harness-(?:apply|rollback)-[a-f0-9]+\.json$/;
const IGNORED_FENCE_PREFIXES = [".git/", ".document-harness/runtime/"];

export class HarnessAdoptError extends Error {
  constructor(message, { status = "APPLY_FAILED", code = "HARNESS_ADOPT_ERROR", details = [] } = {}) {
    super(message);
    this.name = "HarnessAdoptError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}

export function prettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function normalizeRelativePath(value, label = "path") {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new HarnessAdoptError(`${label} must be a non-empty relative path`, {
      status: "NEEDS_DECISION",
      code: "UNSAFE_PATH",
    });
  }
  const normalized = value.replaceAll("\\", "/");
  if (
    path.posix.isAbsolute(normalized) ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.endsWith("/..") ||
    normalized === "."
  ) {
    throw new HarnessAdoptError(`${label} escapes the repository: ${value}`, {
      status: "NEEDS_DECISION",
      code: "UNSAFE_PATH",
    });
  }
  return path.posix.normalize(normalized).replace(/^\.\//, "");
}

function isIgnoredFencePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  return (
    RECEIPT_RE.test(normalized) ||
    IGNORED_FENCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

function runGit(root, args, { allowFailure = false, encoding = null } = {}) {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    if (allowFailure) return null;
    throw new HarnessAdoptError(`git ${args.join(" ")} failed`, {
      status: "NEEDS_DECISION",
      code: "GIT_INSPECTION_FAILED",
      details: [error.stderr?.toString().trim()].filter(Boolean),
    });
  }
}

function resolveRepositoryRoot(input) {
  const absolute = path.resolve(input);
  if (!existsSync(absolute) || !lstatSync(absolute).isDirectory() || lstatSync(absolute).isSymbolicLink()) {
    throw new HarnessAdoptError("target must be an existing, non-symlink directory", {
      status: "NEEDS_DECISION",
      code: "UNKNOWN_REPOSITORY",
    });
  }
  const root = realpathSync(absolute);
  const inside = runGit(root, ["rev-parse", "--is-inside-work-tree"], {
    allowFailure: true,
    encoding: "utf8",
  });
  if (inside?.trim() !== "true") {
    throw new HarnessAdoptError("target revision and index cannot be fenced because target is not a Git worktree", {
      status: "NEEDS_DECISION",
      code: "UNKNOWN_REPOSITORY",
    });
  }
  const top = runGit(root, ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  if (realpathSync(top) !== root) {
    throw new HarnessAdoptError("target must be the Git worktree root", {
      status: "NEEDS_DECISION",
      code: "NESTED_TARGET",
    });
  }
  return root;
}

function walkInventory(root, current = "", rows = []) {
  const directory = path.join(root, current);
  const names = readdirSync(directory).sort((a, b) => a.localeCompare(b, "en"));
  for (const name of names) {
    const relative = current ? `${current}/${name}` : name;
    if (relative === ".git" || isIgnoredFencePath(relative)) continue;
    const absolute = path.join(root, ...relative.split("/"));
    const info = lstatSync(absolute);
    if (info.isDirectory()) {
      walkInventory(root, relative, rows);
    } else if (info.isFile()) {
      rows.push({
        path: relative,
        type: "file",
        mode: info.mode & 0o777,
        sha256: sha256(readFileSync(absolute)),
      });
    } else if (info.isSymbolicLink()) {
      rows.push({ path: relative, type: "symlink", target: readlinkSync(absolute) });
    } else {
      rows.push({ path: relative, type: "special", mode: info.mode & 0o777 });
    }
  }
  return rows;
}

function currentRevision(root) {
  const value = runGit(root, ["rev-parse", "--verify", "HEAD"], {
    allowFailure: true,
    encoding: "utf8",
  });
  return value ? value.trim() : "UNBORN";
}

export function inspectTarget(input) {
  const root = resolveRepositoryRoot(input);
  const inventory = walkInventory(root);
  const inventorySha256 = sha256(canonicalJson(inventory));
  const index = runGit(root, ["ls-files", "--stage", "-z"], { encoding: null });
  const dirtyFingerprint = sha256(
    Buffer.concat([Buffer.from(canonicalJson(inventory)), Buffer.from([0]), index]),
  );
  return {
    root,
    identity: sha256(root),
    revision: currentRevision(root),
    dirtyFingerprint,
    inventorySha256,
    inventory,
  };
}

function loadJson(file, label) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new HarnessAdoptError(`${label} is not valid JSON: ${file}`, {
      status: "NEEDS_DECISION",
      code: "INVALID_JSON",
      details: [error.message],
    });
  }
}

export function loadReleaseManifest() {
  const manifest = loadJson(RELEASE_MANIFEST_PATH, "release manifest");
  validateReleaseManifest(manifest);
  return manifest;
}

export function validateReleaseManifest(manifest) {
  const requiredGateIds = manifest?.verification?.requiredGateIds;
  const requiredProfiles = manifest?.verification?.requiredProfiles;
  const requiredInstalledPaths = manifest?.verification?.requiredInstalledPaths;
  if (
    manifest?.schemaVersion !== SCHEMA_VERSION ||
    typeof manifest.releaseId !== "string" ||
    typeof manifest.version !== "string" ||
    !manifest.profileDependencies || typeof manifest.profileDependencies !== "object" || Array.isArray(manifest.profileDependencies) ||
    !Array.isArray(manifest.files) ||
    !Array.isArray(requiredProfiles) ||
    requiredProfiles.length === 0 ||
    requiredProfiles.some((profile) => typeof profile !== "string" || profile.length === 0) ||
    new Set(requiredProfiles).size !== requiredProfiles.length ||
    !Array.isArray(requiredInstalledPaths) ||
    requiredInstalledPaths.length === 0 ||
    requiredInstalledPaths.some((filePath) => typeof filePath !== "string" || filePath.length === 0) ||
    new Set(requiredInstalledPaths).size !== requiredInstalledPaths.length ||
    !Array.isArray(requiredGateIds) ||
    requiredGateIds.length === 0 ||
    requiredGateIds.some((gateId) => typeof gateId !== "string" || gateId.length === 0) ||
    new Set(requiredGateIds).size !== requiredGateIds.length ||
    manifest.verification?.verifiedStatusRequiresAllGates !== true ||
    manifest.verification?.verifiedStatusRequiresHumanReview !== true
  ) {
    throw new HarnessAdoptError("release manifest has an unsupported shape", {
      status: "NEEDS_DECISION",
      code: "INVALID_RELEASE_MANIFEST",
    });
  }
  const targetPaths = new Set();
  const folded = new Set();
  const knownProfiles = new Set(manifest.profiles ?? []);
  const usedProfiles = new Set();
  if (
    knownProfiles.size === 0 ||
    Object.keys(manifest.profileDependencies).length !== knownProfiles.size ||
    [...knownProfiles].some((profile) => !Object.hasOwn(manifest.profileDependencies, profile)) ||
    Object.entries(manifest.profileDependencies).some(([profile, dependencies]) => (
      !knownProfiles.has(profile) ||
      !Array.isArray(dependencies) ||
      new Set(dependencies).size !== dependencies.length ||
      dependencies.some((dependency) => !knownProfiles.has(dependency) || dependency === profile)
    )) ||
    requiredProfiles.some((profile) => !knownProfiles.has(profile))
  ) {
    throw new HarnessAdoptError("release profile dependency contract is invalid", {
      status: "NEEDS_DECISION",
      code: "INVALID_RELEASE_MANIFEST",
    });
  }
  resolveProfileSelection(manifest, [...knownProfiles]);
  for (const entry of manifest.files) {
    entry.sourcePath = normalizeRelativePath(entry.sourcePath, "release sourcePath");
    entry.targetPath = normalizeRelativePath(entry.targetPath, "release targetPath");
    if (
      entry.targetPath === ".git" ||
      entry.targetPath.startsWith(".git/") ||
      entry.targetPath === ".document-harness/runtime" ||
      entry.targetPath.startsWith(".document-harness/runtime/") ||
      RECEIPT_RE.test(entry.targetPath)
    ) {
      throw new HarnessAdoptError(`release target uses a reserved path: ${entry.targetPath}`, {
        status: "NEEDS_DECISION",
        code: "RESERVED_RELEASE_PATH",
      });
    }
    if (!Array.isArray(entry.profiles) || entry.profiles.length === 0) {
      throw new HarnessAdoptError(`release entry has no profile: ${entry.targetPath}`, {
        status: "NEEDS_DECISION",
        code: "INVALID_RELEASE_MANIFEST",
      });
    }
    for (const profile of entry.profiles) {
      if (!knownProfiles.has(profile)) {
        throw new HarnessAdoptError(`release entry references an unknown profile: ${profile}`, {
          status: "NEEDS_DECISION",
          code: "INVALID_RELEASE_MANIFEST",
        });
      }
      usedProfiles.add(profile);
    }
    if (entry.ownership !== undefined && !["harness-managed", "project-owned"].includes(entry.ownership)) {
      throw new HarnessAdoptError(`unsupported release ownership: ${entry.ownership}`, {
        status: "NEEDS_DECISION",
        code: "INVALID_RELEASE_MANIFEST",
      });
    }
    if (
      entry.generator !== undefined &&
      ![
        "repository-view-config-v1",
        "repository-adoption-profile-v1",
        "repository-governance-catalog-v1",
      ].includes(entry.generator)
    ) {
      throw new HarnessAdoptError(`unsupported release generator: ${entry.generator}`, {
        status: "NEEDS_DECISION",
        code: "INVALID_RELEASE_MANIFEST",
      });
    }
    if (targetPaths.has(entry.targetPath) || folded.has(entry.targetPath.toLocaleLowerCase("en"))) {
      throw new HarnessAdoptError(`duplicate or case-colliding target path: ${entry.targetPath}`, {
        status: "NEEDS_DECISION",
        code: "CASE_COLLISION",
      });
    }
    targetPaths.add(entry.targetPath);
    folded.add(entry.targetPath.toLocaleLowerCase("en"));
  }
  for (const profile of knownProfiles) {
    if (!usedProfiles.has(profile)) {
      throw new HarnessAdoptError(`release profile has no files: ${profile}`, {
        status: "NEEDS_DECISION",
        code: "INVALID_RELEASE_MANIFEST",
      });
    }
  }
  manifest.verification.requiredInstalledPaths = requiredInstalledPaths.map((filePath) =>
    normalizeRelativePath(filePath, "required installed path")
  );
  for (const requiredPath of manifest.verification.requiredInstalledPaths) {
    if (!targetPaths.has(requiredPath)) {
      throw new HarnessAdoptError(`required installed path is absent from the release: ${requiredPath}`, {
        status: "NEEDS_DECISION",
        code: "INVALID_RELEASE_MANIFEST",
      });
    }
  }
}

function resolveProfileSelection(manifest, requestedProfiles) {
  const known = new Set(manifest.profiles ?? []);
  const selected = new Set();
  const visiting = new Set();
  const visit = (profile) => {
    if (selected.has(profile)) return;
    if (visiting.has(profile)) {
      throw new HarnessAdoptError(`cyclic adoption profile dependency: ${profile}`, {
        status: "NEEDS_DECISION",
        code: "INVALID_RELEASE_MANIFEST",
      });
    }
    if (!known.has(profile)) {
      throw new HarnessAdoptError(`unknown adoption profile: ${profile}`, {
        status: "NEEDS_DECISION",
        code: "UNKNOWN_PROFILE",
      });
    }
    visiting.add(profile);
    for (const dependency of manifest.profileDependencies?.[profile] ?? []) visit(dependency);
    visiting.delete(profile);
    selected.add(profile);
  };
  for (const profile of requestedProfiles) {
    visit(profile);
  }
  return [...selected].sort();
}

function selectedRelease(manifest, requestedProfiles) {
  const resolvedProfiles = resolveProfileSelection(manifest, requestedProfiles);
  const files = manifest.files
    .filter((entry) => entry.profiles.some((profile) => resolvedProfiles.includes(profile)))
    .map((entry) => {
      const source = path.join(PUBLIC_ROOT, ...entry.sourcePath.split("/"));
      if (!existsSync(source) || !lstatSync(source).isFile() || lstatSync(source).isSymbolicLink()) {
        throw new HarnessAdoptError(`selected release source is missing or unsafe: ${entry.sourcePath}`, {
          status: "NEEDS_DECISION",
          code: "MISSING_RELEASE_SOURCE",
        });
      }
      const bytes = readFileSync(source);
      return {
        ...entry,
        profiles: [...entry.profiles].sort(),
        mode: entry.mode ?? "0644",
        generator: entry.generator ?? null,
        artifactType: entry.artifactType ?? "runtime",
        requestedProfiles: resolvedProfiles,
        sha256: sha256(bytes),
      };
    })
    .sort((a, b) => a.targetPath.localeCompare(b.targetPath, "en"));
  const manifestBytes = readFileSync(RELEASE_MANIFEST_PATH);
  const sourceRevision = sha256(
    canonicalJson(files.map(({ sourcePath, targetPath, profiles, mode, generator, artifactType, sha256: digest }) => ({
      sourcePath,
      targetPath,
      profiles,
      mode,
      generator,
      artifactType,
      sha256: digest,
    }))),
  );
  return {
    id: manifest.releaseId,
    version: manifest.version,
    manifestSha256: sha256(manifestBytes),
    sourceRevision,
    files,
  };
}

function repositoryGenerationContext(root, revision = currentRevision(root)) {
  const status = runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { encoding: "utf8" });
  const relevantChanges = status
    .split("\0")
    .filter(Boolean)
    .map((entry) => (entry.length >= 4 && entry[2] === " " ? entry.slice(3) : entry))
    .filter((changedPath) => !isIgnoredFencePath(changedPath));
  return {
    targetRevision: revision,
    workingTreeState: relevantChanges.length === 0 ? "clean" : "dirty",
    capturedAt: revision === "UNBORN"
      ? "1970-01-01T00:00:00.000Z"
      : runGit(root, ["show", "-s", "--format=%cI", revision], { encoding: "utf8" }).trim(),
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inspectRepositoryViewConfigUpgrade(root, sourceConfig) {
  const configFile = safeAbsolute(root, VIEW_CONFIG_PATH);
  const info = lstatIfPresent(configFile);
  if (!info) return { state: "absent", bytes: null };
  if (!info.isFile() || info.isSymbolicLink()) return { state: "unsafe", bytes: null };

  let current;
  try {
    current = JSON.parse(readFileSync(configFile, "utf8"));
  } catch {
    return { state: "unsafe", bytes: null };
  }
  if (!isPlainObject(current)) return { state: "unsafe", bytes: null };
  if (typeof current.initiativeRegister === "string" && current.initiativeRegister.length > 0) {
    return { state: "current", bytes: null };
  }
  if (Object.hasOwn(current, "initiativeRegister")) {
    return { state: "unsafe", bytes: null };
  }

  const legacyShapeIsSafe = (
    current.schemaVersion === SCHEMA_VERSION &&
    isPlainObject(current.project) &&
    ["id", "name", "description"].every((key) => typeof current.project[key] === "string" && current.project[key].length > 0) &&
    typeof current.governanceCatalog === "string" && current.governanceCatalog.length > 0 &&
    current.bindHost === "127.0.0.1" &&
    current.portMode === "auto" &&
    isPlainObject(current.qualityCommands) &&
    ["fast", "full", "continuous"].every((key) => typeof current.qualityCommands[key] === "string" && current.qualityCommands[key].length > 0) &&
    Array.isArray(current.probes)
  );
  if (!legacyShapeIsSafe || typeof sourceConfig.initiativeRegister !== "string" || sourceConfig.initiativeRegister.length === 0) {
    return { state: "unsafe", bytes: null };
  }

  const migrated = {};
  for (const [key, value] of Object.entries(current)) {
    migrated[key] = value;
    if (key === "governanceCatalog") migrated.initiativeRegister = sourceConfig.initiativeRegister;
  }
  return { state: "add-initiative-register-v1", bytes: Buffer.from(prettyJson(migrated)) };
}

function repositoryViewConfigUpgradeForRelease(root, releaseEntry) {
  if (releaseEntry.generator !== "repository-view-config-v1") return null;
  const source = path.join(PUBLIC_ROOT, ...releaseEntry.sourcePath.split("/"));
  return inspectRepositoryViewConfigUpgrade(root, JSON.parse(readFileSync(source, "utf8")));
}

function materializeReleaseEntry(root, releaseEntry, generationContext = null) {
  const source = path.join(PUBLIC_ROOT, ...releaseEntry.sourcePath.split("/"));
  const sourceBytes = readFileSync(source);
  if (!releaseEntry.generator) return { bytes: sourceBytes, sha256: sha256(sourceBytes) };
  if (releaseEntry.generator === "repository-view-config-v1") {
    const config = JSON.parse(sourceBytes.toString("utf8"));
    const upgrade = inspectRepositoryViewConfigUpgrade(root, config);
    if (upgrade.state === "add-initiative-register-v1") {
      return { bytes: upgrade.bytes, sha256: sha256(upgrade.bytes) };
    }
    const repositoryName = path.basename(root);
    config.project = {
      id: repositoryName,
      name: repositoryName,
      description: `${repositoryName} 저장소 전용 읽기 전용 document-harness 제어 화면입니다.`,
    };
    const bytes = Buffer.from(prettyJson(config));
    return { bytes, sha256: sha256(bytes) };
  }
  if (releaseEntry.generator === "repository-adoption-profile-v1") {
    const repositoryName = path.basename(root);
    const repositoryPlaceholder = ["{{", "REPOSITORY_ID", "}}"].join("");
    const profileLines = releaseEntry.requestedProfiles.map((profile) => `  - ${profile}`).join("\n");
    const rendered = sourceBytes
      .toString("utf8")
      .replace(`repository_id: "${repositoryPlaceholder}"`, `repository_id: ${JSON.stringify(repositoryName)}`)
      .replace(/profiles:\n(?:  - [^\n]+\n)+/, `profiles:\n${profileLines}\n`)
      .replace("installation_lock: docs/_indexes/harness-installation.yaml", `installation_lock: ${INSTALLATION_LOCK_PATH}`);
    if (rendered.includes(repositoryPlaceholder)) {
      throw new HarnessAdoptError("repository adoption profile template was not fully rendered", {
        status: "NEEDS_DECISION",
        code: "GENERATOR_TEMPLATE_MISMATCH",
      });
    }
    const bytes = Buffer.from(rendered);
    return { bytes, sha256: sha256(bytes) };
  }
  if (releaseEntry.generator === "repository-governance-catalog-v1") {
    const context = generationContext ?? repositoryGenerationContext(root);
    const catalog = JSON.parse(sourceBytes.toString("utf8"));
    catalog.migration = {
      status: "awaiting_human_review",
      capturedRepository: {
        baseCommit: context.targetRevision === "UNBORN" ? "0".repeat(40) : context.targetRevision,
        workingTreeState: context.workingTreeState,
      },
      capturedAt: context.capturedAt,
      approvalRule: "AI가 추출한 후보는 소스 해시로 고정된 사람의 결정 영수증이 존재하기 전까지 승인되지 않은 상태로 유지합니다.",
    };
    catalog.direction = [];
    catalog.policies = [];
    catalog.guidelines = [];
    catalog.attention = [
      {
        id: "ATTN-POLICY-EXTRACTION",
        severity: "decision",
        title: "저장소 정책 추출 결과를 사람이 검토해야 합니다",
        humanSummary: "아직 적용 중인 정책은 없습니다. 소스와 연결된 후보를 추출하고 승격 전에 사람이 검토해야 합니다.",
        relatedRefs: [],
      },
      {
        id: "ATTN-INITIATIVE-EXTRACTION",
        severity: "decision",
        title: "기존 업무를 어떤 추진안으로 묶을지 확인해 주세요",
        humanSummary: "정책과 지침을 실제 업무로 잇는 추진안 후보가 아직 없습니다. 기존 프로젝트와 설계 근거를 분석한 뒤 후보를 검토하거나, 근거가 부족한 이유를 확인해야 합니다.",
        relatedRefs: [INITIATIVE_REGISTER_PATH],
      },
    ];
    catalog.gaps = [
      {
        id: "GAP-POLICY-EXTRACTION",
        summary: "소스와 연결된 정책 후보를 아직 사람이 검토하지 않았습니다.",
        reason: "초기화 도구는 저장소 정책을 임의로 만들거나 스스로 승인하지 않습니다.",
      },
      {
        id: "GAP-INITIATIVE-EXTRACTION",
        summary: "기존 프로젝트를 정책·지침과 연결하는 추진안 후보를 아직 만들지 않았습니다.",
        reason: "AI는 기존 문서와 코드에서 결과·범위·성공 기준을 근거와 함께 추출할 수 있지만, 추진안을 임의로 발급하거나 승인할 수 없습니다.",
      },
    ];
    const bytes = Buffer.from(prettyJson(catalog));
    return { bytes, sha256: sha256(bytes) };
  }
  throw new HarnessAdoptError(`unsupported release generator: ${releaseEntry.generator}`, {
    status: "NEEDS_DECISION",
    code: "UNSUPPORTED_GENERATOR",
  });
}

function lstatIfPresent(file) {
  try {
    return lstatSync(file);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function recordedFileModeValid(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0o777;
}

function safeAbsolute(root, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const parts = normalized.split("/");
  let cursor = root;
  for (let index = 0; index < parts.length; index += 1) {
    const parentInfo = lstatIfPresent(cursor);
    if (parentInfo) {
      if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
        throw new HarnessAdoptError(`non-directory parent blocks adoption path: ${normalized}`, {
          status: "NEEDS_DECISION",
          code: parentInfo.isSymbolicLink() ? "SYMLINK_CONFLICT" : "PATH_CONFLICT",
        });
      }
      const requested = parts[index];
      const folded = requested.toLocaleLowerCase("en");
      const alias = readdirSync(cursor).find((entry) => (
        entry !== requested && entry.toLocaleLowerCase("en") === folded
      ));
      if (alias) {
        throw new HarnessAdoptError(`path segment differs only by case: ${alias} vs ${requested} (${normalized})`, {
          status: "NEEDS_DECISION",
          code: "CASE_COLLISION",
        });
      }
    }
    cursor = path.join(cursor, parts[index]);
    const info = lstatIfPresent(cursor);
    if (!info) continue;
    if (info.isSymbolicLink()) {
      throw new HarnessAdoptError(`symlink is not an adoption write surface: ${normalized}`, {
        status: "NEEDS_DECISION",
        code: "SYMLINK_CONFLICT",
      });
    }
    if (index < parts.length - 1 && !info.isDirectory()) {
      throw new HarnessAdoptError(`non-directory parent blocks adoption path: ${normalized}`, {
        status: "NEEDS_DECISION",
        code: "PATH_CONFLICT",
      });
    }
  }
  const absolute = path.resolve(root, ...parts);
  if (!(absolute === root || absolute.startsWith(`${root}${path.sep}`))) {
    throw new HarnessAdoptError(`path escapes target repository: ${normalized}`, {
      status: "NEEDS_DECISION",
      code: "UNSAFE_PATH",
    });
  }
  return absolute;
}

function mutationAnchorDescriptor(mutation) {
  const descriptor = {
    path: mutation.path,
    existed: mutation.existed,
    beforeSha256: mutation.beforeSha256,
    beforeMode: mutation.beforeMode,
    afterMode: mutation.afterMode,
    preimageBase64: mutation.preimageBase64,
  };
  if (mutation.path !== INSTALLATION_LOCK_PATH) descriptor.afterSha256 = mutation.afterSha256;
  return descriptor;
}

function buildApplyMutationSet(mutations) {
  const descriptors = mutations
    .map(mutationAnchorDescriptor)
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
  return {
    algorithm: "sha256",
    count: descriptors.length,
    paths: descriptors.map(({ path: mutationPath }) => mutationPath),
    sha256: sha256(canonicalJson(descriptors)),
  };
}

function applyMutationSetShapeValid(value) {
  if (
    value?.algorithm !== "sha256" ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    !Array.isArray(value.paths) ||
    value.paths.length !== value.count ||
    new Set(value.paths).size !== value.paths.length ||
    typeof value.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.sha256)
  ) return false;
  try {
    if (value.paths.some((mutationPath) => normalizeRelativePath(mutationPath, "anchored mutation path") !== mutationPath)) return false;
  } catch {
    return false;
  }
  return (
    canonicalJson(value.paths) === canonicalJson([...value.paths].sort((a, b) => a.localeCompare(b, "en"))) &&
    value.paths.includes(INSTALLATION_LOCK_PATH)
  );
}

function applyMutationSetMatches(anchor, mutations) {
  return applyMutationSetShapeValid(anchor) && canonicalJson(anchor) === canonicalJson(buildApplyMutationSet(mutations));
}

function readLock(root) {
  let lockFile;
  try {
    lockFile = safeAbsolute(root, INSTALLATION_LOCK_PATH);
  } catch (error) {
    if (["CASE_COLLISION", "SYMLINK_CONFLICT", "PATH_CONFLICT"].includes(error.code)) {
      return { state: "invalid", lock: null, reason: error.message };
    }
    throw error;
  }
  if (!lstatIfPresent(lockFile)) return { state: "missing", lock: null };
  try {
    const lock = JSON.parse(readFileSync(lockFile, "utf8"));
    const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
    const text = (value) => typeof value === "string" && value.length > 0;
    const relative = (value, label) => {
      try {
        return normalizeRelativePath(value, label) === value;
      } catch {
        return false;
      }
    };
    const releaseValid = (
      lock?.release &&
      text(lock.release.id) &&
      text(lock.release.version) &&
      hash(lock.release.manifestSha256) &&
      hash(lock.release.sourceRevision)
    );
    const profilesValid = (
      Array.isArray(lock?.profiles) &&
      lock.profiles.length > 0 &&
      lock.profiles.every(text) &&
      new Set(lock.profiles).size === lock.profiles.length
    );
    const filesValid = Array.isArray(lock?.files) && lock.files.every((entry) => (
      entry &&
      relative(entry.path, "installation lock file path") &&
      ["harness-managed", "project-owned", "generated", "runtime-local"].includes(entry.ownership) &&
      (entry.upstreamBaselineSha256 === null || hash(entry.upstreamBaselineSha256)) &&
      (entry.installedSha256 === null || hash(entry.installedSha256)) &&
      (entry.generator === null || text(entry.generator)) &&
      ["runtime", "template", "generated"].includes(entry.artifactType) &&
      Array.isArray(entry.profiles) && entry.profiles.every(text) &&
      [420, 493, null].includes(entry.installedMode)
    ));
    const pathsUnique = filesValid && new Set(lock.files.map(({ path: filePath }) => filePath)).size === lock.files.length;
    // schemaVersion 1 locks emitted before mutation anchoring remain readable so an
    // explicit upgrade can replace them. Rollback fails closed until that upgrade.
    const mutationSetValid = lock?.applyMutationSet === undefined || applyMutationSetShapeValid(lock.applyMutationSet);
    if (
      lock?.schemaVersion !== SCHEMA_VERSION ||
      !releaseValid ||
      !Number.isInteger(lock?.migrationGeneration) || lock.migrationGeneration < 1 ||
      !hash(lock?.planHash) ||
      !text(lock?.targetSourceRevision) ||
      !profilesValid ||
      Number.isNaN(Date.parse(lock?.installedAt ?? "")) ||
      !relative(lock?.receiptRef, "installation receipt ref") ||
      !filesValid ||
      !pathsUnique ||
      !mutationSetValid
    ) {
      return { state: "invalid", lock: null, reason: "installation lock shape is invalid" };
    }
    return { state: "valid", lock };
  } catch (error) {
    return { state: "invalid", lock: null, reason: error.message };
  }
}

function classifyTarget(snapshot, lockState) {
  if (lockState.state === "invalid") return { mode: "stopped", repositoryState: "unknown" };
  if (lockState.state === "valid") return { mode: "upgrade", repositoryState: "installed" };
  if (snapshot.inventory.length === 0) return { mode: "initialize", repositoryState: "new" };
  const matureMarkers = snapshot.inventory.some(({ path: candidate }) =>
    candidate === "AGENTS.md" ||
    candidate === "CLAUDE.md" ||
    candidate.startsWith("docs/") ||
    candidate.startsWith(".agents/") ||
    candidate.startsWith(".claude/")
  );
  return matureMarkers
    ? { mode: "migrate", repositoryState: "mature" }
    : { mode: "migrate", repositoryState: "mature" };
}

function pathState(root, targetPath) {
  try {
    const absolute = safeAbsolute(root, targetPath);
    const info = lstatIfPresent(absolute);
    if (!info) return { exists: false, sha256: null, mode: null, type: "missing" };
    if (!info.isFile() || info.isSymbolicLink()) {
      return { exists: true, sha256: null, mode: info.mode & 0o777, type: info.isSymbolicLink() ? "symlink" : "non-file" };
    }
    return { exists: true, sha256: sha256(readFileSync(absolute)), mode: info.mode & 0o777, type: "file" };
  } catch (error) {
    return { exists: true, sha256: null, mode: null, type: "unsafe", error: error.message };
  }
}

function buildAction(root, releaseFile, installedEntry, generationContext) {
  const actionGenerationContext = releaseFile.generator === "repository-governance-catalog-v1"
    ? generationContext
    : null;
  const materialized = materializeReleaseEntry(root, releaseFile, actionGenerationContext);
  const viewConfigUpgrade = repositoryViewConfigUpgradeForRelease(root, releaseFile);
  const before = pathState(root, releaseFile.targetPath);
  const desiredMode = Number.parseInt(releaseFile.mode, 8);
  const contentAndModeCurrent = before.sha256 === materialized.sha256 && before.mode === desiredMode;
  const base = {
    path: releaseFile.targetPath,
    sourcePath: releaseFile.sourcePath,
    profiles: releaseFile.profiles,
    ownership: releaseFile.ownership ?? (releaseFile.generator ? "generated" : "harness-managed"),
    beforeSha256: before.sha256,
    beforeMode: before.mode,
    afterSha256: materialized.sha256,
    mode: releaseFile.mode,
    generator: releaseFile.generator,
    generationContext: actionGenerationContext,
    artifactType: releaseFile.artifactType,
  };
  if (!before.exists) {
    return { ...base, action: "ADD", reason: "release file is absent", rollbackAction: "REMOVE_ADDED" };
  }
  if (before.type !== "file") {
    return {
      ...base,
      ownership: "project-owned",
      action: "CONFLICT",
      reason: `existing path is ${before.type}${before.error ? `: ${before.error}` : ""}`,
      rollbackAction: "NONE",
    };
  }
  if (!installedEntry && releaseFile.ownership === "project-owned") {
    return {
      ...base,
      ownership: "project-owned",
      action: "KEEP_PROJECT_OWNED",
      reason: "project-owned instruction surface already exists and is preserved",
      rollbackAction: "NONE",
    };
  }
  if (!installedEntry) {
    if (!releaseFile.generator && before.sha256 === materialized.sha256) {
      return {
        ...base,
        ownership: "project-owned",
        action: "GRANDFATHER",
        reason: "same bytes exist without an installation baseline; preserve as project-owned",
        rollbackAction: "NONE",
      };
    }
    return {
      ...base,
      ownership: "project-owned",
      action: "CONFLICT",
      reason: "same-name file exists without a trusted installation baseline",
      rollbackAction: "NONE",
    };
  }
  if (viewConfigUpgrade?.state === "unsafe") {
    return {
      ...base,
      ownership: "project-owned",
      action: "CONFLICT",
      reason: "repository-specific View config has no valid initiativeRegister and cannot be upgraded additively without changing project-owned settings",
      rollbackAction: "NONE",
    };
  }
  if (installedEntry.ownership === "project-owned") {
    if (viewConfigUpgrade?.state === "add-initiative-register-v1") {
      return {
        ...base,
        ownership: "project-owned",
        action: "UPDATE_UNMODIFIED",
        reason: "add the required initiativeRegister field while preserving repository-specific View settings",
        rollbackAction: "RESTORE_PREIMAGE",
      };
    }
    return {
      ...base,
      ownership: "project-owned",
      action: "KEEP_PROJECT_OWNED",
      reason: "installation lock assigns the file to the project",
      rollbackAction: "NONE",
    };
  }
  if (installedEntry.ownership === "generated" && releaseFile.generator) {
    const trustedHash = installedEntry.installedSha256 ?? installedEntry.upstreamBaselineSha256;
    if (before.sha256 !== trustedHash && before.sha256 !== materialized.sha256) {
      if (viewConfigUpgrade?.state === "add-initiative-register-v1") {
        return {
          ...base,
          ownership: "project-owned",
          action: "UPDATE_UNMODIFIED",
          reason: "add the required initiativeRegister field while preserving repository-specific View settings",
          rollbackAction: "RESTORE_PREIMAGE",
        };
      }
      if ([GOVERNANCE_CATALOG_PATH, VIEW_CONFIG_PATH].includes(releaseFile.targetPath)) {
        return {
          ...base,
          ownership: "project-owned",
          action: "KEEP_PROJECT_OWNED",
          reason: `${releaseFile.targetPath === GOVERNANCE_CATALOG_PATH ? "source-linked governance catalog" : "repository-specific View config"} changed after installation and remains project-owned state`,
          rollbackAction: "NONE",
        };
      }
      return {
        ...base,
        action: "CONFLICT",
        reason: "generated file changed after installation",
        rollbackAction: "NONE",
      };
    }
    return {
      ...base,
      action: "UPDATE_UNMODIFIED",
      reason: contentAndModeCurrent
        ? "generated bytes are already current"
        : before.sha256 === materialized.sha256
          ? "generated bytes are current but the installed mode requires repair"
        : "generated baseline is unmodified and may be rebuilt",
      rollbackAction: contentAndModeCurrent ? "NONE" : "RESTORE_PREIMAGE",
    };
  }
  if (installedEntry.ownership === "generated" || installedEntry.ownership === "runtime-local") {
    return {
      ...base,
      ownership: installedEntry.ownership,
      action: "DEFER",
      reason: "generated/runtime-local bytes are not replaced by release copy actions",
      rollbackAction: "NONE",
    };
  }
  const trustedHash = installedEntry.installedSha256 ?? installedEntry.upstreamBaselineSha256;
  if (before.sha256 !== trustedHash && before.sha256 !== materialized.sha256) {
    return {
      ...base,
      action: "CONFLICT",
      reason: "harness-managed file changed after installation",
      rollbackAction: "NONE",
    };
  }
  return {
    ...base,
    action: "UPDATE_UNMODIFIED",
    reason: contentAndModeCurrent
      ? "release bytes are already present"
      : before.sha256 === materialized.sha256
        ? "release bytes are present but the installed mode requires repair"
      : "installed baseline is unmodified and may be upgraded",
    rollbackAction: contentAndModeCurrent ? "NONE" : "RESTORE_PREIMAGE",
  };
}

function caseCollidingInventoryPath(inventory, targetPath) {
  const foldedTarget = targetPath.toLocaleLowerCase("en");
  return inventory.find(({ path: inventoryPath }) =>
    inventoryPath !== targetPath && inventoryPath.toLocaleLowerCase("en") === foldedTarget
  )?.path ?? null;
}

function buildReleaseActions(root, inventory, release, lock) {
  const lockEntries = new Map((lock?.files ?? []).map((entry) => [entry.path, entry]));
  const generationContext = repositoryGenerationContext(root, currentRevision(root));
  return release.files.map((entry) => {
    const action = buildAction(root, entry, lockEntries.get(entry.targetPath), generationContext);
    const collidingPath = caseCollidingInventoryPath(inventory, entry.targetPath);
    if (!collidingPath) return action;
    return {
      ...action,
      ownership: "project-owned",
      action: "CONFLICT",
      reason: `existing project path differs only by case: ${collidingPath}`,
      rollbackAction: "NONE",
    };
  });
}

function relativeLocator(fromDirectory, targetRoot) {
  const relative = path.relative(fromDirectory, targetRoot).replaceAll(path.sep, "/");
  return relative || ".";
}

function assertOutputOutsideTarget(output, targetRoot) {
  const absolute = path.resolve(output);
  if (absolute === targetRoot || absolute.startsWith(`${targetRoot}${path.sep}`)) {
    throw new HarnessAdoptError("plan output must be outside the target repository to preserve plan-time write zero", {
      status: "NEEDS_DECISION",
      code: "PLAN_OUTPUT_IN_TARGET",
    });
  }
}

function canonicalOutputPath(output) {
  const absolute = path.resolve(output);
  const parent = path.dirname(absolute);
  if (!existsSync(parent) || !statSync(parent).isDirectory()) {
    throw new HarnessAdoptError("plan output parent directory must already exist", {
      status: "NEEDS_DECISION",
      code: "MISSING_OUTPUT_PARENT",
    });
  }
  return path.join(realpathSync(parent), path.basename(absolute));
}

function hashPlan(plan) {
  const copy = structuredClone(plan);
  delete copy.planHash;
  return sha256(canonicalJson(copy));
}

function atomicWrite(file, bytes, mode = 0o644) {
  const parent = path.dirname(file);
  mkdirSync(parent, { recursive: true });
  const temporary = path.join(parent, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(temporary, bytes, { mode });
    chmodSync(temporary, mode);
    renameSync(temporary, file);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}

export function writeJsonAtomic(file, value) {
  atomicWrite(file, Buffer.from(prettyJson(value)), 0o644);
}

function protectedGovernanceReferenceIndex(root) {
  const references = new Map();
  try {
    const catalogFile = safeAbsolute(root, GOVERNANCE_CATALOG_PATH);
    const info = lstatIfPresent(catalogFile);
    if (!info?.isFile() || info.isSymbolicLink()) return references;
    const catalog = JSON.parse(readFileSync(catalogFile, "utf8"));
    for (const collectionName of ["policies", "guidelines"]) {
      const candidates = Array.isArray(catalog?.[collectionName]) ? catalog[collectionName] : [];
      candidates.forEach((candidate, index) => {
        if (
          !candidate ||
          typeof candidate !== "object" ||
          (candidate.approvalState !== "approved" && candidate.authorityState !== "effective")
        ) return;
        const candidateId = typeof candidate.id === "string" && candidate.id.trim().length > 0
          ? candidate.id
          : `${collectionName}[${index}]`;
        const addReference = (value, referenceKind) => {
          if (typeof value !== "string" || value.length === 0) return;
          try {
            const referencePath = normalizeRelativePath(value, `${candidateId} ${referenceKind}`);
            if (referencePath === GOVERNANCE_CATALOG_PATH) return;
            const indexed = references.get(referencePath) ?? {
              candidateIds: new Set(),
              referenceKinds: new Set(),
            };
            indexed.candidateIds.add(candidateId);
            indexed.referenceKinds.add(referenceKind);
            references.set(referencePath, indexed);
          } catch {
            // Invalid catalog references are reported by verify; planning must remain deterministic.
          }
        };
        addReference(candidate.effectiveRef, "effectiveRef");
        for (const sourceRef of Array.isArray(candidate.sourceRefs) ? candidate.sourceRefs : []) {
          addReference(sourceRef?.path, "sourceRefs[].path");
        }
      });
    }
  } catch {
    // Missing or invalid catalogs are handled by normal install/verify contracts.
  }
  return references;
}

function approvedGovernanceMutationAttention(root, actions) {
  const references = protectedGovernanceReferenceIndex(root);
  return actions
    .filter(({ action }) => ["ADD", "UPDATE_UNMODIFIED"].includes(action))
    .filter(({ path: actionPath }) => actionPath !== GOVERNANCE_CATALOG_PATH)
    .filter(({ beforeSha256, afterSha256 }) => beforeSha256 !== afterSha256)
    .flatMap(({ path: actionPath }) => {
      const reference = references.get(actionPath);
      if (!reference) return [];
      return [{
        code: "APPROVED_GOVERNANCE_SOURCE_MUTATION",
        path: actionPath,
        candidateIds: [...reference.candidateIds].sort((a, b) => a.localeCompare(b, "en")),
        referenceKinds: [...reference.referenceKinds].sort((a, b) => a.localeCompare(b, "en")),
        message: "release upgrade가 승인·효력 상태인 거버넌스의 근거 또는 효력 경로 bytes를 변경합니다. 현재 근거를 보존하거나 새로운 인간 결정을 받은 뒤 다시 plan 하세요.",
      }];
    })
    .sort((a, b) => a.path.localeCompare(b.path, "en"));
}

function evaluatePlanState({ snapshot, profiles, lockState, actions }) {
  const classification = classifyTarget(snapshot, lockState);
  const attention = [];
  if (profiles.includes("governance") && snapshot.revision === "UNBORN") {
    attention.push({
      code: "UNBORN_REPOSITORY",
      message: "governance initialization requires a resolvable base commit; create an initial commit and re-plan",
    });
  }
  if (lockState.state === "invalid") {
    attention.push({ code: "INVALID_INSTALLATION_LOCK", message: lockState.reason });
  }
  const removedProfiles = (lockState.lock?.profiles ?? []).filter((profile) => !profiles.includes(profile));
  if (removedProfiles.length > 0) {
    attention.push({
      code: "PROFILE_REMOVAL_UNSUPPORTED",
      message: `profile removal requires an explicit future release migration: ${removedProfiles.join(", ")}`,
    });
  }
  for (const action of actions.filter(({ action }) => action === "CONFLICT")) {
    attention.push({ code: "FILE_CONFLICT", path: action.path, message: action.reason });
  }
  if (profiles.includes("governance")) {
    attention.push(...approvedGovernanceMutationAttention(snapshot.root, actions));
  }
  return {
    ...classification,
    status: attention.length > 0 ? "NEEDS_DECISION" : "PLAN_READY",
    attention,
  };
}

export function createPlan({ target, profiles, output }) {
  if (!output) {
    throw new HarnessAdoptError("plan requires --output", {
      status: "NEEDS_DECISION",
      code: "MISSING_OUTPUT",
    });
  }
  if (!Array.isArray(profiles)) {
    throw new HarnessAdoptError("plan requires at least one adoption profile", {
      status: "NEEDS_DECISION",
      code: "MISSING_PROFILE",
    });
  }
  if (profiles.length === 0 || profiles.some((profile) => typeof profile !== "string" || profile.trim().length === 0)) {
    throw new HarnessAdoptError("plan requires at least one distinct, non-empty adoption profile", {
      status: "NEEDS_DECISION",
      code: "MISSING_PROFILE",
    });
  }
  const requestedProfiles = [...new Set(profiles.map((profile) => profile.trim()))].sort();
  const snapshot = inspectTarget(target);
  const outputFile = canonicalOutputPath(output);
  assertOutputOutsideTarget(outputFile, snapshot.root);
  const manifest = loadReleaseManifest();
  const resolvedProfiles = resolveProfileSelection(manifest, requestedProfiles);
  const release = selectedRelease(manifest, resolvedProfiles);
  const lockState = readLock(snapshot.root);
  const actions = buildReleaseActions(snapshot.root, snapshot.inventory, release, lockState.lock);
  const evaluation = evaluatePlanState({
    snapshot,
    profiles: resolvedProfiles,
    lockState,
    actions,
  });
  const plan = {
    schemaVersion: SCHEMA_VERSION,
    command: "plan",
    status: evaluation.status,
    mode: evaluation.mode,
    repositoryState: evaluation.repositoryState,
    requestedProfiles,
    profiles: resolvedProfiles,
    target: {
      locator: relativeLocator(path.dirname(outputFile), snapshot.root),
      identity: snapshot.identity,
      revision: snapshot.revision,
      dirtyFingerprint: snapshot.dirtyFingerprint,
      inventorySha256: snapshot.inventorySha256,
    },
    release: {
      id: release.id,
      version: release.version,
      manifestSha256: release.manifestSha256,
      sourceRevision: release.sourceRevision,
    },
    installationLockPath: INSTALLATION_LOCK_PATH,
    actions,
    attention: evaluation.attention,
  };
  plan.planHash = hashPlan(plan);
  writeJsonAtomic(outputFile, plan);
  return plan;
}

function readAndValidatePlan(planFile) {
  const plan = loadJson(planFile, "adoption plan");
  if (
    plan?.schemaVersion !== SCHEMA_VERSION ||
    plan.command !== "plan" ||
    !Array.isArray(plan.actions) ||
    !Array.isArray(plan.attention) ||
    !Array.isArray(plan.requestedProfiles) ||
    !Array.isArray(plan.profiles) ||
    plan.installationLockPath !== INSTALLATION_LOCK_PATH
  ) {
    throw new HarnessAdoptError("adoption plan shape is invalid", {
      status: "NEEDS_DECISION",
      code: "INVALID_PLAN",
    });
  }
  if (plan.planHash !== hashPlan(plan)) {
    throw new HarnessAdoptError("adoption plan content does not match planHash", {
      status: "NEEDS_DECISION",
      code: "PLAN_HASH_MISMATCH",
    });
  }
  for (const [label, profiles] of [
    ["requestedProfiles", plan.requestedProfiles],
    ["profiles", plan.profiles],
  ]) {
    if (
      profiles.length === 0 ||
      profiles.some((profile) => typeof profile !== "string" || profile.length === 0) ||
      new Set(profiles).size !== profiles.length ||
      canonicalJson(profiles) !== canonicalJson([...profiles].sort())
    ) {
      throw new HarnessAdoptError(`plan ${label} must be a non-empty, unique, sorted profile list`, {
        status: "NEEDS_DECISION",
        code: "INVALID_PLAN",
      });
    }
  }
  if (
    typeof plan.target?.locator !== "string" ||
    plan.target.locator.length === 0 ||
    plan.target.locator.includes("\0") ||
    path.isAbsolute(plan.target.locator)
  ) {
    throw new HarnessAdoptError("plan target locator must be relative to the plan file", {
      status: "NEEDS_DECISION",
      code: "INVALID_TARGET_LOCATOR",
    });
  }
  const orderedPaths = plan.actions.map(({ path: actionPath }) => actionPath);
  if (
    new Set(orderedPaths).size !== orderedPaths.length ||
    canonicalJson(orderedPaths) !== canonicalJson([...orderedPaths].sort((a, b) => a.localeCompare(b, "en")))
  ) {
    throw new HarnessAdoptError("plan actions must have unique, deterministically sorted paths", {
      status: "NEEDS_DECISION",
      code: "NONDETERMINISTIC_PLAN",
    });
  }
  for (const action of plan.actions) {
    if (!ALLOWED_ACTIONS.includes(action.action)) {
      throw new HarnessAdoptError(`unsupported plan action: ${action.action}`, {
        status: "NEEDS_DECISION",
        code: "INVALID_PLAN_ACTION",
      });
    }
    normalizeRelativePath(action.path, "plan action path");
  }
  return plan;
}

function receiptRelativePath(planHash) {
  return `docs/receipts/harness-apply-${planHash.slice(0, 16)}.json`;
}

function captureMutation(root, relativePath, afterBytes, mode) {
  const absolute = safeAbsolute(root, relativePath);
  const info = lstatIfPresent(absolute);
  const existed = info !== null;
  if (info && (!info.isFile() || info.isSymbolicLink())) {
    throw new HarnessAdoptError(`mutation path is not a regular file: ${relativePath}`, {
      status: "NEEDS_DECISION",
      code: info.isSymbolicLink() ? "SYMLINK_CONFLICT" : "PATH_CONFLICT",
    });
  }
  const beforeBytes = existed ? readFileSync(absolute) : null;
  const beforeMode = existed ? (info.mode & 0o777) : null;
  return {
    path: relativePath,
    existed,
    beforeSha256: beforeBytes ? sha256(beforeBytes) : null,
    afterSha256: sha256(afterBytes),
    beforeMode,
    afterMode: mode,
    preimageBase64: beforeBytes ? beforeBytes.toString("base64") : null,
  };
}

function applyMutation(root, mutation, bytes) {
  atomicWrite(safeAbsolute(root, mutation.path), bytes, mutation.afterMode);
}

function restoreMutation(root, mutation) {
  const absolute = safeAbsolute(root, mutation.path);
  if (mutation.existed) {
    atomicWrite(absolute, Buffer.from(mutation.preimageBase64, "base64"), mutation.beforeMode ?? 0o644);
  } else if (lstatIfPresent(absolute)) {
    rmSync(absolute, { force: true });
  }
}

function sameFence(plan, snapshot) {
  return (
    plan.target.identity === snapshot.identity &&
    plan.target.revision === snapshot.revision &&
    plan.target.dirtyFingerprint === snapshot.dirtyFingerprint &&
    plan.target.inventorySha256 === snapshot.inventorySha256
  );
}

function sameReleaseFence(plan, release) {
  return canonicalJson(plan.release) === canonicalJson({
    id: release.id,
    version: release.version,
    manifestSha256: release.manifestSha256,
    sourceRevision: release.sourceRevision,
  });
}

function mutationsMatch(root, receipt) {
  return (receipt.mutations ?? []).every((mutation) => {
    const current = pathState(root, mutation.path);
    return current.type === "file" && current.sha256 === mutation.afterSha256 && current.mode === mutation.afterMode;
  });
}

function postApplyFenceMatches(snapshot, receipt) {
  return (
    receipt?.postApplyFence?.revision === snapshot.revision &&
    receipt.postApplyFence.dirtyFingerprint === snapshot.dirtyFingerprint &&
    receipt.postApplyFence.inventorySha256 === snapshot.inventorySha256
  );
}

function successfulApplyReceiptMatches({ root, plan, release, snapshot, receipt }) {
  try {
    const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
    const expectedStatus = successfulApplyStatus(plan);
    const lockState = readLock(root);
    if (lockState.state !== "valid") return false;
    const lock = lockState.lock;
    const expectedReceiptRef = receiptRelativePath(plan.planHash);
    if (
      plan.status !== "PLAN_READY" ||
      plan.actions.some(({ action }) => action === "CONFLICT") ||
      receipt?.schemaVersion !== SCHEMA_VERSION ||
      receipt.command !== "apply" ||
      receipt.status !== expectedStatus ||
      receipt.applyResult !== "applied" ||
      receipt.planHash !== plan.planHash ||
      receipt.targetIdentity !== sha256(root) ||
      receipt.targetLocator !== "../.." ||
      receipt.installationLockPath !== INSTALLATION_LOCK_PATH ||
      canonicalJson(receipt.release) !== canonicalJson(plan.release) ||
      canonicalJson(receipt.profiles) !== canonicalJson(plan.profiles) ||
      Number.isNaN(Date.parse(receipt.installedAt ?? "")) ||
      !Array.isArray(receipt.mutations) ||
      receipt.writes !== receipt.mutations.length + 1 ||
      receipt.rollback?.attempted !== false ||
      receipt.rollback?.result !== "not_requested" ||
      canonicalJson(lock.release) !== canonicalJson(plan.release) ||
      canonicalJson(lock.profiles) !== canonicalJson(plan.profiles) ||
      lock.planHash !== plan.planHash ||
      lock.targetSourceRevision !== plan.target.revision ||
      lock.installedAt !== receipt.installedAt ||
      lock.receiptRef !== expectedReceiptRef ||
      receipt.applyId !== sha256(`${plan.planHash}:${lock.migrationGeneration}`).slice(0, 24) ||
      !sameReleaseFence(plan, release) ||
      auditInstallationInventory(lock, release).length > 0 ||
      !postApplyFenceMatches(snapshot, receipt) ||
      !mutationsMatch(root, receipt) ||
      !applyMutationSetMatches(lock.applyMutationSet, receipt.mutations)
    ) return false;

    const actionByPath = new Map(plan.actions.map((action) => [action.path, action]));
    const expectedMutationPaths = new Set([
      ...plan.actions
        .filter((action) => ["ADD", "UPDATE_UNMODIFIED"].includes(action.action))
        .filter((action) => action.beforeSha256 !== action.afterSha256 || action.beforeMode !== Number.parseInt(action.mode, 8))
        .map(({ path: actionPath }) => actionPath),
      INSTALLATION_LOCK_PATH,
    ]);
    const actualMutationPaths = new Set();
    for (const mutation of receipt.mutations) {
      if (
        normalizeRelativePath(mutation?.path, "apply receipt mutation path") !== mutation.path ||
        actualMutationPaths.has(mutation.path) ||
        typeof mutation.existed !== "boolean" ||
        !hash(mutation.afterSha256) ||
        ![0o644, 0o755].includes(mutation.afterMode)
      ) return false;
      actualMutationPaths.add(mutation.path);
      if (mutation.existed) {
        if (
          !hash(mutation.beforeSha256) ||
          !recordedFileModeValid(mutation.beforeMode) ||
          typeof mutation.preimageBase64 !== "string"
        ) return false;
        const preimage = Buffer.from(mutation.preimageBase64, "base64");
        if (preimage.toString("base64") !== mutation.preimageBase64 || sha256(preimage) !== mutation.beforeSha256) return false;
      } else if (
        mutation.beforeSha256 !== null ||
        mutation.beforeMode !== null ||
        mutation.preimageBase64 !== null
      ) return false;

      if (mutation.path === INSTALLATION_LOCK_PATH) {
        if (mutation.afterSha256 !== sha256(readFileSync(safeAbsolute(root, INSTALLATION_LOCK_PATH)))) return false;
        continue;
      }
      const action = actionByPath.get(mutation.path);
      if (
        !action ||
        !["ADD", "UPDATE_UNMODIFIED"].includes(action.action) ||
        mutation.beforeSha256 !== action.beforeSha256 ||
        mutation.beforeMode !== action.beforeMode ||
        mutation.afterSha256 !== action.afterSha256 ||
        mutation.afterMode !== Number.parseInt(action.mode, 8)
      ) return false;
    }
    return (
      actualMutationPaths.size === expectedMutationPaths.size &&
      [...expectedMutationPaths].every((mutationPath) => actualMutationPaths.has(mutationPath))
    );
  } catch {
    return false;
  }
}

function buildInstallationLock({ plan, previousLock, receiptRef, installedAt, actions, applyMutationSet }) {
  const entries = new Map((previousLock?.files ?? []).map((entry) => [entry.path, entry]));
  for (const action of actions) {
    if (["ADD", "UPDATE_UNMODIFIED"].includes(action.action)) {
      entries.set(action.path, {
        path: action.path,
        ownership: action.ownership,
        upstreamBaselineSha256: action.afterSha256,
        installedSha256: action.afterSha256,
        generator: action.generator ?? `harness-adopt@${plan.release.version}`,
        artifactType: action.artifactType ?? "runtime",
        profiles: action.profiles,
        installedMode: Number.parseInt(action.mode, 8),
      });
    } else if (["KEEP_PROJECT_OWNED", "GRANDFATHER"].includes(action.action)) {
      entries.set(action.path, {
        path: action.path,
        ownership: "project-owned",
        upstreamBaselineSha256: action.afterSha256,
        installedSha256: action.beforeSha256,
        generator: null,
        artifactType: action.artifactType ?? "runtime",
        profiles: action.profiles,
        installedMode: action.mode ? Number.parseInt(action.mode, 8) : null,
      });
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    release: plan.release,
    migrationGeneration: (previousLock?.migrationGeneration ?? 0) + 1,
    planHash: plan.planHash,
    targetSourceRevision: plan.target.revision,
    profiles: plan.profiles,
    installedAt,
    receiptRef,
    applyMutationSet,
    files: [...entries.values()].sort((a, b) => a.path.localeCompare(b.path, "en")),
  };
}

function successfulApplyStatus(plan) {
  return plan.profiles.includes("governance")
    ? "INSTALLED_AWAITING_REVIEW"
    : "INSTALLED_NOT_VERIFIED";
}

function resolvePlanTarget(planFile, plan) {
  const root = path.resolve(path.dirname(path.resolve(planFile)), plan.target.locator);
  return resolveRepositoryRoot(root);
}

export function applyPlan({ planFile, expectedPlanHash, failureAfter = null }) {
  const plan = readAndValidatePlan(path.resolve(planFile));
  if (plan.planHash !== expectedPlanHash) {
    throw new HarnessAdoptError("--expect-plan-hash does not match the signed plan", {
      status: "NEEDS_DECISION",
      code: "EXPECTED_PLAN_HASH_MISMATCH",
    });
  }
  const root = resolvePlanTarget(planFile, plan);
  const snapshot = inspectTarget(root);
  if (!sameFence(plan, snapshot)) {
    const receiptRef = receiptRelativePath(plan.planHash);
    const receiptFile = safeAbsolute(root, receiptRef);
    if (lstatIfPresent(receiptFile)) {
      const existing = loadJson(receiptFile, "apply receipt");
      const idempotencyRelease = selectedRelease(loadReleaseManifest(), plan.profiles);
      if (successfulApplyReceiptMatches({
        root,
        plan,
        release: idempotencyRelease,
        snapshot,
        receipt: existing,
      })) return { ...existing, command: "apply", alreadyApplied: true, writes: 0 };
    }
    throw new HarnessAdoptError("target revision, index, or byte fence changed after planning", {
      status: "NEEDS_DECISION",
      code: "TARGET_FENCE_MISMATCH",
    });
  }
  const manifest = loadReleaseManifest();
  const resolvedProfiles = resolveProfileSelection(manifest, plan.requestedProfiles);
  if (canonicalJson(plan.profiles) !== canonicalJson(resolvedProfiles)) {
    throw new HarnessAdoptError("plan profiles do not match the requested profile dependency closure", {
      status: "NEEDS_DECISION",
      code: "PLAN_PROFILE_MISMATCH",
    });
  }
  const release = selectedRelease(manifest, resolvedProfiles);
  if (!sameReleaseFence(plan, release)) {
    throw new HarnessAdoptError("public release manifest or source bytes changed after planning", {
      status: "NEEDS_DECISION",
      code: "RELEASE_FENCE_MISMATCH",
    });
  }
  const previousLockState = readLock(root);
  const expectedActions = buildReleaseActions(root, snapshot.inventory, release, previousLockState.lock);
  if (canonicalJson(plan.actions) !== canonicalJson(expectedActions)) {
    throw new HarnessAdoptError("plan actions do not match the current release and ownership calculation", {
      status: "NEEDS_DECISION",
      code: "PLAN_ACTION_MISMATCH",
    });
  }
  const evaluation = evaluatePlanState({
    snapshot,
    profiles: resolvedProfiles,
    lockState: previousLockState,
    actions: expectedActions,
  });
  if (
    plan.status !== evaluation.status ||
    plan.mode !== evaluation.mode ||
    plan.repositoryState !== evaluation.repositoryState ||
    canonicalJson(plan.attention) !== canonicalJson(evaluation.attention)
  ) {
    throw new HarnessAdoptError("plan decision state does not match the current repository and requested profile intent", {
      status: "NEEDS_DECISION",
      code: "PLAN_DECISION_MISMATCH",
      details: evaluation.attention,
    });
  }
  if (evaluation.status !== "PLAN_READY") {
    return {
      schemaVersion: SCHEMA_VERSION,
      command: "apply",
      status: "NEEDS_DECISION",
      planHash: plan.planHash,
      writes: 0,
      attention: evaluation.attention,
    };
  }
  const receiptRef = receiptRelativePath(plan.planHash);
  const receiptFile = safeAbsolute(root, receiptRef);
  const releaseByTarget = new Map(release.files.map((entry) => [entry.targetPath, entry]));
  for (const action of plan.actions) {
    const current = pathState(root, action.path);
    if (current.sha256 !== action.beforeSha256 || (action.beforeSha256 === null && current.exists)) {
      throw new HarnessAdoptError(`action preimage fence changed: ${action.path}`, {
        status: "NEEDS_DECISION",
        code: "ACTION_FENCE_MISMATCH",
      });
    }
  }
  const installedAt = new Date().toISOString();
  const mutations = [];
  let appliedCount = 0;
  const requestedFailureInjection = process.env.HARNESS_ADOPT_TEST_FAIL_AFTER;
  if ((requestedFailureInjection !== undefined || failureAfter !== null) && process.env.NODE_ENV !== "test") {
    throw new HarnessAdoptError("failure injection is available only when NODE_ENV=test", {
      status: "NEEDS_DECISION",
      code: "TEST_HOOK_REJECTED",
    });
  }
  const failAfter = failureAfter ?? (
    requestedFailureInjection !== undefined ? Number(requestedFailureInjection) : null
  );
  try {
    for (const action of plan.actions) {
      if (!["ADD", "UPDATE_UNMODIFIED"].includes(action.action)) continue;
      const releaseEntry = releaseByTarget.get(action.path);
      if (!releaseEntry) {
        throw new Error(`release source missing for action: ${action.path}`);
      }
      const { bytes } = materializeReleaseEntry(root, releaseEntry, action.generationContext);
      if (sha256(bytes) !== action.afterSha256) {
        throw new HarnessAdoptError(`generated release bytes do not match the planned after hash: ${action.path}`, {
          status: "NEEDS_DECISION",
          code: "GENERATED_BYTES_MISMATCH",
        });
      }
      const mode = Number.parseInt(action.mode, 8);
      const mutation = captureMutation(root, action.path, bytes, mode);
      if (
        mutation.beforeSha256 !== action.beforeSha256 ||
        mutation.beforeMode !== action.beforeMode ||
        mutation.existed !== (action.beforeSha256 !== null)
      ) {
        throw new HarnessAdoptError(`action preimage changed immediately before write: ${action.path}`, {
          status: "NEEDS_DECISION",
          code: "ACTION_FENCE_MISMATCH",
        });
      }
      if (
        mutation.beforeSha256 !== mutation.afterSha256 ||
        mutation.beforeMode !== mutation.afterMode ||
        !mutation.existed
      ) {
        applyMutation(root, mutation, bytes);
        mutations.push(mutation);
      }
      appliedCount += 1;
      if (Number.isInteger(failAfter) && failAfter >= 0 && appliedCount >= failAfter) {
        throw new Error(`injected failure after ${appliedCount} release action(s)`);
      }
    }
    const lockPreimage = captureMutation(root, INSTALLATION_LOCK_PATH, Buffer.alloc(0), 0o644);
    const applyMutationSet = buildApplyMutationSet([...mutations, lockPreimage]);
    const lock = buildInstallationLock({
      plan,
      previousLock: previousLockState.lock,
      receiptRef,
      installedAt,
      actions: plan.actions,
      applyMutationSet,
    });
    const lockBytes = Buffer.from(prettyJson(lock));
    const lockMutation = captureMutation(root, INSTALLATION_LOCK_PATH, lockBytes, 0o644);
    if (!applyMutationSetMatches(applyMutationSet, [...mutations, lockMutation])) {
      throw new Error("internal apply mutation-set anchor mismatch");
    }
    applyMutation(root, lockMutation, lockBytes);
    mutations.push(lockMutation);
    const postApplySnapshot = inspectTarget(root);
    const receipt = {
      schemaVersion: SCHEMA_VERSION,
      command: "apply",
      status: successfulApplyStatus(plan),
      applyResult: "applied",
      applyId: sha256(`${plan.planHash}:${lock.migrationGeneration}`).slice(0, 24),
      planHash: plan.planHash,
      targetIdentity: plan.target.identity,
      targetLocator: "../..",
      release: plan.release,
      profiles: plan.profiles,
      installedAt,
      postApplyFence: {
        revision: postApplySnapshot.revision,
        dirtyFingerprint: postApplySnapshot.dirtyFingerprint,
        inventorySha256: postApplySnapshot.inventorySha256,
      },
      writes: mutations.length + 1,
      mutations,
      rollback: { attempted: false, result: "not_requested" },
      installationLockPath: INSTALLATION_LOCK_PATH,
    };
    writeJsonAtomic(receiptFile, receipt);
    return receipt;
  } catch (error) {
    const rollbackErrors = [];
    for (const mutation of [...mutations].reverse()) {
      try {
        const current = pathState(root, mutation.path);
        if (current.type !== "file" || current.sha256 !== mutation.afterSha256 || current.mode !== mutation.afterMode) {
          rollbackErrors.push({
            path: mutation.path,
            message: "postimage changed before automatic rollback; preserved concurrent bytes",
            expected: mutation.afterSha256,
            actual: current.sha256,
            expectedMode: mutation.afterMode,
            actualMode: current.mode,
          });
          continue;
        }
        restoreMutation(root, mutation);
      } catch (rollbackError) {
        rollbackErrors.push({ path: mutation.path, message: rollbackError.message });
      }
    }
    const failureReceipt = {
      schemaVersion: SCHEMA_VERSION,
      command: "apply",
      status: "APPLY_FAILED",
      applyResult: "failed",
      planHash: plan.planHash,
      targetIdentity: plan.target.identity,
      targetLocator: "../..",
      release: plan.release,
      profiles: plan.profiles,
      failedAt: new Date().toISOString(),
      writes: mutations.length,
      mutations,
      failure: { message: error.message },
      rollback: {
        attempted: true,
        result: rollbackErrors.length === 0 ? "restored" : "incomplete",
        errors: rollbackErrors,
      },
      installationLockPath: INSTALLATION_LOCK_PATH,
    };
    writeJsonAtomic(receiptFile, failureReceipt);
    return failureReceipt;
  }
}

function scanInstalledContent(root, lock) {
  const findings = [];
  const placeholderPattern = /\{\{[A-Z0-9_]+\}\}/;
  const personalAbsolutePattern = /(?:\/Users\/[^/\s]+\/|\/home\/[^/\s]+\/)/;
  const globalSkillPattern = /(?:\$HOME|~)\/\.(?:codex|claude|agents)\/skills\//;
  for (const entry of lock.files) {
    let absolute;
    try {
      absolute = safeAbsolute(root, entry.path);
    } catch (error) {
      findings.push({ code: error.code, path: entry.path, message: error.message });
      continue;
    }
    if (!existsSync(absolute) || !lstatSync(absolute).isFile() || lstatSync(absolute).isSymbolicLink()) {
      findings.push({ code: "MISSING_INSTALLED_FILE", path: entry.path, message: "installed path is missing or not a regular file" });
      continue;
    }
    const bytes = readFileSync(absolute);
    const digest = sha256(bytes);
    const mutableProjectState = (
      (entry.path === GOVERNANCE_CATALOG_PATH && lock.profiles.includes("governance")) ||
      (entry.path === VIEW_CONFIG_PATH && lock.profiles.includes("view")) ||
      entry.ownership === "project-owned"
    );
    if (digest !== entry.installedSha256 && !mutableProjectState) {
      findings.push({ code: "INSTALLED_HASH_MISMATCH", path: entry.path, expected: entry.installedSha256, actual: digest });
    }
    const actualMode = lstatSync(absolute).mode & 0o777;
    if (Number.isInteger(entry.installedMode) && actualMode !== entry.installedMode) {
      findings.push({ code: "INSTALLED_MODE_MISMATCH", path: entry.path, expected: entry.installedMode, actual: actualMode });
    }
    if (["harness-managed", "generated"].includes(entry.ownership)) {
      const text = bytes.toString("utf8");
      if (entry.artifactType !== "template" && placeholderPattern.test(text)) findings.push({ code: "UNRESOLVED_PLACEHOLDER", path: entry.path });
      if (personalAbsolutePattern.test(text)) findings.push({ code: "PERSONAL_ABSOLUTE_PATH", path: entry.path });
      if (globalSkillPattern.test(text)) findings.push({ code: "USER_GLOBAL_SKILL_PATH", path: entry.path });
    }
  }
  return findings;
}

function auditInstallationInventory(lock, release) {
  const findings = [];
  const expected = new Map(release.files.map((entry) => [entry.targetPath, entry]));
  const installed = new Map(lock.files.map((entry) => [entry.path, entry]));
  for (const [filePath, releaseEntry] of expected) {
    const entry = installed.get(filePath);
    if (!entry) {
      findings.push({ code: "INSTALLATION_INVENTORY_MISSING", path: filePath });
      continue;
    }
    const expectedMode = Number.parseInt(releaseEntry.mode, 8);
    if (entry.installedMode !== expectedMode) {
      findings.push({ code: "INSTALLATION_INVENTORY_MODE", path: filePath, expected: expectedMode, actual: entry.installedMode });
    }
    if (entry.artifactType !== releaseEntry.artifactType) {
      findings.push({ code: "INSTALLATION_INVENTORY_ARTIFACT", path: filePath, expected: releaseEntry.artifactType, actual: entry.artifactType });
    }
    if (canonicalJson(entry.profiles) !== canonicalJson(releaseEntry.profiles)) {
      findings.push({ code: "INSTALLATION_INVENTORY_PROFILES", path: filePath });
    }
    if (releaseEntry.ownership === "project-owned" && entry.ownership !== "project-owned") {
      findings.push({ code: "INSTALLATION_INVENTORY_OWNERSHIP", path: filePath, expected: "project-owned", actual: entry.ownership });
    } else if (releaseEntry.generator && !["generated", "project-owned"].includes(entry.ownership)) {
      findings.push({ code: "INSTALLATION_INVENTORY_OWNERSHIP", path: filePath, expected: "generated|project-owned", actual: entry.ownership });
    } else if (!releaseEntry.generator && releaseEntry.ownership !== "project-owned" && !["harness-managed", "project-owned"].includes(entry.ownership)) {
      findings.push({ code: "INSTALLATION_INVENTORY_OWNERSHIP", path: filePath, expected: "harness-managed|project-owned", actual: entry.ownership });
    }
    if (entry.ownership === "harness-managed") {
      if (entry.installedSha256 !== releaseEntry.sha256 || entry.upstreamBaselineSha256 !== releaseEntry.sha256) {
        findings.push({ code: "INSTALLATION_INVENTORY_BASELINE", path: filePath });
      }
    }
    if (entry.ownership === "generated" && entry.generator !== releaseEntry.generator) {
      findings.push({ code: "INSTALLATION_INVENTORY_GENERATOR", path: filePath, expected: releaseEntry.generator, actual: entry.generator });
    }
  }
  for (const filePath of installed.keys()) {
    if (!expected.has(filePath)) findings.push({ code: "INSTALLATION_INVENTORY_UNEXPECTED", path: filePath });
  }
  return findings;
}

function tokenCount(text, token) {
  return text.split(token).length - 1;
}

function auditProjectOwnedGovernanceAuthoringContracts(root, lock) {
  const findings = [];
  const installed = new Map(lock.files.map((entry) => [entry.path, entry]));
  const contracts = [
    {
      path: "AGENTS.md",
      checks: [
        {
          capability: "Codex can discover the canonical repository-local document-harness skill",
          matches: (text) => (
            text.includes(".agents/skills/operate-document-harness/SKILL.md")
            || (/operate-document-harness/i.test(text) && /repository-local|저장소(?:에|의)?\s*(?:전용|로컬)/i.test(text))
          ),
        },
        {
          capability: "Codex is routed through the durable adoption and execution governance entrypoints",
          matches: (text) => text.includes("docs/ADOPT.md") && text.includes("docs/EXECUTE.md"),
        },
      ],
    },
    {
      path: "CLAUDE.md",
      checks: [
        {
          capability: "Claude delegates harness operation to repository instructions or the canonical repository-local skill",
          matches: (text) => (
            text.includes(".agents/skills/operate-document-harness/SKILL.md")
            || (text.includes("AGENTS.md") && /operate-document-harness|doc(?:ument)?[- ]harness/i.test(text))
          ),
        },
        {
          capability: "Claude is routed through the durable adoption and execution governance entrypoints",
          matches: (text) => text.includes("docs/ADOPT.md") && text.includes("docs/EXECUTE.md"),
        },
      ],
    },
    {
      path: "docs/bin/new-doc.sh",
      checks: [
        {
          capability: "initiative issuance requires an exact human approval ref",
          matches: (text) => (
            text.includes("initiative)") &&
            text.includes("_templates/initiative.md") &&
            text.includes("issuance_approval_ref") &&
            text.includes("validate_issuance_approval_ref")
          ),
        },
        {
          capability: "project issuance resolves an active approved Initiative",
          matches: (text) => (
            text.includes("project)") &&
            text.includes("related_initiative") &&
            tokenCount(text, "require_active_approved_initiative") >= 2
          ),
        },
        {
          capability: "project/task issuance calls a deterministic source-fenced Initiative activation authority validator",
          matches: (text) => (
            text.includes("initiative-authority.mjs") &&
            text.includes("INITIATIVE_AUTHORITY_VALIDATOR") &&
            /node\s+"?\$INITIATIVE_AUTHORITY_VALIDATOR"?/.test(text)
          ),
        },
        {
          capability: "task issuance resolves Project to modern Initiative lineage",
          matches: (text) => (
            text.includes("task)") &&
            text.includes("related_project") &&
            tokenCount(text, "require_task_parent_lineage") >= 2
          ),
        },
      ],
    },
    {
      path: "docs/_templates/project.md",
      checks: [
        {
          capability: "Project template declares lineage_contract v2",
          matches: (text) => /^lineage_contract:\s*v2\s*$/m.test(text),
        },
        {
          capability: "Project template renders canonical Initiative lineage",
          matches: (text) => (
            /^related_initiative:\s*\{\{RELATED_INITIATIVE\}\}\s*$/m.test(text) &&
            /^initiative_relation:\s*\{\{INITIATIVE_RELATION\}\}\s*$/m.test(text)
          ),
        },
      ],
    },
    {
      path: "docs/_templates/task.md",
      checks: [
        {
          capability: "Task template declares lineage_contract v2",
          matches: (text) => /^lineage_contract:\s*v2\s*$/m.test(text),
        },
        {
          capability: "Task template renders its canonical Project parent",
          matches: (text) => /^related_project:\s*\{\{RELATED_PROJECT\}\}\s*$/m.test(text),
        },
      ],
    },
    {
      path: "docs/bin/validate-closeout.sh",
      checks: [
        {
          capability: "closeout validates active approved Initiative authority",
          matches: (text) => (
            tokenCount(text, "validate_active_approved_initiative_ref") >= 2 &&
            text.includes("initiative_contract") &&
            text.includes("approval_status")
          ),
        },
        {
          capability: "closeout calls a deterministic source-fenced Initiative activation authority validator",
          matches: (text) => (
            text.includes("initiative-authority.mjs") &&
            text.includes("INITIATIVE_AUTHORITY_VALIDATOR") &&
            /node\s+"?\$INITIATIVE_AUTHORITY_VALIDATOR"?/.test(text)
          ),
        },
        {
          capability: "closeout validates Project to Initiative lineage",
          matches: (text) => (
            tokenCount(text, "validate_project_governance_lineage") >= 2 &&
            text.includes("related_initiative")
          ),
        },
        {
          capability: "closeout validates Task to Project to Initiative lineage",
          matches: (text) => (
            tokenCount(text, "validate_task_governance_lineage") >= 2 &&
            text.includes("related_project")
          ),
        },
      ],
    },
  ];

  for (const contract of contracts) {
    if (installed.get(contract.path)?.ownership !== "project-owned") continue;
    const file = safeAbsolute(root, contract.path);
    const info = lstatIfPresent(file);
    if (!info || !info.isFile() || info.isSymbolicLink()) continue;
    const text = readFileSync(file, "utf8");
    const missingCapabilities = contract.checks
      .filter(({ matches }) => !matches(text))
      .map(({ capability }) => capability);
    if (missingCapabilities.length === 0) continue;
    findings.push({
      code: "LEGACY_GOVERNANCE_AUTHORING_CONTRACT",
      path: contract.path,
      message: "project-owned authoring surface does not enforce the current Policy/Guideline -> Initiative -> Project -> Task lineage contract",
      missingCapabilities,
      remediation: "merge the current semantic contract into this project-owned file while preserving repository-specific rules, then run verify again",
    });
  }
  return findings;
}

function expectedGateCommands(root, lock) {
  const commands = new Map();
  if (!lock.profiles.includes("view")) return null;
  const configFile = safeAbsolute(root, VIEW_CONFIG_PATH);
  if (!existsSync(configFile) || !lstatSync(configFile).isFile() || lstatSync(configFile).isSymbolicLink()) return null;
  try {
    const config = JSON.parse(readFileSync(configFile, "utf8"));
    if (
      config?.schemaVersion !== SCHEMA_VERSION ||
      config?.bindHost !== "127.0.0.1" ||
      config?.portMode !== "auto" ||
      typeof config?.qualityCommands !== "object"
    ) return null;
    commands.set("view-doctor", "./runtime/document-harness-view/bin/human-view doctor");
    commands.set("view-test", "./runtime/document-harness-view/bin/human-view test");
    for (const key of ["fast", "full", "continuous"]) {
      const command = config.qualityCommands[key];
      if (typeof command !== "string" || command.length === 0) return null;
      commands.set(`quality-${key}`, command);
    }
    const requiredGateIds = loadReleaseManifest().verification.requiredGateIds;
    return (
      commands.size === requiredGateIds.length &&
      requiredGateIds.every((gateId) => commands.has(gateId))
    ) ? commands : null;
  } catch {
    return null;
  }
}

const SECRET_SOURCE_PATH = /(?:^|\/)(?:\.env(?:\.[^/]*)?|secrets?|credentials?|private[-_.]?keys?|id_rsa(?:\.[^/]*)?|[^/]+\.(?:pem|key|p12|pfx))(?:\/|$)/i;
const CANDIDATE_AUTHORITIES = new Set([
  "repository_instruction", "human_policy", "normative_standard", "current_design", "approved_guide",
  "task_or_receipt", "report_or_history", "code_observation", "config_observation", "unknown",
]);

function jsonValueMatchesType(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && !Array.isArray(value) && typeof value === "object";
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

function resolveLocalSchemaRef(rootSchema, reference) {
  if (typeof reference !== "string" || !reference.startsWith("#/")) {
    throw new Error(`unsupported initiative schema ref: ${reference}`);
  }
  return reference.slice(2).split("/").reduce((current, segment) => (
    current?.[segment.replaceAll("~1", "/").replaceAll("~0", "~")]
  ), rootSchema);
}

function validateJsonSchemaSubset(value, schema, rootSchema, label, errors) {
  if (!schema || typeof schema !== "object") {
    errors.push(`${label}: schema node is unavailable`);
    return;
  }
  if (schema.$ref) {
    validateJsonSchemaSubset(value, resolveLocalSchemaRef(rootSchema, schema.$ref), rootSchema, label, errors);
    return;
  }
  if (Array.isArray(schema.anyOf)) {
    const matched = schema.anyOf.some((branch) => {
      const branchErrors = [];
      validateJsonSchemaSubset(value, branch, rootSchema, label, branchErrors);
      return branchErrors.length === 0;
    });
    if (!matched) errors.push(`${label}: anyOf branches do not match`);
  }
  if (Array.isArray(schema.allOf)) {
    for (const branch of schema.allOf) {
      validateJsonSchemaSubset(value, branch, rootSchema, label, errors);
    }
  }
  if (schema.if) {
    const conditionErrors = [];
    validateJsonSchemaSubset(value, schema.if, rootSchema, label, conditionErrors);
    if (conditionErrors.length === 0 && schema.then) {
      validateJsonSchemaSubset(value, schema.then, rootSchema, label, errors);
    } else if (conditionErrors.length > 0 && schema.else) {
      validateJsonSchemaSubset(value, schema.else, rootSchema, label, errors);
    }
  }

  if (schema.type) {
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowedTypes.some((type) => jsonValueMatchesType(value, type))) {
      errors.push(`${label}: expected ${allowedTypes.join("|")}`);
      return;
    }
  }
  if (Object.hasOwn(schema, "const") && canonicalJson(value) !== canonicalJson(schema.const)) {
    errors.push(`${label}: const does not match`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => canonicalJson(entry) === canonicalJson(value))) {
    errors.push(`${label}: value is outside enum`);
  }
  if (typeof value === "string") {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) errors.push(`${label}: string is too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${label}: pattern does not match`);
  }
  if (typeof value === "number" && Number.isFinite(schema.minimum) && value < schema.minimum) {
    errors.push(`${label}: value is below minimum`);
  }
  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) errors.push(`${label}: array has too few items`);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) errors.push(`${label}: array has too many items`);
    if (schema.uniqueItems === true && new Set(value.map((entry) => canonicalJson(entry))).size !== value.length) {
      errors.push(`${label}: array items are not unique`);
    }
    if (schema.items) {
      value.forEach((entry, index) => validateJsonSchemaSubset(entry, schema.items, rootSchema, `${label}[${index}]`, errors));
    }
  }
  if (value !== null && !Array.isArray(value) && typeof value === "object") {
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) errors.push(`${label}.${required}: required property is missing`);
    }
    const properties = schema.properties ?? {};
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) {
        validateJsonSchemaSubset(value[key], propertySchema, rootSchema, `${label}.${key}`, errors);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) errors.push(`${label}.${key}: additional property is not allowed`);
      }
    }
  }
}

function loadInitiativeRegisterSchema() {
  return JSON.parse(readFileSync(INITIATIVE_REGISTER_SCHEMA_PATH, "utf8"));
}

function parseFrontmatterScalar(raw) {
  const value = raw.trim();
  if (value === "") return null;
  if (value === "[]") return [];
  if (value === "null" || value === "~") return null;
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  return value;
}

function parseMarkdownFrontmatter(bytes, label) {
  const lines = bytes.toString("utf8").split(/\r?\n/);
  if (lines[0] !== "---") throw new Error(`${label} has no YAML frontmatter`);
  const end = lines.indexOf("---", 1);
  if (end < 2) throw new Error(`${label} frontmatter is not closed`);
  const values = {};
  let parent = null;
  for (const line of lines.slice(1, end)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const listItem = line.match(/^ {2}-\s*(.+)$/);
    if (listItem && parent) {
      if (values[parent] === null) values[parent] = [];
      if (!Array.isArray(values[parent])) throw new Error(`${label}#${parent} mixes list and scalar values`);
      values[parent].push(parseFrontmatterScalar(listItem[1]));
      continue;
    }
    const match = line.match(/^(\s*)([A-Za-z0-9_]+):(.*)$/);
    if (!match) continue;
    const [, indentation, key, rawValue] = match;
    if (indentation.length === 0) {
      const value = parseFrontmatterScalar(rawValue);
      values[key] = value;
      parent = value === null ? key : null;
    }
  }
  return values;
}

function parseInitiativeRelationshipTable(bytes, heading, kind, minimumRows) {
  const lines = bytes.toString("utf8").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) throw new Error(`${heading} table is missing`);
  const tableLines = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    if (line.trim().startsWith("|")) tableLines.push(line.trim());
  }
  if (tableLines.length < 2) throw new Error(`${heading} table header is invalid`);
  const rows = tableLines.slice(1).filter((line) => !/^\|[\s:|-]+\|$/.test(line));
  if (rows.length < minimumRows) throw new Error(`${heading} table has too few relationship rows`);
  return rows.map((line) => {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/g, ""));
    if (cells.length !== 4 || cells[0] === "") throw new Error(`${heading} relationship row is invalid`);
    return kind === "policy"
      ? { policyId: cells[0], relation: cells[1], rationale: cells[2], exceptionRef: cells[3] || null }
      : { guidelineId: cells[0], adoption: cells[1], rationale: cells[2], verification: cells[3] };
  });
}

function sortedInitiativeRelationships(items, idField) {
  return [...items].sort((left, right) => String(left[idField]).localeCompare(String(right[idField]), "en"));
}

function auditGovernanceCatalog(root) {
  const findings = [];
  const file = safeAbsolute(root, GOVERNANCE_CATALOG_PATH);
  if (!existsSync(file) || !lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) {
    return { findings: [{ code: "GOVERNANCE_CATALOG_UNAVAILABLE", path: GOVERNANCE_CATALOG_PATH }], reviewed: false, catalog: null, bytes: null };
  }
  const bytes = readFileSync(file);
  let catalog;
  try {
    catalog = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { findings: [{ code: "INVALID_GOVERNANCE_CATALOG_JSON", path: GOVERNANCE_CATALOG_PATH }], reviewed: false, catalog: null, bytes };
  }
  const migration = catalog?.migration;
  const baseCommit = migration?.capturedRepository?.baseCommit;
  if (
    catalog?.schemaVersion !== SCHEMA_VERSION ||
    !["awaiting_human_review", "reviewed", "stale", "degraded"].includes(migration?.status) ||
    !/^[a-f0-9]{40}$/.test(baseCommit ?? "") ||
    !["clean", "dirty", "unknown"].includes(migration?.capturedRepository?.workingTreeState) ||
    Number.isNaN(Date.parse(migration?.capturedAt ?? "")) ||
    typeof migration?.approvalRule !== "string" || migration.approvalRule.length === 0 ||
    !Array.isArray(catalog?.direction) ||
    !Array.isArray(catalog?.policies) ||
    !Array.isArray(catalog?.guidelines) ||
    !Array.isArray(catalog?.attention) ||
    !Array.isArray(catalog?.gaps)
  ) {
    findings.push({ code: "INVALID_GOVERNANCE_CATALOG_SHAPE", path: GOVERNANCE_CATALOG_PATH });
    return { findings, reviewed: false, catalog, bytes };
  }
  try {
    execFileSync("git", ["-C", root, "cat-file", "-e", `${baseCommit}^{commit}`], { stdio: "ignore" });
  } catch {
    findings.push({ code: "UNRESOLVABLE_MIGRATION_BASE", path: GOVERNANCE_CATALOG_PATH, revision: baseCommit });
  }
  const candidates = [...catalog.policies, ...catalog.guidelines];
  const ids = new Set();
  for (const candidate of candidates) {
    const candidatePath = `${GOVERNANCE_CATALOG_PATH}#${candidate?.id ?? "unknown"}`;
    const requiredText = ["id", "title", "humanSummary"].every((field) => typeof candidate?.[field] === "string" && candidate[field].length > 0);
    const candidateShape = (
      requiredText &&
      ["policy", "guideline", "observation"].includes(candidate?.kind) &&
      CANDIDATE_AUTHORITIES.has(candidate?.authorityClass) &&
      ["proposed", "accepted_for_promotion", "effective", "superseded"].includes(candidate?.authorityState) &&
      ["unreviewed", "review_requested", "approved", "rejected", "stale", "superseded"].includes(candidate?.approvalState) &&
      ["enforced", "partially_enforced", "advisory", "not_implemented", "unknown"].includes(candidate?.enforcement) &&
      ["low", "medium", "high"].includes(candidate?.confidence) &&
      Array.isArray(candidate?.sourceRefs) && candidate.sourceRefs.length > 0 &&
      Array.isArray(candidate?.conflicts)
    );
    if (!candidateShape || ids.has(candidate?.id)) {
      findings.push({ code: "INVALID_OR_DUPLICATE_POLICY_CANDIDATE", path: candidatePath });
      continue;
    }
    ids.add(candidate.id);
    const observation = ["code_observation", "config_observation"].includes(candidate.authorityClass);
    if (observation && (
      candidate.kind !== "observation" || candidate.approvalState !== "unreviewed" ||
      candidate.effectiveRef !== null || candidate.decisionReceiptRef !== null
    )) findings.push({ code: "OBSERVATION_PROMOTED_WITHOUT_POLICY_AUTHORITY", path: candidatePath });
    if (candidate.approvalState === "approved" && (
      typeof candidate.effectiveRef !== "string" || candidate.effectiveRef.length === 0 ||
      typeof candidate.decisionReceiptRef !== "string" || candidate.decisionReceiptRef.length === 0
    )) findings.push({ code: "APPROVED_CANDIDATE_WITHOUT_DECISION", path: candidatePath });
    if (candidate.conflicts.length > 0 && candidate.approvalState === "approved") {
      findings.push({ code: "CONFLICTING_CANDIDATE_AUTO_RESOLVED", path: candidatePath });
    }
    for (const source of candidate.sourceRefs) {
      let sourceFile;
      try {
        if (
          typeof source?.path !== "string" || SECRET_SOURCE_PATH.test(source.path) ||
          typeof source?.heading !== "string" || source.heading.length === 0 ||
          !Number.isInteger(source?.lineStart) || !Number.isInteger(source?.lineEnd) ||
          source.lineStart < 1 || source.lineEnd < source.lineStart ||
          !/^[a-f0-9]{64}$/.test(source?.capturedSha256 ?? "") ||
          source?.capturedRepositoryRevision !== baseCommit
        ) throw new Error("invalid source fence");
        sourceFile = safeAbsolute(root, normalizeRelativePath(source.path, "governance source ref"));
        if (!existsSync(sourceFile) || !lstatSync(sourceFile).isFile() || lstatSync(sourceFile).isSymbolicLink()) throw new Error("unsafe source file");
        const sourceBytes = readFileSync(sourceFile);
        const lineCount = sourceBytes.toString("utf8").split(/\r?\n/).length;
        if (sha256(sourceBytes) !== source.capturedSha256 || source.lineEnd > lineCount) throw new Error("stale source fence");
      } catch (error) {
        findings.push({ code: SECRET_SOURCE_PATH.test(source?.path ?? "") ? "PRIVATE_SOURCE_EXCLUDED" : "STALE_OR_INVALID_SOURCE_REF", path: candidatePath, source: source?.path ?? null, message: error.message });
      }
    }
  }
  const reviewed = migration.status === "reviewed" && typeof migration.receiptRef === "string" && migration.receiptRef.length > 0;
  return { findings, reviewed, catalog, bytes };
}

function initiativeRelationshipsAreValid(initiative, catalog) {
  const policyIds = new Set((catalog?.policies ?? []).filter(({ kind }) => kind === "policy").map(({ id }) => id));
  const guidelinesById = new Map((catalog?.guidelines ?? []).map((item) => [item.id, item]));
  const guidelineIds = new Set(guidelinesById.keys());
  if (!["policyRefs", "policyRelationships", "guidelineRefs", "guidelineRelationships"].every((field) => Array.isArray(initiative?.[field]))) {
    return false;
  }
  const uniquePolicyRefs = new Set(initiative.policyRefs);
  const uniqueGuidelineRefs = new Set(initiative.guidelineRefs);
  const policyRelationshipIds = new Set(initiative.policyRelationships.map((relationship) => relationship?.policyId));
  const guidelineRelationshipIds = new Set(initiative.guidelineRelationships.map((relationship) => relationship?.guidelineId));
  return (
    uniquePolicyRefs.size === initiative.policyRefs.length &&
    uniqueGuidelineRefs.size === initiative.guidelineRefs.length &&
    policyRelationshipIds.size === initiative.policyRelationships.length &&
    guidelineRelationshipIds.size === initiative.guidelineRelationships.length &&
    initiative.policyRelationships.length === initiative.policyRefs.length &&
    initiative.guidelineRelationships.length === initiative.guidelineRefs.length &&
    initiative.policyRefs.every((id) => typeof id === "string" && policyIds.has(id) && policyRelationshipIds.has(id)) &&
    initiative.guidelineRefs.every((id) => typeof id === "string" && guidelineIds.has(id) && guidelineRelationshipIds.has(id)) &&
    initiative.policyRelationships.every((relationship) => (
      typeof relationship?.rationale === "string" && relationship.rationale.length > 0 &&
      ["advances", "constrained-by", "exception-to"].includes(relationship?.relation) &&
      (relationship.relation === "exception-to"
        ? typeof relationship.exceptionRef === "string" && relationship.exceptionRef.length > 0
        : relationship.exceptionRef === null)
    )) &&
    initiative.guidelineRelationships.every((relationship) => (
      ["required", "recommended"].includes(relationship?.adoption) &&
      typeof relationship?.rationale === "string" && relationship.rationale.length > 0 &&
      typeof relationship?.verification === "string" && relationship.verification.length > 0 &&
      (guidelinesById.get(relationship.guidelineId)?.policyRefs ?? []).some((policyRef) => initiative.policyRefs.includes(policyRef))
    )) &&
    ["linked", "no_applicable_guideline", "needs_review"].includes(initiative.guidelineDisposition) &&
    (initiative.guidelineDisposition !== "linked" || initiative.guidelineRefs.length > 0) &&
    (initiative.guidelineDisposition !== "no_applicable_guideline" || initiative.guidelineRefs.length === 0)
  );
}

function initiativeLegacyRefsAreValid(root, initiative) {
  if (!Array.isArray(initiative?.legacyProjectRefs)) return false;
  const seen = new Set();
  return initiative.legacyProjectRefs.every((legacyRef) => {
    try {
      if (
        !/^P[0-9]{4}$/.test(legacyRef?.id ?? "") ||
        seen.has(legacyRef.id) ||
        typeof legacyRef?.path !== "string" ||
        !new RegExp(`^docs/projects/${legacyRef.id}-.+\\.md$`).test(legacyRef.path)
      ) return false;
      seen.add(legacyRef.id);
      const legacyFile = safeAbsolute(root, normalizeRelativePath(legacyRef.path, "legacy project ref"));
      const stat = lstatIfPresent(legacyFile);
      if (!stat || !stat.isFile() || stat.isSymbolicLink()) return false;
      const frontmatter = parseMarkdownFrontmatter(readFileSync(legacyFile), legacyRef.path);
      return frontmatter.type === "project" && frontmatter.doc_id === legacyRef.id;
    } catch {
      return false;
    }
  });
}

function auditInitiativeSourceFence(root, initiative, initiativePath, findings) {
  try {
    execFileSync("git", ["-C", root, "cat-file", "-e", `${initiative.sourceRevision}^{commit}`], { stdio: "ignore" });
  } catch {
    findings.push({
      code: "UNRESOLVABLE_INITIATIVE_SOURCE_REVISION",
      path: initiativePath,
      revision: initiative.sourceRevision,
    });
  }
  for (const source of initiative.sourceRefs ?? []) {
    try {
      if (
        typeof source?.path !== "string" || SECRET_SOURCE_PATH.test(source.path) ||
        typeof source?.heading !== "string" || source.heading.length === 0 ||
        !Number.isInteger(source?.lineStart) || !Number.isInteger(source?.lineEnd) ||
        source.lineStart < 1 || source.lineEnd < source.lineStart ||
        !/^[a-f0-9]{64}$/.test(source?.capturedSha256 ?? "") ||
        source?.capturedRepositoryRevision !== initiative.sourceRevision
      ) throw new Error("invalid initiative source fence");
      const sourceFile = safeAbsolute(root, normalizeRelativePath(source.path, "initiative source ref"));
      const sourceStat = lstatIfPresent(sourceFile);
      if (!sourceStat || !sourceStat.isFile() || sourceStat.isSymbolicLink()) throw new Error("unsafe initiative source file");
      const sourceBytes = readFileSync(sourceFile);
      const lineCount = sourceBytes.toString("utf8").split(/\r?\n/).length;
      if (sha256(sourceBytes) !== source.capturedSha256 || source.lineEnd > lineCount) {
        throw new Error("stale initiative source fence");
      }
      const committedBytes = execFileSync("git", ["-C", root, "show", `${initiative.sourceRevision}:${source.path}`], {
        encoding: null,
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (sha256(committedBytes) !== source.capturedSha256) {
        throw new Error("initiative source fence does not match sourceRevision bytes");
      }
    } catch (error) {
      findings.push({
        code: SECRET_SOURCE_PATH.test(source?.path ?? "")
          ? "PRIVATE_INITIATIVE_SOURCE_EXCLUDED"
          : "STALE_OR_INVALID_INITIATIVE_SOURCE_REF",
        path: initiativePath,
        source: source?.path ?? null,
        message: error.message,
      });
    }
  }
}

function auditNumberedInitiative(root, initiative, initiativePath, findings) {
  let documentBytes;
  let document;
  try {
    if (
      typeof initiative.documentRef !== "string" ||
      SECRET_SOURCE_PATH.test(initiative.documentRef) ||
      !new RegExp(`^docs/initiatives/${initiative.id}-.+\\.md$`).test(initiative.documentRef)
    ) throw new Error("documentRef is not the canonical I#### document path");
    const documentFile = safeAbsolute(root, normalizeRelativePath(initiative.documentRef, "initiative document ref"));
    const documentStat = lstatIfPresent(documentFile);
    if (!documentStat || !documentStat.isFile() || documentStat.isSymbolicLink()) {
      throw new Error("documentRef is not a safe repository regular file");
    }
    documentBytes = readFileSync(documentFile);
    document = parseMarkdownFrontmatter(documentBytes, initiative.documentRef);
    if (
      document.type !== "initiative" ||
      document.doc_id !== initiative.id ||
      document.initiative_contract !== "v1" ||
      document.status !== initiative.lifecycleState ||
      document.approval_status !== initiative.approvalState ||
      document.guideline_disposition !== initiative.guidelineDisposition ||
      document.guideline_disposition_reason !== initiative.guidelineDispositionReason ||
      typeof document.issuance_approval_ref !== "string" || document.issuance_approval_ref.length === 0
    ) throw new Error("document identity, lifecycle, approval, issuance, or guideline mirror does not match the register");
    const documentPolicyRefs = Array.isArray(document.policy_refs) ? [...document.policy_refs].sort() : [];
    const documentGuidelineRefs = Array.isArray(document.guideline_refs) ? [...document.guideline_refs].sort() : [];
    if (
      canonicalJson(documentPolicyRefs) !== canonicalJson([...initiative.policyRefs].sort()) ||
      canonicalJson(documentGuidelineRefs) !== canonicalJson([...initiative.guidelineRefs].sort())
    ) throw new Error("document policy/guideline refs do not match the register");
    const documentPolicies = parseInitiativeRelationshipTable(documentBytes, "## Policy Alignment", "policy", 1);
    const documentGuidelines = parseInitiativeRelationshipTable(documentBytes, "## Guideline Disposition", "guideline", 0);
    if (
      canonicalJson(sortedInitiativeRelationships(documentPolicies, "policyId"))
        !== canonicalJson(sortedInitiativeRelationships(initiative.policyRelationships, "policyId")) ||
      canonicalJson(sortedInitiativeRelationships(documentGuidelines, "guidelineId"))
        !== canonicalJson(sortedInitiativeRelationships(initiative.guidelineRelationships, "guidelineId"))
    ) throw new Error("document relationship tables do not match the register");
  } catch (error) {
    findings.push({ code: "INVALID_NUMBERED_INITIATIVE_DOCUMENT", path: initiativePath, message: error.message });
    return;
  }

  if (["active", "done"].includes(initiative.lifecycleState)) {
    try {
      verifyInitiativeAuthority({ repoRoot: root, initiativeId: initiative.id, allowDone: true });
    } catch (error) {
      findings.push({
        code: "INVALID_NUMBERED_INITIATIVE_LIFECYCLE_AUTHORITY",
        path: initiativePath,
        message: error.message,
      });
    }
  } else if (initiative.approvalState === "approved") {
    const decision = readHumanDecision(root, initiative.decisionReceiptRef, initiative.sourceRevision);
    const sourceHashes = initiative.sourceRefs.map(({ capturedSha256 }) => capturedSha256);
    if (
      initiative.effectiveRef !== initiative.documentRef ||
      document.approval_ref !== initiative.decisionReceiptRef ||
      !decision ||
      decision.candidateId !== initiative.id ||
      decision.decision !== "approved" ||
      !sourceHashes.every((digest) => decision.sourceFence.sourceHashes.includes(digest)) ||
      !decisionEffectiveArtifactMatches(root, decision, initiative.effectiveRef)
    ) {
      findings.push({
        code: "INVALID_NUMBERED_INITIATIVE_APPROVAL_FENCE",
        path: initiativePath,
        message: "approved Initiative effective/document/decision refs do not resolve to one exact human-approved source fence",
      });
    }
  }
}

function auditInitiativeBootstrap(root, governanceAudit) {
  const findings = [];
  const file = safeAbsolute(root, INITIATIVE_REGISTER_PATH);
  if (!existsSync(file) || !lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) {
    return [{ code: "INITIATIVE_REGISTER_UNAVAILABLE", path: INITIATIVE_REGISTER_PATH }];
  }

  let register;
  try {
    register = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return [{ code: "INVALID_INITIATIVE_REGISTER_JSON", path: INITIATIVE_REGISTER_PATH }];
  }
  if (register?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(register?.initiatives)) {
    return [{ code: "INVALID_INITIATIVE_REGISTER_SHAPE", path: INITIATIVE_REGISTER_PATH }];
  }

  let initiativeSchema;
  try {
    initiativeSchema = loadInitiativeRegisterSchema();
    const schemaErrors = [];
    validateJsonSchemaSubset(register, initiativeSchema, initiativeSchema, "initiativeRegister", schemaErrors);
    if (schemaErrors.length > 0) {
      findings.push({
        code: "INVALID_INITIATIVE_REGISTER_SCHEMA",
        path: INITIATIVE_REGISTER_PATH,
        errors: schemaErrors.slice(0, 50),
      });
    }
  } catch (error) {
    return [{ code: "INITIATIVE_REGISTER_SCHEMA_UNAVAILABLE", path: INITIATIVE_REGISTER_PATH, message: error.message }];
  }

  const catalog = governanceAudit?.catalog;
  const attentionEntries = Array.isArray(catalog?.attention) ? catalog.attention : [];
  const gapEntries = Array.isArray(catalog?.gaps) ? catalog.gaps : [];
  const hasInitiativeAttention = attentionEntries.some(({ id, severity }) => (
    id === "ATTN-INITIATIVE-EXTRACTION" && severity === "decision"
  ));
  const hasInitiativeGap = gapEntries.some(({ id }) => id === "GAP-INITIATIVE-EXTRACTION");
  if (hasInitiativeAttention !== hasInitiativeGap) {
    findings.push({
      code: "INCOMPLETE_INITIATIVE_EXTRACTION_GAP",
      path: GOVERNANCE_CATALOG_PATH,
      message: "initiative extraction gap과 decision attention은 함께 존재해야 합니다",
    });
  }

  const candidates = register.initiatives.filter((initiative) => /^INIT-[A-Z0-9][A-Z0-9-]*$/.test(initiative?.id ?? ""));
  const numberedInitiatives = register.initiatives.filter((initiative) => /^I[0-9]{4}$/.test(initiative?.id ?? ""));
  const duplicateIds = register.initiatives.map(({ id }) => id).filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    findings.push({ code: "DUPLICATE_INITIATIVE_ID", path: INITIATIVE_REGISTER_PATH, ids: [...new Set(duplicateIds)] });
  }
  const reviewableCandidates = candidates.filter(({ approvalState }) => ["unreviewed", "review_requested"].includes(approvalState));

  for (const initiative of register.initiatives) {
    const initiativePath = `${INITIATIVE_REGISTER_PATH}#${initiative?.id ?? "unknown"}`;
    const entryErrors = [];
    validateJsonSchemaSubset(initiative, initiativeSchema.$defs.initiative, initiativeSchema, initiativePath, entryErrors);
    const schemaValid = entryErrors.length === 0;

    if (/^INIT-/.test(initiative?.id ?? "")) {
      const requiredText = [
        "title", "humanSummary", "outcome", "whyNow", "owner", "currentFocus",
        "guidelineDisposition", "guidelineDispositionReason", "sourceRevision",
      ].every((field) => typeof initiative?.[field] === "string" && initiative[field].length > 0);
      const requiredArrays = [
        "policyRefs", "policyRelationships", "guidelineRefs", "guidelineRelationships",
        "legacyProjectRefs", "successSignals", "risks", "sourceRefs",
      ].every((field) => Array.isArray(initiative?.[field]));
      const candidateShape = (
        requiredText && requiredArrays && initiative.kind === "initiative" && initiative.lifecycleState === "draft" &&
        ["unreviewed", "review_requested", "rejected", "stale", "superseded"].includes(initiative.approvalState) &&
        initiative.documentRef === null && initiative.effectiveRef === null && initiative.decisionReceiptRef === null &&
        /^[a-f0-9]{40}$/.test(initiative.sourceRevision) && initiative.policyRefs.length > 0 &&
        initiative.legacyProjectRefs.length > 0 && initiative.successSignals.length > 0 && initiative.sourceRefs.length > 0
      );
      if (!candidateShape) {
        findings.push({ code: "INVALID_INITIATIVE_MIGRATION_CANDIDATE", path: initiativePath });
        continue;
      }
    }
    if (!schemaValid) continue;
    if (!initiativeRelationshipsAreValid(initiative, catalog)) {
      findings.push({ code: "INVALID_INITIATIVE_GOVERNANCE_RELATIONSHIPS", path: initiativePath });
    }
    if (!initiativeLegacyRefsAreValid(root, initiative)) {
      findings.push({ code: "INVALID_INITIATIVE_LEGACY_PROJECT_REF", path: initiativePath });
    }
    auditInitiativeSourceFence(root, initiative, initiativePath, findings);
    if (/^I[0-9]{4}$/.test(initiative.id)) {
      auditNumberedInitiative(root, initiative, initiativePath, findings);
    }
  }

  if (reviewableCandidates.length === 0 && numberedInitiatives.length === 0 && !(hasInitiativeAttention && hasInitiativeGap)) {
    findings.push({
      code: "INITIATIVE_BOOTSTRAP_UNRESOLVED",
      path: INITIATIVE_REGISTER_PATH,
      message: "source-backed INIT-* migration candidate, valid I#### Initiative, 또는 explicit initiative extraction gap/attention이 필요합니다",
    });
  }
  return findings;
}

function readHumanDecision(root, reference, expectedSourceRevision) {
  try {
    const decisionFile = safeAbsolute(root, normalizeRelativePath(reference, "human decision receipt ref"));
    if (!existsSync(decisionFile) || !lstatSync(decisionFile).isFile() || lstatSync(decisionFile).isSymbolicLink()) return null;
    const decision = JSON.parse(readFileSync(decisionFile, "utf8"));
    const promotesEffectiveArtifact = ["approved", "exception_accepted"].includes(decision?.decision);
    if (
      decision?.schemaVersion !== SCHEMA_VERSION ||
      typeof decision?.decisionId !== "string" || decision.decisionId.length === 0 ||
      typeof decision?.candidateId !== "string" || decision.candidateId.length === 0 ||
      !["human", "human_delegated_system"].includes(decision?.decidedBy?.actorKind) ||
      typeof decision?.decidedBy?.identifier !== "string" || decision.decidedBy.identifier.length === 0 ||
      !["approved", "rejected", "exception_accepted"].includes(decision?.decision) ||
      typeof decision?.decidedAt !== "string" || Number.isNaN(Date.parse(decision.decidedAt)) ||
      !(promotesEffectiveArtifact
        ? typeof decision?.effectiveRef === "string" && decision.effectiveRef.length > 0 && /^[a-f0-9]{64}$/.test(decision?.effectiveSha256 ?? "")
        : decision?.effectiveRef === null && decision?.effectiveSha256 === null) ||
      decision?.sourceFence?.repositoryRevision !== expectedSourceRevision ||
      !Array.isArray(decision?.sourceFence?.sourceHashes) || decision.sourceFence.sourceHashes.length === 0 ||
      !decision.sourceFence.sourceHashes.every((digest) => /^[a-f0-9]{64}$/.test(digest))
    ) return null;
    return decision;
  } catch {
    return null;
  }
}

function decisionEffectiveArtifactMatches(root, decision, expectedRef) {
  try {
    if (
      typeof expectedRef !== "string" || expectedRef.length === 0 ||
      decision?.effectiveRef !== expectedRef ||
      SECRET_SOURCE_PATH.test(expectedRef) ||
      !/^[a-f0-9]{64}$/.test(decision?.effectiveSha256 ?? "")
    ) return false;
    const effectiveFile = safeAbsolute(root, normalizeRelativePath(expectedRef, "effective governance ref"));
    const effectiveStat = lstatIfPresent(effectiveFile);
    return Boolean(
      effectiveStat && effectiveStat.isFile() && !effectiveStat.isSymbolicLink() &&
      sha256(readFileSync(effectiveFile)) === decision.effectiveSha256
    );
  } catch {
    return false;
  }
}

function evidenceAllowsVerified(root, lock, governanceAudit) {
  const file = safeAbsolute(root, EVIDENCE_PACK_PATH);
  if (!existsSync(file)) return false;
  try {
    const pack = JSON.parse(readFileSync(file, "utf8"));
    const decisionRefs = Array.isArray(pack.humanDecisionReceiptRefs) ? pack.humanDecisionReceiptRefs : [];
    const governanceSourceRevision = governanceAudit?.catalog?.migration?.capturedRepository?.baseCommit
      ?? lock.targetSourceRevision;
    const decisions = new Map(decisionRefs.map((reference) => [
      reference,
      readHumanDecision(root, reference, governanceSourceRevision),
    ]));
    const requiredDecisionsPresent = !lock.profiles.includes("governance") || (() => {
      if (!governanceAudit?.reviewed || decisions.size === 0 || [...decisions.values()].some((decision) => decision === null)) return false;
      const catalog = governanceAudit.catalog;
      const migrationDecision = decisions.get(catalog.migration.receiptRef);
      if (
        !migrationDecision || migrationDecision.candidateId !== "CATALOG-REVIEW" ||
        !["approved", "exception_accepted"].includes(migrationDecision.decision) ||
        !migrationDecision.sourceFence.sourceHashes.includes(sha256(governanceAudit.bytes)) ||
        !decisionEffectiveArtifactMatches(root, migrationDecision, GOVERNANCE_CATALOG_PATH)
      ) return false;
      return [...catalog.policies, ...catalog.guidelines].every((candidate) => {
        if (["code_observation", "config_observation"].includes(candidate.authorityClass)) return candidate.approvalState === "unreviewed";
        if (!["approved", "rejected"].includes(candidate.approvalState)) return false;
        const decision = decisions.get(candidate.decisionReceiptRef);
        if (!decision || decision.candidateId !== candidate.id) return false;
        if (candidate.approvalState === "approved" && (
          !["approved", "exception_accepted"].includes(decision.decision) ||
          !decisionEffectiveArtifactMatches(root, decision, candidate.effectiveRef)
        )) return false;
        if (candidate.approvalState === "rejected" && decision.decision !== "rejected") return false;
        const sourceHashes = candidate.sourceRefs.map(({ capturedSha256 }) => capturedSha256);
        return sourceHashes.every((digest) => decision.sourceFence.sourceHashes.includes(digest));
      });
    })();
    const installationReceiptMatches = (() => {
      try {
        if (pack.installationReceiptRef !== lock.receiptRef) return false;
        const receiptFile = safeAbsolute(root, normalizeRelativePath(pack.installationReceiptRef, "installation receipt ref"));
        if (!existsSync(receiptFile) || !lstatSync(receiptFile).isFile() || lstatSync(receiptFile).isSymbolicLink()) return false;
        const receipt = JSON.parse(readFileSync(receiptFile, "utf8"));
        return (
          receipt?.schemaVersion === SCHEMA_VERSION &&
          receipt?.command === "apply" &&
          receipt.applyResult === "applied" &&
          receipt.planHash === lock.planHash &&
          receipt.targetIdentity === sha256(root) &&
          receipt.targetLocator === "../.." &&
          receipt.release?.id === lock.release.id &&
          receipt.release?.sourceRevision === lock.release.sourceRevision &&
          canonicalJson(receipt.profiles) === canonicalJson(lock.profiles) &&
          receipt.installationLockPath === INSTALLATION_LOCK_PATH &&
          Array.isArray(receipt.mutations) &&
          receipt.writes === receipt.mutations.length + 1 &&
          applyMutationSetMatches(lock.applyMutationSet, receipt.mutations) &&
          /^[a-f0-9]{64}$/.test(receipt.postApplyFence?.dirtyFingerprint ?? "") &&
          /^[a-f0-9]{64}$/.test(receipt.postApplyFence?.inventorySha256 ?? "")
        );
      } catch {
        return false;
      }
    })();
    const expectedGates = expectedGateCommands(root, lock);
    const gateIds = Array.isArray(pack.gates) ? pack.gates.map(({ id }) => id) : [];
    const gateEvidencePresent = expectedGates instanceof Map &&
      Array.isArray(pack.gates) &&
      pack.gates.length === expectedGates.size &&
      new Set(gateIds).size === gateIds.length &&
      pack.gates.every((gate) => {
      if (!expectedGates.has(gate.id) || gate.required !== true || gate.result !== "passed") return false;
      try {
        const evidenceFile = safeAbsolute(root, normalizeRelativePath(gate.evidenceRef, "gate evidence ref"));
        if (!existsSync(evidenceFile) || !lstatSync(evidenceFile).isFile() || lstatSync(evidenceFile).isSymbolicLink()) return false;
        const evidenceBytes = readFileSync(evidenceFile);
        if (!/^[a-f0-9]{64}$/.test(gate.evidenceSha256 ?? "") || sha256(evidenceBytes) !== gate.evidenceSha256) return false;
        const evidence = JSON.parse(evidenceBytes.toString("utf8"));
        return (
          evidence?.schemaVersion === SCHEMA_VERSION &&
          evidence?.gateId === gate.id &&
          evidence?.result === gate.result &&
          evidence?.exitCode === 0 &&
          evidence?.command === expectedGates.get(gate.id) &&
          evidence?.targetSourceRevision === lock.targetSourceRevision &&
          evidence?.releaseSourceRevision === lock.release.sourceRevision &&
          typeof evidence?.observedAt === "string" &&
          !Number.isNaN(Date.parse(evidence.observedAt))
        );
      } catch {
        return false;
      }
    });
    return (
      pack?.schemaVersion === SCHEMA_VERSION &&
      pack?.release?.id === lock.release.id &&
      pack?.release?.sourceRevision === lock.release.sourceRevision &&
      pack?.targetSourceRevision === lock.targetSourceRevision &&
      pack?.allRequiredGatesPassed === true &&
      pack?.humanReviewComplete === true &&
      requiredDecisionsPresent &&
      installationReceiptMatches &&
      gateEvidencePresent
    );
  } catch {
    return false;
  }
}

export function verifyTarget({ target }) {
  const root = resolveRepositoryRoot(target);
  const state = readLock(root);
  if (state.state !== "valid") {
    return {
      schemaVersion: SCHEMA_VERSION,
      command: "verify",
      status: "INSTALLED_NOT_VERIFIED",
      targetIdentity: sha256(root),
      findings: [{ code: "INSTALLATION_LOCK_UNAVAILABLE", message: state.reason ?? "installation lock is missing" }],
    };
  }
  const findings = scanInstalledContent(root, state.lock);
  const governanceAudit = state.lock.profiles.includes("governance")
    ? auditGovernanceCatalog(root)
    : { findings: [], reviewed: true, catalog: null, bytes: null };
  findings.push(...governanceAudit.findings);
  if (state.lock.profiles.includes("governance")) {
    findings.push(...auditInitiativeBootstrap(root, governanceAudit));
  }
  const manifest = loadReleaseManifest();
  const missingVerificationProfiles = manifest.verification.requiredProfiles
    .filter((profile) => !state.lock.profiles.includes(profile));
  if (missingVerificationProfiles.length > 0) {
    findings.push({
      code: "VERIFICATION_PROFILE_INCOMPLETE",
      message: `MIGRATION_VERIFIED requires profiles: ${manifest.verification.requiredProfiles.join(", ")}`,
      missingProfiles: missingVerificationProfiles,
    });
  }
  const release = selectedRelease(manifest, state.lock.profiles);
  findings.push(...auditInstallationInventory(state.lock, release));
  if (state.lock.profiles.includes("core")) {
    findings.push(...auditProjectOwnedGovernanceAuthoringContracts(root, state.lock));
  }
  if (!sameReleaseFence({ release: state.lock.release }, release)) {
    findings.push({ code: "RELEASE_FENCE_MISMATCH", message: "installed release differs from current public release bytes" });
  }
  let status = "INSTALLED_NOT_VERIFIED";
  if (findings.length === 0 && evidenceAllowsVerified(root, state.lock, governanceAudit)) {
    status = "MIGRATION_VERIFIED";
  } else if (findings.length === 0 && state.lock.profiles.includes("governance")) {
    status = "INSTALLED_AWAITING_REVIEW";
  }
  const receipt = {
    schemaVersion: SCHEMA_VERSION,
    command: "verify",
    status,
    targetIdentity: sha256(root),
    release: state.lock.release,
    targetSourceRevision: state.lock.targetSourceRevision,
    checkedAt: new Date().toISOString(),
    findings,
    evidencePack: existsSync(safeAbsolute(root, EVIDENCE_PACK_PATH)) ? EVIDENCE_PACK_PATH : null,
  };
  return receipt;
}

export function rollbackReceipt({ receiptFile }) {
  const requestedReceipt = path.resolve(receiptFile);
  if (!existsSync(requestedReceipt) || !lstatSync(requestedReceipt).isFile() || lstatSync(requestedReceipt).isSymbolicLink()) {
    throw new HarnessAdoptError("rollback receipt must be a regular repository file", {
      status: "NEEDS_DECISION",
      code: "INVALID_APPLY_RECEIPT",
    });
  }
  const absoluteReceipt = realpathSync(requestedReceipt);
  const receipt = loadJson(absoluteReceipt, "apply receipt");
  const hashesValid = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  const mutationPaths = Array.isArray(receipt?.mutations) ? receipt.mutations.map(({ path: mutationPath }) => mutationPath) : [];
  const mutationsValid = Array.isArray(receipt?.mutations) && receipt.mutations.every((mutation) => {
    try {
      if (
        normalizeRelativePath(mutation?.path, "rollback mutation path") !== mutation.path ||
        mutation.path.startsWith("docs/receipts/") ||
        mutation.path.startsWith(".document-harness/runtime/") ||
        typeof mutation.existed !== "boolean" ||
        !hashesValid(mutation.afterSha256) ||
        ![420, 493].includes(mutation.afterMode)
      ) return false;
      if (mutation.existed) {
        if (!hashesValid(mutation.beforeSha256) || !recordedFileModeValid(mutation.beforeMode) || typeof mutation.preimageBase64 !== "string") return false;
        const preimage = Buffer.from(mutation.preimageBase64, "base64");
        return preimage.toString("base64") === mutation.preimageBase64 && sha256(preimage) === mutation.beforeSha256;
      }
      return mutation.beforeSha256 === null && mutation.beforeMode === null && mutation.preimageBase64 === null;
    } catch {
      return false;
    }
  });
  if (
    receipt?.schemaVersion !== SCHEMA_VERSION ||
    receipt?.command !== "apply" ||
    receipt.applyResult !== "applied" ||
    receipt.targetLocator !== "../.." ||
    !hashesValid(receipt.planHash) ||
    !hashesValid(receipt.targetIdentity) ||
    typeof receipt.postApplyFence?.revision !== "string" ||
    !hashesValid(receipt.postApplyFence?.dirtyFingerprint) ||
    !hashesValid(receipt.postApplyFence?.inventorySha256) ||
    receipt.installationLockPath !== INSTALLATION_LOCK_PATH ||
    receipt.writes !== (receipt.mutations?.length ?? -1) + 1 ||
    !mutationsValid ||
    new Set(mutationPaths).size !== mutationPaths.length
  ) {
    throw new HarnessAdoptError("rollback requires a successful apply receipt", {
      status: "NEEDS_DECISION",
      code: "INVALID_APPLY_RECEIPT",
    });
  }
  const root = resolveRepositoryRoot(path.resolve(path.dirname(absoluteReceipt), receipt.targetLocator));
  const expectedReceipt = safeAbsolute(root, receiptRelativePath(receipt.planHash));
  if (absoluteReceipt !== expectedReceipt) {
    throw new HarnessAdoptError("rollback receipt path does not match its plan hash and repository", {
      status: "NEEDS_DECISION",
      code: "RECEIPT_PATH_MISMATCH",
    });
  }
  if (sha256(root) !== receipt.targetIdentity) {
    throw new HarnessAdoptError("apply receipt target identity does not match this repository", {
      status: "NEEDS_DECISION",
      code: "TARGET_IDENTITY_MISMATCH",
    });
  }
  const lockState = readLock(root);
  const receiptRef = receiptRelativePath(receipt.planHash);
  if (
    lockState.state !== "valid" ||
    lockState.lock.planHash !== receipt.planHash ||
    lockState.lock.receiptRef !== receiptRef ||
    lockState.lock.release?.sourceRevision !== receipt.release?.sourceRevision
  ) {
    throw new HarnessAdoptError("apply receipt does not match the active installation lock", {
      status: "NEEDS_DECISION",
      code: "RECEIPT_LOCK_MISMATCH",
    });
  }
  if (lockState.lock.applyMutationSet === undefined) {
    throw new HarnessAdoptError("legacy installation lock does not cryptographically anchor an exact rollback mutation set; upgrade before rollback", {
      status: "NEEDS_DECISION",
      code: "RECEIPT_MUTATION_SET_UNANCHORED",
    });
  }
  if (!applyMutationSetMatches(lockState.lock.applyMutationSet, receipt.mutations)) {
    throw new HarnessAdoptError("apply receipt is not the exact mutation set anchored by the active installation lock", {
      status: "NEEDS_DECISION",
      code: "RECEIPT_MUTATION_SET_MISMATCH",
    });
  }
  const release = selectedRelease(loadReleaseManifest(), receipt.profiles);
  if (!sameReleaseFence({ release: receipt.release }, release) || auditInstallationInventory(lockState.lock, release).length > 0) {
    throw new HarnessAdoptError("rollback requires the exact current release inventory used by apply", {
      status: "NEEDS_DECISION",
      code: "RECEIPT_RELEASE_MISMATCH",
    });
  }
  const releaseFiles = new Map(release.files.map((entry) => [entry.targetPath, entry]));
  const installedFiles = new Map(lockState.lock.files.map((entry) => [entry.path, entry]));
  const receiptMutationsMatchLock = receipt.mutations.every((mutation) => {
    if (mutation.path === INSTALLATION_LOCK_PATH) {
      return mutation.afterSha256 === sha256(readFileSync(safeAbsolute(root, INSTALLATION_LOCK_PATH)));
    }
    const entry = installedFiles.get(mutation.path);
    const releaseEntry = releaseFiles.get(mutation.path);
    return (
      entry &&
      releaseEntry &&
      (["harness-managed", "generated"].includes(entry.ownership) ||
        (entry.ownership === "project-owned" && releaseEntry.ownership === "project-owned" && mutation.existed === false) ||
        (entry.ownership === "project-owned" &&
          mutation.path === VIEW_CONFIG_PATH &&
          releaseEntry.generator === "repository-view-config-v1" &&
          mutation.existed === true)) &&
      entry.installedSha256 === mutation.afterSha256 &&
      entry.installedMode === mutation.afterMode &&
      Number.parseInt(releaseEntry.mode, 8) === mutation.afterMode &&
      (releaseEntry.generator || mutation.afterSha256 === releaseEntry.sha256)
    );
  });
  if (!receiptMutationsMatchLock) {
    throw new HarnessAdoptError("apply receipt mutations do not match the active installation inventory", {
      status: "NEEDS_DECISION",
      code: "RECEIPT_MUTATION_MISMATCH",
    });
  }
  const conflicts = [];
  for (const mutation of receipt.mutations) {
    const current = pathState(root, mutation.path);
    if (current.type !== "file" || current.sha256 !== mutation.afterSha256 || current.mode !== mutation.afterMode) {
      conflicts.push({
        path: mutation.path,
        expected: mutation.afterSha256,
        actual: current.sha256,
        expectedMode: mutation.afterMode,
        actualMode: current.mode,
        type: current.type,
      });
    }
  }
  if (conflicts.length > 0) {
    return {
      schemaVersion: SCHEMA_VERSION,
      command: "rollback",
      status: "NEEDS_DECISION",
      applyId: receipt.applyId,
      targetIdentity: receipt.targetIdentity,
      writes: 0,
      conflicts,
    };
  }
  for (const mutation of [...receipt.mutations].reverse()) restoreMutation(root, mutation);
  const rolledBackAt = new Date().toISOString();
  const rollback = {
    schemaVersion: SCHEMA_VERSION,
    command: "rollback",
    status: "ROLLED_BACK",
    applyId: receipt.applyId,
    planHash: receipt.planHash,
    targetIdentity: receipt.targetIdentity,
    rolledBackAt,
    writes: receipt.mutations.length,
    restored: receipt.mutations.map(({ path: restoredPath, beforeSha256 }) => ({ path: restoredPath, restoredSha256: beforeSha256 })),
  };
  const rollbackFile = path.join(
    path.dirname(absoluteReceipt),
    `harness-rollback-${receipt.planHash.slice(0, 16)}.json`,
  );
  writeJsonAtomic(rollbackFile, rollback);
  return { ...rollback, receiptRef: path.relative(root, rollbackFile).replaceAll(path.sep, "/") };
}

export function commandError(command, error) {
  const known = error instanceof HarnessAdoptError;
  return {
    schemaVersion: SCHEMA_VERSION,
    command,
    status: known ? error.status : "APPLY_FAILED",
    error: {
      code: known ? error.code : "UNEXPECTED_ERROR",
      message: error.message,
      details: known ? error.details : [],
    },
    writes: 0,
  };
}
