---
type: design
title: human-control-view-plane
status: current
domain: human-view
owner: Codex
created: 2026-07-15
updated: 2026-07-17
retrieval_class:
  - domain-current
context:
  default_load: false
  section_load: false
  evidence_only: false
  size_tier: small
referenced_by:
  - docs/guide/human-control-view.md
related_design:
  - docs/design/execution-loop-plane.md
  - docs/design/policy-to-evidence-governance.md
related_task: []
source_refs:
  - https://html.spec.whatwg.org/multipage/server-sent-events.html
  - https://sre.google/sre-book/monitoring-distributed-systems/
  - https://www.patternfly.org/get-started/about-patternfly/
  - https://www.patternfly.org/components/tabs/design-guidelines/
  - https://www.patternfly.org/components/tabs/accessibility/
  - https://www.patternfly.org/tokens/about-tokens/
tags:
  - docs/design
  - human-control
  - projection
  - local-view
---

# human-control-view-plane

- Type: design
- Domain: human-view
- Owner: Codex
- Created: 2026-07-15
- Updated: 2026-07-17
- Referenced By:
  - `docs/guide/human-control-view.md`
- Related Design: `docs/design/execution-loop-plane.md`; `docs/design/policy-to-evidence-governance.md`

## Purpose

이 문서는 Markdown/Git에 기록된 governance, project, task, checkpoint, attention, trace와 evidence를 사용자가 빠르게 이해하도록 만드는 local read-only view의 vendor-neutral 계약을 고정합니다.

view는 실행 state machine이나 approval authority를 소유하지 않습니다. source를 읽어 immutable snapshot으로 투영하고, 출처·revision·freshness와 함께 보여주는 cockpit입니다.

## Whole-System Role

- `docs/design/control-plane.md`가 whole-system goal과 active surface를 소유합니다.
- `docs/design/policy-to-evidence-governance.md`가 human policy, proposal, effective standard와 approval authority를 소유합니다.
- `docs/design/execution-loop-plane.md`가 loop state, checkpoint, attention, receipt, stop/resume를 소유합니다.
- 이 설계는 source를 어떻게 읽고 atomic snapshot, API, SSE/polling, freshness, security와 user-facing projection으로 제공할지를 소유합니다.
- `docs/guide/human-control-view.md`는 이 계약을 사람이 운영하는 화면 구조와 playbook으로 번역합니다.

## Authority Boundary

```text
Markdown / Git authority
  project | task | policy | design | checkpoint | attention | receipt
                              │
                              ▼
                  full scan + watcher hint
                              │
                              ▼
                 validate + normalize + project
                              │
                              ▼ atomic publish
                     immutable snapshot
                       │             │
                       ▼             ▼
                    GET API     SSE notification
                       └──────┬──────┘
                              ▼
                    read-only local UI
```

- browser state, API response, cache, event buffer, search result는 derived projection입니다.
- view는 source의 goal, lifecycle status, loop state, decision, approval, evidence를 만들거나 수정하지 않습니다.
- 사용자의 답변이나 승인은 durable source/receipt에 반영되기 전까지 완료된 업무 결정이 아닙니다.
- source write가 필요하면 별도 approval broker/executor가 current source fence를 검증하고, view는 그 결과를 다시 읽습니다.

## Invariants

- cache를 삭제해도 registered source만으로 logical snapshot을 재구성할 수 있습니다.
- 하나의 response는 하나의 read fence와 snapshot generation만 포함합니다.
- watcher event 또는 SSE 연결은 freshness proof가 아닙니다.
- parse/read 실패를 source delete로 해석하지 않고 이전 valid record를 `lastKnown` 참고값으로 유지합니다. 다만 현재 approval/enforcement/evidence/execution 상태는 `unverified`로 낮추고 현재 승인·검토 count를 0으로 다시 계산해, 이전 녹색 상태를 현재 truth처럼 표시하지 않습니다.
- explicit source ref가 없는 trace edge는 `candidate`이며 authority로 표시하지 않습니다.
- lifecycle `status`와 execution `loop_state`를 함께 보여주되 합치지 않습니다.
- `succeeded`를 `done`으로, `awaiting_user`를 lifecycle `blocked`로 바꾸어 표시하지 않습니다.
- v1 view는 loopback-only, read-only이며 shell, Git write, MCP, deployment, external write capability가 없습니다.
- stale, degraded, unknown source에서는 approval 가능한 것처럼 표시하지 않습니다.

