---
type: guide
title: human-control-view
status: current
owner: Codex
created: 2026-07-15
updated: 2026-07-16
related_project: []
related_task: []
related_design:
  - docs/design/control-plane.md
  - docs/design/execution-loop-plane.md
  - docs/design/human-control-view-plane.md
  - docs/design/policy-to-evidence-governance.md
source_refs:
  - https://html.spec.whatwg.org/multipage/server-sent-events.html
  - https://www.w3.org/TR/prov-dm/
  - https://sre.google/sre-book/monitoring-distributed-systems/
  - https://www.patternfly.org/components/tabs/design-guidelines/
  - https://www.patternfly.org/components/tabs/accessibility/
  - https://www.patternfly.org/components/table/design-guidelines/
  - https://www.patternfly.org/tokens/about-tokens/
tags:
  - docs/guide
  - human-control
  - local-view
  - attention
---

# human-control-view

- Type: guide
- Status: current
- Owner: Codex
- Created: 2026-07-15
- Updated: 2026-07-16
- Related Project:
- Related Task:
- Related Design: docs/design/control-plane.md; docs/design/execution-loop-plane.md; docs/design/human-control-view-plane.md; docs/design/policy-to-evidence-governance.md

## Purpose

이 guide는 repository 하나에 연결된 local view에서 project/task의 현재 위치, 사람의 행동이 필요한 attention, policy-to-task trace, evidence와 freshness를 빠르게 판단하는 운영 절차를 설명합니다.

loop state/checkpoint/attention canonical fields는 `docs/design/execution-loop-plane.md`, projector/API/polling/optional-SSE/freshness/security contract는 `docs/design/human-control-view-plane.md`를 우선합니다.

## Operator Mental Model

local view는 cockpit이지 기록 원장이 아닙니다.

- Markdown/Git source가 목표, 상태, checkpoint, evidence, decision/approval receipt의 truth입니다.
- view는 source를 읽어 만든 immutable snapshot입니다.
- reference v1의 ETag polling과 optional SSE는 새 snapshot을 읽게 할 뿐 action을 실행하지 않습니다.
- freshness가 불확실하면 source를 확인하고 approval을 멈춥니다.
- 사용자의 질문 답변이나 승인도 durable receipt로 source에 반영되기 전까지 완료된 결정이 아닙니다.

사용자는 화면에서 항상 다음 다섯 질문에 답할 수 있어야 합니다.

1. 지금 어떤 initiative와 task가 살아 있는가?
2. 무엇이 사람의 입력·승인·review를 기다리는가?
3. 이 task는 어떤 policy와 directive, design을 따르는가?
4. 무엇을 근거로 완료 또는 중단을 판단하는가?
5. 화면이 authoritative source의 어느 revision을 보여주는가?

## Information Architecture

```text
Top Bar
  static repository identity | freshness | snapshot | Git head/dirty
  local-only | READ ONLY | health

Horizontal Tabs
  Overview | Policies & Guidelines | Review Queue | Execution Status | Evidence

Selected Tab Panel
  one large reading and operation surface
```

이 View는 repository마다 독립적으로 실행되므로 repository selector, workspace switcher와 left sidebar를 두지 않습니다. repository identity는 top bar의 고정 context이고, 5개 tab은 정확히 위 순서와 label을 사용합니다. 좁은 화면은 horizontal tab overflow로 대응하며 left navigation으로 변환하지 않습니다.

상단 bar의 `connected` 표시는 freshness를 의미하지 않습니다. `fresh`, `updating`, `direct`, `degraded`, `unknown`을 별도 badge로 표시합니다.

## Reference View Operations

`view` profile은 public release가 byte-pin한 `runtime/document-harness-view/`를 설치합니다. 디자인을 repository마다 다시 생성하지 않고, generated `config.json`의 static identity와 repository-specific source/probe/quality declaration만 바꿉니다.

```bash
./runtime/document-harness-view/bin/human-view doctor
./runtime/document-harness-view/bin/human-view refresh
./runtime/document-harness-view/bin/human-view start
./runtime/document-harness-view/bin/human-view status
./runtime/document-harness-view/bin/human-view url
./runtime/document-harness-view/bin/human-view stop
./runtime/document-harness-view/bin/human-view test
```

