# goal-locked-completion

- Type: guide
- Created: 2026-04-13
- Updated: 2026-04-14

## Purpose

이 문서는 AI나 사람이 기존 `project` 또는 `task`를 임의로 더 작은 조각으로 분할한 뒤, 원래 발급된 목표를 달성하지 않았는데도 `done`으로 닫아버리는 문제를 막기 위한 완료 무결성 규칙을 고정합니다.

## Core Rule

`project`와 `task`는 발급 시점의 목표를 기준으로 닫습니다.

- `Purpose`, `Scope`, `Out Of Scope`, `Completion Mode`, `Completion Criteria` 또는 `Exit Criteria`는 발급 시점의 계약입니다.
- 이후에 WBS를 더 잘게 쪼개거나 후속 문서를 발급해도, 기존 문서의 `done` 기준은 약해지지 않습니다.
- 원래 목표가 바뀌었다면 `done`이 아니라 `superseded` 또는 `cancelled`여야 합니다.

즉 "큰 목표를 작은 task로 나눴다"는 사실만으로 기존 항목을 완료 처리할 수 없습니다.

## Why Early Closure Happens

조기 종료는 보통 아래 실패 모드에서 발생합니다.

- 에이전트가 내부 WBS를 완료 계약 자체로 오해합니다.
- `done`이 검증 명령이 아니라 메타데이터 한 줄로 취급됩니다.
- `Purpose`, `Committed Outcome`, `Completion Criteria`가 자유 서술이라 문서 안에서 다시 확인되지 않습니다.
- 후속 `task`나 `project` 발급을 기존 문서 완료의 근거로 잘못 해석합니다.

이 문제를 막으려면 발급 시점 목표를 별도 목록으로 잠그고, 닫을 때 그 목록을 다시 검증하는 기계적 게이트가 필요합니다.

## Mode Selection Rule

기본 `Completion Mode`는 `functional`입니다.

- `Completion Mode`는 "무엇이 닫히면 끝인가"를 적는 terminal condition입니다.
- `Completion Mode`는 `docs/guide/goal-locked-completion.md`에 정의된 지원 mode 중 하나여야 합니다.
- 대부분의 `project`와 `task`는 `functional`이 맞습니다.
- 기본값이 아닌 mode를 쓰려면 왜 그 mode가 맞는지와 어떤 evidence가 필요한지를 문서에 적습니다.
- 종료 조건이 바뀌어 mode를 바꿔야 한다면 기존 문서는 `superseded` 또는 `cancelled`로 닫고 새 문서를 발급합니다.
- 이미 발급된 `functional` 문서를 뒤늦게 더 약한 mode로 바꿔 닫지 않습니다.

## Supported Completion Modes

### `functional`

- Use when: 하나의 기능 단위, 실행 경계, delivery boundary가 실제로 동작하는지가 종료 조건일 때
- Done when: 새로운 기능이나 실행 경계가 실제로 닫혀 반복 가능하게 관찰될 때
- Required evidence: 실행 결과, 샘플 입출력, 상태 변화, 로그, persistence, smoke 또는 acceptance 확인
- Not enough: 설계 문서, 코드 작성, 테스트 코드 추가만 된 상태

### `design-lock`

- Use when: 설계, 계약, 정책, 인터페이스 정의 자체가 이번 항목의 최종 deliverable일 때
- Done when: authoritative design 문서가 잠기고 후속 구현 경계가 함께 명시될 때
- Required evidence: 관련 design 링크, 잠긴 규칙 목록, 비범위, 후속 구현 task 또는 project
- Not enough: 초안 메모, 조사 노트, 미확정 옵션 나열

### `decision-lock`

- Use when: 여러 경쟁안 중 하나를 선택해 공식 기준으로 잠가야 할 때
- Done when: 선택 이유, 버린 대안, 적용 범위가 기록되고 이해관계자 기준이 정렬될 때
- Required evidence: decision 기록, 비교 근거, 채택안과 비채택안, 영향 범위
- Not enough: 의견 수렴 중간 상태, 개인 선호, 비교 없는 결론

### `investigation`

- Use when: 기능 구현보다 먼저 핵심 불확실성, 실패 원인, 현실 제약을 줄이는 것이 목적일 때
- Done when: 재현 가능한 사실, 배제된 가설, 남은 리스크, 다음 실행 경계가 분명해질 때
- Required evidence: 재현 절차, 관찰 로그, 샘플, 실패 유형 분류, follow-up 제안
- Not enough: 추측, 단순 아이디어 목록, 재현 불가능한 관찰

### `integration`

- Use when: 기존 시스템, 서비스, 모듈, boundary 사이의 연결 성립 자체가 목표일 때
- Done when: 인터페이스 handshake와 데이터 또는 제어 흐름 연결이 실제로 검증될 때
- Required evidence: 연결 로그, contract match, 샘플 request/response, end-to-end trace
- Not enough: adapter 코드만 작성, mock 기반 부분 검증만 수행