## Single-Repository Presentation Contract

각 View process는 자신을 시작한 repository 하나만 투영하는 독립 서버입니다. 이 사용자 화면의 고정 이름은 **`보드`**입니다. top bar 왼쪽에는 `보드 / <repository>`를 정적 identity로 표시하고, 스크롤 중에도 이 이름과 현재 repository context가 보이도록 상단 chrome을 고정합니다. `보드`는 product/user-facing name이며 repository별로 바꾸지 않습니다. executable, path와 내부 계약은 호환성을 위해 `human-view`와 `Human Control View`를 유지할 수 있습니다.

사용자가 다른 repository를 고르는 selector를 제공하지 않습니다. 여러 repository를 한 화면에서 aggregate하거나 전환하는 기능은 이 profile의 범위 밖입니다.

canonical presentation profile은 `single-repository-top-tabs-v2`입니다.

```text
보드 / Static repository identity | freshness | snapshot | READ ONLY | local-only

개요 | 정책 | 지침 | 추진안 | 검토 대기 | 실행 상태 | 근거
```

- 한 개의 큰 page shell과 상단 horizontal tab list를 사용합니다.
- canonical tab label과 순서는 정확히 `개요`, `정책`, `지침`, `추진안`, `검토 대기`, `실행 상태`, `근거`입니다. URL hash나 내부 tab key는 안정성을 위해 `overview|policies|guidelines|initiatives|review|execution|evidence`를 유지하며 사용자에게 보이는 label은 한국어입니다. 기존 `#policies` deep link는 정책 tab을 계속 가리킵니다.
- left sidebar, collapsible navigation rail, repository selector와 workspace switcher는 제공하지 않습니다.
- 좁은 화면에서도 tab list를 horizontal scroll 또는 overflow control로 유지하며 sidebar로 변환하지 않습니다.
- 한 시점에는 선택된 tab panel 하나만 primary content로 표시하되 `보드`, repository identity와 freshness는 모든 tab과 스크롤 위치에서 유지합니다.
- 모든 tab panel은 같은 immutable `snapshot.id`, `snapshot.seq`와 `read_fence`에서 계산해야 합니다. independently fetched detail의 fence가 다르면 current panel에 섞지 않고 full snapshot refresh 또는 stale/degraded 표시로 처리합니다.

tab별 최소 책임은 다음과 같습니다.

| Tab | Human Question | Minimum Surface |
| --- | --- | --- |
| `개요` | 이 repository는 어디로 가며 지금 무엇이 중요한가? | plain-language direction, governance/execution summary, attention count, recent verification, freshness |
| `정책` | AI가 어떤 상위 원칙과 사람의 결정을 따라야 하는가? | policy count, authority/approval/enforcement, linked guideline summary, source provenance, policy-specific search/filter/expand |
| `지침` | 각 정책을 실제 설계·구현에서 어떻게 적용하는가? | guideline count, linked policies, approval/enforcement, source provenance, guideline-specific search/filter/expand |
| `추진안` | 정책과 선택 지침을 어떤 결과와 프로젝트 경계로 전환하는가? | outcome/current focus, direct policy/guideline refs, approval/lifecycle, reverse-indexed project status/path, source provenance |
| `검토 대기` | 사람이 지금 무엇을 판단해야 하는가? | severity/order reason, exact request, risk, alternatives, source/checkpoint fence, handoff target |
| `실행 상태` | 실행 loop는 어디까지 왔고 다음 행동은 무엇인가? | lifecycle and loop state, checkpoint, hypothesis, next actor/action, budget, verification, explicit missing-data state |
| `근거` | 어떤 근거로 상태·완료·위험을 판단하는가? | source/receipt/validator groups, exact path/revision/hash, result, freshness, residual risk |

정책·지침·추진안은 같은 snapshot을 읽지만 서로 종속된 화면으로 취급하지 않습니다.

