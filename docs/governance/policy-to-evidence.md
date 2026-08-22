---
type: governance
title: policy-to-evidence-governance
status: current
domain: governance
governance_role: governance-control
owner:
created: 2026-07-15
updated: 2026-08-19
retrieval_class:
  - domain-current
context:
  default_load: false
  section_load: false
  evidence_only: false
  size_tier: small
referenced_by:
  - docs/architecture/control-plane.md
  - docs/architecture/execution-loop-plane.md
  - docs/architecture/human-control-view-plane.md
source_refs:
  - https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20
  - https://doi.org/10.6028/NIST.SP.800-53r5
  - https://sre.google/workbook/implementing-slos/
tags:
  - docs/governance
  - governance
  - policy
  - traceability
---

# policy-to-evidence-governance

- Type: design
- Status: current
- Domain: governance
- Governance Role: governance-control
- Owner:
- Created: 2026-07-15
- Updated: 2026-07-15
- Referenced By: docs/architecture/control-plane.md; docs/architecture/execution-loop-plane.md; docs/architecture/human-control-view-plane.md

## Context

사용자는 서비스가 어떤 결과와 제약을 지켜야 하는지 정책으로 정할 수 있어야 하고, AI는 그 의도를 실행 가능한 설계·검증으로 구체화해야 합니다. 그러나 AI가 상위 문장을 곧바로 기술 선택으로 바꾸면 숨은 가정이 인간의 권한을 대체합니다. 반대로 모든 세부 결정을 사람에게 맡기면 loop가 불필요하게 멈춥니다.

이 설계는 사람이 소유할 판단, AI가 안전하게 제안할 판단, 승인된 뒤 효력을 얻는 artifact, 실행과 증거의 추적 경계를 분리합니다.

## Whole-System Role

- 인간이 전체 개발 방향과 risk acceptance를 소유하게 합니다.
- AI가 policy를 세부화하되 자기 제안을 스스로 승인하지 못하게 합니다.
- 승인된 rule이 design, guide, task, QA, evidence로 손실 없이 이어지게 합니다.
- human control view가 “왜 이 작업을 하는가”와 “무엇이 아직 제안인가”를 설명할 수 있는 stable graph를 제공합니다.

## Authority Boundary

권한은 문서의 최신 시각이나 자연어의 강한 어조가 아니라 governance role과 approval state로 결정합니다.

```text
human-owned policy
  → AI-authored proposal report (non-authoritative)
  → explicit human acceptance
  → effective normative design
  → operational guide
  → task goal + QA check
  → verification receipt + closeout
```

우선순위는 다음과 같습니다.

1. 적용되는 법적·안전·repository guardrail
2. effective human policy와 non-waivable clause
3. effective normative standard design
4. 승인된 scoped exception overlay
5. task contract와 acceptance criteria
6. operational guide
7. AI가 작성한 proposal 또는 해석

하위 artifact는 상위 rule을 완화할 수 없습니다. 새 사용자 지시가 effective rule과 충돌하면 AI는 한쪽을 조용히 선택하지 않고 충돌, 영향, 가능한 policy revision 또는 exception을 제시합니다. 계약 변경 없이 독립 disposition만 필요하면 `needs_review`, authority 또는 policy 충돌로 실행할 수 없으면 `stopped / CONFLICT`와 human attention을 사용합니다.

## Governance Roles

새 artifact type을 만들지 않고 기존 artifact에 다음 role을 부여합니다.

| Governance Role | Artifact | Holds | Must Not Do |
| --- | --- | --- | --- |
| `human-policy` | `design`, 또는 외부 policy raw source를 매핑한 `design` | human-owned outcome, scope, non-waivable clause, approver role | 세부 구현을 근거 없이 고정 |
| `proposal` | `report` | AI가 제안한 standard, option, impact, exception | 승인 전 task/QA의 normative source가 됨 |
| `normative-standard` | `design` | effective MUST/SHOULD, stable rule ID, invariant, failure boundary | approval 없는 rule을 effective로 표시 |
| `operational-guidance` | `guide` | standard를 적용하는 HOW, checklist, runbook | design에 없는 새 MUST를 단독 생성 |
| `implementation` | `task` | exact rule version에 대한 bounded delivery와 evidence | 상위 goal/rule을 조용히 축소 |
| `verification` | `qa` | rule-to-check-to-evidence traceability | 현재 코드 동작을 요구사항의 유일한 근거로 사용 |

