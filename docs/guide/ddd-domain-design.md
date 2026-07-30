---
type: guide
title: ddd-domain-design
status: current
owner: document-harness
created: 2026-07-29
updated: 2026-07-29
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

이 guide는 `docs/design/`을 고객, 도메인 전문가, 기획자, 설계자, 개발자와 QA가 함께 사용하는 DDD domain truth로 제한하고 AI가 근거 없는 업무 의미를 current truth로 만들지 못하게 하는 authoring·검토·활용 계약입니다.

## Authority Boundary

- 형식, 참조 무결성, revision과 coverage는 validator가 검사합니다.
- 업무 의미, 용어, rule, 예외와 customer outcome은 사람인 domain expert가 exact document bytes를 검토합니다.
- AI는 인터뷰, Example Mapping, 후보 모델, 반례, 모순과 semantic diff를 작성할 수 있지만 `current` 승격과 expert approval을 수행하지 않습니다.
- 코드·DB·API에서 관찰한 동작은 source evidence 또는 model candidate이며 그 자체로 business truth가 아닙니다.

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

1. `domain-landscape`에서 고객 결과, core/supporting/generic subdomain과 domain expert role을 확인합니다.
2. `context-map`에서 대상 bounded context와 upstream/downstream 관계를 선택합니다.
3. domain expert source, 실제 업무 example, counterexample과 disputed meaning을 수집합니다.
4. 먼저 language·scenario·business rule을 작성하고 aggregate를 solution-first로 발명하지 않습니다.
5. command, domain event, invariant, state transition과 consistency boundary를 연결합니다.
6. 역할별 consumer contract와 downstream project/task/QA trace를 기록합니다.
7. AI는 `draft` 또는 `review_requested`로 handoff하고 exact human review를 요청합니다.
8. 사람의 approval receipt가 current document SHA-256과 model revision을 고정한 뒤에만 `current`로 승격합니다.

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
| customer / domain expert | landscape → target language → examples → disputed items | outcome와 의미의 확인·정정 |
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

Board와 validator는 다음 세 축을 합치지 않습니다.

- domain meaning: `draft`, `review_requested`, `current`
- presentation: `missing`, `review_requested`, `ready`
- evidence freshness: `fresh`, `stale`, `degraded`

`ready` presentation은 domain model을 승인하지 않습니다. 반대로 exact-byte 승인된
domain model도 사람용 설명이 `missing` 또는 invalid이면 정상 Board card에
표시하지 않고 `사람용 설명 필요` attention과 exact source ref만 제공합니다.
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
context registry, role view, presentation shape와 current approval receipt를
검사합니다. `presentation_status: ready`는 별도 human presentation receipt가
current document bytes와 일치해야 합니다. 의미 품질은 domain expert review가
담당하며 validator 통과나 presentation review로 사람의 domain 승인을 대체하지
않습니다.

## Migration

기존 `docs/design`의 architecture/governance 문서는 target repository ownership을 보존하며 점진적으로 재분류합니다. adoption은 old project-owned file을 삭제하거나 덮어쓰지 않고 새 DDD surface와 explicit migration attention을 추가합니다.

## Change Log

- 2026-07-29: DDD-only design surface, expert approval, role loading, traceability와 migration 계약을 추가했다.
- 2026-07-30: 사람용 제목·요약, presentation review receipt, 세 상태 분리와 Board 차단 계약을 추가했다.