- 정책 tab은 정책을 first-class row로 보여주고 각 정책 detail에서 관련 지침을 연결합니다.
- 지침 tab은 지침을 first-class row로 보여주고 각 지침 detail에서 관련 정책을 역방향으로 연결합니다.
- 두 tab은 search, filter, pagination과 expanded row state를 독립적으로 보존합니다.
- 관련 항목이 없어도 다른 종류의 목록을 숨기지 않고 `관련 정책 없음` 또는 `관련 지침 없음`을 명시합니다.
- 추진안은 별도 `initiative-register.json`과 `I####` 문서에서 읽습니다. 정책은 WHY, 선택 지침은 HOW로 직접 연결하고 Project의 `related_initiative`를 역색인합니다.
- 추진안은 연결 Project의 상태와 현재 초점까지만 투영하며 Task 진행률을 합산하거나 실행 authority를 상속시키지 않습니다.

## Korean-First Human Projection Contract

reference profile의 기본 표시 언어는 `ko-KR`입니다. 새 repository의 initialize와 기존 repository의 migration/upgrade는 다음 규칙을 동일하게 적용합니다.

- AI가 합성하는 `direction`, `title`, `humanSummary`, `why`, `scope`, `risk`, attention/gap 문구, `approvalRule`, project description, source-reference `note`, 자유 서술 `evidenceKind` label과 화면 chrome은 사람이 바로 이해할 수 있는 한국어로 작성합니다.
- policy/guideline/attention ID, schema enum, lifecycle/loop state의 저장 값, repository-relative path, Git revision, SHA-256, command, source heading과 exact quote는 provenance와 machine contract이므로 원형을 보존합니다. 필요하면 한국어 label/summary를 옆에 제공합니다.
- 영어 source를 한국어로 설명하는 것은 derived presentation 변경입니다. 번역만으로 source 의미, authority class/state, approval state, enforcement, evidence freshness, source ref/hash, effective ref 또는 decision receipt를 바꾸거나 새 정책을 만들지 않습니다.
- 이미 영어로 생성된 project-owned catalog를 옮길 때는 stable ID와 모든 fence를 유지한 채 human-facing field만 한국어로 고치고, 사람이 의미 보존을 검토할 수 있도록 migration attention 또는 diff evidence를 남깁니다.
- 기술 ID는 제목보다 낮은 시각적 위계의 보조 metadata로 표시합니다. ID, source path와 hash처럼 긴 끊김 없는 값은 자신의 cell/container 안에서 `overflow-wrap: anywhere` 또는 동등한 방식으로 줄바꿈하고, 인접 제목·상태 cell 위로 겹치거나 page 폭을 강제로 늘리지 않습니다. 좁은 화면에서는 의미 있는 column을 우선하고 기술 metadata는 detail로 이동할 수 있습니다.

## Interaction Stability Contract

polling, SSE notification, manual refresh와 snapshot resync는 source state를 갱신하지만 사용자의 reading context를 임의로 초기화하지 않습니다.

- `activeTab`, 정책/지침을 포함한 tab별 filter, `searchQuery`, expanded row/card identity와 pagination position은 browser-local interaction state로 보존합니다.
- 새 snapshot에 같은 stable item ID가 있으면 expansion과 focus를 유지합니다.
- item이 삭제되거나 scope 밖으로 이동했을 때만 해당 local selection을 정리하고 이유를 non-blocking status로 알립니다.
- refresh 중 입력 focus를 빼앗거나 tab을 `개요`로 되돌리지 않습니다.
- URL hash를 active tab deep-link로 사용할 수 있지만 authority 또는 unread truth로 취급하지 않습니다.
- initial load 또는 unrecoverable schema change만 safe default로 reset할 수 있으며 reset 사실을 표시합니다.

정책·지침·추진안의 작성 도움말은 snapshot과 분리된 versioned reference UI contract입니다.

- 각 tab heading은 시각 크기 24 CSS px의 원형 `?` button 하나를 제공하고 accessible name, `aria-controls`, `aria-expanded`를 가집니다.
- hover는 non-modal full-viewport overlay를 열되 hit test를 가로채지 않으며 pointer가 trigger에서 나가면 닫힙니다.
- hover/focus 안내는 전체 읽기를 위해 click 또는 `Enter`로 고정해야 함을 명시합니다. focus preview가 viewport를 넘으면 방향키, Page key, Home/End로 dialog scroll을 제어합니다.
- click/touch/`Enter`는 pinned fallback입니다. pinned state만 pointer interaction과 내부 scroll을 허용하고 `aria-modal=true`, background `inert`, dialog focus containment를 적용합니다. open 시 닫기 control로, close 시 원 trigger로 focus를 이동합니다.
- `Escape`, blur, tab 전환과 명시적 닫기 동작에서 overlay와 `aria-expanded`가 함께 정리됩니다. 닫힌 overlay는 accessibility tree와 pointer hit test에서 제거합니다.
- 표시 내용은 canonical governance authoring contract의 역할·질문·승인 경계를 압축한 설명이며 repository data나 승인 상태를 생성하지 않습니다.

