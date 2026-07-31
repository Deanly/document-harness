---
type: design
design_kind: bounded-context
title: adoption-domain-model
display_title: 기존 저장소에 안전하게 도입하기
human_summary: 기존 문서와 작업 중인 변경을 보존하면서 문서 하네스를 설치하고 검증하고 되돌리는 업무입니다.
presentation_status: review_requested
presentation_ref:
status: review_requested
domain: document-harness
bounded_context: adoption
bounded_context_id: BC-ADOPTION
subdomain_type: supporting
model_revision: 1
validation_status: review_requested
validation_ref:
domain_expert_agent: ai-domain-expert
authority_mode: human-required
decision_tier: strategic
board_review_level: bounded-context
board_review_status: review_requested
board_decision_ref:
domain_expert_roles:
  - repository-owner
  - document-harness-maintainer
role_views:
  - customer
  - planner
  - architect
  - developer
  - qa
owner: document-harness-maintainer
created: 2026-07-29
updated: 2026-07-30
retrieval_class:
  - domain-current
context:
  default_load: false
  section_load: false
  evidence_only: false
  size_tier: medium
referenced_by:
  - docs/architecture/harness-adoption-plane.md
  - docs/ADOPT.md
source_refs:
  - docs/architecture/harness-adoption-plane.md
  - docs/ADOPT.md
tags:
  - docs/design
  - ddd
  - adoption
---

# adoption-domain-model

## Domain Purpose And Customer Outcome

새 repository와 mature repository에 document-harness를 도입·업그레이드하면서 project-owned bytes와 dirty state를 보존하고 모든 mutation을 exact plan과 rollback evidence로 설명할 수 있게 합니다.

## Human Review Summary

- 이 영역의 책임: 기존 파일과 작업 중인 변경을 보존하며 설치, 이관, 검증, 되돌리기를 관리합니다.
- 포함하지 않는 것: 이관한 정책 후보를 승인하거나 저장소 소유자의 파일을 임의로 덮어쓰지 않습니다.
- 사용자에게 보이는 실패: 소유권 충돌이나 검증 실패를 설치 성공으로 숨기지 않고 다음 확인 대상으로 보여 줍니다.
- 아직 결정할 것: 대상 저장소마다 보존할 파일과 사람이 승인할 이관 경계를 소유자가 확정해야 합니다.

## AI Domain Expert Board Review

- 권고 결정: 도입 영역은 기존 저장소의 소유권을 판정하고 plan/apply/verify/rollback을 책임지되, 정책 의미 승인과 작업 실행은 소유하지 않도록 경계를 확정합니다.
- 선택한 모델링 수준: bounded-context
- 이 수준을 선택한 이유: 이번 판단의 핵심은 entity 내부 구조가 아니라 어떤 책임을 도입 영역에 맡기고 어떤 책임을 사람·Governance·Execution에 남길지이기 때문입니다.
- 사람이 확인할 핵심: 기존 파일과 dirty state의 보존 책임, 충돌 시 중단 책임, 정책 후보 승인과 실행 상태를 이 영역 밖에 두는 경계가 맞는지 확인합니다.
- 승인하면 보호되는 결과: 하네스 도입이 저장소 소유자의 파일을 자동 덮어쓰거나 이관 후보를 승인된 정책으로 가장하지 않습니다.
- 반대하거나 수정해야 하는 조건: 도입 도구가 정책 의미를 결정해야 하거나 plan 없이 mutation해야 하는 실제 업무가 있다면 이 경계를 수정해야 합니다.

## Domain Experts And Sources

- target repository owner, harness maintainer, migration reviewer
- target AGENTS/design/config, release manifest, plan/apply/verification/rollback receipts

## Bounded Context Boundary

- 포함: repository classification, ownership inventory, plan, apply, verify, rollback
- 제외: 정책 의미 승인, task execution, View interaction
- downstream: BC-GOVERNANCE
- supporting: BC-RETRIEVAL

## Ubiquitous Language

| Term ID | Term | Meaning In This Context | Examples / Counterexamples | Avoid | Source / Expert |
| --- | --- | --- | --- | --- | --- |
| TERM-ADOPT-PLAN | adoption plan | mutation 전 source/target/revision/hash가 잠긴 no-write 결정물 | PLAN_READY JSON / 복사 명령 | plan 없는 apply | repository owner |
| TERM-ADOPT-OWNERSHIP | ownership class | harness-managed/project-owned/generated 경계 | KEEP_PROJECT_OWNED | 모든 파일을 managed로 취급 | repository owner |
| TERM-ADOPT-RECEIPT | apply receipt | exact mutation/preimage/result 기록 | hash-fenced receipt | 성공 메시지 | migration reviewer |

