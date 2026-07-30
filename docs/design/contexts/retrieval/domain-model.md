---
type: design
design_kind: bounded-context
title: retrieval-domain-model
display_title: 필요한 원문을 최신 상태로 찾기
human_summary: 역할과 작업에 필요한 원문을 정확한 위치와 버전으로 찾고 변경 여부를 알리는 업무입니다.
presentation_status: review_requested
presentation_ref:
status: review_requested
domain: document-harness
bounded_context: retrieval
bounded_context_id: BC-RETRIEVAL
subdomain_type: generic
model_revision: 1
validation_status: review_requested
validation_ref:
domain_expert_roles:
  - knowledge-owner
  - retrieval-operator
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
  - docs/architecture/retrieval-plane.md
  - docs/_indexes/context-packets.yaml
source_refs:
  - docs/architecture/retrieval-plane.md
  - docs/guide/hybrid-retrieval-and-freshness.md
tags:
  - docs/design
  - ddd
  - retrieval
---

# retrieval-domain-model

## Domain Purpose And Customer Outcome

사람과 AI가 필요한 authoritative source revision을 찾고, 변경·삭제·rename 이후에도 stale 결과를 current truth로 오인하지 않도록 합니다.

## Human Review Summary

- 이 영역의 책임: 필요한 원문의 위치와 버전을 찾고 현재 내용과 달라졌는지 알려 줍니다.
- 포함하지 않는 것: 검색 결과를 원문 자체로 취급하거나 원문의 의미와 승인 상태를 새로 만들지 않습니다.
- 사용자에게 보이는 실패: 원문을 찾지 못했거나 오래된 근거이면 최신 사실처럼 보여 주지 않고 확인 필요로 알립니다.
- 아직 결정할 것: 저장소별 기본 검색 범위와 민감 문서 접근 경계는 지식 소유자가 확정해야 합니다.

## Domain Experts And Sources

- knowledge owner, repository owner, retrieval operator와 context consumer
- filesystem/Git source, registry, index receipts와 direct-read evidence

## Bounded Context Boundary

- 포함: source identity, document head, index generation, visibility, tombstone, query/read fence
- 제외: source의 업무 의미, policy approval, task action
- downstream customers: BC-GOVERNANCE, BC-EXECUTION, BC-ADOPTION

## Ubiquitous Language

| Term ID | Term | Meaning In This Context | Examples / Counterexamples | Avoid | Source / Expert |
| --- | --- | --- | --- | --- | --- |
| TERM-RET-SOURCE | authoritative source | current truth를 소유하는 repository file/revision | Markdown/Git source / cache | index를 truth라 부르기 | knowledge owner |
| TERM-RET-HEAD | document head | 한 document의 current revision/hash/presence | head record / search hit | path만 identity로 사용 | retrieval operator |
| TERM-RET-FRESHNESS | freshness proof | result revision이 required source revision 이상임을 보이는 상태 | read-your-writes/direct read | recent timestamp | consumer |

## Domain Scenarios

| Scenario ID | Actor / Goal | Given | When / Command | Then / Domain Event | Related Rule |
| --- | --- | --- | --- | --- | --- |
| SCN-RET-001 | consumer가 방금 쓴 문서를 읽음 | source revision N, index N-1 | CMD-RET-QUERY | EVT-RET-DIRECT-READ-USED 또는 N publish | BR-RET-001 |
| SCN-RET-002 | owner가 문서 삭제 | settled source absence | CMD-RET-RECONCILE | EVT-RET-DOCUMENT-TOMBSTONED | BR-RET-002 |
| SCN-RET-003 | owner가 문서 rename | stable document identity | CMD-RET-RECONCILE | EVT-RET-DOCUMENT-RENAMED | BR-RET-003 |

## Domain Model

### Aggregates