## Semantic Visual Contract

PatternFly의 enterprise information-density, semantic status, tab accessibility와 token model을 참고하되 public contract는 특정 UI library runtime을 요구하지 않습니다.

- raw color value가 아니라 background, text, border, focus, severity, success, warning, danger 같은 semantic token을 사용합니다.
- status와 severity는 color 하나에만 의존하지 않고 text label과 icon 또는 shape를 함께 제공합니다.
- tab은 ARIA `tablist`/`tab`/`tabpanel` 관계, visible focus, arrow key, `Home`/`End`, `Enter`/`Space` 동작을 지원합니다.
- dense table은 header, row label, pagination과 expandable detail의 relationship을 semantic markup으로 유지합니다.
- script, stylesheet, font와 icon은 same-origin local asset으로 제공합니다. external CDN, remote font, runtime third-party asset fetch는 기본 profile에서 금지합니다.
- Markdown은 allowlisted structured field로 변환하고 arbitrary HTML로 직접 render하지 않습니다.

## Projection Pipeline

1. startup에서 allowlisted source roots를 full scan합니다.
2. path normalization, symlink boundary, sensitivity/exclusion rule을 먼저 적용합니다.
3. reference v1은 watcher 없이 주기적 reconciliation을 correctness authority로 사용합니다. alternate profile의 watcher는 변경 가능성을 알리는 latency hint일 뿐입니다.
4. debounce 뒤 source bytes와 hash를 다시 읽고 schema/reference를 검증합니다.
5. governance, project, task, checkpoint, attention, receipt, evidence와 explicit trace edge를 normalized model로 만듭니다.
6. build 전후 source hash가 달라지면 generation을 폐기하고 최신 source를 다시 처리합니다.
7. 완전한 generation만 monotonic `snapshot_seq`와 함께 atomic publish합니다.
8. startup과 주기적 reconciliation이 missed event, rename, delete, orphan/stale edge를 복구합니다.
9. parse 실패 resource는 이전 valid value를 `lastKnown`으로 유지하고, 현재 상태를 `unverified`로 낮춘 뒤 error와 `degraded` freshness를 붙입니다.
10. 어느 current snapshot/read fence도 참조하지 않는 이전 cache/event만 정리합니다.

projector는 missing reference를 추론해 source에 write-back하지 않습니다.

reference projector는 governance catalog의 `approved`/`effective` 문자열을 그대로 신뢰하지 않습니다. 모든 source ref의 path, heading, line range, captured SHA-256과 captured repository revision이 완전해야 합니다. captured SHA-256은 과거 revision의 파일 전체 bytes와 일치해야 하며 decision receipt의 불변 provenance fence로 계속 사용합니다. 현재 freshness는 과거 revision에서 `lineStart..lineEnd`가 걸친 Markdown 제목 묶음을 다음 동급·상위 제목 직전까지 확장한 **인용 구간 hash**와 현재의 같은 제목 경계 구간을 비교해 판정합니다. 따라서 인용 구간 내부의 제목·내용·구조 변경은 stale이고, 같은 파일의 인용 구간 밖 변경은 `fileState: changed` 진단만 남기며 freshness를 낮추지 않습니다. 과거 제목 anchor를 만들 수 없는 legacy/non-Markdown source ref는 보수적으로 파일 전체를 비교합니다. 현재 anchor/boundary가 사라지거나 과거 파일 전체 hash가 revision bytes와 맞지 않으면 fail closed합니다. `effectiveRef`와 `decisionReceiptRef`는 private/credential 또는 symlink 경로가 아닌 repository regular file이어야 합니다. human decision receipt의 candidate ID, actor kind/identifier, decision time, repository revision, source hashes, exact effective ref와 `effectiveSha256`이 현재 effective artifact bytes와 모두 일치한 경우에만 승인 상태를 publish합니다. 하나라도 없거나 stale이면 false-fresh/false-approved snapshot 대신 generation을 fail closed 처리합니다.