`governance_role`이 비어 있는 일반 design/guide/report는 기존 artifact contract를 그대로 따릅니다.

## Policy Record Contract

`governance_role: human-policy` design은 최소한 다음을 가집니다.

- stable policy ID와 normative version
- human policy owner와 required approver role
- outcome, scope, affected service/data/user
- individually addressable policy clauses
- non-waivable clause와 허용되는 exception 범위
- effective date, supersedes, review cadence
- approval reference bound to an exact content revision
- policy가 침묵할 때의 escalation rule

외부 회사 정책이 authoritative source라면 원문은 변경하지 않고 raw source 또는 external reference로 보존하며, local design은 clause mapping과 적용 범위만 소유합니다.

## Proposal And Promotion Contract

AI는 policy clause로부터 proposal report를 만들 수 있습니다. proposal에는 다음을 함께 제시합니다.

- 어떤 policy clause에서 파생했는지
- 사실, 추론, 미확정 가정
- competing options와 trade-off
- proposed rule IDs와 normative wording
- 예상되는 design/task/QA 영향
- 검증 방법과 evidence shape
- rollout, rollback, residual risk
- human에게 필요한 정확한 결정

`proposal_status: proposed` 또는 `accepted_for_promotion`은 effective와 다릅니다. rule은 human approval이 exact design revision에 연결되고 effective date가 도래한 뒤에만 `normative-standard` design에서 효력을 얻습니다.

## Policy To Evidence Traceability

독립 RTM 문서를 추가하지 않고 task Goal Inventory와 QA Traceability 행에 연결을 둡니다.

```text
POL-HA-001@2#P3
  → STD-HA-001@4#HA-R2
  → T0042/G2
  → QA0017/HA-C03
  → receipt://T0042/verify-07
```

최소 traceability 필드는 다음과 같습니다.

| Policy Clause | Standard Rule | Task / Goal | Check | Evidence | Exception | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| exact version + clause | exact version + rule | stable task/goal ID | stable check ID | immutable receipt ref | optional exact ID | pass/fail/excepted/needs-review |

task와 QA는 `latest`를 참조하지 않고 exact normative version과 stable rule ID를 pin합니다.

## Approval Contract

AI는 proposal 작성과 review 보조는 할 수 있지만 normative approval 또는 risk acceptance를 행사할 수 없습니다.

유효한 approval reference는 최소한 다음에 결합됩니다.

- policy/standard/exception ID와 normative version
- exact Git revision, source hash 또는 diff hash
- human approver identity 또는 authorized role
- approval time와 effective time
- scope와 expiry가 있는 경우 그 값

Markdown에 `approved_by` 문자열을 쓰는 것만으로는 승인 권한을 증명하지 않습니다. 실제 강제력은 trusted branch review, CODEOWNERS, protected branch 또는 downstream approval system이 담당하며 document harness validator는 구조와 reference 완전성을 검사합니다.

### Decision Economy And Human Approval Request

승인은 이미 정한 목표를 매 turn 다시 확인하는 의식이 아니라, 기존 authority로는 결정할 수 없는 material delta를 사람이 선택하는 경계입니다. 유효하고 fresh한 goal, task contract, policy, initiative, directive와 approval은 scope 안에서 계속 재사용합니다. agent는 그 경계를 바꾸지 않는 routine·가역·저위험 구현 세부사항을 스스로 판단하며, 단지 여러 방법이 가능하거나 기술적으로 새로운 선택을 했다는 이유만으로 재승인을 요청하지 않습니다.

새 human approval은 최소한 다음 중 하나가 실제로 발생할 때만 요청합니다.