### `migration`

- Use when: 데이터, 트래픽, 운영 책임을 source에서 target으로 옮기는 것이 목표일 때
- Done when: cutover 또는 backfill이 끝나고 정합성, 잔여량, rollback 기준이 확인될 때
- Required evidence: reconciliation 결과, migration 로그, 대상 시스템 상태, 잔여 작업 목록
- Not enough: 마이그레이션 스크립트 준비, 일부 샘플만 이동, cutover 계획만 작성

### `operational-baseline`

- Use when: 기능 구현보다 운영 가능 상태 확보가 종료 조건일 때
- Done when: runbook, ownership, alert, 대응 기준, rollback 또는 fallback 경로가 실제로 유효할 때
- Required evidence: runbook 링크, alert 확인, 권한 또는 ownership 명시, 운영 drill 또는 검증 결과
- Not enough: 운영 문서 초안, 담당자 미정, alert 미검증 상태

### `remediation`

- Use when: 버그, 사고 원인, 보안/운영 위험을 제거하고 재발 방지까지 넣는 것이 목표일 때
- Done when: 문제 재현이 막히고, fix와 guardrail이 함께 들어가며, residual risk가 명시될 때
- Required evidence: before/after 재현 결과, 테스트 또는 검증 로그, 추가 guardrail, 남은 리스크 기록
- Not enough: 임시 우회, 증상만 가린 patch, 재발 방지 없는 수정

### `decommission`

- Use when: 기존 기능, 시스템, 운영 경로를 안전하게 제거하는 것이 목표일 때
- Done when: 트래픽과 의존성이 제거되고, 잔존 참조와 rollback 조건이 정리될 때
- Required evidence: usage 0 확인, dependency 제거, 제거 로그, 운영 영향 확인
- Not enough: 코드만 삭제, 사용 여부 미확인, 외부 참조 미정리 상태

## Unsupported Pseudo-Modes

아래는 completion mode가 아니라 work phase이므로 지원하지 않습니다.

- `implementation-only`
- `test-only`
- `documentation-only`
- `analysis-only`

이런 이름을 허용하면 다시 "일부 단계만 끝났으니 done"이라는 loophole가 열립니다.

## Mode Sanity Test

선택한 `Completion Mode`가 맞는지 아래 질문으로 점검합니다.

- `done`일 때 정확히 무엇이 닫히는가
- 누가 그 결과를 관찰하거나 사용할 수 있는가
- 어떤 evidence가 있어야 그 닫힘을 입증할 수 있는가
- 무엇만으로는 아직 `done`이 아닌가

답이 불분명하면 mode 선택이 잘못되었거나, 아직 `project`나 `task`를 발급할 시점이 아닐 수 있습니다.

## Goal Inventory Rule

모든 `task`와 `project`는 발급 시점 목표를 `Goal Inventory` 섹션에 별도 행으로 잠급니다.

- `Goal ID`는 `G1`, `G2`, `G3` 형식으로 씁니다.
- 각 행은 "이번 문서가 닫히려면 반드시 성립해야 하는 목표 하나"를 적습니다.
- `Goal ID`는 후속 분해나 WBS 변경이 생겨도 바꾸지 않습니다.
- WBS는 실행 계획이지만 `Goal Inventory`는 완료 계약입니다.

즉 WBS를 더 쪼개는 것은 허용되지만, `Goal Inventory`를 더 작게 바꿔서 완료 기준을 낮추면 안 됩니다.

## Goal Verification Rule

모든 `task`와 `project`는 `Goal Verification` 섹션에서 `Goal Inventory`의 각 `Goal ID`를 1:1로 다시 검증합니다.

- `Status`는 `Pending`, `In Progress`, `Done`, `Blocked`, `Cancelled`, `Superseded`, `N/A` 중 하나를 씁니다.
- `Evidence`에는 그 goal이 닫혔음을 입증하는 로그, 문서, 상태 변화, 링크를 적습니다.
- 문서가 `done`이면 모든 goal의 `Status`는 `Done`이어야 합니다.
- 문서가 `done`이면 모든 goal의 `Evidence`는 비어 있으면 안 됩니다.

이 표는 사람이 "대충 다 한 것 같다"고 느끼는 상태를 막고, 문서에 적힌 목표를 하나씩 다시 보게 만드는 강제 장치입니다.

## Mechanical Closeout Gate

`done` 전환은 아래 순서를 따라야 합니다.

