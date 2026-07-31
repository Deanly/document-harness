const severityOrder = new Map([
  ["critical", 0],
  ["decision", 1],
  ["warning", 2],
  ["info", 3]
]);

const evidenceOrder = new Map([
  ["invalid", 0],
  ["unverified", 1],
  ["missing", 1],
  ["changed", 2],
  ["stale", 2],
  ["current", 3],
  ["unknown", 4]
]);

export const LAST_KNOWN_UNVERIFIED = "last_known_unverified";

const migrationFenceLabels = new Map([
  ["valid", "유효"],
  ["invalid", "무효"],
  ["degraded", "저하됨"],
  ["awaiting_human_review", "사용자 검토 대기"]
]);

function normalized(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function filterDomainContexts({ contexts = [], query = "", role = "all", filter = "all" }) {
  const needle = normalized(query);
  return contexts.filter((context) => {
    if (context.visibleOnBoard === false) return false;
    const roleMatch = role === "all" || (context.roleViews ?? []).includes(role);
    if (!roleMatch) return false;
    const currentAuthority = ["approved_current", "ai_current"].includes(context.validationStatus);
    const statusMatch = filter === "all"
      || (filter === "approved" && currentAuthority)
      || (filter === "review" && !currentAuthority && context.validationStatus !== "invalid")
      || (filter === "invalid" && context.validationStatus === "invalid");
    if (!statusMatch) return false;
    if (!needle) return true;
    const haystack = [
      context.id,
      context.name,
      context.title,
      context.displayTitle,
      context.subdomainType,
      context.owner,
      context.summary,
      context.humanSummary,
      context.responsibility,
      context.outOfScope,
      context.userVisibleFailure,
      context.pendingDecision,
      context.modelRef,
      context.languageRef,
      context.examplesRef,
      context.validationStatus,
      context.domainExpertAgent,
      context.authorityMode,
      context.decisionTier,
      context.boardReviewLevel,
      context.boardReviewStatus,
      ...(Object.values(context.boardReview ?? {})),
      ...(context.boardModel?.rows ?? []).flat(),
      ...(context.domainExpertRoles ?? []),
      ...(context.roleViews ?? []),
      ...(context.openQuestions ?? []),
      ...(context.boundaries ?? []),
      ...(context.integrations ?? []),
      ...(context.failureSemantics ?? []),
      ...(context.counterexamples ?? []),
      ...(context.decisions ?? []),
      ...(context.terms ?? []).flatMap((item) => Object.values(item ?? {})),
      ...(context.businessRules ?? []).flatMap((item) => Object.values(item ?? {})),
      ...(context.scenarios ?? []).flatMap((item) => Object.values(item ?? {})),
      ...(context.stateTransitions ?? []).flatMap((item) => Object.values(item ?? {})),
      ...(context.roleContracts ?? []).flatMap((item) => Object.values(item ?? {}))
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return haystack.includes(needle);
  });
}

export function sortAttention(attention = []) {
  return [...attention].sort((left, right) => {
    const rank = (severityOrder.get(left.severity) ?? 99) - (severityOrder.get(right.severity) ?? 99);
    if (rank !== 0) return rank;
    return String(left.id).localeCompare(String(right.id));
  });
}

export function reviewStats(attention = []) {
  const stats = { total: attention.length, critical: 0, decision: 0, warning: 0, info: 0 };
  for (const item of attention) {
    const key = Object.hasOwn(stats, item.severity) ? item.severity : "info";
    stats[key] += 1;
  }
  return stats;
}

export function guidelineMap(guidelines = []) {
  const byPolicy = new Map();
  for (const guideline of guidelines) {
    if (guideline.visibleOnBoard === false) continue;
    for (const policyRef of guideline.policyRefs ?? []) {
      const linked = byPolicy.get(policyRef) ?? [];
      linked.push(guideline);
      byPolicy.set(policyRef, linked);
    }
  }
  return byPolicy;
}

export function attentionMap(attention = []) {
  const byRef = new Map();
  for (const item of sortAttention(attention)) {
    for (const ref of item.relatedRefs ?? []) {
      const linked = byRef.get(ref) ?? [];
      linked.push(item);
      byRef.set(ref, linked);
    }
  }
  return byRef;
}

export function policySeverity(policyId, attention = []) {
  const related = attentionMap(attention).get(policyId) ?? [];
  return related[0]?.severity ?? "none";
}

export function filterPolicies({ policies = [], guidelines = [], attention = [], query = "", filter = "all" }) {
  const guidesByPolicy = guidelineMap(guidelines);
  const attentionByRef = attentionMap(attention);
  const needle = normalized(query);

  return policies.filter((policy) => {
    if (policy.visibleOnBoard === false) return false;
    const relatedGuides = guidesByPolicy.get(policy.id) ?? [];
    const relatedAttention = attentionByRef.get(policy.id) ?? [];
    const severity = relatedAttention[0]?.severity ?? "none";
    const matchesFilter = filter === "all"
      || (filter === "attention" && severity !== "none")
      || (filter === "critical" && severity === "critical")
      || (filter === "unreviewed" && policy.approvalState === "unreviewed")
      || (filter === "unverified" && policy.projectionState === LAST_KNOWN_UNVERIFIED)
      || (filter === "enforced" && policy.enforcement === "enforced")
      || (filter === "stale" && policy.evidenceState !== "current");
    if (!matchesFilter) return false;
    if (!needle) return true;

    const haystack = [
      policy.id,
      policy.title,
      policy.humanSummary,
      policy.why,
      policy.risk,
      policy.authorityClass,
      policy.authorityState,
      policy.approvalState,
      policy.enforcement,
      ...relatedGuides.flatMap((guide) => [guide.id, guide.title, guide.humanSummary, guide.risk, ...(guide.sourceRefs ?? []).map((ref) => ref.path)]),
      ...relatedAttention.flatMap((item) => [item.id, item.title, item.humanSummary]),
      ...(policy.sourceRefs ?? []).flatMap((ref) => [ref.path, ref.heading, ref.evidenceKind])
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return haystack.includes(needle);
  });
}

export function filterGuidelines({ guidelines = [], policies = [], attention = [], query = "", filter = "all" }) {
  const policiesById = new Map(
    policies.filter((policy) => policy.visibleOnBoard !== false).map((policy) => [policy.id, policy])
  );
  const attentionByRef = attentionMap(attention);
  const needle = normalized(query);

  return guidelines.filter((guideline) => {
    if (guideline.visibleOnBoard === false) return false;
    const relatedPolicies = (guideline.policyRefs ?? [])
      .map((policyRef) => policiesById.get(policyRef))
      .filter(Boolean);
    const relatedAttention = attentionByRef.get(guideline.id) ?? [];
    const severity = relatedAttention[0]?.severity ?? "none";
    const matchesFilter = filter === "all"
      || (filter === "attention" && severity !== "none")
      || (filter === "critical" && severity === "critical")
      || (filter === "unreviewed" && guideline.approvalState === "unreviewed")
      || (filter === "unverified" && guideline.projectionState === LAST_KNOWN_UNVERIFIED)
      || (filter === "enforced" && guideline.enforcement === "enforced")
      || (filter === "stale" && guideline.evidenceState !== "current");
    if (!matchesFilter) return false;
    if (!needle) return true;

    const haystack = [
      guideline.id,
      guideline.title,
      guideline.humanSummary,
      guideline.why,
      guideline.scope,
      guideline.risk,
      guideline.authorityClass,
      guideline.authorityState,
      guideline.approvalState,
      guideline.enforcement,
      ...relatedPolicies.flatMap((policy) => [policy.id, policy.title, policy.humanSummary, policy.risk]),
      ...relatedAttention.flatMap((item) => [item.id, item.title, item.humanSummary]),
      ...(guideline.sourceRefs ?? []).flatMap((ref) => [ref.path, ref.heading, ref.evidenceKind])
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return haystack.includes(needle);
  });
}

export function filterInitiatives({ initiatives = [], policies = [], guidelines = [], attention = [], query = "", filter = "all" }) {
  const policiesById = new Map(
    policies.filter((policy) => policy.visibleOnBoard !== false).map((policy) => [policy.id, policy])
  );
  const guidelinesById = new Map(
    guidelines.filter((guideline) => guideline.visibleOnBoard !== false).map((guideline) => [guideline.id, guideline])
  );
  const attentionByRef = attentionMap(attention);
  const needle = normalized(query);

  return initiatives.filter((initiative) => {
    if (initiative.visibleOnBoard === false) return false;
    const linkedPolicies = (initiative.policyRefs ?? []).map((ref) => policiesById.get(ref)).filter(Boolean);
    const linkedGuidelines = (initiative.guidelineRefs ?? []).map((ref) => guidelinesById.get(ref)).filter(Boolean);
    const visiblePolicyIds = new Set(linkedPolicies.map((item) => item.id));
    const visibleGuidelineIds = new Set(linkedGuidelines.map((item) => item.id));
    const guidelineNeedsReview = initiative.guidelineDisposition === "needs_review"
      || linkedGuidelines.some((item) => item.approvalState !== "approved" || item.authorityState !== "effective");
    const matchesFilter = filter === "all"
      || (filter === "active" && initiative.lifecycleState === "active")
      || (filter === "draft" && initiative.lifecycleState === "draft")
      || (filter === "review" && ["unreviewed", "review_requested"].includes(initiative.approvalState))
      || (filter === "guideline_review" && guidelineNeedsReview)
      || (filter === "no_projects" && (initiative.projects ?? []).length === 0)
      || (filter === "stale" && initiative.evidenceState !== "current");
    if (!matchesFilter) return false;
    if (!needle) return true;

    const relatedAttention = attentionByRef.get(initiative.id) ?? [];
    const haystack = [
      initiative.id,
      initiative.title,
      initiative.humanSummary,
      initiative.outcome,
      initiative.whyNow,
      initiative.owner,
      initiative.currentFocus,
      initiative.lifecycleState,
      initiative.approvalState,
      initiative.guidelineDispositionReason,
      ...(initiative.policyRelationships ?? [])
        .filter((item) => visiblePolicyIds.has(item.policyId))
        .flatMap((item) => [item.policyId, item.relation, item.rationale, item.exceptionRef]),
      ...(initiative.guidelineRelationships ?? [])
        .filter((item) => visibleGuidelineIds.has(item.guidelineId))
        .flatMap((item) => [item.guidelineId, item.adoption, item.rationale, item.verification]),
      ...(initiative.successSignals ?? []),
      ...(initiative.risks ?? []),
      ...linkedPolicies.flatMap((item) => [item.id, item.title, item.humanSummary]),
      ...linkedGuidelines.flatMap((item) => [item.id, item.title, item.humanSummary]),
      ...(initiative.projects ?? []).flatMap((item) => [item.id, item.title, item.status, item.currentFocus, item.path]),
      ...relatedAttention.flatMap((item) => [item.id, item.title, item.humanSummary]),
      ...(initiative.sourceRefs ?? []).flatMap((ref) => [ref.path, ref.heading, ref.evidenceKind])
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return haystack.includes(needle);
  });
}

export function governanceStatusPresentation(item = {}, field) {
  const value = item[field] ?? "unknown";
  const unverified = item.projectionState === LAST_KNOWN_UNVERIFIED || value === "unverified";
  return {
    state: unverified ? LAST_KNOWN_UNVERIFIED : "verified",
    value,
    lastKnownValue: unverified ? item.lastKnown?.[field] ?? null : null,
    tone: unverified ? "warning" : null
  };
}

export function freshnessPresentation(snapshot = {}) {
  const freshness = snapshot.snapshot?.freshness ?? "degraded";
  const verificationState = snapshot.snapshot?.verificationState;
  if (verificationState === LAST_KNOWN_UNVERIFIED || snapshot.projectionError?.presentationState === LAST_KNOWN_UNVERIFIED) {
    const count = snapshot.summary?.unverifiedCount;
    return {
      state: LAST_KNOWN_UNVERIFIED,
      tone: "degraded",
      message: `최신 원본을 검증하지 못했습니다 · 마지막으로 확인된 거버넌스 기록 ${count ?? "확인 불가"}건을 미검증 상태로 표시합니다.`
    };
  }
  if (freshness === "fresh") {
    return {
      state: "fresh",
      tone: "fresh",
      message: `소스 근거가 최신입니다 · 참조 ${snapshot.snapshot?.sourceFence?.evidenceCurrent ?? "확인 불가"}건이 캡처된 해시와 일치합니다.`
    };
  }
  const migration = snapshot.migrationFence ?? {};
  const fence = snapshot.snapshot?.sourceFence ?? {};
  return {
    state: freshness,
    tone: freshness,
    message: `검토가 필요합니다 · 초기 이관 경계 ${migrationFenceLabels.get(migration.state) ?? migration.state ?? "확인 불가"} · 변경 ${fence.evidenceChanged ?? "확인 불가"}건 · 누락 ${fence.evidenceMissing ?? "확인 불가"}건`
  };
}

export function paginate(items = [], requestedPage = 1, requestedPageSize = 10) {
  const pageSize = Math.max(1, Number(requestedPageSize) || 10);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, Number(requestedPage) || 1), totalPages);
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages,
    start: items.length === 0 ? 0 : start + 1,
    end: Math.min(start + pageSize, items.length)
  };
}

function mergeEvidenceState(current, candidate) {
  const currentRank = evidenceOrder.get(current) ?? evidenceOrder.get("unknown");
  const candidateRank = evidenceOrder.get(candidate) ?? evidenceOrder.get("unknown");
  return candidateRank < currentRank ? candidate : current;
}

export function buildEvidenceGroups(policies = [], guidelines = [], initiatives = []) {
  const groups = new Map();
  for (const item of [...policies, ...guidelines, ...initiatives]) {
    for (const ref of item.sourceRefs ?? []) {
      const path = ref.path ?? "unknown";
      const existing = groups.get(path) ?? {
        path,
        state: "current",
        evidenceKinds: [],
        locations: [],
        relatedItems: [],
        capturedHashes: [],
        currentHashes: [],
        capturedRevisions: []
      };
      existing.state = mergeEvidenceState(existing.state, ref.state ?? "unknown");
      existing.evidenceKinds.push(ref.evidenceKind);
      existing.locations.push([
        ref.heading,
        ref.lineStart ? `L${ref.lineStart}${ref.lineEnd ? `–${ref.lineEnd}` : ""}` : null
      ].filter(Boolean).join(" · "));
      existing.relatedItems.push(item.id);
      existing.capturedHashes.push(ref.capturedSha256);
      existing.currentHashes.push(ref.currentSha256);
      existing.capturedRevisions.push(ref.capturedRepositoryRevision);
      groups.set(path, existing);
    }
  }

  return [...groups.values()].map((group) => ({
    ...group,
    evidenceKinds: uniqueSorted(group.evidenceKinds),
    locations: uniqueSorted(group.locations),
    relatedItems: uniqueSorted(group.relatedItems),
    capturedHashes: uniqueSorted(group.capturedHashes),
    currentHashes: uniqueSorted(group.currentHashes),
    capturedRevisions: uniqueSorted(group.capturedRevisions)
  })).sort((left, right) => {
    const rank = (evidenceOrder.get(left.state) ?? 99) - (evidenceOrder.get(right.state) ?? 99);
    return rank !== 0 ? rank : left.path.localeCompare(right.path);
  });
}

export function filterEvidence(groups = [], query = "", filter = "all") {
  const needle = normalized(query);
  return groups.filter((group) => {
    if (filter !== "all" && group.state !== filter) return false;
    if (!needle) return true;
    return [
      group.path,
      ...group.evidenceKinds,
      ...group.locations,
      ...group.relatedItems
    ].join(" ").toLocaleLowerCase().includes(needle);
  });
}

export function runtimeSummary(runtime = {}) {
  const probes = runtime.probes ?? [];
  const healthyProbes = probes.filter((probe) => probe.ok).length;
  const failedProbes = probes.filter((probe) => !probe.ok).length;
  return {
    status: probes.length === 0 ? "NOT_CONFIGURED" : failedProbes === 0 ? "UP" : "DEGRADED",
    healthy: probes.length > 0 && failedProbes === 0,
    probeCount: probes.length,
    healthyProbes,
    failedProbes,
    observedAt: runtime.observedAt ?? null,
    repositoryStatus: runtime.repository?.status ?? "unknown",
    dirtyCount: runtime.repository?.dirtyCount ?? null
  };
}
