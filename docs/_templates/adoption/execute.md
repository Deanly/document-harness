---
type: guide
title: execute
status: current
owner: document-harness
related_design:
  - docs/architecture/control-plane.md
  - docs/governance/policy-to-evidence.md
  - docs/governance/initiative-governance.md
  - docs/architecture/execution-loop-plane.md
  - docs/architecture/human-control-view-plane.md
source_refs:
  - docs/_indexes/execution-loop-policy.yaml
  - docs/guide/governance-authoring-assistance.md
  - docs/guide/execution-loop-operations.md
tags:
  - docs/guide
  - execution-entry
---

# Execute

## Purpose

이 문서는 adopted repository에서 loop-enabled task를 시작하거나 재개하는 단일 실행 진입점입니다. lifecycle status, loop state, checkpoint, evidence와 human authority를 분리합니다.

## Load Order

1. repository `AGENTS.md`
2. 이 문서와 `docs/guide/governance-authoring-assistance.md`의 Mandatory Governance Preflight
3. current task의 lineage metadata와 `related_project`
4. current project와 source가 소유한 `related_initiative`
5. active이고 승인된 추진안의 outcome/scope, policy relation, guideline disposition과 exact refs
6. current task와 `task_contract_revision`
7. current `checkpoint_ref`; 첫 실행이면 `docs/_templates/execution-checkpoint.md`
8. affected bounded context의 authoritative/current DDD model과 latest AI Domain Expert supervision review
9. 추진안과 task/checkpoint가 고정한 effective policy, required guideline/normative standard, exception, design과 receipt

검색 결과나 View snapshot은 current source를 대체하지 않습니다.

## Governance Gate

정책·지침·추진안은 project/task 실행 전 mandatory upper governance입니다. source revision/hash, approval receipt와 freshness를 확인하고 policy WHY/boundary, guideline HOW/applicability/verification, initiative outcome/scope를 분리해 현재 action과 대조합니다. modern lineage의 추진안은 `docs/lib/initiative-authority.mjs`가 canonical 문서·register/catalog·repository JSON activation receipt를 함께 검증해야 하며 frontmatter의 `approved` 문자열만으로 통과하지 않습니다. Project/task는 delivery를 구체화할 수 있지만 상위 거버넌스를 약화하거나 재해석할 수 없습니다.

required governance가 missing, stale, unapproved이거나 서로 충돌하면 실행하지 않고 exact gap, 영향, 선택지와 resume condition을 attention으로 만듭니다. proposal/migration candidate는 effective authority가 아닙니다. 명시된 legacy bridge는 exact policy/normative refs를 유지할 때만 허용하고 initiative gap을 숨기지 않습니다.

## Start Gate

- Goal ID, 완료 조건, out of scope와 허용 변경 surface가 명확해야 합니다.
- 적용 policy, required guideline, approved initiative와 exact revision/freshness가 명확하고 delivery scope와 일치해야 합니다.
- 적용 policy/directive와 human authority revision을 확인합니다.
- baseline, 가장 싼 관련 검사, full check와 stop condition을 정합니다.
- secret, production, external write 또는 비가역 action이 필요하면 먼저 attention을 만듭니다.
- AI Domain Expert가 delivery boundary와 current model을 확인하고 구현 변경을 감독할 수 있어야 합니다.
- Fresh한 goal/directive/approval이 현재 action을 이미 허용하면 다시 승인받지 않습니다. Goal과 non-waivable boundary 안의 routine·가역·저위험 구현 세부사항은 agent가 판단하고, material delta 또는 human-only boundary가 있을 때만 새 승인을 요청합니다.

## Execute Loop

1. policy/guideline/initiative preflight, task contract와 source revision을 pin합니다.
2. baseline 또는 reproduce check를 먼저 실행합니다.
3. hypothesis 하나와 작고 가역적인 action 하나를 수행합니다.
4. 가장 관련성 높은 fast check를 실행합니다.
5. 의미 있는 코드·DB·API·event·test 변경이면 AI Domain Expert가 exact model/implementation bytes를 다시 감독합니다.
6. 불일치면 코드 변경, 모델 변경, 임시 편차, 중단 대안과 engineering 권고를 Board에 제시하고 `decision-required` 또는 `blocked-conflict`로 멈춥니다.
7. checkpoint의 last action, evidence, risk, next actor/action, resume condition과 domain supervision ref를 갱신합니다.
8. required receipt를 연결하고 계속, review, stop 또는 success를 결정합니다.

