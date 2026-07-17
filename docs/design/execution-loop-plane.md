---
type: design
title: execution-loop-plane
status: current
domain: execution
owner: Codex
created: 2026-07-15
updated: 2026-07-15
retrieval_class:
  - domain-current
context:
  default_load: false
  section_load: false
  evidence_only: false
  size_tier: medium
referenced_by:
  - docs/EXECUTE.md
  - docs/guide/execution-loop-operations.md
  - docs/guide/human-control-view.md
related_design:
  - docs/design/policy-to-evidence-governance.md
  - docs/design/human-control-view-plane.md
related_task: []
source_refs:
  - https://www.w3.org/TR/prov-dm/
tags:
  - docs/design
  - execution-loop
  - checkpoint
  - evidence
---

# execution-loop-plane

- Type: design
- Domain: execution
- Owner: Codex
- Created: 2026-07-15
- Updated: 2026-07-15
- Referenced By:
  - `docs/EXECUTE.md`
  - `docs/guide/execution-loop-operations.md`
  - `docs/guide/human-control-view.md`
- Related Design: `docs/design/policy-to-evidence-governance.md`; `docs/design/human-control-view-plane.md`

## Purpose

이 문서는 사람과 에이전트가 여러 세션에 걸쳐 같은 목표를 이어서 수행할 때 필요한 실행 상태, checkpoint, attention, evidence, decision/approval receipt와 stop/resume 계약을 고정합니다.

핵심은 대화나 view server를 기억 장치로 승격하지 않고, Markdown/Git source에 기록된 목표와 실행 이력을 바탕으로 다음 실행을 안전하게 재개하는 것입니다. projector/API/SSE/freshness/security는 `docs/design/human-control-view-plane.md`가 소유합니다.

## Whole-System Role

- `docs/design/control-plane.md`가 전체 목표와 active control surface를 소유합니다.
- `project`는 human-facing initiative와 delivery boundary를 소유합니다.
- `task`는 goal inventory, 실행 slice, checkpoint, evidence, handoff를 소유합니다.
- 이 설계는 한 task의 반복 실행을 어떻게 이어 붙이고, 언제 사람의 입력·검토·승인을 요구하며, 어떤 evidence barrier에서 성공·중단하는지를 소유합니다.
- `docs/design/human-control-view-plane.md`는 이 source contract를 사용자용 read projection으로 변환합니다.

## Authority Boundary

- current task, its Goal Inventory and `task_contract_revision` are the execution contract.
- human-approved policy/normative design, exact human/repository directive와 active exception만 authority가 있습니다.
- checkpoint는 current resume snapshot이고 task `Status`는 append-only milestone history입니다.
- evidence, command/test/review/decision/approval/handoff receipt는 source 문서 또는 source가 명시적으로 참조하는 durable artifact에 기록합니다.
- proposal, chat, 검색 결과, view row는 authority가 아닙니다. 수정·승인·closeout 전에는 authoritative source revision을 다시 확인합니다.
- 사용자 답변이나 승인 결과가 chat/view/runtime에만 남고 durable receipt에 반영되지 않은 상태를 완료로 취급하지 않습니다.

## Invariants

- lifecycle `status`와 실행 `loop_state`는 서로 다른 축이며 한 필드로 합치지 않습니다.
- 일반적인 사용자 질문·승인 대기는 lifecycle `status: active`를 유지합니다.
- `succeeded`는 lifecycle `done`과 같지 않으며 기존 Goal Verification과 closeout gate를 통과한 뒤에만 `done`을 사용합니다.
- checkpoint는 다음 actor가 대화 history 없이도 목표, 마지막 행동, evidence, risk, resume condition을 재구성할 수 있어야 합니다.
- evidence와 decision/approval receipt는 actor, scope, source revision, 생성 시각, 관련 goal 또는 checkpoint를 추적할 수 있어야 합니다.
- approval은 action, scope, checkpoint/source/diff revision, expiry에 묶이며 더 넓은 권한으로 암묵 승격되지 않습니다.
- policy-to-task trace는 explicit source reference로만 authoritative해지며 추론된 edge는 candidate로 표시합니다.

