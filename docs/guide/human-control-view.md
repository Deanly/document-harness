---
type: guide
title: human-control-view
status: current
owner: Codex
created: 2026-07-15
updated: 2026-08-19
related_project: []
related_task: []
related_design:
  - docs/architecture/control-plane.md
  - docs/architecture/execution-loop-plane.md
  - docs/architecture/human-control-view-plane.md
  - docs/governance/policy-to-evidence.md
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
- Updated: 2026-08-01
- Related Project:
- Related Task:
- Related Design: docs/architecture/control-plane.md; docs/architecture/execution-loop-plane.md; docs/architecture/human-control-view-plane.md; docs/governance/policy-to-evidence.md

## Purpose

이 guide는 repository 하나에 연결된 local view에서 project/task의 현재 위치, 사람의 행동이 필요한 attention, policy-to-task trace, evidence와 freshness를 빠르게 판단하는 운영 절차를 설명합니다.

loop state/checkpoint/attention canonical fields는 `docs/architecture/execution-loop-plane.md`, projector/API/polling/optional-SSE/freshness/security contract는 `docs/architecture/human-control-view-plane.md`를 우선합니다.

## Operator Mental Model

local view는 cockpit이지 기록 원장이 아닙니다.

사람이 이 화면을 부르는 이름은 `presentation.displayName`에서 읽으며 reference 기본값은 **`Board`**입니다. 대화에서는 “Board”, “View screen”, “View start”를 사용하고, executable과 내부 기술 문맥에서는 호환성을 위해 `human-view`와 `Human Control View`를 유지합니다.

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
  <displayName> / static repository identity | freshness | snapshot | Git head/dirty
  local-only | READ ONLY | health

Horizontal Tabs
  Overview | Domain | Policies | Guidelines | Initiatives | Review | Execution | Evidence

Selected Tab Panel
  one large reading and operation surface
```

이 View는 repository마다 독립적으로 실행되므로 repository selector, workspace switcher와 left sidebar를 두지 않습니다. top bar 왼쪽의 `<displayName> / <repository>`는 고정 context이며, 스크롤 중에도 계속 보여야 합니다. `Board`는 reference 기본 displayName이고, 배포 profile은 사용자 표시 언어에 맞게 `presentation.displayName`과 `presentation.tabLabels`를 설정할 수 있습니다. 내부 route/hash key는 `overview|domain|policies|guidelines|initiatives|review|execution|evidence`를 사용하고 기존 `#policies`는 policies tab을 계속 가리킵니다. 좁은 화면은 horizontal tab overflow로 대응하며 left navigation으로 변환하지 않습니다.

### Domain Tab

Domain 탭은 `docs/design/`의 DDD landscape, context map, bounded-context model, ubiquitous language와 executable examples를 읽기 전용으로 투영하고, delivery source가 연결한 exact AI Domain Expert supervision/decision receipt를 함께 읽습니다. 첫 화면의 주인공은 문서 목록이나 승인 metadata가 아니라 AI Domain Expert가 발견한 현재 모델-구현 문제와 사람이 결정할 수 있도록 종합한 대안·권고입니다.

- AI Domain Expert는 사람 바로 아래의 최고 감독 권한자로서 모든 delivery 역할의 모델/구현 정렬을 challenge하고 unresolved 문제를 closeout blocker로 만듭니다.
- supervision card는 문제, model expectation, implementation reality, business/engineering impact, 코드 변경·모델 변경·임시 편차·중단 선택지, AI 권고/confidence와 정확한 사람 결정 질문을 순서대로 표시합니다.
- 사용자는 material/strategic 의미와 위험 수용을 최종 결정합니다. Board는 결정을 만들거나 승인하지 않고 exact receipt가 기록된 뒤 그 결과만 다시 투영합니다.
- 코드 또는 모델 변경을 선택했다면 새 `aligned` review까지 완료되지 않은 상태를 해결됨으로 표시하지 않습니다. temporary deviation은 human receipt의 위험·만료 조건을 함께 표시합니다.

