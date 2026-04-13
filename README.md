# document-harness

실전에서 검증된 문서 체계를 다른 프로젝트에서도 재사용할 수 있게 일반화한 하네스입니다.

이 하네스의 목표는 문서를 "설계 기준", "실행 단위", "운영 판단", "요청성 보고"로 분리하고, 각 문서가 서로를 참조하면서 프로젝트의 현재 truth와 실행 이력을 함께 유지하게 만드는 것입니다.

특히 `project`와 `task`는 발급 시점의 목표를 잠그고, 기능 단위가 실제로 닫히기 전에는 더 작은 하위 조각만 끝냈다는 이유로 `done` 처리하지 않는 것을 기본 원칙으로 둡니다.

핵심 진입점은 아래와 같습니다.

- `docs/README.md`: 문서 체계, 발급 규칙, 업데이트 규칙
- `docs/guide/harness-philosophy.md`: 원본 문서군에서 추출한 문서 철학
- `docs/guide/project-cutting-and-execution.md`: 프로젝트 분할과 실행 게이트 규칙
- `docs/guide/goal-locked-completion.md`: goal lock, completion mode catalog, required evidence 규칙
- `docs/design/ubiquitous-language.md`: 새 프로젝트에서 바로 채울 수 있는 용어 기준 문서
- `docs/examples/`: placeholder 대신 참고할 수 있는 완성형 예시 문서
- `docs/_templates/`: `task`, `project`, `design`, `guide`, `report` 템플릿
- `docs/bin/new-doc.sh`: 번호 발급 및 문서 생성 스크립트

## Quick Start

```bash
./docs/bin/new-doc.sh project example-project
./docs/bin/new-doc.sh task first-task
./docs/bin/new-doc.sh design core-boundary
```

한글 slug도 허용됩니다. 예: `./docs/bin/new-doc.sh task "첫 작업"`.

복사 후에는 `docs/design/ubiquitous-language.md`를 먼저 실제 프로젝트 용어로 채우고, `docs/examples/`의 샘플 문서를 한 번 읽는 것을 권장합니다.

새 프로젝트로 복사한 뒤에는 아래 순서를 권장합니다.

1. `docs/design/ubiquitous-language.md`의 placeholder를 실제 프로젝트 용어로 교체합니다.
2. 첫 `project` 문서를 발급합니다.
3. 설계 기준이 필요하면 `design` 문서를 만들고 `ubiquitous-language`를 같은 변경 셋에서 갱신합니다.
4. 실제 실행 단위가 생기면 `task` 문서를 발급합니다.
5. `project`와 `task`는 지원되는 `Completion Mode` 중 하나를 선택하고, 대부분의 경우 기본값인 `functional`을 유지합니다.

## License

MIT. 자세한 내용은 `LICENSE`를 봅니다.
