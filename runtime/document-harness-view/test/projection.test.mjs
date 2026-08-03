import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildProjection, sha256 } from "../lib/projection.mjs";
import { advanceHead, createFixture, git } from "./helpers.mjs";

test("projection keeps approval, migration fence, current repository, and source evidence separate", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath, snapshotSeq: 7 });

  assert.equal(result.snapshot.snapshot.seq, 7);
  assert.equal(result.snapshot.runtimeVersion, "1.8.2");
  assert.equal(result.snapshot.snapshot.freshness, "fresh");
  assert.equal(result.snapshot.migrationFence.state, "valid");
  assert.equal(result.snapshot.migrationFence.resolvedBaseCommit, fixture.seedCommit);
  assert.equal(result.snapshot.currentRepository.head, fixture.seedCommit);
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "fresh");
  assert.equal(result.snapshot.policies[0].evidenceState, "current");
  assert.equal(result.snapshot.policies[0].sourceRefs[0].capturedRepositoryRevision, fixture.seedCommit);
  assert.equal(result.snapshot.policies[0].approvalState, "unreviewed");
  assert.equal(result.snapshot.summary.approvedCount, 0);
  assert.equal(result.snapshot.execution.status, "not_configured");
  assert.equal(result.snapshot.domain.status, "not_configured");
  assert.equal(result.snapshot.domain.sourceRoot, "docs/design");
  assert.equal(result.snapshot.domain.sourceContract, "docs-design-only");
  assert.ok(result.snapshot.attention.some((item) => item.id === "ATTN-DOMAIN-DESIGN-NOT-CONFIGURED"));
  assert.equal(result.snapshot.snapshot.capabilities.write, false);
});

test("domain projection never promotes legacy discovery placeholders into a Board domain", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await mkdir(path.join(fixture.root, "docs", "design"), { recursive: true });
  await writeFile(path.join(fixture.root, "docs", "design", "domain-landscape.md"), `---
type: design
design_kind: domain-landscape
title: discovery-landscape
status: draft
model_revision: 1
validation_status: unreviewed
---

# Discovery Landscape

## Unknowns And Disputes

- Actual bounded contexts require domain-expert review.
`, "utf8");
  await writeFile(path.join(fixture.root, "docs", "design", "context-map.md"), `---
type: design
design_kind: context-map
title: discovery-context-map
status: draft
model_revision: 1
validation_status: unreviewed
---

# Discovery Context Map

## Context Relationships

| Upstream | Downstream | Relationship Pattern | Published Language / ACL | Consistency | Failure Ownership |
| --- | --- | --- | --- | --- | --- |
| BC-DISCOVERY | BC-DISCOVERY | discovery-only | not established | not established | repository-domain-owner |
`, "utf8");

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(result.snapshot.domain.contexts.length, 0);
  assert.equal(result.snapshot.domain.configured, false);
  assert.equal(result.snapshot.domain.status, "not_configured");
  assert.equal(result.snapshot.domain.sourceContract, "docs-design-only");
  assert.deepEqual(result.snapshot.domain.discoveryRefs, [
    "docs/design/context-map.md",
    "docs/design/domain-landscape.md"
  ]);
  const attention = result.snapshot.attention.find((item) => item.id === "ATTN-DOMAIN-DESIGN-NOT-CONFIGURED");
  assert.ok(attention);
  assert.deepEqual(attention.relatedRefs, result.snapshot.domain.discoveryRefs);
  assert.equal(result.snapshot.summary.domainApprovedCount, 0);
});

test("Board projects AI Domain Expert supervision as a human decision package without changing docs/design", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await mkdir(path.join(fixture.root, "docs", "design", "contexts", "access"), { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "design", "receipts"), { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "tasks"), { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "receipts", "domain-supervision"), { recursive: true });
  await mkdir(path.join(fixture.root, "src"), { recursive: true });
  await writeFile(path.join(fixture.root, "docs", "design", "domain-landscape.md"), `---
type: design
design_kind: domain-landscape
title: access-landscape
status: review_requested
model_revision: 1
---

# Access landscape
`, "utf8");
  await writeFile(path.join(fixture.root, "docs", "design", "context-map.md"), `---
type: design
design_kind: context-map
title: access-map
status: review_requested
model_revision: 1
---

# Access map
`, "utf8");
  const modelRef = "docs/design/contexts/access/domain-model.md";
  const approvalRef = "docs/design/receipts/access.json";
  const model = `---
type: design
design_kind: bounded-context
title: access-model
display_title: 사용 자격과 로그인 경계
human_summary: 로그인과 사용 자격 생성을 분리해 사용자의 권리가 조용히 바뀌지 않게 합니다.
presentation_status: review_requested
status: current
bounded_context: access
bounded_context_id: BC-ACCESS
subdomain_type: core
model_revision: 1
validation_status: approved
validation_ref: ${approvalRef}
domain_expert_agent: ai-domain-expert
authority_mode: human-confirmed
decision_tier: material
board_review_level: business-rule
board_review_status: confirmed
domain_expert_roles:
  - product-owner
role_views:
  - customer
  - planner
  - architect
  - developer
  - qa
owner: product-owner
---

# Access

## Human Review Summary

- 이 영역의 책임: 사용 자격과 로그인 책임을 분리합니다.
- 포함하지 않는 것: provider capacity를 만들지 않습니다.
- 사용자에게 보이는 실패: 로그인만으로 허용되지 않은 자격이 생깁니다.
- 아직 결정할 것: 현재 구현을 고칠지 임시 편차를 둘지 결정해야 합니다.

## AI Domain Expert Board Review

- 권고 결정: 로그인은 기존 사용 자격만 확인하도록 유지합니다.
- 선택한 모델링 수준: business-rule
- 이 수준을 선택한 이유: 사용 자격을 만드는 조건이 핵심 판단입니다.
- 사람이 확인할 핵심: 로그인과 자격 생성이 분리되어야 하는지 확인합니다.
- 승인하면 보호되는 결과: 인증 성공이 권리 생성을 뜻하지 않습니다.
- 반대하거나 수정해야 하는 조건: 제품 정책이 로그인 시 자격 부여로 바뀌면 모델을 수정합니다.

## Business Rules And Invariants

| Rule ID | Rule |
| --- | --- |
| BR-ACCESS-001 | 로그인은 사용 자격을 생성하지 않습니다. |
`;
  await writeFile(path.join(fixture.root, modelRef), model, "utf8");
  await writeFile(path.join(fixture.root, approvalRef), JSON.stringify({
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
    reason: "Confirmed access semantics.",
    evidenceRefs: [modelRef],
    challengeSummary: "Login and entitlement lifecycle were challenged."
  }), "utf8");
  const taskRef = "docs/tasks/T0001-access.md";
  const reviewRef = "docs/receipts/domain-supervision/DSR-T0001-1.json";
  const task = `---
type: task
doc_id: T0001
title: 로그인 구현 정렬
status: draft
domain_contract: v2
domain_impact: required
domain_supervision_state: decision-required
domain_supervision_ref: ${reviewRef}
domain_decision_ref:
domain_contexts:
  - access
domain_model_refs:
  - ${modelRef}
---

# 로그인 구현 정렬
`;
  await writeFile(path.join(fixture.root, taskRef), task, "utf8");
  const codeRef = "src/access.mjs";
  const code = "export const loginCreatesEntitlement = true;\n";
  await writeFile(path.join(fixture.root, codeRef), code, "utf8");
  const review = {
    schemaVersion: 1,
    kind: "domain-supervision-review",
    reviewId: "DSR-T0001-1",
    reviewStatus: "decision-required",
    subject: { kind: "task", documentRef: taskRef, documentSha256: sha256(task) },
    repositoryRevision: "working-tree",
    affectedModels: [{ boundedContext: "access", documentRef: modelRef, documentSha256: sha256(model), modelRevision: 1 }],
    implementationEvidence: [{ ref: codeRef, sha256: sha256(code), role: "code" }],
    problem: "로그인이 사용 자격을 자동 생성해 승인된 모델과 충돌합니다.",
    modelExpectation: "로그인은 기존 사용 자격만 확인합니다.",
    implementationReality: "현재 코드는 로그인 성공 시 사용 자격을 생성합니다.",
    businessImpact: "인증 성공만으로 사용 권리가 생길 수 있습니다.",
    engineeringImpact: "인증과 entitlement lifecycle이 한 서비스 흐름에 결합됩니다.",
    recommendation: { optionId: "fix-code", summary: "구현을 모델에 맞춥니다.", rationale: "권리 생성과 인증을 분리하는 편이 경계와 확장성에 맞습니다." },
    confidence: "high",
    options: [
      { id: "fix-code", title: "구현 변경", disposition: "change-implementation", action: "자동 생성을 제거합니다.", benefits: "책임 경계를 복구합니다.", costs: "기존 흐름을 migration합니다.", risks: "기존 사용자 onboarding을 별도 처리해야 합니다.", reversible: true },
      { id: "change-model", title: "모델 변경", disposition: "change-domain-model", action: "로그인이 자격을 부여한다는 정책을 명시적으로 승인합니다.", benefits: "현재 구현을 유지합니다.", costs: "사용자 권리 의미가 바뀝니다.", risks: "권한 확대와 감사 문제가 생깁니다.", reversible: false }
    ],
    decisionRequest: { required: true, question: "구현을 승인된 모델에 맞출까요, 사용자 권리 정책을 바꿀까요?", decisionOwner: "human", decideBefore: "implementation" },
    evidenceRefs: [codeRef],
    reviewedBy: { actorKind: "ai-agent", identifier: "ai-domain-expert" },
    reviewedAt: "2026-08-01T01:00:00.000Z"
  };
  await writeFile(path.join(fixture.root, reviewRef), JSON.stringify(review), "utf8");

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(result.snapshot.supervision.status, "decision-required");
  assert.equal(result.snapshot.supervision.reviews[0].recommendation.optionId, "fix-code");
  assert.equal(result.snapshot.supervision.reviews[0].decisionRequest.decisionOwner, "human");
  assert.ok(result.snapshot.attention.some((item) => item.id === "ATTN-DOMAIN-SUPERVISION-DECISION"));
  assert.equal(result.snapshot.domain.contexts[0].modelRef, modelRef);

  const decisionRef = "docs/receipts/domain-supervision/DSD-T0001-1.json";
  const decidedTask = task.replace("domain_decision_ref:\n", `domain_decision_ref: ${decisionRef}\n`);
  await writeFile(path.join(fixture.root, taskRef), decidedTask, "utf8");
  const decidedReview = {
    ...review,
    subject: { ...review.subject, documentSha256: sha256(decidedTask) }
  };
  const decidedReviewBytes = JSON.stringify(decidedReview);
  await writeFile(path.join(fixture.root, reviewRef), decidedReviewBytes, "utf8");
  await writeFile(path.join(fixture.root, decisionRef), JSON.stringify({
    schemaVersion: 1,
    kind: "domain-supervision-decision",
    receiptId: "DSD-T0001-1",
    reviewRef,
    reviewSha256: sha256(decidedReviewBytes),
    reviewId: decidedReview.reviewId,
    subjectRef: taskRef,
    subjectSha256: sha256(decidedTask),
    decision: "approved-option",
    selectedOptionId: "fix-code",
    rationale: "승인된 사용 자격 경계를 유지하고 구현을 수정합니다.",
    riskAcceptance: "구현과 새 aligned review 전에는 완료하지 않습니다.",
    expiresAt: null,
    decidedBy: { actorKind: "human", identifier: "product-owner" },
    decidedAt: "2026-08-01T02:00:00.000Z"
  }), "utf8");

  const decided = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath, snapshotSeq: 2 });
  assert.equal(decided.snapshot.supervision.status, "alignment-pending");
  assert.equal(decided.snapshot.supervision.counts.alignmentPending, 1);
  assert.ok(decided.snapshot.attention.some((item) => item.id === "ATTN-DOMAIN-SUPERVISION-REALIGNMENT"));
});

