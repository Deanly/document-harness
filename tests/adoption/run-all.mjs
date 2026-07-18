#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const startedAt = new Date();
let summaryWritten = false;

function emergencyFailure(error) {
  if (summaryWritten) return;
  summaryWritten = true;
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: "INSTALLED_NOT_VERIFIED",
    gate: "document-harness-public-release-acceptance",
    releaseId: "document-harness-public-v1",
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    requiredGates: null,
    passedGates: 0,
    failedGates: ["release-runner"],
    exitCode: 1,
    error: error?.stack ?? String(error)
  }, null, 2)}\n`);
  process.exitCode = 1;
}

process.on("uncaughtException", emergencyFailure);
process.on("unhandledRejection", emergencyFailure);

function relative(value) {
  return path.relative(REPO_ROOT, value).split(path.sep).join("/");
}

function discover(suffix, directory) {
  const root = path.resolve(REPO_ROOT, directory);
  if (!existsSync(root)) return [];
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) visit(candidate);
      else if (entry.isFile() && entry.name.endsWith(suffix)) files.push(relative(candidate));
    }
  };
  visit(root);
  return files.sort();
}

function tail(value, max = 2000) {
  const normalized = String(value ?? "").trim();
  return normalized.length <= max ? normalized : normalized.slice(-max);
}

function emitGateLog(name, stream, value) {
  if (!value) return;
  process.stderr.write(`\n[release-acceptance:${name}:${stream}]\n${value}`);
  if (!value.endsWith("\n")) process.stderr.write("\n");
}

function commandGate(name, command, args = []) {
  const gateStarted = Date.now();
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024
  });
  const exitCode = result.status ?? 1;
  if (exitCode !== 0 || process.env.DOCUMENT_HARNESS_ACCEPTANCE_QUIET !== "1") {
    emitGateLog(name, "stdout", result.stdout);
    emitGateLog(name, "stderr", result.stderr);
  }
  const gate = {
    id: name,
    required: true,
    result: exitCode === 0 ? "passed" : "failed",
    exitCode,
    durationMs: Date.now() - gateStarted,
    command: [command, ...args].join(" ")
  };
  if (result.error) gate.error = result.error.message;
  if (exitCode !== 0) {
    gate.stdoutTail = tail(result.stdout);
    gate.stderrTail = tail(result.stderr);
  } else if (name === "reference-view-browser") {
    try {
      gate.evidence = JSON.parse(result.stdout);
    } catch {
      gate.evidence = { output: tail(result.stdout, 4000) };
    }
  }
  return gate;
}

function inventoryGate(adoptionTests, viewTests) {
  const gateStarted = Date.now();
  const requiredFiles = [
    ".gitignore",
    "docs/bin/harness-adopt",
    "docs/releases/document-harness-v1.json",
    "docs/schemas/adoption-plan.schema.json",
    "docs/schemas/apply-receipt.schema.json",
    "docs/schemas/governance-catalog.schema.json",
    "docs/schemas/harness-installation-lock.schema.json",
    "docs/schemas/human-policy-decision-receipt.schema.json",
    "docs/schemas/initiative-activation-receipt.schema.json",
    "docs/schemas/initiative-register.schema.json",
    "docs/schemas/migration-evidence-pack.schema.json",
    "docs/schemas/release-manifest.schema.json",
    "docs/schemas/rollback-receipt.schema.json",
    "docs/schemas/verification-receipt.schema.json",
    "runtime/document-harness-view/bin/human-view",
    "runtime/document-harness-view/lib/runtime-state.mjs",
    "runtime/document-harness-view/server.mjs",
    "tests/adoption/harness-adopt.test.mjs",
    "tests/adoption/fixture-matrix.test.mjs",
    "tests/adoption/view-fixture-matrix.test.mjs",
    "tests/adoption/view-browser-gate.mjs",
    "tests/adoption/baselines/reference-view-policy-1440.png",
    "tests/adoption/package.json",
    "tests/adoption/package-lock.json",
    "tests/adoption/README.md"
  ];
  const missing = requiredFiles.filter((file) => !existsSync(path.join(REPO_ROOT, file)));
  const empty = requiredFiles.filter((file) => {
    const candidate = path.join(REPO_ROOT, file);
    return existsSync(candidate) && statSync(candidate).isFile() && statSync(candidate).size === 0;
  });
  const requiredAdoptionTests = new Set([
    "tests/adoption/harness-adopt.test.mjs",
    "tests/adoption/fixture-matrix.test.mjs",
    "tests/adoption/installed-copy-e2e.test.mjs",
    "tests/adoption/view-fixture-matrix.test.mjs"
  ]);
  const missingTestSurfaces = [...requiredAdoptionTests].filter((file) => !adoptionTests.includes(file));
  const errors = [];
  if (missing.length) errors.push(`missing files: ${missing.join(", ")}`);
  if (empty.length) errors.push(`empty files: ${empty.join(", ")}`);
  if (missingTestSurfaces.length) errors.push(`missing adoption tests: ${missingTestSurfaces.join(", ")}`);
  if (viewTests.length === 0) errors.push("no reference View tests discovered");
  const ignoreFile = path.join(REPO_ROOT, ".gitignore");
  if (existsSync(ignoreFile)) {
    const ignoreRules = new Set(
      readFileSync(ignoreFile, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
    );
    for (const requiredRule of ["node_modules/", ".document-harness/"]) {
      if (!ignoreRules.has(requiredRule)) errors.push(`missing distribution ignore rule: ${requiredRule}`);
    }
  }
  return {
    id: "release-surface-inventory",
    required: true,
    result: errors.length === 0 ? "passed" : "failed",
    exitCode: errors.length === 0 ? 0 : 1,
    durationMs: Date.now() - gateStarted,
    discovered: {
      adoptionTests,
      referenceViewTests: viewTests
    },
    ...(errors.length ? { errors } : {})
  };
}

const adoptionTests = discover(".test.mjs", "tests/adoption");
const viewTests = discover(".test.mjs", "runtime/document-harness-view/test");
const gates = [inventoryGate(adoptionTests, viewTests)];

if (adoptionTests.length > 0) {
  gates.push(commandGate("initializer-and-fixture-matrix", process.execPath, ["--test", ...adoptionTests]));
} else {
  gates.push({ id: "initializer-and-fixture-matrix", required: true, result: "failed", exitCode: 1, durationMs: 0, error: "No adoption tests discovered." });
}

if (viewTests.length > 0) {
  gates.push(commandGate("reference-view-runtime", process.execPath, ["--test", ...viewTests]));
} else {
  gates.push({ id: "reference-view-runtime", required: true, result: "failed", exitCode: 1, durationMs: 0, error: "No reference View tests discovered." });
}

gates.push(commandGate("reference-view-browser", process.execPath, ["tests/adoption/view-browser-gate.mjs"]));
gates.push(commandGate("codex-readiness", "./docs/bin/validate-codex-readiness.sh"));
gates.push(commandGate("harness-foundation", "./docs/bin/validate-harness-foundation.sh"));
gates.push(commandGate("harness-adoption", "./docs/bin/validate-harness-adoption.sh"));
gates.push(commandGate("document-retrieval", "./docs/bin/validate-doc-retrieval.sh"));
gates.push(commandGate("execution-loop", "./docs/bin/validate-execution-loop.sh", ["--all"]));
gates.push(commandGate("closeout", "./docs/bin/validate-closeout.sh", ["--all"]));
gates.push(commandGate("git-diff-check", "git", ["diff", "--check"]));

const failed = gates.filter(({ result }) => result !== "passed");
const completedAt = new Date();
const exitCode = failed.length === 0 ? 0 : 1;
const summary = {
  schemaVersion: 1,
  status: failed.length === 0 ? "PLAN_READY" : "INSTALLED_NOT_VERIFIED",
  releaseAcceptance: failed.length === 0 ? "passed" : "failed",
  gate: "document-harness-public-release-acceptance",
  releaseId: "document-harness-public-v1",
  startedAt: startedAt.toISOString(),
  completedAt: completedAt.toISOString(),
  durationMs: completedAt.getTime() - startedAt.getTime(),
  requiredGates: gates.length,
  passedGates: gates.length - failed.length,
  failedGates: failed.map(({ id }) => id),
  exitCode,
  gates
};

summaryWritten = true;
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
process.exitCode = exitCode;