execution source는 별도 JSON mirror가 아니라 canonical task→checkpoint link입니다. reference projector는 loop-enabled `docs/tasks/T*.md`의 `checkpoint_ref`로만 `docs/checkpoints/*.md` candidate를 찾으므로 더 최신인 orphan file이 화면을 hijack할 수 없습니다. task status vocabulary와 status↔loop compatibility, task/checkpoint ID·revision·loop mirror, checkpoint ID identity, linked task source hash/revision, state↔next actor/stop reason, budget exhaustion, succeeded evidence/receipt/attention barrier를 모두 확인합니다. `succeeded` evidence/receipt ref는 실제 safe non-empty repository regular file이어야 하며 receipt identity/task/checkpoint/source fence가 checkpoint evidence를 연결해야 합니다. 모든 support bytes는 snapshot generation 중 다시 확인합니다. checkpoint root 밖의 경로와 symlink를 거부합니다. 선택은 active/blocked non-succeeded work, active succeeded closeout, draft, historical terminal task 순으로 우선한 뒤 같은 group에서 `recorded_at`, `attempt_seq`, `checkpoint_seq` 내림차순과 repository-relative path 오름차순을 적용합니다. 따라서 더 최신인 completed task가 아직 진행 중인 task를 숨기지 않습니다. malformed linked candidate를 조용히 건너뛰거나 filesystem mtime으로 진행 상태를 추론하지 않습니다.

### Migration And Evidence Fence

reference profile은 세 상태를 독립적으로 projection합니다.

- `migrationFence`: governance catalog의 `migration.capturedRepository.baseCommit`이 target commit object로 resolve되고 optional receipt와 일치하는가
- `currentRepository`: 현재 HEAD, working-tree state/dirty count와 captured base 이후 HEAD 이동 여부
- `snapshot.sourceFence.sourceEvidenceState`: 각 source ref의 captured/current SHA-256이 `fresh|stale|degraded|unknown` 중 무엇인가

unresolvable captured base와 catalog digest/effective bytes에 묶이지 않은 migration human-decision receipt는 View 전체를 degraded로 만들고 review attention을 생성합니다. migration receipt도 snapshot publish 직전 다시 읽어 torn generation을 차단합니다. current HEAD가 나중에 이동한 사실이나 인용 구간 밖의 file 변경만으로 source evidence를 stale 처리하지 않습니다. 인용 구간 hash가 바뀌거나 Markdown anchor/boundary가 사라지거나 source가 missing/escaped일 때 해당 evidence freshness가 stale/degraded가 됩니다. View detail은 `capturedSha256/currentSha256`의 파일 상태와 `capturedEvidenceSha256/currentEvidenceSha256`의 인용 구간 상태를 분리해 사람이 왜 attention이 생겼는지 확인할 수 있게 합니다.

## Snapshot API Contract

versioned reference View v1의 read API:

```text
GET /api/v1/capabilities
GET /api/v1/snapshot
GET /healthz
GET /readyz
```

root HTML/CSS/JavaScript도 same-origin GET/HEAD로 제공합니다. arbitrary filesystem path 또는 resource ID를 받는 endpoint는 제공하지 않습니다. governance policies/guidelines/attention, optional execution checkpoint, runtime probe와 fence data는 `/api/v1/snapshot`의 같은 immutable generation 안에서 반환하며 `근거` tab은 그 source refs에서 계산합니다.

모든 snapshot response는 최소한 다음을 포함합니다.

```json
{
  "schemaVersion": 1,
  "snapshot": {
    "id": "view-00001234",
    "seq": 1234,
    "generatedAt": "2026-07-15T15:00:00+09:00",
    "freshness": "fresh",
    "sourceFence": {
      "governanceCatalog": "docs/_indexes/governance-catalog.json",
      "initiativeRegister": "docs/_indexes/initiative-register.json",
      "sourceEvidenceState": "fresh",
      "evidenceCurrent": 12,
      "evidenceChanged": 0,
      "evidenceMissing": 0
    },
    "capabilities": {
      "read": true,
      "write": false,
      "approvalIntents": false,
      "execution": false
    }
  },
  "migrationFence": {},
  "currentRepository": {},
  "policies": [],
  "guidelines": [],
  "initiatives": [],
  "attention": []
}
```

