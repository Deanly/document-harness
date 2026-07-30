#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRIVATE_PATH = /(?:^|\/)(?:\.git|\.env(?:\.[^/]*)?|secrets?|credentials?|private[-_.]?keys?)(?:\/|$)/i;
const ALLOWED_STATUS = new Set(["missing", "review_requested", "ready"]);
const CODE_IDENTIFIER = /\b(?:BC|TERM|AGG|ENT|VO|CMD|EVT|POL|BR|SCN)-[A-Z0-9-]+\b/g;
const TECHNICAL_TITLE = /^(?:[A-Za-z0-9]+(?:[-_.:/][A-Za-z0-9]+)+|[A-Z0-9_-]{4,})$/;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function pathIsInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === "" || value === "null" || value === "~") return null;
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  if (/^[0-9]+$/.test(value)) return Number(value);
  return value;
}

function parseFrontmatter(bytes, relativePath) {
  const lines = bytes.toString("utf8").split(/\r?\n/);
  if (lines[0] !== "---") throw new Error(`문서에 YAML frontmatter가 없습니다: ${relativePath}`);
  const end = lines.indexOf("---", 1);
  if (end < 2) throw new Error(`문서 frontmatter가 닫히지 않았습니다: ${relativePath}`);
  const result = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([A-Za-z0-9_]+):(.*)$/);
    if (match) result[match[1]] = parseScalar(match[2]);
  }
  return result;
}

