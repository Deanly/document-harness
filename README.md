# document-harness

실전에서 검증된 문서 체계를 다른 프로젝트에서도 재사용할 수 있게 일반화한 하네스입니다.

이 하네스의 목표는 문서를 "설계 기준", "실행 단위", "운영 판단", "요청성 보고"로 분리하고, 각 문서가 서로를 참조하면서 프로젝트의 현재 truth와 실행 이력을 함께 유지하게 만드는 것입니다.

특히 `project`와 `task`는 발급 시점의 목표를 잠그고, 기능 단위가 실제로 닫히기 전에는 더 작은 하위 조각만 끝냈다는 이유로 `done` 처리하지 않는 것을 기본 원칙으로 둡니다.

이 하네스에서 `design`은 전체를 놓치지 않게 만드는 control surface이고, `project`와 `task`는 부분에 집중하게 만드는 focus surface이며, closeout gate와 validator는 작업 중 목표 이탈을 막는 drift-control surface입니다.

핵심 진입점은 아래와 같습니다.

- `docs/README.md`: 문서 체계, 발급 규칙, 업데이트 규칙
- `docs/guide/harness-philosophy.md`: 원본 문서군에서 추출한 문서 철학
- `docs/guide/project-cutting-and-execution.md`: 프로젝트 분할과 실행 게이트 규칙
- `docs/guide/goal-locked-completion.md`: goal lock, completion mode catalog, required evidence 규칙
- `docs/design/control-plane.md`: 전체 시스템 목표, pipeline, validator, quality axes를 고정하는 central control surface
- `docs/guide/artifact-contracts.md`: design / project / task / guide / report 간 책임과 handoff 계약
- `docs/guide/quality-axes.md`: project/task closeout과 review에 쓰는 품질 축
- `docs/design/ubiquitous-language.md`: 새 프로젝트에서 바로 채울 수 있는 용어 기준 문서
- `docs/examples/`: placeholder 대신 참고할 수 있는 완성형 예시 문서
- `docs/_templates/`: `task`, `project`, `design`, `guide`, `report` 템플릿
- `docs/bin/new-doc.sh`: 번호 발급 및 문서 생성 스크립트
- `docs/bin/validate-harness-foundation.sh`: control-plane, quality axes, artifact contract 기본 구조를 검증하는 스크립트
- `docs/bin/validate-closeout.sh`: `done` 전환 전 목표 달성 여부를 검증하는 스크립트
- `docs/bin/close-doc.sh`: 검증을 통과한 문서만 `done`으로 닫는 스크립트

## Quick Start

```bash
./docs/bin/new-doc.sh project example-project
./docs/bin/new-doc.sh task first-task
./docs/bin/new-doc.sh design core-boundary
./docs/bin/validate-harness-foundation.sh
./docs/bin/validate-closeout.sh --all
```

한글 slug도 허용됩니다. 예: `./docs/bin/new-doc.sh task "첫 작업"`.

복사 후에는 `docs/design/ubiquitous-language.md`를 먼저 실제 프로젝트 용어로 채우고, `docs/examples/`의 샘플 문서를 한 번 읽는 것을 권장합니다.

새 프로젝트로 복사한 뒤에는 아래 순서를 권장합니다.

1. `docs/design/control-plane.md`와 `docs/design/ubiquitous-language.md`의 placeholder를 실제 프로젝트 기준으로 교체합니다.
2. 첫 `project` 문서를 발급합니다.
3. 설계 기준이 필요하면 `design` 문서를 만들고 `control-plane`, `ubiquitous-language`를 같은 변경 셋에서 갱신합니다.
4. 실제 실행 단위가 생기면 `task` 문서를 발급합니다.
5. `project`와 `task`는 지원되는 `Completion Mode` 중 하나를 선택하고, whole-system anchor와 quality axes를 명시합니다. 대부분의 경우 기본값인 `functional`을 유지합니다.
6. `./docs/bin/validate-harness-foundation.sh`로 기본 control surface가 잠겨 있는지 확인합니다.
7. `done` 전환 전에는 `./docs/bin/validate-closeout.sh`를 통과시키고, 가능하면 `./docs/bin/close-doc.sh`로 닫습니다.

## Closeout Gate

이 하네스는 `done`을 자유 서술 메타데이터가 아니라 문서 내부 목표와 증빙을 통과한 결과로 다루는 것을 권장합니다.

```bash
./docs/bin/validate-harness-foundation.sh
./docs/bin/validate-closeout.sh --all
./docs/bin/close-doc.sh docs/tasks/T0001-first-task.md "issued goals and evidence verified"
```

GitHub를 쓰는 경우에는 저장소에 포함된 workflow로 이 검증을 PR과 push에서 다시 확인할 수 있습니다.

## License

MIT. 자세한 내용은 `LICENSE`를 봅니다.