## Artifact And Trace Model

### Source Artifacts

| Artifact | Authority | Required Identity | Role |
| --- | --- | --- | --- |
| human policy / normative standard | effective governance-role design 또는 external policy mapping | policy/standard ID + normative version + rule ID | WHY, non-waivable constraint, approved MUST |
| directive | exact in-scope human instruction 또는 approved standard rule | directive/rule ID + revision | design/task가 충족해야 할 구체 지시 |
| proposal | non-authoritative report | proposal ref + content revision | options, assumptions, human decision request; effective authority가 아님 |
| design | current-truth design source | path + heading 또는 stable id | 경계, invariant, interface |
| project | project source | `doc_id` | initiative와 delivery lineage |
| task | task source | `doc_id` | 실행 slice와 goal contract |
| checkpoint | task 또는 durable linked artifact | `checkpoint_id` + `checkpoint_seq` | 다음 실행을 위한 최소 상태 |
| receipt | source 또는 durable linked artifact | `receipt_id` | command, test, review, decision, approval, handoff provenance |

`directive`는 새 artifact type이 아닙니다. exact revision이 고정된 human decision/directive receipt, repository instruction, 또는 effective normative rule 중 현재 task에 직접 적용되는 source를 통칭하는 reference role입니다.

W3C PROV의 entity, activity, agent, derivation 개념을 provenance를 설명하기 위한 참고 모델로 사용하되, downstream이 PROV serialization 자체를 구현하도록 강제하지 않습니다.

### Trace Nodes And Edges

각 trace node는 최소한 다음을 가집니다.

```yaml
node_id:
node_kind: policy | directive | design | project | task | goal | evidence | receipt
source_path:
source_heading:
source_revision:
source_hash:
status:
```

authoritative trace edge는 다음 관계 중 하나와 explicit source reference를 가집니다.

```yaml
edge_id:
from_node_id:
to_node_id:
relation: derives | governs | scopes | implements | verifies | authorizes | supersedes
declared_at:
source_revision:
source_hash:
```

`trace_status`는 `complete`, `broken`, `stale`, `ambiguous`, `candidate` 중 하나입니다. source에 없는 관계를 projector가 확정하지 않으며, heuristic match는 `candidate`로만 반환합니다.

## Policy To Task Trace Contract

사용자용 view는 다음 경로를 한 화면에서 추적할 수 있어야 합니다.

```text
human policy
  └─ proposal report [non-authoritative]
       └─ explicit human approval
            └─ effective normative standard / directive
                 └─ design invariant / operational guide
                      └─ task and goal
                           └─ QA check / evidence / decision receipt
```

- policy node는 적용 범위와 current normative version을 보여줍니다.
- proposal node는 `proposed`, `accepted_for_promotion`, `effective`를 혼동하지 않게 authority state를 보여줍니다.
- standard/directive node는 source policy, human approval ref, 의무를 이행할 design/task target을 보여줍니다.
- design node는 directive를 구체화하는 heading과 invariant를 보여줍니다.
- task node는 관련 goal ID, loop state, checkpoint, evidence를 보여줍니다.
- trace의 각 node는 source path, heading, revision/hash로 원문에 되돌아갈 수 있어야 합니다.
- missing edge, stale revision, 여러 target으로 갈라진 ambiguous edge는 attention 후보입니다.
- policy나 directive revision이 바뀌면 기존 downstream edge를 자동으로 current 처리하지 않고 재검증 전까지 `stale`로 표시합니다.
- proposal report는 effective normative design으로 승격되기 전까지 task/QA의 authoritative governance edge가 될 수 없습니다.
- trace completeness는 task 완료의 단독 근거가 아니며 Goal Verification과 required validator evidence를 함께 봅니다.

## Lifecycle Status And Loop State

lifecycle `status`는 문서의 truth lifecycle을 나타냅니다. `draft`, `active`, `blocked`, `done`, `closed`, `superseded`, `cancelled` vocabulary를 유지합니다.