- 정상 card는 `display_title`과 `human_summary`를 사용하며 technical `title`, bounded-context name, ID 또는 section 첫 줄을 사람용 설명의 fallback으로 사용하지 않습니다.
- AI Domain Expert는 `bounded-context`, `aggregate`, `entity`, `value-object`, `business-rule`, `state-transition`, `ubiquitous-language`, `scenario` 중 이번 사람 결정에 필요한 최소 충분 수준을 하나 선택합니다. 서로 독립된 판단은 `mixed`로 숨기지 않고 별도 review package로 분리합니다.
- card 첫 화면은 AI Domain Expert의 권고 결정, 선택한 모델링 수준과 이유, 사람이 확인할 핵심, 승인으로 보호되는 결과, 반대·수정 조건, 그 수준에서 선택된 실제 모델을 순서대로 보여줍니다.
- 선택 수준보다 상세한 entity, technical ID, command/event, 전체 rule/scenario는 접을 수 있는 근거로 내립니다. 다만 선택된 수준 자체의 모델 요소와 의미는 count나 요약 문장으로 대체하지 않습니다.
- 승인된 bounded-context model의 bytes를 presentation-only 변경으로 무효화하면 안 되는 경우, 같은 context의 `domain-examples` 또는 `ubiquitous-language`에 명시된 검토용 presentation을 사용할 수 있습니다. 이때 Board는 model approval과 companion presentation 상태를 계속 분리합니다.
- `presentation_status: missing` 또는 invalid인 context는 정상 목록에서 제외하고 `사람용 설명 필요` attention과 exact source ref로만 제공합니다. `review_requested`는 후보 badge와 함께, exact human receipt가 있는 `ready`는 정상 표시합니다.
- domain meaning status, presentation status와 evidence freshness를 각각 표시하며 어느 하나로 다른 상태를 추론하지 않습니다.
- bounded context별 core/supporting/generic 구분, owner, `ai-domain-expert`, authority mode와 decision tier를 표시합니다.
- model revision, exact-byte human-confirmed/delegated-AI receipt, validation/freshness를 분리해 보여줍니다.
- 고객/domain expert, 기획자, 설계자, 개발자, QA role filter는 같은 stable model ID를 역할 관점별로 좁힐 뿐 별도 모델을 만들지 않습니다.
- 카드 첫 화면은 여러 줄로 작성된 purpose, 책임, 제외 범위, 사용자에게 보이는 실패와 미결정을 생략 없이 보여줍니다.
- 용어의 뜻·올바른 예·잘못된 예, business rule 전문, 정상·거절·장애 scenario와 counterexample을 추적 ID와 분리해 사람이 읽는 순서로 보여줍니다.
- 업무 경계, failure semantics, state transition, 결정 사항과 역할별 판단 기준은 접을 수 있는 상세 영역에서 원문 의미를 보존합니다.
- aggregate, business rule, scenario, command, event count는 탐색용 요약이며 실제 본문을 대신하지 않습니다.
- Board의 표시나 필터 조작은 모델 승인, 변경 또는 delivery 실행 권한을 만들지 않습니다. 중요한 판단은 별도 broker가 exact model/review bytes를 묶은 receipt로 기록한 후 projection이 다시 읽습니다.
- Board operation must not create or modify `docs/design/`. 시작·상태·새로고침·필터·검토는 이미 존재하는 `docs/design/` 원문을 읽는 동작일 뿐입니다. 원문이 없거나 legacy `BC-DISCOVERY`뿐이면 `not_configured` attention으로 표시하고, 별도 source-backed 도메인 모델링 작업 전에는 정상 모델이나 검토안을 합성하지 않습니다.

상단 bar의 `connected` 표시는 freshness를 의미하지 않습니다. `fresh`, `updating`, `direct`, `degraded`, `unknown`을 별도 badge로 표시합니다.

## Reference View Operations

`view` profile은 public release가 byte-pin한 `runtime/document-harness-view/`를 설치합니다. 디자인을 repository마다 다시 생성하지 않고, generated `config.json`의 static identity와 repository-specific source/probe/quality declaration만 바꿉니다.