- UI가 필요로 하는 summary, initiative/project reverse index, execution projection과 evidence는 snapshot 내부 stable identity로 연결하고 raw source body/history를 복제하지 않습니다.
- immutable response는 `ETag`를 제공하고 conditional GET의 unchanged result는 `304 Not Modified`를 사용할 수 있습니다.
- `GET`, `HEAD`, `OPTIONS` 외 method는 `405 Method Not Allowed`입니다.

## SSE Contract

reference View v1은 `ETag` conditional polling과 manual refresh를 구현하며 SSE endpoint를 제공하지 않습니다. 이 section의 SSE contract는 alternate profile이 snapshot change를 알릴 때 사용할 수 있는 선택적 low-latency extension입니다. 구현한다면 WHATWG `EventSource`, `text/event-stream`, event ID, `Last-Event-ID` semantics를 따릅니다.

event type:

- `snapshot.published`
- `project.changed`
- `task.changed`
- `attention.changed`
- `trace.changed`
- `freshness.changed`
- `resync.required`

payload는 source 본문이 아니라 `event_id`, `snapshot_seq`, affected resource ID와 current ETag를 포함합니다. client는 event를 command로 실행하지 않고 해당 GET resource를 다시 읽습니다.

event gap, restart, buffer overflow에서는 `resync.required`를 보내거나 연결을 종료해 full snapshot resync를 유도합니다. SSE가 없거나 실패하면 ETag conditional polling과 manual refresh를 제공합니다.

## Freshness And Consistency Contract

| State | Meaning | UI And Action Rule |
| --- | --- | --- |
| `fresh` | snapshot hash가 latest settled source observation과 일치 | normal read |
| `updating` | 더 최신 source가 관찰됐지만 publish 전 | previous valid snapshot + banner; decision handoff 금지 |
| `direct` | 특정 resource를 authoritative source에서 직접 확인 | 해당 resource만 current로 표시 |
| `degraded` | watcher/scanner/parser/reconciliation 오류 | stale 가능성 경고; decision handoff 금지 |
| `unknown` | freshness proof 없음 | current로 가정하지 않음 |

- source write 직후 minimum revision/hash가 deadline 안에 projection되지 않으면 exact resource direct read를 허용할 수 있습니다.
- direct read 성공과 shared snapshot visibility lag를 별도 지표로 기록합니다.
- delete/rename은 settled authoritative scan 뒤 tombstone합니다.
- transient failure, connection 상태, SSE heartbeat를 freshness로 대신하지 않습니다.

## Read-Only And Security Boundary

- 기본 bind는 loopback interface이고 `0.0.0.0`를 기본값으로 사용하지 않습니다.
- Host/Origin allowlist, same-origin policy와 restrictive CORS를 적용합니다.
- remote access는 v1 범위 밖이며 필요하면 별도 authentication/threat model을 승인받습니다.
- workspace root allowlist와 canonical path/symlink containment를 검사합니다.
- `.git`, secret, credential, excluded private raw source를 fail-closed exclude/redact합니다.
- Markdown과 proposal content는 untrusted data로 escape/sanitize하고 instruction으로 실행하지 않습니다.
- local static asset과 CSP를 사용하고 외부 script/font dependency를 기본 포함하지 않습니다.
- arbitrary path, raw file server, arbitrary command endpoint를 만들지 않습니다.
- view process는 source와 cache read 및 자신의 rebuildable cache write 외 capability를 갖지 않습니다.

## Runtime Boundary

| Surface | Owns |
| --- | --- |
| public harness | schema, freshness/security contract, acceptance와 versioned reference View distribution |
| reference runtime | Node built-ins projector/server/controller, ETag polling, local static UI와 focused tests |
| alternate downstream runtime | 별도 profile의 language/framework, parser/cache/HTTP/SSE; 동일 acceptance와 own installation baseline 필요 |
| source workspace | authoritative docs, policy/directive, task/checkpoint/receipt/evidence |
| optional broker | human identity, exact approval fence, constrained source write, validator receipt |

reference v1은 Node 20 built-in module, persistent DB 없음, `.document-harness/runtime/view/` rebuildable state, exact `127.0.0.1:0`, ETag polling과 repository fingerprint/instance/PID/health lease supervisor를 고정합니다. repository-specific static identity, governance catalog path, allowlisted loopback probe와 quality command만 generated config로 달라지며 canonical checkpoint root는 `docs/checkpoints/`로 고정됩니다. remote profile, authentication, SSE와 organization-specific sensitivity extension은 별도 decision입니다.