`loop_state`는 active work에서 다음 actor와 재개 조건을 나타냅니다.

| Loop State | Meaning | Expected Next Actor |
| --- | --- | --- |
| `ready` | contract는 준비됐고 다음 bounded attempt를 시작할 수 있음 | agent |
| `running` | hypothesis, 작은 action, 관련 verification이 진행 중 | agent |
| `awaiting_user` | 사용자 input, decision, scoped approval이 필요함 | user |
| `awaiting_external` | 외부 actor, dependency, 시간 조건을 기다림 | external |
| `needs_review` | 독립 review 또는 human disposition이 필요함 | reviewer 또는 user |
| `stopped` | 명시적 stop reason으로 현재 attempt가 종료됨 | user 또는 지정 actor |
| `succeeded` | required evidence와 receipt가 준비된 loop terminal state | none |

hypothesis 설정, 변경, verification은 `running` 안의 짧은 action phase이며 별도 `loop_state`가 아닙니다. 매 tool call마다 source를 수정하지 않고 attention 전이, 세션 종료, milestone, stop처럼 복구 가치가 있는 경계에서 checkpoint를 영속화합니다.

일상적인 질문·승인 대기는 `status: active`와 `awaiting_user`를 조합합니다. `status: blocked`는 정상적인 응답 대기보다 지속적인 impasse를 표현하며, view는 active index 포함 여부와 무관하게 attention queue에 노출합니다.

호환 기본값은 `draft → ready`, `done|closed → succeeded`, `cancelled|superseded → stopped`입니다. `active`는 실행 전후의 canonical loop state를 유지할 수 있고, `blocked`는 attention을 가진 wait/review/stopped state만 사용합니다.

## Execution State Machine

```text
ready -> running -> running                 (next bounded action)
           |  |  |  \
           |  |  |   +-> succeeded         (evidence barrier passed)
           |  |  +-----> needs_review
           |  +--------> awaiting_external
           +-----------> awaiting_user
           +-----------> stopped

awaiting_user     -> running | stopped
awaiting_external -> running | stopped
needs_review      -> running | awaiting_user | stopped | succeeded
stopped           -> ready                     (new attempt required)
succeeded         -> lifecycle closeout gate   (no loop transition)
```

- wait state에서 `running`으로 돌아가려면 `resume_when`이 충족되고 관련 receipt 또는 external observation이 기록되어야 합니다.
- `succeeded`는 자동으로 lifecycle `done`을 의미하지 않습니다.
- 동일 실패 반복, evidence 없는 반복, budget 초과, scope/authority 확대는 `stopped` 전이 후보입니다.
- `stopped -> ready`는 `attempt_seq`를 증가시키고 새 bounded approach를 기록해야 합니다.
- 불허 transition은 조용히 보정하지 않고 failure record와 attention을 생성합니다.

## Checkpoint Contract

checkpoint의 canonical fields는 다음과 같습니다.

```yaml
checkpoint_id: CP-T0042-0007
checkpoint_seq: 7
task_id: T0042
task_contract_revision: 3
attempt_seq: 5
loop_state: awaiting_user
stop_reason:
next_actor: user
current_hypothesis: "staging migration is safe after dry-run reconciliation"
last_action: "ran the staging migration dry-run"
next_action: "apply the scoped migration after approval"
resume_when: "a current approval receipt exists for AR-T0042-0002"
policy_refs:
  - POL-CHANGE-01
directive_refs:
  - DIR-MIGRATION-04
evidence:
  - EV-T0042-0011
risks:
  - R-T0042-0003
attention:
  - AR-T0042-0002
receipts:
  - RCPT-T0042-0008
budget:
  iterations_used: 5
  iterations_max: 8
  elapsed_minutes: 42
  time_limit_minutes: 60
source_revision: "git:abc123+worktree:7"
source_hash: "sha256:..."
recorded_at: "2026-07-15T15:00:00+09:00"
```

