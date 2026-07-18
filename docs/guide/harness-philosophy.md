# harness-philosophy

- Type: guide
- Created: 2026-04-10
- Updated: 2026-07-18
- Source: reference docs lineage

## Purpose

이 문서는 참조 문서군을 분석해, 왜 그 문서들이 강한지와 무엇을 다른 프로젝트에서도 그대로 가져가야 하는지를 정리합니다.

핵심 결론은 아래 한 줄입니다.

문서는 "설계를 고정하는 면", "실행을 통제하는 면", "운영 현실을 설명하는 면", "시점성 보고 면"을 분리해야 강해집니다.

## What Makes The Source Docs Strong

원본 문서군은 단순히 정리가 잘 된 것이 아니라, 각 문서 타입의 책임이 명확합니다.

- `design`은 현재 기준의 truth를 고정합니다.
- `initiative`는 정책과 지침을 portfolio outcome으로 연결합니다.
- `project`는 큰 delivery boundary와 task 맵을 고정합니다.
- `task`는 실제 실행 단위를 닫을 수 있게 만듭니다.
- `guide`는 반복 질문과 운영 판단을 재사용 가능한 규칙으로 압축합니다.
- `report`는 요청 기반 결과물을 임시로 수용합니다.

이 분리 덕분에 설계 변경, 실행 상태, 운영 증적이 서로 섞이지 않습니다.

## Core Principles

### 1. Boundary First

좋은 문서는 구현 세부보다 먼저 경계와 책임을 고정합니다.

- 무엇을 직접 담당하는가
- 무엇을 담당하지 않는가
- 어떤 후속 시스템으로 넘기는가

이 원칙이 있어야 문서가 backlog가 아니라 architecture surface가 됩니다.

### 2. Current Truth And History Must Be Separated

- `design`은 현재 truth가 우선입니다.
- `initiative`, `task`, `project`는 append-only 상태 이력이 우선입니다.

이 둘을 섞으면 설계도 읽기 어려워지고 이력도 신뢰하기 어렵습니다.

### 3. Issued Goals Must Stay Locked

한 번 발급한 `initiative`, `project`, `task`의 outcome/purpose, scope, completion criteria는 종료 기준 계약입니다.

- WBS를 더 잘게 나눌 수는 있습니다.
- 후속 `task`나 `project`를 발급할 수는 있습니다.
- 그렇다고 기존 항목의 완료 기준이 작아지지는 않습니다.

남은 핵심 목표를 다른 문서로 옮겼다면 현재 문서는 `done`이 아니라 `active`, `blocked`, `superseded`, `cancelled` 중 하나여야 합니다.

### 4. Completion Modes Must Describe The End State

좋은 `Completion Mode`는 "무엇이 닫히면 끝인가"를 설명해야 합니다.

- `functional`, `integration`, `migration`, `operational-baseline` 같은 이름은 종료 상태를 설명합니다.
- `implementation-only`, `test-only`, `documentation-only` 같은 이름은 작업 phase를 설명할 뿐입니다.
- phase 이름을 mode로 허용하면 다시 "조금 했으니 done" loophole가 열립니다.

즉 mode는 진행 단계가 아니라 terminal condition이어야 합니다.

### 5. Whole-System Control Needs A Canonical Surface

규모가 커질수록 전체를 붙잡는 문서가 여러 개로 찢어지면 빠르게 흐려집니다.

- `control-plane`은 전체 목표, pipeline, validator, active surface를 한 곳에 묶습니다.
- 개별 `design`은 각 boundary의 truth를 붙잡습니다.
- `initiative`, `project`, `task`는 이 whole-system surface를 anchor로 읽어야 합니다.

즉 설계 문서는 여러 개일 수 있어도, 전체 정렬면은 하나가 필요합니다.

### 6. Strategy, Delivery, Execution Need Separate Owners

bounded를 잘 자르는 것만으로는 충분하지 않습니다. 정책 방향, 여러 project의 portfolio outcome, 개별 delivery, 실행 slice가 같은 surface에 섞이면 사람이 전체 방향을 읽기 어렵습니다.

- `initiative`는 policy/guideline에서 파생된 strategy와 portfolio outcome을 소유합니다.
- `project`는 그 outcome에 기여하는 bounded delivery를 소유합니다.
- `task`는 project가 닫을 executable slice를 소유합니다.
- project source가 `related_initiative`를 소유하고 View/index가 reverse-index해 여러 delivery를 한 추진안 아래 보여줍니다.
- 기존 umbrella project는 compatibility bridge로 유지하지만 새 authoring 기본값으로 사용하지 않습니다.

즉 좋은 bounded slicing은 "작게 나눈다"가 아니라 "strategy, delivery, execution의 owner를 분리하면서 lineage는 끊지 않는다"에 가깝습니다.

### 7. Scope Is Stronger When Out Of Scope Is Explicit

원본 문서들은 범위만 적지 않습니다. 항상 제외 범위를 적어 문서의 의도를 선명하게 만듭니다.

이 습관은 과잉 일반화와 요구사항 확장을 막습니다.

### 8. Terms Must Be Canonical

원본 문서군은 `ubiquitous-language`를 별도 design surface로 둡니다.

의미:

- 같은 대상을 같은 이름으로 부른다.
- 새로운 경계나 상태가 생기면 design과 같은 변경 셋에서 용어를 갱신한다.
- guide와 task도 이 용어를 우선 사용한다.

### 9. Evidence Beats Vague Progress

