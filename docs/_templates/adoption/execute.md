---
type: guide
title: execute
status: current
owner: document-harness
related_design:
  - docs/design/control-plane.md
  - docs/design/policy-to-evidence-governance.md
  - docs/design/execution-loop-plane.md
  - docs/design/human-control-view-plane.md
source_refs:
  - docs/_indexes/execution-loop-policy.yaml
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
2. 이 문서
3. current task와 `task_contract_revision`
4. current `checkpoint_ref`; 첫 실행이면 `docs/_templates/execution-checkpoint.md`
5. task/checkpoint가 고정한 effective policy, design, guide와 receipt

검색 결과나 View snapshot은 current source를 대체하지 않습니다.

## Start Gate

- Goal ID, 완료 조건, out of scope와 허용 변경 surface가 명확해야 합니다.
- 적용 policy/directive와 human authority revision을 확인합니다.
- baseline, 가장 싼 관련 검사, full check와 stop condition을 정합니다.
- secret, production, external write 또는 비가역 action이 필요하면 먼저 attention을 만듭니다.

## Execute Loop

1. task contract와 source revision을 pin합니다.
2. baseline 또는 reproduce check를 먼저 실행합니다.
3. hypothesis 하나와 작고 가역적인 action 하나를 수행합니다.
4. 가장 관련성 높은 fast check를 실행합니다.
5. checkpoint의 last action, evidence, risk, next actor/action과 resume condition을 갱신합니다.
6. required receipt를 연결하고 계속, review, stop 또는 success를 결정합니다.

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

## Evidence Barrier

`succeeded` 전에 current task/source revision에 연결된 fast/full check, 필요한 review receipt, goal별 evidence, scope check와 unresolved-attention 0건이 필요합니다. AI가 작성한 `passed` 문자열은 receipt가 아닙니다.

## Stop And Ask

goal, authority, policy, approval fence가 불명확하거나 충돌할 때, budget이 소진됐을 때, validator를 약화해야 할 때, 복구 불가능한 action이 필요할 때 중단합니다. `stopped` checkpoint에 reason, next actor/action과 `resume_when`을 남깁니다.

## Closeout

1. terminal checkpoint의 `loop_state: succeeded`를 확인합니다.
2. Goal Inventory와 Goal Verification을 1:1로 맞춥니다.
3. evidence/receipt ref와 residual risk를 확인합니다.
4. installed validator를 통과한 뒤에만 source를 `done`으로 전환합니다.

## Verification

adopted repository에 실제 설치된 command만 실행합니다. `view` profile이 설치된 경우의 project-specific fast/full/continuous command는 `runtime/document-harness-view/config.json`에서 읽습니다. partial `core` target에 이 파일이 없으면 quality command를 추측하지 않고 not-configured attention으로 남깁니다.

```bash
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
./docs/bin/harness-adopt verify --target .
git diff --check
```

## Human Handoff

handoff에는 goal, task/checkpoint revision, last valid evidence, next actor/action, exact requested response, alternatives/impact, residual risk와 resume condition을 포함합니다.

## References

- `docs/design/execution-loop-plane.md`
- `docs/guide/execution-loop-operations.md`
- `docs/design/policy-to-evidence-governance.md`
- `docs/design/human-control-view-plane.md`
- `docs/guide/human-control-view.md`

## Change Log

- document-harness adoption: installed command closure만 사용하는 repository-local execution entrypoint를 생성했습니다.