test("domain projection rejects a Board-specific domain source outside docs/design", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const config = JSON.parse(await readFile(path.join(fixture.root, fixture.configPath), "utf8"));
  config.domainDesignRoot = "docs/board-domain";
  await writeFile(path.join(fixture.root, fixture.configPath), `${JSON.stringify(config, null, 2)}\n`, "utf8");

  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /config\.domainDesignRoot.*docs\/design/
  );
});

test("domain projection fails closed when the AI Domain Expert selects an empty Board model level", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await mkdir(path.join(fixture.root, "docs", "design", "contexts", "catalog"), { recursive: true });
  await writeFile(path.join(fixture.root, "docs", "design", "domain-landscape.md"), `---
type: design
design_kind: domain-landscape
title: fixture-landscape
status: review_requested
model_revision: 1
---

# Fixture
`, "utf8");
  await writeFile(path.join(fixture.root, "docs", "design", "context-map.md"), `---
type: design
design_kind: context-map
title: fixture-map
status: review_requested
model_revision: 1
---

# Fixture
`, "utf8");
  await writeFile(path.join(fixture.root, "docs", "design", "contexts", "catalog", "domain-model.md"), `---
type: design
design_kind: bounded-context
title: catalog-model
display_title: 상품 모델 검토
human_summary: 상품의 업무 의미를 사람이 확인할 수 있게 설명합니다.
presentation_status: review_requested
status: review_requested
bounded_context: catalog
bounded_context_id: BC-CATALOG
subdomain_type: core
model_revision: 1
validation_status: review_requested
domain_expert_agent: ai-domain-expert
authority_mode: human-required
decision_tier: material
board_review_level: aggregate
board_review_status: review_requested
domain_expert_roles:
  - catalog-owner
role_views:
  - customer
  - planner
  - architect
  - developer
  - qa
owner: catalog-owner
---

# Catalog

## Human Review Summary

- 이 영역의 책임: 상품 의미를 관리합니다.

## AI Domain Expert Board Review

- 권고 결정: 상품 일관성 단위를 확인합니다.
- 선택한 모델링 수준: aggregate
- 이 수준을 선택한 이유: 함께 지킬 규칙을 판단해야 합니다.
- 사람이 확인할 핵심: 일관성 범위를 확인합니다.
- 승인하면 보호되는 결과: 부분 상태를 막습니다.
- 반대하거나 수정해야 하는 조건: 분리 저장이 필요하면 수정합니다.
`, "utf8");

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(result.snapshot.domain.status, "degraded");
  assert.equal(result.snapshot.domain.contexts[0].boardReviewStatus, "invalid");
  assert.match(result.snapshot.domain.contexts[0].boardReviewError, /selected model slice is empty/);
  assert.ok(result.snapshot.attention.some((item) => item.id === "ATTN-DOMAIN-DESIGN-INVALID"));
});