- `task_contract_revision`은 goal, scope, completion mode, acceptance contract의 변경 generation을 식별합니다.
- `attempt_seq`는 동일 task contract에서 수행한 bounded attempt 순서를 식별합니다.
- `last_action`은 무엇을 했는지, `evidence`는 그 행동으로 새로 확인된 근거가 무엇인지 분리합니다.
- `risks`, `attention`, `receipts`는 embedded copy가 아니라 stable reference 목록을 기본으로 합니다.
- `policy_refs`와 `directive_refs`는 trace projection의 explicit edge source입니다.
- `source_revision`은 provenance이고 `source_hash`는 checkpoint source bytes 검증에 사용합니다.
- 다음 실행이 goal, constraint, 마지막 valid evidence, 다음 actor/action, resume condition을 복구하지 못하면 checkpoint가 불완전합니다.

## Evidence And Decision Receipt Contract

receipt는 view notification이나 chat response가 아니라 durable provenance record입니다.

```yaml
receipt_id: RCPT-T0042-0008
receipt_kind: command | test | review | decision | approval | handoff
task_id: T0042
goal_ids:
  - G2
checkpoint_seq: 7
actor: human | agent | validator | external-system
issued_at: "2026-07-15T15:03:00+09:00"
statement:
scope: {}
evidence_refs: []
source_revision:
source_hash:
supersedes: []
approval_fence: null
```

- command receipt는 명령, 작업 위치, 환경, exit result와 source revision을 연결합니다.
- test receipt는 suite/check, verdict, artifact/log와 target revision을 연결합니다.
- review receipt는 reviewer, findings, disposition과 검토한 revision을 기록합니다.
- decision receipt는 선택, 거절 또는 보류, 비선택 대안, 영향 범위를 기록합니다.
- approval receipt는 exact action과 fence를 승인하며 일반 신뢰나 후속 action까지 승인하지 않습니다.
- handoff receipt는 next actor/consumer, residual risk와 resume condition을 기록합니다.
- receipt가 current truth를 바꾸면 해당 `design` 또는 policy source도 같은 변경 흐름에서 갱신합니다.

## Human View Projection Handoff

execution source는 task, lifecycle/loop state, checkpoint, attention, approval fence, receipt와 exact trace ref를 제공합니다. projector, immutable snapshot, GET/SSE, polling, freshness, read-only security와 view acceptance는 `docs/design/human-control-view-plane.md`가 소유합니다.

projection은 이 계약을 설명할 수 있지만 state나 authority를 독자적으로 생성·수정하지 않습니다. view에서 관찰된 mismatch는 source를 직접 확인하는 attention이며 자동 write-back 사유가 아닙니다.

## Attention Contract

attention record는 사람이나 외부 actor가 해야 할 bounded action을 나타냅니다.

```yaml
attention_id: AR-T0042-0002
task_id: T0042
kind: input | decision | approval | review | external-wait | stopped
status: open | answered | expired | superseded
risk: low | medium | high | very-high
created_at:
why_now:
recommended_action:
alternatives_and_impact: []
requested_response:
resume_when:
checkpoint_seq:
source_hash:
approval_fence: null
```

- normal wait는 task lifecycle을 `blocked`로 바꾸지 않고 `status: active`와 `awaiting_user` 또는 `awaiting_external` loop state로 표시합니다.
- lifecycle `blocked` task도 attention queue에서 사라지지 않습니다.
- queue priority는 risk, irreversible/external impact, critical-path blocking, age를 사용하되 정렬 이유를 사용자에게 보여줍니다.
- no-change heartbeat를 attention으로 만들지 않습니다.
- 동일 `attention_id + checkpoint_seq` notification은 idempotent하게 취급합니다.

## Approval Fence

approval은 다음 fence에 묶입니다.

```yaml
approval_fence:
  task_id: T0042
  task_contract_revision: 3
  checkpoint_seq: 7
  task_source_hash: "sha256:..."
  diff_hash: "sha256:..."
  scope_hash: "sha256:..."
  requested_action: "apply staging migration 0042"
  expires_at: "2026-07-16T15:00:00+09:00"
```

