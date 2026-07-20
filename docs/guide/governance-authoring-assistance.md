---
type: guide
title: governance-authoring-assistance
status: current
governance_role: operational-guidance
owner:
created: 2026-07-18
updated: 2026-07-18
related_design:
  - docs/design/control-plane.md
  - docs/design/policy-to-evidence-governance.md
  - docs/design/initiative-governance-plane.md
related_guide:
  - docs/guide/repository-policy-extraction.md
  - docs/guide/policy-proposal-and-approval.md
  - docs/guide/initiative-governance.md
source_refs:
  - docs/design/policy-to-evidence-governance.md
  - docs/design/initiative-governance-plane.md
tags:
  - docs/guide
  - governance
  - authoring
  - human-assistance
---

# governance-authoring-assistance

- Type: guide
- Status: current
- Governance Role: operational-guidance
- Created: 2026-07-18
- Updated: 2026-07-18
- Related Design: docs/design/policy-to-evidence-governance.md; docs/design/initiative-governance-plane.md

## Purpose

거버넌스를 직접 작성해 본 경험이 없는 사용자가 정책·지침·추진안을 구분해 결정할 수 있도록 AI 도구가 질문하고, 근거가 보이는 사용자 표시 언어 초안을 만들고, 검토와 승인을 안전하게 요청하는 절차를 고정합니다.

이 guide는 작성 지원 절차이지 새 권한이 아닙니다. AI는 초안 작성과 대안 비교를 도울 수 있지만 정책, 지침, 예외, 추진안 발급·활성화 또는 위험 수용을 스스로 승인할 수 없습니다.

## Mandatory Governance Preflight

Codex와 Claude를 포함한 모든 AI 도구는 project 또는 task를 계획·발급·실행·변경하기 전에 다음을 direct-read합니다.

1. current project와 그 source가 소유한 `related_initiative`
2. active이고 승인된 추진안의 outcome, scope, out of scope, policy/guideline relationship
3. 추진안과 task가 exact ref로 고정한 effective policy, required guideline 또는 normative standard, active exception
4. source revision, source hash, approval/decision receipt와 현재 freshness

AI는 preflight 결과를 내부적으로 최소 다음처럼 구분합니다.

| Surface | 확인할 내용 | 실행 의미 |
| --- | --- | --- |
| 정책 | 보호할 결과, 비가역 경계, 적용 범위, 승인 revision | project/task가 약화하거나 재해석할 수 없는 WHY와 경계 |
| 지침 | 연결 정책, 적용 조건, required/recommended 상태, 검증·근거 | 승인된 방향을 구현하고 확인하는 HOW |
| 추진안 | 기대 outcome, why now, scope, 성공 신호, 연결 project | 여러 delivery를 같은 방향으로 묶는 outcome portfolio |

필수 source가 없거나, required governance가 미승인·stale이거나, 문서끼리 충돌하거나, 요청이 scope/out of scope를 바꾸면 구현하지 않습니다. exact gap, 영향, 추천안, 선택지와 재개 조건을 attention으로 사용자에게 제시합니다. 기존 legacy project는 명시된 migration bridge와 exact policy/normative refs가 있을 때만 그 경계를 유지해 실행하고, 추진안 연결 공백을 숨기지 않습니다.

proposal, 검색 결과, View badge, code/config observation, AI가 쓴 `approved` 문자열은 effective authority가 아닙니다. 채팅의 새 방향이 effective governance와 충돌하면 조용히 덮어쓰지 않고 proposal·exception·revision 절차로 돌립니다.

## Keep The Three Roles Separate

### 정책: WHY와 경계

정책은 무엇을 보호하고 어떤 실패를 허용하지 않을지를 설명합니다.

- 포함: 보호할 outcome, 적용 범위, non-waivable boundary, owner/decision authority, 예외 권한, review cadence
- 제외: 특정 프레임워크·제품·구현 순서, project WBS, 검증 명령의 세부 절차

`서비스는 고가용성으로 개발되어야 한다`처럼 방향만 있는 문장은 정책 후보가 될 수 있지만, AI가 임의로 `99.99%`나 특정 이중화 방식을 확정해서는 안 됩니다. 사용자가 허용 장애 범위와 중요 흐름, 측정 단위, 예외 권한을 결정하도록 돕습니다.