| Aggregate ID | Aggregate Root | Responsibility | Invariants | Commands | Events | Consistency Boundary |
| --- | --- | --- | --- | --- | --- | --- |
| AGG-RET-DOCUMENT | DocumentHead | identity, current revision/hash, path와 presence | BR-RET-002, BR-RET-003 | CMD-RET-RECONCILE | EVT-RET-DOCUMENT-TOMBSTONED, EVT-RET-DOCUMENT-RENAMED | 한 logical document |
| AGG-RET-GENERATION | IndexGeneration | compatible arms, publish/read fence와 visibility | BR-RET-001, BR-RET-004 | CMD-RET-PUBLISH, CMD-RET-QUERY | EVT-RET-REVISION-PUBLISHED, EVT-RET-DIRECT-READ-USED | 한 compatible generation |

### Entities

| Entity ID | Entity | Identity | Lifecycle | Owning Aggregate |
| --- | --- | --- | --- | --- |
| ENT-RET-REVISION | SourceRevision | document ID + revision sequence | indexed → active/inactive/tombstoned | AGG-RET-DOCUMENT |
| ENT-RET-ARM | RetrievalArm | generation + arm name | building → ready → active/retired | AGG-RET-GENERATION |

### Value Objects

| Value Object ID | Value Object | Meaning | Validity / Immutability | Used By |
| --- | --- | --- | --- | --- |
| VO-RET-IDENTITY | DocumentIdentity | rename에도 유지되는 logical ID | path와 독립 | AGG-RET-DOCUMENT |
| VO-RET-READ-FENCE | LogicalReadFence | 한 query가 읽는 registry/generation/head epoch | query 동안 immutable | AGG-RET-GENERATION |
| VO-RET-HASH | ContentHash | source bytes 동일성 | SHA-256 | all |

### Commands

| Command ID | Command | Actor | Target Aggregate | Preconditions | Result Event / Rejection |
| --- | --- | --- | --- | --- | --- |
| CMD-RET-RECONCILE | ReconcileSource | operator | AGG-RET-DOCUMENT | settled/readable source observation | tombstone/rename/update event |
| CMD-RET-PUBLISH | PublishRevision | indexer | AGG-RET-GENERATION | compatible arms same revision ready | EVT-RET-REVISION-PUBLISHED |
| CMD-RET-QUERY | QueryCurrentTruth | consumer | AGG-RET-GENERATION | required revision/read fence known | result 또는 EVT-RET-DIRECT-READ-USED |

### Domain Events

| Event ID | Domain Event | Producer | Business Meaning | Consumers | Published Contract |
| --- | --- | --- | --- | --- | --- |
| EVT-RET-REVISION-PUBLISHED | RevisionPublished | AGG-RET-GENERATION | current revision이 searchable해짐 | all contexts | document ID/revision/generation |
| EVT-RET-DIRECT-READ-USED | DirectReadUsed | AGG-RET-GENERATION | stale/unknown index 대신 source를 읽음 | consumer | path/hash/revision |
| EVT-RET-DOCUMENT-TOMBSTONED | DocumentTombstoned | AGG-RET-DOCUMENT | 삭제 source가 결과에서 제외됨 | consumers | document ID/presence |
| EVT-RET-DOCUMENT-RENAMED | DocumentRenamed | AGG-RET-DOCUMENT | identity를 유지하며 active path 변경 | consumers | document ID/old/new path |

### Domain Policies And Services

| Policy / Service ID | Kind | Trigger | Decision / Coordination | Inputs | Outputs |
| --- | --- | --- | --- | --- | --- |
| POL-RET-FRESHNESS | domain-service | query/update/delete/rename | wait, direct-read 또는 degraded 결정 | source/index revisions | current result/freshness state |

## Business Rules And Invariants