- 승인된 goal, outcome, scope, acceptance 또는 completion contract의 material change
- 기존 policy·initiative·directive가 답하지 않는 strategic/business meaning 결정
- non-waivable boundary의 완화, exception 또는 residual risk acceptance
- high/critical risk, 비가역 action, production/secret 접근 또는 외부 write
- 현재 approval fence의 source/diff/scope가 바뀌어 기존 승인이 stale해짐
- 충돌하는 authoritative source 중 무엇을 따를지 사람이 선택해야 함

승인 요청은 configured `presentation.locale`의 평이한 사람 언어로 먼저 다음을 설명합니다.

1. 현재 목표와 지금까지 완료·확인한 작업
2. 왜 기존 결정과 agent 재량만으로는 다음 action을 정당화할 수 없는지
3. 사람이 승인할 정확한 action과 보호하려는 경계
4. 기존 결정에서 달라지는 material delta
5. 추천안, 현실적인 대안과 각각의 영향
6. 승인하면 무엇이 실행되고 승인하지 않으면 무엇이 멈추거나 계속 가능한지

ID, hash, path, revision과 opaque token은 아래의 evidence/fence metadata로 제공하며 사람에게 의미 없는 문자열을 복사해 승인 의사로 발화하도록 요구하지 않습니다. 자연어 응답을 AI가 임의로 approval로 승격할 수는 없습니다. trusted UI, authenticated command 또는 downstream approval adapter가 사람이 본 decision package와 선택을 exact fence에 묶어 durable receipt로 기록해야 합니다.

## Versioning Contract

- `content_revision`: exact commit/hash이며 어떤 수정에서도 바뀝니다.
- `normative_version`: rule의 의미가 바뀔 때만 증가합니다.
- `change_kind`: `editorial`, `additive`, `breaking`, `relaxing` 중 하나입니다.
- stable rule ID는 의미가 유지될 때 보존하고 의미가 달라지면 새 ID를 발급합니다.
- `breaking` 또는 `relaxing` 변경은 human reapproval과 downstream impact scan을 요구합니다.
- active task의 completion contract가 무효가 되면 기존 task를 조용히 편집하지 않고 `superseded` 후 재발급합니다.

## Exception Contract

exception은 base standard를 바꾸거나 실패를 pass로 위장하지 않는 scoped overlay입니다.

필수 필드:

- exception ID/version과 exact rule refs
- scope, owner, human risk acceptor
- reason, residual risk, compensating controls
- required checks와 evidence cadence
- effective/expiry time
- exit task와 approval reference
- `requested`, `active`, `expired`, `revoked`, `superseded` 상태

AI는 exception request를 제안할 수 있지만 승인할 수 없습니다. expiry는 자동 연장되지 않으며, 만료되면 verdict를 `fail` 또는 `needs-review`로 돌립니다. QA는 base case와 compensating-control case를 모두 보존합니다.

## High Availability Example

“서비스는 고가용성으로 개발해야 한다”는 유효한 policy direction이지만 그 자체로 공유 스토리지, active-active, quorum 같은 구현을 고정하지 않습니다.

AI는 먼저 다음 missing decision을 attention request로 만듭니다.

1. 어떤 사용자 journey와 service tier가 대상입니까?
2. availability SLI, SLO, error budget은 무엇입니까?
3. 어떤 failure domain의 손실을 견뎌야 합니까?
4. state 유형과 consistency/acknowledgement boundary는 무엇입니까?
5. RPO, RTO, degradation mode는 무엇입니까?
6. 비용, 운영 복잡도, data residency 제약은 무엇입니까?

답이 승인되면 AI는 stateless compute, replicated state, quorum, shared/distributed storage, N-1 capacity, failover drill 등의 대안을 비교한 proposal을 작성합니다. 승인된 rule만 normative design으로 승격되며 task와 QA는 그 exact rule을 검증합니다.

## View Projection Contract

projector, snapshot API/SSE, freshness와 security의 canonical contract는 `docs/architecture/human-control-view-plane.md`가 소유합니다. 이 문서는 governance node/edge와 authority label만 소유합니다.

