import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assessHumanPresentation,
  sha256,
  validateHumanPresentationAuthority,
  validateHumanPresentationReceipt
} from "../../../docs/lib/human-presentation-authority.mjs";

test("human presentation quality rejects technical fallback and accepts complete reader-facing copy", () => {
  assert.equal(assessHumanPresentation({
    displayTitle: "BC-EXECUTION",
    humanSummary: "BC-EXECUTION CMD-RUN EVT-DONE",
    declaredStatus: "review_requested"
  }).state, "invalid");

  assert.deepEqual(assessHumanPresentation({
    displayTitle: "목표가 잠긴 실행",
    humanSummary: "승인된 목표와 현재 작업을 연결하고 멈춘 이유를 사람이 확인할 수 있게 합니다.",
    declaredStatus: "review_requested"
  }), {
    state: "review_requested",
    reason: null,
    displayTitle: "목표가 잠긴 실행",
    humanSummary: "승인된 목표와 현재 작업을 연결하고 멈춘 이유를 사람이 확인할 수 있게 합니다."
  });
});

test("ready presentation requires a human receipt for the exact current document bytes", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "human-presentation-authority-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "docs", "design", "receipts"), { recursive: true });

  const documentPath = "docs/design/domain-landscape.md";
  const receiptPath = "docs/design/receipts/domain-presentation-r1.json";
  const documentBytes = `---
type: design
design_kind: domain-landscape
title: domain-landscape
display_title: 서비스가 맡는 업무의 전체 모습
human_summary: 서비스가 맡는 주요 업무 영역과 책임 경계를 한눈에 이해할 수 있게 설명합니다.
presentation_status: ready
presentation_ref: ${receiptPath}
bounded_context_id: DOMAIN
---

# Domain Landscape
`;
  await writeFile(path.join(root, documentPath), documentBytes, "utf8");
  const receipt = {
    schemaVersion: 1,
    kind: "human-presentation-review",
    receiptId: "PRESENTATION-DOMAIN-1",
    decision: "ready",
    subjectKind: "domain-landscape",
    subjectId: "DOMAIN",
    documentRef: documentPath,
    documentSha256: sha256(documentBytes),
    locale: "ko-KR",
    decidedBy: { actorKind: "human", identifier: "fixture-reviewer" },
    decidedAt: "2026-07-30T00:00:00.000Z",
    reason: "사람이 읽을 수 있는 제목과 설명을 검토했습니다."
  };
  await writeFile(path.join(root, receiptPath), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

  const ready = await validateHumanPresentationAuthority({
    root,
    documentPath,
    expectedLocale: "ko-KR"
  });
  assert.equal(ready.receiptRef, receiptPath);
  assert.equal(ready.decidedBy, "fixture-reviewer");

  await writeFile(path.join(root, documentPath), `${documentBytes}\n변경된 문장\n`, "utf8");
  await assert.rejects(
    validateHumanPresentationAuthority({ root, documentPath, expectedLocale: "ko-KR" }),
    /current document bytes/
  );
});

test("presentation receipt cannot treat an AI actor as the human reviewer", () => {
  assert.throws(() => validateHumanPresentationReceipt({
    schemaVersion: 1,
    kind: "human-presentation-review",
    decision: "ready",
    subjectKind: "bounded-context",
    subjectId: "BC-EXECUTION",
    documentRef: "docs/design/contexts/execution/domain-model.md",
    documentSha256: "a".repeat(64),
    locale: "ko-KR",
    decidedBy: { actorKind: "agent", identifier: "codex" },
    decidedAt: "2026-07-30T00:00:00.000Z"
  }, {
    documentRef: "docs/design/contexts/execution/domain-model.md",
    documentSha256: "a".repeat(64),
    subjectKind: "bounded-context",
    subjectId: "BC-EXECUTION",
    expectedLocale: "ko-KR"
  }), /human actor/);
});
