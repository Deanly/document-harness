---
type: guide
title: policy-proposal-and-approval
status: current
governance_role: operational-guidance
owner:
created: 2026-07-15
updated: 2026-07-15
related_project: []
related_task: []
related_design:
  - docs/design/policy-to-evidence-governance.md
  - docs/design/execution-loop-plane.md
source_refs:
  - https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20
  - https://sre.google/workbook/implementing-slos/
tags:
  - docs/guide
  - governance
  - human-approval
---

# policy-proposal-and-approval

- Type: guide
- Status: current
- Governance Role: operational-guidance
- Created: 2026-07-15
- Updated: 2026-07-15
- Related Design: docs/design/policy-to-evidence-governance.md; docs/design/execution-loop-plane.md

## Purpose

사람이 준 상위 정책을 AI가 검토 가능한 세부 rule로 제안하고, 사람이 명시적으로 승인한 뒤 design, guide, task, QA, evidence에 안전하게 반영하는 반복 절차를 설명합니다.

## Operating Principle

AI는 모호성을 숨기지 않고 구조화합니다. 사실과 승인된 결정은 source에 고정하고, AI가 추가한 가정과 추천은 proposal로 표시합니다. 사람에게 묻지 않아도 안전한 세부화는 진행하되, architecture와 risk를 바꾸는 결정은 exact 선택지와 영향으로 요청합니다.

## Policy Intake

1. 원문 policy와 owner를 확인합니다.
2. outcome, scope, affected user/data/service를 분리합니다.
3. clause마다 stable ID를 부여합니다.
4. non-waivable clause, exception authority, review cadence를 확인합니다.
5. 외부 policy면 immutable source/ref와 local applicability mapping을 분리합니다.
6. 모호한 표현을 측정 가능한 target으로 바꾸기 전에 missing decision을 기록합니다.

### AI가 안전하게 제안할 수 있는 것

- 용어 정규화와 clause 분해
- competing options와 trade-off
- 위험·failure mode·검증 아이디어
- design/guide/task/QA impact map
- measurable target의 초안과 질문

### 사람에게 반드시 요청할 것

- 인증·권한과 risk acceptance
- DB/state model 또는 core business transition
- availability/security/privacy target과 failure scope
- 배포·외부 write·비가역 작업
- mandatory rule의 채택·완화·폐기
- exception과 residual risk 수용

## Proposal Workflow

1. `report`에 `governance_role: proposal`, `proposal_kind`, `proposal_status: proposed`, `policy_refs`를 기록합니다.
2. 사실, inference, assumption, unknown을 분리합니다.
3. 최소 두 대안을 비교하고 채택하지 않을 때의 영향도 적습니다.
4. proposed rule마다 stable 후보 ID, normative wording, verification method, evidence shape를 적습니다.
5. 영향을 받는 design, guide, task, QA를 나열합니다.
6. rollout, rollback, migration, residual risk를 적습니다.
7. human에게 필요한 응답을 `approve/reject/choose/revise`처럼 정확히 요청합니다.

proposal report는 승인 전까지 task와 QA의 normative source가 아닙니다.

## Human Review And Approval

review 화면 또는 문서는 다음을 함께 보여야 합니다.

- 원 policy clause와 proposed rule
- 추천안과 대안
- 비용, 복잡도, 사용자/운영 영향
- 검증 방법과 남을 risk
- exact source/diff revision
- 필요한 approver role과 effective date

사람이 방향만 채택하면 `accepted_for_promotion`입니다. approved normative design revision이 trusted branch에 반영되고 effective date가 도래해야 `effective`입니다.

## Promotion Workflow

1. 승인된 proposed rule을 `governance_role: normative-standard` design으로 옮깁니다.
2. stable standard/rule IDs와 normative version을 고정합니다.
3. approval reference, exact content revision, effective date를 기록합니다.
4. design invariant와 failure boundary를 갱신합니다.
5. guide에는 실행 절차만 추가하고 새 MUST를 만들지 않습니다.
6. active task/QA impact scan을 수행합니다.
7. 새 task는 exact rule version과 required check를 pin합니다.
8. human view가 proposed와 effective 상태를 다르게 투영하는지 확인합니다.

