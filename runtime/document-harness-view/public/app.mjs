import {
  buildEvidenceGroups,
  filterEvidence,
  filterDomainContexts,
  filterGuidelines,
  filterInitiatives,
  filterPolicies,
  freshnessPresentation,
  governanceStatusPresentation,
  guidelineMap,
  paginate,
  policySeverity,
  reviewStats,
  runtimeSummary,
  sortAttention
} from "/view-model.mjs?v=7";

const tabNames = ["overview", "domain", "policies", "guidelines", "initiatives", "review", "execution", "evidence"];
const defaultPresentation = {
  displayName: "Board",
  locale: "en-US",
  sortLocale: "en",
  tabLabels: {
    overview: "Overview",
    domain: "Domain",
    policies: "Policies",
    guidelines: "Guidelines",
    initiatives: "Initiatives",
    review: "Review",
    execution: "Execution",
    evidence: "Evidence"
  }
};

const state = {
  snapshot: null,
  etag: null,
  presentation: defaultPresentation,
  activeTab: "policies",
  domainQuery: "",
  domainRole: "all",
  domainFilter: "all",
  policyFilter: "all",
  policyQuery: "",
  policyPage: 1,
  policyPageSize: 5,
  guidelineFilter: "all",
  guidelineQuery: "",
  guidelinePage: 1,
  guidelinePageSize: 5,
  initiativeFilter: "all",
  initiativeQuery: "",
  initiativePage: 1,
  initiativePageSize: 5,
  expandedPolicies: new Set(),
  expandedGuidelines: new Set(),
  expandedInitiatives: new Set(),
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
  "not observed": "관찰되지 않음",
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
  valid: "유효",
  clean: "변경 없음",
  dirty: "미커밋 변경",
  awaiting_human_review: "사용자 검토 대기",
  read_only: "읽기 전용",
  not_configured: "미설정",
  UP: "정상",
  DOWN: "실패",
  DEGRADED: "저하",
  NOT_CONFIGURED: "미설정",
  observed: "관찰됨",
  ready: "준비",
  running: "실행 중",
  awaiting_user: "사용자 대기",
  awaiting_external: "외부 작업 대기",
  needs_review: "검토 필요",
  stopped: "중단됨",
  succeeded: "성공",
  draft: "초안",
  active: "진행 중",
  paused: "일시 중지",
  completed: "완료",
  blocked: "막힘",
  done: "완료",
  closed: "종료",
  cancelled: "취소",
  agent: "AI 도구",
  user: "사용자",
  reviewer: "검토자",
  external: "외부 담당",
  current_head_advanced: "초기 이관 후 HEAD 변경",
  captured_base_matches_head: "초기 이관 기준과 HEAD 일치",
  captured_head_current: "초기 이관 기준과 현재 HEAD 일치",
  missing_captured_base: "초기 이관 기준 누락",
  invalid_captured_working_tree_state: "캡처한 작업 트리 상태가 유효하지 않음",
  receipt_missing_or_invalid: "영수증 누락 또는 무효",
  unresolvable_captured_base: "초기 이관 기준 확인 불가",
  critical: "긴급",
  decision: "결정 필요",
  warning: "주의",
  info: "정보",
  none: "일반",
  linked: "지침 연결",
  no_applicable_guideline: "적용 지침 없음",
  advances: "방향을 진전",
  "constrained-by": "경계를 준수",
  "exception-to": "승인 예외 적용",
  required: "필수 적용",
  recommended: "권장 적용",
  delivers: "실행 담당",
  supports: "지원",
  explores: "탐색",
  migration_candidate: "전환 후보",
  confirmed: "연결됨",
  approved_current: "사람 확인 · current",
  ai_current: "AI 위임 · current",
  "delegated-ai": "AI 위임 권위",
  "human-required": "사람 결정 필요",
  "human-confirmed": "사람 확인 권위",
  routine: "일상 변경",
  material: "중요 변경",
  strategic: "전략 변경",
  not_required: "Board 결정 불필요",
  review_requested: "검토 요청",
  "bounded-context": "업무 책임 경계",
  aggregate: "일관성 단위",
  entity: "식별 대상과 수명주기",
  "value-object": "값의 의미와 유효성",
  "business-rule": "업무 규칙",
  "state-transition": "상태 변화",
  "ubiquitous-language": "공통 업무 언어",
  scenario: "업무 시나리오",
  core: "핵심 도메인",
  supporting: "지원 도메인",
  generic: "일반 도메인",
  customer: "고객 / 도메인 전문가",
  planner: "기획자",
  architect: "설계자",
  developer: "개발자",
  qa: "QA"
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

function presentation() {
  return state.presentation ?? defaultPresentation;
}

function presentationLocale() {
  return presentation().locale || navigator.language || defaultPresentation.locale;
}

function tabLabel(tabName) {
  return presentation().tabLabels?.[tabName] ?? defaultPresentation.tabLabels[tabName] ?? tabName;
}

function formatTime(value, includeDate = false) {
  if (!value) return "기록 없음";
  try {
    return new Intl.DateTimeFormat(presentationLocale(), {
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
  return value === null || value === undefined ? "-" : new Intl.NumberFormat(presentationLocale()).format(value);
}

function toneFor(value) {
  if (["effective", "approved", "approved_current", "ai_current", "active", "completed", "enforced", "fresh", "current", "clean", "UP", "confirmed", "not_required"].includes(value)) return "success";
  if (["not_implemented", "stale", "degraded", "rejected", "missing", "invalid", "changed", "DOWN", "critical"].includes(value)) return "danger";
  if (["partially_enforced", "review_requested", "proposed", "advisory", "dirty", "warning", "unverified", "last_known_unverified"].includes(value)) return "warning";
  if (["decision"].includes(value)) return "info";
  return "neutral";
}

function statusLabel(value, tone = toneFor(value), text = labels[value] ?? value) {
  return element("span", { className: `status-label ${tone}`, text });
}

function presentationStatusLabel(value) {
  if (value === "ready") return statusLabel(value, "success", "사람 검토 완료");
  if (value === "review_requested") return statusLabel(value, "warning", "사람 설명 검토 중");
  return statusLabel(value ?? "missing", "danger", "사람용 설명 필요");
}

function localized(value, fallback = "확인 필요") {
  if (value === null || value === undefined || value === "") return fallback;
  return labels[value] ?? String(value);
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
    ["저장소", localized(summary.repositoryStatus), summary.dirtyCount === null ? "변경 수 확인 불가" : `${number(summary.dirtyCount)}개 변경`],
    ["실행 점검", `${number(summary.healthyProbes)} / ${number(summary.probeCount)}`, summary.probeCount === 0 ? "설정되지 않음" : "정상 / 전체"],
    ["점검 실패", number(summary.failedProbes), summary.failedProbes === 0 ? "관찰된 실패 없음" : "검토 필요"],
    ["초기 이관 경계", localized(snapshot.migrationFence?.state), localized(snapshot.migrationFence?.reason, "관찰되지 않음")],
    ["소스 근거", localized(snapshot.snapshot.sourceFence?.sourceEvidenceState), `${number(snapshot.snapshot.sourceFence?.evidenceCurrent)}건 일치`]
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
  state.presentation = snapshot.client?.presentation ?? defaultPresentation;
  document.documentElement.lang = presentationLocale();
  const displayName = presentation().displayName || defaultPresentation.displayName;
  $(".repository-identity strong").textContent = displayName;
  $(".repository-identity").setAttribute("aria-label", `${displayName}, current repository`);
  for (const name of tabNames) {
    const tab = $(`#tab-${name}`);
    const textNode = [...tab.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.nodeValue = name === "review" ? `${tabLabel(name)} ` : tabLabel(name);
    else tab.prepend(document.createTextNode(name === "review" ? `${tabLabel(name)} ` : tabLabel(name)));
  }
  $(".tab-bar").setAttribute("aria-label", `${displayName} main navigation`);
  $("#repository-name").textContent = snapshot.project.id;
  document.title = `${displayName} · ${snapshot.project.id}`;
  $("#last-updated").textContent = `업데이트 ${formatTime(snapshot.snapshot.generatedAt, true)}`;
  $("#review-tab-count").textContent = snapshot.summary.attentionCount;
  $("#footer-fence").textContent = `스냅샷 ${snapshot.snapshot.id} · 초기 이관 ${localized(snapshot.migrationFence?.state)} · 소스 ${localized(snapshot.snapshot.sourceFence?.sourceEvidenceState)}`;
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
  migration.textContent = snapshot.migration.status === "awaiting_human_review" ? "초기 이관 · 사용자 검토 대기" : localized(snapshot.migration.status);
  migration.className = "status-label warning";

  const unverified = snapshot.summary.state === "last_known_unverified";
  renderMetricSet($("#overview-summary"), [
    ["Bounded context", number(snapshot.summary.domainContextCount), `${number(snapshot.summary.domainApprovedCount)}개 exact-byte 승인`],
    ["정책 후보", number(snapshot.summary.policyCount), "기존 소스에서 추출"],
    ["실행 지침", number(snapshot.summary.guidelineCount), "정책 구현 방법"],
    ["추진안", number(snapshot.summary.initiativeCount), `${number(snapshot.summary.linkedProjectCount)}개 프로젝트 연결`],
    [unverified ? "현재 확인된 승인" : "승인 완료", number(snapshot.summary.approvedCount), unverified ? `마지막 확인 ${number(snapshot.summary.lastKnown?.approvedCount)}` : "결정 영수증 기준"],
    [unverified ? "현재 확인된 검토 대기" : "검토 대기", number(snapshot.summary.reviewCount), unverified ? `마지막 확인 ${number(snapshot.summary.lastKnown?.reviewCount)}` : "정책·지침 후보"],
    ...(unverified ? [["현재 미검증", number(snapshot.summary.unverifiedCount), "마지막 정상 스냅샷에서 보존"]] : []),
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

function domainReference(pathValue, label = pathValue) {
  return element("span", { className: "domain-reference" }, [
    element("strong", { text: label }),
    pathValue && label !== pathValue ? element("code", { text: pathValue }) : null
  ]);
}

function domainCountSet(context) {
  const counts = context.counts ?? {};
  return [
    ["Aggregate", counts.aggregates ?? 0],
    ["Rule", counts.rules ?? 0],
    ["Scenario", counts.scenarios ?? 0],
    ["Command", counts.commands ?? 0],
    ["Event", counts.events ?? 0]
  ];
}

function domainBulletList(items = []) {
  const list = element("ul", { className: "domain-readable-list" });
  for (const item of items) list.append(element("li", { text: item }));
  return list;
}

function domainDataTable(headers, rows) {
  const table = element("table", { className: "domain-detail-table" });
  const headerRow = element("tr");
  for (const header of headers) headerRow.append(element("th", { text: header }));
  table.append(element("thead", {}, [headerRow]));
  const body = element("tbody");
  for (const row of rows) {
    const tableRow = element("tr");
    for (const cell of row) tableRow.append(element("td", { text: cell ?? "-" }));
    body.append(tableRow);
  }
  table.append(body);
  return element("div", { className: "domain-table-scroll" }, [table]);
}

function domainDisclosure(title, children, open = false) {
  return element("details", {
    className: "domain-disclosure",
    ...(open ? { attrs: { open: "" } } : {})
  }, [
    element("summary", { text: title }),
    element("div", { className: "domain-disclosure-body" }, children)
  ]);
}

function renderDomain(snapshot) {
  const domain = snapshot.domain ?? {
    configured: false,
    status: "not_configured",
    contexts: [],
    relationships: []
  };
  const contexts = domain.contexts ?? [];
  const visibleContexts = contexts.filter((context) => context.visibleOnBoard !== false);
  const presentationMissing = contexts.length - visibleContexts.length;
  const totalRules = visibleContexts.reduce((sum, context) => sum + Number(context.counts?.rules ?? 0), 0);
  const totalScenarios = visibleContexts.reduce((sum, context) => sum + Number(context.counts?.scenarios ?? 0), 0);
  const currentAuthority = (context) => ["approved_current", "ai_current"].includes(context.validationStatus);
  renderMetricSet($("#domain-summary"), [
    ["보드에 표시", number(visibleContexts.length)],
    ["사람용 설명 필요", number(presentationMissing)],
    ["핵심 도메인", number(visibleContexts.filter((context) => context.subdomainType === "core").length)],
    ["현재 권위 모델", number(visibleContexts.filter(currentAuthority).length)],
    ["Board 결정 필요", number(visibleContexts.filter((context) => context.boardReviewStatus === "review_requested").length)],
    ["Rule / Scenario", `${number(totalRules)} / ${number(totalScenarios)}`]
  ], "compact-metric");

  const authorityState = $("#domain-authority-state");
  authorityState.className = `status-label ${domain.status === "current" ? "success" : domain.status === "degraded" ? "danger" : "warning"}`;
  authorityState.textContent = domain.status === "current"
    ? "모든 모델 exact-byte 권위 확인"
    : domain.status === "review_requested"
      ? "AI Domain Expert 종합안 검토"
      : domain.status === "degraded"
        ? "권위 / freshness 오류"
        : "DDD 모델 미설정";
  $("#domain-authority-message").textContent = domain.error
    ?? (domain.status === "current"
      ? "표시된 모든 bounded-context model은 exact human-confirmed 또는 delegated-AI receipt와 현재 bytes가 일치합니다."
      : domain.status === "review_requested"
        ? "AI Domain Expert가 중요한 의미를 사람이 읽을 최소 충분 모델링 수준으로 종합했습니다. 선택된 실제 모델과 영향·반례를 읽고 필요한 결정만 내려 주세요."
        : "Board는 도메인 모델을 만들지 않습니다. 별도의 source-backed 도메인 모델링 작업에서 docs/design에 실제 업무 모델을 작성하면 Board가 그 원문만 다시 읽어 표시합니다.");
  const authorityLinks = $("#domain-authority-links");
  clear(authorityLinks);
  if (domain.landscape?.source) authorityLinks.append(domainReference(domain.landscape.source, "Domain landscape"));
  if (domain.contextMap?.source) authorityLinks.append(domainReference(domain.contextMap.source, "Context map"));
  if (!domain.landscape?.source && !domain.contextMap?.source) {
    authorityLinks.append(element("span", { className: "muted", text: domain.sourceRoot ?? "docs/design" }));
  }

  const filtered = filterDomainContexts({
    contexts: visibleContexts,
    query: state.domainQuery,
    role: state.domainRole,
    filter: state.domainFilter
  });
  $("#domain-result-count").textContent = `업무 영역 ${number(filtered.length)}개 표시`;
  const contextList = $("#domain-context-list");
  clear(contextList);
  if (filtered.length === 0) {
    const empty = element("section", { className: "panel-card domain-empty" });
    empty.append($("#empty-template").content.cloneNode(true));
    contextList.append(empty);
  }
  for (const context of filtered) {
    const status = context.validationStatus ?? "review_requested";
    const card = element("article", { className: `panel-card domain-context-card ${toneFor(status)}` });
    card.append(element("div", { className: "domain-context-head" }, [
      element("div", {}, [
        element("p", { className: "item-id", text: context.id }),
        element("h2", { text: context.displayTitle }),
        element("p", { className: "page-description", text: context.humanSummary })
      ]),
      element("div", { className: "status-stack" }, [
        statusLabel(context.subdomainType, "neutral", localized(context.subdomainType)),
        context.boardReviewStatus ? statusLabel(context.boardReviewStatus, toneFor(context.boardReviewStatus), localized(context.boardReviewStatus)) : null,
        presentationStatusLabel(context.presentationStatus),
        statusLabel(status, toneFor(status), localized(status))
      ])
    ]));

    const boardReview = context.boardReview ?? {};
    const boardModel = context.boardModel ?? { columns: [], rows: [] };
    if (boardReview.recommendation || boardModel.rows.length > 0) {
      const expertReview = element("div", { className: "domain-card-section domain-human-summary" }, [
        element("p", { className: "eyebrow", text: "AI DOMAIN EXPERT 종합안" }),
        element("h3", { text: "사람이 판단할 도메인 모델" })
      ]);
      const expertFacts = element("dl", { className: "domain-facts domain-human-facts" });
      const expertFactValues = [
        ["권고", boardReview.recommendation],
        ["선택한 모델링 수준", localized(context.boardReviewLevel ?? boardReview.level)],
        ["이 수준을 선택한 이유", boardReview.levelReason],
        ["사람이 확인할 핵심", boardReview.humanDecision],
        ["승인하면 보호되는 결과", boardReview.protectedOutcome],
        ["반대하거나 수정해야 하는 조건", boardReview.counterCondition]
      ];
      for (const [label, value] of expertFactValues) {
        if (value) expertFacts.append(element("dt", { text: label }), element("dd", { text: value }));
      }
      expertReview.append(expertFacts);
      if (boardModel.rows.length > 0) {
        expertReview.append(element("h4", { text: `${localized(context.boardReviewLevel)} 모델` }));
        expertReview.append(domainDataTable(boardModel.columns, boardModel.rows));
      }
      card.append(expertReview);
    }

    const humanReview = element("div", { className: "domain-card-section domain-human-summary" }, [
      element("h3", { text: "이 업무 영역을 읽는 데 필요한 설명" })
    ]);
    const humanFacts = element("dl", { className: "domain-facts domain-human-facts" });
    const humanFactValues = [
      ["책임", context.responsibility],
      ["포함하지 않는 것", context.outOfScope],
      ["사용자에게 보이는 실패", context.userVisibleFailure],
      ["아직 결정할 것", context.pendingDecision]
    ];
    for (const [label, value] of humanFactValues) {
      if (value) humanFacts.append(element("dt", { text: label }), element("dd", { text: value }));
    }
    humanReview.append(humanFacts);
    card.append(humanReview);

    if (context.purpose) {
      card.append(element("div", { className: "domain-card-section domain-purpose" }, [
        element("h3", { text: "이 영역이 만드는 결과" }),
        ...String(context.purpose).split("\n\n").map((paragraph) => element("p", { text: paragraph }))
      ]));
    }

    const languageAndRules = [];
    if ((context.terms ?? []).length > 0) {
      languageAndRules.push(element("h4", { text: "같은 뜻으로 사용해야 할 용어" }));
      languageAndRules.push(domainDataTable(
        ["용어", "이 영역에서의 뜻", "올바른 예", "잘못된 예 / 피할 말", "추적 ID"],
        context.terms.map((item) => [
          item.term,
          item.meaning,
          item.examples,
          [item.counterexamples, item.avoid].filter(Boolean).join(" / "),
          item.id
        ])
      ));
    }
    if ((context.businessRules ?? []).length > 0) {
      languageAndRules.push(element("h4", { text: "반드시 지켜야 할 업무 규칙" }));
      languageAndRules.push(domainDataTable(
        ["규칙", "업무 의미"],
        context.businessRules.map((item) => [item.id, item.text])
      ));
    }
    if (languageAndRules.length > 0) card.append(domainDisclosure("핵심 용어와 업무 규칙", languageAndRules, true));

    const examplesAndFailures = [];
    if ((context.scenarios ?? []).length > 0) {
      examplesAndFailures.push(element("h4", { text: "정상·거절·장애 상황에서 기대하는 결과" }));
      examplesAndFailures.push(domainDataTable(
        ["누가 / 원하는 결과", "어떤 상황에서", "무엇을 요청하고", "어떤 결과를 보는가", "추적"],
        context.scenarios.map((item) => [item.actorGoal, item.given, item.request, item.outcome, item.id])
      ));
    }
    if ((context.counterexamples ?? []).length > 0) {
      examplesAndFailures.push(element("h4", { text: "이렇게 동작하면 안 됩니다" }));
      examplesAndFailures.push(domainBulletList(context.counterexamples));
    }
    if ((context.failureSemantics ?? []).length > 0) {
      examplesAndFailures.push(element("h4", { text: "실패를 해석하는 기준" }));
      examplesAndFailures.push(domainBulletList(context.failureSemantics));
    }
    if (examplesAndFailures.length > 0) card.append(domainDisclosure("업무 시나리오와 실패 기준", examplesAndFailures, true));

    const counts = element("div", { className: "domain-counts" });
    for (const [label, value] of domainCountSet(context)) counts.append(metric(label, number(value), null, "domain-count"));
    card.append(counts);

    const facts = element("dl", { className: "domain-facts" });
    const factValues = [
      ["기술 이름", context.name],
      ["모델 revision", context.modelRevision],
      ["Owner", context.owner],
      ["AI Domain Expert", context.domainExpertAgent ?? "확인 필요"],
      ["권위 방식", localized(context.authorityMode)],
      ["결정 등급", localized(context.decisionTier)],
      ["업무 근거 역할", (context.domainExpertRoles ?? []).join(", ") || "확인 필요"],
      ["권위 확인 주체", context.validatedBy ?? "결정 대기"],
      ["확인 시각", context.validatedAt ? formatTime(context.validatedAt, true) : "기록 없음"]
    ];
    for (const [label, value] of factValues) facts.append(element("dt", { text: label }), element("dd", { text: value ?? "-" }));
    card.append(facts);

    const roleSection = element("div", { className: "domain-card-section" }, [
      element("h3", { text: "역할 관점" })
    ]);
    const roleList = element("div", { className: "domain-role-list" });
    for (const role of context.roleViews ?? []) roleList.append(statusLabel(role, "info", localized(role)));
    roleSection.append(roleList);
    card.append(roleSection);

    const boundaryAndDecision = [];
    if ((context.boundaries ?? []).length > 0) {
      boundaryAndDecision.push(element("h4", { text: "업무 경계" }));
      boundaryAndDecision.push(domainBulletList(context.boundaries));
    }
    if ((context.integrations ?? []).length > 0) {
      boundaryAndDecision.push(element("h4", { text: "다른 업무 영역과 주고받는 것" }));
      boundaryAndDecision.push(domainBulletList(context.integrations));
    }
    if ((context.decisions ?? []).length > 0) {
      boundaryAndDecision.push(element("h4", { text: "현재 설계 후보에서 결정한 것" }));
      boundaryAndDecision.push(domainBulletList(context.decisions));
    }
    if ((context.stateTransitions ?? []).length > 0) {
      boundaryAndDecision.push(element("h4", { text: "상태 변화" }));
      boundaryAndDecision.push(domainDataTable(
        ["대상", "현재 상태", "요청", "조건", "다음 상태", "기록되는 사건", "거절"],
        context.stateTransitions.map((item) => [item.model, item.current, item.command, item.guard, item.next, item.event, item.rejection])
      ));
    }
    if ((context.roleContracts ?? []).length > 0) {
      const relevantRoleContracts = state.domainRole === "all"
        ? context.roleContracts
        : context.roleContracts.filter((item) => item.role === state.domainRole);
      boundaryAndDecision.push(element("h4", { text: state.domainRole === "all" ? "역할별로 확인할 내용" : `${localized(state.domainRole)}가 확인할 내용` }));
      boundaryAndDecision.push(domainDataTable(
        ["역할", "이 모델로 판단할 내용"],
        relevantRoleContracts.map((item) => [localized(item.role), item.decision])
      ));
    }
    if (boundaryAndDecision.length > 0) card.append(domainDisclosure("업무 경계·상태 변화·역할별 검토", boundaryAndDecision));

    const referenceSection = element("div", { className: "domain-card-section" }, [
      element("h3", { text: "공통 source set" })
    ]);
    const references = element("div", { className: "reference-list" });
    references.append(domainReference(context.modelRef, "Domain model"));
    if (context.languageRef) references.append(domainReference(context.languageRef, "Ubiquitous language"));
    if (context.examplesRef) references.append(domainReference(context.examplesRef, "Executable examples"));
    if (context.validationRef) references.append(domainReference(context.validationRef, "Authority receipt"));
    if (context.boardDecisionRef) references.append(domainReference(context.boardDecisionRef, "Board decision receipt"));
    referenceSection.append(references);
    card.append(referenceSection);

    if ((context.openQuestions ?? []).length > 0 || context.validationError || context.boardReviewError) {
      const unknowns = element("div", { className: "domain-card-section domain-open-questions" }, [
        element("h3", { text: "미결정 / 검토 항목" })
      ]);
      const list = element("ul");
      if (context.validationError) list.append(element("li", { text: context.validationError }));
      if (context.boardReviewError) list.append(element("li", { text: context.boardReviewError }));
      for (const item of context.openQuestions ?? []) list.append(element("li", { text: item }));
      unknowns.append(list);
      card.append(unknowns);
    }
    contextList.append(card);
  }

  const mapBody = $("#domain-map-body");
  clear(mapBody);
  const visibleRelationships = (domain.relationships ?? []).filter((relation) => relation.visibleOnBoard !== false);
  if (visibleRelationships.length === 0) {
    const row = element("tr");
    row.append(element("td", { attrs: { colspan: "5" } }, [$("#empty-template").content.cloneNode(true)]));
    mapBody.append(row);
  }
  for (const relation of visibleRelationships) {
    mapBody.append(element("tr", {}, [
      element("td", {}, [
        element("strong", { text: relation.upstreamDisplayTitle }),
        element("code", { text: relation.upstream })
      ]),
      element("td", {}, [
        element("strong", { text: relation.downstreamDisplayTitle }),
        element("code", { text: relation.downstream })
      ]),
      element("td", { text: relation.humanMeaning }),
      element("td", { text: relation.failureOwner }),
      element("td", {}, [
        element("span", { text: relation.pattern ?? "-" }),
        element("small", { text: `${relation.contract ?? "-"} · ${relation.consistency ?? "-"}` })
      ])
    ]));
  }
}

function policyFilterCount(snapshot, filter) {
  return filterPolicies({
    policies: snapshot.policies,
    guidelines: snapshot.guidelines,
    attention: snapshot.attention,
    filter
  }).length;
}

function guidelineFilterCount(snapshot, filter) {
  return filterGuidelines({
    guidelines: snapshot.guidelines,
    policies: snapshot.policies,
    attention: snapshot.attention,
    filter
  }).length;
}

const governanceFilterDefinitions = [
  ["all", "전체"],
  ["critical", "긴급"],
  ["attention", "검토 연결"],
  ["unreviewed", "승인 필요"],
  ["unverified", "현재 미검증"],
  ["enforced", "강제"],
  ["stale", "근거 변경"]
];

function renderPolicyFilters(snapshot) {
  const filters = $("#policy-filters");
  clear(filters);
  for (const [value, label] of governanceFilterDefinitions) {
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
      const refreshed = [...$("#policy-filters").children][governanceFilterDefinitions.findIndex(([candidate]) => candidate === value)];
      refreshed?.focus();
    });
    filters.append(button);
  }
}

function renderGuidelineFilters(snapshot) {
  const filters = $("#guideline-filters");
  clear(filters);
  for (const [value, label] of governanceFilterDefinitions) {
    const button = element("button", {
      id: `guideline-filter-${value}`,
      className: `filter-button${state.guidelineFilter === value ? " active" : ""}`,
      text: `${label} ${guidelineFilterCount(snapshot, value)}`,
      attrs: { type: "button", "aria-pressed": state.guidelineFilter === value ? "true" : "false" }
    });
    button.addEventListener("click", () => {
      state.guidelineFilter = value;
      state.guidelinePage = 1;
      renderPolicies(snapshot);
      const refreshed = [...$("#guideline-filters").children][governanceFilterDefinitions.findIndex(([candidate]) => candidate === value)];
      refreshed?.focus();
    });
    filters.append(button);
  }
}

const initiativeFilterDefinitions = [
  ["all", "전체"],
  ["active", "진행"],
  ["draft", "초안"],
  ["review", "승인 필요"],
  ["guideline_review", "지침 검토"],
  ["no_projects", "프로젝트 없음"],
  ["stale", "근거 변경"]
];

function initiativeFilterCount(snapshot, filter) {
  return filterInitiatives({
    initiatives: snapshot.initiatives,
    policies: snapshot.policies,
    guidelines: snapshot.guidelines,
    attention: snapshot.attention,
    filter
  }).length;
}

function renderInitiativeFilters(snapshot) {
  const filters = $("#initiative-filters");
  clear(filters);
  for (const [value, label] of initiativeFilterDefinitions) {
    const button = element("button", {
      id: `initiative-filter-${value}`,
      className: `filter-button${state.initiativeFilter === value ? " active" : ""}`,
      text: `${label} ${initiativeFilterCount(snapshot, value)}`,
      attrs: { type: "button", "aria-pressed": state.initiativeFilter === value ? "true" : "false" }
    });
    button.addEventListener("click", () => {
      state.initiativeFilter = value;
      state.initiativePage = 1;
      renderInitiatives(snapshot);
      const refreshed = [...$("#initiative-filters").children][initiativeFilterDefinitions.findIndex(([candidate]) => candidate === value)];
      refreshed?.focus();
    });
    filters.append(button);
  }
}

function governanceRiskLabel(item, snapshot) {
  const severity = policySeverity(item.id, snapshot.attention);
  if (severity !== "none") return severityLabel(severity);
  if (item.risk) return statusLabel("warning", "warning", "주의");
  return statusLabel("none", "neutral", "일반");
}

function linkedGuideList(policy, snapshot) {
  return guidelineMap(snapshot.guidelines).get(policy.id) ?? [];
}

function linkedPolicyList(guideline, snapshot) {
  const policies = new Map(
    snapshot.policies.filter((policy) => policy.visibleOnBoard !== false).map((policy) => [policy.id, policy])
  );
  return (guideline.policyRefs ?? []).map((policyRef) => policies.get(policyRef)).filter(Boolean);
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
      element("li", { text: "승인·수정·보류 결정은 별도 결정 영수증으로 남깁니다." })
    ])
  ]);
  return element("div", { className: "policy-detail" }, [statement, guides, evidence, review]);
}

function guidelineDetail(guideline, linkedPolicies) {
  const statement = element("div", { className: "detail-column" }, [
    element("span", { className: "detail-label", text: "지침 내용과 적용" }),
    element("p", { text: guideline.humanSummary }),
    guideline.why ? element("p", { text: `왜 필요한가 · ${guideline.why}` }) : null,
    guideline.scope ? element("p", { text: `적용 범위 · ${guideline.scope}` }) : null,
    guideline.risk ? element("p", { className: "risk-copy", text: `알려진 위험 · ${guideline.risk}` }) : null
  ]);

  const policies = element("div", { className: "detail-column" }, [
    element("span", { className: "detail-label", text: `연결된 정책 ${linkedPolicies.length}개` })
  ]);
  if (linkedPolicies.length === 0) policies.append(element("p", { text: "연결된 정책이 없습니다. 적용 범위를 사람과 확인해야 합니다." }));
  else {
    const list = element("ul");
    for (const policy of linkedPolicies) {
      list.append(element("li", {}, [
        element("code", { text: policy.id }),
        document.createTextNode(` ${policy.title} · ${policy.humanSummary}`)
      ]));
    }
    policies.append(list);
  }

  const sourceRefs = guideline.sourceRefs ?? [];
  const evidence = element("div", { className: "detail-column" }, [
    element("span", { className: "detail-label", text: `증거와 출처 ${sourceRefs.length}건` })
  ]);
  const evidenceList = element("ul");
  for (const ref of sourceRefs) {
    evidenceList.append(element("li", {}, [
      element("code", { text: sourceLocation(ref) }),
      document.createTextNode(` · ${sourceStateText(ref)}`)
    ]));
  }
  if (sourceRefs.length === 0) evidenceList.append(element("li", { text: "연결된 근거가 없습니다." }));
  evidence.append(evidenceList);

  const review = element("div", { className: "detail-column" }, [
    element("span", { className: "detail-label", text: "다음 사람 검토 단계" }),
    element("ol", {}, [
      element("li", { text: "지침 문장과 적용 범위를 확인합니다." }),
      element("li", { text: "연결된 정책을 실제로 구현하는지 검토합니다." }),
      element("li", { text: "근거 최신성과 강제 수준을 확인합니다." }),
      element("li", { text: "수정·승인·보류 결정은 AI 도구와 논의한 뒤 별도 결정 영수증으로 남깁니다." })
    ])
  ]);
  return element("div", { className: "policy-detail guideline-detail" }, [statement, policies, evidence, review]);
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
  $("#policy-result-count").textContent = `정책 ${number(page.total)}개 · ${number(page.start)}–${number(page.end)} 표시`;

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
        element("span", { className: "policy-summary", text: policy.humanSummary }),
        presentationStatusLabel(policy.presentationStatus)
      ]),
      element("td", {}, [
        element("div", { className: "linked-refs" }, linkedGuides.length
          ? linkedGuides.map((guide) => element("code", { text: guide.id }))
          : [element("span", { text: "연결 없음" })])
      ]),
      element("td", {}, [governanceRiskLabel(policy, snapshot)]),
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

function renderGuidelineTable(snapshot) {
  const body = $("#guideline-table-body");
  clear(body);
  const filtered = filterGuidelines({
    guidelines: snapshot.guidelines,
    policies: snapshot.policies,
    attention: snapshot.attention,
    query: state.guidelineQuery,
    filter: state.guidelineFilter
  });
  const page = paginate(filtered, state.guidelinePage, state.guidelinePageSize);
  state.guidelinePage = page.page;
  $("#guideline-result-count").textContent = `지침 ${number(page.total)}개 · ${number(page.start)}–${number(page.end)} 표시`;

  if (page.items.length === 0) {
    const row = element("tr");
    const empty = element("div", { className: "empty-state governance-empty" }, [
      element("strong", { text: "표시할 지침이 없습니다." }),
      element("p", { text: "검색·필터를 초기화하거나 AI 도구와 함께 정책을 구현할 지침 후보를 검토해 주세요." })
    ]);
    row.append(element("td", { attrs: { colspan: "8" } }, [empty]));
    body.append(row);
  }

  for (const guideline of page.items) {
    const linkedPolicies = linkedPolicyList(guideline, snapshot);
    const expanded = state.expandedGuidelines.has(guideline.id);
    const trigger = element("button", {
      id: `guideline-toggle-${guideline.id}`,
      className: "row-toggle",
      text: expanded ? "닫기" : "열기",
      attrs: {
        type: "button",
        "aria-expanded": expanded ? "true" : "false",
        "aria-controls": `guideline-details-${guideline.id}`,
        "aria-label": `${guideline.id} 지침 상세 ${expanded ? "닫기" : "열기"}`
      }
    });
    trigger.addEventListener("click", () => {
      if (expanded) state.expandedGuidelines.delete(guideline.id);
      else state.expandedGuidelines.add(guideline.id);
      renderGuidelineTable(snapshot);
      $(`#guideline-toggle-${guideline.id}`)?.focus();
    });

    const sourceRefs = guideline.sourceRefs ?? [];
    const row = element("tr", { className: "data-row guideline-row" }, [
      element("td", {}, [trigger]),
      element("td", {}, [element("span", { className: "item-id", text: guideline.id })]),
      element("td", {}, [
        element("span", { className: "policy-title", text: guideline.title }),
        element("span", { className: "policy-summary", text: guideline.humanSummary }),
        presentationStatusLabel(guideline.presentationStatus)
      ]),
      element("td", {}, [
        element("div", { className: "linked-refs" }, (linkedPolicies.length
          ? linkedPolicies.map((policy) => element("code", { text: policy.id }))
          : [element("span", { text: "연결 없음" })]))
      ]),
      element("td", {}, [governanceRiskLabel(guideline, snapshot)]),
      element("td", {}, [governanceStatusLabel(guideline, "enforcement")]),
      element("td", {}, [governanceStatusLabel(guideline, "approvalState")]),
      element("td", {}, [governanceStatusLabel(guideline, "evidenceState", ` · ${sourceRefs.length}`)])
    ]);
    body.append(row);

    if (expanded) {
      const detailsRow = element("tr", { className: "details-row", id: `guideline-details-${guideline.id}` });
      detailsRow.append(element("td", { attrs: { colspan: "8" } }, [guidelineDetail(guideline, linkedPolicies)]));
      body.append(detailsRow);
    }
  }

  renderGuidelinePagination(page, snapshot);
}

function initiativeLifecycleLabel(initiative) {
  if (initiative.projectionState === "last_known_unverified") {
    return statusLabel("unverified", "warning", `마지막 ${localized(initiative.lastKnown?.lifecycleState, "기록 없음")} · 현재 미검증`);
  }
  return statusLabel(initiative.lifecycleState, toneFor(initiative.lifecycleState), localized(initiative.lifecycleState));
}

function guidelineDispositionText(value) {
  if (value === "needs_review") return "지침 검토 필요";
  if (value === "linked") return "지침 연결";
  if (value === "no_applicable_guideline") return "적용 지침 없음";
  return localized(value);
}

function initiativeLinkedItems(initiative, snapshot) {
  const policies = new Map(
    snapshot.policies.filter((item) => item.visibleOnBoard !== false).map((item) => [item.id, item])
  );
  const guidelines = new Map(
    snapshot.guidelines.filter((item) => item.visibleOnBoard !== false).map((item) => [item.id, item])
  );
  const policyRelationships = new Map((initiative.policyRelationships ?? []).map((item) => [item.policyId, item]));
  const guidelineRelationships = new Map((initiative.guidelineRelationships ?? []).map((item) => [item.guidelineId, item]));
  return {
    policies: (initiative.policyRefs ?? []).map((ref) => ({ item: policies.get(ref), relationship: policyRelationships.get(ref) })).filter(({ item }) => Boolean(item)),
    guidelines: (initiative.guidelineRefs ?? []).map((ref) => ({ item: guidelines.get(ref), relationship: guidelineRelationships.get(ref) })).filter(({ item }) => Boolean(item))
  };
}

function initiativeDetail(initiative, snapshot) {
  const linked = initiativeLinkedItems(initiative, snapshot);
  const outcome = element("div", { className: "detail-column initiative-outcome" }, [
    element("span", { className: "detail-label", text: "달성 목표와 현재 초점" }),
    element("p", { className: "initiative-outcome-copy", text: initiative.outcome }),
    element("p", { text: `지금 필요한 이유 · ${initiative.whyNow}` }),
    element("p", { text: `현재 초점 · ${initiative.currentFocus}` }),
    element("p", { text: `담당 · ${initiative.owner}` })
  ]);

  const governance = element("div", { className: "detail-column" }, [
    element("span", { className: "detail-label", text: "직접 연결한 정책과 지침" })
  ]);
  const policyList = element("ul", { className: "initiative-link-list" });
  for (const { item: policy, relationship } of linked.policies) {
    policyList.append(element("li", {}, [
      element("code", { text: policy.id }),
      document.createTextNode(` ${policy.title} · ${localized(relationship?.relation)} · ${relationship?.rationale ?? "관계 근거 확인 필요"}`),
      relationship?.exceptionRef ? element("small", { text: ` 예외 근거 · ${relationship.exceptionRef}` }) : null
    ]));
  }
  governance.append(policyList);
  if (linked.guidelines.length === 0) {
    governance.append(element("p", { text: `${guidelineDispositionText(initiative.guidelineDisposition)} · ${initiative.guidelineDispositionReason}` }));
  } else {
    governance.append(element("p", { text: `${guidelineDispositionText(initiative.guidelineDisposition)} · ${initiative.guidelineDispositionReason}` }));
    const guideList = element("ul", { className: "initiative-link-list" });
    for (const { item: guideline, relationship } of linked.guidelines) {
      const pending = initiative.guidelineDisposition === "needs_review"
        || guideline.approvalState !== "approved"
        || guideline.authorityState !== "effective";
      guideList.append(element("li", {}, [
        element("code", { text: guideline.id }),
        document.createTextNode(` ${guideline.title} · ${pending ? "검토 중인 지침" : "현재 적용 지침"} · ${localized(relationship?.adoption)}`),
        element("small", { text: ` 이유 · ${relationship?.rationale ?? "확인 필요"} · 검증 · ${relationship?.verification ?? "확인 필요"}` })
      ]));
    }
    governance.append(guideList);
  }

  const projects = element("div", { className: "detail-column initiative-projects" }, [
    element("span", { className: "detail-label", text: `연결 프로젝트 ${initiative.projects.length}개` })
  ]);
  if (initiative.projects.length === 0) {
    projects.append(element("p", { text: "연결된 프로젝트가 없습니다. 추진안을 승인하기 전에 실행 경계를 확인해야 합니다." }));
  } else {
    const list = element("div", { className: "initiative-project-list" });
    for (const project of initiative.projects) {
      list.append(element("article", { className: "initiative-project-card" }, [
        element("div", { className: "initiative-project-heading" }, [
          element("code", { text: project.id }),
          project.status === "unverified"
            ? statusLabel("unverified", "warning", `마지막 ${localized(project.lastKnownStatus, "기록 없음")} · 현재 미검증`)
            : statusLabel(project.status, toneFor(project.status), localized(project.status))
        ]),
        element("strong", { text: project.title }),
        project.currentFocus ? element("p", { text: project.currentFocus }) : null,
        element("span", { className: "source-path", text: project.path }),
        element("small", { text: project.linkState === "unverified"
          ? `관계 · ${localized(project.relation)} · 마지막 연결 · 현재 미검증`
          : `관계 · ${localized(project.relation)} · ${project.linkState === "legacy_candidate" ? "전환 후보 연결" : project.lineageContract === "v2" ? "새 계보 계약" : "기존 계보 호환"}` })
      ]));
    }
    projects.append(list);
  }

  const evidence = element("div", { className: "detail-column initiative-evidence" }, [
    element("span", { className: "detail-label", text: "성공 신호·위험·근거" })
  ]);
  const success = element("ul");
  for (const signal of initiative.successSignals ?? []) success.append(element("li", { text: `성공 신호 · ${signal}` }));
  for (const risk of initiative.risks ?? []) success.append(element("li", { className: "risk-copy", text: `위험 · ${risk}` }));
  for (const ref of initiative.sourceRefs ?? []) {
    success.append(element("li", {}, [
      element("code", { text: sourceLocation(ref) }),
      document.createTextNode(` · ${sourceStateText(ref)}`)
    ]));
  }
  evidence.append(success);

  return element("div", { className: "policy-detail initiative-detail" }, [outcome, governance, projects, evidence]);
}

function renderInitiativeTable(snapshot) {
  const body = $("#initiative-table-body");
  clear(body);
  const filtered = filterInitiatives({
    initiatives: snapshot.initiatives,
    policies: snapshot.policies,
    guidelines: snapshot.guidelines,
    attention: snapshot.attention,
    query: state.initiativeQuery,
    filter: state.initiativeFilter
  });
  const page = paginate(filtered, state.initiativePage, state.initiativePageSize);
  state.initiativePage = page.page;
  $("#initiative-result-count").textContent = `추진안 ${number(page.total)}개 · ${number(page.start)}–${number(page.end)} 표시`;

  if (page.items.length === 0) {
    const row = element("tr");
    row.append(element("td", { attrs: { colspan: "9" } }, [
      element("div", { className: "empty-state governance-empty" }, [
        element("strong", { text: "표시할 추진안이 없습니다." }),
        element("p", { text: "검색·필터를 초기화하거나 AI 도구와 함께 정책과 프로젝트 사이의 추진 경계를 정리해 주세요." })
      ])
    ]));
    body.append(row);
  }

  for (const initiative of page.items) {
    const linked = initiativeLinkedItems(initiative, snapshot);
    const expanded = state.expandedInitiatives.has(initiative.id);
    const trigger = element("button", {
      id: `initiative-toggle-${initiative.id}`,
      className: "row-toggle",
      text: expanded ? "닫기" : "열기",
      attrs: {
        type: "button",
        "aria-expanded": expanded ? "true" : "false",
        "aria-controls": `initiative-details-${initiative.id}`,
        "aria-label": `${initiative.id} 추진안 상세 ${expanded ? "닫기" : "열기"}`
      }
    });
    trigger.addEventListener("click", () => {
      if (expanded) state.expandedInitiatives.delete(initiative.id);
      else state.expandedInitiatives.add(initiative.id);
      renderInitiativeTable(snapshot);
      $(`#initiative-toggle-${initiative.id}`)?.focus();
    });
    const guidelineNeedsReview = initiative.guidelineDisposition === "needs_review"
      || linked.guidelines.some(({ item }) => item.approvalState !== "approved" || item.authorityState !== "effective");
    body.append(element("tr", { className: "data-row initiative-row" }, [
      element("td", {}, [trigger]),
      element("td", {}, [element("span", { className: "item-id", text: initiative.id })]),
      element("td", {}, [
        element("span", { className: "policy-title", text: initiative.title }),
        element("span", { className: "policy-summary", text: initiative.humanSummary }),
        presentationStatusLabel(initiative.presentationStatus)
      ]),
      element("td", {}, [initiativeLifecycleLabel(initiative)]),
      element("td", {}, [element("div", { className: "linked-refs" }, linked.policies.map(({ item, relationship }) => element("span", { className: "linked-ref-relationship" }, [
        element("code", { text: item.id }),
        element("small", { text: localized(relationship?.relation) })
      ])))]),
      element("td", {}, [
        element("div", { className: "linked-refs" }, linked.guidelines.length
          ? linked.guidelines.map(({ item, relationship }) => element("span", { className: "linked-ref-relationship" }, [
            element("code", { text: item.id }),
            element("small", { text: guidelineNeedsReview ? "검토 후보" : localized(relationship?.adoption) })
          ]))
          : [element("span", { text: guidelineDispositionText(initiative.guidelineDisposition) })]),
        guidelineNeedsReview ? statusLabel("review_requested", "warning", "지침 검토 필요") : null
      ]),
      element("td", {}, [
        element("strong", { text: `${number(initiative.projects.length)}개` }),
        initiative.projects[0] ? element("span", { className: "policy-summary", text: `${initiative.projects[0].id} · ${initiative.projects[0].title}` }) : element("span", { className: "policy-summary", text: "연결 없음" })
      ]),
      element("td", {}, [governanceStatusLabel(initiative, "approvalState")]),
      element("td", {}, [governanceStatusLabel(initiative, "evidenceState", ` · ${initiative.sourceRefs.length}`)])
    ]));
    if (expanded) {
      const detailsRow = element("tr", { className: "details-row", id: `initiative-details-${initiative.id}` });
      detailsRow.append(element("td", { attrs: { colspan: "9" } }, [initiativeDetail(initiative, snapshot)]));
      body.append(detailsRow);
    }
  }
  renderInitiativePagination(page, snapshot);
}

function renderInitiativePagination(page, snapshot) {
  const container = $("#initiative-pagination");
  clear(container);
  const summary = element("span", { text: `추진안 ${number(page.total)}개 중 ${number(page.start)}–${number(page.end)} · ${page.page}/${page.totalPages} 페이지` });
  const actions = element("div", { className: "pagination-actions" });
  const previous = element("button", { text: "이전", attrs: { type: "button", "aria-label": "이전 추진안 페이지" } });
  previous.disabled = page.page <= 1;
  previous.addEventListener("click", () => {
    state.initiativePage -= 1;
    renderInitiativeTable(snapshot);
  });
  const next = element("button", { text: "다음", attrs: { type: "button", "aria-label": "다음 추진안 페이지" } });
  next.disabled = page.page >= page.totalPages;
  next.addEventListener("click", () => {
    state.initiativePage += 1;
    renderInitiativeTable(snapshot);
  });
  actions.append(previous, next);
  container.append(summary, actions);
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

function renderGuidelinePagination(page, snapshot) {
  const container = $("#guideline-pagination");
  clear(container);
  const summary = element("span", { text: `지침 ${number(page.total)}개 중 ${number(page.start)}–${number(page.end)} · ${page.page}/${page.totalPages} 페이지` });
  const actions = element("div", { className: "pagination-actions" });
  const previous = element("button", { text: "이전", attrs: { type: "button", "aria-label": "이전 지침 페이지" } });
  previous.disabled = page.page <= 1;
  previous.addEventListener("click", () => {
    state.guidelinePage -= 1;
    renderGuidelineTable(snapshot);
  });
  const next = element("button", { text: "다음", attrs: { type: "button", "aria-label": "다음 지침 페이지" } });
  next.disabled = page.page >= page.totalPages;
  next.addEventListener("click", () => {
    state.guidelinePage += 1;
    renderGuidelineTable(snapshot);
  });
  actions.append(previous, next);
  container.append(summary, actions);
}

function renderReviewRail(snapshot, selector, relatedIds) {
  const container = $(selector);
  clear(container);
  const refs = new Set(relatedIds);
  const sorted = sortAttention(snapshot.attention).filter((item) =>
    (item.relatedRefs ?? []).some((ref) => refs.has(ref))
  );
  if (sorted.length === 0) {
    container.append(element("div", { className: "empty-state governance-empty" }, [
      element("strong", { text: "연결된 검토 항목이 없습니다." }),
      element("p", { text: "현재 항목과 직접 연결된 주의·결정 요청이 없습니다." })
    ]));
    return;
  }
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

function governanceMetrics(items, snapshot, kindLabel) {
  const unverified = snapshot.summary.state === "last_known_unverified";
  const visible = items.filter((item) => item.visibleOnBoard !== false);
  const presentationMissing = items.length - visible.length;
  const verified = visible.filter((item) => item.projectionState !== "last_known_unverified");
  const approved = verified.filter((item) => item.approvalState === "approved").length;
  const review = verified.filter((item) => item.approvalState !== "approved").length;
  const enforced = verified.filter((item) => item.enforcement === "enforced").length;
  const lastApproved = visible.filter((item) => item.lastKnown?.approvalState === "approved").length;
  const lastReview = visible.filter((item) => item.lastKnown && item.lastKnown.approvalState !== "approved").length;
  const lastEnforced = visible.filter((item) => item.lastKnown?.enforcement === "enforced").length;
  const evidenceIssues = verified.filter((item) => item.evidenceState !== "current").length;
  const unverifiedCount = visible.length - verified.length;
  return [
    [kindLabel, number(visible.length)],
    ["사람용 설명 필요", number(presentationMissing)],
    [unverified ? "현재 확인된 승인" : "승인", number(approved), unverified ? `마지막 ${number(lastApproved)}` : null],
    [unverified ? "현재 확인된 검토" : "검토 필요", number(review), unverified ? `마지막 ${number(lastReview)}` : null],
    [unverified ? "현재 확인된 강제" : "코드로 강제", number(enforced), unverified ? `마지막 ${number(lastEnforced)}` : null],
    [unverified ? "현재 미검증" : "근거 변경", number(unverified ? unverifiedCount : evidenceIssues)]
  ];
}

function renderPolicies(snapshot) {
  renderMetricSet($("#policy-summary"), governanceMetrics(snapshot.policies, snapshot, "정책"), "compact-metric");
  renderMetricSet($("#guideline-summary"), governanceMetrics(snapshot.guidelines, snapshot, "지침"), "compact-metric");
  renderPolicyFilters(snapshot);
  renderGuidelineFilters(snapshot);
  renderPolicyTable(snapshot);
  renderGuidelineTable(snapshot);
  renderReviewRail(snapshot, "#policy-review-rail-list", snapshot.policies.map((item) => item.id));
  renderReviewRail(snapshot, "#guideline-review-rail-list", snapshot.guidelines.map((item) => item.id));
  renderRuntimeStrip($("#policy-runtime-strip"), snapshot);
  renderRuntimeStrip($("#guideline-runtime-strip"), snapshot);
}

function renderInitiatives(snapshot) {
  const initiatives = snapshot.initiatives ?? [];
  const unverified = snapshot.summary.state === "last_known_unverified";
  const visible = initiatives.filter((item) => item.visibleOnBoard !== false);
  const verified = visible.filter((item) => item.projectionState !== "last_known_unverified");
  renderMetricSet($("#initiative-summary"), [
    ["추진안", number(visible.length)],
    ["사람용 설명 필요", number(initiatives.length - visible.length)],
    [unverified ? "현재 확인된 진행" : "진행 중", number(verified.filter((item) => item.lifecycleState === "active").length)],
    [unverified ? "현재 확인된 검토" : "검토 필요", number(verified.filter((item) => ["unreviewed", "review_requested"].includes(item.approvalState)).length)],
    [unverified ? "마지막 연결 프로젝트" : "연결 프로젝트", number(new Set(visible.flatMap((item) => item.projects.map((project) => project.id))).size)],
    [unverified ? "현재 미검증" : "근거 변경", number(unverified ? visible.length - verified.length : verified.filter((item) => item.evidenceState !== "current").length)]
  ], "compact-metric");
  renderInitiativeFilters(snapshot);
  renderInitiativeTable(snapshot);
  renderReviewRail(snapshot, "#initiative-review-rail-list", initiatives.map((item) => item.id));
  renderRuntimeStrip($("#initiative-runtime-strip"), snapshot);
}

function renderReviewFilters(snapshot) {
  const container = $("#review-filters");
  clear(container);
  const stats = reviewStats(snapshot.attention);
  const definitions = [
    ["all", "전체", stats.total],
    ["critical", "긴급", stats.critical],
    ["decision", "결정 필요", stats.decision],
    ["warning", "주의", stats.warning]
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
    ["긴급", number(stats.critical)],
    ["결정 필요", number(stats.decision)],
    ["주의", number(stats.warning)],
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
          : [element("span", { text: "전체 초기 이관" })]))
      ])
    ]));
  }
  $("#approval-rule").textContent = snapshot.migration.approvalRule ?? "이 화면에서는 정책을 승인하거나 수정할 수 없습니다.";
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
  if (value === null || value === undefined) return "보고되지 않음";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return `${value.length}개 항목`;
  return `${Object.keys(value).length}개 필드`;
}