업그레이드에서 새 필수 field가 생기면 adopter는 확인된 legacy shape에 한해 누락 field만 추가하고 기존 repository-specific 값은 유지합니다. 안전한 additive migration을 증명할 수 없는 config는 자동 교체하지 않고 conflict로 보고하며, 적용된 migration은 apply receipt로 되돌릴 수 있습니다.

```bash
./runtime/document-harness-view/bin/human-view doctor
./runtime/document-harness-view/bin/human-view refresh
./runtime/document-harness-view/bin/human-view start
./runtime/document-harness-view/bin/human-view status
./runtime/document-harness-view/bin/human-view url
./runtime/document-harness-view/bin/human-view stop
./runtime/document-harness-view/bin/human-view test
```

AI 도구는 사용자의 짧은 사용자 표시 언어 표현을 현재 repository의 위 명령으로 route합니다.

| 사용자 표현 | 수행할 기술 동작 |
| --- | --- |
| `View start`, `View open` | `human-view start` 후 `human-view url`로 현재 repository 주소를 안내 |
| `View status` | `human-view status` |
| `View refresh` | `human-view refresh` 후 새 snapshot sequence 확인 |
| `View stop` | `human-view stop` |

이 표현은 현재 repository의 독립 instance만 가리킵니다. 다른 repository 선택, remote bind, 임의 port 선점 또는 foreign process 종료 권한을 뜻하지 않습니다.

- `doctor`는 config/catalog/source/migration fence와 projection을 read-only 검사합니다.
- `refresh`는 allowlisted credential-free loopback probes를 읽고 runtime-local sanitized data만 atomic update합니다. quality command를 실행하지 않습니다.
- `start`는 exact `127.0.0.1:0`에 bind하고 OS-assigned port와 repository/instance/PID identity를 lease에 publish합니다.
- `stop`은 lease와 live health identity가 일치할 때만 SIGTERM을 보내며 foreign process는 kill하지 않습니다.
- reference transport는 `/api/v1/snapshot` ETag polling입니다. SSE는 alternate profile에만 선택적으로 추가합니다.

runtime-local state는 `.document-harness/runtime/view/` 아래에만 둡니다. runtime은 lease/snapshot/log/probe를 쓰기 전에 해당 디렉터리에 exact self-ignoring `.gitignore` marker를 만들고 검증하므로 root ignore rule이 없는 repository도 dirty하게 만들지 않습니다. marker가 foreign bytes 또는 symlink이면 덮어쓰지 않고 fail-closed합니다. View가 실패해도 project application runtime을 restart, deploy, scan 또는 mutate하지 않습니다.

## Locale-configured 표시 규칙

reference View의 기본 locale은 configured `presentation.locale`입니다.

- navigation, section title, helper/empty/error text와 AI가 작성하는 project description, `direction`, `title`, `humanSummary`, `why`, `scope`, `risk`, attention/gap 문구, `approvalRule`, source-reference `note`, 자유 서술 `evidenceKind` label은 자연스럽고 짧은 사용자 표시 언어를 사용합니다.
- policy/guideline/attention ID, enum 저장 값, repository path, revision/hash, command, exact source heading과 quote는 원형을 유지합니다. 화면에서는 사용자 표시 언어 label 또는 summary와 분리해 기술 metadata로 표시합니다.
- ID는 정책 제목보다 낮은 위계의 보조 정보입니다. 긴 ID와 source ref는 자기 cell/card 안에서 줄바꿈하고 인접 제목, badge 또는 column 위로 겹치지 않아야 합니다. 작은 화면에서는 ID를 detail 영역으로 이동할 수 있지만 복사 가능한 원문을 잃지 않습니다.
- 기존 영어 catalog의 human-facing field를 다른 표시 언어로 바꾸는 migration은 presentation-only입니다. stable ID, source ref/hash, authority, approval, enforcement, effective ref, receipt와 evidence freshness를 그대로 유지하고, 번역만으로 의미나 승인 상태를 바꾸지 않습니다.
- source heading이나 exact quote가 영어이면 provenance는 그대로 보여주되 별도의 사용자 표시 언어 summary를 제공합니다. 출처 문구를 번역한 값을 exact source라고 표시하지 않습니다.
- 정책·지침·추진안·도메인의 정상 목록은 검토 가능한 사람용 제목과 요약이 있는 항목만 포함합니다. 누락·invalid 항목은 원문을 숨기지 않되 기술 metadata를 정상 제목으로 올리지 않고 review attention에서 exact source로 연결합니다.
- `presentationStatus`는 authority/approval와 별도입니다. `ready`는 exact source bytes, subject ID와 locale을 고정한 human presentation receipt가 필요하며 번역·문장 다듬기만으로 승인이나 효력을 바꾸지 않습니다.