## Failure Boundaries And Recovery

| Failure | Required Response |
| --- | --- |
| watcher loss | periodic full reconciliation으로 bounded convergence |
| partial save/parse error | previous valid record 유지 + degraded/error 표시 |
| mixed generation race | generation 폐기 후 같은 read fence에서 rebuild |
| rename/delete ambiguity | settled scan까지 old record를 stale/degraded로 유지 |
| SSE reconnect gap | full snapshot resync |
| cache loss | registered source에서 rebuild |
| secret/path scope violation | fail closed, resource 미노출, security log |
| source/view mismatch | view를 authority로 승격하지 않고 direct source 확인 |

## Observability

- latency: source observed→snapshot published, GET, SSE notification, direct-read와 shared visibility
- traffic: source event, GET, connected SSE client
- errors: parse, validation, reconciliation, publish, event gap, path/sensitivity rejection
- saturation: pending projection count/age, event buffer, connections, cache/disk headroom
- human control: oldest actionable attention, wait/review duration, stale-state error, trace broken/stale count

alert는 현재 발생 중이고 사용자가 완화할 수 있는 증상에 한정합니다. no-change heartbeat와 장기 추세는 dashboard/digest로 분리합니다.

## Acceptance Scenarios

| ID | Scenario | Pass Condition |
| --- | --- | --- |
| HV-01 | cold start/cache loss | source만으로 동일 logical snapshot rebuild |
| HV-02 | rapid save | final settled hash만 atomic publish |
| HV-03 | reconciliation | reference periodic reconcile로 설정된 bound 안에 복구; optional watcher loss에도 영향 없음 |
| HV-04 | parse failure | previous valid record + degraded/error, silent delete 없음 |
| HV-05 | snapshot race | response에 mixed generation 없음 |
| HV-06 | lifecycle separation | status와 loop state를 함께 보이고 의미를 합치지 않음 |
| HV-07 | attention visibility | blocked/wait/review/stopped attention이 숨지 않음 |
| HV-08 | optional SSE extension | 제공할 때만 Last-Event-ID, gap 시 full resync; reference v1에는 미구현 |
| HV-09 | reference polling | ETag/304와 manual refresh로 수렴 |
| HV-10 | trace drift | exact edge와 revision, changed rule의 stale 상태 표시 |
| HV-11 | read-only | mutation 405, source write capability 없음 |
| HV-12 | source scope security | traversal, symlink escape, secret, permissive CORS 차단 |
| HV-13 | repository presentation | static identity가 보이고 repository selector와 left sidebar가 없음 |
| HV-14 | canonical tabs | `개요`, `정책`, `지침`, `추진안`, `검토 대기`, `실행 상태`, `근거`가 순서대로 있고 keyboard navigation 가능 |
| HV-15 | cross-tab consistency | 모든 tab이 같은 snapshot/read fence를 사용하고 mixed generation이 없음 |
| HV-16 | refresh continuity | polling/manual refresh 후 tab, filter, search, expansion과 focus가 유지됨 |
| HV-17 | local asset boundary | external CDN/font/script request가 0이고 local-only/read-only가 유지됨 |
| HV-18 | migration fence invalid | unresolvable base/receipt mismatch가 degraded attention이며 source evidence state와 분리됨 |
| HV-19 | current HEAD advanced | HEAD movement가 표시되지만 unchanged source evidence는 fresh 유지 |
| HV-20 | Korean-first projection | chrome과 synthesized human field는 `ko-KR`, technical/source value는 원형 유지 |
| HV-21 | long metadata | 긴 ID/path/hash가 자기 container 안에서 줄바꿈되고 adjacent content와 겹치지 않음 |
| HV-22 | fixed user-facing identity | top-left의 `보드 / <repository>`가 모든 tab과 scroll 위치에서 보이고 repository별 rename 대상이 아님 |
| HV-23 | first-class guideline surface | `지침` tab이 독립 search/filter/pagination/detail을 제공하고 관련 정책을 역방향으로 연결함 |
| HV-24 | initiative planning trace | `추진안` tab이 정책 WHY, 선택 지침 HOW와 Project의 `related_initiative` 역색인을 보여주며 실행 진척을 추정하지 않음 |
| HV-25 | governance authoring help | 정책·지침·추진안에 24px 원형 도움말 trigger가 있고 hover 이탈, focus preview scroll, click/touch/Enter 고정, background inert, dialog focus containment, Escape와 tab 전환에서 한글 역할·작성·AI 요청 안내가 접근 가능하고 안정적으로 열고 닫힘 |

