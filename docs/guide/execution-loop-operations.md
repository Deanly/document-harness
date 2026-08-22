---
type: guide
title: execution-loop-operations
status: current
owner:
created: 2026-07-15
updated: 2026-08-19
related_project: []
related_task: []
related_design:
  - docs/architecture/execution-loop-plane.md
  - docs/governance/policy-to-evidence.md
source_refs: []
tags:
  - docs/guide
  - execution-loop
  - human-control
---

# execution-loop-operations

- Type: guide
- Status: current
- Created: 2026-07-15
- Updated: 2026-07-17
- Related Design: docs/architecture/execution-loop-plane.md; docs/governance/policy-to-evidence.md

## Purpose

이 guide는 opt-in task를 작은 검증 루프로 실행하면서 사용자가 현재 상태, 다음 행동, 필요한 결정을 지속적으로 이해하고 통제할 수 있게 하는 운영 절차를 고정합니다.

핵심은 task의 장기 완료 계약, 최신 execution checkpoint, 불변 evidence/decision receipt를 서로 다른 책임으로 유지하는 것입니다.

## Operating Principle

```text
task contract
  -> effective policy/directive resolution
  -> hypothesis
  -> small action
  -> cheapest relevant verification
  -> checkpoint + receipts
  -> continue, request attention, stop, review, or succeed
```

- task의 `Goal Inventory`와 scope가 authority boundary입니다.
- checkpoint는 현재 실행 projection이며 goal을 다시 정의하지 않습니다.
- 사람에게 알리는 commentary나 watcher 신호는 진행 hint이고 checkpoint/receipt가 durable state입니다.
- 결과를 검증할 수 없으면 조용히 성공 처리하지 않습니다.
- public harness는 reusable contract만 제공하고 실제 `docs/checkpoints/` 상태는 downstream project가 소유합니다.

## Artifact Roles

| Artifact | Holds | Must Not Hold |
| --- | --- | --- |
| task | goal, scope, completion mode, goal verification | 매 도구 호출의 세부 상태 |
| execution checkpoint | 최신 hypothesis, action, actor, resume condition, evidence/risk/attention refs | task goal의 재정의 |
| policy/standard design | effective human policy, normative rule, approval and exception boundary | AI self-approval |
| directive ref | 한정된 human instruction과 exact scope/revision | 암묵적 scope 확대 |
| receipt | command, test, review, decision, approval, handoff의 불변 관찰 | 검증되지 않은 완료 주장 |

`execution-checkpoint.md`는 machine-readable frontmatter와 human-readable body를 함께 가집니다. 두 표현이 다르면 frontmatter를 current projection으로 삼되 validator failure로 처리하고 바로 정렬합니다.

## Task Opt-In Contract

기존 task는 자동 migration하지 않습니다. 다음 frontmatter를 명시한 task만 `v1` execution contract를 사용합니다.

```yaml
execution_contract: v1
task_contract_revision: 1
loop_state: ready
checkpoint_ref:
```

- 기존 T0001처럼 `execution_contract`가 없는 문서는 grandfather합니다.
- `draft + ready` task는 아직 실행을 시작하지 않았으므로 빈 `checkpoint_ref`를 허용합니다.
- task가 active이거나 `loop_state`가 `ready`가 아니면 `docs/checkpoints/` 아래 checkpoint가 필요합니다.
- checkpoint의 task id, task contract revision, loop state는 task mirror와 같아야 합니다.
- checkpoint는 numbered document가 아니므로 새 번호를 발급하지 않습니다. 현재 delivery branch에서 linked Task의 bridge provenance를 그대로 mirror하며 append-only 실행 상태를 갱신합니다.

## Directive And Policy Resolution

실행 전 다음 순서로 effective instruction을 결정합니다.

1. platform safety와 tool constraints
2. effective human policy
3. effective normative-standard design
4. repository `AGENTS.md`와 local instructions
5. user-approved task contract
6. 최신의 in-scope human directive
7. active execution plan

규칙:

