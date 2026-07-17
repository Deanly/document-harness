import { lstat, mkdir, open, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

export const RUNTIME_GITIGNORE_BYTES = "*\n";
const LEGACY_RUNTIME_ENTRIES = new Set([
  "lease.json",
  "runtime-probes.json",
  "server.log",
  "snapshot.json",
]);
const LEGACY_TEMPORARY_ENTRY = /^(?:lease|runtime-probes|snapshot)\.json\.\d+\.\d+\.tmp$/;

function pathIsInside(repoRoot, candidate) {
  const relative = path.relative(repoRoot, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function validateRuntimeIgnore(markerPath) {
  const markerStat = await lstat(markerPath);
  if (!markerStat.isFile() || markerStat.isSymbolicLink()) {
    throw new Error("View runtime .gitignore marker는 regular file이어야 합니다.");
  }
  const bytes = await readFile(markerPath, "utf8");
  if (bytes !== RUNTIME_GITIGNORE_BYTES) {
    throw new Error("View runtime .gitignore marker가 distribution contract와 일치하지 않습니다.");
  }
}

async function ensureContainedDirectory(repoRoot, stateDir) {
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedStateDir = path.resolve(stateDir);
  const canonicalRoot = await realpath(resolvedRoot);
  let relative = path.relative(resolvedRoot, resolvedStateDir);
  if (!pathIsInside(resolvedRoot, resolvedStateDir) && pathIsInside(canonicalRoot, resolvedStateDir)) {
    relative = path.relative(canonicalRoot, resolvedStateDir);
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("View stateDir는 저장소 안에 있어야 합니다.");
  }
  let current = canonicalRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let currentStat;
    try {
      currentStat = await lstat(current);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parentRealPath = await realpath(path.dirname(current));
      if (!pathIsInside(canonicalRoot, parentRealPath)) {
        throw new Error("View stateDir parent가 저장소 경계를 벗어납니다.");
      }
      try {
        await mkdir(current, { mode: 0o700 });
      } catch (mkdirError) {
        if (mkdirError.code !== "EEXIST") throw mkdirError;
      }
      currentStat = await lstat(current);
    }
    if (currentStat.isSymbolicLink() || !currentStat.isDirectory()) {
      throw new Error(`View stateDir segment는 symlink가 아닌 directory여야 합니다: ${segment}`);
    }
    const currentRealPath = await realpath(current);
    if (!pathIsInside(canonicalRoot, currentRealPath)) {
      throw new Error("View stateDir symlink가 저장소 경계를 벗어납니다.");
    }
  }
  return realpath(current);
}

export async function ensureRuntimeStateDirectory({ repoRoot, stateDir }) {
  const stateRealPath = await ensureContainedDirectory(repoRoot, stateDir);

  const markerPath = path.join(stateRealPath, ".gitignore");
  try {
    await validateRuntimeIgnore(markerPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const foreignEntries = (await readdir(stateRealPath))
      .filter((name) => !LEGACY_RUNTIME_ENTRIES.has(name) && !LEGACY_TEMPORARY_ENTRY.test(name));
    if (foreignEntries.length > 0) {
      throw new Error(`View runtime state directory에 foreign entry가 있어 ignore marker를 만들지 않았습니다: ${foreignEntries.sort().join(", ")}`);
    }
    try {
      const handle = await open(markerPath, "wx", 0o600);
      try {
        await handle.writeFile(RUNTIME_GITIGNORE_BYTES, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch (writeError) {
      if (writeError.code !== "EEXIST") throw writeError;
      await validateRuntimeIgnore(markerPath);
    }
  }
  return stateRealPath;
}