## Decisions

- human view는 source of truth가 아니라 immutable derived projection입니다.
- v1은 local loopback read-only이고 approval broker/write는 별도 단계입니다.
- reference v1은 watcher를 사용하지 않고 periodic reconciliation을 correctness authority로 둡니다. alternate watcher는 hint입니다.
- reference v1 transport는 ETag conditional polling이며 SSE는 alternate profile의 optional GET refresh notification입니다.
- freshness와 connection health를 분리합니다.
- UI summary는 설명 계층이며 state, authority, receipt, freshness는 machine-readable source에서 계산합니다.
- v1 presentation은 repository별 독립 server, 고정 사용자명 `보드`, 정적 repository identity와 seven-tab single-page profile을 사용합니다.
- repository selector와 left sidebar는 이 profile에 포함하지 않습니다.
- 기본 human projection은 `ko-KR`이며 localization은 authority/approval/evidence를 바꾸지 않습니다.
- technical ID와 provenance는 보조 metadata로 원형 보존하고 container 밖으로 넘치지 않게 합니다.
- PatternFly-inspired semantics는 local semantic tokens와 accessible interaction으로 구현하며 external asset dependency를 만들지 않습니다.
- `runtime/document-harness-view/`는 release manifest가 byte set을 pin하는 public versioned reference distribution이고 adopter가 design을 재생성하지 않습니다.
- reference v1은 Node built-ins, no persistent DB, OS auto-port, lease-safe controller와 exact read-only endpoints를 사용합니다.
- 거버넌스 작성 도움말은 승인이나 source mutation이 없는 versioned presentation contract이며 정책 WHY, 지침 HOW, 추진안 outcome의 역할 경계를 유지합니다.

## Open Questions

- remote/alternate profile의 authentication, transport security와 authorization
- alternate SSE profile의 visibility SLO, event retention과 resync bounds
- source sensitivity/redaction schema와 organization-specific secret patterns
- cryptographic receipt/signature가 필요한 조직 trust boundary

## References

- [WHATWG HTML — Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Google SRE Book — Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [PatternFly — About PatternFly](https://www.patternfly.org/get-started/about-patternfly/)
- [PatternFly — Tabs design guidelines](https://www.patternfly.org/components/tabs/design-guidelines/)
- [PatternFly — Tabs accessibility](https://www.patternfly.org/components/tabs/accessibility/)
- [PatternFly — Design tokens](https://www.patternfly.org/tokens/about-tokens/)
- `docs/design/execution-loop-plane.md`
- `docs/design/policy-to-evidence-governance.md`
- `docs/guide/human-control-view.md`

## Change Log

- 2026-07-15: execution-loop-plane에서 projector, snapshot API, SSE, freshness, security, runtime, observability와 view acceptance 책임을 분리했다.
- 2026-07-16: repository별 정적 identity, five top tabs, cross-tab snapshot fence, refresh-stable interaction과 local semantic asset profile을 고정했다.
- 2026-07-16: shipped Node/ETag reference View distribution, exact read endpoints, migration/current/source fence separation과 lease-safe no-DB runtime profile을 current contract로 정렬했다.
- 2026-07-17: approved/effective projection을 complete source fence와 real decision/effective evidence에 묶고, Execution Status 입력을 canonical `docs/checkpoints/*.md`의 deterministic fail-closed selection으로 정렬했다.
- 2026-07-17: `ko-KR` human projection, localization authority fence와 긴 technical metadata containment를 고정했다.
- 2026-07-17: 사용자용 고정 이름을 `보드`로 정하고 정책과 지침을 상호 연결된 독립 최상위 tab으로 분리했다.
- 2026-07-18: 정책·지침·추진안의 canonical 작성 가이드를 24px trigger, full-viewport hover/focus/click 도움말, background inert와 focus containment를 포함한 HV-25 acceptance로 고정했다.