- `doctor`는 config/catalog/source/migration fence와 projection을 read-only 검사합니다.
- `refresh`는 allowlisted credential-free loopback probes를 읽고 runtime-local sanitized data만 atomic update합니다. quality command를 실행하지 않습니다.
- `start`는 exact `127.0.0.1:0`에 bind하고 OS-assigned port와 repository/instance/PID identity를 lease에 publish합니다.
- `stop`은 lease와 live health identity가 일치할 때만 SIGTERM을 보내며 foreign process는 kill하지 않습니다.
- reference transport는 `/api/v1/snapshot` ETag polling입니다. SSE는 alternate profile에만 선택적으로 추가합니다.

runtime-local state는 `.document-harness/runtime/view/` 아래에만 둡니다. runtime은 lease/snapshot/log/probe를 쓰기 전에 해당 디렉터리에 exact self-ignoring `.gitignore` marker를 만들고 검증하므로 root ignore rule이 없는 repository도 dirty하게 만들지 않습니다. marker가 foreign bytes 또는 symlink이면 덮어쓰지 않고 fail-closed합니다. View가 실패해도 project application runtime을 restart, deploy, scan 또는 mutate하지 않습니다.

## Five-Tab Product Plan

### Overview

첫 화면은 사용자가 10초 안에 방향, 위험과 다음 확인 지점을 파악하는 summary입니다.

권장 layout:

1. plain-language project direction과 현재 focus를 담은 full-width lead panel
2. policy, guideline, unreviewed, attention, verification을 보여주는 compact metric row
3. 왼쪽의 governance/execution summary와 오른쪽의 `지금 확인할 항목` panel
4. recent source/verification 변화와 snapshot freshness를 보여주는 runtime strip

metric은 숫자만 표시하지 않고 의미와 기준 snapshot을 함께 표시합니다. 실행 checkpoint가 없으면 진행률을 추정하지 않고 `execution checkpoint not configured`처럼 source gap을 명시합니다.

### Policies & Guidelines

정책과 지침을 사람이 비교·검토하는 primary work surface입니다.

- 상단에 policy/guideline/candidate/effective/approved/unreviewed count를 독립적으로 표시합니다.
- search는 title, human summary, related guideline와 exact source path를 대상으로 합니다.
- filter chip은 authority, approval, enforcement, severity와 stale/conflict를 사용하고 활성 조건을 text로 보여줍니다.
- dense table의 기본 column은 `상태`, `정책`, `관련 지침`, `권한·승인`, `집행`, `근거`입니다.
- row expand는 why, scope, related guideline details, conflict, source heading/line/hash와 freshness를 한 자리에서 보여줍니다.
- candidate와 effective policy, AI confidence와 human approval은 같은 badge로 합치지 않습니다.
- 한 page에 읽기 어려운 전체 Markdown을 노출하지 않고 paginated rows와 structured detail을 사용합니다.

### Review Queue

사람이 지금 판단해야 할 항목만 severity와 이유가 보이는 순서로 제공합니다.

- header summary는 `critical`, `decision`, `warning`을 text와 semantic indicator로 분리합니다.
- card는 exact request, why now, risk, recommended action, alternatives, source/checkpoint fence와 handoff target을 포함합니다.
- 같은 severity 안의 ordering reason을 보이며 age와 critical-path blocking을 숨은 점수로만 표현하지 않습니다.
- v1 read-only View에는 approve/reject mutation button을 제공하지 않습니다. Codex/Claude task 또는 durable source 위치로 handoff합니다.
- 빈 queue는 단순히 `0`만 표시하지 않고 현재 snapshot에서 actionable review가 없음을 설명합니다.

### Execution Status

AI execute loop의 내부 상태를 관찰 가능한 contract로 풀어냅니다.

- lifecycle `status`와 execution `loop_state`를 나란히 두고 의미를 합치지 않습니다.
- current goal, hypothesis, last action, next actor/action, checkpoint sequence와 resume condition을 보여줍니다.
- iteration/time/cost budget은 source가 있을 때만 표시하고 missing field를 0으로 꾸미지 않습니다.
- fast/full/continuous validator receipt와 마지막 결과, environment/revision을 연결합니다.
- attention과 stop reason, residual risk, rollback/safe stop을 같은 snapshot에서 확인할 수 있게 합니다.
- checkpoint 또는 budget source가 없으면 `not configured` 상태와 필요한 source contract를 명확히 표시합니다.

### Evidence

완료 주장보다 그 판단을 뒷받침하는 source와 receipt를 중심으로 구성합니다.

