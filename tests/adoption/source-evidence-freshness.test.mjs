import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { inspectSourceEvidence } from "../../docs/lib/source-evidence-freshness.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const captured = [
  "# 문서",
  "",
  "## 관련 절 A",
  "",
  "첫 번째 근거",
  "",
  "## 관련 절 B",
  "",
  "두 번째 근거",
  "",
  "## 무관한 절",
  "",
  "초기 메모",
  ""
].join("\n");

const sourceRef = {
  path: "docs/design/example.md",
  heading: "관련 절 A / 관련 절 B",
  lineStart: 3,
  lineEnd: 9,
  capturedSha256: sha256(captured),
  capturedRepositoryRevision: "a".repeat(40)
};

test("source freshness ignores changes outside the cited Markdown section group", () => {
  const current = captured.replace("초기 메모", "나중에 바뀐 무관한 메모");
  const result = inspectSourceEvidence({
    sourceRef,
    capturedBytes: Buffer.from(captured),
    currentBytes: Buffer.from(current)
  });

  assert.equal(result.state, "current");
  assert.equal(result.fileState, "changed");
  assert.equal(result.freshnessScope, "markdown_section");
  assert.equal(result.reason, "unrelated_file_content_changed");
  assert.equal(result.capturedScope.anchor.text, "관련 절 A");
  assert.equal(result.capturedScope.boundary.text, "무관한 절");
});

test("source freshness becomes stale when any cited section changes", () => {
  const current = captured.replace("두 번째 근거", "의미가 달라진 두 번째 근거");
  const result = inspectSourceEvidence({
    sourceRef,
    capturedBytes: Buffer.from(captured),
    currentBytes: Buffer.from(current)
  });

  assert.equal(result.state, "changed");
  assert.equal(result.fileState, "changed");
  assert.equal(result.reason, "evidence_scope_changed");
  assert.notEqual(result.capturedEvidenceSha256, result.currentEvidenceSha256);
});

test("legacy evidence without a Markdown anchor remains fail-closed at full-file scope", () => {
  const legacy = "첫 줄\n둘째 줄\n";
  const result = inspectSourceEvidence({
    sourceRef: {
      ...sourceRef,
      lineStart: 1,
      lineEnd: 1,
      capturedSha256: sha256(legacy)
    },
    capturedBytes: Buffer.from(legacy),
    currentBytes: Buffer.from(`${legacy}셋째 줄\n`)
  });

  assert.equal(result.freshnessScope, "full_file");
  assert.equal(result.state, "changed");
});