강한 상태 이력은 "작업 중", "완료 예정" 같은 표현이 아니라 아래를 씁니다.

- 어떤 기준이 고정되었는가
- 어떤 샘플, 로그, 빌드, 실행 결과로 확인했는가
- 남은 불확실성은 무엇인가

즉 진행률은 감정이 아니라 증빙과 연결됩니다.

### 10. Delivery Should Be Gate-Driven

원본 문서들은 순서가 중요한 작업에서 gate를 명시합니다.

예:

- live bridge가 있어야 field validation이 의미가 있다
- field reality가 잠겨야 parser alignment가 의미가 있다
- local cycle이 증명되어야 운영 baseline을 확정할 수 있다

이 구조는 병렬화 가능한 일과 그렇지 않은 일을 구분하게 만듭니다.

### 11. v1 Scope Should Be Intentionally Narrow

원본 문서군은 v1에서 하지 않을 일을 적극적으로 적습니다.

좋은 이유:

- 지금 당장 필요한 truth만 잠글 수 있습니다.
- 후속 경계가 생겨도 먼저 현재 project 아래 `task`로 수용하고, 별도 delivery boundary일 때만 새 `project`로 분리할 수 있습니다.
- 문서가 미래 희망사항을 현재 책임처럼 말하지 않게 됩니다.

### 12. Quality Axes Make Review Repeatable

강한 하네스는 review 언어도 고정합니다.

- `quality axes`는 무엇을 좋다고 볼지 반복 가능한 언어로 만듭니다.
- 부분 작업은 모든 축을 다 책임지지 않더라도, 자신이 책임지는 축은 명시해야 합니다.
- closeout evidence도 축 기준으로 모을 수 있어야 합니다.

### 13. Guide Documents Carry Operational Judgment

가이드는 설계의 중복본이 아닙니다.

가이드의 역할:

- 왜 이 실행 순서가 맞는가
- 왜 아직 새 project를 발급하지 않는가
- 왜 one-shot worker가 맞는가
- 운영 권한과 환경 전제는 무엇인가

즉 설계 문서의 계약과 별도로, 현실에서 흔들릴 판단을 고정합니다.

## Writing Patterns Worth Reusing

- 첫 단락에서 목적을 곧바로 말합니다.
- Scope와 Out Of Scope를 모두 씁니다.
- References를 통해 문서를 고립시키지 않습니다.
- whole-system anchor와 handoff를 적어 부분 문서를 control-plane과 연결합니다.
- WBS는 현재 상태를 반영하지만, Status는 append-only로 남깁니다.
- Completion Criteria와 Exit Criteria를 써서 "끝"의 정의를 고정합니다.
- design에는 Invariants, Interfaces, Decisions를 넣어 구현 기준을 명확히 합니다.
- guide에는 Decision, Rule, Checklist, Q&A를 넣어 반복 질문을 흡수합니다.

## Anti-Patterns To Avoid

- 설계 문서 안에 긴 작업 이력을 섞지 않습니다.
- project 문서를 브레인스토밍 메모로 쓰지 않습니다.
- task 없는 project WBS를 오래 방치하지 않습니다.
- 완료 판단을 증빙 없이 선언하지 않습니다.
- completion mode 자리에 work phase 이름을 넣지 않습니다.
- whole-system anchor 없는 task/project를 local memo처럼 닫지 않습니다.
- 발급 시점의 목표를 더 작은 하위 조각으로 줄여 `done` 처리하지 않습니다.
- 아직 잠기지 않은 후속 시스템을 현재 프로젝트 범위로 끌어오지 않습니다.
- task로 담길 수 있는 작은 분화를 새 `project`로 올려 initiative lineage를 불필요하게 확장하지 않습니다.
- 같은 대상을 문서마다 다른 이름으로 부르지 않습니다.

## Adoption Rule

이 하네스를 새 프로젝트에 복사한 뒤에는 아래를 가장 먼저 합니다.

1. `docs/design/control-plane.md`와 `docs/design/ubiquitous-language.md`를 실제 기준으로 채웁니다.
2. 정책과 지침을 정돈하고 사람의 exact approval 뒤 첫 `I####` 추진안의 outcome, 범위, 성공 신호를 고정합니다.
3. 첫 bounded `project`를 initiative에 연결하고 목적, 범위, 비범위, whole-system anchor를 고정합니다.
4. 설계 기준이 생기면 `design` 문서를 만들고 같은 변경 셋에서 control-plane과 용어 문서를 갱신합니다.
5. 실제 작업은 현재 project 아래의 `task`로 쪼개고, project WBS와 1:1 대응시킵니다. 대부분의 경우 기본값은 `functional`입니다.
6. 새 `project`가 필요하다면 왜 task가 안 되는지와 왜 별도 delivery boundary가 필요한지를 먼저 남깁니다.
7. 자주 흔들리는 판단이 생기면 `guide`로 승격합니다.

## Change Log

- 2026-04-10: 참조 문서군 분석을 바탕으로 재사용 가능한 문서 철학 정리.
- 2026-04-13: goal lock, completion mode catalog, terminal-condition 원칙 반영.
- 2026-04-14: control-plane, whole-system anchor, quality axes 원칙 반영.
- 2026-04-16: umbrella-first lineage와 task-first issuance 원칙 반영.
- 2026-07-18: umbrella project가 겸하던 strategy owner를 별도 추진안으로 분리하고 initiative→project→task lineage와 legacy bridge를 반영.
