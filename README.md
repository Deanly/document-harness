# document-harness

실전에서 검증된 문서 체계를 다른 프로젝트에서도 재사용할 수 있게 일반화한 하네스입니다.

이 하네스의 목표는 문서를 "설계 기준", "실행 단위", "운영 판단", "요청성 보고"로 분리하고, 각 문서가 서로를 참조하면서 프로젝트의 현재 truth와 실행 이력을 함께 유지하게 만드는 것입니다.

핵심 진입점은 아래와 같습니다.

- `docs/README.md`: 문서 체계, 발급 규칙, 업데이트 규칙
- `docs/guide/harness-philosophy.md`: 원본 문서군에서 추출한 문서 철학
- `docs/guide/project-cutting-and-execution.md`: 프로젝트 분할과 실행 게이트 규칙
- `docs/design/ubiquitous-language.md`: 새 프로젝트에서 바로 채울 수 있는 용어 기준 문서
- `docs/_templates/`: `task`, `project`, `design`, `guide`, `report` 템플릿
- `docs/bin/new-doc.sh`: 번호 발급 및 문서 생성 스크립트

새 프로젝트로 복사한 뒤에는 아래 순서를 권장합니다.

1. `docs/design/ubiquitous-language.md`의 placeholder를 실제 프로젝트 용어로 교체합니다.
2. 첫 `project` 문서를 발급합니다.
3. 설계 기준이 필요하면 `design` 문서를 만들고 `ubiquitous-language`를 같은 변경 셋에서 갱신합니다.
4. 실제 실행 단위가 생기면 `task` 문서를 발급합니다.