`View start`, `View screen`은 현재 repository의 View를 뜻합니다. `target board`, hardware board selection, board-porting처럼 하드웨어 문맥이 함께 있으면 View 명령으로 해석하지 않습니다.

## Seven-Tab Product Plan

### 개요

첫 화면은 사용자가 10초 안에 방향, 위험과 다음 확인 지점을 파악하는 summary입니다.

권장 layout:

1. plain-language project direction과 현재 focus를 담은 full-width lead panel
2. policy, guideline, unreviewed, attention, verification을 보여주는 compact metric row
3. 왼쪽의 governance/execution summary와 오른쪽의 `지금 확인할 항목` panel
4. recent source/verification 변화와 snapshot freshness를 보여주는 runtime strip

metric은 숫자만 표시하지 않고 의미와 기준 snapshot을 함께 표시합니다. 실행 checkpoint가 없으면 진행률을 추정하지 않고 `실행 체크포인트가 구성되지 않았습니다`처럼 source gap을 사용자 표시 언어로 명시합니다.

### 정책

사람이 정한 상위 방향과 AI가 따라야 하는 경계를 검토하는 first-class work surface입니다.

- 상단에 policy/candidate/effective/approved/unreviewed count를 표시합니다.
- search는 policy title, human summary, related guideline와 exact source path를 대상으로 합니다.
- filter chip은 authority, approval, enforcement, severity와 stale/conflict를 사용하고 활성 조건을 text로 보여줍니다.
- dense table의 기본 column은 `상태`, `정책`, `관련 지침`, `권한·승인`, `집행`, `근거`입니다.
- row expand는 why, scope, related guideline details, conflict, source heading/line/hash와 freshness를 한 자리에서 보여줍니다.
- candidate와 effective policy, AI confidence와 human approval은 같은 badge로 합치지 않습니다.
- 한 page에 읽기 어려운 전체 Markdown을 노출하지 않고 paginated rows와 structured detail을 사용합니다.

### 지침

정책을 설계·구현·운영에 적용하는 방법을 독립적으로 탐색하고 AI 도구와 함께 다듬는 first-class work surface입니다.

- 상단에 guideline/candidate/effective/approved/unreviewed count를 정책과 별도로 표시합니다.
- search는 guideline title, human summary, linked policy, exact source path를 대상으로 합니다.
- filter, pagination, expanded row state는 정책 tab과 공유하지 않고 지침 tab 자체에서 유지합니다.
- dense table의 기본 column은 `상태`, `지침`, `관련 정책`, `권한·승인`, `집행`, `근거`입니다.
- row expand는 why, scope, linked policy details, conflict, source heading/line/hash와 freshness를 보여줍니다.
- 정책 detail의 `관련 지침`과 지침 detail의 `관련 정책`은 같은 stable ID 관계를 양방향으로 보여줍니다.
- 관련 정책이 없으면 빈칸으로 숨기지 않고 `관련 정책 없음`을 표시하며 review 대상 여부를 별도로 판단합니다.

### 추진안

정책과 지침을 프로젝트 실행 경계로 전환하는 전략 단위입니다. 저장 형식의 canonical technical name은 `initiative`, 번호 문서는 `I####`, 사용자 화면 label은 `추진안`입니다.