| Rule ID | Rule / Invariant | Scope | Enforced By | Scenario Coverage | QA Coverage |
| --- | --- | --- | --- | --- | --- |
| BR-RET-001 | index는 source truth를 대체하지 않으며 required revision보다 오래되면 direct-read/wait/degraded로 처리한다 | AGG-RET-GENERATION | retrieval validator/runtime | SCN-RET-001 | pending |
| BR-RET-002 | confirmed deletion은 physical compaction 전에도 검색 결과에서 제외한다 | AGG-RET-DOCUMENT | tombstone filter | SCN-RET-002 | pending |
| BR-RET-003 | rename은 가능하면 logical document identity를 보존한다 | AGG-RET-DOCUMENT | registry/reconciliation | SCN-RET-003 | pending |
| BR-RET-004 | incompatible index arms를 한 current result로 섞지 않는다 | AGG-RET-GENERATION | publish/read fence | SCN-RET-001 | pending |

## State Transitions

| State Model | From | Command | Guard / Rule | To | Domain Event | Rejection |
| --- | --- | --- | --- | --- | --- | --- |
| SourceRevision | indexed | CMD-RET-PUBLISH | BR-RET-004 | active | EVT-RET-REVISION-PUBLISHED | incompatible/not ready |
| DocumentHead | present | CMD-RET-RECONCILE | BR-RET-002 | tombstoned | EVT-RET-DOCUMENT-TOMBSTONED | indeterminate absence |
| DocumentHead | old path | CMD-RET-RECONCILE | BR-RET-003 | new path | EVT-RET-DOCUMENT-RENAMED | ambiguous identity |

## Context Relationships And Integration

| Related Context | Direction | Relationship Pattern | Contract / Translation | Consistency | Failure Ownership |
| --- | --- | --- | --- | --- | --- |
| BC-GOVERNANCE | downstream customer | Open Host Service + ACL | revision/hash/freshness only, meaning 제외 | source fence | Retrieval visibility |
| BC-EXECUTION | downstream customer | Open Host Service + ACL | current model/task ref resolution | task start/closeout | Retrieval freshness |
| BC-ADOPTION | downstream customer | Open Host Service | repository inventory/direct read | plan fence | Retrieval source observation |

## Failure And Exception Semantics

- unreadable/temporary missing은 deletion으로 확정하지 않습니다.
- unknown freshness는 current가 아니며 approval/action을 멈출 수 있습니다.
- lexical/dense miss는 source absence가 아닙니다.

## Role Consumer Contract

| Role | Questions This Model Answers | Required Sections / IDs | Required Downstream Output |
| --- | --- | --- | --- |
| customer | 표시된 정보가 최신인가 | BR-RET-001 | freshness interpretation |
| planner | 어떤 source를 요구사항 근거로 쓸 수 있는가 | TERM-RET-*, read fence | source refs |
| architect | identity/generation/failure boundary는 무엇인가 | AGG/VO-RET-* | retrieval architecture |
| developer | publish/query/reconcile 규칙은 무엇인가 | CMD/EVT/BR-RET-* | runtime/tests |
| qa | update/delete/rename/read-your-writes를 어떻게 검증하는가 | SCN/BR-RET-* | QA checks |

## Traceability

| Model ID | Source / Expert | Project / Task | API / Event / Code | QA Check | Evidence |
| --- | --- | --- | --- | --- | --- |
| BR-RET-001 | knowledge owner | T0001 legacy | retrieval policy/validator | pending | retrieval tests |
| BR-RET-002 | retrieval operator | T0001 legacy | tombstone filter | pending | delete fixture |

## Decisions

- source identity와 index generation을 분리해 rename/presence와 search compatibility를 독립적으로 관리합니다.

## Unknowns And Disputes

- backend-specific revision sequence와 distributed read fence 구현은 architecture decision입니다.

## Change Impact

- identity/freshness/event 변경은 retrieval policy/index, role context loading, Board source freshness와 QA에 영향을 줍니다.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-30: 사람이 읽을 책임 요약과 보드 표현을 추가했다.
- 2026-07-29: retrieval bounded-context model 초안을 작성했다.