- evidence를 `source`, `verification`, `decision/approval`, `handoff` group으로 나눕니다.
- search/filter는 path, receipt kind, verdict, related task/goal과 freshness를 대상으로 합니다.
- 각 row는 human summary, exact path 또는 stable artifact ID, revision/hash, captured time, verdict와 stale/incomplete state를 보여줍니다.
- raw log 전체는 복제하지 않고 중요한 결과와 stable reference만 노출합니다.
- evidence가 없거나 fence가 맞지 않으면 빈칸 대신 `missing`, `stale`, `incomplete`를 명시합니다.
- migration captured base validity, current HEAD/dirty state와 per-source hash freshness를 별도 row/state로 보여줍니다. HEAD가 advanced인 것만으로 unchanged source evidence를 stale로 바꾸지 않습니다.

## Interaction And Refresh Stability

탐색 상태는 browser-local preference이며 source authority는 아니지만, 주기적 update가 사용자의 읽기를 방해해서는 안 됩니다.

- polling, SSE refresh, manual refresh와 full resync 뒤에도 active tab을 유지합니다.
- tab별 filter, search query, pagination과 expanded row/card를 stable item ID 기준으로 유지합니다.
- item이 새 snapshot에 남아 있으면 keyboard focus와 expansion을 보존합니다.
- item이 없어졌을 때만 selection을 정리하고 non-blocking message로 이유를 표시합니다.
- refresh가 search input을 비우거나 현재 tab을 `Overview`로 되돌려서는 안 됩니다.
- 모든 panel은 같은 snapshot ID/sequence/read fence에서 계산하며 다른 generation의 detail을 화면에 섞지 않습니다.
- hash deep-link는 active tab 복원에 쓸 수 있지만 approval, freshness 또는 unread truth가 아닙니다.

## Semantic Design System

UI는 PatternFly의 enterprise density, semantic status와 accessible tabs 원칙을 참고하는 vendor-neutral implementation입니다.

- surface, text, border, focus, success, warning, danger와 severity를 semantic token으로 정의합니다.
- color만으로 상태를 전달하지 않고 label과 icon/shape를 함께 사용합니다.
- tab은 ARIA relationship, visible focus, arrow keys, `Home`/`End`, `Enter`/`Space`를 지원합니다.
- table, expandable detail, pagination과 live status는 semantic HTML과 accessible name을 가집니다.
- layout은 hierarchy, whitespace와 divider로 구분하며 decorative card 남용을 피합니다.
- script, stylesheet, icon과 font는 same-origin local asset만 사용합니다. external CDN, remote font와 runtime third-party fetch는 허용하지 않습니다.

## Overview

Overview는 상세 status report보다 다음 행동을 우선합니다.

- actionable attention 수와 oldest age
- active umbrella project와 current focus
- task를 `ready`, `running`, `awaiting_user`, `awaiting_external`, `needs_review`, `stopped`, `succeeded` lane으로 요약
- 최근 evidence/decision 변화
- policy trace break 또는 stale edge
- projection freshness와 runtime health

`Since last visit`는 browser-local snapshot sequence를 기준으로 계산할 수 있지만 source 상태나 unread truth로 사용하지 않습니다.

Overview card는 최소한 source link, status, loop state, current focus, updated time, freshness를 보여줍니다.

## Attention Queue

queue는 다음 순서로 그룹화합니다.

1. security, destructive, deployment, external write 같은 high-risk approval
2. `stopped`, no-progress, budget exceeded
3. blocking human decision/input
4. `needs_review`
5. overdue external wait

같은 group 안에서는 risk, critical-path blocking, age로 정렬할 수 있습니다. 숨겨진 점수만 보여주지 말고 정렬 이유를 표시합니다.

attention card 필수 내용:

- task/project와 current goal
- `kind`, risk, created/age
- why now
- exact requested response/action
- recommended action
- alternatives and impact
- checkpoint/task contract revision
- resume condition
- approval fence 또는 `not applicable`
- freshness/stale badge

운영 규칙:

- normal human wait는 `status: active`를 유지합니다.
- lifecycle `blocked`도 queue에 포함합니다.
- no-change heartbeat와 informational milestone은 queue를 만들지 않습니다.
- stale 또는 degraded approval control은 disabled 상태로 보이고 새 preview를 요구합니다.
- bulk `Approve all`은 제공하지 않습니다.

## Policy To Task Trace View

trace view는 graph와 accessible table을 함께 제공하는 것이 좋습니다.

```text
Human Policy
  ↓ interpreted by
Proposal Report [non-authoritative]
  ↓ explicit human approval
Effective Normative Standard / Directive
  ↓ governs
Design section / invariant + Operational Guide
  ↓ scopes or implements
Task / Goal
  ↓ verifies
Evidence / decision / approval receipt
```