function probeRows(probe) {
  const rows = Object.entries(probe.data ?? {})
    .slice(0, 3)
    .map(([name, value]) => [name, displayProbeValue(value)]);
  if (rows.length === 0) rows.push(["결과", probe.ok ? "요청 성공" : probe.error ?? "요청 실패"]);
  rows.push(["관찰 시각", formatTime(probe.observedAt, true)]);
  rows.push(["방법", "허용 목록 기반 읽기 전용 점검"]);
  return rows;
}

function renderExecution(snapshot) {
  renderRuntimeStrip($("#execution-summary"), snapshot);
  const grid = $("#runtime-grid");
  clear(grid);
  const repository = snapshot.runtime?.repository ?? {};
  const currentRepository = snapshot.currentRepository ?? {};
  const changedPaths = repository.changedPaths ?? [];
  const repositoryCard = runtimeCard("작업 저장소", currentRepository.workingTreeState ?? "unknown", [
    ["현재 HEAD", currentRepository.head ? shortHash(currentRepository.head) : "관찰되지 않음"],
    ["작업 트리", localized(currentRepository.workingTreeState)],
    ["미커밋 경로", currentRepository.dirtyCount === null || currentRepository.dirtyCount === undefined ? "관찰되지 않음" : `${number(currentRepository.dirtyCount)}`],
    ["실행 상태 관찰", formatTime(snapshot.runtime?.observedAt, true)]
  ], currentRepository.workingTreeState === "clean" ? "success" : currentRepository.workingTreeState === "dirty" ? "warning" : "neutral");
  if (changedPaths.length > 0) {
    const details = element("details", { className: "changed-paths" }, [
      element("summary", { text: `변경된 경로 ${changedPaths.length}개 보기` }),
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
    grid.append(runtimeCard("선언된 품질 명령", "read_only", qualityCommands.map(([name, command]) => [name, command]), "neutral"));
  }

  const capabilities = snapshot.snapshot.capabilities ?? {};
  grid.append(runtimeCard("화면 데이터 계약", snapshot.snapshot.freshness, [
    ["스냅샷", `${snapshot.snapshot.id} / 순번 ${snapshot.snapshot.seq}`],
    ["새로고침", `${number(snapshot.client?.refreshIntervalMs ?? 2000)}ms ETag 폴링`],
    ["쓰기", capabilities.write ? "허용" : "차단"],
    ["실행", capabilities.execution ? "허용" : "차단"],
    ["승인", capabilities.approvalIntents ? "허용" : "차단"]
  ]));

  const execution = snapshot.execution ?? { configured: false, status: "not_configured" };
  const gap = $(".execution-gap");
  const gapTitle = $("#execution-gap-title");
  const gapCopy = $("#execution-gap-copy");
  gap.className = `empty-state execution-gap ${execution.status}`;
  if (execution.status === "unverified") {
    gapTitle.textContent = "실행 체크포인트는 마지막 확인값이며 현재 미검증 상태입니다";
    gapCopy.textContent = `최신 투영에 실패했습니다. 마지막 상태는 ${localized(execution.lastKnownStatus)}이며 진행과 완료 여부는 현재 검증되지 않았습니다.`;
  } else if (!execution.configured) {
    gapTitle.textContent = "실행 체크포인트가 설정되지 않았습니다";
    gapCopy.textContent = execution.message ?? "체크포인트, 다음 행동, 검증 영수증 또는 예산 소스가 설정되지 않았습니다. 이 화면은 진행률을 추정하지 않습니다.";
  } else if (execution.status === "degraded") {
    gapTitle.textContent = "실행 체크포인트 소스가 저하 상태입니다";
    gapCopy.textContent = execution.error ?? "설정된 소스를 읽을 수 없습니다. 진행률을 추정하지 않습니다.";
  } else {
    gapTitle.textContent = `실행 체크포인트 관찰됨${execution.checkpointId ? ` · ${execution.checkpointId}` : ""}`;
    gapCopy.textContent = [
      execution.lifecycleStatus ? `수명 주기 ${localized(execution.lifecycleStatus)}` : null,
      execution.loopState ? `루프 ${localized(execution.loopState)}` : null,
      execution.nextActor ? `다음 담당 ${localized(execution.nextActor)}` : null,
      execution.nextAction ? `다음 행동 ${execution.nextAction}` : null
    ].filter(Boolean).join(" · ") || "소스는 읽을 수 있지만 수명 주기, 루프 또는 다음 행동 필드가 선언되지 않았습니다.";
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
  const groups = buildEvidenceGroups(snapshot.policies, snapshot.guidelines, snapshot.initiatives);
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
        element("span", { className: "hash", text: `기준 리비전 ${shortHash(group.capturedRevisions[0])}` }),
        element("span", { className: "hash", text: `캡처 해시 ${shortHash(group.capturedHashes[0])}` }),
        element("span", { className: "hash", text: `현재 해시 ${shortHash(group.currentHashes[0])}` })
      ]),
      element("td", {}, [statusLabel(group.state)])
    ]));
  }

  const fence = snapshot.snapshot.sourceFence ?? {};
  const migrationFence = snapshot.migrationFence ?? {};
  const currentRepository = snapshot.currentRepository ?? {};
  const values = [
    ["거버넌스 카탈로그", fence.governanceCatalog ?? "-"],
    ["추진안 레지스터", fence.initiativeRegister ?? "-"],
    ["초기 이관 기준", shortHash(migrationFence.capturedRepository?.baseCommit)],
    ["초기 이관 경계", `${localized(migrationFence.state)} · ${localized(migrationFence.reason, "관찰되지 않음")}`],
    ["현재 HEAD", shortHash(currentRepository.head)],
    ["HEAD 변경", migrationFence.currentHeadAdvanced ? "예 · 근거 해시는 독립적으로 유지" : "아니요"],
    ["소스 근거", localized(fence.sourceEvidenceState)],
    ["의미 해시", shortHash(snapshot.snapshot.semanticHash)],
    ["스냅샷", `${snapshot.snapshot.id} / 순번 ${snapshot.snapshot.seq}`],
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
  renderDomain(snapshot);
  renderPolicies(snapshot);
  renderInitiatives(snapshot);
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
  $("#domain-search").addEventListener("input", (event) => {
    state.domainQuery = event.target.value.trim();
    if (state.snapshot) renderDomain(state.snapshot);
  });
  $("#domain-role-filter").addEventListener("change", (event) => {
    state.domainRole = event.target.value;
    if (state.snapshot) renderDomain(state.snapshot);
  });
  $("#domain-status-filter").addEventListener("change", (event) => {
    state.domainFilter = event.target.value;
    if (state.snapshot) renderDomain(state.snapshot);
  });
  $("#clear-domain-filters").addEventListener("click", () => {
    state.domainQuery = "";
    state.domainRole = "all";
    state.domainFilter = "all";
    $("#domain-search").value = "";
    $("#domain-role-filter").value = "all";
    $("#domain-status-filter").value = "all";
    if (state.snapshot) renderDomain(state.snapshot);
    $("#domain-search").focus();
  });
  $("#policy-search").addEventListener("input", (event) => {
    state.policyQuery = event.target.value.trim();
    state.policyPage = 1;
    if (state.snapshot) renderPolicies(state.snapshot);
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
    if (state.snapshot) renderPolicies(state.snapshot);
  });
  $("#guideline-search").addEventListener("input", (event) => {
    state.guidelineQuery = event.target.value.trim();
    state.guidelinePage = 1;
    if (state.snapshot) renderPolicies(state.snapshot);
  });
  $("#clear-guideline-filters").addEventListener("click", () => {
    state.guidelineFilter = "all";
    state.guidelineQuery = "";
    state.guidelinePage = 1;
    $("#guideline-search").value = "";
    if (state.snapshot) renderPolicies(state.snapshot);
    $("#guideline-search").focus();
  });
  $("#guideline-page-size").addEventListener("change", (event) => {
    state.guidelinePageSize = Number(event.target.value);
    state.guidelinePage = 1;
    if (state.snapshot) renderPolicies(state.snapshot);
  });
  $("#initiative-search").addEventListener("input", (event) => {
    state.initiativeQuery = event.target.value.trim();
    state.initiativePage = 1;
    if (state.snapshot) renderInitiatives(state.snapshot);
  });
  $("#clear-initiative-filters").addEventListener("click", () => {
    state.initiativeFilter = "all";
    state.initiativeQuery = "";
    state.initiativePage = 1;
    $("#initiative-search").value = "";
    if (state.snapshot) renderInitiatives(state.snapshot);
    $("#initiative-search").focus();
  });
  $("#initiative-page-size").addEventListener("change", (event) => {
    state.initiativePageSize = Number(event.target.value);
    state.initiativePage = 1;
    if (state.snapshot) renderInitiatives(state.snapshot);
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
