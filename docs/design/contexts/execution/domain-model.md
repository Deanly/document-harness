---
type: design
design_kind: bounded-context
title: execution-domain-model
status: review_requested
domain: document-harness
bounded_context: execution
bounded_context_id: BC-EXECUTION
subdomain_type: core
model_revision: 1
validation_status: review_requested
validation_ref:
domain_expert_roles:
  - delivery-owner
  - document-harness-maintainer
role_views:
  - customer
  - planner
  - architect
  - developer
  - qa
owner: document-harness-maintainer
created: 2026-07-29
updated: 2026-07-29
retrieval_class:
  - domain-current
context:
  default_load: false
  section_load: false
  evidence_only: false
  size_tier: medium
referenced_by:
  - docs/architecture/execution-loop-plane.md
  - docs/EXECUTE.md
source_refs:
  - docs/architecture/execution-loop-plane.md
  - docs/guide/goal-locked-completion.md
tags:
  - docs/design
  - ddd
  - execution
---

# execution-domain-model

## Domain Purpose And Customer Outcome

승인된 방향과 domain model을 목표가 잠긴 delivery로 수행하고, 다음 actor가 대화 history 없이도 현재 위치를 복구하며, 근거 없는 완료와 목표 축소를 막습니다.

## Domain Experts And Sources

- delivery owner, executor, reviewer, QA와 operator
- initiative/project/task contract, checkpoint, attention, receipt와 QA evidence
- exact bytes 검토 전까지 review candidate입니다.

## Bounded Context Boundary

- 포함: project/task goal, execution attempt, checkpoint, attention, decision/verification receipt, closeout
- 제외: policy 승인 의미, source 검색 구현, Board UI
- upstream: BC-GOVERNANCE
- supporting service: BC-RETRIEVAL

## Ubiquitous Language

| Term ID | Term | Meaning In This Context | Examples / Counterexamples | Avoid | Source / Expert |
| --- | --- | --- | --- | --- | --- |
| TERM-EXEC-TASK | task | project 아래에서 닫을 수 있는 goal-locked execution unit | T#### / 임시 TODO | chat action을 task로 부르기 | delivery owner |
| TERM-EXEC-CHECKPOINT | execution checkpoint | 현재 attempt의 resumable snapshot | task-linked checkpoint / status log | progress history와 혼용 | executor |
| TERM-EXEC-EVIDENCE | completion evidence | goal과 source revision에 묶인 검증 가능한 사실 | test receipt / “완료함” | 활동 로그만으로 완료 | QA |

## Domain Scenarios

| Scenario ID | Actor / Goal | Given | When / Command | Then / Domain Event | Related Rule |
| --- | --- | --- | --- | --- | --- |
| SCN-EXEC-001 | executor가 task를 시작 | current domain/governance refs와 ready task | CMD-EXEC-START | EVT-EXEC-ATTEMPT-STARTED | BR-EXEC-001 |
| SCN-EXEC-002 | user input이 필요 | 실행 중 bounded decision gap | CMD-EXEC-REQUEST-ATTENTION | EVT-EXEC-ATTENTION-OPENED | BR-EXEC-002 |
| SCN-EXEC-003 | reviewer가 closeout | 모든 goal/evidence/receipt 충족 | CMD-EXEC-CLOSE | EVT-EXEC-TASK-CLOSED | BR-EXEC-003 |

## Domain Model

### Aggregates

| Aggregate ID | Aggregate Root | Responsibility | Invariants | Commands | Events | Consistency Boundary |
| --- | --- | --- | --- | --- | --- | --- |
| AGG-EXEC-TASK | Task | locked goal, scope, model refs, lifecycle와 closeout | BR-EXEC-001, BR-EXEC-003 | CMD-EXEC-START, CMD-EXEC-CLOSE | EVT-EXEC-ATTEMPT-STARTED, EVT-EXEC-TASK-CLOSED | 한 task contract/revision |
| AGG-EXEC-ATTEMPT | ExecutionAttempt | checkpoint, attention, budget와 receipts | BR-EXEC-002, BR-EXEC-004 | CMD-EXEC-REQUEST-ATTENTION | EVT-EXEC-ATTENTION-OPENED | 한 task attempt |

### Entities

| Entity ID | Entity | Identity | Lifecycle | Owning Aggregate |
| --- | --- | --- | --- | --- |
| ENT-EXEC-CHECKPOINT | ExecutionCheckpoint | task/attempt/checkpoint sequence | created → superseded/terminal | AGG-EXEC-ATTEMPT |
| ENT-EXEC-ATTENTION | AttentionRequest | request ID | open → answered/cancelled | AGG-EXEC-ATTEMPT |
| ENT-EXEC-RECEIPT | EvidenceReceipt | receipt ID | issued, immutable | AGG-EXEC-ATTEMPT |

### Value Objects

| Value Object ID | Value Object | Meaning | Validity / Immutability | Used By |
| --- | --- | --- | --- | --- |
| VO-EXEC-GOAL | LockedGoal | 발급 시점에 잠긴 완료 대상 | 후속 분해로 축소 불가 | AGG-EXEC-TASK |
| VO-EXEC-REVISION | ExecutionRevisionFence | task/domain/governance source revision | action/receipt scope에 고정 | AGG-EXEC-TASK, AGG-EXEC-ATTEMPT |

### Commands

