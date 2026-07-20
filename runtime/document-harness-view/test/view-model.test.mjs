import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEvidenceGroups,
  filterEvidence,
  filterGuidelines,
  filterInitiatives,
  filterPolicies,
  freshnessPresentation,
  governanceStatusPresentation,
  paginate,
  reviewStats,
  runtimeSummary,
  sortAttention
} from "../public/view-model.mjs";

const policy = {
  id: "POL-1",
  title: "등록된 source만 읽는다",
  humanSummary: "읽기 범위를 제한합니다.",
  authorityClass: "current_design",
  approvalState: "unreviewed",
  enforcement: "partially_enforced",
  evidenceState: "current",
  sourceRefs: [{
    path: "docs/design/source.md",
    heading: "Boundary",
    lineStart: 10,
    lineEnd: 20,
    evidenceKind: "current_design",
    capturedSha256: "aaa",
    capturedRepositoryRevision: "1111111111111111111111111111111111111111",
    currentSha256: "aaa",
    state: "current"
  }]
};

const guideline = {
  id: "GUIDE-1",
  title: "local-only endpoint를 검증한다",
  humanSummary: "외부 endpoint를 거부합니다.",
  policyRefs: ["POL-1"],
  approvalState: "unreviewed",
  enforcement: "not_implemented",
  sourceRefs: [{
    path: "docs/design/source.md",
    heading: "Boundary",
    lineStart: 10,
    lineEnd: 20,
    evidenceKind: "current_design",
    capturedSha256: "aaa",
    capturedRepositoryRevision: "1111111111111111111111111111111111111111",
    currentSha256: "bbb",
    state: "changed"
  }]
};

const attention = [
  { id: "ATTN-3", severity: "warning", title: "Warning", relatedRefs: ["GUIDE-1"] },
  { id: "ATTN-2", severity: "decision", title: "Decision", relatedRefs: [] },
  { id: "ATTN-1", severity: "critical", title: "Critical", relatedRefs: ["POL-1"] }
];

const initiative = {
  id: "I0001",
  title: "근거 기반 전달 경계",
  humanSummary: "정책과 지침을 프로젝트 실행으로 잇습니다.",
  outcome: "연결 프로젝트가 정책 경계 안에서 결과를 냅니다.",
  whyNow: "실행 방향을 분명히 해야 합니다.",
  owner: "Fixture Owner",
  currentFocus: "연결 관계 검토",
  lifecycleState: "draft",
  approvalState: "review_requested",
  policyRefs: ["POL-1"],
  policyRelationships: [{ policyId: "POL-1", relation: "advances", rationale: "결과 방향을 구체화합니다.", exceptionRef: null }],
  guidelineRefs: ["GUIDE-1"],
  guidelineRelationships: [{ guidelineId: "GUIDE-1", adoption: "recommended", rationale: "근거 수집 방식을 제안합니다.", verification: "프로젝트 근거를 검토합니다." }],
  guidelineDisposition: "needs_review",
  guidelineDispositionReason: "지침이 아직 검토 후보입니다.",
  projects: [{ id: "P0001", title: "Fixture Delivery", status: "active", path: "docs/projects/P0001.md" }],
  successSignals: ["연결 관계가 보입니다."],
  risks: ["아직 승인되지 않았습니다."],
  evidenceState: "current",
  sourceRefs: policy.sourceRefs
};

test("policy search includes linked guideline content and attention severity", () => {
  const linked = filterPolicies({
    policies: [policy],
    guidelines: [guideline],
    attention,
    query: "local-only",
    filter: "all"
  });
  assert.deepEqual(linked.map((item) => item.id), ["POL-1"]);

  const critical = filterPolicies({
    policies: [policy],
    guidelines: [guideline],
    attention,
    filter: "critical"
  });
  assert.deepEqual(critical.map((item) => item.id), ["POL-1"]);
});

test("guideline search includes its own content, linked policy content, and attention severity", () => {
  const ownContent = filterGuidelines({
    guidelines: [guideline],
    policies: [policy],
    attention,
    query: "local-only",
    filter: "all"
  });
  assert.deepEqual(ownContent.map((item) => item.id), ["GUIDE-1"]);

  const linkedPolicy = filterGuidelines({
    guidelines: [guideline],
    policies: [policy],
    attention,
    query: "등록된 source",
    filter: "all"
  });
  assert.deepEqual(linkedPolicy.map((item) => item.id), ["GUIDE-1"]);

  const needsAttention = filterGuidelines({
    guidelines: [guideline],
    policies: [policy],
    attention,
    filter: "attention"
  });
  assert.deepEqual(needsAttention.map((item) => item.id), ["GUIDE-1"]);
  assert.deepEqual(filterGuidelines({ guidelines: [guideline], policies: [policy], attention, filter: "critical" }), []);
});

test("guideline filters distinguish unreviewed, stale, and last-known unverified records", () => {
  assert.deepEqual(filterGuidelines({ guidelines: [guideline], filter: "unreviewed" }), [guideline]);
  assert.deepEqual(filterGuidelines({ guidelines: [guideline], filter: "stale" }), [guideline]);

  const degradedGuideline = {
    ...guideline,
    projectionState: "last_known_unverified",
    approvalState: "unverified",
    enforcement: "unverified",
    evidenceState: "unverified",
    lastKnown: {
      approvalState: "approved",
      enforcement: "enforced",
      evidenceState: "current"
    }
  };
  assert.deepEqual(filterGuidelines({ guidelines: [degradedGuideline], filter: "unverified" }), [degradedGuideline]);
  assert.deepEqual(filterGuidelines({ guidelines: [degradedGuideline], filter: "unreviewed" }), []);
});