- AI-authored report/proposal은 승인 전 directive가 아닙니다.
- guide나 task는 normative design을 완화할 수 없습니다.
- latest directive가 goal/scope/completion mode를 약화하면 현재 task를 조용히 수정하지 않고 supersede/reissue 판단을 요청합니다.
- policy와 directive는 exact ID/revision 또는 repository path로 checkpoint의 `policy_refs`와 `directive_refs`에 pin합니다.
- 충돌, 불명확한 authority, 만료된 exception은 `stopped / CONFLICT`와 human attention으로 반환합니다.

## Execution Loop

1. task contract revision과 effective policy/directive refs를 고정합니다.
2. 문제를 재현하거나 현재 baseline을 가장 싼 검사로 확인합니다.
3. 한 번에 하나의 `current_hypothesis`를 둡니다.
4. 작고 가역적인 action을 수행합니다.
5. 관련성이 가장 높은 fast check를 먼저 실행합니다.
6. 결과, changed scope, risk, attention, receipt를 checkpoint에 반영합니다.
7. 진전이 있으면 다음 hypothesis/action으로 이어갑니다.
8. full verification과 필요한 review receipt가 준비된 뒤에만 `succeeded`로 전환합니다.

긴 분석이나 여러 파일 변경 뒤 처음 검증하는 흐름을 기본값으로 두지 않습니다. 같은 실패를 반복하면 action을 더 늘리기보다 hypothesis와 task contract를 다시 봅니다.

## State Transitions

task lifecycle status와 loop state는 별도 vocabulary입니다.

| Loop State | Meaning | Typical Next Actor |
| --- | --- | --- |
| `ready` | 계약은 고정됐지만 attempt가 시작되지 않음 | agent |
| `running` | hypothesis/action/verification loop가 진행 중 | agent |
| `awaiting_user` | 사용자 선택이나 추가 authority가 필요함 | user |
| `awaiting_external` | 외부 시스템·사람·시간 조건을 기다림 | external |
| `needs_review` | 독립 review 또는 승인 검토가 필요함 | reviewer |
| `stopped` | 명시적 stop reason으로 현재 attempt 종료 | user 또는 지정 actor |
| `succeeded` | completion barrier에 필요한 evidence와 receipts가 준비됨 | none |

- `stopped -> ready`는 같은 attempt의 무음 재시도가 아닙니다. `attempt_seq`를 증가시키고 새 checkpoint를 기록합니다.
- `succeeded`는 task `done`과 같지 않습니다. Goal Verification과 closeout validator가 남아 있습니다.
- top-level task status에 `needs_review`나 `budget_exceeded`를 추가하지 않습니다.
- lifecycle 호환 기본값은 `draft → ready`, `done|closed → succeeded`, `cancelled|superseded → stopped`입니다. `blocked`는 attention을 가진 wait/review/stopped state에만 사용합니다.

## Checkpoint Update Contract

기본 downstream path는 `docs/checkpoints/<TASK-ID>-execution.md`입니다.