1. `Goal Inventory`가 발급 시점 목표를 모두 포함하는지 확인합니다.
2. `Goal Verification`이 같은 `Goal ID`를 1:1로 가지고 있는지 확인합니다.
3. 각 goal의 `Evidence`를 채웁니다.
4. `./docs/bin/validate-closeout.sh <doc-path>`를 실행합니다.
5. Project/Task라면 통과 후 `./docs/bin/close-doc.sh <doc-path> "<note>"`로 닫습니다. Initiative는 canonical 문서·initiative register·exact terminal human decision receipt를 같은 변경 셋으로 갱신한 뒤 validator를 다시 실행하며, 현재 `close-doc.sh`는 Initiative 입력을 거부합니다.

이 과정을 우회해 메타데이터만 `done`으로 바꾸지 않습니다.

## Execution And Governance Barrier

`execution_contract: v1` task는 goal/evidence gate에 더해 아래를 만족해야 합니다.

- task lifecycle `status`와 별도인 `loop_state`가 `succeeded`입니다.
- current checkpoint의 task contract revision이 닫으려는 task revision과 일치합니다.
- pending attention, unresolved policy conflict, stale approval, expired exception이 없습니다.
- 각 required check가 immutable verification receipt 또는 source-backed evidence를 참조합니다.
- AI proposal report는 effective normative design과 human approval reference 없이 completion evidence가 될 수 없습니다.
- checkpoint의 `next_actor`, `next_action`, `resume_when`은 terminal 상태에 맞게 닫혔거나 residual handoff로 명시됩니다.

checkpoint 자체는 mutable current snapshot이므로 `Goal Verification`에는 긴 로그를 복사하지 않고 terminal verification receipt를 참조합니다. `Status`에는 closeout milestone과 결정의 append-only history를 남깁니다.

## CI And Hook Enforcement

문서 원칙만으로는 약합니다. 진짜 강제는 검증 명령을 자동으로 돌릴 때 생깁니다.

- 로컬에서는 `./docs/bin/close-doc.sh`가 Project/Task를 닫기 전 검증을 먼저 수행합니다. Initiative는 coordinated document/register/receipt workflow가 구현될 때까지 자동 종료하지 않습니다.
- 저장소에서는 `./docs/bin/validate-closeout.sh --all`을 CI나 pre-push hook에 연결합니다.
- 특정 CI provider의 workflow가 기본 포함되어 있다고 가정하지 않습니다. repository owner가 사용하는 CI 또는 pre-push gate에 검증 명령을 명시적으로 연결합니다.

## Splitting Rules

분할은 실행 통제를 위한 것이지 완료 기준 축소를 위한 것이 아닙니다.

- 하나의 기능 단위가 여전히 같은 문서에서 닫힌다면 새 문서를 만들기보다 내부 WBS를 더 세밀하게 쪼갭니다.
- 별도의 기능 경계, 별도 gate, 별도 ownership이 생겼다면 새 `task`나 `project`를 발급할 수 있습니다.
- 후속 문서를 발급했더라도 현재 문서의 핵심 목표가 남아 있다면 현재 문서는 계속 `active` 또는 `blocked`입니다.
- 기존 문서가 잘못 발급되어 경계를 다시 잡아야 한다면 기존 문서는 `superseded`로 닫고, 대체 문서를 명시합니다.

분할이나 재발급은 WBS 정리 수단이지 mode downgrade 수단이 아닙니다.

## Done Checklist

`done`으로 바꾸기 전에 아래를 확인합니다.

- 발급 시점의 Purpose가 그대로 달성되었는가
- 필수 Scope가 실제로 닫혔는가
- `Related Control Plane`, `Whole-System Anchor`, `Outputs / Handoff`, `Quality Axes In Scope`가 채워져 있는가
- `Goal Inventory`의 각 goal이 `Goal Verification`에서 다시 확인되었는가
- 선택한 `Completion Mode`가 요구하는 evidence가 있는가
- 남은 핵심 목표를 후속 문서로 넘긴 뒤 현재 문서를 `done`으로 위장하지 않았는가
- mode가 `functional`이 아니라면 authoritative artifact 또는 closed state가 명시되어 있는가
- loop-enabled task라면 `loop_state: succeeded`, terminal receipt, unresolved attention 없음이 확인되는가
- 적용 policy/standard/exception이 exact version으로 연결되고 approval/effective 상태가 유효한가

하나라도 아니면 `done`이 아닙니다.

## Status Decision Rule

- `done`: 발급 시점의 목표가 선언된 `Completion Mode` 기준으로 달성되었을 때
- `active` 또는 `blocked`: 목표는 그대로지만 아직 달성되지 않았을 때
- `superseded`: 목표나 경계가 새 문서로 재발급되어 기존 문서가 더 이상 기준이 아닐 때
- `cancelled`: 목표를 달성하지 않은 채 의도적으로 중단했을 때

## Change Log

- 2026-04-14: goal lock, goal inventory / verification gate, unsupported pseudo-mode, `done` 체크리스트 규칙 추가.
- 2026-07-15: loop-enabled task의 checkpoint, attention, receipt, governance closeout barrier 추가.