## Task And QA Traceability

task `Goal Inventory`는 가능하면 `Normative Ref`와 `Required Check`를 포함합니다. QA `Traceability`는 다음 열을 사용합니다.

| Policy Clause | Standard Rule | Task / Goal | Check ID | Evidence | Exception | Verdict |
| --- | --- | --- | --- | --- | --- | --- |

Check는 자동 명령, monitor query, failure drill, manual runbook step, inspection 중 하나일 수 있지만 환경, 입력, pass condition, evidence shape, cadence, owner가 있어야 합니다.

## Exception Workflow

1. base rule 실패를 그대로 기록하고 pass로 바꾸지 않습니다.
2. scope, reason, residual risk, compensating controls를 적습니다.
3. required checks, expiry, exit task를 정합니다.
4. 실제 risk를 수용할 human approver에게 요청합니다.
5. approval은 exact exception revision에 묶습니다.
6. QA verdict는 `excepted`와 exception ID/expiry를 표시합니다.
7. expiry 때 자동 연장하지 않고 `needs-review` 또는 fail gate로 전환합니다.

## Conflict And Change Handling

- 새 policy/standard가 active task에 영향이 없으면 impact evidence만 남깁니다.
- 후속 준수가 필요하면 새 task를 발급합니다.
- 기존 completion contract가 무효가 되면 goal을 편집해 닫지 말고 기존 task를 `superseded`하고 재발급합니다.
- 최신 chat instruction이 effective rule과 충돌하면 충돌을 attention request로 만들고 승인된 revision/exception이 생길 때까지 실행을 멈춥니다.
- editorial change는 normative version을 유지할 수 있지만 새 content revision은 review 대상입니다.
- additive, breaking, relaxing change는 normative version과 human reapproval을 요구합니다.

## High Availability Walkthrough

Policy: “Tier-1 서비스는 고가용성이어야 한다.”

AI는 먼저 다음을 결정해 달라고 요청합니다.

- target journey와 SLI/SLO/error budget
- 견뎌야 하는 zone/region/process failure
- RPO/RTO와 degradation mode
- state 분류, consistency, acknowledgement boundary
- 비용과 운영 ownership

그 뒤에야 shared storage, replicated database, quorum, stateless application, N-1 capacity, failover drill을 대안으로 비교합니다. “상태는 공유 스토리지에 둔다”는 rule은 policy 자체가 아니라 선택 가능한 표준 후보 중 하나입니다.

## Human View Presentation

- policy와 effective rule을 화면의 “Direction” 영역에 둡니다.
- proposed rule은 effective rule과 색상/label을 달리합니다.
- 각 task에 적용되는 policy/rule/check/evidence lineage를 표시합니다.
- policy conflict, missing decision, expiring exception은 Attention Queue에 올립니다.
- approval action은 source/checkpoint/diff fence가 stale하면 비활성화합니다.
- AI summary 옆에 authoritative source path/revision과 freshness를 표시합니다.

## Review Checklist

- [ ] policy owner와 required approver가 사람 또는 authorized role로 지정됐는가
- [ ] proposal과 effective standard가 분리됐는가
- [ ] 사실, inference, assumption, unknown이 구분됐는가
- [ ] exact policy/standard version을 pin했는가
- [ ] guide가 design에 없는 MUST를 만들지 않는가
- [ ] task goal과 QA check가 rule까지 추적되는가
- [ ] approval/exception이 source revision과 scope에 묶였는가
- [ ] active task impact와 migration/rollback을 검토했는가
- [ ] view에서 proposal/effective/stale을 구분하는가

## References

- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20)
- [Google SRE Workbook: Implementing SLOs](https://sre.google/workbook/implementing-slos/)
- [policy-to-evidence-governance](../design/policy-to-evidence-governance.md)

## Change Log

- 2026-07-15: policy intake, AI proposal, human approval, promotion, exception, traceability workflow를 추가했다.