## Domain Scenarios

| Scenario ID | Actor / Goal | Given | When / Command | Then / Domain Event | Related Rule |
| --- | --- | --- | --- | --- | --- |
| SCN-ADOPT-001 | adopter가 fresh repo 초기화 | target clean, no harness | CMD-ADOPT-PLAN | EVT-ADOPT-PLAN-READY | BR-ADOPT-001 |
| SCN-ADOPT-002 | mature repo migration | project-owned conflict/dirty bytes | CMD-ADOPT-PLAN | EVT-ADOPT-DECISION-NEEDED | BR-ADOPT-002 |
| SCN-ADOPT-003 | adopter가 exact plan 적용 | plan hash/current target fence 일치 | CMD-ADOPT-APPLY | EVT-ADOPT-APPLIED | BR-ADOPT-003 |

## Domain Model

### Aggregates

| Aggregate ID | Aggregate Root | Responsibility | Invariants | Commands | Events | Consistency Boundary |
| --- | --- | --- | --- | --- | --- | --- |
| AGG-ADOPT-PLAN | AdoptionPlan | classification, actions, conflicts, source/target fence | BR-ADOPT-001, BR-ADOPT-002 | CMD-ADOPT-PLAN, CMD-ADOPT-APPLY | EVT-ADOPT-PLAN-READY, EVT-ADOPT-DECISION-NEEDED | 한 target/release plan |
| AGG-ADOPT-INSTALLATION | Installation | applied mutations, lock, verify/rollback authority | BR-ADOPT-003, BR-ADOPT-004 | CMD-ADOPT-VERIFY, CMD-ADOPT-ROLLBACK | EVT-ADOPT-APPLIED, EVT-ADOPT-VERIFIED, EVT-ADOPT-ROLLED-BACK | 한 target installation |

### Entities

| Entity ID | Entity | Identity | Lifecycle | Owning Aggregate |
| --- | --- | --- | --- | --- |
| ENT-ADOPT-ACTION | PlannedAction | target path | planned → applied/skipped/conflict | AGG-ADOPT-PLAN |
| ENT-ADOPT-MUTATION | AppliedMutation | target path + preimage | applied → verified/rolled_back | AGG-ADOPT-INSTALLATION |

### Value Objects

| Value Object ID | Value Object | Meaning | Validity / Immutability | Used By |
| --- | --- | --- | --- | --- |
| VO-ADOPT-FENCE | AdoptionFence | release/source/target revision과 plan hash | apply 전 exact match | AGG-ADOPT-PLAN |
| VO-ADOPT-PREIMAGE | FilePreimage | mutation 전 bytes/mode/existence | receipt 이후 immutable | AGG-ADOPT-INSTALLATION |

### Commands

| Command ID | Command | Actor | Target Aggregate | Preconditions | Result Event / Rejection |
| --- | --- | --- | --- | --- | --- |
| CMD-ADOPT-PLAN | PlanAdoption | adopter | AGG-ADOPT-PLAN | target readable, no mutation | EVT-ADOPT-PLAN-READY/DECISION-NEEDED |
| CMD-ADOPT-APPLY | ApplyAdoptionPlan | adopter | AGG-ADOPT-PLAN | plan hash/target fence exact | EVT-ADOPT-APPLIED 또는 stale 거절 |
| CMD-ADOPT-VERIFY | VerifyInstallation | reviewer | AGG-ADOPT-INSTALLATION | gates/evidence/human review complete | EVT-ADOPT-VERIFIED |
| CMD-ADOPT-ROLLBACK | RollbackInstallation | adopter | AGG-ADOPT-INSTALLATION | current bytes match postimage | EVT-ADOPT-ROLLED-BACK 또는 decision needed |

### Domain Events

| Event ID | Domain Event | Producer | Business Meaning | Consumers | Published Contract |
| --- | --- | --- | --- | --- | --- |
| EVT-ADOPT-PLAN-READY | AdoptionPlanReady | AGG-ADOPT-PLAN | safe exact mutation plan available | adopter | plan JSON/hash |
| EVT-ADOPT-DECISION-NEEDED | AdoptionDecisionNeeded | AGG-ADOPT-PLAN | ownership/conflict human choice required | repository owner | conflict/attention |
| EVT-ADOPT-APPLIED | HarnessApplied | AGG-ADOPT-INSTALLATION | planned mutations applied with rollback evidence | BC-GOVERNANCE | installation lock/receipt |
| EVT-ADOPT-VERIFIED | MigrationVerified | AGG-ADOPT-INSTALLATION | technical gates and human review complete | repository owner | verification receipt |
| EVT-ADOPT-ROLLED-BACK | HarnessRolledBack | AGG-ADOPT-INSTALLATION | exact mutations safely reversed | repository owner | rollback receipt |

