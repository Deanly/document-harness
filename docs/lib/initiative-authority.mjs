#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectSourceEvidence } from "./source-evidence-freshness.mjs";

const SHA256_RE = /^[a-f0-9]{64}$/;
const REVISION_RE = /^[a-f0-9]{40}$/;

function fail(message) {
  const error = new Error(message);
  error.code = "INITIATIVE_AUTHORITY_INVALID";
  throw error;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(bytes, label) {
  const lines = bytes.toString("utf8").split(/\r?\n/);
  if (lines[0] !== "---") fail(`${label} must start with YAML frontmatter`);
  const result = {};
  let currentList = null;
  let closed = false;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === "---") {
      closed = true;
      break;
    }
    const listMatch = currentList && line.match(/^  -\s+(.+)$/);
    if (listMatch) {
      result[currentList].push(unquote(listMatch[1]));
      continue;
    }
    currentList = null;
    const scalarMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!scalarMatch) continue;
    const [, key, rawValue] = scalarMatch;
    if (rawValue === "") {
      result[key] = "";
      currentList = key;
      result[key] = [];
    } else if (rawValue === "[]") {
      result[key] = [];
    } else if (/^\[.*\]$/.test(rawValue)) {
      const inner = rawValue.slice(1, -1).trim();
      result[key] = inner === "" ? [] : inner.split(",").map(unquote);
    } else {
      result[key] = unquote(rawValue);
    }
  }
  if (!closed) fail(`${label} frontmatter is not closed`);
  return result;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function captureRepositoryFile(repoRoot, relativePath, label, requiredSuffix = null) {
  if (typeof relativePath !== "string" || relativePath.trim() === "" || path.isAbsolute(relativePath)
    || relativePath.includes("\\") || relativePath.split("/").includes("..")) {
    fail(`${label} must be a safe repository-relative path: ${relativePath ?? "<missing>"}`);
  }
  if (requiredSuffix && !relativePath.endsWith(requiredSuffix)) {
    fail(`${label} must end with ${requiredSuffix}: ${relativePath}`);
  }
  const root = realpathSync(repoRoot);
  let cursor = root;
  for (const segment of relativePath.split("/")) {
    if (!segment || segment === ".") fail(`${label} contains an invalid path segment: ${relativePath}`);
    cursor = path.join(cursor, segment);
    let stat;
    try {
      stat = lstatSync(cursor);
    } catch (error) {
      if (error.code === "ENOENT") fail(`${label} does not exist: ${relativePath}`);
      throw error;
    }
    if (stat.isSymbolicLink()) fail(`${label} must not traverse a symlink: ${relativePath}`);
  }
  const canonical = realpathSync(cursor);
  if (!isInside(root, canonical) || !lstatSync(canonical).isFile()) {
    fail(`${label} must resolve to a regular file inside the repository: ${relativePath}`);
  }
  const bytes = readFileSync(canonical);
  if (bytes.length === 0) fail(`${label} must not be empty: ${relativePath}`);
  return { relativePath, absolutePath: canonical, bytes, digest: sha256(bytes) };
}

function readJsonFile(repoRoot, relativePath, label) {
  const captured = captureRepositoryFile(repoRoot, relativePath, label, ".json");
  try {
    return { ...captured, value: JSON.parse(captured.bytes.toString("utf8")) };
  } catch {
    fail(`${label} is not valid JSON: ${relativePath}`);
  }
}

function requireUnique(values, predicate, label) {
  const matches = values.filter(predicate);
  if (matches.length !== 1) fail(`${label} must resolve exactly once; found ${matches.length}`);
  return matches[0];
}

