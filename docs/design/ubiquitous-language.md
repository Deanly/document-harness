# ubiquitous-language

- Type: design
- Domain: ubiquitous-language
- Owner:
- Created: 2026-04-10
- Updated: 2026-04-10
- Referenced By:
  - `docs/README.md`

## Purpose

이 문서는 현재 프로젝트에서 같은 대상을 같은 말로 부르기 위한 canonical term 기준입니다.

새로운 `design` 문서가 추가되거나 기존 설계에서 핵심 개념, 상태, 경계가 바뀌면 같은 변경 셋에서 이 문서도 함께 갱신합니다.

placeholder 대신 채워진 예시가 필요하면 `docs/examples/README.md`를 먼저 봅니다.

## Maintenance Rule

- 새로운 design 문서가 추가될 때:
  - 새로운 핵심 명사, 상태, 책임, 경계가 생기면 이 문서에 추가합니다.
- 기존 design 문서가 변경될 때:
  - 용어의 의미나 범위가 바뀌면 이 문서를 함께 수정합니다.
- `task`, `project`, `guide`는 이 문서의 용어를 우선 사용합니다.
- 같은 대상을 가리키는 표현이 여러 개 생기면 canonical term 하나를 고정합니다.

## Core Boundary Terms

### `project-system-name`

이 프로젝트의 가장 바깥 시스템 이름을 적습니다.

예:

- 수집기
- API
- 배치 파이프라인

### `ingress`

외부 입력이 이 프로젝트 안으로 들어오는 입구를 뜻합니다.

### `core processing`

이 프로젝트가 직접 책임지는 핵심 처리 단계를 뜻합니다.

### `downstream`

이 프로젝트 이후에 결과를 받는 시스템을 뜻합니다.

## Runtime Terms

### `worker`

프로세스가 어떤 실행 모델로 동작하는지 적습니다.

예:

- one-shot worker
- long-running server
- scheduled batch

### `checkpoint`

다음 실행이나 다음 단계가 이전 상태를 이어받기 위해 저장하는 최소 진행 상태를 뜻합니다.

### `operator prerequisite`

운영 환경에서 사람이 먼저 준비해야 하는 전제를 뜻합니다.

예:

- 권한
- 인증 정보
- 외부 서비스 접근

## Domain Terms

### `source record`

원문 기준으로 보존되는 가장 초기 데이터 단위를 적습니다.

### `normalized record`

정규화 규칙이 적용된 내부 canonical data를 적습니다.

### `result event`

downstream에 전달하거나 이후 단계가 소비하는 구조화 결과를 적습니다.

### `failure record`

실패를 버리지 않고 보존할 때 쓰는 canonical term을 적습니다.

## Out-Of-Scope Terms

### `future subsystem`

후속 프로젝트나 별도 경계로 넘길 시스템을 적습니다.

### `final truth`

현재 프로젝트가 직접 확정하지 않는 최종 진실값이 있다면 그 term을 적습니다.

## Change Log

- 2026-04-10: 하네스 starter 문서 생성.
