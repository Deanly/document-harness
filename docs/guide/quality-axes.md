# quality-axes

- Type: guide
- Created: 2026-04-14
- Updated: 2026-04-14

## Purpose

이 문서는 `project`와 `task`가 closeout과 review에서 같은 언어를 쓰도록 품질 축을 고정합니다.

품질 축이 없으면 review가 사람 감각에 의존하고, 규모가 커질수록 "무엇이 좋아야 하는가"가 흔들립니다. 이 문서는 전체를 놓치지 않으면서도 부분 작업이 무엇을 직접 책임지는지 명확하게 만듭니다.

## How To Use

- 새 `project`와 `task`는 `Quality Axes In Scope` 섹션에서 관련 축만 선택합니다.
- 모든 축을 한 문서가 다 책임질 필요는 없습니다.
- 그러나 whole-system anchor와 충돌하는 축을 무시하면 안 됩니다.
- closeout 시에는 선택한 축마다 필요한 evidence를 남깁니다.

## Axes

### `WHOLE`

- Meaning: 부분 작업이 전체 시스템 목표와 상충하지 않는가
- Ask: 이 작업이 전체 목적, 설계, control-plane을 깨지 않는가
- Typical evidence: whole-system anchor, 관련 design 링크, 전체 영향 메모

### `SCOPE`

- Meaning: 포함 범위와 제외 범위가 흐려지지 않았는가
- Ask: 이번 문서가 닫는 범위가 과장되거나 축소되지 않았는가
- Typical evidence: scope / out-of-scope, supersede/cancel reason, residual scope

### `GOAL`

- Meaning: 발급 시점 goal이 끝까지 유지되는가
- Ask: Goal Inventory를 더 작은 하위 조각으로 축소하지 않았는가
- Typical evidence: goal verification, closeout note, validator pass

### `CONTRACT`

- Meaning: interface, invariant, schema, policy가 설계와 일치하는가
- Ask: design contract와 실제 구현/운영 경계가 맞는가
- Typical evidence: design reference, interface examples, schema or contract evidence

### `EVIDENCE`

- Meaning: 완료 판단이 실제 관찰과 연결되는가
- Ask: 로그, 실행 결과, 상태 변화 없이 `done`을 선언하지 않았는가
- Typical evidence: logs, test/smoke output, persistence result, screenshots or links

### `HANDOFF`

- Meaning: 다음 task, project, downstream이 읽을 수 있는 handoff가 남는가
- Ask: outputs / handoff가 구조화되어 다음 surface로 넘어가는가
- Typical evidence: output paths, residual risk, next consumer, operator note

### `OPERABILITY`

- Meaning: 운영자나 다음 실행자가 실제로 다룰 수 있는 상태인가
- Ask: runbook, prerequisite, fallback, ownership이 필요한 만큼 적혀 있는가
- Typical evidence: guide, operator prerequisite, ownership, smoke or drill

### `CHANGE`

- Meaning: 설계 변경과 재작업 영향이 통제되는가
- Ask: 설계 변경 시 같이 갱신해야 하는 문서와 영향 범위를 추적했는가
- Typical evidence: changed references, superseded docs, rewrite or follow-up list

## Minimum Review Set

대부분의 `task`와 `project`는 최소 아래 축을 검토합니다.

- `WHOLE`
- `SCOPE`
- `GOAL`
- `EVIDENCE`
- `HANDOFF`

도메인 특성에 따라 `CONTRACT`, `OPERABILITY`, `CHANGE`를 추가합니다.

## Change Log

- 2026-04-14: quality axis 체계와 사용 규칙 추가.