- 정책은 추진안의 존재 이유와 비가역 경계인 `WHY`로 직접 연결하며 최소 한 개를 요구합니다.
- 지침은 이번 추진에서 선택한 `HOW`만 직접 연결합니다. 정책에 연결됐다는 이유로 모든 지침을 자동 상속하지 않습니다.
- 검토 중인 지침은 `적용됨`으로 과장하지 않고 `지침 검토 필요`로 표시합니다.
- 추진안은 결과, 지금 필요한 이유, 현재 초점, 성공 신호, 위험과 승인 상태를 보여줍니다.
- 연결 프로젝트는 Project의 `related_initiative`를 역색인해 상태·현재 초점·원문 경로까지만 보여줍니다. 프로젝트 진행률과 Task 상태를 추진안에서 임의 합산하지 않습니다.
- 추진안 승인과 활성화는 사람의 결정 영수증과 `I####` 문서가 필요하며 View 자체는 이를 수정하지 않습니다.

### 검토 대기

사람이 지금 판단해야 할 항목만 severity와 이유가 보이는 순서로 제공합니다.

- header summary는 `critical`, `decision`, `warning`을 text와 semantic indicator로 분리합니다.
- card는 exact request, why now, risk, recommended action, alternatives, source/checkpoint fence와 handoff target을 포함합니다.
- 같은 severity 안의 ordering reason을 보이며 age와 critical-path blocking을 숨은 점수로만 표현하지 않습니다.
- v1 read-only View에는 approve/reject mutation button을 제공하지 않습니다. Codex/Claude task 또는 durable source 위치로 handoff합니다.
- 빈 queue는 단순히 `0`만 표시하지 않고 현재 snapshot에서 actionable review가 없음을 설명합니다.

### 실행 상태

AI execute loop의 내부 상태를 관찰 가능한 contract로 풀어냅니다.

- lifecycle `status`와 execution `loop_state`를 나란히 두고 의미를 합치지 않습니다.
- current goal, hypothesis, last action, next actor/action, checkpoint sequence와 resume condition을 보여줍니다.
- iteration/time/cost budget은 source가 있을 때만 표시하고 missing field를 0으로 꾸미지 않습니다.
- fast/full/continuous validator receipt와 마지막 결과, environment/revision을 연결합니다.
- attention과 stop reason, residual risk, rollback/safe stop을 같은 snapshot에서 확인할 수 있게 합니다.
- checkpoint 또는 budget source가 없으면 `구성되지 않음` 상태와 필요한 source contract를 명확히 표시합니다. source enum이 별도로 존재하면 저장 값은 바꾸지 않고 label만 번역합니다.
- reference View는 loop-enabled `docs/tasks/T*.md`의 `checkpoint_ref`가 가리키는 canonical `docs/checkpoints/*.md` frontmatter만 execution source로 사용합니다. orphan file은 무시하고 task/checkpoint ID·revision·state 및 execution barrier를 검증합니다.
- 여러 linked checkpoint는 active/blocked non-succeeded work, active succeeded closeout, draft, historical terminal task 순으로 우선하고 같은 group에서 `recorded_at`, `attempt_seq`, `checkpoint_seq`, path 순으로 결정론적으로 선택합니다. 별도 JSON mirror나 mtime에서 progress를 만들지 않으며 더 최신인 completed history로 진행 중인 work를 숨기지 않습니다.
- checkpoint root/entry symlink, malformed frontmatter 또는 저장소 경계 위반은 `degraded`로 표시하고 다른 항목을 근거 없이 대신 선택하지 않습니다.

### 근거

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
- refresh가 search input을 비우거나 현재 tab을 `개요`로 되돌려서는 안 됩니다.
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

## 개요

개요는 상세 status report보다 다음 행동을 우선합니다.

- actionable attention 수와 oldest age
- active umbrella project와 current focus
- task를 `ready`, `running`, `awaiting_user`, `awaiting_external`, `needs_review`, `stopped`, `succeeded` lane으로 요약
- 최근 evidence/decision 변화
- policy trace break 또는 stale edge
- projection freshness와 runtime health

`Since last visit`는 browser-local snapshot sequence를 기준으로 계산할 수 있지만 source 상태나 unread truth로 사용하지 않습니다.

개요 card는 최소한 source link, status, loop state, current focus, updated time, freshness를 보여줍니다.

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