사용자 화면 `Board`(human control view)은 정책과 지침을 서로 연결하되 독립 최상위 tab으로 구분하고 다음을 표시합니다.

- human policy와 effective normative rule
- proposed/accepted/effective/superseded 상태
- policy → standard → design/guide → task goal → QA check → evidence graph
- open exception, expiry, residual risk, human risk acceptor
- policy conflict 또는 missing decision으로 열린 attention request

view의 AI summary는 설명을 돕지만 approval state와 effective rule은 source field와 receipt에서 결정론적으로 투영합니다.

## Invariants

- AI proposal은 explicit human approval 전까지 normative authority가 없습니다.
- guide는 design에 없는 mandatory rule을 새로 만들지 않습니다.
- task/QA는 proposal report를 normative source로 참조하지 않습니다.
- approval과 exception은 exact revision/scope에 묶이며 source가 바뀌면 stale이 됩니다.
- policy change는 기존 task goal을 조용히 약화하지 않습니다.
- exception은 base rule과 분리되고 만료와 exit path가 있습니다.
- 모든 effective rule은 task goal 또는 QA check까지 추적 가능해야 합니다.
- fresh한 기존 결정은 scope 안에서 재사용하며, routine·가역·저위험 구현 세부사항 때문에 반복 승인을 만들지 않습니다.
- human approval request는 작업 요약, 승인 이유, material delta, 선택 영향과 승인 결과를 사람이 읽는 언어로 먼저 설명하고 opaque copy/paste phrase를 요구하지 않습니다.

## Failure Boundaries

- policy가 모호하거나 상충하면 AI는 제안과 질문을 만들고 인간 결정 없이 구현 선택을 effective로 만들지 않습니다.
- approval authority를 검증할 수 없으면 `accepted`가 아니라 `needs_review`로 유지합니다.
- stale revision의 approval/exception은 fail closed 합니다.
- traceability가 끊기면 closeout evidence가 있어도 governance compliance는 완료로 간주하지 않습니다.
- external policy source를 읽을 수 없으면 이전 해석을 current truth로 조용히 반환하지 않습니다.

## Decisions

| Decision | Rationale |
| --- | --- |
| governance role을 기존 artifact에 추가 | 새 lifecycle/numbering 체계를 만들지 않고 authority를 구분합니다. |
| proposal과 effective standard를 다른 artifact로 분리 | AI의 제안·승인 권한 순환을 막습니다. |
| traceability를 task/QA 행에 내장 | 별도 RTM drift를 피합니다. |
| approval은 revision-bound reference | 화면이나 문서가 바뀐 뒤의 stale 승인을 막습니다. |
| high-level policy에서 missing decision을 먼저 표면화 | 인간의 의도를 숨은 기술 가정으로 대체하지 않습니다. |

## Artifact Contracts

- `design`: human policy, effective normative standard, governance invariant
- `report`: AI proposal, options, impact analysis, approval request
- `guide`: approved standard를 적용하는 절차와 반복 판단
- `task`: pinned rule/goal, execution checkpoint, evidence and closeout
- `qa`: policy/rule/task goal/check/evidence traceability
- `execution-loop-plane`: conflict, attention, decision receipt, resume/stop control
- `human-control-view`: policy와 evidence graph의 derived projection

## Open Questions

- downstream이 human approval authority를 Git review, external IAM, 또는 둘의 결합 중 무엇으로 증명할지
- organization policy 원문에 대한 sensitivity/redaction metadata
- exception expiry를 CI/deployment gate에 연결하는 방법

## References

- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20)
- [NIST SP 800-53 Revision 5](https://doi.org/10.6028/NIST.SP.800-53r5)
- [Google SRE Workbook: Implementing SLOs](https://sre.google/workbook/implementing-slos/)

## Change Log

- 2026-08-19: 기존 결정 재사용, bounded agent discretion, material-delta approval trigger와 human-readable decision package를 추가하고 opaque 승인 문구 복사를 금지했다.
- 2026-07-15: human policy, AI proposal, approval, standard, exception, policy-to-evidence traceability contract를 추가했다.