function sameStringSet(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === new Set(left).size
    && right.length === new Set(right).size
    && [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}

function verifyHumanDecisionReceipt({
  repoRoot,
  receiptRef,
  candidateId,
  sourceRevision,
  sourceHashes,
  effectiveRef,
  allowException = false,
  label,
}) {
  const captured = readJsonFile(repoRoot, receiptRef, label);
  const receipt = captured.value;
  const allowedDecisions = allowException ? ["approved", "exception_accepted"] : ["approved"];
  if (receipt?.schemaVersion !== 1
    || typeof receipt.decisionId !== "string" || receipt.decisionId.trim() === ""
    || receipt.candidateId !== candidateId
    || !allowedDecisions.includes(receipt.decision)
    || !["human", "human_delegated_system"].includes(receipt.decidedBy?.actorKind)
    || typeof receipt.decidedBy?.identifier !== "string" || receipt.decidedBy.identifier.trim() === ""
    || typeof receipt.decidedAt !== "string" || Number.isNaN(Date.parse(receipt.decidedAt))
    || receipt.sourceFence?.repositoryRevision !== sourceRevision
    || !Array.isArray(receipt.sourceFence?.sourceHashes) || receipt.sourceFence.sourceHashes.length === 0
    || !receipt.sourceFence.sourceHashes.every((digest) => SHA256_RE.test(digest))
    || receipt.effectiveRef !== effectiveRef) {
    fail(`${label} does not approve ${candidateId} with the required human actor, decision, source fence, and effective ref`);
  }
  for (const digest of sourceHashes) {
    if (!receipt.sourceFence.sourceHashes.includes(digest)) {
      fail(`${label} does not bind source hash ${digest} for ${candidateId}`);
    }
  }
  const effective = captureRepositoryFile(repoRoot, effectiveRef, `${candidateId} effectiveRef`);
  if (receipt.effectiveSha256 !== effective.digest) {
    fail(`${label} effectiveSha256 does not match current bytes for ${effectiveRef}`);
  }
  return { receipt, captured, effective };
}

function verifySourceRefs(repoRoot, sourceRevision, sourceRefs, label) {
  if (!REVISION_RE.test(sourceRevision ?? "") || !Array.isArray(sourceRefs) || sourceRefs.length === 0) {
    fail(`${label} must have a full sourceRevision and at least one sourceRef`);
  }
  try {
    execFileSync("git", ["-C", repoRoot, "cat-file", "-e", `${sourceRevision}^{commit}`], { stdio: "ignore" });
  } catch {
    fail(`${label} sourceRevision must resolve to a commit in this repository: ${sourceRevision}`);
  }
  const hashes = [];
  for (const [index, sourceRef] of sourceRefs.entries()) {
    if (sourceRef?.capturedRepositoryRevision !== sourceRevision || !SHA256_RE.test(sourceRef?.capturedSha256 ?? "")) {
      fail(`${label}.sourceRefs[${index}] does not match its source revision/hash fence`);
    }
    const source = captureRepositoryFile(repoRoot, sourceRef.path, `${label}.sourceRefs[${index}].path`);
    let committedBytes;
    try {
      committedBytes = execFileSync("git", ["-C", repoRoot, "show", `${sourceRevision}:${sourceRef.path}`], {
        encoding: null,
        maxBuffer: 32 * 1024 * 1024,
      });
    } catch {
      fail(`${label}.sourceRefs[${index}] is not readable at sourceRevision: ${sourceRef.path}`);
    }
    const evidence = inspectSourceEvidence({
      sourceRef,
      capturedBytes: committedBytes,
      currentBytes: source.bytes,
    });
    if (evidence.state === "invalid") {
      fail(`${label}.sourceRefs[${index}] captured hash does not match sourceRevision bytes: ${sourceRef.path}`);
    }
    if (evidence.state !== "current") {
      fail(`${label}.sourceRefs[${index}] evidence scope is stale: ${sourceRef.path}`);
    }
    hashes.push(sourceRef.capturedSha256);
  }
  return hashes;
}

function verifyEffectiveGovernanceItem(repoRoot, item, label) {
  if (!item || item.authorityState !== "effective" || item.approvalState !== "approved") {
    fail(`${label} must be current effective/approved governance`);
  }
  const revisions = new Set((item.sourceRefs ?? []).map((sourceRef) => sourceRef.capturedRepositoryRevision));
  if (revisions.size !== 1) fail(`${label} source refs must share one repository revision`);
  const [sourceRevision] = revisions;
  const sourceHashes = verifySourceRefs(repoRoot, sourceRevision, item.sourceRefs, label);
  if (typeof item.effectiveRef !== "string" || typeof item.decisionReceiptRef !== "string") {
    fail(`${label} must retain effectiveRef and decisionReceiptRef`);
  }
  verifyHumanDecisionReceipt({
    repoRoot,
    receiptRef: item.decisionReceiptRef,
    candidateId: item.id,
    sourceRevision,
    sourceHashes,
    effectiveRef: item.effectiveRef,
    allowException: true,
    label: `${label} decision receipt`,
  });
}

export function verifyInitiativeAuthority({ repoRoot, initiativeId, allowDone = false }) {
  const root = realpathSync(repoRoot);
  if (!/^I[0-9]{4}$/.test(initiativeId ?? "")) fail(`initiative ID must match I####: ${initiativeId ?? "<missing>"}`);

  const register = readJsonFile(root, "docs/_indexes/initiative-register.json", "initiative register").value;
  if (register?.schemaVersion !== 1 || !Array.isArray(register.initiatives)) fail("initiative register contract is invalid");
  const initiative = requireUnique(register.initiatives, (entry) => entry?.id === initiativeId, `${initiativeId} initiative register entry`);

  if (!new RegExp(`^docs/initiatives/${initiativeId}-.+\\.md$`).test(initiative.documentRef ?? "")) {
    fail(`${initiativeId} documentRef must be its canonical initiative document path`);
  }
  const document = captureRepositoryFile(root, initiative.documentRef, `${initiativeId} canonical document`, ".md");
  const frontmatter = parseFrontmatter(document.bytes, `${initiativeId} canonical document`);
  const allowedStatuses = allowDone ? ["active", "done"] : ["active"];
  if (frontmatter.type !== "initiative" || frontmatter.doc_id !== initiativeId || frontmatter.initiative_contract !== "v1"
    || !allowedStatuses.includes(frontmatter.status) || frontmatter.approval_status !== "approved") {
    fail(`${initiativeId} must be a canonical ${allowedStatuses.join("/")} and approved initiative_contract v1 document`);
  }
  if (initiative.lifecycleState !== frontmatter.status || initiative.approvalState !== "approved"
    || initiative.effectiveRef !== initiative.documentRef || initiative.decisionReceiptRef !== frontmatter.approval_ref) {
    fail(`${initiativeId} document and register lifecycle/approval/effective/receipt mirrors do not match`);
  }
  if (typeof frontmatter.approval_ref !== "string" || !frontmatter.approval_ref.endsWith(".json")) {
    fail(`${initiativeId} approval_ref must be a repository-relative JSON activation receipt`);
  }
  if (!sameStringSet(frontmatter.policy_refs, initiative.policyRefs)
    || !sameStringSet(frontmatter.guideline_refs, initiative.guidelineRefs)
    || frontmatter.guideline_disposition !== initiative.guidelineDisposition
    || frontmatter.guideline_disposition_reason !== initiative.guidelineDispositionReason) {
    fail(`${initiativeId} document and register governance mirrors do not match`);
  }
  if (initiative.guidelineDisposition === "needs_review") {
    fail(`${initiativeId} active/done initiative cannot retain guideline_disposition: needs_review`);
  }
  if ((initiative.policyRelationships ?? []).some((relationship) => relationship.relation === "exception-to")) {
    fail(`${initiativeId} exception-to relationship requires a separately verified active exception receipt`);
  }

  const sourceHashes = verifySourceRefs(root, initiative.sourceRevision, initiative.sourceRefs, `${initiativeId} initiative`);
  verifyHumanDecisionReceipt({
    repoRoot: root,
    receiptRef: frontmatter.approval_ref,
    candidateId: initiativeId,
    sourceRevision: initiative.sourceRevision,
    sourceHashes,
    effectiveRef: initiative.documentRef,
    allowException: false,
    label: `${initiativeId} activation receipt`,
  });

  const catalog = readJsonFile(root, "docs/_indexes/governance-catalog.json", "governance catalog").value;
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.policies) || !Array.isArray(catalog.guidelines)) {
    fail("governance catalog contract is invalid");
  }
  for (const policyRef of initiative.policyRefs ?? []) {
    const policy = requireUnique(catalog.policies, (item) => item?.id === policyRef, `${initiativeId} policy ${policyRef}`);
    verifyEffectiveGovernanceItem(root, policy, `${initiativeId} policy ${policyRef}`);
  }
  for (const relationship of initiative.guidelineRelationships ?? []) {
    const guideline = requireUnique(catalog.guidelines, (item) => item?.id === relationship?.guidelineId, `${initiativeId} guideline ${relationship?.guidelineId}`);
    if (!Array.isArray(guideline.policyRefs)
      || !guideline.policyRefs.some((policyRef) => (initiative.policyRefs ?? []).includes(policyRef))) {
      fail(`${initiativeId} guideline ${guideline.id} must implement at least one linked policy`);
    }
    if (relationship.adoption === "required") {
      verifyEffectiveGovernanceItem(root, guideline, `${initiativeId} required guideline ${guideline.id}`);
    }
  }
  return { initiativeId, documentRef: initiative.documentRef, receiptRef: frontmatter.approval_ref };
}

function parseCli(argv) {
  const options = { allowDone: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--root") options.repoRoot = argv[++index];
    else if (token === "--initiative") options.initiativeId = argv[++index];
    else if (token === "--allow-done") options.allowDone = true;
    else fail(`unknown initiative authority option: ${token}`);
  }
  if (!options.repoRoot || !options.initiativeId) fail("usage: initiative-authority.mjs --root <repository> --initiative <I####> [--allow-done]");
  return options;
}

let invokedPath = null;
if (process.argv[1]) {
  try {
    invokedPath = realpathSync(process.argv[1]);
  } catch {
    invokedPath = null;
  }
}
if (invokedPath && invokedPath === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    verifyInitiativeAuthority(parseCli(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exitCode = 1;
  }
}
