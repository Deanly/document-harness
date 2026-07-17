import {
  attentionMap,
  buildEvidenceGroups,
  filterEvidence,
  filterPolicies,
  freshnessPresentation,
  governanceStatusPresentation,
  guidelineMap,
  paginate,
  policySeverity,
  reviewStats,
  runtimeSummary,
  sortAttention
} from "/view-model.mjs?v=1";

const tabNames = ["overview", "policies", "review", "execution", "evidence"];

const state = {
  snapshot: null,
  etag: null,
  activeTab: "policies",
  policyFilter: "all",
  policyQuery: "",
  policyPage: 1,
  policyPageSize: 5,
  expandedPolicies: new Set(),
  reviewFilter: "all",
  evidenceFilter: "all",
  evidenceQuery: "",
  pollTimer: null,
  pollIntervalMs: 2000
};

const labels = {
  proposed: "추출 후보",
  accepted_for_promotion: "승격 승인",
  effective: "현재 적용",
  superseded: "대체됨",
  unreviewed: "미검토",
  review_requested: "검토 요청",
  approved: "승인됨",
  rejected: "반려됨",
  stale: "근거 변경",
  enforced: "코드로 강제",
  partially_enforced: "일부 강제",
  advisory: "지침 수준",
  not_implemented: "미구현",
  unknown: "확인 필요",
  unverified: "현재 미검증",
  last_known_unverified: "마지막 확인값 · 현재 미검증",
  repository_instruction: "저장소 지침",
  current_design: "현재 설계",
  guide: "운영 가이드",
  code_observation: "코드 관찰",
  config_observation: "설정 관찰",
  proposed_safety_rule: "안전 제안",
  current: "현재 일치",
  changed: "변경됨",
  missing: "누락",
  invalid: "경계 위반",
  fresh: "최신",
  degraded: "저하",
  clean: "변경 없음",
  dirty: "미커밋 변경",
  critical: "Critical",
  decision: "결정 필요",
  warning: "Attention",
  info: "정보",
  none: "일반"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.id) node.id = options.id;
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) node.setAttribute(name, String(value));
  }
  for (const child of children) {
    if (child !== null && child !== undefined) node.append(child);
  }
  return node;
}

function clear(node) {
  node.replaceChildren();
}

