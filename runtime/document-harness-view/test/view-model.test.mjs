import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEvidenceGroups,
  filterEvidence,
  filterPolicies,
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
  const groups = buildEvidenceGroups([policy], [guideline]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].path, "docs/design/source.md");
  assert.equal(groups[0].state, "changed");
  assert.deepEqual(groups[0].relatedItems, ["GUIDE-1", "POL-1"]);
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
