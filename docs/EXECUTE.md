---
type: guide
title: execute
status: current
owner: Codex
created: 2026-07-15
updated: 2026-07-18
related_design:
  - docs/design/control-plane.md
  - docs/design/policy-to-evidence-governance.md
  - docs/design/initiative-governance-plane.md
  - docs/design/execution-loop-plane.md
  - docs/design/human-control-view-plane.md
source_refs:
  - docs/_indexes/execution-loop-policy.yaml
  - docs/guide/governance-authoring-assistance.md
  - docs/guide/execution-loop-operations.md
tags:
  - docs/guide
  - execution-entry
  - orchestration
---

# Execute

- Type: guide
- Status: current
- Owner: Codex
- Created: 2026-07-15
- Updated: 2026-07-18
- Related Design: docs/design/control-plane.md; docs/design/policy-to-evidence-governance.md; docs/design/initiative-governance-plane.md; docs/design/execution-loop-plane.md; docs/design/human-control-view-plane.md

## Purpose

이 문서는 loop-enabled task를 시작하거나 재개할 때 사용하는 **단일 orchestration index**입니다. schema와 상세 설명을 복제하지 않고, 무엇을 어떤 순서로 읽고 어떤 gate에서 진행·중단·handoff할지만 고정합니다.

## Load Order

다음 순서만 기본으로 읽고, 관련 없는 문서 전체를 broad-load하지 않습니다.

1. repository `AGENTS.md`
2. 이 문서와 `docs/guide/governance-authoring-assistance.md`의 Mandatory Governance Preflight
3. current task의 lineage metadata와 `related_project`
4. current project와 그 source가 소유한 `related_initiative`
5. active이고 승인된 추진안의 outcome/scope, policy relation, guideline disposition과 exact refs
6. current task 전체와 `task_contract_revision`
7. current `checkpoint_ref`; `ready` draft의 첫 실행이면 checkpoint template
8. 추진안과 task/checkpoint가 exact ref로 고정한 effective policy, required guideline/normative standard, exception, human/repository directive
9. task가 직접 참조하는 design, guide, QA와 relevant validator
10. 필요한 approval/decision receipt와 evidence source

proposal report, search hit, browser snapshot, chat history는 effective authority를 대체하지 않습니다. 방금 바뀐 source는 index/RAG가 아니라 직접 읽습니다.

## Governance Gate

정책·지침·추진안은 project/task가 선택적으로 참고하는 배경 문서가 아니라 실행 전에 확인해야 하는 상위 거버넌스입니다.

1. source revision/hash와 approval receipt를 확인해 current/fresh authority인지 판정합니다. modern lineage의 추진안은 `docs/lib/initiative-authority.mjs`가 canonical 문서·register/catalog·repository JSON activation receipt를 함께 검증해야 하며 frontmatter의 `approved` 문자열만으로 통과하지 않습니다.
2. 정책의 WHY·비가역 경계, 지침의 HOW·적용/검증 수준, 추진안의 outcome·scope를 서로 분리해 적습니다.
3. task action과 acceptance가 세 surface를 모두 준수하는지 확인합니다.
4. project/task는 delivery를 구체화할 수 있지만 policy/guideline/initiative를 약화하거나 새 의미로 재해석할 수 없습니다.

필수 source가 없거나, required governance가 미승인·stale이거나, 관계가 충돌하거나, 요청이 추진안 scope/out of scope를 바꾸면 실행하지 않고 human attention을 만듭니다. proposal과 migration candidate는 검토 대상이지 effective 실행 권한이 아닙니다.

명시된 legacy bridge는 exact policy/normative refs와 기존 승인 경계를 유지하는 동안만 실행할 수 있습니다. 추진안 연결 공백은 attention으로 노출하되 migration을 핑계로 기존 authority를 임의 변경하지 않습니다.

## Start Gate

실행 전에 다음을 답할 수 있어야 합니다.

- 목표와 `Goal ID`, 완료 조건, out of scope는 무엇인가?
- 적용되는 정책 WHY/경계, required 지침 HOW/검증, 승인된 추진안 outcome/scope와 exact revision은 무엇인가?
- project/task action이 추진안 lineage와 일치하고, 미승인 후보나 stale source에 기대지 않는가?
- 누가 다음 actor이고 어떤 authority로 행동하는가?
- 적용되는 policy/directive exact revision은 무엇인가?
- baseline 또는 reproduce 방법과 가장 싼 관련 검사는 무엇인가?
- 허용된 변경 surface, forbidden action, risk tier는 무엇인가?
- iteration/time budget과 stop condition은 무엇인가?
- user approval, external result, secret, production access가 필요한가?

하나라도 작업 결과를 바꿀 정도로 비어 있으면 구현하지 않고 정확한 attention을 만듭니다.

## Execute Loop

1. policy/guideline/initiative preflight 결과와 task contract의 exact authority refs를 pin합니다.
2. baseline 또는 reproduce check를 먼저 실행합니다.
3. 한 번에 하나의 hypothesis만 둡니다.
4. 작고 가역적인 bounded action 하나를 수행합니다.
5. 가장 관련성 높은 fast check를 실행합니다.
6. last action, evidence delta, risk, next actor/action, resume condition을 checkpoint에 반영합니다.
7. durable command/test/review/decision receipt를 연결합니다.
8. 진전이 있으면 다음 bounded loop로 이어가고, 없으면 hypothesis를 재검토하거나 stop rule을 적용합니다.

