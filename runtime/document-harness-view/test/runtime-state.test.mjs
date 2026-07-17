import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureRuntimeStateDirectory } from "../lib/runtime-state.mjs";

test("runtime state rejects an escaped ancestor symlink before writing outside the repository", async (t) => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "document-harness-state-repo-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "document-harness-state-outside-"));
  t.after(async () => {
    await Promise.all([
      rm(repoRoot, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true }),
    ]);
  });
  await symlink(outside, path.join(repoRoot, ".document-harness"));

  await assert.rejects(
    ensureRuntimeStateDirectory({
      repoRoot,
      stateDir: path.join(repoRoot, ".document-harness", "runtime", "view"),
    }),
    /View stateDir/
  );
  assert.deepEqual(await readdir(outside), []);
});