- `checkpoint_seq`는 같은 attempt 안에서 증가합니다.
- 새 attempt는 `attempt_seq`를 증가시키고 checkpoint sequence를 새로 시작할 수 있습니다.
- `task_contract_revision`은 checkpoint가 어떤 Goal Inventory/Scope 계약을 실행하는지 고정합니다.
- `source_hash`는 linked task 문서의 현재 bytes SHA-256이고, `source_revision`은 `working-tree` 또는 같은 task blob을 resolve하는 full Git commit입니다.
- `last_action`, `next_actor`, `next_action`, `resume_when`은 재시작 시 추론 없이 이어갈 수 있을 정도로 구체적으로 씁니다.
- `evidence`, `risks`, `attention`, `receipts`는 긴 로그 복사본이 아니라 stable ID/path refs를 둡니다.
- checkpoint body의 Human Snapshot은 frontmatter를 사람이 빠르게 읽는 mirror입니다.
- repository-local View는 이 Markdown checkpoint를 직접 읽습니다. 별도 `docs/_indexes/execution-checkpoint.json` mirror를 만들지 않습니다.
- View candidate는 loop-enabled `docs/tasks/T*.md`가 `checkpoint_ref`로 직접 연결한 checkpoint뿐입니다. orphan/newer checkpoint file은 표시 대상을 바꾸지 않습니다.
- 여러 linked task checkpoint가 있으면 View는 active/blocked non-succeeded work를 completed history보다 우선하고, 이어 active succeeded closeout, draft, historical terminal task 순으로 선택합니다. 같은 group에서는 `recorded_at`, `attempt_seq`, `checkpoint_seq` 내림차순과 path 오름차순을 사용합니다. 따라서 `recorded_at`은 실제 checkpoint 갱신 시각으로 유지하며 filesystem mtime에 의존하지 않습니다.
- View는 task status/loop compatibility와 task/checkpoint ID·revision·loop mirror뿐 아니라 checkpoint identity, linked task source hash/revision, state/actor/stop reason, budget bounds와 succeeded evidence/receipt/attention barrier를 검사합니다. `succeeded` evidence/receipt는 private/symlink가 아닌 실제 non-empty repository regular file이어야 하며 validator가 거부할 상태를 사용자 화면에서 성공으로 보이지 않습니다.
- checkpoint root나 entry가 symlink이거나 canonical frontmatter가 malformed이면 View는 그 항목을 건너뛰어 진행을 추론하지 않고 execution projection을 `degraded`로 표시합니다.

## Human Attention And Handoff

다음 경우 attention을 숨기지 않습니다.

- goal, scope, completion mode 또는 effective policy가 충돌함
- 사용자가 선택해야 결과가 달라짐
- high/critical risk, irreversible action, production/secret access가 필요함
- 동일 실패나 무개선이 policy threshold에 도달함
- 외부 시스템 결과나 human approval이 필요함
- review가 실질적 결함이나 불확실성을 발견함

attention entry는 최소한 질문/판단 대상, 필요한 actor, 선택의 영향, resume condition을 식별해야 합니다. `awaiting_user`, `awaiting_external`, `needs_review`, `stopped` 상태에서 attention ref를 비워두지 않습니다.

승인 attention을 만들기 전에는 current goal/directive/approval이 이미 action을 허용하는지 확인하고, 기존 결정에서 달라지는 `material_delta`를 식별합니다. material delta나 새 human-only boundary가 없으면 반복 승인을 요청하지 않고 agent가 routine·가역·저위험 세부 판단을 수행합니다.

실제 승인이 필요하면 작업 목표, 지금까지 한 일, 승인 이유, material delta, 추천안과 대안, 승인·비승인 효과를 사람용 언어로 먼저 설명합니다. 기술 ID/hash/token은 근거로 내리고 특정 문자열 복사를 요구하지 않습니다. 차단은 승인이 필요한 최소 action에 한정하며, 다른 task/action은 dependency와 authority evidence로 독립성이 확인된 경우 계속합니다.

## Evidence And Receipt Contract

Receipt는 다음 종류를 지원합니다.

- `command`: 명령, cwd, exit status, source revision
- `test`: suite/check ID, verdict, artifact/log
- `review`: reviewer, findings, disposition
- `decision`: human choice, alternatives, scope
- `approval`: approver authority, exact revision, approval fence
- `handoff`: next actor/consumer, residual risk, resume condition

`succeeded` checkpoint는 evidence와 receipt ref가 모두 있어야 하고 각 ref가 안전한 non-empty repository regular file로 resolve되어야 합니다. receipt는 task/checkpoint ID, actor/time, statement/scope, evidence refs, linked-task source revision/hash를 포함하고 checkpoint evidence를 연결해야 합니다. 자유 서술 evidence 한 줄, 존재하지 않는 path, 내용 없는 임의 JSON만으로 성공하지 않습니다. 정적 validator는 ref와 source fence를 검증할 뿐, runtime 명령 실행이나 human authority 자체를 증명하지 않는다는 경계를 유지합니다.

## Stop And Resume Rules

지원 stop reason은 다음 다섯 개뿐입니다.

- `NO_PROGRESS`: hypothesis/action 변경에도 검증 결과가 개선되지 않음
- `BUDGET_EXCEEDED`: iteration 또는 time budget을 소진함
- `BLOCKED`: 필요한 외부 정보·권한·상태가 없음
- `CONFLICT`: task, policy, directive 또는 source revision이 충돌함
- `SAFETY`: 안전·보안·비가역성 경계를 넘을 위험이 있음

