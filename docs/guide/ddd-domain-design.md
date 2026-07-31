---
type: guide
title: ddd-domain-design
status: current
owner: document-harness
created: 2026-07-29
updated: 2026-07-31
related_project: []
related_task: []
related_design:
  - docs/design/domain-landscape.md
  - docs/design/context-map.md
source_refs: []
tags:
  - docs/guide
  - ddd
  - domain-model
---

# DDD Domain Design

## Purpose

이 guide는 `docs/design/`을 고객, 기획자, 설계자, 개발자와 QA가 함께 사용하는 DDD domain truth로 제한하고, AI Domain Expert가 역할 AI 사이의 업무 의미를 통제하면서 중요한 판단만 사람이 Board에서 결정하게 하는 authoring·검토·활용 계약입니다.

## Authority Boundary

- 형식, 참조 무결성, revision과 coverage는 validator가 검사합니다.
- `ai-domain-expert`는 domain landscape, context map, ubiquitous language, rule, scenario와 model change를 종합 관리하는 기본 의미 통제 역할입니다. planner·architect·developer·QA AI는 이 역할의 검토 없이 독립적으로 업무 의미를 바꾸지 않습니다.
- AI Domain Expert는 source와 실제 example을 근거로 routine하고 가역적인 변경을 위임 범위 안에서 current로 만들 수 있습니다. AI가 자신의 위임 범위를 만들거나 넓힐 수는 없습니다.
- customer right, money, legal/compliance, security, 조직 책임, bounded-context 분할·병합, core-domain 분류, 비가역 migration, 충돌하거나 신뢰도가 낮은 업무 의미는 Board에서 사람이 결정합니다.
- 코드·DB·API에서 관찰한 동작은 source evidence 또는 model candidate이며 그 자체로 business truth가 아닙니다. 근거가 없으면 AI Domain Expert는 가설과 불확실성으로 표시하고 조용히 확정하지 않습니다.
- 사람은 상시 Domain Expert 직군을 대신하지 않습니다. AI Domain Expert가 선택·설명한 중요한 모델링 판단의 최종 권위자이며, policy·조직 권한·위험 수용은 계속 사람에게 남습니다.

## Design Surface Contract

`docs/design/`은 다음 DDD current-truth 종류만 포함합니다.

| Design Kind | Responsibility |
| --- | --- |
| `domain-landscape` | domain vision, customer outcome, subdomain portfolio와 core differentiation |
| `context-map` | bounded context registry, upstream/downstream와 relationship pattern |
| `bounded-context` | aggregate, entity, value object, command, event, policy, invariant와 lifecycle |
| `ubiquitous-language` | bounded context 안의 canonical language와 context 간 translation |
| `domain-examples` | 정상·경계·거절·예외 example과 QA derivation |

기술 runtime, storage, API transport, View implementation과 운영 control은 `docs/architecture/`, policy·approval·initiative authority는 `docs/governance/`가 소유합니다. 기술 구조가 domain model을 대체하거나 business term을 재정의할 수 없습니다.

## Authoring Workflow

1. `domain-landscape`에서 고객 결과, core/supporting/generic subdomain과 `ai-domain-expert` 의미 통제 역할을 확인합니다.
2. `context-map`에서 대상 bounded context와 upstream/downstream 관계를 선택합니다.
3. AI Domain Expert가 사람·문서·운영·코드에서 domain source, 실제 업무 example, counterexample과 disputed meaning을 수집하고 source authority를 구분합니다.
4. 먼저 language·scenario·business rule을 작성하고 aggregate를 solution-first로 발명하지 않습니다.
5. command, domain event, invariant, state transition과 consistency boundary를 연결합니다.
6. 역할별 consumer contract와 downstream project/task/QA trace를 기록합니다.
7. AI Domain Expert는 semantic diff, 근거, 반례, confidence와 영향도를 검토하고 `aligned`, `model_updated`, `board_attention`, `blocked_conflict` 중 하나를 반환합니다.
8. routine·가역 변경은 유효한 delegated-AI receipt로 current가 될 수 있습니다. 중요한 변경은 아래 Board Review Contract에 따라 사람이 읽을 모델링 수준을 선택하고 `review_requested`로 넘깁니다.
9. 사람의 결정 또는 유효한 delegated-AI receipt가 current document SHA-256, model revision과 authority mode를 고정한 뒤에만 `current`로 승격합니다.

## AI Domain Expert Contract

AI Domain Expert는 특정 LLM 제품명이 아니라 Codex와 Claude를 포함한 provider-neutral repository 역할입니다. 이 역할은 다음을 수행합니다.