### 지침: HOW와 검증

지침은 연결된 정책을 어떤 상황에서 어떤 방식으로 적용하고 확인할지 설명합니다.

- 포함: 연결 policy ID, 적용/비적용 조건, required/recommended 수준, 권장 패턴과 허용 대안, verification method, evidence shape, 운영·rollback 고려
- 제외: source policy에 없는 새 비가역 경계, risk acceptance, portfolio outcome, project/task 진행률

예를 들어 상태 외부화, 다중 instance, 장애 전환 시험은 고가용성 정책을 구현하는 지침 후보가 될 수 있습니다. 그러나 모든 서비스에 같은 방식을 강제하거나 검증 기준을 승인된 근거 없이 발명하지 않습니다.

### 추진안: outcome portfolio

추진안은 정책 WHY와 선택된 지침 HOW를 여러 bounded project가 달성할 outcome으로 연결합니다.

- 포함: outcome, why now, scope/out of scope, policy relation, guideline disposition/adoption, success signals, owner, review cadence, risk, 연결 project
- 제외: 개별 project의 구현 설계, task 목록·상태 복제, 활동량만 세는 성공 기준

사용자 화면에서는 `추진안`, machine/document type에서는 `initiative`를 사용합니다. project는 `related_initiative`를 소유하고 task는 `related_project`를 통해 lineage를 따릅니다.

## User Assistance Protocol

### 1. 먼저 사용자의 언어를 보존합니다

사용자가 말한 문장을 정책·지침·추진안 중 하나로 성급하게 확정하지 않습니다. 먼저 보호하려는 결과와 현재 문제를 한두 문장으로 되짚고, source에서 확인한 사실, AI inference, assumption, unknown을 분리합니다.

### 2. 가장 작은 질문 묶음부터 묻습니다

한 번에 전체 양식을 요구하지 말고 답에 따라 다음 질문을 좁힙니다. 우선순위가 높은 질문은 다음과 같습니다.

#### 정책을 위한 질문

- 반드시 보호해야 하는 사용자·데이터·서비스 결과는 무엇인가요?
- 어떤 실패는 허용할 수 없고, 어디까지 적용되나요?
- 충돌이나 예외를 누가 결정하며 언제 다시 검토해야 하나요?
- 성공 여부를 판단하려면 어떤 결정이 아직 필요한가요?

#### 지침을 위한 질문

- 어떤 정책을 구현하며 어떤 환경·변경에 적용되나요?
- 반드시 지켜야 하는 방식과 권장 방식은 각각 무엇인가요?
- 허용 가능한 대안, 예외, rollback은 무엇인가요?
- 어떤 검사와 근거가 준수를 보여주나요?

#### 추진안을 위한 질문

- 지금 어떤 outcome을 만들고 왜 지금 필요한가요?
- scope와 out of scope는 어디까지인가요?
- 어떤 정책을 전진시키거나 제약받고, 어떤 지침을 required/recommended로 채택하나요?
- 활동량이 아니라 결과를 보여줄 success signal은 무엇인가요?
- owner, review 시점, 연결 후보 project와 중단 조건은 무엇인가요?

사용자가 답을 모르면 AI는 2~3개의 대안과 각각의 비용·위험·검증 차이를 제시할 수 있습니다. 추천 이유를 밝히되 선택을 승인으로 간주하지 않습니다.

### 3. 사용자 표시 언어 검토 초안을 만듭니다

기본 human-facing 문구는 비전문가도 한 번에 판단할 수 있는 configured `presentation.locale`로 씁니다. technical ID, enum, repository-relative path, command, exact source heading/quote, revision과 hash는 원형을 보존합니다.

초안은 최소 다음 순서로 보여줍니다.

1. 사용자의 목표를 AI가 이해한 방식
2. 정책·지침·추진안으로 분리한 초안
3. source fact와 AI가 제안한 부분
4. 적용 범위, 비범위와 영향받는 project/task
5. 검증 방법, 위험, 충돌과 아직 모르는 것
6. 사용자에게 필요한 exact 결정: `수정`, `선택`, `거절`, `발급 승인`, `활성화 승인`, `추가 근거 요청`

### 4. 관계와 근거를 확인합니다