`stopped` checkpoint는 stop reason, attention, next actor/action, `resume_when`을 모두 남깁니다. 재개는 원인을 해소한 receipt/directive와 새 attempt 번호를 요구합니다.

## Risk And Approval

- `low`: 가역적이고 local evidence로 충분함
- `medium`: 사용자-visible 동작 또는 shared contract 변경
- `high`: 인증, 결제, 개인정보, migration, 넓은 장애 전파 가능성
- `critical`: production mutation, 데이터 삭제, secret 변경, 롤백 곤란

task contract 변경, scope 확대, 비가역 작업, production/secret 접근, high/critical risk, policy exception은 human directive 또는 approval receipt 없이는 실행하지 않습니다.

반대로 위 경계가 없고 current goal·policy·initiative·directive가 action을 허용하면 구현 세부 선택을 매번 승인받지 않습니다. 여러 합리적 방법 중 하나를 고르는 것은 goal과 acceptance를 바꾸지 않는 한 기본적으로 agent의 bounded discretion입니다.

## Closeout

`succeeded` 전환 전에 다음을 확인합니다.

1. task contract revision과 source revision이 evidence receipt와 맞습니다.
2. required fast/full checks와 review가 receipt로 남았습니다.
3. unresolved attention이 없습니다.
4. evidence/risks/receipts가 Human Snapshot과 일치합니다.
5. Goal Verification이 evidence refs를 가리킵니다.

그 후 adopted target에서는 `validate-execution-loop.sh --all`과 `document-harness.yaml`의 project-specific fast/full/continuous command를 통과해야 task를 `done`으로 닫을 수 있습니다. `validate-closeout.sh --all`은 public document-harness distribution source에서 추가로 실행하는 release validator이며 target 설치에 포함된다고 가정하지 않습니다.

## Failure Response

| Symptom | Response |
| --- | --- |
| checkpoint와 task loop state 불일치 | 실행 중단, latest source를 직접 읽고 projection 재작성 |
| task contract revision mismatch | `CONFLICT`, 새 directive 또는 supersede/reissue 판단 |
| attention 없이 awaiting/stopped | validator failure, 필요한 actor와 resume condition 기록 |
| receipts 없이 succeeded | `needs_review` 또는 `running`으로 복귀, 실제 verification 수행 |
| stale source hash | 기존 receipt 폐기 또는 stale 표시 후 최신 revision 재검증 |
| policy/directive authority 불명 | `stopped / CONFLICT`, human policy owner에게 escalation |

## Downstream Adoption

1. task template에 opt-in execution fields를 둡니다.
2. `docs/_indexes/execution-loop-policy.yaml`을 프로젝트 위험에 맞게 조정합니다.
3. 실행 시작 시 template으로 `docs/checkpoints/<TASK-ID>-execution.md`를 만듭니다.
4. `validate-execution-loop.sh`를 foundation/closeout gate에 연결합니다.
5. 실제 receipts 저장 위치와 trusted approval mechanism은 downstream design에서 고정합니다.

공개 `document-harness` 자체를 개발하기 위한 실제 checkpoint는 public repo에 추가하지 않고 바깥 관리 workspace에서 보존합니다.

## References

- `docs/architecture/execution-loop-plane.md`
- `docs/governance/policy-to-evidence.md`
- `docs/guide/human-control-view.md`
- `docs/_indexes/execution-loop-policy.yaml`
- `docs/_templates/execution-checkpoint.md`

## Change Log

- 2026-08-19: 기존 결정 재사용, material-delta 기반 승인, 사람용 결정 패키지와 국소 차단 원칙을 추가했다.
- 2026-07-15: opt-in execution loop, checkpoint, directive, attention, receipt, stop/resume 운영 계약 추가.
- 2026-07-17: View execution projection을 별도 JSON mirror가 아닌 canonical `docs/checkpoints/*.md`와 deterministic selection에 연결했다.