표 형태의 최소 column:

| Authority State | Policy | Standard / Directive | Design / Guide | Task / Goal | Evidence / Receipt | Trace Status |
| --- | --- | --- | --- | --- | --- | --- |
| proposed / accepted_for_promotion / effective / superseded | ID + revision | ID + obligation | path + heading | task ID + goal ID | receipt/evidence ID | complete/broken/stale/ambiguous/candidate |

각 node는 source path, heading, revision/hash를 보여주고 원문 detail로 이동할 수 있어야 합니다.

- explicit source reference가 있는 edge만 authoritative하게 표시합니다.
- proposal과 `accepted_for_promotion`은 `effective`와 다른 label/색상으로 표시하고 normative filter의 기본 대상에서 제외합니다.
- human policy, effective normative standard, operational guide가 각각 WHY, MUST, HOW 중 무엇을 소유하는지 표시합니다.
- heuristic 연결은 `candidate`와 근거를 표시하며 자동으로 source를 수정하지 않습니다.
- policy/directive revision이 바뀐 downstream edge는 재검증 전 `stale`입니다.
- missing directive, orphan design, evidence 없는 task goal은 attention 후보입니다.
- trace completeness만으로 task를 `done` 처리하지 않고 Goal Verification과 validator evidence를 함께 봅니다.

W3C PROV의 entity, activity, agent, derivation 모델은 trace의 provenance를 설명하는 참고점이며 UI가 PROV 형식을 그대로 노출할 필요는 없습니다.

## Project And Task Views

### Project View

- umbrella outcome, owner, status, current focus
- task/WBS와 critical path
- task별 loop state와 attention roll-up
- milestone evidence와 residual risk
- 관련 policy/directive/design coverage
- handoff와 downstream consumer

### Task View

- lifecycle status와 loop state를 나란히 표시
- Goal Inventory와 Goal Verification
- current checkpoint와 checkpoint sequence
- last action, current hypothesis, next action/actor, resume condition
- policy/directive refs
- evidence, risks, attention, receipts
- budget 사용량과 stop reason
- WBS와 completion criteria
- source revision/hash와 freshness

`succeeded`를 lifecycle `done` badge로 렌더링하지 않습니다. `awaiting_user`와 `awaiting_external`을 lifecycle `blocked`로 합치지 않습니다.

## Evidence Review

Evidence Pack은 새 수기 truth 문서가 아니라 task source의 기존 section과 receipt를 조립한 view입니다.

- goal/acceptance criterion별 evidence
- changed surface와 scope check
- command, environment, validator result
- policy/directive/design trace
- decision, approval, rejection receipt
- uncertainty와 residual risk
- rollback 또는 safe stop
- outputs/handoff

raw log 전체를 summary snapshot에 복제하지 않고 stable artifact reference와 중요한 결과를 보여줍니다. evidence가 source revision과 연결되지 않으면 stale 또는 incomplete로 표시합니다.

## Freshness And Health

상단 freshness badge와 Health 화면은 다음을 분리합니다.

| State | Operator Meaning | Action |
| --- | --- | --- |
| `fresh` | latest settled source와 snapshot hash가 일치 | normal review 가능 |
| `updating` | source는 바뀌었고 새 snapshot 준비 중 | 기다리거나 source detail 확인; approval 금지 |
| `direct` | 특정 resource를 authoritative source에서 읽음 | 해당 resource만 current, 전체 snapshot과 구분 |
| `degraded` | watcher/scanner/parser/reconciliation 실패 | stale 가능성 조사; approval 금지 |
| `unknown` | freshness proof 없음 | current라고 가정하지 않음 |

reference v1 Health/상단 status의 최소 정보:

- snapshot ID/sequence와 source read fence
- current repository HEAD/dirty state와 migration captured base relation
- migration fence validity와 per-source evidence freshness
- projection published/reconciled timestamp
- parse/reconciliation error
- trace broken/stale count
- stale approval rejection count

alternate watcher/SSE profile은 source-observed/full-scan timestamp, pending age, visibility lag와 event gap/resync 상태를 추가합니다. reference v1에 없는 값을 0으로 꾸미지 않습니다.

Google SRE의 four golden signals을 다음처럼 적용합니다.

- latency: source-to-view, GET, SSE delay
- traffic: request, client, source event volume
- errors: parse, publish, reconciliation, scope/fence rejection
- saturation: pending queue, event buffer, connections, cache/disk headroom

