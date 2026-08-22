---
type: execution-checkpoint
execution_contract: v1
checkpoint_id: "{{TASK_ID}}:A{{ATTEMPT_SEQ}}:C{{CHECKPOINT_SEQ}}"
checkpoint_seq: 1
task_id: {{TASK_ID}}
task_contract_revision: 1
workstream_kind:
code_baseline_ref:
document_issuance_ref:
document_bridge_ref:
document_issuance_receipt:
delivery_branch:
attempt_seq: 1
loop_state: ready
stop_reason:
next_actor: agent
current_hypothesis: Not established yet.
last_action: Execution checkpoint created.
next_action: Confirm the task contract and select the first cheap verification.
resume_when: The task inputs and required authority are available.
policy_refs:
  - docs/_indexes/execution-loop-policy.yaml
directive_refs: []
evidence: []
risks: []
attention: []
receipts: []
domain_supervision_refs: []
domain_decision_refs: []
budget:
  iterations_used: 0
  iterations_max: 10
  elapsed_minutes: 0
  time_limit_minutes: 60
source_refs: []
source_revision: working-tree
source_hash: "{{SOURCE_HASH}}"
recorded_at: "{{TIMESTAMP}}"
tags:
  - docs/execution-checkpoint
---

# {{TASK_ID}} Execution Checkpoint

## Purpose

이 문서는 `{{TASK_ID}}`의 최신 실행 상태를 기계와 사람이 함께 읽는 current projection입니다. task의 발급 목표나 append-only `Status`를 대체하지 않습니다.

## Human Snapshot

- Loop State: `ready`
- Attempt / Checkpoint: `1 / 1`
- Next Actor: `agent`
- Attention: 없음
- Resume When: task 입력과 필요한 권한이 준비되었을 때

## Task Contract Fence

- Task: `{{TASK_ID}}`
- Task Contract Revision: `1`
- Workstream Kind:
- Code Baseline Ref:
- Document Issuance Ref:
- Document Bridge Ref:
- Document Issuance Receipt:
- Delivery Branch:
- Source Revision: `working-tree`
- Source Hash: `{{SOURCE_HASH}}`

`source_hash`는 이 checkpoint가 mirror하는 linked task 문서의 현재 bytes SHA-256입니다. `source_revision`은 `working-tree`이거나 같은 task bytes를 resolve하는 full Git commit입니다. task goal, scope, completion mode가 바뀌면 이 checkpoint를 조용히 고치지 않고 task contract revision 또는 supersede/reissue 결정을 먼저 기록합니다.

## Policy And Directive Refs

- Policy: `docs/_indexes/execution-loop-policy.yaml`
- Directives: 없음

AI가 만든 proposal이나 approval 문자열은 effective policy 또는 human directive가 아닙니다. 충돌이 해결되지 않으면 `stopped / CONFLICT`로 전환합니다.

## Current Hypothesis

아직 설정되지 않았습니다.

## Last Action

Execution checkpoint를 생성했습니다.

## Next Actor And Action

- Actor: `agent`
- Action: task contract를 확인하고 가장 싼 첫 검증을 선택합니다.

## Resume Condition

task 입력과 필요한 authority가 준비되어 있어야 합니다.

## Evidence

- 없음

## Risks

- 없음

## Attention

- 없음

approval 또는 material decision이 필요하면 먼저 현재 목표, 지금까지 한 일, 결정이 필요한 이유, 기존 결정에서 달라지는 점, 추천안과 대안, 승인·비승인 효과, 차단되는 최소 범위와 계속 가능한 독립 작업을 사람용 언어로 기록합니다. ID, path, revision, hash와 token은 하위 fence metadata이며 사용자에게 정해진 문자열 복사를 요구하지 않습니다. material delta가 없고 기존 authority가 fresh하면 반복 approval attention을 만들지 않습니다.

## Receipts

- 없음

## Domain Supervision

- AI Domain Expert Review: 없음
- Human Domain Decision: 없음

의미 있는 코드·DB·API·event·test 변경 뒤에는 current task와 implementation bytes에 고정된 supervision review를 연결합니다. `decision-required` 또는 `blocked-conflict`는 사람이 Board의 대안·권고·위험을 읽고 결정하거나 충돌이 해소될 때까지 `succeeded`로 전환할 수 없습니다.

## Budget

- Iterations: `0 / 10`
- Elapsed Minutes: `0 / 60`

## Transition Note

- `{{TIMESTAMP}}`: checkpoint created in `ready` state.
