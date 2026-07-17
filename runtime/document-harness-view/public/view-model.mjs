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

function normalized(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ko");
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "ko"));
}

export function sortAttention(attention = []) {
  return [...attention].sort((left, right) => {
    const rank = (severityOrder.get(left.severity) ?? 99) - (severityOrder.get(right.severity) ?? 99);
    if (rank !== 0) return rank;
    return String(left.id).localeCompare(String(right.id), "ko");
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
    ].filter(Boolean).join(" ").toLocaleLowerCase("ko");
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
      message: `Latest source could not be verified · showing ${count ?? "unknown"} last-known governance records as unverified.`
    };
  }
  if (freshness === "fresh") {
    return {
      state: "fresh",
      tone: "fresh",
      message: `Source evidence is current · ${snapshot.snapshot?.sourceFence?.evidenceCurrent ?? "unknown"} references match their captured hashes.`
    };
  }
  const migration = snapshot.migrationFence ?? {};
  const fence = snapshot.snapshot?.sourceFence ?? {};
  return {
    state: freshness,
    tone: freshness,
    message: `Review required · migration fence ${migration.state ?? "unknown"} · changed ${fence.evidenceChanged ?? "unknown"} · missing ${fence.evidenceMissing ?? "unknown"}`
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

export function buildEvidenceGroups(policies = [], guidelines = []) {
  const groups = new Map();
  for (const item of [...policies, ...guidelines]) {
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
    return rank !== 0 ? rank : left.path.localeCompare(right.path, "ko");
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
    ].join(" ").toLocaleLowerCase("ko").includes(needle);
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
