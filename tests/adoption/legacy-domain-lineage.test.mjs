import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "legacy-domain-lineage-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ["docs/bin", "docs/lib", "docs/_indexes", "docs/projects", "docs/tasks", "docs/qa"]) {
    mkdirSync(path.join(root, dir), { recursive: true });
  }
  const validator = path.join(root, "docs/bin/validate-domain-lineage.sh");
  copyFileSync(path.join(sourceRoot, "docs/bin/validate-domain-lineage.sh"), validator);
  chmodSync(validator, 0o755);
  const supervisionValidator = path.join(root, "docs/bin/validate-domain-supervision.sh");
  copyFileSync(path.join(sourceRoot, "docs/bin/validate-domain-supervision.sh"), supervisionValidator);
  chmodSync(supervisionValidator, 0o755);
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "Legacy Fixture");
  git(root, "config", "user.email", "legacy-fixture@example.invalid");
  const oldTask = path.join(root, "docs/tasks/T0001-existing.md");
  writeFileSync(oldTask, "---\ntype: task\ndoc_id: T0001\nstatus: active\n---\n\n# Existing task\n");
  git(root, "add", "docs/tasks/T0001-existing.md");
  git(root, "commit", "-qm", "existing task before adoption");
  const baseCommit = git(root, "rev-parse", "HEAD");
  writeFileSync(path.join(root, "docs/_indexes/governance-catalog.json"), JSON.stringify({
    migration: { capturedRepository: { baseCommit } },
  }));
  writeFileSync(path.join(root, "docs/_indexes/harness-installation.yaml"), JSON.stringify({
    release: { id: "document-harness-public-v1" }, targetSourceRevision: baseCommit,
  }));
  return { root, validator, supervisionValidator, oldTask };
}

function validate({ root, validator }) {
  return spawnSync(validator, ["--all"], { cwd: root, encoding: "utf8" });
}

test("pre-adoption active task is grandfathered while a newly issued task still needs v2", (t) => {
  const state = fixture(t);
  const old = validate(state);
  assert.equal(old.status, 0, old.stderr);

  writeFileSync(path.join(state.root, "docs/tasks/T0002-new.md"),
    "---\ntype: task\ndoc_id: T0002\nstatus: active\n---\n\n# New task\n");
  const fresh = validate(state);
  assert.equal(fresh.status, 1);
  assert.match(fresh.stderr, /T0002-new\.md must declare domain_contract/);
});

test("an explicit invalid legacy contract is never grandfathered", (t) => {
  const state = fixture(t);
  writeFileSync(state.oldTask,
    "---\ntype: task\ndoc_id: T0001\nstatus: active\ndomain_contract: legacy-v0\n---\n\n# Existing task\n");
  const result = validate(state);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /legacy-v0 is allowed only for terminal historical documents/);
});

test("reusing an old path with a different document id does not inherit its contract", (t) => {
  const state = fixture(t);
  writeFileSync(state.oldTask,
    "---\ntype: task\ndoc_id: T9999\nstatus: active\n---\n\n# Replacement task\n");
  const result = validate(state);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /T0001-existing\.md must declare domain_contract/);
});

test("supervision also grandfathers only pre-adoption document identity", (t) => {
  const state = fixture(t);
  const old = spawnSync(state.supervisionValidator, ["--all"], { cwd: state.root, encoding: "utf8" });
  assert.equal(old.status, 0, old.stderr);
  writeFileSync(path.join(state.root, "docs/tasks/T0002-new.md"),
    "---\ntype: task\ndoc_id: T0002\nstatus: active\n---\n\n# New task\n");
  const fresh = spawnSync(state.supervisionValidator, ["--all"], { cwd: state.root, encoding: "utf8" });
  assert.equal(fresh.status, 1);
  assert.match(fresh.stderr, /T0002-new\.md must declare domain_contract/);
});
