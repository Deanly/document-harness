#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRIVATE_PATH = /(?:^|\/)(?:\.git|\.env(?:\.[^/]*)?|secrets?|credentials?|private[-_.]?keys?)(?:\/|$)/i;

function sha256(value) {
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
  if (lines[0] !== "---") throw new Error(`domain design에 YAML frontmatter가 없습니다: ${relativePath}`);
  const end = lines.indexOf("---", 1);
  if (end < 2) throw new Error(`domain design frontmatter가 닫히지 않았습니다: ${relativePath}`);
  const result = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([A-Za-z0-9_]+):(.*)$/);
    if (match) result[match[1]] = parseScalar(match[2]);
  }
  return result;
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

export async function validateDomainDesignAuthority({ root, documentPath }) {
  const resolvedRoot = await realpath(root);
  const documentBytes = await readSafeRepositoryFile(resolvedRoot, documentPath, "domain design");
  const design = parseFrontmatter(documentBytes, documentPath);
  if (design.type !== "design") throw new Error(`domain design type이 design이 아닙니다: ${documentPath}`);
  if (design.status !== "current" || design.validation_status !== "approved") {
    throw new Error(`current domain design은 status: current와 validation_status: approved가 필요합니다: ${documentPath}`);
  }
  if (!Number.isInteger(design.model_revision) || design.model_revision < 1) {
    throw new Error(`domain design model_revision이 positive integer가 아닙니다: ${documentPath}`);
  }
  const receiptPath = design.validation_ref;
  const receiptBytes = await readSafeRepositoryFile(resolvedRoot, receiptPath, "domain design approval receipt");
  let receipt;
  try {
    receipt = JSON.parse(receiptBytes.toString("utf8"));
  } catch (error) {
    throw new Error(`domain design approval receipt JSON이 올바르지 않습니다: ${receiptPath} (${error.message})`);
  }
  if (receipt.schemaVersion !== 1 || receipt.kind !== "domain-design-approval") {
    throw new Error(`지원하지 않는 domain design approval receipt입니다: ${receiptPath}`);
  }
  if (receipt.decision !== "approved") throw new Error(`domain design receipt decision이 approved가 아닙니다: ${receiptPath}`);
  if (receipt.documentRef !== documentPath) throw new Error(`domain design receipt documentRef가 일치하지 않습니다: ${receiptPath}`);
  if (receipt.documentSha256 !== sha256(documentBytes)) throw new Error(`domain design receipt가 current document bytes를 승인하지 않습니다: ${documentPath}`);
  if (receipt.modelRevision !== design.model_revision) throw new Error(`domain design receipt modelRevision이 일치하지 않습니다: ${receiptPath}`);
  if (receipt.boundedContext !== design.bounded_context) throw new Error(`domain design receipt boundedContext가 일치하지 않습니다: ${receiptPath}`);
  if (receipt.decidedBy?.actorKind !== "human" || typeof receipt.decidedBy?.identifier !== "string" || receipt.decidedBy.identifier.trim() === "") {
    throw new Error(`domain design approval은 식별 가능한 human actor가 필요합니다: ${receiptPath}`);
  }
  if (Number.isNaN(Date.parse(receipt.decidedAt ?? ""))) throw new Error(`domain design receipt decidedAt이 RFC3339가 아닙니다: ${receiptPath}`);
  return {
    documentRef: documentPath,
    documentSha256: receipt.documentSha256,
    modelRevision: receipt.modelRevision,
    boundedContext: receipt.boundedContext,
    receiptRef: receiptPath
  };
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--root") result.root = argv[++index];
    else if (token === "--document") result.documentPath = argv[++index];
    else throw new Error(`지원하지 않는 argument입니다: ${token}`);
  }
  if (!result.root || !result.documentPath) {
    throw new Error("usage: domain-design-authority.mjs --root <repository> --document <repository-relative-design-path>");
  }
  return result;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await validateDomainDesignAuthority(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exitCode = 1;
  }
}
