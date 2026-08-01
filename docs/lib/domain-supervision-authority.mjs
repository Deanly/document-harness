#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDomainDesignAuthority } from "./domain-design-authority.mjs";

const PRIVATE_PATH = /(?:^|\/)(?:\.git|\.env(?:\.[^/]*)?|secrets?|credentials?|private[-_.]?keys?)(?:\/|$)/i;
const SUBJECT_PATH = /^docs\/(projects|tasks|qa)\/[^/]+\.md$/;
const REVIEW_PATH = /^docs\/receipts\/domain-supervision\/[^/]+\.json$/;
const ALLOWED_REVIEW_STATUS = new Set(["aligned", "decision-required", "blocked-conflict"]);
const ALLOWED_DISPOSITIONS = new Set(["change-implementation", "change-domain-model", "temporary-deviation", "stop-delivery"]);
const ALLOWED_EVIDENCE_ROLES = new Set(["code", "schema", "api", "event", "test", "configuration", "delivery-document", "runtime-evidence"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label}는 비어 있지 않은 문자열이어야 합니다.`);
  return value;
}

function requireSha(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label}는 SHA-256이어야 합니다.`);
  return value;
}

function pathIsInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function readSafeRepositoryFile(root, relativePath, label) {
  requireString(relativePath, label);
  if (path.isAbsolute(relativePath) || PRIVATE_PATH.test(relativePath.replaceAll("\\", "/"))) {
    throw new Error(`${label}는 private path가 아닌 repository-relative path여야 합니다: ${relativePath}`);
  }
  const candidate = path.resolve(root, relativePath);
  if (!pathIsInside(root, candidate)) throw new Error(`${label}가 repository를 벗어납니다: ${relativePath}`);
  const lexical = await lstat(candidate);
  if (!lexical.isFile() || lexical.isSymbolicLink()) throw new Error(`${label}는 symlink가 아닌 regular file이어야 합니다: ${relativePath}`);
  const actual = await realpath(candidate);
  if (!pathIsInside(root, actual)) throw new Error(`${label} realpath가 repository를 벗어납니다: ${relativePath}`);
  return readFile(actual);
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === "" || value === "null" || value === "~") return null;
  if (value === "[]") return [];
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  if (/^[0-9]+$/.test(value)) return Number(value);
  return value;
}

function parseFrontmatter(bytes, relativePath) {
  const lines = bytes.toString("utf8").split(/\r?\n/);
  if (lines[0] !== "---") throw new Error(`subject에 YAML frontmatter가 없습니다: ${relativePath}`);
  const end = lines.indexOf("---", 1);
  if (end < 2) throw new Error(`subject frontmatter가 닫히지 않았습니다: ${relativePath}`);
  const result = {};
  let listKey = null;
  for (const line of lines.slice(1, end)) {
    const listItem = line.match(/^  -\s+(.+)$/);
    if (listItem && listKey) {
      if (!Array.isArray(result[listKey])) result[listKey] = [];
      result[listKey].push(parseScalar(listItem[1]));
      continue;
    }
    const match = line.match(/^([A-Za-z0-9_]+):(.*)$/);
    if (!match) continue;
    const value = parseScalar(match[2]);
    result[match[1]] = value;
    listKey = value === null ? match[1] : null;
  }
  return result;
}