test("domain projection exposes shared role views and exact-byte model approval without granting authority", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await mkdir(path.join(fixture.root, "docs", "design", "contexts", "execution"), { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "design", "receipts"), { recursive: true });
  await writeFile(path.join(fixture.root, "docs", "design", "domain-landscape.md"), `---
type: design
design_kind: domain-landscape
title: fixture-landscape
status: review_requested
model_revision: 1
---

# Fixture

## Unknowns And Disputes

- Domain expert identity must remain explicit.
`, "utf8");
  await writeFile(path.join(fixture.root, "docs", "design", "context-map.md"), `---
type: design
design_kind: context-map
title: fixture-context-map
status: review_requested
model_revision: 1
---

# Fixture

## Context Relationships

| Upstream | Downstream | Relationship Pattern | Published Language / ACL | Consistency | Failure Ownership |
| --- | --- | --- | --- | --- | --- |
| BC-GOVERNANCE | BC-EXECUTION | Customer-Supplier | exact refs | task start | split |
`, "utf8");
  const modelPath = "docs/design/contexts/execution/domain-model.md";
  const receiptPath = "docs/design/receipts/execution-r1.json";
  const modelBytes = `---
type: design
design_kind: bounded-context
title: execution-domain-model
status: current
bounded_context: execution
bounded_context_id: BC-EXECUTION
subdomain_type: core
model_revision: 1
validation_status: approved
validation_ref: ${receiptPath}
domain_expert_agent: ai-domain-expert
authority_mode: human-confirmed
decision_tier: material
board_review_level: business-rule
board_review_status: confirmed
board_decision_ref: ${receiptPath}
domain_expert_roles:
  - delivery-owner
role_views:
  - customer
  - planner
  - architect
  - developer
  - qa
owner: delivery-owner
---

# Execution

## Domain Purpose And Customer Outcome

Keep goal-locked delivery traceable across the full lifecycle.
The Board must preserve this wrapped explanation.

## Human Review Summary

- 이 영역의 책임: 승인된 목표를 실행 가능한 작업과 결과로 연결합니다.
- 포함하지 않는 것: 정책 승인과 도메인 모델 승인을 대신하지 않습니다.
- 사용자에게 보이는 실패: 실행이 멈춘 이유와 다음 확인 대상을 보여 줍니다.
- 아직 결정할 것: 위험 등급별 중단 조건을 도메인 전문가가 확정해야 합니다.

## AI Domain Expert Board Review

- 권고 결정: current model reference가 없는 실행은 시작하지 않습니다.
- 선택한 모델링 수준: business-rule
- 이 수준을 선택한 이유: 사람이 판단할 내용이 실행 허용 조건이기 때문입니다.
- 사람이 확인할 핵심: current model reference를 필수로 둘지 결정합니다.
- 승인하면 보호되는 결과: 오래된 모델로 작업하지 않습니다.
- 반대하거나 수정해야 하는 조건: 모델 없이 허용해야 하는 실행이 있다면 수정합니다.

## Domain Model

| Aggregate ID | Aggregate |
| --- | --- |
| AGG-EXEC-TASK | Task |

## Business Rules And Invariants

| Rule ID | Rule |
| --- | --- |
| BR-EXEC-001 | Current model refs are required. |

## Domain Scenarios

| Scenario ID | Actor |
| --- | --- |
| SCN-EXEC-001 | QA |

## Unknowns And Disputes

- Risk tier remains a domain decision and the complete explanation
  must remain visible on the Board.
`;
  await writeFile(path.join(fixture.root, modelPath), modelBytes, "utf8");
  await writeFile(path.join(fixture.root, "docs/design/contexts/execution/ubiquitous-language.md"), `---
type: design
design_kind: ubiquitous-language
title: execution-language
status: review_requested
bounded_context: execution
bounded_context_id: BC-EXECUTION
---

# Language

## Terms

| Term ID | Term | Meaning | Example | Counterexample | Avoid | Source |
| --- | --- | --- | --- | --- | --- | --- |
| TERM-EXEC-TASK | Goal-locked Task | 승인된 목표와 연결된 실행 단위 | current model ref | 임의 작업 | generic task | expert |
`, "utf8");
  await writeFile(path.join(fixture.root, "docs/design/contexts/execution/examples.md"), `---
type: design
design_kind: domain-examples
title: execution-examples
display_title: 목표가 잠긴 실행
human_summary: 승인된 목표와 현재 작업 상태를 연결해 실행 결과를 추적할 수 있게 합니다.
presentation_status: review_requested
presentation_ref:
status: review_requested
bounded_context: execution
bounded_context_id: BC-EXECUTION
---

# Examples

## Business Examples

| Scenario ID | Kind | Actor / Goal | Given | When / Command | Then / Event | Rule |
| --- | --- | --- | --- | --- | --- | --- |
| SCN-EXEC-001 | normal | QA / 결과 추적 | approved model | CMD-EXEC-RUN | EVT-EXEC-DONE | BR-EXEC-001 |

## Counterexamples

- 승인되지 않은 model을 current truth로 사용하고
  성공으로 표시한다.
`, "utf8");
  await writeFile(path.join(fixture.root, receiptPath), JSON.stringify({
    schemaVersion: 1,
    kind: "domain-design-approval",
    receiptId: "DDD-APPROVAL-EXECUTION-1",
    decision: "approved",
    documentRef: modelPath,
    documentSha256: sha256(modelBytes),
    modelRevision: 1,
    boundedContext: "execution",
    decidedBy: { actorKind: "human", identifier: "fixture-domain-expert" },
    decidedAt: "2026-07-29T00:00:00.000Z",
    reason: "fixture review"
  }), "utf8");

  const approved = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(approved.snapshot.domain.status, "current");
  assert.equal(approved.snapshot.summary.domainContextCount, 1);
  assert.equal(approved.snapshot.summary.domainApprovedCount, 1);
  assert.deepEqual(approved.snapshot.domain.contexts[0].roleViews, ["customer", "planner", "architect", "developer", "qa"]);
  assert.equal(approved.snapshot.domain.contexts[0].counts.rules, 1);
  assert.equal(approved.snapshot.domain.contexts[0].counts.scenarios, 1);
  assert.equal(approved.snapshot.domain.contexts[0].validatedBy, "fixture-domain-expert");
  assert.equal(approved.snapshot.domain.contexts[0].presentationStatus, "review_requested");
  assert.equal(approved.snapshot.domain.contexts[0].visibleOnBoard, true);
  assert.equal(approved.snapshot.domain.contexts[0].displayTitle, "목표가 잠긴 실행");
  assert.equal(approved.snapshot.domain.contexts[0].responsibility, "승인된 목표를 실행 가능한 작업과 결과로 연결합니다.");
  assert.equal(approved.snapshot.domain.contexts[0].purpose, "Keep goal-locked delivery traceable across the full lifecycle. The Board must preserve this wrapped explanation.");
  assert.equal(approved.snapshot.domain.contexts[0].openQuestions[0], "Risk tier remains a domain decision and the complete explanation must remain visible on the Board.");
  assert.equal(approved.snapshot.domain.contexts[0].terms[0].term, "Goal-locked Task");
  assert.equal(approved.snapshot.domain.contexts[0].businessRules[0].id, "BR-EXEC-001");
  assert.equal(approved.snapshot.domain.contexts[0].scenarios[0].actorGoal, "QA / 결과 추적");
  assert.equal(approved.snapshot.domain.contexts[0].counterexamples[0], "승인되지 않은 model을 current truth로 사용하고 성공으로 표시한다.");
  assert.equal(approved.snapshot.domain.contexts[0].domainExpertAgent, "ai-domain-expert");
  assert.equal(approved.snapshot.domain.contexts[0].boardReviewLevel, "business-rule");
  assert.equal(approved.snapshot.domain.contexts[0].boardReview.humanDecision, "current model reference를 필수로 둘지 결정합니다.");
  assert.deepEqual(approved.snapshot.domain.contexts[0].boardModel.columns, ["업무 규칙", "업무 의미"]);
  assert.deepEqual(approved.snapshot.domain.contexts[0].boardModel.rows[0], ["BR-EXEC-001", "Current model refs are required."]);
  assert.equal(approved.snapshot.summary.domainPresentationMissingCount, 0);
  assert.ok(approved.snapshot.attention.some((item) => item.id === "ATTN-DOMAIN-PRESENTATION"));
  assert.equal(approved.snapshot.snapshot.capabilities.approvalIntents, false);

  await writeFile(path.join(fixture.root, modelPath), `${modelBytes}\nChanged after approval.\n`, "utf8");
  const invalid = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(invalid.snapshot.domain.status, "degraded");
  assert.equal(invalid.snapshot.domain.contexts[0].validationStatus, "invalid");
  assert.ok(invalid.snapshot.attention.some((item) => item.id === "ATTN-DOMAIN-DESIGN-INVALID"));
});