function formatTime(value, includeDate = false) {
  if (!value) return "기록 없음";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      ...(includeDate ? { year: "numeric", month: "2-digit", day: "2-digit" } : { month: "short", day: "numeric" }),
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function shortHash(value) {
  if (!value) return "-";
  return String(value).slice(0, 12);
}

function number(value) {
  return value === null || value === undefined ? "-" : new Intl.NumberFormat("ko-KR").format(value);
}

function toneFor(value) {
  if (["effective", "approved", "enforced", "fresh", "current", "clean", "UP"].includes(value)) return "success";
  if (["not_implemented", "stale", "degraded", "rejected", "missing", "invalid", "changed", "DOWN", "critical"].includes(value)) return "danger";
  if (["partially_enforced", "review_requested", "proposed", "advisory", "dirty", "warning", "unverified", "last_known_unverified"].includes(value)) return "warning";
  if (["decision"].includes(value)) return "info";
  return "neutral";
}

function statusLabel(value, tone = toneFor(value), text = labels[value] ?? value) {
  return element("span", { className: `status-label ${tone}`, text });
}

function severityLabel(severity) {
  return statusLabel(severity, toneFor(severity), labels[severity] ?? severity);
}

function metric(label, value, helper = null, className = "metric") {
  return element("div", { className }, [
    element("span", { text: label }),
    element("strong", { text: value }),
    helper ? element("small", { text: helper }) : null
  ]);
}

function renderMetricSet(container, values, className = "metric") {
  clear(container);
  for (const value of values) container.append(metric(value[0], value[1], value[2], className));
}

function activateTab(tabName, { focus = false, updateHash = true } = {}) {
  const resolved = tabNames.includes(tabName) ? tabName : "policies";
  state.activeTab = resolved;
  for (const name of tabNames) {
    const tab = $(`#tab-${name}`);
    const panel = $(`#panel-${name}`);
    const active = name === resolved;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.tabIndex = active ? 0 : -1;
    panel.hidden = !active;
  }
  if (updateHash && window.location.hash !== `#${resolved}`) {
    window.history.replaceState(null, "", `#${resolved}`);
  }
  if (focus) $(`#tab-${resolved}`).focus();
}

function setupTabs() {
  for (const tab of $$("[role='tab']")) {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      const current = tabNames.indexOf(tab.dataset.tab);
      let next = null;
      if (event.key === "ArrowRight") next = (current + 1) % tabNames.length;
      if (event.key === "ArrowLeft") next = (current - 1 + tabNames.length) % tabNames.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabNames.length - 1;
      if (next === null) return;
      event.preventDefault();
      activateTab(tabNames[next], { focus: true });
    });
  }
  for (const trigger of $$('[data-open-tab]')) {
    trigger.addEventListener("click", () => activateTab(trigger.dataset.openTab, { focus: true }));
  }
  const initial = window.location.hash.replace(/^#/, "");
  activateTab(tabNames.includes(initial) ? initial : "policies", { updateHash: true });
  window.addEventListener("hashchange", () => activateTab(window.location.hash.replace(/^#/, ""), { updateHash: false }));
}

function renderFreshness(snapshot) {
  const banner = $("#freshness-banner");
  const presentation = freshnessPresentation(snapshot);
  banner.className = `freshness-banner ${presentation.tone}`;
  banner.textContent = presentation.message;
}

function governanceStatusLabel(item, field, suffix = "") {
  const presentation = governanceStatusPresentation(item, field);
  if (presentation.state === "last_known_unverified") {
    const previous = labels[presentation.lastKnownValue] ?? presentation.lastKnownValue ?? "기록 없음";
    return statusLabel("unverified", presentation.tone, `마지막 ${previous} · 현재 미검증${suffix}`);
  }
  return statusLabel(presentation.value, toneFor(presentation.value), `${labels[presentation.value] ?? presentation.value}${suffix}`);
}

function runtimeMetricSet(snapshot) {
  const summary = runtimeSummary(snapshot.runtime);
  return [
    ["Repository", labels[summary.repositoryStatus] ?? summary.repositoryStatus, summary.dirtyCount === null ? "change count unavailable" : `${number(summary.dirtyCount)} changes`],
    ["Runtime probes", `${number(summary.healthyProbes)} / ${number(summary.probeCount)}`, summary.probeCount === 0 ? "not configured" : "healthy / configured"],
    ["Probe failures", number(summary.failedProbes), summary.failedProbes === 0 ? "none observed" : "review required"],
    ["Migration fence", snapshot.migrationFence?.state ?? "unknown", snapshot.migrationFence?.reason ?? "not observed"],
    ["Source evidence", snapshot.snapshot.sourceFence?.sourceEvidenceState ?? "unknown", `${number(snapshot.snapshot.sourceFence?.evidenceCurrent)} current`]
  ];
}

function renderRuntimeStrip(container, snapshot) {
  clear(container);
  const summary = runtimeSummary(snapshot.runtime);
  runtimeMetricSet(snapshot).forEach(([label, value, helper], index) => {
    const item = metric(label, value, helper, "runtime-metric");
    if (index === 1) item.querySelector("strong").className = summary.failedProbes === 0 ? "good" : "bad";
    container.append(item);
  });
}

function renderChrome(snapshot) {
  $("#repository-name").textContent = snapshot.project.id;
  $("#last-updated").textContent = `Updated ${formatTime(snapshot.snapshot.generatedAt, true)}`;
  $("#review-tab-count").textContent = snapshot.summary.attentionCount;
  $("#footer-fence").textContent = `Snapshot ${snapshot.snapshot.id} · migration ${snapshot.migrationFence?.state ?? "unknown"} · source ${snapshot.snapshot.sourceFence?.sourceEvidenceState ?? "unknown"}`;
  renderFreshness(snapshot);
}

function reviewPreview(item, compact = false) {
  const card = element("article", { className: `${compact ? "review-rail-item" : "review-preview"} ${item.severity ?? "info"}` }, [
    element("div", { className: compact ? "review-rail-head" : "review-preview-head" }, [
      severityLabel(item.severity ?? "info"),
      element("span", { className: "item-id", text: item.id })
    ]),
    element("h3", { text: item.title }),
    element("p", { text: item.humanSummary })
  ]);
  return card;
}

function renderOverview(snapshot) {
  $("#overview-title").textContent = `${snapshot.project.name} 개요`;
  $("#project-description").textContent = snapshot.project.description;
  const migration = $("#migration-badge");
  migration.textContent = snapshot.migration.status === "awaiting_human_review" ? "초기 이관 · 사용자 검토 대기" : snapshot.migration.status;
  migration.className = "status-label warning";

  const unverified = snapshot.summary.state === "last_known_unverified";
  renderMetricSet($("#overview-summary"), [
    ["정책 후보", number(snapshot.summary.policyCount), "기존 소스에서 추출"],
    ["실행 지침", number(snapshot.summary.guidelineCount), "정책 구현 방법"],
    [unverified ? "현재 확인된 승인" : "승인 완료", number(snapshot.summary.approvedCount), unverified ? `마지막 확인 ${number(snapshot.summary.lastKnown?.approvedCount)}` : "receipt 기준"],
    [unverified ? "현재 확인된 검토 대기" : "검토 대기", number(snapshot.summary.reviewCount), unverified ? `마지막 확인 ${number(snapshot.summary.lastKnown?.reviewCount)}` : "정책·지침 후보"],
    ...(unverified ? [["현재 미검증", number(snapshot.summary.unverifiedCount), "마지막 정상 snapshot에서 보존"]] : []),
    ["주의 항목", number(snapshot.summary.attentionCount), "위험·결정·공백"]
  ]);

  const directions = $("#direction-list");
  clear(directions);
  for (const item of snapshot.direction) directions.append(element("li", { text: item }));

  const reviewList = $("#overview-review-list");
  clear(reviewList);
  const sorted = sortAttention(snapshot.attention).slice(0, 3);
  if (sorted.length === 0) reviewList.append($("#empty-template").content.cloneNode(true));
  else for (const item of sorted) reviewList.append(reviewPreview(item));

  renderRuntimeStrip($("#overview-runtime"), snapshot);
}

function policyFilterCount(snapshot, filter) {
  return filterPolicies({
    policies: snapshot.policies,
    guidelines: snapshot.guidelines,
    attention: snapshot.attention,
    filter
  }).length;
}

function renderPolicyFilters(snapshot) {
  const filters = $("#policy-filters");
  clear(filters);
  const definitions = [
    ["all", "전체"],
    ["critical", "Critical"],
    ["attention", "검토 연결"],
    ["unreviewed", "승인 필요"],
    ["unverified", "현재 미검증"],
    ["enforced", "강제"],
    ["stale", "근거 변경"]
  ];
  for (const [value, label] of definitions) {
    const button = element("button", {
      id: `policy-filter-${value}`,
      className: `filter-button${state.policyFilter === value ? " active" : ""}`,
      text: `${label} ${policyFilterCount(snapshot, value)}`,
      attrs: { type: "button", "aria-pressed": state.policyFilter === value ? "true" : "false" }
    });
    button.addEventListener("click", () => {
      state.policyFilter = value;
      state.policyPage = 1;
      renderPolicies(snapshot);
      const refreshed = [...$("#policy-filters").children][definitions.findIndex(([candidate]) => candidate === value)];
      refreshed?.focus();
    });
    filters.append(button);
  }
}

function policyRiskLabel(policy, snapshot) {
  const severity = policySeverity(policy.id, snapshot.attention);
  if (severity !== "none") return severityLabel(severity);
  if (policy.risk) return statusLabel("warning", "warning", "주의");
  return statusLabel("none", "neutral", "일반");
}

function linkedGuideList(policy, snapshot) {
  return guidelineMap(snapshot.guidelines).get(policy.id) ?? [];
}

function sourceLocation(ref) {
  return `${ref.path}${ref.lineStart ? `:${ref.lineStart}${ref.lineEnd ? `–${ref.lineEnd}` : ""}` : ""}`;
}

function sourceStateText(ref) {
  if (ref.state === "unverified") {
    const previous = labels[ref.lastKnownState] ?? ref.lastKnownState ?? "기록 없음";
    return `마지막 ${previous} · 현재 미검증`;
  }
  return labels[ref.state] ?? ref.state;
}

function policyDetail(policy, linkedGuides) {
  const statement = element("div", { className: "detail-column" }, [
    element("span", { className: "detail-label", text: "정책 진술과 영향" }),
    element("p", { text: policy.humanSummary }),
    policy.why ? element("p", { text: `왜 중요한가 · ${policy.why}` }) : null,
    policy.risk ? element("p", { className: "risk-copy", text: `알려진 위험 · ${policy.risk}` }) : null
  ]);

  const guides = element("div", { className: "detail-column" }, [
    element("span", { className: "detail-label", text: `관련 지침 ${linkedGuides.length}개` })
  ]);
  if (linkedGuides.length === 0) guides.append(element("p", { text: "연결된 지침이 없습니다." }));
  else {
    const list = element("ul");
    for (const guide of linkedGuides) {
      list.append(element("li", {}, [
        element("code", { text: guide.id }),
        document.createTextNode(` ${guide.title} · ${guide.humanSummary}`)
      ]));
    }
    guides.append(list);
  }

  const evidence = element("div", { className: "detail-column" }, [
    element("span", { className: "detail-label", text: `증거와 출처 ${policy.sourceRefs.length}건` })
  ]);
  const evidenceList = element("ul");
  for (const ref of policy.sourceRefs) {
    evidenceList.append(element("li", {}, [
      element("code", { text: sourceLocation(ref) }),
      document.createTextNode(` · ${sourceStateText(ref)}`)
    ]));
  }
  evidence.append(evidenceList);

  const review = element("div", { className: "detail-column" }, [
    element("span", { className: "detail-label", text: "다음 사람 검토 단계" }),
    element("ol", {}, [
      element("li", { text: "정책 문장과 적용 범위를 확인합니다." }),
      element("li", { text: "관련 지침 연결이 적절한지 검토합니다." }),
      element("li", { text: "근거 최신성과 구현 수준을 확인합니다." }),
      element("li", { text: "승인·수정·보류 결정은 별도 receipt로 남깁니다." })
    ])
  ]);
  return element("div", { className: "policy-detail" }, [statement, guides, evidence, review]);
}

function renderPolicyTable(snapshot) {
  const body = $("#policy-table-body");
  clear(body);
  const filtered = filterPolicies({
    policies: snapshot.policies,
    guidelines: snapshot.guidelines,
    attention: snapshot.attention,
    query: state.policyQuery,
    filter: state.policyFilter
  });
  const page = paginate(filtered, state.policyPage, state.policyPageSize);
  state.policyPage = page.page;
  $("#policy-result-count").textContent = `${number(page.total)}개 결과 · ${number(page.start)}–${number(page.end)} 표시`;

  if (page.items.length === 0) {
    const row = element("tr");
    row.append(element("td", { attrs: { colspan: "8" } }, [$("#empty-template").content.cloneNode(true)]));
    body.append(row);
  }

  for (const policy of page.items) {
    const linkedGuides = linkedGuideList(policy, snapshot);
    const expanded = state.expandedPolicies.has(policy.id);
    const trigger = element("button", {
      id: `toggle-${policy.id}`,
      className: "row-toggle",
      text: expanded ? "닫기" : "열기",
      attrs: {
        type: "button",
        "aria-expanded": expanded ? "true" : "false",
        "aria-controls": `details-${policy.id}`,
        "aria-label": `${policy.id} 상세 ${expanded ? "닫기" : "열기"}`
      }
    });
    trigger.addEventListener("click", () => {
      if (expanded) state.expandedPolicies.delete(policy.id);
      else state.expandedPolicies.add(policy.id);
      renderPolicyTable(snapshot);
      $(`#toggle-${policy.id}`)?.focus();
    });

    const row = element("tr", { className: "data-row" }, [
      element("td", {}, [trigger]),
      element("td", {}, [element("span", { className: "item-id", text: policy.id })]),
      element("td", {}, [
        element("span", { className: "policy-title", text: policy.title }),
        element("span", { className: "policy-summary", text: policy.humanSummary })
      ]),
      element("td", {}, [
        element("div", { className: "linked-refs" }, linkedGuides.length
          ? linkedGuides.map((guide) => element("code", { text: guide.id }))
          : [element("span", { text: "연결 없음" })])
      ]),
      element("td", {}, [policyRiskLabel(policy, snapshot)]),
      element("td", {}, [governanceStatusLabel(policy, "enforcement")]),
      element("td", {}, [governanceStatusLabel(policy, "approvalState")]),
      element("td", {}, [
        governanceStatusLabel(policy, "evidenceState", ` · ${policy.sourceRefs.length}`)
      ])
    ]);
    body.append(row);

    if (expanded) {
      const detailsRow = element("tr", { className: "details-row", id: `details-${policy.id}` });
      detailsRow.append(element("td", { attrs: { colspan: "8" } }, [policyDetail(policy, linkedGuides)]));
      body.append(detailsRow);
    }
  }

  renderPagination(page, snapshot);
}

function renderPagination(page, snapshot) {
  const container = $("#policy-pagination");
  clear(container);
  const summary = element("span", { text: `${number(page.total)}개 중 ${number(page.start)}–${number(page.end)} · ${page.page}/${page.totalPages} 페이지` });
  const actions = element("div", { className: "pagination-actions" });
  const previous = element("button", { text: "이전", attrs: { type: "button", "aria-label": "이전 정책 페이지" } });
  previous.disabled = page.page <= 1;
  previous.addEventListener("click", () => {
    state.policyPage -= 1;
    renderPolicyTable(snapshot);
  });
  const next = element("button", { text: "다음", attrs: { type: "button", "aria-label": "다음 정책 페이지" } });
  next.disabled = page.page >= page.totalPages;
  next.addEventListener("click", () => {
    state.policyPage += 1;
    renderPolicyTable(snapshot);
  });
  actions.append(previous, next);
  container.append(summary, actions);
}

function renderReviewRail(snapshot) {
  const container = $("#review-rail-list");
  clear(container);
  const sorted = sortAttention(snapshot.attention);
  for (const severity of ["critical", "decision", "warning"]) {
    const items = sorted.filter((item) => item.severity === severity);
    if (items.length === 0) continue;
    const group = element("section", { className: "review-group" }, [
      element("div", { className: `review-group-heading ${severity}` }, [
        element("span", { text: labels[severity] }),
        element("strong", { text: items.length })
      ])
    ]);
    for (const item of items.slice(0, 2)) group.append(reviewPreview(item, true));
    if (items.length > 2) group.append(element("button", { className: "text-button", text: `나머지 ${items.length - 2}개 항목 보기`, attrs: { type: "button" } }));
    const button = group.lastElementChild;
    if (button?.tagName === "BUTTON") button.addEventListener("click", () => activateTab("review", { focus: true }));
    container.append(group);
  }
}

function renderPolicies(snapshot) {
  const unverified = snapshot.summary.state === "last_known_unverified";
  renderMetricSet($("#policy-summary"), [
    ["정책", number(snapshot.summary.policyCount)],
    ["지침", number(snapshot.summary.guidelineCount)],
    [unverified ? "현재 확인된 승인" : "승인", number(snapshot.summary.approvedCount), unverified ? `마지막 ${number(snapshot.summary.lastKnown?.approvedCount)}` : null],
    ...(unverified ? [["현재 미검증", number(snapshot.summary.unverifiedCount)]] : []),
    ["주의", number(snapshot.summary.attentionCount)],
    [unverified ? "현재 확인된 검토 대기" : "검토 대기", number(snapshot.summary.reviewCount), unverified ? `마지막 ${number(snapshot.summary.lastKnown?.reviewCount)}` : null]
  ], "compact-metric");
  renderPolicyFilters(snapshot);
  renderPolicyTable(snapshot);
  renderReviewRail(snapshot);
  renderRuntimeStrip($("#policy-runtime-strip"), snapshot);
}

function renderReviewFilters(snapshot) {
  const container = $("#review-filters");
  clear(container);
  const stats = reviewStats(snapshot.attention);
  const definitions = [
    ["all", "전체", stats.total],
    ["critical", "Critical", stats.critical],
    ["decision", "결정 필요", stats.decision],
    ["warning", "Attention", stats.warning]
  ];
  for (const [value, label, count] of definitions) {
    const button = element("button", {
      id: `review-filter-${value}`,
      className: `filter-button${state.reviewFilter === value ? " active" : ""}`,
      text: `${label} ${count}`,
      attrs: { type: "button", "aria-pressed": state.reviewFilter === value ? "true" : "false" }
    });
    button.addEventListener("click", () => {
      state.reviewFilter = value;
      renderReview(snapshot);
      const refreshed = [...$("#review-filters").children][definitions.findIndex(([candidate]) => candidate === value)];
      refreshed?.focus();
    });
    container.append(button);
  }
}

function renderReview(snapshot) {
  const stats = reviewStats(snapshot.attention);
  renderMetricSet($("#review-summary"), [
    ["전체", number(stats.total)],
    ["Critical", number(stats.critical)],
    ["결정 필요", number(stats.decision)],
    ["Attention", number(stats.warning)],
    ["미검토 후보", number(snapshot.summary.reviewCount)]
  ], "compact-metric");
  renderReviewFilters(snapshot);
  const container = $("#review-list");
  clear(container);
  const items = sortAttention(snapshot.attention).filter((item) => state.reviewFilter === "all" || item.severity === state.reviewFilter);
  if (items.length === 0) container.append($("#empty-template").content.cloneNode(true));
  for (const item of items) {
    container.append(element("article", { className: `review-item ${item.severity ?? "info"}` }, [
      element("div", {}, [
        severityLabel(item.severity ?? "info"),
        element("div", { className: "item-id", text: item.id })
      ]),
      element("div", { className: "review-item-copy" }, [
        element("h2", { text: item.title }),
        element("p", { text: item.humanSummary })
      ]),
      element("div", { className: "review-related" }, [
        element("span", { className: "detail-label", text: "관련 항목" }),
        element("div", { className: "linked-refs" }, (item.relatedRefs?.length
          ? item.relatedRefs.map((ref) => element("code", { text: ref }))
          : [element("span", { text: "전체 migration" })]))
      ])
    ]));
  }
  $("#approval-rule").textContent = snapshot.migration.approvalRule ?? "This view cannot approve or modify policy.";
}

function runtimeRows(rows) {
  const list = element("dl");
  for (const [label, value] of rows) {
    list.append(element("div", { className: "runtime-card-row" }, [
      element("dt", { text: label }),
      element("dd", { text: value })
    ]));
  }
  return list;
}

function runtimeCard(title, status, rows, tone = toneFor(status)) {
  return element("article", { className: "runtime-card" }, [
    element("div", { className: "runtime-card-head" }, [
      element("h2", { text: title }),
      statusLabel(status, tone, labels[status] ?? status)
    ]),
    runtimeRows(rows)
  ]);
}

function displayProbeValue(value) {
  if (value === null || value === undefined) return "not reported";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return `${value.length} items`;
  return `${Object.keys(value).length} fields`;
}

function probeRows(probe) {
  const rows = Object.entries(probe.data ?? {})
    .slice(0, 3)
    .map(([name, value]) => [name, displayProbeValue(value)]);
  if (rows.length === 0) rows.push(["Result", probe.ok ? "request succeeded" : probe.error ?? "request failed"]);
  rows.push(["Observed", formatTime(probe.observedAt, true)]);
  rows.push(["Method", "allowlisted read-only probe"]);
  return rows;
}

function renderExecution(snapshot) {
  renderRuntimeStrip($("#execution-summary"), snapshot);
  const grid = $("#runtime-grid");
  clear(grid);
  const repository = snapshot.runtime?.repository ?? {};
  const currentRepository = snapshot.currentRepository ?? {};
  const changedPaths = repository.changedPaths ?? [];
  const repositoryCard = runtimeCard("Working repository", currentRepository.workingTreeState ?? "unknown", [
    ["Current HEAD", currentRepository.head ? shortHash(currentRepository.head) : "not observed"],
    ["Working tree", currentRepository.workingTreeState ?? "unknown"],
    ["Uncommitted paths", currentRepository.dirtyCount === null || currentRepository.dirtyCount === undefined ? "not observed" : `${number(currentRepository.dirtyCount)}`],
    ["Runtime probe", formatTime(snapshot.runtime?.observedAt, true)]
  ], currentRepository.workingTreeState === "clean" ? "success" : currentRepository.workingTreeState === "dirty" ? "warning" : "neutral");
  if (changedPaths.length > 0) {
    const details = element("details", { className: "changed-paths" }, [
      element("summary", { text: `Show ${changedPaths.length} changed paths` }),
      element("ul", { className: "subtle-list" }, changedPaths.map((item) => element("li", {}, [
        element("code", { text: item.state }),
        document.createTextNode(` ${item.path}`)
      ])))
    ]);
    repositoryCard.append(details);
  }
  grid.append(repositoryCard);

  for (const probe of snapshot.runtime?.probes ?? []) {
    grid.append(runtimeCard(probe.label, probe.ok ? "UP" : "DOWN", probeRows(probe), probe.ok ? "success" : "danger"));
  }

  const qualityCommands = Object.entries(snapshot.qualityCommands ?? {});
  if (qualityCommands.length > 0) {
    grid.append(runtimeCard("Declared quality commands", "read_only", qualityCommands.map(([name, command]) => [name, command]), "neutral"));
  }

  const capabilities = snapshot.snapshot.capabilities ?? {};
  grid.append(runtimeCard("View data contract", snapshot.snapshot.freshness, [
    ["Snapshot", `${snapshot.snapshot.id} / seq ${snapshot.snapshot.seq}`],
    ["Refresh", `${number(snapshot.client?.refreshIntervalMs ?? 2000)}ms ETag polling`],
    ["Write", capabilities.write ? "allowed" : "blocked"],
    ["Execution", capabilities.execution ? "allowed" : "blocked"],
    ["Approval", capabilities.approvalIntents ? "allowed" : "blocked"]
  ]));

  const execution = snapshot.execution ?? { configured: false, status: "not_configured" };
  const gap = $(".execution-gap");
  const gapTitle = $("#execution-gap-title");
  const gapCopy = $("#execution-gap-copy");
  gap.className = `empty-state execution-gap ${execution.status}`;
  if (execution.status === "unverified") {
    gapTitle.textContent = "Execution checkpoint is last-known and currently unverified";
    gapCopy.textContent = `The latest projection failed. Last-known status was ${execution.lastKnownStatus ?? "unknown"}; progress and completion are not currently verified.`;
  } else if (!execution.configured) {
    gapTitle.textContent = "Execution checkpoint is not configured";
    gapCopy.textContent = execution.message ?? "No checkpoint, next action, verification receipt, or budget source is configured. The View does not infer progress.";
  } else if (execution.status === "degraded") {
    gapTitle.textContent = "Execution checkpoint source is degraded";
    gapCopy.textContent = execution.error ?? "The configured source could not be read. Progress is not inferred.";
  } else {
    gapTitle.textContent = `Execution checkpoint observed${execution.checkpointId ? ` · ${execution.checkpointId}` : ""}`;
    gapCopy.textContent = [
      execution.lifecycleStatus ? `lifecycle ${execution.lifecycleStatus}` : null,
      execution.loopState ? `loop ${execution.loopState}` : null,
      execution.nextActor ? `next actor ${execution.nextActor}` : null,
      execution.nextAction ? `next action ${execution.nextAction}` : null
    ].filter(Boolean).join(" · ") || "The source is readable but does not declare lifecycle, loop, or next-action fields.";
  }
}

function renderEvidenceFilters(groups) {
  const container = $("#evidence-filters");
  clear(container);
  const definitions = [
    ["all", "전체"],
    ["unverified", "현재 미검증"],
    ["current", "현재 일치"],
    ["changed", "변경"],
    ["missing", "누락"],
    ["invalid", "경계 위반"]
  ];
  for (const [value, label] of definitions) {
    const count = value === "all" ? groups.length : groups.filter((group) => group.state === value).length;
    const button = element("button", {
      id: `evidence-filter-${value}`,
      className: `filter-button${state.evidenceFilter === value ? " active" : ""}`,
      text: `${label} ${count}`,
      attrs: { type: "button", "aria-pressed": state.evidenceFilter === value ? "true" : "false" }
    });
    button.addEventListener("click", () => {
      state.evidenceFilter = value;
      renderEvidence(state.snapshot);
      const refreshed = [...$("#evidence-filters").children][definitions.findIndex(([candidate]) => candidate === value)];
      refreshed?.focus();
    });
    container.append(button);
  }
}

function renderEvidence(snapshot) {
  const groups = buildEvidenceGroups(snapshot.policies, snapshot.guidelines);
  const allRefs = [...snapshot.policies, ...snapshot.guidelines].flatMap((item) => item.sourceRefs ?? []);
  const issueCount = allRefs.filter((ref) => ref.state !== "current").length;
  renderMetricSet($("#evidence-summary"), [
    ["근거 참조", number(allRefs.length)],
    ["고유 경로", number(groups.length)],
    ["현재 일치", number(allRefs.length - issueCount)],
    ["재검토", number(issueCount)]
  ], "compact-metric");
  renderEvidenceFilters(groups);

  const filtered = filterEvidence(groups, state.evidenceQuery, state.evidenceFilter);
  $("#evidence-result-count").textContent = `${number(filtered.length)}개 경로`;
  const body = $("#evidence-table-body");
  clear(body);
  if (filtered.length === 0) {
    const row = element("tr");
    row.append(element("td", { attrs: { colspan: "5" } }, [$("#empty-template").content.cloneNode(true)]));
    body.append(row);
  }
  for (const group of filtered) {
    body.append(element("tr", { className: "data-row" }, [
      element("td", {}, [element("span", { className: "source-path", text: group.path })]),
      element("td", {}, [
        element("ul", { className: "subtle-list" }, [
          ...group.evidenceKinds.map((value) => element("li", { text: labels[value] ?? value })),
          ...group.locations.slice(0, 3).map((value) => element("li", { text: value }))
        ])
      ]),
      element("td", {}, [element("div", { className: "linked-refs" }, group.relatedItems.map((ref) => element("code", { text: ref })))]),
      element("td", {}, [
        element("span", { className: "hash", text: `base ${shortHash(group.capturedRevisions[0])}` }),
        element("span", { className: "hash", text: `captured ${shortHash(group.capturedHashes[0])}` }),
        element("span", { className: "hash", text: `current ${shortHash(group.currentHashes[0])}` })
      ]),
      element("td", {}, [statusLabel(group.state)])
    ]));
  }

  const fence = snapshot.snapshot.sourceFence ?? {};
  const migrationFence = snapshot.migrationFence ?? {};
  const currentRepository = snapshot.currentRepository ?? {};
  const values = [
    ["Governance catalog", fence.governanceCatalog ?? "-"],
    ["Captured base", shortHash(migrationFence.capturedRepository?.baseCommit)],
    ["Migration fence", `${migrationFence.state ?? "unknown"} · ${migrationFence.reason ?? "not observed"}`],
    ["Current HEAD", shortHash(currentRepository.head)],
    ["HEAD advanced", migrationFence.currentHeadAdvanced ? "yes · evidence hashes remain independent" : "no"],
    ["Source evidence", fence.sourceEvidenceState ?? "unknown"],
    ["Semantic hash", shortHash(snapshot.snapshot.semanticHash)],
    ["Snapshot", `${snapshot.snapshot.id} / seq ${snapshot.snapshot.seq}`],
    ["생성 시각", formatTime(snapshot.snapshot.generatedAt, true)],
    ["현재 근거", number(fence.evidenceCurrent)],
    ["변경 근거", number(fence.evidenceChanged)],
    ["누락 근거", number(fence.evidenceMissing)],
    ["쓰기 권한", snapshot.snapshot.capabilities?.write ? "허용" : "없음"],
    ["실행 권한", snapshot.snapshot.capabilities?.execution ? "허용" : "없음"]
  ];
  const list = $("#source-fence-list");
  clear(list);
  for (const [label, value] of values) list.append(element("dt", { text: label }), element("dd", { text: value }));
}

function render(snapshot) {
  const focusedId = document.activeElement?.id || null;
  state.snapshot = snapshot;
  renderChrome(snapshot);
  renderOverview(snapshot);
  renderPolicies(snapshot);
  renderReview(snapshot);
  renderExecution(snapshot);
  renderEvidence(snapshot);
  if (focusedId && document.activeElement === document.body) {
    document.getElementById(focusedId)?.focus({ preventScroll: true });
  }
}

function setConnection(connected, message) {
  const target = $("#live-state");
  target.className = `connection-state ${connected ? "connected" : "disconnected"}`;
  target.textContent = message;
}

function schedulePolling(intervalMs = state.pollIntervalMs) {
  const resolved = Math.max(1000, Number(intervalMs) || 2000);
  if (state.pollTimer && state.pollIntervalMs === resolved) return;
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollIntervalMs = resolved;
  state.pollTimer = setInterval(() => void loadSnapshot(), resolved);
}

async function loadSnapshot(force = false) {
  const headers = { Accept: "application/json" };
  if (state.etag && !force) headers["If-None-Match"] = state.etag;
  try {
    const response = await fetch("/api/v1/snapshot", { headers, cache: "no-store" });
    if (response.status === 304) {
      setConnection(true, "자동 갱신 중");
      return;
    }
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    state.etag = response.headers.get("ETag");
    const snapshot = await response.json();
    render(snapshot);
    setConnection(true, "자동 갱신 중");
    schedulePolling(snapshot.client?.refreshIntervalMs ?? 2000);
  } catch (error) {
    setConnection(false, `연결 지연 · ${error.message}`);
    schedulePolling(state.pollIntervalMs);
  }
}

function setupControls() {
  $("#policy-search").addEventListener("input", (event) => {
    state.policyQuery = event.target.value.trim();
    state.policyPage = 1;
    if (state.snapshot) renderPolicyTable(state.snapshot);
  });
  $("#clear-policy-filters").addEventListener("click", () => {
    state.policyFilter = "all";
    state.policyQuery = "";
    state.policyPage = 1;
    $("#policy-search").value = "";
    if (state.snapshot) renderPolicies(state.snapshot);
    $("#policy-search").focus();
  });
  $("#policy-page-size").addEventListener("change", (event) => {
    state.policyPageSize = Number(event.target.value);
    state.policyPage = 1;
    if (state.snapshot) renderPolicyTable(state.snapshot);
  });
  $("#evidence-search").addEventListener("input", (event) => {
    state.evidenceQuery = event.target.value.trim();
    if (state.snapshot) renderEvidence(state.snapshot);
  });
  $("#refresh-button").addEventListener("click", () => void loadSnapshot(true));
  for (const trigger of $$('[data-refresh]')) trigger.addEventListener("click", () => void loadSnapshot(true));
}

setupTabs();
setupControls();
schedulePolling(2000);
void loadSnapshot(true);