사람을 즉시 깨우는 alert는 지금 발생 중이고 사람이 완화할 수 있는 증상에 한정합니다. 추세와 milestone은 dashboard 또는 digest에 남깁니다.

## Update Mechanism

1. page load 시 immutable snapshot을 GET합니다.
2. reference v1은 `ETag`와 `If-None-Match` conditional polling을 사용하고 unchanged response는 304로 처리합니다.
3. background tab은 polling 빈도를 낮추고 manual refresh를 제공합니다.
4. AI runtime controller는 meaningful action, validation, checkpoint, attention 변경 뒤 allowlisted probe를 refresh하고 새 snapshot sequence에 수렴했는지 확인합니다.
5. alternate profile이 SSE를 지원하면 `/api/v1/events`를 `EventSource`로 구독하고 event를 command로 실행하지 않고 snapshot GET을 다시 읽습니다.
6. optional SSE reconnect는 event ID/`Last-Event-ID`를 쓰고 gap/restart/buffer overflow는 full snapshot resync로 복구합니다.

polling cadence와 reconciliation SLO는 profile config로 정합니다. polling/SSE 성공이나 browser refresh 자체를 source/runtime freshness proof로 사용하지 않습니다.

## Read-Only Interaction Rule

default local view는 `GET`, `HEAD`, `OPTIONS`만 사용합니다.

- source edit endpoint를 만들지 않습니다.
- arbitrary filesystem path를 받지 않습니다.
- `capabilities.write=false`를 명시합니다.
- optional broker가 없으면 approval/reply control 대신 Codex task 또는 source 위치로 handoff합니다.
- active tab, UI filter, search query, expanded row와 last-seen snapshot 같은 preference는 browser-local일 수 있지만 업무 truth가 아닙니다.

사용자 입력 submission도 write입니다. 답변을 지원하려면 별도 broker가 current attention/checkpoint를 검증하고 durable decision receipt로 기록해야 합니다.

## Approval Workflow

1. 사용자가 attention card에서 exact action과 risk를 확인합니다.
2. UI 또는 handoff target이 current source와 snapshot을 refresh합니다.
3. 별도 approval broker가 task contract revision, checkpoint, task source hash, diff hash, scope hash, expiry를 가진 preview를 만듭니다.
4. 사용자는 하나의 scoped action을 승인하거나 거부합니다.
5. broker는 실행 직전에 fence를 다시 검증합니다.
6. stale/expired/mismatched fence면 실행을 거부하고 새 preview를 요구합니다.
7. constrained executor가 승인된 source mutation만 수행합니다.
8. required validator를 실행하고 result receipt를 남깁니다.
9. projector가 source change를 관찰해 새 snapshot을 publish합니다.

확인 화면에는 다음을 반드시 보여줍니다.

- exact requested action
- environment, file/service/recipient scope
- diff 또는 immutable diff hash
- expected effect와 rollback
- approval expiry와 one-shot 여부
- 현재 checkpoint와 source freshness

## Security Checklist

- [ ] loopback bind가 기본이며 remote profile은 별도 승인한다.
- [ ] same-origin UI이고 permissive CORS를 사용하지 않는다.
- [ ] Host/Origin validation과 DNS rebinding 방어가 있다.
- [ ] CSP와 frame embedding 차단이 있다.
- [ ] view process는 read-only OS identity다.
- [ ] registered source roots만 읽고 path traversal/symlink escape를 막는다.
- [ ] excluded/private/secret path와 sensitivity metadata를 fail closed한다.
- [ ] source content와 credential을 query string, event ID, access log에 넣지 않는다.
- [ ] view process에 shell, Git write, deployment, broad network capability가 없다.
- [ ] mutation method는 405를 반환한다.
- [ ] stale/degraded snapshot에서 approval control이 비활성화된다.
- [ ] broker approval은 one-shot, exact scope, revision/diff fence를 사용한다.
- [ ] `Approve all`과 wildcard scope가 없다.

local-only는 authentication과 browser-origin threat를 생략할 근거가 아닙니다. remote access는 명시적 authentication, transport security, authorization을 요구하는 별도 profile입니다.

## Failure Playbook

