import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyPlan,
  createPlan,
  rollbackReceipt,
  verifyTarget,
} from "../../docs/lib/harness-adopt.mjs";

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

function applyReceiptPath(target, planHash) {
  return path.join(target, "docs", "receipts", `harness-apply-${planHash.slice(0, 16)}.json`);
}

function isolatedTestEnvironment() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

test("installed full-profile copy operates, preserves project instructions, rolls back, and reapplies", (t) => {
  const base = mkdtempSync(path.join(os.tmpdir(), "harness-installed-copy-"));
  const target = path.join(base, "target");
  mkdirSync(target);
  git(target, "init", "-q");
  const projectInstructions = Buffer.from("# Existing project instructions\n\nKeep these project-owned bytes.\n");
  writeFileSync(path.join(target, "AGENTS.md"), projectInstructions);
  git(target, "add", "AGENTS.md");
  git(
    target,
    "-c", "user.name=Harness Fixture",
    "-c", "user.email=harness-fixture@example.invalid",
    "commit", "-qm", "mature fixture",
  );
  t.after(() => rmSync(base, { recursive: true, force: true }));

  const planFile = path.join(base, "full-plan.json");
  const plan = createPlan({ target, profiles: ["core", "governance", "view"], output: planFile });
  assert.equal(plan.mode, "migrate");
  assert.equal(plan.status, "PLAN_READY");
  assert.deepEqual(plan.requestedProfiles, ["core", "governance", "view"]);
  assert.deepEqual(plan.profiles, ["core", "governance", "view"]);
  assert.equal(plan.actions.find(({ path: actionPath }) => actionPath === "AGENTS.md").action, "KEEP_PROJECT_OWNED");

  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.status, "INSTALLED_AWAITING_REVIEW");
  assert.deepEqual(readFileSync(path.join(target, "AGENTS.md")), projectInstructions);
  for (const installedPath of [
    "CLAUDE.md",
    "docs/README.md",
    "docs/EXECUTE.md",
    ".agents/skills/operate-document-harness/SKILL.md",
    ".claude/skills/operate-document-harness/SKILL.md",
    "runtime/document-harness-view/bin/human-view",
    "runtime/document-harness-view/lib/process-identity.mjs",
    "runtime/document-harness-view/lib/runtime-state.mjs",
  ]) assert.equal(existsSync(path.join(target, installedPath)), true, installedPath);

  const installedManifest = JSON.parse(readFileSync(path.join(target, "docs", "releases", "document-harness-v1.json"), "utf8"));
  assert.deepEqual(installedManifest.verification.requiredProfiles, ["core", "governance", "view"]);
  for (const installedPath of installedManifest.verification.requiredInstalledPaths) {
    assert.equal(existsSync(path.join(target, installedPath)), true, `required installed path: ${installedPath}`);
  }
  assert.match(execFileSync(path.join(target, "docs", "bin", "validate-execution-loop.sh"), ["--all"], {
    cwd: target,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }), /Validated execution loop surfaces/);

  const second = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(second.alreadyApplied, true);
  assert.equal(second.writes, 0);

  const humanView = path.join(target, "runtime", "document-harness-view", "bin", "human-view");
  const doctor = JSON.parse(execFileSync(humanView, ["doctor", "--root", target], {
    cwd: target,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }));
  assert.equal(doctor.status, "ready");
  assert.equal(doctor.repoId, "target");
  assert.equal(doctor.readOnly, true);

  const installedRuntimeTests = execFileSync(humanView, ["test"], {
    cwd: target,
    encoding: "utf8",
    env: isolatedTestEnvironment(),
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.match(installedRuntimeTests, /# tests [1-9][0-9]*/);
  assert.match(installedRuntimeTests, /# pass [1-9][0-9]*/);
  assert.match(installedRuntimeTests, /# fail 0/);
  assert.match(installedRuntimeTests, /# cancelled 0/);
  assert.match(installedRuntimeTests, /# skipped 0/);

  const snapshot = JSON.parse(execFileSync(humanView, ["snapshot", "--root", target], {
    cwd: target,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }));
  assert.equal(snapshot.project.id, "target");
  assert.equal(snapshot.execution.status, "not_configured");
  assert.equal(snapshot.snapshot.capabilities.write, false);
  assert.doesNotThrow(() => git(target, "diff", "--check"));
  assert.equal(verifyTarget({ target }).status, "INSTALLED_AWAITING_REVIEW");

  const rolledBack = rollbackReceipt({ receiptFile: applyReceiptPath(target, plan.planHash) });
  assert.equal(rolledBack.status, "ROLLED_BACK");
  assert.deepEqual(readFileSync(path.join(target, "AGENTS.md")), projectInstructions);
  assert.equal(existsSync(path.join(target, "runtime", "document-harness-view", "server.mjs")), false);

  const reapplied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(reapplied.status, "INSTALLED_AWAITING_REVIEW");
  assert.equal(verifyTarget({ target }).status, "INSTALLED_AWAITING_REVIEW");
});