### Domain Policies And Services

| Policy / Service ID | Kind | Trigger | Decision / Coordination | Inputs | Outputs |
| --- | --- | --- | --- | --- | --- |
| POL-ADOPT-CLASSIFY | domain-service | plan request | initialize/migrate/upgrade classification | inventory/lock | path |

## Business Rules And Invariants

| Rule ID | Rule / Invariant | Scope | Enforced By | Scenario Coverage | QA Coverage |
| --- | --- | --- | --- | --- | --- |
| BR-ADOPT-001 | plan은 apply 전까지 target을 쓰지 않는다 | AGG-ADOPT-PLAN | adoption tests | SCN-ADOPT-001 | pending |
| BR-ADOPT-002 | project-owned/dirty/conflicting bytes를 자동 overwrite하지 않는다 | AGG-ADOPT-PLAN | ownership evaluator | SCN-ADOPT-002 | pending |
| BR-ADOPT-003 | apply는 exact plan hash와 current target fence가 일치해야 한다 | AGG-ADOPT-PLAN | apply validator | SCN-ADOPT-003 | pending |
| BR-ADOPT-004 | rollback은 receipt target과 current postimage가 일치할 때만 수행한다 | AGG-ADOPT-INSTALLATION | rollback validator | SCN-ADOPT-003 | pending |

## State Transitions

| State Model | From | Command | Guard / Rule | To | Domain Event | Rejection |
| --- | --- | --- | --- | --- | --- | --- |
| AdoptionPlan | discovered | CMD-ADOPT-PLAN | BR-ADOPT-001, BR-ADOPT-002 | PLAN_READY/NEEDS_DECISION | EVT-ADOPT-PLAN-READY/DECISION-NEEDED | unreadable target |
| Installation | planned | CMD-ADOPT-APPLY | BR-ADOPT-003 | installed | EVT-ADOPT-APPLIED | stale plan |
| Installation | installed | CMD-ADOPT-VERIFY | gates+human review | verified | EVT-ADOPT-VERIFIED | awaiting review |
| Installation | installed | CMD-ADOPT-ROLLBACK | BR-ADOPT-004 | rolled_back | EVT-ADOPT-ROLLED-BACK | postimage changed |

## Context Relationships And Integration

| Related Context | Direction | Relationship Pattern | Contract / Translation | Consistency | Failure Ownership |
| --- | --- | --- | --- | --- | --- |
| BC-GOVERNANCE | downstream | Customer-Supplier | source-fenced candidates/gaps | captured base revision | Adoption freshness, Governance meaning |
| BC-RETRIEVAL | upstream service | Open Host Service | source inventory/direct reads | plan fence | Retrieval visibility |

## Failure And Exception Semantics

- conflict와 stale plan은 `NEEDS_DECISION`, writes 0입니다.
- apply 성공은 migration verified가 아닙니다.
- rollback 불확실성은 강행하지 않습니다.

## Role Consumer Contract

| Role | Questions This Model Answers | Required Sections / IDs | Required Downstream Output |
| --- | --- | --- | --- |
| customer | 기존 repository가 보존되는가 | BR-ADOPT-002, SCN-ADOPT-* | migration choice |
| planner | 어떤 단계와 human gate가 필요한가 | state transitions | adoption plan |
| architect | ownership/fence/rollback boundary는 무엇인가 | AGG-ADOPT-*, VO-ADOPT-* | migration architecture |
| developer | 어떤 plan/apply/verify 규칙을 구현하는가 | CMD/EVT/BR-ADOPT-* | CLI/tests |
| qa | no-write와 rollback을 어떻게 검증하는가 | SCN/BR-ADOPT-* | adoption fixtures |

## Traceability

| Model ID | Source / Expert | Project / Task | API / Event / Code | QA Check | Evidence |
| --- | --- | --- | --- | --- | --- |
| BR-ADOPT-002 | repository owner | future | harness-adopt.mjs | pending | adoption test fixtures |
| BR-ADOPT-004 | migration reviewer | future | rollback command | pending | rollback tests |

## Decisions

- plan과 installation을 분리해 no-write planning과 mutation authority를 섞지 않습니다.

## Unknowns And Disputes

- cross-repository bulk adoption과 organization approval directory는 범위 밖입니다.

## Change Impact

- action/state 변경은 release manifest, adopter, schemas, receipts, tests와 Board migration projection에 영향을 줍니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-30: 사람이 읽을 책임 요약과 보드 표현을 추가했다.
- 2026-07-29: adoption bounded-context model 초안을 작성했다.