test("domain projection accepts routine AI modeling only through an exact human delegation fence", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await mkdir(path.join(fixture.root, "docs", "design", "contexts", "catalog"), { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "design", "receipts"), { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "governance", "receipts"), { recursive: true });
  await writeFile(path.join(fixture.root, "docs", "design", "domain-landscape.md"), `---
type: design
design_kind: domain-landscape
title: fixture-landscape
status: review_requested
model_revision: 1
---

# Fixture
`, "utf8");
  await writeFile(path.join(fixture.root, "docs", "design", "context-map.md"), `---
type: design
design_kind: context-map
title: fixture-context-map
status: review_requested
model_revision: 1
---

# Fixture

## Context Relationships

| Upstream | Downstream | Human Meaning | Failure Ownership | Relationship Pattern | Contract | Consistency |
| --- | --- | --- | --- | --- | --- | --- |
| BC-CATALOG | BC-CATALOG | 같은 영역의 용어를 정리합니다. | catalog | Published Language | terms | current |
`, "utf8");

  const delegationPath = "docs/governance/receipts/domain-authority-delegation.json";
  const delegation = JSON.stringify({
    schemaVersion: 1,
    kind: "domain-authority-delegation",
    receiptId: "DDD-DELEGATION-FIXTURE",
    decision: "approved",
    allowedDecisionTier: "routine",
    allowedChangeClasses: ["terminology-clarification"],
    forbiddenChangeClasses: ["customer-rights"],
    decidedBy: { actorKind: "human", identifier: "fixture-owner" },
    decidedAt: "2026-07-31T00:00:00.000Z",
    reason: "AI may maintain reversible terminology clarifications."
  });
  await writeFile(path.join(fixture.root, delegationPath), delegation, "utf8");

  const modelPath = "docs/design/contexts/catalog/domain-model.md";
  const receiptPath = "docs/design/receipts/catalog-ai-r1.json";
  const modelBytes = `---
type: design
design_kind: bounded-context
title: catalog-domain-model
display_title: 상품 용어를 한 뜻으로 유지하기
human_summary: 여러 역할이 상품 상태를 같은 뜻으로 사용하도록 관리합니다.
presentation_status: review_requested
presentation_ref:
status: current
bounded_context: catalog
bounded_context_id: BC-CATALOG
subdomain_type: supporting
model_revision: 1
validation_status: ai-validated
validation_ref: ${receiptPath}
domain_expert_agent: ai-domain-expert
authority_mode: delegated-ai
decision_tier: routine
board_review_level: ubiquitous-language
board_review_status: not_required
board_decision_ref:
domain_expert_roles:
  - catalog-owner
role_views:
  - customer
  - planner
  - architect
  - developer
  - qa
owner: catalog-owner
---

# Catalog

## Human Review Summary

- 이 영역의 책임: 상품 용어를 같은 뜻으로 유지합니다.
- 포함하지 않는 것: 가격 정책을 결정하지 않습니다.
- 사용자에게 보이는 실패: 같은 상태가 서로 다른 뜻으로 보입니다.
- 아직 결정할 것: 없음

## AI Domain Expert Board Review

- 권고 결정: 기존 의미를 바꾸지 않는 용어 설명을 현행화합니다.
- 선택한 모델링 수준: ubiquitous-language
- 이 수준을 선택한 이유: 행동 변경이 아니라 같은 용어의 뜻을 명확히 하는 routine 변경입니다.
- 사람이 확인할 핵심: Board 결정 대상이 아닙니다.
- 승인하면 보호되는 결과: 역할별 용어가 갈라지지 않습니다.
- 반대하거나 수정해야 하는 조건: 고객 권리나 가격 의미가 바뀌면 Board로 올립니다.

## Bounded Context Boundary

- 포함: 상품 용어
- 제외: 가격 정책

## Business Rules And Invariants

| Rule ID | Rule |
| --- | --- |
| BR-CATALOG-001 | 같은 상품 상태는 한 canonical term을 사용합니다. |
`;
  await writeFile(path.join(fixture.root, modelPath), modelBytes, "utf8");
  await writeFile(path.join(fixture.root, receiptPath), JSON.stringify({
    schemaVersion: 2,
    kind: "domain-design-approval",
    receiptId: "DDD-AI-AUTHORITY-CATALOG-1",
    decision: "approved",
    documentRef: modelPath,
    documentSha256: sha256(modelBytes),
    modelRevision: 1,
    boundedContext: "catalog",
    authorityMode: "delegated-ai",
    decisionTier: "routine",
    modelingLevel: "ubiquitous-language",
    decidedBy: { actorKind: "ai-agent", identifier: "ai-domain-expert" },
    decidedAt: "2026-07-31T00:01:00.000Z",
    reason: "Clarified existing terminology without changing behavior.",
    evidenceRefs: ["docs/design/contexts/catalog/domain-model.md"],
    challengeSummary: "No rule, boundary, customer-right, or lifecycle change was found.",
    delegatedAuthorityRef: delegationPath,
    delegationSha256: sha256(delegation)
  }), "utf8");

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(result.snapshot.domain.status, "current");
  assert.equal(result.snapshot.domain.contexts[0].validationStatus, "ai_current");
  assert.equal(result.snapshot.domain.contexts[0].authorityMode, "delegated-ai");
  assert.equal(result.snapshot.domain.contexts[0].validatedActorKind, "ai-agent");
  assert.equal(result.snapshot.summary.domainApprovedCount, 1);

  await writeFile(path.join(fixture.root, delegationPath), `${delegation}\n`, "utf8");
  const stale = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(stale.snapshot.domain.contexts[0].validationStatus, "invalid");
});

test("governance entries without a declared human presentation appear only as review attention", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  fixture.catalog.policies[0].presentationStatus = "missing";
  await writeFile(
    path.join(fixture.root, "docs", "governance", "catalog.json"),
    `${JSON.stringify(fixture.catalog, null, 2)}\n`,
    "utf8"
  );

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(result.snapshot.policies[0].presentationStatus, "missing");
  assert.equal(result.snapshot.policies[0].visibleOnBoard, false);
  assert.equal(result.snapshot.summary.presentationMissingCount, 1);
  const presentationAttention = result.snapshot.attention.find((item) => item.id === "ATTN-HUMAN-PRESENTATION");
  assert.ok(presentationAttention);
  assert.match(presentationAttention.humanSummary, /사람이 바로 이해할 제목과 설명/);
  assert.ok(presentationAttention.relatedRefs.includes("POL-1"));
});

test("an unresolvable captured base degrades the migration fence and generates attention", async (t) => {
  const fixture = await createFixture({ capturedBase: "f".repeat(40) });
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.equal(result.snapshot.migrationFence.state, "invalid");
  assert.equal(result.snapshot.migrationFence.reason, "unresolvable_captured_base");
  assert.equal(result.snapshot.snapshot.freshness, "degraded");
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "fresh");
  assert.ok(result.snapshot.attention.some((item) => item.id === "ATTN-MIGRATION-FENCE"));
  assert.match(
    result.snapshot.attention.find((item) => item.id === "ATTN-MIGRATION-FENCE").humanSummary,
    /캡처한 초기 이관 기준을 확인할 수 없음/
  );
  assert.doesNotMatch(
    result.snapshot.attention.find((item) => item.id === "ATTN-MIGRATION-FENCE").humanSummary,
    /unresolvable_captured_base/
  );
});

test("later HEAD movement does not stale unchanged source evidence", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const advancedHead = await advanceHead(fixture.root);
  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.notEqual(advancedHead, fixture.seedCommit);
  assert.equal(result.snapshot.currentRepository.head, advancedHead);
  assert.equal(result.snapshot.migrationFence.state, "valid");
  assert.equal(result.snapshot.migrationFence.reason, "current_head_advanced");
  assert.equal(result.snapshot.migrationFence.currentHeadAdvanced, true);
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "fresh");
  assert.equal(result.snapshot.snapshot.freshness, "fresh");
});

test("changed and escaped evidence are stale or degraded independently of migration validity", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await writeFile(path.join(fixture.root, "source.md"), "# Changed current policy\n", "utf8");
  await writeFile(path.join(fixture.root, "docs", "governance", "catalog.json"), JSON.stringify(fixture.catalog), "utf8");
  const stale = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(stale.snapshot.migrationFence.state, "valid");
  assert.equal(stale.snapshot.snapshot.sourceFence.sourceEvidenceState, "stale");
  assert.equal(stale.snapshot.snapshot.freshness, "stale");

  fixture.catalog.policies[0].sourceRefs[0] = { ...fixture.catalog.policies[0].sourceRefs[0], path: "../outside.md" };
  fixture.catalog.guidelines[0].sourceRefs[0] = { ...fixture.catalog.guidelines[0].sourceRefs[0], path: "../outside.md" };
  await writeFile(path.join(fixture.root, "docs", "governance", "catalog.json"), JSON.stringify(fixture.catalog), "utf8");
  const degraded = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(degraded.snapshot.snapshot.sourceFence.sourceEvidenceState, "degraded");
  assert.equal(degraded.snapshot.policies[0].sourceRefs[0].state, "invalid");
});

test("a source symlink cannot escape the repository", async (t) => {
  const fixture = await createFixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), "document-harness-view-source-outside-"));
  t.after(() => Promise.all([
    rm(fixture.root, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true })
  ]));
  await writeFile(path.join(outside, "private.md"), "private\n", "utf8");
  await symlink(path.join(outside, "private.md"), path.join(fixture.root, "escaped.md"));
  fixture.catalog.policies[0].sourceRefs[0] = { ...fixture.catalog.policies[0].sourceRefs[0], path: "escaped.md" };
  fixture.catalog.guidelines[0].sourceRefs[0] = { ...fixture.catalog.guidelines[0].sourceRefs[0], path: "escaped.md" };
  await writeFile(path.join(fixture.root, "docs", "governance", "catalog.json"), JSON.stringify(fixture.catalog), "utf8");

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "degraded");
  assert.equal(result.snapshot.policies[0].sourceRefs[0].state, "invalid");
});