test("initiative search and filters use direct policy, guideline, and project links", () => {
  assert.deepEqual(filterInitiatives({
    initiatives: [initiative], policies: [policy], guidelines: [guideline], attention, query: "Fixture Delivery"
  }), [initiative]);
  assert.deepEqual(filterInitiatives({
    initiatives: [initiative], policies: [policy], guidelines: [guideline], attention, filter: "review"
  }), [initiative]);
  assert.deepEqual(filterInitiatives({
    initiatives: [initiative], policies: [policy], guidelines: [guideline], attention, filter: "guideline_review"
  }), [initiative]);
  assert.deepEqual(filterInitiatives({
    initiatives: [{ ...initiative, projects: [] }], policies: [policy], guidelines: [guideline], attention, filter: "no_projects"
  }).map((item) => item.id), ["I0001"]);
});

test("review queue sorts critical, decision, then warning without changing totals", () => {
  assert.deepEqual(sortAttention(attention).map((item) => item.severity), ["critical", "decision", "warning"]);
  assert.deepEqual(reviewStats(attention), {
    total: 3,
    critical: 1,
    decision: 1,
    warning: 1,
    info: 0
  });
});

test("evidence groups deduplicate paths and retain the least fresh state", () => {
  const groups = buildEvidenceGroups([policy], [guideline], [initiative]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].path, "docs/design/source.md");
  assert.equal(groups[0].state, "changed");
  assert.deepEqual(groups[0].relatedItems, ["GUIDE-1", "I0001", "POL-1"]);
  assert.deepEqual(groups[0].capturedRevisions, ["1111111111111111111111111111111111111111"]);
  assert.equal(filterEvidence(groups, "POL-1", "changed").length, 1);
});

test("pagination clamps invalid and out-of-range pages", () => {
  const values = Array.from({ length: 12 }, (_, index) => index + 1);
  assert.deepEqual(paginate(values, 99, 5), {
    items: [11, 12],
    page: 3,
    pageSize: 5,
    total: 12,
    totalPages: 3,
    start: 11,
    end: 12
  });
});

test("runtime summary uses observed probes without inferring execution state", () => {
  const summary = runtimeSummary({
    observedAt: "2026-07-16T00:00:00Z",
    repository: { status: "dirty", dirtyCount: 2 },
    probes: [
      { id: "health", kind: "health", ok: true, data: { status: "UP" } },
      { id: "quality", kind: "quality", ok: false, error: "not run" }
    ]
  });
  assert.deepEqual(summary, {
    status: "DEGRADED",
    healthy: false,
    probeCount: 2,
    healthyProbes: 1,
    failedProbes: 1,
    observedAt: "2026-07-16T00:00:00Z",
    repositoryStatus: "dirty",
    dirtyCount: 2
  });
  assert.equal(Object.hasOwn(summary, "taskStatus"), false);
});

test("degraded governance presentation never renders last-known approval as currently verified", () => {
  const degradedPolicy = {
    ...policy,
    projectionState: "last_known_unverified",
    authorityState: "unverified",
    approvalState: "unverified",
    enforcement: "unverified",
    evidenceState: "unverified",
    lastKnown: {
      authorityState: "effective",
      approvalState: "approved",
      enforcement: "enforced",
      evidenceState: "current"
    }
  };

  assert.deepEqual(governanceStatusPresentation(degradedPolicy, "approvalState"), {
    state: "last_known_unverified",
    value: "unverified",
    lastKnownValue: "approved",
    tone: "warning"
  });
  assert.deepEqual(filterPolicies({ policies: [degradedPolicy], filter: "unverified" }), [degradedPolicy]);
  assert.deepEqual(filterPolicies({ policies: [degradedPolicy], filter: "unreviewed" }), []);
});

test("degraded freshness copy explicitly identifies last-known records as unverified", () => {
  const presentation = freshnessPresentation({
    snapshot: { freshness: "degraded", verificationState: "last_known_unverified" },
    summary: { unverifiedCount: 2 },
    projectionError: { presentationState: "last_known_unverified" }
  });
  assert.deepEqual(presentation, {
    state: "last_known_unverified",
    tone: "degraded",
    message: "최신 원본을 검증하지 못했습니다 · 마지막으로 확인된 거버넌스 기록 2건을 미검증 상태로 표시합니다."
  });
  assert.doesNotMatch(presentation.message, /approved|effective/i);
});

test("fresh and review-required freshness copy is locale-configured while preserving machine tokens", () => {
  assert.deepEqual(freshnessPresentation({
    snapshot: {
      freshness: "fresh",
      sourceFence: { evidenceCurrent: 2 }
    }
  }), {
    state: "fresh",
    tone: "fresh",
    message: "소스 근거가 최신입니다 · 참조 2건이 캡처된 해시와 일치합니다."
  });

  assert.deepEqual(freshnessPresentation({
    snapshot: {
      freshness: "stale",
      sourceFence: { evidenceChanged: 1, evidenceMissing: 2 }
    },
    migrationFence: { state: "awaiting_human_review" }
  }), {
    state: "stale",
    tone: "stale",
    message: "검토가 필요합니다 · 초기 이관 경계 사용자 검토 대기 · 변경 1건 · 누락 2건"
  });
});