## State Routing

| Loop State | Required Action |
| --- | --- |
| `ready` | baseline 뒤 첫 bounded attempt를 시작 |
| `running` | hypothesis/action/fast check 하나씩 수행 |
| `awaiting_user` | exact question, alternatives, impact와 resume condition 제시 |
| `awaiting_external` | 외부 관찰 조건과 재확인 시점 기록 |
| `needs_review` | 독립 review disposition 수집 |
| `stopped` | stop reason을 해소한 새 receipt/directive 전에는 재개 금지 |
| `succeeded` | Goal Verification과 closeout gate로 이동 |

authority 또는 policy 충돌은 `stopped / CONFLICT`와 human attention으로 반환합니다.

중단은 승인이나 충돌에 의존하는 최소 task/action에 한정합니다. 다른 작업은 dependency가 없고 자체 governance/domain authority가 current라는 evidence가 있을 때만 계속합니다.

## Evidence Barrier

`succeeded` 전에 current task/source revision과 governance preflight에 연결된 fast/full check, 필요한 review receipt, goal별 evidence, scope check, unresolved-attention 0건과 exact-byte AI Domain Expert supervision이 필요합니다. 미해결 domain decision/conflict는 성공이 아니며, AI가 작성한 `passed` 문자열은 receipt가 아닙니다.

## Stop And Ask

goal, authority, policy/guideline/initiative, approval/freshness fence가 불명확하거나 충돌할 때, budget이 소진됐을 때, validator를 약화해야 할 때, 복구 불가능한 action이 필요할 때 중단합니다. `stopped` checkpoint에 reason, next actor/action과 `resume_when`을 남깁니다.

## Closeout

1. terminal checkpoint의 `loop_state: succeeded`를 확인합니다.
2. Goal Inventory와 Goal Verification을 1:1로 맞춥니다.
3. evidence/receipt ref와 residual risk를 확인합니다.
4. `validate-domain-supervision.sh --closeout`이 aligned 상태 또는 exact human-accepted expiring temporary deviation을 확인해야 합니다.
5. installed validator를 통과한 뒤에만 source를 `done`으로 전환합니다.

## Verification

adopted repository에 실제 설치된 command만 실행합니다. `view` profile이 설치된 경우의 project-specific fast/full/continuous command는 `runtime/document-harness-view/config.json`에서 읽습니다. partial `core` target에 이 파일이 없으면 quality command를 추측하지 않고 not-configured attention으로 남깁니다.

```bash
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-domain-supervision.sh --all
./docs/bin/validate-closeout.sh --all
./docs/bin/harness-adopt verify --target .
git diff --check
```

## Human Handoff

handoff에는 goal, task/checkpoint revision, last valid evidence, next actor/action, alternatives/impact, residual risk와 resume condition을 포함합니다. 승인이나 material decision 요청은 지금까지 한 일, 필요한 이유, material delta, 추천안, 승인·비승인 효과와 계속 가능한 독립 작업을 사람용 언어로 먼저 설명합니다. Exact response는 이해 가능한 선택이어야 하며 opaque ID/hash/token 복사를 요구하지 않습니다.

## References

- `docs/architecture/execution-loop-plane.md`
- `docs/guide/execution-loop-operations.md`
- `docs/governance/policy-to-evidence.md`
- `docs/governance/initiative-governance.md`
- `docs/guide/governance-authoring-assistance.md`
- `docs/architecture/human-control-view-plane.md`
- `docs/guide/human-control-view.md`

## Change Log

- document-harness adoption: 기존 결정 재사용, bounded agent discretion, human-readable approval package와 최소 범위 차단을 설치 계약에 추가했습니다.
- document-harness adoption: installed command closure만 사용하는 repository-local execution entrypoint를 생성했습니다.