test("the governance catalog cannot escape through a symlink to a private outside file", async (t) => {
  const fixture = await createFixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), "document-harness-view-catalog-private-"));
  t.after(() => Promise.all([
    rm(fixture.root, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true })
  ]));
  const privateCatalog = path.join(outside, "private-governance.json");
  await writeFile(privateCatalog, JSON.stringify(fixture.catalog), "utf8");
  await rm(path.join(fixture.root, "docs", "governance", "catalog.json"));
  await symlink(privateCatalog, path.join(fixture.root, "docs", "governance", "catalog.json"));

  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /governance catalog symlink일 수 없습니다/
  );
});

test("canonical governance invariants reject promoted observations and unfenced decisions", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const catalogPath = path.join(fixture.root, "docs", "governance", "catalog.json");

  fixture.catalog.guidelines[0].authorityState = "effective";
  fixture.catalog.guidelines[0].approvalState = "approved";
  fixture.catalog.guidelines[0].effectiveRef = "docs/decisions/fake.md";
  fixture.catalog.guidelines[0].decisionReceiptRef = "docs/receipts/fake.json";
  await writeFile(catalogPath, JSON.stringify(fixture.catalog), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /code\/config observation은 proposed\/unreviewed observation/
  );

  fixture.catalog.guidelines[0].authorityState = "proposed";
  fixture.catalog.guidelines[0].approvalState = "unreviewed";
  fixture.catalog.guidelines[0].effectiveRef = null;
  fixture.catalog.guidelines[0].decisionReceiptRef = null;
  fixture.catalog.policies[0].approvalState = "approved";
  await writeFile(catalogPath, JSON.stringify(fixture.catalog), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /approved 상태에는 effectiveRef와 decisionReceiptRef/
  );

  fixture.catalog.policies[0].approvalState = "unreviewed";
  fixture.catalog.migration.status = "reviewed";
  delete fixture.catalog.migration.receiptRef;
  await writeFile(catalogPath, JSON.stringify(fixture.catalog), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /reviewed이면 receiptRef가 필요합니다/
  );
});

test("approved policy projection requires complete source fences and real matching decision evidence", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const catalogPath = path.join(fixture.root, "docs", "governance", "catalog.json");
  const policy = fixture.catalog.policies[0];
  policy.authorityState = "effective";
  policy.approvalState = "approved";
  policy.effectiveRef = "docs/design/effective-policy.md";
  policy.decisionReceiptRef = "docs/receipts/POL-1.json";
  policy.sourceRefs = [{
    path: "source.md",
    heading: "Current policy",
    lineStart: 1,
    lineEnd: 1,
    capturedRepositoryRevision: fixture.seedCommit
  }];
  await writeFile(catalogPath, JSON.stringify(fixture.catalog), "utf8");

  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /capturedSha256/
  );

  policy.sourceRefs = fixture.catalog.guidelines[0].sourceRefs.map((sourceRef) => ({ ...sourceRef }));
  await writeFile(catalogPath, JSON.stringify(fixture.catalog), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /effectiveRef가 안전한 repository regular file/
  );

  await mkdir(path.join(fixture.root, "docs", "design"), { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  await writeFile(path.join(fixture.root, policy.effectiveRef), "# Effective policy\n", "utf8");
  await writeFile(path.join(fixture.root, policy.decisionReceiptRef), JSON.stringify({
    schemaVersion: 1,
    decisionId: "DEC-POL-1",
    candidateId: policy.id,
    decision: "approved",
    decidedBy: { actorKind: "human", identifier: "fixture-human" },
    decidedAt: "2026-07-16T00:00:00.000Z",
    sourceFence: {
      repositoryRevision: fixture.seedCommit,
      sourceHashes: policy.sourceRefs.map(({ capturedSha256 }) => capturedSha256)
    },
    effectiveRef: policy.effectiveRef,
    effectiveSha256: sha256("# Effective policy\n"),
    reason: "fixture approval"
  }), "utf8");
  const approved = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(approved.snapshot.snapshot.freshness, "fresh");
  assert.equal(approved.snapshot.policies[0].approvalState, "approved");
  assert.equal(approved.snapshot.summary.approvedCount, 1);

  await writeFile(path.join(fixture.root, policy.effectiveRef), "# Effective policy changed after approval\n", "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /effective ref bytes를 승인하지 않습니다/
  );
});

test("approved governance may use a newer source revision than the migration capture base", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const revisedSource = "# Revised current policy\n";
  await writeFile(path.join(fixture.root, "source.md"), revisedSource, "utf8");
  git(fixture.root, ["add", "source.md"]);
  git(fixture.root, ["commit", "--quiet", "-m", "revise policy source"]);
  const revisedCommit = git(fixture.root, ["rev-parse", "HEAD"]);

  const policy = fixture.catalog.policies[0];
  policy.authorityState = "effective";
  policy.approvalState = "approved";
  policy.effectiveRef = "docs/governance/catalog.json";
  policy.decisionReceiptRef = "docs/receipts/POL-1-revised.json";
  policy.sourceRefs = [{
    ...policy.sourceRefs[0],
    capturedSha256: sha256(revisedSource),
    capturedRepositoryRevision: revisedCommit
  }];
  const catalogBytes = `${JSON.stringify(fixture.catalog, null, 2)}\n`;
  await writeFile(path.join(fixture.root, policy.effectiveRef), catalogBytes, "utf8");
  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  await writeFile(path.join(fixture.root, policy.decisionReceiptRef), JSON.stringify({
    schemaVersion: 1,
    decisionId: "DEC-POL-1-REVISED",
    candidateId: policy.id,
    decision: "approved",
    decidedBy: { actorKind: "human", identifier: "fixture-human" },
    decidedAt: "2026-08-03T00:00:00.000Z",
    sourceFence: {
      repositoryRevision: revisedCommit,
      sourceHashes: [sha256(revisedSource)]
    },
    effectiveRef: policy.effectiveRef,
    effectiveSha256: sha256(catalogBytes),
    reason: "fixture reapproval after the migration capture"
  }), "utf8");

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(result.snapshot.migrationFence.resolvedBaseCommit, fixture.seedCommit);
  assert.equal(result.snapshot.policies[0].sourceRefs[0].capturedRepositoryRevision, revisedCommit);
  assert.equal(result.snapshot.policies[0].evidenceState, "current");
  assert.equal(result.snapshot.policies[0].approvalState, "approved");
});

test("approved initiatives pass their evidence state to the shared approval verifier", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const initiative = fixture.initiativeRegister.initiatives[0];
  initiative.approvalState = "approved";
  initiative.effectiveRef = initiative.documentRef;
  initiative.decisionReceiptRef = "docs/receipts/I0001-approved.json";
  await writeFile(
    path.join(fixture.root, "docs", "governance", "initiatives.json"),
    `${JSON.stringify(fixture.initiativeRegister, null, 2)}\n`,
    "utf8"
  );
  const effectivePath = path.join(fixture.root, initiative.effectiveRef);
  const effectiveBytes = (await readFile(effectivePath, "utf8"))
    .replace("approval_status: review_requested", "approval_status: approved")
    .replace("approval_ref:\n", `approval_ref: ${initiative.decisionReceiptRef}\n`);
  await writeFile(effectivePath, effectiveBytes, "utf8");
  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  await writeFile(path.join(fixture.root, initiative.decisionReceiptRef), JSON.stringify({
    schemaVersion: 1,
    decisionId: "DEC-I0001-APPROVED",
    candidateId: initiative.id,
    decision: "approved",
    decidedBy: { actorKind: "human", identifier: "fixture-human" },
    decidedAt: "2026-08-03T00:00:00.000Z",
    sourceFence: {
      repositoryRevision: initiative.sourceRevision,
      sourceHashes: initiative.sourceRefs.map(({ capturedSha256 }) => capturedSha256)
    },
    effectiveRef: initiative.effectiveRef,
    effectiveSha256: sha256(effectiveBytes),
    reason: "fixture initiative approval"
  }), "utf8");

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(result.snapshot.initiatives[0].evidenceState, "current");
  assert.equal(result.snapshot.initiatives[0].approvalState, "approved");
});