checkpoint는 current resume snapshot이고 task `Status`는 append-only milestone history입니다. tool call마다 기록하지 않고 attention, session handoff, validation result, stop/resume, completion barrier처럼 복구 가치가 있는 경계에서 갱신합니다.

## State Routing

| Loop State | Required Action |
| --- | --- |
| `ready` | contract를 확인하고 baseline 뒤 첫 bounded attempt를 시작 |
| `running` | hypothesis 하나, action 하나, fast verification 하나를 수행 |
| `awaiting_user` | exact question, recommendation/alternatives, impact, resume condition을 사용자에게 제시 |
| `awaiting_external` | source revision을 확인하고 외부 관찰 조건과 재확인 시점을 기록 |
| `needs_review` | 계약 변경 없이 필요한 독립 review disposition을 수집 |
| `stopped` | stop reason을 해소한 receipt/directive와 증가한 `attempt_seq` 없이는 재개 금지 |
| `succeeded` | 아직 lifecycle `done`이 아니므로 Goal Verification과 closeout gate 실행 |

authority 또는 policy 충돌로 현재 attempt를 실행할 수 없으면 `stopped / CONFLICT`와 human attention을 사용합니다. 단순히 독립 검토가 필요한 상태를 `CONFLICT`로 과장하지 않습니다.

## Evidence Barrier

`succeeded` 전에 다음이 모두 필요합니다.

- task contract/source revision과 policy/guideline/initiative preflight에 연결된 evidence
- required fast/full check와 필요한 review receipt
- unresolved attention 없음
- goal별 verification evidence
- scope drift, validator weakening, test 삭제·완화가 없음

AI가 `done`, `approved`, `passed`라고 쓴 문자열은 receipt나 human authority가 아닙니다. 정적 validator는 schema와 ref를 검사할 뿐 실제 command 실행과 승인 주체를 증명하지 않습니다.

## Stop And Ask

다음 조건에서는 추측하거나 범위를 넓히지 않습니다.

- goal, acceptance, authority, directive가 불명확하거나 충돌함
- required policy/guideline/initiative가 missing, stale, unapproved이거나 delivery scope와 충돌함
- task contract 변경, scope 확대, 비가역 action이 필요함
- high/critical risk, secret, production, external write가 필요함
- 동일 실패/no-progress 또는 iteration/time budget 한도 도달
- validator나 completion criterion을 약화해야 통과할 수 있음
- checkpoint만으로 안전하게 재개할 수 없음

`stopped` checkpoint에 reason, attention, next actor/action, `resume_when`을 남깁니다.

## Closeout

1. `loop_state: succeeded`와 terminal checkpoint를 확인합니다.
2. Goal Inventory와 Goal Verification을 1:1로 맞춥니다.
3. 각 goal evidence가 resolvable receipt/artifact를 가리키는지 확인합니다.
4. WBS, residual risk, outputs/handoff를 정리합니다.
5. relevant project-specific check와 adopted-target validator를 실행합니다.
6. 검증을 통과한 source만 `done`으로 전환합니다.

## Verification

### Adopted Repository

target repository에서는 설치된 execution-loop validator, `document-harness.yaml`이 지정한 project-owned quality command, installation verifier를 실행합니다. `quality.fast`, `quality.full`, `quality.continuous`는 문자열을 복사해 추측하지 말고 현재 repository 설정에서 직접 읽습니다. View profile이 설치된 경우 `human-view doctor|test|snapshot`이 기본 command입니다.

```bash
./docs/bin/validate-execution-loop.sh --all
./docs/bin/harness-adopt verify --target .
git diff --check
```

### Public Distribution Source Only

아래 validator는 public `document-harness` distribution 자체의 release surface를 검증합니다. adopted target 설치 계약에는 포함되지 않으며, target에서 존재한다고 가정하거나 실행하지 않습니다.

```bash
./docs/bin/validate-codex-readiness.sh
./docs/bin/validate-harness-foundation.sh
./docs/bin/validate-doc-retrieval.sh
./docs/bin/validate-closeout.sh --all
```

## Human Handoff

handoff에는 최소한 goal, task/attempt/checkpoint revision, last valid evidence, next actor/action, exact requested response, alternatives/impact, residual risk, resume condition을 포함합니다. local human view가 있다면 같은 source revision과 freshness를 보여주되 view 자체를 authority로 취급하지 않습니다.

## References

- authority와 policy promotion: `docs/design/policy-to-evidence-governance.md`
- 거버넌스 역할 분리, 사용자 작성 지원과 mandatory preflight: `docs/guide/governance-authoring-assistance.md`
- 추진안과 project lineage: `docs/design/initiative-governance-plane.md`
- machine state/stop/defaults: `docs/_indexes/execution-loop-policy.yaml`
- state/checkpoint/receipt contract: `docs/design/execution-loop-plane.md`
- 운영 예외와 failure response: `docs/guide/execution-loop-operations.md`
- 사용자 projection: `docs/guide/human-control-view.md`
- projector/API/SSE/freshness/security: `docs/design/human-control-view-plane.md`

## Change Log

- 2026-07-18: policy/guideline/initiative를 project/task 실행 전 mandatory governance gate로 추가하고 freshness, approval, lineage와 conflict stop을 고정했다.
- 2026-07-15: loop-enabled task의 load order, start gate, state routing, evidence barrier, closeout과 handoff를 단일 실행 진입점으로 정리했다.