- 여러 역할 AI가 제안한 용어, 규칙, entity, aggregate, boundary와 scenario의 semantic diff를 한 곳에서 심사합니다.
- source authority, freshness, 실제 example, counterexample과 구현 feedback을 함께 비교합니다.
- 같은 용어의 의미 충돌, context leakage, aggregate 밖의 invariant, 서비스 경계와 bounded-context 경계의 불일치를 찾습니다.
- 근거가 충분하고 위임 범위 안인 변경은 스스로 반영하고 receipt를 남깁니다.
- 중요한 의미 결정은 원문 전체가 아니라 사람이 결정할 수 있는 최소 충분 도메인 모델로 종합해 Board에 올립니다.
- 정책 승인, 조직 책임 배정, 법적 판단, 위험 수용과 자신의 권한 확대는 수행하지 않습니다.

모델 작성 AI와 AI Domain Expert 검토 단계는 논리적으로 분리합니다. 같은 실행 환경을 사용하더라도 작성 결과, challenge 결과, source fence와 최종 판단을 receipt에서 구분하여 조용한 self-rubber-stamp를 막습니다.

## Board Review Contract

Board의 Domain 영역은 technical metadata 목록이나 모든 DDD 요소의 dump가 아닙니다. AI Domain Expert가 근거·충돌·역할 영향·반례를 종합하고, 사람이 실제로 승인하거나 수정할 수 있도록 선택한 도메인 모델링 결과물입니다.

`bounded-context` model은 다음 필드를 가집니다.

| Field | Meaning |
| --- | --- |
| `domain_expert_agent` | 의미 통제를 수행한 provider-neutral AI 역할. 기본값은 `ai-domain-expert` |
| `authority_mode` | `delegated-ai`, `human-required`, `human-confirmed` |
| `decision_tier` | `routine`, `material`, `strategic` |
| `board_review_level` | Board에 제시할 최소 충분 모델링 수준 |
| `board_review_status` | `not_required`, `review_requested`, `confirmed` |
| `board_decision_ref` | 사람이 결정한 경우 exact decision receipt |

`board_review_level`은 다음 중 정확히 하나를 사용합니다. 여러 독립 판단이 필요하면 `mixed`로 뭉치지 않고 별도 model revision 또는 review package로 나눕니다.

| Level | 사람이 판단할 질문 |
| --- | --- |
| `bounded-context` | 어느 업무가 어디에 속하고 누가 실패와 결과를 책임지는가 |
| `aggregate` | 어떤 일관성과 불변 조건을 한 단위에서 지켜야 하는가 |
| `entity` | 무엇을 같은 대상으로 식별하며 수명주기가 어떻게 이어지는가 |
| `value-object` | 어떤 값의 의미·유효성·동등성을 함께 고정해야 하는가 |
| `business-rule` | 어떤 조건에서 허용·거절되어야 하는가 |
| `state-transition` | 어떤 요청으로 상태가 바뀌고 무엇을 기록해야 하는가 |
| `ubiquitous-language` | 어떤 말을 어떤 뜻으로 사용하고 무엇과 구분해야 하는가 |
| `scenario` | 정상·거절·예외 상황에서 사용자가 어떤 결과를 보아야 하는가 |

AI Domain Expert는 가장 추상적인 수준을 고르는 것이 아니라, 중요한 의미를 잃지 않으면서 사람이 코드 지식 없이 판단할 수 있는 가장 작은 수준을 고릅니다. `AI Domain Expert Board Review`에는 권고 결정, 선택 이유, 사람이 확인할 핵심, 승인으로 보호되는 결과, 수정해야 하는 조건을 자연어로 적습니다. Board는 이 판단과 선택된 모델을 첫 화면에 보여주고 전체 language/rule/scenario와 exact IDs는 상세 근거로 내립니다.

## Stable Model IDs

| Prefix | Meaning |
| --- | --- |
| `BC-*` | bounded context |
| `TERM-*` | context-local term |
| `AGG-*` | aggregate |
| `ENT-*` | entity |
| `VO-*` | value object |
| `CMD-*` | command |
| `EVT-*` | domain event |
| `POL-*` | domain policy/service/process |
| `BR-*` | business rule or invariant |
| `SCN-*` | executable business example |

ID는 의미 있는 revision 간 유지합니다. 이름이 바뀌어도 같은 개념이면 ID를 유지하고, 의미가 갈라지면 새 ID와 migration impact를 만듭니다.

## Role Loading Contract

| Role | Required Read Order | Required Output |
| --- | --- | --- |
| customer / business decision owner | AI Domain Expert Board package → 필요한 source evidence | 중요한 outcome와 의미의 승인·정정 |
| ai-domain-expert | landscape → context map → affected model/language/examples → source/evidence | semantic review, model update 또는 Board attention |
| planner | landscape → context map → scenarios → rules / state transitions | requirement와 acceptance criteria |
| architect | context map → aggregate / consistency → integration | boundary와 architecture decision |
| developer | target model → language → commands/events/rules → examples | code/API/event/test naming and behavior |
| qa | target rules/transitions/examples → related task | BR/SCN-linked checks and evidence |