- current source, diff, scope, contract revision 중 하나라도 다르면 기존 approval은 stale입니다.
- stale, expired, ambiguous, degraded snapshot에서는 action을 실행하지 않습니다.
- 승인 범위에 없는 file, environment, recipient, deployment, data mutation을 추가하지 않습니다.
- approval은 one-shot을 기본으로 하며 reusable capability는 별도 policy와 명시적 사용자 결정을 요구합니다.
- `approve all`과 wildcard scope는 기본 금지합니다.
- 승인 후 executor 결과와 validator evidence를 새 receipt로 기록하고 source가 갱신된 뒤 view가 이를 재투영합니다.

## Runtime Boundary

- public harness는 execution vocabulary, checkpoint/attention/receipt/approval fence schema와 static validator를 소유합니다.
- downstream executor는 tool capability, isolated environment, actual command/test/review execution과 durable receipt storage를 소유합니다.
- human-owned source나 trusted approval mechanism 없이는 AI가 policy/directive/approval을 자체 생성하지 않습니다.
- local view runtime은 `docs/design/human-control-view-plane.md` 경계를 따르고 execution capability를 갖지 않습니다.
- optional approval broker/executor는 explicit user decision과 별도 threat model이 승인된 뒤에만 추가합니다.

## Acceptance Scenarios

| ID | Scenario | Pass Condition |
| --- | --- | --- |
| EX-01 | lifecycle separation | `status: active`와 wait/review state가 공존하고 `succeeded`가 자동 `done`이 아님 |
| EX-02 | fresh-context resume | task/checkpoint만으로 goal, last evidence, next actor/action, resume condition 복구 |
| EX-03 | early feedback | 구현 전 baseline과 작은 변경 뒤 가장 싼 관련 검사 기록 |
| EX-04 | state transition | policy에 없는 transition을 조용히 보정하지 않고 failure/attention 기록 |
| EX-05 | authority conflict | 실행 불가능한 policy/directive 충돌은 `stopped / CONFLICT` |
| EX-06 | budget stop | 반복/시간 한도에서 `BUDGET_EXCEEDED`와 resume condition 기록 |
| EX-07 | evidence barrier | unresolved attention 또는 evidence/receipt 부족 시 `succeeded` 거부 |
| EX-08 | stale approval | checkpoint/source/diff/scope fence mismatch action 0건 |
| EX-09 | closeout | terminal checkpoint와 Goal Verification 없이는 `done` 거부 |
| EX-10 | cancellation/supersede | `cancelled|superseded` task는 `stopped` execution state 사용 |

## Decisions

- lifecycle status와 loop state를 분리합니다.
- normal human wait는 active lifecycle을 유지하고 attention으로 표현합니다.
- authority/policy conflict stop과 independent review를 구분합니다.
- checkpoint current snapshot과 task Status append-only history를 분리합니다.
- policy→directive→design→task trace는 explicit provenance edge와 source revision을 요구합니다.
- `succeeded`는 evidence barrier이며 lifecycle closeout은 별도 gate입니다.
- projector/API/SSE/freshness/security는 human-control-view-plane으로 분리합니다.

## Open Questions

- downstream receipt storage path/format과 trusted human approval mechanism은 project threat model에서 결정합니다.
- cryptographic receipt signature가 필요한 환경은 조직 trust boundary와 감사 요구를 별도 design으로 확장합니다.

## References

- [W3C PROV-DM — The PROV Data Model](https://www.w3.org/TR/prov-dm/)
- `docs/design/control-plane.md`
- `docs/design/policy-to-evidence-governance.md`
- `docs/design/human-control-view-plane.md`
- `docs/EXECUTE.md`

## Change Log

- 2026-07-15: execution checkpoint, receipt provenance, derived local view, attention, approval fence, policy-to-task trace 계약을 생성했다.
- 2026-07-15: projector, API/SSE, freshness, view security/runtime/observability 책임을 human-control-view-plane으로 분리했다.