| Symptom | First Check | Response |
| --- | --- | --- |
| 화면이 source보다 오래됨 | source hash, snapshot fence, pending age | updating/degraded 표시, incremental scan, 필요하면 source direct read |
| task가 queue에서 사라짐 | lifecycle status와 loop state, attention source | blocked/awaiting_user/awaiting_external/needs_review state를 직접 projection하고 index omission을 숨기지 않음 |
| trace가 끊김 | explicit policy/directive/design/task refs | broken attention 생성, source에서 edge 수정; view inference write-back 금지 |
| 잘못된 approval이 보임 | checkpoint/source/diff/scope fence | stale 처리하고 control disable, 새 preview 생성 |
| optional watcher overflow | last full scan과 reconciliation | reference periodic reconciliation 또는 full scan 후 atomic snapshot publish |
| parse 실패 | last valid record와 source readability | previous record 유지, degraded 표시, 오류 해결 후 retry |
| optional SSE reconnect 반복 | Last-Event-ID와 buffer retention | full resync, reference ETag polling fallback, event payload 축소 |
| cache 손상 | source와 cache authority | cache 폐기 후 source rebuild |
| broker 중단 | capabilities와 health | view read-only 유지, source mutation 금지 |

## Acceptance Checklist

- [ ] Markdown/Git source만으로 cache와 snapshot을 rebuild할 수 있다.
- [ ] lifecycle status와 loop state가 별도 field와 badge다.
- [ ] normal human wait는 active로 남고 blocked task도 attention에 보인다.
- [ ] current checkpoint만으로 새 세션을 재개할 수 있다.
- [ ] human policy→proposal/approval→effective standard/directive→design/guide→task→evidence trace와 source revision이 보인다.
- [ ] `proposed`, `accepted_for_promotion`, `effective`, `superseded` authority state가 구분된다.
- [ ] broken/stale/ambiguous/candidate trace를 구분한다.
- [ ] rapid save, rename, delete, watcher loss 뒤 올바른 snapshot으로 수렴한다.
- [ ] parse 실패가 silent delete나 false fresh로 이어지지 않는다.
- [ ] 한 snapshot에 서로 다른 source/checkpoint generation이 섞이지 않는다.
- [ ] alternate SSE profile이면 reconnect와 event gap full resync가 동작한다.
- [ ] reference ETag polling과 304가 동작한다.
- [ ] read-only API mutation method가 모두 거부된다.
- [ ] stale/degraded approval 실행이 0건이다.
- [ ] approved write는 별도 broker/executor/validator receipt를 거친다.
- [ ] path traversal, symlink escape, excluded sensitivity, browser-origin 공격을 차단한다.
- [ ] cache 삭제 뒤 hidden decision/approval truth가 손실되지 않는다.
- [ ] top bar가 현재 repository identity를 정적으로 표시하고 selector/workspace switcher가 없다.
- [ ] left sidebar 없이 exact five horizontal tabs를 canonical order로 제공한다.
- [ ] 모든 tab이 같은 snapshot/read fence를 사용한다.
- [ ] polling/manual refresh 뒤 active tab, filter, search, expansion과 focus가 유지된다.
- [ ] external CDN/font/script request가 없고 same-origin local asset만 사용한다.
- [ ] keyboard와 screen reader로 tab, filter, table expansion과 live freshness를 조작·이해할 수 있다.
- [ ] migration fence, current repository와 source evidence freshness가 독립 상태다.
- [ ] View runtime/controller byte set이 release manifest와 installation lock에 pin되어 있다.

## References

- [Execution Loop Plane](../design/execution-loop-plane.md)
- [Human Control View Plane](../design/human-control-view-plane.md)
- [WHATWG HTML — Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [W3C PROV-DM — The PROV Data Model](https://www.w3.org/TR/prov-dm/)
- [Google SRE Book — Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [PatternFly — Tabs design guidelines](https://www.patternfly.org/components/tabs/design-guidelines/)
- [PatternFly — Tabs accessibility](https://www.patternfly.org/components/tabs/accessibility/)
- [PatternFly — Table design guidelines](https://www.patternfly.org/components/table/design-guidelines/)
- [PatternFly — Design tokens](https://www.patternfly.org/tokens/about-tokens/)
- `docs/design/control-plane.md`

## Change Log

- 2026-07-15: read-only local view, information architecture, attention, policy trace, freshness, SSE/polling, approval workflow, security 운영 기준을 생성했다.
- 2026-07-16: repository 정적 identity, five top tabs, tab별 product plan, refresh-stable interaction과 PatternFly-inspired local semantic design 기준을 추가했다.
- 2026-07-16: shipped reference View의 doctor/refresh/start/status/url/stop/test, Node no-DB/ETag/lease-safe runtime과 migration/current/source fence 운영 절차를 추가했다.