역할별 화면과 context packet은 하나의 domain source에서 파생합니다. 역할별 truth 문서를 따로 복제하지 않습니다.

## Human Presentation Contract

DDD 문서의 업무 의미 승인과 Board에서 읽을 수 있는 표현은 별도 상태입니다. 모든
design kind는 다음 frontmatter를 사용할 수 있습니다.

| Field | 의미 |
| --- | --- |
| `display_title` | configured `presentation.locale`의 짧은 사람용 제목 |
| `human_summary` | 누가 어떤 결과를 얻고 무엇을 판단해야 하는지 설명하는 2~4문장 |
| `presentation_status` | `missing`, `review_requested`, `ready` |
| `presentation_ref` | `ready` 문구의 exact bytes와 locale을 확인한 human receipt |

`domain-landscape`, `context-map`, `bounded-context`가 `review_requested` 또는
`ready`라면 `Human Review Summary`에 보호할 결과나 책임, 제외 범위, 사용자에게
보이는 실패와 미결정을 먼저 적습니다. 용어 표는 canonical term과 사람말 풀이,
올바른 예, 잘못된 예, 헷갈리기 쉬운 말을 분리합니다. scenario는 actor, 상황,
요청, 사용자 결과와 거절 이유를 먼저 보여주고 `TERM-*`, `BR-*`, `SCN-*`,
command/event는 추적 정보로 유지합니다.

Board와 validator는 다음 네 축을 합치지 않습니다.

- domain meaning: `draft`, `review_requested`, `current`
- authority mode: `delegated-ai`, `human-required`, `human-confirmed`
- presentation: `missing`, `review_requested`, `ready`
- evidence freshness: `fresh`, `stale`, `degraded`

`ready` presentation은 domain model을 승인하지 않습니다. 반대로 exact-byte 승인된
domain model도 사람용 설명이 `missing` 또는 invalid이면 정상 Board card에
표시하지 않고 `사람용 설명 필요` attention과 exact source ref만 제공합니다.
이미 승인되었거나 다른 authority의 source fence가 전체 model bytes를 고정한 경우,
같은 bounded context의 `domain-examples`가 `review_requested` 사람용 제목·요약을
소유할 수 있습니다. Board는 bounded-context model, `domain-examples`,
`ubiquitous-language` 순서로 명시된 presentation을 찾으며, model의 업무 의미와
approval bytes는 바꾸지 않습니다. `Human Review Summary`가 없는 legacy model은
기존 경계·실패·미결정 section을 생략 없이 읽어 검토 요약으로 투영합니다.
기존 repository upgrade는 문서를 자동 번역하거나 승인하지 않고 누락 상태를
attention으로 드러냅니다.

## Change And Freshness Contract

- current document가 바뀌면 기존 approval receipt는 stale입니다.
- term, context boundary, aggregate, rule, command, event, state transition 변경은 `Change Impact`에 역할·delivery·QA·published contract 영향을 적습니다.
- functional `project`와 `task`는 exact current `domain_model_refs`를 사용합니다. domain 영향이 정말 없으면 `domain_impact: none`과 검토 가능한 이유를 적습니다.
- QA는 모든 적용 `BR-*`와 `SCN-*`를 check로 추적합니다. section 존재만으로 coverage를 주장하지 않습니다.

## Validation

```bash
./docs/bin/validate-domain-design.sh --all
```

validator는 허용된 design kind, metadata, 필수 section, placeholder, stable ID,
context registry, role view, AI Domain Expert Board package, presentation shape와
current authority receipt를 검사합니다. `presentation_status: ready`는 별도 human
presentation receipt가 current document bytes와 일치해야 합니다. `review_requested`
사람용 설명은 AI가 작성한 Board 후보임을 표시한 채 읽을 수 있습니다. validator
통과는 source-bounded authority와 Board 결정을 대체하지 않습니다.

## Migration

기존 `docs/design`의 architecture/governance 문서는 target repository ownership을 보존하며 점진적으로 재분류합니다. adoption은 old project-owned file을 삭제하거나 덮어쓰지 않고 새 DDD surface와 explicit migration attention을 추가합니다.

## Change Log

- 2026-07-29: DDD-only design surface, expert approval, role loading, traceability와 migration 계약을 추가했다.
- 2026-07-30: 사람용 제목·요약, presentation review receipt, 세 상태 분리와 Board 차단 계약을 추가했다.
- 2026-07-31: AI Domain Expert의 위임 권위, 최소 충분 모델링 수준 선택과 Board domain review package 계약을 추가했다.
