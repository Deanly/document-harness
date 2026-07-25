import { createHash } from "node:crypto";

const ATX_HEADING = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function markdownDocument(bytes) {
  const text = Buffer.from(bytes).toString("utf8").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const headings = [];
  let fence = null;

  for (const [index, line] of lines.entries()) {
    const fenceMatch = line.match(FENCE_OPEN);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      const length = fenceMatch[1].length;
      if (!fence) {
        fence = { marker, length };
      } else if (fence.marker === marker && fenceMatch[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fence) continue;
    const heading = line.match(ATX_HEADING);
    if (!heading) continue;
    headings.push({
      line: index + 1,
      level: heading[1].length,
      text: heading[2].trim()
    });
  }

  return { lines, headings };
}

function sectionText(document, startLine, endLine) {
  return document.lines.slice(startLine - 1, endLine).join("\n");
}

function headingOccurrence(headings, target) {
  return headings
    .filter((heading) => (
      heading.line <= target.line
      && heading.level === target.level
      && heading.text === target.text
    ))
    .length;
}

function findHeadingByOccurrence(headings, target, afterLine = 0) {
  let occurrence = 0;
  for (const heading of headings) {
    if (heading.level !== target.level || heading.text !== target.text) continue;
    occurrence += 1;
    if (occurrence === target.occurrence && heading.line > afterLine) return heading;
  }
  return null;
}

function deriveCapturedScope(document, sourceRef) {
  const lineStart = sourceRef?.lineStart;
  const lineEnd = sourceRef?.lineEnd;
  if (
    !Number.isInteger(lineStart)
    || !Number.isInteger(lineEnd)
    || lineStart < 1
    || lineEnd < lineStart
    || lineEnd > document.lines.length
  ) {
    return { mode: "invalid", reason: "captured_line_range_invalid" };
  }

  const anchor = [...document.headings]
    .reverse()
    .find((heading) => heading.line <= lineStart);
  if (!anchor) {
    return {
      mode: "full_file",
      reason: "legacy_without_markdown_anchor",
      startLine: 1,
      endLine: document.lines.length
    };
  }

  const boundary = document.headings.find((heading) => (
    heading.line > lineEnd && heading.level <= anchor.level
  )) ?? null;
  const endLine = boundary ? boundary.line - 1 : document.lines.length;
  return {
    mode: "markdown_section",
    reason: null,
    startLine: anchor.line,
    endLine,
    anchor: {
      level: anchor.level,
      text: anchor.text,
      occurrence: headingOccurrence(document.headings, anchor)
    },
    boundary: boundary ? {
      level: boundary.level,
      text: boundary.text,
      occurrence: headingOccurrence(document.headings, boundary)
    } : null
  };
}

function deriveCurrentScope(document, capturedScope) {
  if (capturedScope.mode === "full_file") {
    return {
      mode: "full_file",
      startLine: 1,
      endLine: document.lines.length
    };
  }

  const anchor = findHeadingByOccurrence(document.headings, capturedScope.anchor);
  if (!anchor) return { mode: "invalid", reason: "current_anchor_missing" };

  let boundary = null;
  if (capturedScope.boundary) {
    boundary = findHeadingByOccurrence(document.headings, capturedScope.boundary, anchor.line);
    if (!boundary) return { mode: "invalid", reason: "current_boundary_missing" };
  }
  return {
    mode: "markdown_section",
    startLine: anchor.line,
    endLine: boundary ? boundary.line - 1 : document.lines.length,
    anchor: { level: anchor.level, text: anchor.text },
    boundary: boundary ? { level: boundary.level, text: boundary.text } : null
  };
}

export function inspectSourceEvidence({ sourceRef, capturedBytes, currentBytes }) {
  const capturedSha256 = sha256(capturedBytes);
  const currentSha256 = sha256(currentBytes);
  const base = {
    capturedSha256,
    currentSha256,
    fileState: capturedSha256 === currentSha256 ? "current" : "changed",
    freshnessScope: null,
    capturedEvidenceSha256: null,
    currentEvidenceSha256: null,
    capturedScope: null,
    currentScope: null
  };

  if (capturedSha256 !== sourceRef?.capturedSha256) {
    return {
      ...base,
      state: "invalid",
      reason: "captured_hash_mismatch"
    };
  }

  const capturedDocument = markdownDocument(capturedBytes);
  const capturedScope = deriveCapturedScope(capturedDocument, sourceRef);
  if (capturedScope.mode === "invalid") {
    return {
      ...base,
      state: "invalid",
      reason: capturedScope.reason,
      capturedScope
    };
  }

  const currentDocument = markdownDocument(currentBytes);
  const currentScope = deriveCurrentScope(currentDocument, capturedScope);
  if (currentScope.mode === "invalid") {
    return {
      ...base,
      freshnessScope: capturedScope.mode,
      state: "changed",
      reason: currentScope.reason,
      capturedScope,
      currentScope
    };
  }

  const capturedEvidenceSha256 = sha256(sectionText(
    capturedDocument,
    capturedScope.startLine,
    capturedScope.endLine
  ));
  const currentEvidenceSha256 = sha256(sectionText(
    currentDocument,
    currentScope.startLine,
    currentScope.endLine
  ));
  return {
    ...base,
    freshnessScope: capturedScope.mode,
    capturedEvidenceSha256,
    currentEvidenceSha256,
    capturedScope,
    currentScope,
    state: capturedEvidenceSha256 === currentEvidenceSha256 ? "current" : "changed",
    reason: capturedEvidenceSha256 === currentEvidenceSha256
      ? (base.fileState === "changed" ? "unrelated_file_content_changed" : null)
      : "evidence_scope_changed"
  };
}