test("projection retries torn catalog/source reads and never publishes mixed input hashes", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  let hookCalls = 0;
  const result = await buildProjection({
    repoRoot: fixture.root,
    configPath: fixture.configPath,
    beforeInputRecheck: async ({ attempt }) => {
      hookCalls += 1;
      if (attempt === 1) await writeFile(path.join(fixture.root, "source.md"), "# Changed during projection\n", "utf8");
    }
  });

  assert.equal(hookCalls, 2);
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "stale");
  assert.equal(result.snapshot.policies[0].sourceRefs[0].currentSha256, sha256("# Changed during projection\n"));

  await assert.rejects(
    buildProjection({
      repoRoot: fixture.root,
      configPath: fixture.configPath,
      inputStabilityAttempts: 2,
      beforeInputRecheck: async ({ attempt }) => {
        await writeFile(path.join(fixture.root, "source.md"), `# Torn attempt ${attempt}\n`, "utf8");
      }
    }),
    (error) => error.code === "VIEW_INPUT_CHANGED_DURING_BUILD"
  );
});

test("migration review requires a catalog-bound human decision and is torn-read safe", async (t) => {
  const fixture = await createFixture({ receiptRef: "docs/receipts/migration.json" });
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  fixture.catalog.migration.status = "reviewed";
  const catalogPath = path.join(fixture.root, "docs", "governance", "catalog.json");
  const catalogBytes = JSON.stringify(fixture.catalog);
  await writeFile(catalogPath, catalogBytes, "utf8");
  await writeFile(path.join(fixture.root, "docs", "receipts", "migration.json"), JSON.stringify({ targetSourceRevision: "0".repeat(40) }), "utf8");
  const invalid = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.equal(invalid.snapshot.migrationFence.reason, "receipt_missing_or_invalid");
  assert.equal(invalid.snapshot.migrationFence.receiptState, "missing_or_invalid");
  assert.equal(invalid.snapshot.snapshot.sourceFence.sourceEvidenceState, "fresh");
  assert.equal(invalid.snapshot.snapshot.freshness, "degraded");

  const receiptPath = path.join(fixture.root, "docs", "receipts", "migration.json");
  await writeFile(receiptPath, JSON.stringify({
    schemaVersion: 1,
    decisionId: "DEC-CATALOG-REVIEW",
    candidateId: "CATALOG-REVIEW",
    decision: "approved",
    decidedBy: { actorKind: "human", identifier: "fixture-human" },
    decidedAt: "2026-07-17T00:00:00.000Z",
    sourceFence: { repositoryRevision: fixture.seedCommit, sourceHashes: [sha256(catalogBytes)] },
    effectiveRef: "docs/governance/catalog.json",
    effectiveSha256: sha256(catalogBytes),
    reason: "fixture catalog review"
  }), "utf8");
  const valid = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(valid.snapshot.migrationFence.receiptState, "matched");
  assert.equal(valid.snapshot.snapshot.freshness, "fresh");

  let hookCalls = 0;
  const torn = await buildProjection({
    repoRoot: fixture.root,
    configPath: fixture.configPath,
    beforeInputRecheck: async () => {
      hookCalls += 1;
      await writeFile(receiptPath, "{}", "utf8");
    }
  });
  assert.equal(hookCalls, 2);
  assert.equal(torn.snapshot.migrationFence.receiptState, "missing_or_invalid");
  assert.equal(torn.snapshot.snapshot.freshness, "degraded");
});

function taskMarkdown({ taskId, loopState, checkpointRef, status = "active", revision = 1 }) {
  return `---
type: task
doc_id: ${taskId}
status: ${status}
execution_contract: v1
task_contract_revision: ${revision}
loop_state: ${loopState}
checkpoint_ref: ${checkpointRef ?? ""}
---

# ${taskId}
`;
}

function yamlList(name, values) {
  if (values.length === 0) return `${name}: []`;
  return `${name}:\n${values.map((value) => `  - ${value}`).join("\n")}`;
}

function checkpointMarkdown({
  id,
  taskId,
  recordedAt,
  attemptSeq,
  checkpointSeq,
  nextAction,
  loopState = "running",
  nextActor = "agent",
  stopReason = null,
  evidence = [],
  attention = [],
  receipts = [],
  iterationsUsed = 2,
  iterationsMax = 8,
  elapsedMinutes = 4,
  timeLimitMinutes = 60,
  taskStatus = "active",
  taskCheckpointRef = `docs/checkpoints/${taskId}-execution.md`,
  sourceRevision = "working-tree",
  sourceHash = sha256(taskMarkdown({
    taskId,
    status: taskStatus,
    loopState,
    checkpointRef: taskCheckpointRef
  }))
}) {
  return `---
type: execution-checkpoint
execution_contract: v1
checkpoint_id: "${id}"
checkpoint_seq: ${checkpointSeq}
task_id: ${taskId}
task_contract_revision: 1
attempt_seq: ${attemptSeq}
loop_state: ${loopState}
stop_reason: ${stopReason ?? ""}
next_actor: ${nextActor}
current_hypothesis: Observe the canonical checkpoint.
last_action: Updated the canonical Markdown checkpoint.
next_action: ${nextAction}
resume_when: The next bounded action is available.
policy_refs:
  - docs/_indexes/execution-loop-policy.yaml
directive_refs: []
${yamlList("evidence", evidence)}
risks: []
${yamlList("attention", attention)}
${yamlList("receipts", receipts)}
budget:
  iterations_used: ${iterationsUsed}
  iterations_max: ${iterationsMax}
  elapsed_minutes: ${elapsedMinutes}
  time_limit_minutes: ${timeLimitMinutes}
source_refs: []
source_revision: ${sourceRevision}
source_hash: ${sourceHash}
recorded_at: "${recordedAt}"
tags:
  - docs/execution-checkpoint
---

# ${taskId} Execution Checkpoint
`;
}

test("execution projection selects the latest canonical Markdown checkpoint deterministically", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const checkpointRoot = path.join(fixture.root, "docs", "checkpoints");
  const taskRoot = path.join(fixture.root, "docs", "tasks");
  await mkdir(checkpointRoot, { recursive: true });
  await mkdir(taskRoot, { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  await writeFile(path.join(fixture.root, "docs", "receipts", "T0004-evidence.json"), "{\"result\":\"passed\"}\n", "utf8");
  const completedTask = taskMarkdown({
    taskId: "T0004",
    status: "done",
    loopState: "succeeded",
    checkpointRef: "docs/checkpoints/T0004-execution.md"
  });
  await writeFile(path.join(fixture.root, "docs", "receipts", "T0004-receipt.json"), JSON.stringify({
    receipt_id: "RCPT-T0004-C2",
    receipt_kind: "test",
    task_id: "T0004",
    checkpoint_seq: 2,
    actor: "validator",
    issued_at: "2026-07-19T00:00:00.000Z",
    scope: {},
    statement: "T0004 completion evidence passed.",
    evidence_refs: ["docs/receipts/T0004-evidence.json"],
    approval_fence: null,
    source_revision: "working-tree",
    source_hash: sha256(completedTask)
  }), "utf8");
  await writeFile(path.join(taskRoot, "T0001-first.md"), taskMarkdown({
    taskId: "T0001",
    loopState: "running",
    checkpointRef: "docs/checkpoints/T0001-execution.md"
  }), "utf8");
  await writeFile(path.join(taskRoot, "T0002-second.md"), taskMarkdown({
    taskId: "T0002",
    loopState: "running",
    checkpointRef: "docs/checkpoints/T0002-execution.md"
  }), "utf8");
  await writeFile(path.join(taskRoot, "T0004-completed.md"), completedTask, "utf8");
  await writeFile(path.join(checkpointRoot, "T0001-execution.md"), checkpointMarkdown({
    id: "T0001:A1:C9",
    taskId: "T0001",
    recordedAt: "2026-07-16T00:00:00.000Z",
    attemptSeq: 1,
    checkpointSeq: 9,
    nextAction: "older action"
  }), "utf8");
  await writeFile(path.join(checkpointRoot, "T0002-execution.md"), checkpointMarkdown({
    id: "T0002:A2:C1",
    taskId: "T0002",
    recordedAt: "2026-07-17T00:00:00.000Z",
    attemptSeq: 2,
    checkpointSeq: 1,
    nextAction: "run full validation"
  }), "utf8");
  await writeFile(path.join(checkpointRoot, "T9999-orphan-execution.md"), checkpointMarkdown({
    id: "T9999:A9:C9",
    taskId: "T9999",
    recordedAt: "2026-07-18T00:00:00.000Z",
    attemptSeq: 9,
    checkpointSeq: 9,
    nextAction: "orphan must not hijack the View"
  }), "utf8");
  await writeFile(path.join(checkpointRoot, "T0004-execution.md"), checkpointMarkdown({
    id: "T0004:A3:C2",
    taskId: "T0004",
    recordedAt: "2026-07-19T00:00:00.000Z",
    attemptSeq: 3,
    checkpointSeq: 2,
    nextAction: "historical completion must not hide active work",
    loopState: "succeeded",
    nextActor: "none",
    taskStatus: "done",
    evidence: ["docs/receipts/T0004-evidence.json"],
    receipts: ["docs/receipts/T0004-receipt.json"]
  }), "utf8");
  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.deepEqual({
    configured: result.snapshot.execution.configured,
    status: result.snapshot.execution.status,
    checkpointId: result.snapshot.execution.checkpointId,
    nextAction: result.snapshot.execution.nextAction
  }, {
    configured: true,
    status: "observed",
    checkpointId: "T0002:A2:C1",
    nextAction: "run full validation"
  });
  assert.equal(result.snapshot.execution.source, "docs/checkpoints/T0002-execution.md");
  assert.equal(result.snapshot.execution.selection.candidateCount, 3);
  assert.match(result.snapshot.execution.selection.strategy, /^active_non_succeeded/);
});

test("execution checkpoint symlinks fail closed without reading outside the repository", async (t) => {
  const fixture = await createFixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), "document-harness-view-checkpoint-outside-"));
  t.after(() => Promise.all([
    rm(fixture.root, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true })
  ]));
  const checkpointRoot = path.join(fixture.root, "docs", "checkpoints");
  const taskRoot = path.join(fixture.root, "docs", "tasks");
  await mkdir(checkpointRoot, { recursive: true });
  await mkdir(taskRoot, { recursive: true });
  await writeFile(path.join(taskRoot, "T0001-linked.md"), taskMarkdown({
    taskId: "T0001",
    loopState: "running",
    checkpointRef: "docs/checkpoints/T0001-execution.md"
  }), "utf8");
  const outsideCheckpoint = path.join(outside, "T0001-execution.md");
  await writeFile(outsideCheckpoint, checkpointMarkdown({
    id: "T0001:A1:C1",
    taskId: "T0001",
    recordedAt: "2026-07-17T00:00:00.000Z",
    attemptSeq: 1,
    checkpointSeq: 1,
    nextAction: "must not be read"
  }), "utf8");
  await symlink(outsideCheckpoint, path.join(checkpointRoot, "T0001-execution.md"));

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(result.snapshot.execution.configured, true);
  assert.equal(result.snapshot.execution.status, "degraded");
  assert.match(result.snapshot.execution.error, /안전한 repository regular file/);
  assert.equal(result.snapshot.snapshot.freshness, "degraded");
});

