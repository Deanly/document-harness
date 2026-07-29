---
type: initiative
doc_id: {{DOC_ID}}
initiative_contract: v1
title: {{TITLE}}
status: draft
approval_status: unreviewed
issuance_approval_ref: {{ISSUANCE_APPROVAL_REF}}
approval_ref:
owner:
sponsor:
created: {{DATE}}
updated: {{DATE}}
current_focus:
related_control_plane: docs/architecture/control-plane.md
policy_refs: []
guideline_refs: []
guideline_disposition: needs_review
guideline_disposition_reason:
source_refs: []
quality_axes:
  - WHOLE
  - SCOPE
  - EVIDENCE
  - HANDOFF
tags:
  - docs/initiative
---

# {{DOC_ID}} {{TITLE}}

- Type: initiative
- 사용자 유형: 추진안
- Document ID: {{DOC_ID}}
- Status: draft
- Approval Status: unreviewed
- Issuance Approval Ref: {{ISSUANCE_APPROVAL_REF}}
- Approval Ref:
- Guideline Disposition: needs_review
- Guideline Disposition Reason:
- Owner:
- Sponsor:
- Created: {{DATE}}
- Updated: {{DATE}}
- Current Focus:
- Related Control Plane: docs/architecture/control-plane.md

## Purpose

이 추진안이 왜 존재하며 어떤 정책적 방향을 실제 outcome portfolio로 바꾸는지 적습니다.

## Human Approval Gate

- 번호 발급을 명시적으로 승인한 사람과 `Issuance Approval Ref`의 의미를 적습니다.
- exact revision activation을 승인할 사람 또는 역할을 적습니다.
- activation 시 `docs/_templates/initiative-activation-receipt.json`을 채우고 canonical 문서·register·catalog와 함께 검증할 repository-relative JSON `approval_ref`를 남깁니다.
- AI가 proposal과 관계 근거를 작성했더라도 스스로 승인하지 않았음을 확인합니다.

## Outcome

- 프로젝트 목록이 아니라 이 추진안이 성공했을 때 달라져야 하는 사용자·운영·시스템 결과를 적습니다.

## Why Now

- 지금 이 outcome을 추진해야 하는 정책, 위험, 기회 또는 deadline 근거를 적습니다.

## Scope

- 이 추진안이 직접 소유하는 outcome과 portfolio 범위

## Out Of Scope

- 별도 추진안, 프로젝트 또는 운영 조직이 소유할 범위

## Policy Alignment

정책은 추진안의 WHY/WHAT을 제공합니다. policy가 연결된 guideline을 가지고 있더라도 direct policy relation을 생략하지 않습니다.

| Policy Ref | Relation | Rationale | Exception Ref |
| --- | --- | --- | --- |
| POL-EXAMPLE | advances | outcome과 policy 방향의 관계 | |

허용 relation: `advances`, `constrained-by`, `exception-to`.

## Guideline Disposition

지침은 프로젝트 적용과 검증의 HOW/EVIDENCE를 제공합니다. `guideline_disposition`은 `linked`, `no_applicable_guideline`, `needs_review` 중 하나이며 `linked`일 때만 하나 이상의 guideline ref가 필수입니다. `guideline_disposition_reason`에는 선택·검토·비적용 이유를 사람이 판단할 수 있게 적습니다.

| Guideline Ref | Adoption | Rationale | Verification |
| --- | --- | --- | --- |
| GUIDE-EXAMPLE | required | 이 추진안에서 지침이 필요한 이유 | 확인할 check 또는 evidence |

허용 adoption: `required`, `recommended`. 적용할 지침이 없다면 개별 관계에 `not-applicable`을 쓰지 않고, 표를 비운 뒤 `guideline_disposition: no_applicable_guideline`과 구체적인 이유를 기록합니다.

## Linked Projects

project source가 이 추진안의 `I####`를 `related_initiative`로 선언합니다. View와 index는 그 관계를 reverse-index해 연결 project를 보여줍니다. 이 문서에는 project 목록, WBS, task 상태를 중복 저장하지 않습니다.

project가 선언할 수 있는 관계는 `delivers`, `supports`, `explores`입니다.

## Success Signals

| Signal ID | Measure / Observation | Target / Decision Rule | Evidence Source |
| --- | --- | --- | --- |
| S1 | outcome을 판정할 측정 또는 관찰 | 어떤 상태면 성공인지 | source 또는 check |

## Risks And Assumptions

- 정책 conflict, guideline 적용 불확실성, project dependency, outcome 측정 위험을 적습니다.

## Review Cadence

- owner와 사람이 이 추진안을 언제 다시 검토하고 stale approval을 어떻게 판정할지 적습니다.

## Outcome Review

`Success Signals`의 각 `Signal ID`를 1:1로 다시 적고 상태와 evidence를 기록합니다.

| Signal ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| S1 | Pending | | |

## Completion Guardrails

- 연결 project 수나 완료 task 수만으로 추진안을 `done` 처리하지 않습니다.
- `done` 전환에는 모든 success signal의 `Met` 상태와 evidence가 필요합니다.
- 승인되지 않았거나 stale한 추진안을 active portfolio truth로 사용하지 않습니다.
- scope 또는 outcome이 바뀌면 원래 추진안을 축소해 닫지 말고 `superseded` 여부를 검토합니다.
- project link는 project source status를 투영할 뿐 lifecycle truth를 소유하지 않습니다.

## Status

- {{DATE}}: human-approved issuance ref `{{ISSUANCE_APPROVAL_REF}}`에 따라 추진안 draft를 발급함. activation approval은 아직 없음.
