import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateDomainSupervision } from "../../docs/lib/domain-supervision-authority.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function write(root, relativePath, value) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, value, "utf8");
}

async function fixture(t, { state = "aligned", decisionRef = "" } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "domain-supervision-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q", root]);
  const modelRef = "docs/design/contexts/access/domain-model.md";
  const modelReceiptRef = "docs/design/receipts/access.json";
  const model = `---
type: design
design_kind: bounded-context
status: current
bounded_context: access
bounded_context_id: BC-ACCESS
model_revision: 1
validation_status: approved
validation_ref: ${modelReceiptRef}
domain_expert_agent: ai-domain-expert
authority_mode: human-confirmed
decision_tier: material
board_review_level: business-rule
board_review_status: confirmed
---

# Access
`;
  await write(root, modelRef, model);
  await write(root, modelReceiptRef, JSON.stringify({
    schemaVersion: 2,
    kind: "domain-design-approval",
    receiptId: "DDD-ACCESS-1",
    decision: "approved",
    documentRef: modelRef,
    documentSha256: sha256(model),
    modelRevision: 1,
    boundedContext: "access",
    authorityMode: "human-confirmed",
    decisionTier: "material",
    modelingLevel: "business-rule",
    decidedBy: { actorKind: "human", identifier: "product-owner" },
    decidedAt: "2026-08-01T00:00:00.000Z",
    reason: "Confirmed access responsibility.",
    evidenceRefs: [modelRef],
    challengeSummary: "Login and entitlement were separated."
  }));
  const subjectRef = "docs/tasks/T0001-access.md";
  const reviewRef = "docs/receipts/domain-supervision/DSR-T0001-1.json";
  const task = `---
type: task
doc_id: T0001
title: access delivery
status: active
domain_contract: v2
domain_impact: required
domain_supervision_state: ${state}
domain_supervision_ref: ${reviewRef}
domain_decision_ref: ${decisionRef}
domain_contexts:
  - access
domain_model_refs:
  - ${modelRef}
---

# Access delivery
`;
  await write(root, subjectRef, task);
  const codeRef = "src/access.mjs";
  const code = "export const loginCreatesEntitlement = false;\n";
  await write(root, codeRef, code);
  return { root, modelRef, model, subjectRef, task, reviewRef, codeRef, code, decisionRef };
}

function alignedReview(values) {
  return {
    schemaVersion: 1,
    kind: "domain-supervision-review",
    reviewId: "DSR-T0001-1",
    reviewStatus: "aligned",
    subject: { kind: "task", documentRef: values.subjectRef, documentSha256: sha256(values.task) },
    repositoryRevision: "working-tree",
    affectedModels: [{ boundedContext: "access", documentRef: values.modelRef, documentSha256: sha256(values.model), modelRevision: 1 }],
    implementationEvidence: [{ ref: values.codeRef, sha256: sha256(values.code), role: "code" }],
    problem: "승인된 Access 규칙과 구현 사이에 미해결 충돌이 없습니다.",
    modelExpectation: "로그인은 사용권을 생성하지 않습니다.",
    implementationReality: "로그인 구현은 기존 사용권만 확인합니다.",
    businessImpact: "로그인만으로 사용 자격이 생기지 않습니다.",
    engineeringImpact: "인증과 entitlement lifecycle이 분리됩니다.",
    recommendation: { optionId: null, summary: "현재 정렬을 유지합니다.", rationale: "모델과 구현 evidence가 일치합니다." },
    confidence: "high",
    options: [],
    decisionRequest: { required: false, question: null, decisionOwner: "human", decideBefore: null },
    evidenceRefs: [values.codeRef],
    reviewedBy: { actorKind: "ai-agent", identifier: "ai-domain-expert" },
    reviewedAt: "2026-08-01T01:00:00.000Z"
  };
}

