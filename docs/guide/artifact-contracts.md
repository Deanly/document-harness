# artifact-contracts

- Type: guide
- Created: 2026-04-14
- Updated: 2026-05-09

## Purpose

이 문서는 `design`, `project`, `task`, `guide`, `report`가 각각 어떤 truth를 담고, 어떤 문서를 읽고, 어떤 문서로 handoff하는지 계약 형태로 고정합니다.

문서 품질이 흔들리는 가장 흔한 이유는 타입 경계가 약해서 같은 정보가 여러 surface에 중복되거나, 반대로 어디에도 authoritative truth가 없기 때문입니다.

## Control Surfaces

### Whole-System Control

- `AGENTS.md`: Codex가 repo 작업 전에 읽는 짧은 agent instruction surface
- `docs/design/control-plane.md`: 전체 목표, pipeline, validator, active surface
- `docs/design/ubiquitous-language.md`: canonical term
- 핵심 `design`: boundary, invariant, interface, failure boundary

### Focused Execution

- `project`: 큰 delivery boundary, 분해 전략, handoff map
- `task`: 실제로 닫는 execution slice, goal inventory, evidence

### Drift Control

- `Goal Inventory`
- `Goal Verification`
- `Quality Axes In Scope`
- YAML frontmatter properties
- `source_refs`
- closeout validator와 foundation validator

### Source Layer

- raw source: 원문, clipping, transcript, dataset, image, PDF
- source summary: raw source를 읽고 만든 시점성 `report` 또는 관련 문서의 `Inputs`
- source-backed synthesis: source를 근거로 갱신된 `design`, `guide`, `project`, `task`

### Agent Control

- root `AGENTS.md`: Codex가 즉시 읽는 repo-level instruction
- `docs/_templates/agents.md`: downstream project에 복사할 reusable instruction template
- `docs/guide/codex-agent-guidance.md`: AGENTS.md 작성과 Codex prompt/verification 규칙
- `docs/bin/validate-codex-readiness.sh`: agent-facing surface validator

## Artifact Contracts By Type

### `design`

- Holds: 현재 truth, 경계, 계약, invariant, failure boundary
- Reads: control-plane, ubiquitous-language, 관련 상위 요구, source-backed synthesis
- Feeds: project, task, guide
- Must not hold: 긴 실행 이력, 임시 작업 메모

### `project`

- Holds: bounded delivery 목표, 범위, task map, whole-system anchor, handoff 방향
- Reads: control-plane, design, quality axes
- Feeds: task, report, 예외 branch project
- Must not hold: 미확정 브레인스토밍, 설계 truth의 원본

### `task`

- Holds: execution slice, goal inventory, goal verification, evidence, outputs / handoff
- Reads: project, design, control-plane, quality axes
- Feeds: 다음 task, downstream system, project closeout
- Must not hold: 전체 시스템 전략의 원본 정의

### `guide`

- Holds: 반복 판단, 운영 규칙, checklists, Q&A
- Reads: design, project, task, report
- Feeds: future task/project/operator
- Must not hold: current truth의 유일한 원본

### `report`

- Holds: 시점성 조사, 요청 응답, 일회성 정리
- Reads: 현재 active surface 전반, raw source, source summary
- Feeds: 필요 시 guide/design/project/task로 승격
- Must not hold: 장기 authoritative truth

### `raw source`

- Holds: 원문 파일 또는 외부 source의 보존 사본
- Reads: 없음
- Feeds: report, design, guide, project, task
- Must not hold: LLM이 덧붙인 해석, 현재 truth, 실행 상태

### `AGENTS.md`

- Holds: Codex가 작업 전에 알아야 하는 repo layout, workflow, documentation rules, verification commands, done criteria
- Reads: docs/README, control-plane, Codex guidance, active project/task/design surfaces
- Feeds: Codex local/cloud/IDE sessions
- Must not hold: 전체 문서 schema의 복제본, 긴 배경 설명, 시점성 상태 보고

## Handoff Matrix

| From | To | What Moves |
| --- | --- | --- |
| `design` | `project` | boundary, invariant, interface, out-of-scope 기준 |
| `project` | `task` | focused slice, local goal, execution order, quality axes |
| `task` | `task` | outputs / handoff, residual risk, operator note |
| `task` | `project` | closeout evidence, remaining scope, supersede/cancel reason |
| `report` | `guide/design/project/task` | reusable rule, truth, execution boundary |
| `design` | `qa` | 불변식, 위험, 시나리오 — qa 케이스의 유일한 파생 근거 |
| `task` | `qa` | closeout 시 케이스 증거 갱신, 결함에서 파생된 신규 케이스 |
| `qa` | `task` | 방어 갭 백로그 항목 — 신규 방어 테스트 작업의 유일한 출처 |
| `raw source` | `report/design/guide/project/task` | source_refs, extracted facts, contradiction notes |
| `AGENTS.md` | `Codex session` | repo map, workflow, constraints, verification commands |

## Authoring Rule

새 문서를 발급할 때는 아래를 먼저 확인합니다.

1. 이 정보의 authoritative truth는 어느 surface에 있어야 하는가
2. 이 문서는 무엇을 읽고 무엇을 넘기는가
3. handoff를 다음 문서가 다시 읽을 수 있게 충분히 구조화했는가
4. source 기반 주장이라면 `source_refs`와 본문 근거가 충분한가
5. frontmatter properties와 첫 화면 metadata가 같은 상태를 말하는가

답이 모호하면 artifact contract가 약한 상태입니다.

## Change Log

- 2026-04-14: whole-system / focused execution / drift control artifact contract 규칙 추가.
- 2026-05-09: raw source layer, source_refs, markdown properties contract 추가.
- 2026-05-09: AGENTS.md artifact contract와 Codex readiness surface 추가.