1. broker는 current goal/directive/approval을 확인하고 기존 결정에서 material delta 또는 human-only boundary가 없으면 새 approval card를 만들지 않습니다.
2. 사용자는 attention card에서 현재 목표, 지금까지 한 일, 왜 지금 결정이 필요한지, 기존 결정에서 달라지는 점, 추천안과 대안, 승인·비승인 효과를 configured `presentation.locale`로 먼저 읽습니다.
3. UI 또는 handoff target이 current source와 snapshot을 refresh합니다.
4. 별도 approval broker가 task contract revision, checkpoint, task source hash, diff hash, scope hash, expiry를 가진 preview를 만듭니다.
5. 사용자는 사람이 이해할 수 있는 선택으로 하나의 scoped action을 승인하거나 거부합니다. ID/hash/token은 하위 evidence이며 특정 opaque phrase 복사를 요구하지 않습니다.
6. broker는 실행 직전에 fence를 다시 검증합니다.
7. stale/expired/mismatched fence면 실행을 거부하고 새 preview를 요구합니다.
8. constrained executor가 승인된 source mutation만 수행합니다.
9. required validator를 실행하고 result receipt를 남깁니다.
10. projector가 source change를 관찰해 새 snapshot을 publish합니다.

확인 화면에는 다음을 반드시 보여줍니다.

- current goal과 지금까지 완료·확인한 작업
- approval이 필요한 이유와 기존 결정에서 달라지는 material delta
- 추천안, 대안과 각각의 영향
- 승인하면 실행되는 일, 승인하지 않을 때 멈추는 일과 계속 가능한 독립 작업
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
- [ ] fresh한 기존 결정을 반복 승인시키지 않고 material delta가 있을 때만 approval card를 만든다.
- [ ] 사람용 설명이 technical fence보다 먼저 보이고 opaque phrase 복사를 요구하지 않는다.
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
| parse 실패 | last valid record와 source readability | previous record는 `lastKnown`으로만 유지, 현재 approval/enforcement/evidence/execution은 `unverified`, 현재 승인·검토 count는 0, 오류 해결 후 retry |
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
- [ ] approved/effective badge는 complete current source fence와 실제 matching human decision/effective refs 없이는 표시되지 않는다.
- [ ] `실행 상태`는 canonical `docs/checkpoints/*.md`를 deterministic하게 선택하고 symlink/malformed input을 degraded 처리한다.
- [ ] alternate SSE profile이면 reconnect와 event gap full resync가 동작한다.
- [ ] reference ETag polling과 304가 동작한다.
- [ ] read-only API mutation method가 모두 거부된다.
- [ ] stale/degraded approval 실행이 0건이다.
- [ ] degraded fallback은 이전 승인·강제 상태를 녹색 current 상태로 표시하지 않고 `마지막 확인값 · 현재 미검증`으로 표시한다.
- [ ] approved write는 별도 broker/executor/validator receipt를 거친다.
- [ ] path traversal, symlink escape, excluded sensitivity, browser-origin 공격을 차단한다.
- [ ] cache 삭제 뒤 hidden decision/approval truth가 손실되지 않는다.
- [ ] top bar 왼쪽의 `<displayName> / <repository>`가 모든 tab과 scroll 위치에서 보이고 selector/workspace switcher가 없다.
- [ ] left sidebar 없이 `overview`, `domain`, `policies`, `guidelines`, `initiatives`, `review`, `execution`, `evidence`를 canonical order의 eight horizontal tabs로 제공하고 사용자 label은 `presentation.tabLabels`에서 읽는다.
- [ ] `정책`과 `지침` tab이 각각 독립 search/filter/pagination/detail state를 가지며 related guideline/policy를 양방향으로 연결한다.
- [ ] `추진안` tab이 독립 search/filter/pagination/detail state를 가지며 정책 WHY, 선택 지침 HOW와 역색인된 Project 연결을 보여준다.
- [ ] 모든 tab이 같은 snapshot/read fence를 사용한다.
- [ ] polling/manual refresh 뒤 active tab, filter, search, expansion과 focus가 유지된다.
- [ ] external CDN/font/script request가 없고 same-origin local asset만 사용한다.
- [ ] keyboard와 screen reader로 tab, filter, table expansion과 live freshness를 조작·이해할 수 있다.
- [ ] 사용자용 chrome과 synthesized governance/project wording이 configured `presentation.locale`이고 기술 ID·enum·path·hash·command·source heading은 원형을 유지한다.
- [ ] 사람용 설명이 missing/invalid인 정책·지침·추진안·도메인은 정상 목록에서 제외되고 `사람용 설명 필요` attention과 exact source ref만 표시된다.
- [ ] domain/governance approval, presentation readiness와 evidence freshness가 독립 상태로 표시된다.
- [ ] Domain 첫 화면에 AI Domain Expert supervision의 문제·model expectation·implementation reality·business/engineering impact·선택지·권고/confidence·정확한 사람 결정 질문이 먼저 표시된다.
- [ ] 코드/모델 변경 선택은 새 aligned review 전까지 해결됨으로 표시되지 않고, temporary deviation은 human risk acceptance와 expiry를 표시한다.
- [ ] Domain model card에 AI Domain Expert의 권고, 선택 수준과 이유, 보호 결과, 수정 조건과 그 수준의 실제 model slice가 표시된다.
- [ ] 긴 ID와 source ref가 자기 cell/card 안에서 줄바꿈되며 인접 content와 겹치지 않는다.
- [ ] migration fence, current repository와 source evidence freshness가 독립 상태다.
- [ ] View runtime/controller byte set이 release manifest와 installation lock에 pin되어 있다.

