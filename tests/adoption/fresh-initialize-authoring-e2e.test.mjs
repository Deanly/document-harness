import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { applyPlan, createPlan } from "../../docs/lib/harness-adopt.mjs";

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

function run(root, executable, args = []) {
  return execFileSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function assertInstalledReferenceClosure(target, manifest) {
  const installedMarkdown = new Set([
    "AGENTS.md",
    "CLAUDE.md",
    "docs/README.md",
    ...manifest.files
      .map(({ targetPath }) => targetPath)
      .filter((targetPath) => targetPath.endsWith(".md")),
  ]);
  const generatedLater = [
    /^docs\/checkpoints\//,
    /^docs\/receipts\//,
    /^docs\/(?:projects|tasks|reports|qa)\//,
  ];
  const intentionallyAbsent = new Set([
    // The operations guide names this rejected legacy mirror to state that it must not exist.
    "docs/guide/execution-loop-operations.md\0docs/_indexes/execution-checkpoint.json",
  ]);
  const concreteRef = /(?:^|[`(\s])((?:docs|runtime|\.agents|\.claude)\/[A-Za-z0-9_.\/-]+(?:\.md|\.json|\.yaml|\.yml|\.mjs|\.sh|human-view|harness-adopt))/gm;
  const dangling = [];

  for (const sourcePath of [...installedMarkdown].sort()) {
    const absolute = path.join(target, sourcePath);
    assert.equal(existsSync(absolute), true, `installed markdown: ${sourcePath}`);
    const source = readFileSync(absolute, "utf8");
    for (const match of source.matchAll(concreteRef)) {
      const reference = match[1].replace(/[.,;:)]+$/, "");
      if (existsSync(path.join(target, reference))) continue;
      if (generatedLater.some((pattern) => pattern.test(reference))) continue;
      if (intentionallyAbsent.has(`${sourcePath}\0${reference}`)) continue;
      dangling.push({ sourcePath, reference });
    }
  }
  assert.deepEqual(dangling, [], `installed docs contain dangling concrete refs: ${JSON.stringify(dangling)}`);
}

test("fresh full-profile initialize installs and runs the reusable document authoring workflow", (t) => {
  const base = mkdtempSync(path.join(os.tmpdir(), "harness-fresh-authoring-"));
  const target = path.join(base, "target");
  mkdirSync(target);
  git(target, "init", "-q", "-b", "main");
  git(target, "config", "user.name", "Harness Fixture");
  git(target, "config", "user.email", "harness-fixture@example.invalid");
  git(target, "commit", "--allow-empty", "-qm", "fresh repository");
  t.after(() => rmSync(base, { recursive: true, force: true }));

  const planFile = path.join(base, "full-plan.json");
  const plan = createPlan({
    target,
    profiles: ["core", "governance", "view"],
    output: planFile,
  });
  assert.equal(plan.mode, "initialize");
  assert.equal(plan.status, "PLAN_READY");
  const applied = applyPlan({ planFile, expectedPlanHash: plan.planHash });
  assert.equal(applied.status, "INSTALLED_AWAITING_REVIEW");

  const manifest = JSON.parse(readFileSync(path.join(target, "docs/releases/document-harness-v1.json"), "utf8"));
  for (const installedPath of [
    "docs/bin/new-doc.sh",
    "docs/bin/validate-closeout.sh",
    "docs/bin/close-doc.sh",
    "docs/_templates/project.md",
    "docs/_templates/task.md",
    "docs/_templates/design.md",
    "docs/_templates/guide.md",
    "docs/_templates/report.md",
    "docs/_templates/qa.md",
    "docs/design/ubiquitous-language.md",
    "docs/guide/goal-locked-completion.md",
    "docs/guide/project-cutting-and-execution.md",
    "docs/guide/umbrella-project-governance.md",
    "docs/guide/quality-axes.md",
    "docs/guide/qa-document-system.md",
  ]) {
    assert.equal(existsSync(path.join(target, installedPath)), true, installedPath);
    assert.ok(manifest.verification.requiredInstalledPaths.includes(installedPath), `verification requires ${installedPath}`);
  }

  for (const distributionOnlyPath of [
    "tests/adoption/run-all.sh",
    "docs/bin/validate-codex-readiness.sh",
    "docs/bin/validate-harness-foundation.sh",
    "docs/bin/validate-harness-adoption.sh",
    "docs/bin/validate-doc-retrieval.sh",
    "docs/tasks/T0001-retrieval-plane-baseline.md",
  ]) assert.equal(existsSync(path.join(target, distributionOnlyPath)), false, distributionOnlyPath);

  assertInstalledReferenceClosure(target, manifest);

  git(target, "add", "-A");
  git(target, "commit", "-qm", "install document harness");
  const newDoc = path.join(target, "docs/bin/new-doc.sh");

  const projectOutput = run(target, newDoc, ["project", "umbrella-project"]).trim();
  assert.equal(path.basename(projectOutput), "P0001-umbrella-project.md");
  assert.match(git(target, "log", "-1", "--format=%s"), /^docs: issue P0001 umbrella-project$/m);
  assert.equal(git(target, "status", "--porcelain"), "");

  const taskOutput = run(target, newDoc, ["task", "first-task"]).trim();
  assert.equal(path.basename(taskOutput), "T0001-first-task.md");
  assert.match(git(target, "log", "-1", "--format=%s"), /^docs: issue T0001 first-task$/m);
  assert.equal(git(target, "status", "--porcelain"), "");

  const qaOutput = run(target, newDoc, ["qa", "first-test-strategy"]).trim();
  const qaPath = path.join(target, "docs/qa/QA0001-first-test-strategy.md");
  assert.equal(path.basename(qaOutput), "QA0001-first-test-strategy.md");
  let qa = readFileSync(qaPath, "utf8");
  qa = qa
    .replace(/^qa_type:\s*$/m, "qa_type: strategy")
    .replace(/^owner:\s*$/m, "owner: Human")
    .replace(/^- QA Type:\s*$/m, "- QA Type: strategy")
    .replace(/^- Owner:\s*$/m, "- Owner: Human");
  writeFileSync(qaPath, qa, "utf8");
  git(target, "add", qaPath);
  git(target, "commit", "-qm", "docs: configure QA0001 strategy");

  const designOutput = run(target, newDoc, ["design", "service-boundary"]).trim();
  const guideOutput = run(target, newDoc, ["guide", "operating-rule"]).trim();
  const reportOutput = run(target, newDoc, ["report", "investigation"]).trim();
  assert.equal(path.basename(designOutput), "service-boundary.md");
  assert.equal(path.basename(guideOutput), "operating-rule.md");
  assert.match(path.basename(reportOutput), /^\d{4}-\d{2}-\d{2}-investigation\.md$/);
  git(target, "add", "-A");
  git(target, "commit", "-qm", "docs: add reusable unnumbered drafts");

  assert.match(
    run(target, path.join(target, "docs/bin/validate-execution-loop.sh"), ["--all"]),
    /Validated execution loop surfaces/,
  );
  assert.match(
    run(target, path.join(target, "docs/bin/validate-closeout.sh"), ["--all"]),
    /Validated 3 doc\(s\)\./,
  );

  const prematureClose = spawnSync(
    path.join(target, "docs/bin/close-doc.sh"),
    [path.join(target, "docs/tasks/T0001-first-task.md"), "premature close must fail"],
    { cwd: target, encoding: "utf8" },
  );
  assert.notEqual(prematureClose.status, 0);
  assert.match(prematureClose.stderr, /closeout validation failed|cannot be done|requires/);
  assert.equal(git(target, "status", "--porcelain"), "");
});