test("AI Domain Expert supervision binds task, model, and implementation exact bytes", async (t) => {
  const values = await fixture(t);
  await write(values.root, values.reviewRef, JSON.stringify(alignedReview(values)));
  const result = await validateDomainSupervision({ root: values.root, subjectPath: values.subjectRef, reviewPath: values.reviewRef, closeout: true });
  assert.equal(result.reviewStatus, "aligned");

  await write(values.root, values.codeRef, `${values.code}// drift\n`);
  await assert.rejects(
    validateDomainSupervision({ root: values.root, subjectPath: values.subjectRef, reviewPath: values.reviewRef }),
    /implementation evidence가 stale/
  );
});

test("human selection does not replace re-alignment except for an expiring temporary deviation", async (t) => {
  const decisionRef = "docs/receipts/domain-supervision/DSD-T0001-1.json";
  const values = await fixture(t, { state: "decision-required", decisionRef });
  const review = {
    ...alignedReview(values),
    reviewStatus: "decision-required",
    problem: "승인된 모델과 현재 구현이 충돌합니다.",
    implementationReality: "로그인이 사용권을 자동 생성합니다.",
    recommendation: { optionId: "fix-code", summary: "구현을 모델에 맞춥니다.", rationale: "사용 자격 lifecycle을 로그인과 분리해야 합니다." },
    options: [
      { id: "fix-code", title: "구현 변경", disposition: "change-implementation", action: "자동 생성을 제거합니다.", benefits: "경계를 지킵니다.", costs: "코드를 수정합니다.", risks: "기존 흐름 migration이 필요합니다.", reversible: true },
      { id: "temporary", title: "임시 편차", disposition: "temporary-deviation", action: "한시적으로 기존 구현을 유지합니다.", benefits: "즉시 변경 비용을 늦춥니다.", costs: "도메인 부채를 추적합니다.", risks: "잘못된 자격 생성이 지속됩니다.", reversible: true }
    ],
    decisionRequest: { required: true, question: "구현을 고칠까요, 만료가 있는 임시 편차를 수용할까요?", decisionOwner: "human", decideBefore: "closeout" }
  };
  const reviewBytes = JSON.stringify(review);
  await write(values.root, values.reviewRef, reviewBytes);
  const decision = {
    schemaVersion: 1,
    kind: "domain-supervision-decision",
    receiptId: "DSD-T0001-1",
    reviewRef: values.reviewRef,
    reviewSha256: sha256(reviewBytes),
    reviewId: review.reviewId,
    subjectRef: values.subjectRef,
    subjectSha256: sha256(values.task),
    decision: "approved-option",
    selectedOptionId: "fix-code",
    rationale: "모델을 유지합니다.",
    riskAcceptance: "구현 변경 전에는 closeout하지 않습니다.",
    expiresAt: null,
    decidedBy: { actorKind: "human", identifier: "product-owner" },
    decidedAt: "2026-08-01T02:00:00.000Z"
  };
  await write(values.root, decisionRef, JSON.stringify(decision));
  await assert.rejects(
    validateDomainSupervision({ root: values.root, subjectPath: values.subjectRef, reviewPath: values.reviewRef, decisionPath: decisionRef, closeout: true }),
    /새 aligned supervision review/
  );

  decision.selectedOptionId = "temporary";
  decision.rationale = "migration 기간 동안만 기존 구현을 유지합니다.";
  decision.riskAcceptance = "잘못된 자격 생성 위험을 7일 동안 명시적으로 수용합니다.";
  decision.expiresAt = "2999-08-08T02:00:00.000Z";
  await write(values.root, decisionRef, JSON.stringify(decision));
  const accepted = await validateDomainSupervision({ root: values.root, subjectPath: values.subjectRef, reviewPath: values.reviewRef, decisionPath: decisionRef, closeout: true });
  assert.equal(accepted.decision.selectedDisposition, "temporary-deviation");

  decision.expiresAt = "2026-08-01T02:00:01.000Z";
  await write(values.root, decisionRef, JSON.stringify(decision));
  await assert.rejects(
    validateDomainSupervision({ root: values.root, subjectPath: values.subjectRef, reviewPath: values.reviewRef, decisionPath: decisionRef, closeout: true }),
    /temporary domain deviation이 만료/
  );
});