| Command ID | Command | Actor | Target Aggregate | Preconditions | Result Event / Rejection |
| --- | --- | --- | --- | --- | --- |
| CMD-EXEC-START | StartTaskAttempt | executor | AGG-EXEC-TASK | current domain/governance refs, no conflict | EVT-EXEC-ATTEMPT-STARTED |
| CMD-EXEC-REQUEST-ATTENTION | RequestAttention | executor | AGG-EXEC-ATTEMPT | bounded missing input/decision | EVT-EXEC-ATTENTION-OPENED |
| CMD-EXEC-CLOSE | CloseTask | reviewer/validator | AGG-EXEC-TASK | goals/evidence/receipt complete, no open attention | EVT-EXEC-TASK-CLOSED 또는 incomplete 거절 |

### Domain Events

| Event ID | Domain Event | Producer | Business Meaning | Consumers | Published Contract |
| --- | --- | --- | --- | --- | --- |
| EVT-EXEC-ATTEMPT-STARTED | TaskAttemptStarted | AGG-EXEC-TASK | task가 current refs 아래 실행 상태에 들어감 | Board architecture | task/checkpoint identity |
| EVT-EXEC-ATTENTION-OPENED | AttentionOpened | AGG-EXEC-ATTEMPT | 사람/외부 actor의 bounded action이 필요함 | user/reviewer | request/revision/resume condition |
| EVT-EXEC-TASK-CLOSED | TaskClosed | AGG-EXEC-TASK | locked goals가 evidence로 충족됨 | project/initiative review | goal verification + receipts |

### Domain Policies And Services

| Policy / Service ID | Kind | Trigger | Decision / Coordination | Inputs | Outputs |
| --- | --- | --- | --- | --- | --- |
| POL-EXEC-CLOSEOUT | domain-service | close request | goal/attention/evidence/domain-ref barrier 평가 | task/checkpoint/receipts | close or exact rejection |

## Business Rules And Invariants

| Rule ID | Rule / Invariant | Scope | Enforced By | Scenario Coverage | QA Coverage |
| --- | --- | --- | --- | --- | --- |
| BR-EXEC-001 | functional work는 current domain model과 governance refs를 pin해야 한다 | AGG-EXEC-TASK | domain/closeout validator | SCN-EXEC-001 | pending |
| BR-EXEC-002 | lifecycle status와 loop state는 별도이며 attention은 bounded action을 가져야 한다 | AGG-EXEC-ATTEMPT | execution validator | SCN-EXEC-002 | pending |
| BR-EXEC-003 | locked goal을 후속 task로 넘겼다는 이유로 done 처리할 수 없다 | AGG-EXEC-TASK | closeout validator | SCN-EXEC-003 | pending |
| BR-EXEC-004 | succeeded/closed에는 source-fenced evidence와 receipt가 필요하다 | AGG-EXEC-ATTEMPT | execution/closeout validator | SCN-EXEC-003 | pending |

## State Transitions

| State Model | From | Command | Guard / Rule | To | Domain Event | Rejection |
| --- | --- | --- | --- | --- | --- | --- |
| Task | draft | CMD-EXEC-START | BR-EXEC-001 | active | EVT-EXEC-ATTEMPT-STARTED | missing/stale refs |
| ExecutionAttempt | running | CMD-EXEC-REQUEST-ATTENTION | BR-EXEC-002 | awaiting_user/review/external | EVT-EXEC-ATTENTION-OPENED | vague request |
| Task | active | CMD-EXEC-CLOSE | BR-EXEC-003, BR-EXEC-004 | done | EVT-EXEC-TASK-CLOSED | incomplete/open attention |

## Context Relationships And Integration

| Related Context | Direction | Relationship Pattern | Contract / Translation | Consistency | Failure Ownership |
| --- | --- | --- | --- | --- | --- |
| BC-GOVERNANCE | upstream | Customer-Supplier | exact policy/rule/initiative refs | start/closeout pin | stale authority는 Execution이 거절 |
| BC-RETRIEVAL | upstream service | Open Host Service + ACL | current source/direct-read proof | context load | freshness failure는 Retrieval |

## Failure And Exception Semantics

- blocked/awaiting은 실패나 done이 아닙니다.
- check 미실행은 pass가 아니며 `not_run` 또는 blocked입니다.
- budget exhaustion은 성공이 아니라 명시적 stop입니다.

## Role Consumer Contract

| Role | Questions This Model Answers | Required Sections / IDs | Required Downstream Output |
| --- | --- | --- | --- |
| customer | 어떤 결과가 실제로 닫혔는가 | VO-EXEC-GOAL, EVT-EXEC-TASK-CLOSED | outcome review |
| planner | goal/scope/attention decision은 무엇인가 | BR-EXEC-*, SCN-EXEC-* | task acceptance |
| architect | revision/evidence boundary는 무엇인가 | AGG-EXEC-*, context relations | execution architecture |
| developer | state/command/receipt 규칙은 무엇인가 | CMD-EXEC-*, EVT-EXEC-*, BR-EXEC-* | implementation/tests |
| qa | closeout을 어떤 check로 막는가 | SCN-EXEC-*, BR-EXEC-* | QA coverage |

## Traceability

| Model ID | Source / Expert | Project / Task | API / Event / Code | QA Check | Evidence |
| --- | --- | --- | --- | --- | --- |
| BR-EXEC-003 | delivery owner | T0001 legacy | validate-closeout.sh | pending | validator fixtures |
| BR-EXEC-004 | QA/reviewer | future | validate-execution-loop.sh | pending | receipt tests |

## Decisions

- Task와 Attempt를 별도 aggregate로 모델링해 lifecycle과 loop state를 섞지 않습니다.

## Unknowns And Disputes

- cross-repository execution broker와 organization-specific risk tiers는 별도 결정입니다.

## Change Impact

- rule/state 변경은 task/checkpoint templates, validators, View execution projection과 QA에 영향을 줍니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-29: execution bounded-context model 초안을 작성했다.