function parseJson(bytes, label, relativePath) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} JSON이 올바르지 않습니다: ${relativePath} (${error.message})`);
  }
}

function validateReviewShape(review) {
  if (review.schemaVersion !== 1 || review.kind !== "domain-supervision-review") throw new Error("지원하지 않는 domain supervision review입니다.");
  if (!/^DSR-[A-Z0-9-]+$/.test(review.reviewId ?? "")) throw new Error("domain supervision reviewId가 올바르지 않습니다.");
  if (!ALLOWED_REVIEW_STATUS.has(review.reviewStatus)) throw new Error(`지원하지 않는 domain supervision reviewStatus입니다: ${review.reviewStatus}`);
  if (review.reviewedBy?.actorKind !== "ai-agent" || review.reviewedBy?.identifier !== "ai-domain-expert") {
    throw new Error("domain supervision review는 ai-domain-expert가 발행해야 합니다.");
  }
  if (Number.isNaN(Date.parse(review.reviewedAt ?? ""))) throw new Error("domain supervision reviewedAt이 RFC3339가 아닙니다.");
  if (!/^(working-tree|git:[a-f0-9]{40,64})$/.test(review.repositoryRevision ?? "")) {
    throw new Error("domain supervision repositoryRevision은 working-tree 또는 git:<full-sha>여야 합니다.");
  }
  for (const field of ["problem", "modelExpectation", "implementationReality", "businessImpact", "engineeringImpact"]) {
    requireString(review[field], `domain supervision ${field}`);
  }
  requireString(review.recommendation?.summary, "domain supervision recommendation.summary");
  requireString(review.recommendation?.rationale, "domain supervision recommendation.rationale");
  if (!["high", "medium", "low"].includes(review.confidence)) throw new Error("domain supervision confidence가 올바르지 않습니다.");
  if (!Array.isArray(review.affectedModels) || !Array.isArray(review.implementationEvidence) || review.implementationEvidence.length === 0) {
    throw new Error("domain supervision review는 affectedModels와 하나 이상의 implementationEvidence가 필요합니다.");
  }
  if (!Array.isArray(review.evidenceRefs) || review.evidenceRefs.length === 0) throw new Error("domain supervision review는 evidenceRefs가 필요합니다.");
  if (!Array.isArray(review.options)) throw new Error("domain supervision options는 배열이어야 합니다.");
  const optionIds = new Set();
  for (const option of review.options) {
    requireString(option.id, "domain supervision option.id");
    requireString(option.title, `domain supervision option ${option.id} title`);
    requireString(option.action, `domain supervision option ${option.id} action`);
    requireString(option.benefits, `domain supervision option ${option.id} benefits`);
    requireString(option.costs, `domain supervision option ${option.id} costs`);
    requireString(option.risks, `domain supervision option ${option.id} risks`);
    if (!ALLOWED_DISPOSITIONS.has(option.disposition) || typeof option.reversible !== "boolean") throw new Error(`domain supervision option이 올바르지 않습니다: ${option.id}`);
    if (optionIds.has(option.id)) throw new Error(`domain supervision option id가 중복됩니다: ${option.id}`);
    optionIds.add(option.id);
  }
  const decisionRequired = review.reviewStatus !== "aligned";
  if (review.decisionRequest?.decisionOwner !== "human" || review.decisionRequest?.required !== decisionRequired) {
    throw new Error("domain supervision decisionRequest는 aligned가 아닐 때 human decision을 요구해야 합니다.");
  }
  if (decisionRequired) {
    requireString(review.decisionRequest?.question, "domain supervision decisionRequest.question");
    if (!review.decisionRequest?.decideBefore || review.options.length < 2) throw new Error("decision-required/blocked review는 decideBefore와 둘 이상의 선택지가 필요합니다.");
    if (!optionIds.has(review.recommendation?.optionId)) throw new Error("domain supervision 권고 optionId가 선택지에 없습니다.");
  } else if (review.decisionRequest?.question !== null || review.decisionRequest?.decideBefore !== null) {
    throw new Error("aligned review는 사람의 결정 질문이나 결정 시점을 만들 수 없습니다.");
  }
  return optionIds;
}

function verifyGitRevision(root, revision) {
  if (!revision.startsWith("git:")) return;
  const commit = revision.slice(4);
  try {
    execFileSync("git", ["-C", root, "cat-file", "-e", `${commit}^{commit}`], { stdio: "ignore" });
  } catch {
    throw new Error(`domain supervision repositoryRevision을 resolve할 수 없습니다: ${revision}`);
  }
}

async function validateDecision({ root, decisionPath, decisionBytes, reviewPath, reviewBytes, review, subjectPath, subjectBytes }) {
  const decision = parseJson(decisionBytes, "domain supervision decision", decisionPath);
  if (decision.schemaVersion !== 1 || decision.kind !== "domain-supervision-decision") throw new Error("지원하지 않는 domain supervision decision receipt입니다.");
  if (!/^DSD-[A-Z0-9-]+$/.test(decision.receiptId ?? "")) throw new Error("domain supervision decision receiptId가 올바르지 않습니다.");
  if (decision.reviewRef !== reviewPath || decision.reviewSha256 !== sha256(reviewBytes) || decision.reviewId !== review.reviewId) {
    throw new Error("domain supervision decision이 current review exact bytes와 일치하지 않습니다.");
  }
  if (decision.subjectRef !== subjectPath || decision.subjectSha256 !== sha256(subjectBytes)) {
    throw new Error("domain supervision decision이 current subject exact bytes와 일치하지 않습니다.");
  }
  if (!["approved-option", "rejected", "deferred"].includes(decision.decision)) throw new Error("domain supervision decision이 올바르지 않습니다.");
  if (decision.decidedBy?.actorKind !== "human" || typeof decision.decidedBy?.identifier !== "string" || decision.decidedBy.identifier.trim() === "") {
    throw new Error("domain supervision decision은 식별 가능한 human actor가 필요합니다.");
  }
  if (Number.isNaN(Date.parse(decision.decidedAt ?? ""))) throw new Error("domain supervision decision decidedAt이 RFC3339가 아닙니다.");
  requireString(decision.rationale, "domain supervision decision rationale");
  requireString(decision.riskAcceptance, "domain supervision decision riskAcceptance");
  const selected = review.options.find((option) => option.id === decision.selectedOptionId) ?? null;
  if (decision.decision === "approved-option" && !selected) throw new Error("domain supervision selectedOptionId가 review 선택지에 없습니다.");
  if (decision.decision !== "approved-option" && decision.selectedOptionId !== null) throw new Error("rejected/deferred decision은 selectedOptionId를 가질 수 없습니다.");
  if (selected?.disposition === "temporary-deviation") {
    if (typeof decision.expiresAt !== "string" || Number.isNaN(Date.parse(decision.expiresAt))) throw new Error("temporary domain deviation은 expiresAt이 필요합니다.");
    if (Date.parse(decision.expiresAt) <= Date.parse(decision.decidedAt)) throw new Error("temporary domain deviation expiresAt은 결정 시각 이후여야 합니다.");
    if (Date.parse(decision.expiresAt) <= Date.now()) throw new Error("temporary domain deviation이 만료되었습니다. 모델과 구현을 재정렬하고 새 supervision review를 발행해야 합니다.");
  }
  return { ...decision, selectedOption: selected };
}

export async function validateDomainSupervision({ root, subjectPath, reviewPath, decisionPath = null, closeout = false }) {
  const resolvedRoot = await realpath(root);
  if (!SUBJECT_PATH.test(subjectPath ?? "")) throw new Error(`domain supervision subject path가 올바르지 않습니다: ${subjectPath}`);
  if (!REVIEW_PATH.test(reviewPath ?? "")) throw new Error(`domain supervision review path가 올바르지 않습니다: ${reviewPath}`);
  const subjectBytes = await readSafeRepositoryFile(resolvedRoot, subjectPath, "domain supervision subject");
  const reviewBytes = await readSafeRepositoryFile(resolvedRoot, reviewPath, "domain supervision review");
  const subject = parseFrontmatter(subjectBytes, subjectPath);
  const review = parseJson(reviewBytes, "domain supervision review", reviewPath);
  validateReviewShape(review);
  if (subject.domain_contract !== "v2") throw new Error(`${subjectPath}는 domain_contract: v2여야 합니다.`);
  if (review.subject?.kind !== subject.type || review.subject?.documentRef !== subjectPath || review.subject?.documentSha256 !== sha256(subjectBytes)) {
    throw new Error("domain supervision review가 current subject exact bytes와 일치하지 않습니다.");
  }
  if (subject.domain_supervision_state !== review.reviewStatus || subject.domain_supervision_ref !== reviewPath) {
    throw new Error("subject의 domain supervision state/ref가 review와 일치하지 않습니다.");
  }
  verifyGitRevision(resolvedRoot, review.repositoryRevision);

  const domainImpact = subject.domain_impact;
  const domainContexts = Array.isArray(subject.domain_contexts) ? subject.domain_contexts : [];
  const domainModelRefs = Array.isArray(subject.domain_model_refs) ? subject.domain_model_refs : [];
  if (domainImpact === "required" && (review.affectedModels.length === 0 || review.affectedModels.length !== domainModelRefs.length)) {
    throw new Error("domain impact required subject는 모든 domain_model_refs의 supervision model fence가 필요합니다.");
  }
  if (domainImpact === "none" && review.affectedModels.length !== 0) throw new Error("domain impact none subject는 affectedModels를 가질 수 없습니다.");
  for (const [index, model] of review.affectedModels.entries()) {
    requireString(model.boundedContext, `affectedModels[${index}].boundedContext`);
    requireSha(model.documentSha256, `affectedModels[${index}].documentSha256`);
    if (model.boundedContext !== domainContexts[index] || model.documentRef !== domainModelRefs[index]) {
      throw new Error("domain supervision affectedModels가 subject domain_contexts/domain_model_refs 순서와 일치하지 않습니다.");
    }
    const modelBytes = await readSafeRepositoryFile(resolvedRoot, model.documentRef, "affected domain model");
    if (model.documentSha256 !== sha256(modelBytes)) throw new Error(`domain supervision model bytes가 stale입니다: ${model.documentRef}`);
    const authority = await validateDomainDesignAuthority({ root: resolvedRoot, documentPath: model.documentRef });
    if (model.modelRevision !== authority.modelRevision || model.boundedContext !== authority.boundedContext) {
      throw new Error(`domain supervision model revision/context가 current authority와 일치하지 않습니다: ${model.documentRef}`);
    }
  }

  const inputRefs = [subjectPath, reviewPath, ...review.affectedModels.map((item) => item.documentRef)];
  for (const [index, evidence] of review.implementationEvidence.entries()) {
    if (!ALLOWED_EVIDENCE_ROLES.has(evidence.role)) throw new Error(`implementationEvidence[${index}].role이 올바르지 않습니다.`);
    requireSha(evidence.sha256, `implementationEvidence[${index}].sha256`);
    const bytes = await readSafeRepositoryFile(resolvedRoot, evidence.ref, `implementationEvidence[${index}]`);
    if (evidence.sha256 !== sha256(bytes)) throw new Error(`domain supervision implementation evidence가 stale입니다: ${evidence.ref}`);
    inputRefs.push(evidence.ref);
  }
  for (const [index, evidenceRef] of review.evidenceRefs.entries()) {
    await readSafeRepositoryFile(resolvedRoot, evidenceRef, `domain supervision evidenceRefs[${index}]`);
    inputRefs.push(evidenceRef);
  }

  let decision = null;
  if (decisionPath) {
    if (!REVIEW_PATH.test(decisionPath)) throw new Error(`domain supervision decision path가 올바르지 않습니다: ${decisionPath}`);
    const decisionBytes = await readSafeRepositoryFile(resolvedRoot, decisionPath, "domain supervision decision");
    decision = await validateDecision({ root: resolvedRoot, decisionPath, decisionBytes, reviewPath, reviewBytes, review, subjectPath, subjectBytes });
    inputRefs.push(decisionPath);
  }
  if ((subject.domain_decision_ref ?? null) !== decisionPath) throw new Error("subject domain_decision_ref가 검증한 decision path와 일치하지 않습니다.");

  if (closeout) {
    if (review.reviewStatus === "blocked-conflict") throw new Error("blocked domain conflict가 남아 있어 closeout할 수 없습니다.");
    if (review.reviewStatus === "decision-required") {
      if (!decision || decision.decision !== "approved-option") throw new Error("사람의 domain supervision 결정 없이 closeout할 수 없습니다.");
      if (decision.selectedOption?.disposition !== "temporary-deviation") {
        throw new Error("코드/모델 변경 선택은 실행 후 새 aligned supervision review가 있어야 closeout할 수 있습니다.");
      }
    }
  }

  return {
    reviewId: review.reviewId,
    reviewStatus: review.reviewStatus,
    subjectKind: subject.type,
    subjectId: subject.doc_id ?? path.basename(subjectPath, ".md"),
    subjectTitle: subject.title ?? path.basename(subjectPath, ".md"),
    subjectRef: subjectPath,
    subjectSha256: sha256(subjectBytes),
    repositoryRevision: review.repositoryRevision,
    problem: review.problem,
    modelExpectation: review.modelExpectation,
    implementationReality: review.implementationReality,
    businessImpact: review.businessImpact,
    engineeringImpact: review.engineeringImpact,
    recommendation: review.recommendation,
    confidence: review.confidence,
    options: review.options,
    decisionRequest: review.decisionRequest,
    affectedModels: review.affectedModels,
    implementationEvidence: review.implementationEvidence,
    reviewedAt: review.reviewedAt,
    reviewRef: reviewPath,
    reviewSha256: sha256(reviewBytes),
    decision: decision ? {
      receiptId: decision.receiptId,
      decision: decision.decision,
      selectedOptionId: decision.selectedOptionId,
      selectedDisposition: decision.selectedOption?.disposition ?? null,
      rationale: decision.rationale,
      riskAcceptance: decision.riskAcceptance,
      expiresAt: decision.expiresAt ?? null,
      decidedBy: decision.decidedBy.identifier,
      decidedAt: decision.decidedAt,
      decisionRef: decisionPath
    } : null,
    inputRefs: [...new Set(inputRefs)]
  };
}

function parseArgs(argv) {
  const result = { closeout: false, decisionPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--root") result.root = argv[++index];
    else if (token === "--subject") result.subjectPath = argv[++index];
    else if (token === "--review") result.reviewPath = argv[++index];
    else if (token === "--decision") result.decisionPath = argv[++index];
    else if (token === "--closeout") result.closeout = true;
    else throw new Error(`지원하지 않는 argument입니다: ${token}`);
  }
  if (!result.root || !result.subjectPath || !result.reviewPath) {
    throw new Error("usage: domain-supervision-authority.mjs --root <repository> --subject <doc> --review <receipt> [--decision <receipt>] [--closeout]");
  }
  return result;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await validateDomainSupervision(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exitCode = 1;
  }
}