## References

- [Execution Loop Plane](../architecture/execution-loop-plane.md)
- [Human Control View Plane](../architecture/human-control-view-plane.md)
- [WHATWG HTML — Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [W3C PROV-DM — The PROV Data Model](https://www.w3.org/TR/prov-dm/)
- [Google SRE Book — Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [PatternFly — Tabs design guidelines](https://www.patternfly.org/components/tabs/design-guidelines/)
- [PatternFly — Tabs accessibility](https://www.patternfly.org/components/tabs/accessibility/)
- [PatternFly — Table design guidelines](https://www.patternfly.org/components/table/design-guidelines/)
- [PatternFly — Design tokens](https://www.patternfly.org/tokens/about-tokens/)
- `docs/architecture/control-plane.md`

## Change Log

- 2026-08-19: material-delta approval gate, 사람용 decision package와 opaque phrase 비의존 승인 UX를 추가했다.
- 2026-07-15: read-only local view, information architecture, attention, policy trace, freshness, SSE/polling, approval workflow, security 운영 기준을 생성했다.
- 2026-07-16: repository 정적 identity, five top tabs, tab별 product plan, refresh-stable interaction과 PatternFly-inspired local semantic design 기준을 추가했다.
- 2026-07-29: DDD landscape/context/model approval, role filter와 open question을 보여주는 read-only Domain 탭을 canonical navigation에 추가했다.
- 2026-07-16: shipped reference View의 doctor/refresh/start/status/url/stop/test, Node no-DB/ETag/lease-safe runtime과 migration/current/source fence 운영 절차를 추가했다.
- 2026-07-17: approval badge를 complete source/decision/effective evidence에 묶고 `실행 상태`를 canonical Markdown checkpoint의 deterministic fail-closed projection으로 정렬했다.
- 2026-07-17: locale-configured 표시, 기술 식별자 원형 보존, presentation-only localization과 긴 ID containment 계약을 추가했다.
- 2026-07-17: 화면의 displayName 기반 사용자명을 `Board`로 정하고 정책과 지침을 독립 최상위 tab과 양방향 관계로 분리했다.
- 2026-07-17: 정책·지침과 프로젝트 사이에 별도 `I####` 추진안 계층과 일곱 번째 top tab을 추가했다.
- 2026-07-30: 사람용 설명이 없는 governance/domain 항목의 정상 표시 차단, presentation receipt와 세 상태 분리 계약을 추가했다.
- 2026-07-31: AI Domain Expert의 최소 충분 모델링 수준 선택과 실제 domain model review package를 Domain 첫 화면 계약으로 추가했다.