test("execution projection enforces task linkage, checkpoint identity, and succeeded barriers", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const checkpointRoot = path.join(fixture.root, "docs", "checkpoints");
  const taskRoot = path.join(fixture.root, "docs", "tasks");
  await mkdir(checkpointRoot, { recursive: true });
  await mkdir(taskRoot, { recursive: true });
  const taskPath = path.join(taskRoot, "T0003-close.md");
  const checkpointPath = path.join(checkpointRoot, "T0003-execution.md");
  await writeFile(taskPath, taskMarkdown({
    taskId: "T0003",
    status: "done",
    loopState: "running",
    checkpointRef: "docs/checkpoints/T0003-execution.md"
  }), "utf8");
  await writeFile(checkpointPath, checkpointMarkdown({
    id: "T0003:A1:C1",
    taskId: "T0003",
    recordedAt: "2026-07-16T00:00:00.000Z",
    attemptSeq: 1,
    checkpointSeq: 1,
    nextAction: "must not project an incompatible lifecycle"
  }), "utf8");
  const incompatibleLifecycle = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(incompatibleLifecycle.snapshot.execution.status, "degraded");
  assert.match(incompatibleLifecycle.snapshot.execution.error, /status.*loop_state.*호환되지/);

  await writeFile(taskPath, taskMarkdown({
    taskId: "T0003",
    loopState: "succeeded",
    checkpointRef: "docs/checkpoints/T0003-execution.md"
  }), "utf8");
  const checkpointOptions = {
    taskId: "T0003",
    recordedAt: "2026-07-17T00:00:00.000Z",
    attemptSeq: 2,
    checkpointSeq: 4,
    nextAction: "handoff verified result",
    loopState: "succeeded",
    nextActor: "none"
  };
  await writeFile(checkpointPath, checkpointMarkdown({ ...checkpointOptions, id: "FORGED-ID" }), "utf8");
  const forgedIdentity = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(forgedIdentity.snapshot.execution.status, "degraded");
  assert.match(forgedIdentity.snapshot.execution.error, /checkpoint_id.*identity/);

  await writeFile(checkpointPath, checkpointMarkdown({ ...checkpointOptions, id: "T0003:A2:C4" }), "utf8");
  const missingBarrier = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(missingBarrier.snapshot.execution.status, "degraded");
  assert.match(missingBarrier.snapshot.execution.error, /evidence\/receipt\/attention barrier/);

  await writeFile(checkpointPath, checkpointMarkdown({
    ...checkpointOptions,
    id: "T0003:A2:C4",
    evidence: ["docs/receipts/test-evidence.json"],
    receipts: ["docs/receipts/test-receipt.json"]
  }), "utf8");
  const missingSupport = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(missingSupport.snapshot.execution.status, "degraded");
  assert.match(missingSupport.snapshot.execution.error, /non-empty repository regular file/);

  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  await writeFile(path.join(fixture.root, "docs", "receipts", "test-evidence.json"), "{\"result\":\"passed\"}\n", "utf8");
  await writeFile(path.join(fixture.root, "docs", "receipts", "test-receipt.json"), "{\"receipt\":\"not-source-fenced\"}\n", "utf8");
  const unboundReceipt = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(unboundReceipt.snapshot.execution.status, "degraded");
  assert.match(unboundReceipt.snapshot.execution.error, /canonical fields/);
  await writeFile(path.join(fixture.root, "docs", "receipts", "test-receipt.json"), JSON.stringify({
    receipt_id: "RCPT-T0003-C4",
    receipt_kind: "review",
    task_id: "T0003",
    checkpoint_seq: 4,
    actor: "human",
    issued_at: "2026-07-17T00:00:00.000Z",
    scope: {},
    statement: "T0003 completion evidence reviewed.",
    evidence_refs: ["docs/receipts/test-evidence.json"],
    approval_fence: null,
    source_revision: "working-tree",
    source_hash: sha256(taskMarkdown({
      taskId: "T0003",
      loopState: "succeeded",
      checkpointRef: "docs/checkpoints/T0003-execution.md"
    }))
  }), "utf8");
  const valid = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(valid.snapshot.execution.status, "observed");
  assert.equal(valid.snapshot.execution.loopState, "succeeded");
  assert.equal(valid.snapshot.execution.lifecycleStatus, "active");
});

test("execution projection rejects exhausted active work and a task source fence mismatch", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await mkdir(path.join(fixture.root, "docs", "tasks"), { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "checkpoints"), { recursive: true });
  const task = taskMarkdown({
    taskId: "T0005",
    loopState: "running",
    checkpointRef: "docs/checkpoints/T0005-execution.md"
  });
  await writeFile(path.join(fixture.root, "docs", "tasks", "T0005-budget.md"), task, "utf8");
  const checkpointPath = path.join(fixture.root, "docs", "checkpoints", "T0005-execution.md");
  const options = {
    id: "T0005:A1:C1",
    taskId: "T0005",
    recordedAt: "2026-07-17T00:00:00.000Z",
    attemptSeq: 1,
    checkpointSeq: 1,
    nextAction: "must stop before another action"
  };
  await writeFile(checkpointPath, checkpointMarkdown({
    ...options,
    iterationsUsed: 8,
    iterationsMax: 8
  }), "utf8");
  const exhausted = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(exhausted.snapshot.execution.status, "degraded");
  assert.match(exhausted.snapshot.execution.error, /budget.*BUDGET_EXCEEDED/);

  await writeFile(checkpointPath, checkpointMarkdown({
    ...options,
    sourceHash: "f".repeat(64)
  }), "utf8");
  const forgedSource = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(forgedSource.snapshot.execution.status, "degraded");
  assert.match(forgedSource.snapshot.execution.error, /source_hash.*linked task bytes/);
});