- 각 정책은 stable ID와 source/owner를 가집니다.
- 각 지침은 하나 이상의 policy ref와 applicability, verification을 가집니다.
- 각 추진안은 policy relation과 guideline disposition을 각각 직접 설명합니다.
- 각 project는 하나의 canonical `related_initiative`를 소유합니다.
- 초안·관찰·승인·effective·enforcement 상태를 서로 다른 field와 문구로 표시합니다.

### 5. 승인 단계를 분리합니다

- AI-authored policy/guideline은 사람의 decision receipt와 effective artifact가 생기기 전까지 proposal입니다.
- 추진안 후보 검토와 numbered `I####` 발급 승인은 다릅니다.
- `I####` 발급 승인과 `status: active` activation 승인은 다릅니다.
- editorial correction, normative change, exception/risk acceptance를 같은 승인으로 묶지 않습니다.
- 승인 요청에는 exact source/diff revision, 선택지, 영향, 검증과 남는 위험을 함께 제시합니다.

## Review-Ready Quality Rubric

각 항목을 `0 = 없음`, `1 = 보완 필요`, `2 = 검토 가능`으로 평가합니다. 0점 항목이 있으면 승인 요청 전에 보완하거나 missing decision으로 명시합니다. 점수가 높아도 human approval을 대체하지 않습니다.

| Axis | 2점 기준 |
| --- | --- |
| 역할 순도 | 정책 WHY, 지침 HOW, 추진안 outcome이 섞이지 않음 |
| 사람 가독성 | 첫 문단만으로 비전문가가 결정 대상과 영향을 이해함 |
| 범위 명확성 | 적용 범위, 비범위, 예외·중단 경계가 구체적임 |
| 추적성 | stable ID, source revision/hash, 관계 ref가 해석 없이 추적됨 |
| 결정 완전성 | owner, approver, review cadence와 exact pending decision이 보임 |
| 검증 가능성 | 준수 또는 outcome을 판정할 check/evidence shape가 있음 |
| 상태 정직성 | proposal/approved/effective/enforced와 freshness를 혼동하지 않음 |
| delivery lineage | 추진안 → project → task 경로가 중복 없이 연결됨 |

## Anti-Patterns

- 정책에 특정 구현 제품과 작업 순서를 박아 넣기
- 지침이 source policy에 없는 새 MUST나 risk acceptance를 만들기
- 추진안을 project WBS 또는 task dashboard처럼 쓰기
- `문서 수`, `배포 횟수`, `코드 줄 수`만으로 outcome 성공을 선언하기
- code/config의 현재 동작을 human-approved 정책으로 승격하기
- 영어를 다른 표시 언어로 바꾸면서 범위, authority, approval 또는 evidence를 바꾸기
- 질문을 한꺼번에 쏟아 사용자가 알 수 없는 결정을 강요하기
- AI 초안, 채팅 동의, View 표시만으로 `approved` 또는 `effective`라고 쓰기
- policy/guideline/initiative 충돌을 project/task에서 임의로 해석해 우회하기

## Handoff Shape

AI가 사용자에게 거버넌스 검토를 넘길 때 최소 다음을 포함합니다.

```text
현재 상태: candidate | proposed | review-needed | approved | effective | stale
이해한 목표:
정책 초안(WHY/경계):
지침 초안(HOW/검증):
추진안 초안(outcome/portfolio):
근거와 revision:
AI가 제안한 부분:
영향받는 project/task:
검증과 남는 위험:
필요한 사용자 결정:
결정 후 다음 단계:
```

## Related Procedures

- 기존 repository에서 후보 추출: `docs/guide/repository-policy-extraction.md`
- policy/standard proposal과 promotion: `docs/guide/policy-proposal-and-approval.md`
- 추진안 후보·발급·활성화·project linkage: `docs/guide/initiative-governance.md`
- project/task 실행 preflight: `docs/EXECUTE.md`

## References

- `docs/design/policy-to-evidence-governance.md`
- `docs/design/initiative-governance-plane.md`
- `docs/guide/repository-policy-extraction.md`
- `docs/guide/policy-proposal-and-approval.md`
- `docs/guide/initiative-governance.md`

## Change Log

- 2026-07-18: 정책·지침·추진안의 역할 분리, 초보 사용자를 위한 질문·사용자 표시 언어 초안·품질 rubric·승인 handoff와 AI 실행 preflight를 정의했다.