export function assessHumanPresentation({ displayTitle, humanSummary, declaredStatus }) {
  const status = declaredStatus ?? "missing";
  if (!ALLOWED_STATUS.has(status)) {
    return { state: "invalid", reason: `지원하지 않는 presentation status입니다: ${status}` };
  }
  if (status === "missing") {
    return { state: "missing", reason: "사람용 제목과 설명이 아직 준비되지 않았습니다." };
  }
  const title = typeof displayTitle === "string" ? displayTitle.trim() : "";
  const summary = typeof humanSummary === "string" ? humanSummary.trim() : "";
  if (title.length < 4) return { state: "invalid", reason: "사람용 제목은 4자 이상이어야 합니다." };
  if (TECHNICAL_TITLE.test(title)) {
    return { state: "invalid", reason: "사람용 제목이 기술 식별자 또는 경로 형태입니다." };
  }
  if (summary.length < 24) return { state: "invalid", reason: "사람용 요약은 24자 이상의 온전한 문장이어야 합니다." };
  const words = summary
    .replaceAll(CODE_IDENTIFIER, " ")
    .replace(/`[^`]*`/g, " ")
    .match(/[A-Za-z가-힣][A-Za-z가-힣0-9]*/g) ?? [];
  if (words.length < 4) {
    return { state: "invalid", reason: "사람용 요약이 문장보다 기술 토큰 나열에 가깝습니다." };
  }
  return { state: status, reason: null, displayTitle: title, humanSummary: summary };
}

export function validateHumanPresentationReceipt(receipt, {
  documentRef,
  documentSha256,
  subjectKind,
  subjectId,
  expectedLocale
}) {
  if (receipt?.schemaVersion !== 1 || receipt?.kind !== "human-presentation-review") {
    throw new Error("지원하지 않는 human presentation review receipt입니다.");
  }
  if (receipt.decision !== "ready") throw new Error("presentation receipt decision이 ready가 아닙니다.");
  if (receipt.documentRef !== documentRef) throw new Error("presentation receipt documentRef가 일치하지 않습니다.");
  if (receipt.documentSha256 !== documentSha256) throw new Error("presentation receipt가 current document bytes를 검토하지 않았습니다.");
  if (receipt.subjectKind !== subjectKind) throw new Error("presentation receipt subjectKind가 일치하지 않습니다.");
  if (receipt.subjectId !== subjectId) throw new Error("presentation receipt subjectId가 일치하지 않습니다.");
  if (typeof receipt.locale !== "string" || receipt.locale.trim() === "") throw new Error("presentation receipt locale이 없습니다.");
  if (expectedLocale && receipt.locale !== expectedLocale) throw new Error("presentation receipt locale이 configured presentation.locale과 일치하지 않습니다.");
  if (receipt.decidedBy?.actorKind !== "human" || typeof receipt.decidedBy?.identifier !== "string" || receipt.decidedBy.identifier.trim() === "") {
    throw new Error("presentation review는 식별 가능한 human actor가 필요합니다.");
  }
  if (Number.isNaN(Date.parse(receipt.decidedAt ?? ""))) throw new Error("presentation receipt decidedAt이 RFC3339가 아닙니다.");
  return {
    receiptRef: null,
    decidedBy: receipt.decidedBy.identifier,
    decidedAt: receipt.decidedAt,
    locale: receipt.locale
  };
}

async function readSafeRepositoryFile(root, relativePath, label) {
  if (typeof relativePath !== "string" || relativePath.trim() === "" || path.isAbsolute(relativePath)) {
    throw new Error(`${label}는 비어 있지 않은 repository-relative path여야 합니다.`);
  }
  const normalized = relativePath.replaceAll("\\", "/");
  if (PRIVATE_PATH.test(normalized)) throw new Error(`${label}는 private path를 참조할 수 없습니다: ${relativePath}`);
  const candidate = path.resolve(root, relativePath);
  if (!pathIsInside(root, candidate)) throw new Error(`${label}가 repository를 벗어납니다: ${relativePath}`);
  const lexical = await lstat(candidate);
  if (lexical.isSymbolicLink() || !lexical.isFile()) throw new Error(`${label}는 symlink가 아닌 regular file이어야 합니다: ${relativePath}`);
  const actual = await realpath(candidate);
  if (!pathIsInside(root, actual)) throw new Error(`${label} realpath가 repository를 벗어납니다: ${relativePath}`);
  return readFile(actual);
}

export async function validateHumanPresentationAuthority({ root, documentPath, expectedLocale, allowReview = false }) {
  const resolvedRoot = await realpath(root);
  const documentBytes = await readSafeRepositoryFile(resolvedRoot, documentPath, "presentation document");
  const document = parseFrontmatter(documentBytes, documentPath);
  const assessment = assessHumanPresentation({
    displayTitle: document.display_title,
    humanSummary: document.human_summary,
    declaredStatus: document.presentation_status
  });
  if (allowReview && ["missing", "review_requested"].includes(assessment.state)) {
    return {
      documentRef: documentPath,
      presentationStatus: assessment.state,
      receiptRef: null,
      decidedBy: null,
      decidedAt: null,
      locale: null
    };
  }
  if (assessment.state !== "ready") {
    throw new Error(`presentation_status가 review_requested 또는 ready이면 검토 가능한 사람용 제목·요약이 필요합니다: ${documentPath}`);
  }
  if (typeof document.presentation_ref !== "string" || document.presentation_ref.trim() === "") {
    throw new Error(`ready presentation에는 presentation_ref가 필요합니다: ${documentPath}`);
  }
  const receiptBytes = await readSafeRepositoryFile(resolvedRoot, document.presentation_ref, "presentation review receipt");
  let receipt;
  try {
    receipt = JSON.parse(receiptBytes.toString("utf8"));
  } catch (error) {
    throw new Error(`presentation review receipt JSON이 올바르지 않습니다: ${document.presentation_ref} (${error.message})`);
  }
  const result = validateHumanPresentationReceipt(receipt, {
    documentRef: documentPath,
    documentSha256: sha256(documentBytes),
    subjectKind: document.design_kind,
    subjectId: document.bounded_context_id,
    expectedLocale
  });
  return { ...result, receiptRef: document.presentation_ref, documentRef: documentPath };
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--root") result.root = argv[++index];
    else if (token === "--document") result.documentPath = argv[++index];
    else if (token === "--locale") result.expectedLocale = argv[++index];
    else if (token === "--allow-review") result.allowReview = true;
    else throw new Error(`지원하지 않는 argument입니다: ${token}`);
  }
  if (!result.root || !result.documentPath) {
    throw new Error("usage: human-presentation-authority.mjs --root <repository> --document <repository-relative-path> [--locale <locale>] [--allow-review]");
  }
  return result;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await validateHumanPresentationAuthority(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exitCode = 1;
  }
}