test("runtime-local View files do not make the projected repository dirtier", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const before = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  const stateDir = path.join(fixture.root, ".document-harness", "runtime", "view");
  await mkdir(stateDir, { recursive: true });
  await writeFile(path.join(stateDir, "lease.json"), JSON.stringify({ pid: 1 }), "utf8");
  await writeFile(path.join(stateDir, "snapshot.json"), JSON.stringify({ snapshot: 1 }), "utf8");
  const after = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.equal(after.snapshot.currentRepository.dirtyCount, before.snapshot.currentRepository.dirtyCount);
  assert.equal(after.snapshot.currentRepository.workingTreeState, before.snapshot.currentRepository.workingTreeState);
});

test("config rejects remote probes and project overrides of distribution runtime constants", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  fixture.config.probes = [{ id: "remote", label: "Remote", url: "https://example.invalid/health" }];
  await writeFile(path.join(fixture.root, "config", "view.json"), JSON.stringify(fixture.config), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /explicit loopback HTTP endpoint/
  );

  fixture.config.probes = [];
  fixture.config.stateDir = "../outside";
  await writeFile(path.join(fixture.root, "config", "view.json"), JSON.stringify(fixture.config), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /stateDir.*reference distribution 고정값/
  );

  delete fixture.config.stateDir;
  fixture.config.executionCheckpointRoot = "docs/checkpoints/custom";
  await writeFile(path.join(fixture.root, "config", "view.json"), JSON.stringify(fixture.config), "utf8");
  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /지원하지 않는 View config key.*executionCheckpointRoot/
  );
});

test("an empty governance catalog remains an explicit unknown gap", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  fixture.catalog.policies = [];
  fixture.catalog.guidelines = [];
  fixture.initiativeRegister.initiatives = [];
  await writeFile(path.join(fixture.root, "docs", "governance", "catalog.json"), JSON.stringify(fixture.catalog), "utf8");
  await writeFile(path.join(fixture.root, "docs", "governance", "initiatives.json"), JSON.stringify(fixture.initiativeRegister), "utf8");
  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });

  assert.equal(result.snapshot.summary.policyCount, 0);
  assert.equal(result.snapshot.summary.guidelineCount, 0);
  assert.equal(result.snapshot.summary.initiativeCount, 0);
  assert.equal(result.snapshot.snapshot.sourceFence.sourceEvidenceState, "unknown");
  assert.equal(result.snapshot.snapshot.freshness, "unknown");
  assert.ok(result.snapshot.attention.some((item) => item.id === "ATTN-GOVERNANCE-EMPTY"));
});

test("initiative Markdown relationship tables must exactly mirror the register", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  fixture.initiativeRegister.initiatives[0].policyRelationships[0].rationale = "A silently changed rationale must fail closed.";
  await writeFile(
    path.join(fixture.root, "docs", "governance", "initiatives.json"),
    JSON.stringify(fixture.initiativeRegister),
    "utf8"
  );

  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /관계 표가 register relationship mirror와 일치하지 않습니다/
  );
});

test("no_applicable_guideline accepts an explicit reason and an empty relationship table", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const initiative = fixture.initiativeRegister.initiatives[0];
  initiative.guidelineRefs = [];
  initiative.guidelineRelationships = [];
  initiative.guidelineDisposition = "no_applicable_guideline";
  initiative.guidelineDispositionReason = "현재 범위에는 적용 가능한 지침이 없으며 activation review에서 다시 확인합니다.";
  await writeFile(
    path.join(fixture.root, "docs", "governance", "initiatives.json"),
    JSON.stringify(fixture.initiativeRegister),
    "utf8"
  );
  await writeFile(path.join(fixture.root, initiative.documentRef), `---
type: initiative
doc_id: I0001
initiative_contract: v1
status: draft
approval_status: review_requested
issuance_approval_ref: DECISION-FIXTURE
approval_ref:
policy_refs:
  - POL-1
guideline_refs: []
guideline_disposition: no_applicable_guideline
guideline_disposition_reason: 현재 범위에는 적용 가능한 지침이 없으며 activation review에서 다시 확인합니다.
---

# I0001 Fixture

## Policy Alignment

| Policy Ref | Relation | Rationale | Exception Ref |
| --- | --- | --- | --- |
| POL-1 | advances | The initiative turns the policy direction into a bounded outcome. | |

## Guideline Disposition

| Guideline Ref | Adoption | Rationale | Verification |
| --- | --- | --- | --- |
`, "utf8");

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  assert.equal(result.snapshot.initiatives[0].guidelineDisposition, "no_applicable_guideline");
  assert.deepEqual(result.snapshot.initiatives[0].guidelineRelationships, []);
});

test("unknown or relation-less project lineage is surfaced as human attention without inferred links", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await writeFile(path.join(fixture.root, "docs", "projects", "P0002-unknown.md"), `---
type: project
doc_id: P0002
title: Unknown Initiative
status: draft
lineage_contract: v2
related_initiative: I9999
initiative_relation: delivers
---
`, "utf8");
  await writeFile(path.join(fixture.root, "docs", "projects", "P0003-relation-less.md"), `---
type: project
doc_id: P0003
title: Relation Missing
status: draft
lineage_contract: v2
related_initiative: I0001
initiative_relation:
---
`, "utf8");

  const result = await buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath });
  const attention = result.snapshot.attention.find(({ id }) => id === "ATTN-INITIATIVE-LINEAGE");
  assert.ok(attention);
  assert.deepEqual(attention.relatedRefs, ["P0002", "I9999", "P0003", "I0001"]);
  assert.deepEqual(result.snapshot.initiatives[0].projects.map(({ id }) => id), ["P0001"]);
});

test("active initiatives fail closed on an unapproved policy", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const initiative = fixture.initiativeRegister.initiatives[0];
  initiative.lifecycleState = "active";
  initiative.approvalState = "approved";
  initiative.effectiveRef = initiative.documentRef;
  initiative.decisionReceiptRef = "docs/receipts/I0001.json";
  initiative.guidelineDisposition = "linked";
  await writeFile(
    path.join(fixture.root, "docs", "governance", "initiatives.json"),
    JSON.stringify(fixture.initiativeRegister),
    "utf8"
  );

  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /active\/done 추진안은 current effective\/approved policy만 사용할 수 있습니다: POL-1/
  );
});

test("active initiatives fail closed on an unapproved required guideline", async (t) => {
  const fixture = await createFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await mkdir(path.join(fixture.root, "docs", "design"), { recursive: true });
  await mkdir(path.join(fixture.root, "docs", "receipts"), { recursive: true });
  const policy = fixture.catalog.policies[0];
  policy.authorityState = "effective";
  policy.approvalState = "approved";
  policy.effectiveRef = "docs/design/effective-policy.md";
  policy.decisionReceiptRef = "docs/receipts/POL-1.json";
  await writeFile(path.join(fixture.root, policy.effectiveRef), "# Effective policy\n", "utf8");
  await writeFile(path.join(fixture.root, policy.decisionReceiptRef), JSON.stringify({
    schemaVersion: 1,
    decisionId: "DEC-POL-1",
    candidateId: "POL-1",
    decision: "approved",
    decidedBy: { actorKind: "human", identifier: "fixture-human" },
    decidedAt: "2026-07-18T00:00:00.000Z",
    sourceFence: {
      repositoryRevision: fixture.seedCommit,
      sourceHashes: policy.sourceRefs.map(({ capturedSha256 }) => capturedSha256)
    },
    effectiveRef: policy.effectiveRef,
    effectiveSha256: sha256("# Effective policy\n"),
    reason: "fixture approval"
  }), "utf8");
  await writeFile(
    path.join(fixture.root, "docs", "governance", "catalog.json"),
    JSON.stringify(fixture.catalog),
    "utf8"
  );
  const initiative = fixture.initiativeRegister.initiatives[0];
  initiative.lifecycleState = "active";
  initiative.approvalState = "approved";
  initiative.effectiveRef = initiative.documentRef;
  initiative.decisionReceiptRef = "docs/receipts/I0001.json";
  initiative.guidelineDisposition = "linked";
  initiative.guidelineRelationships[0].adoption = "required";
  await writeFile(
    path.join(fixture.root, "docs", "governance", "initiatives.json"),
    JSON.stringify(fixture.initiativeRegister),
    "utf8"
  );

  await assert.rejects(
    buildProjection({ repoRoot: fixture.root, configPath: fixture.configPath }),
    /required guideline은 current effective\/approved 상태여야 합니다: GUIDE-1/
  );
});
