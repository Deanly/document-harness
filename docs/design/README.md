# Design Retrieval Index

이 파일은 `docs/design/` 문서를 LLM/Codex가 통째로 읽지 않고 작업 성격에 맞게 선택하도록 돕는 retrieval index입니다.

## Rules

- `docs/design/control-plane.md`는 whole-system orientation용 `core-start` 문서입니다.
- `docs/design/ubiquitous-language.md`는 canonical term registry이지만 기본 전체 로딩 대상이 아닙니다. 용어 판단이 필요한 section만 읽는 section-load 문서입니다.
- `docs/design/retrieval-plane.md`는 corpus 규모와 freshness 병목이 있을 때 선택하는 retrieval domain current truth입니다.
- `docs/design/policy-to-evidence-governance.md`는 human policy, AI proposal, approval, exception, rule-to-evidence 권한을 바꿀 때 선택합니다.
- `docs/design/execution-loop-plane.md`는 task checkpoint, attention, stop/resume, evidence barrier를 바꿀 때 선택합니다.
- `docs/design/human-control-view-plane.md`는 projector, snapshot API/SSE, freshness, read-only security/runtime을 바꿀 때 선택합니다.
- `docs/design/harness-adoption-plane.md`는 기존 repository의 ownership-aware migration, repository-local skill, policy extraction, repo-local View와 quality handoff를 설계할 때 선택합니다.
- 새 domain design 문서를 추가하면 이 index와 `docs/_indexes/design-map.md`도 함께 갱신합니다.
- 이 index는 design truth를 대체하지 않습니다. 실제 결정은 source design doc에서 합니다.

## Size Tiers

- `small`: 2,000 words 미만
- `medium`: 2,000 words 이상 5,000 words 미만
- `large`: 5,000 words 이상

## Retrieval Classes

| Retrieval Class | Meaning |
| --- | --- |
| `core-start` | 거의 모든 docs/runtime orientation에서 짧게 읽는 whole-system entry |
| `term-excerpt` | full document가 아니라 관련 heading/term section만 읽는 vocabulary source |
| `domain-current` | 특정 bounded context current truth |
| `context-map` | bounded context ownership과 shared seam을 고를 때 읽는 map |

## Design Index

| Design Doc | Design Kind | Retrieval Class | Read When | Do Not Read When | Size Tier | Related Domain | Related Project/Task |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [`control-plane.md`](control-plane.md) | control | `core-start` | whole-system outcome, active surfaces, validators, project/task handoff를 확인할 때 | 특정 domain의 상세 boundary를 대체하려 할 때 | small | whole-system control | all projects/tasks |
| [`retrieval-plane.md`](retrieval-plane.md) | domain | `domain-current` | hybrid 검색, revision, freshness, update/delete/rename 계약을 설계하거나 진단할 때 | ordinary docs work에서 retrieval runtime 변경이 없을 때 | medium | retrieval | retrieval-sensitive work |
| [`policy-to-evidence-governance.md`](policy-to-evidence-governance.md) | governance | `domain-current` | human policy, AI proposal, normative approval, exception, policy-to-evidence traceability를 설계하거나 검토할 때 | policy/risk authority와 무관한 ordinary task execution | small | governance | governance-sensitive work |
| [`execution-loop-plane.md`](execution-loop-plane.md) | domain | `domain-current` | loop-enabled task의 checkpoint, attention, retry/stop, receipt를 설계하거나 재개할 때 | checkpoint를 쓰지 않는 단순 문서 작업 | medium | execution | loop-enabled tasks |
| [`human-control-view-plane.md`](human-control-view-plane.md) | domain | `domain-current` | local view projector, snapshot API/SSE, freshness, read-only security/runtime을 설계할 때 | ordinary loop task 실행 또는 UI runtime 변경이 없을 때 | small | human-view | human view runtime |
| [`harness-adoption-plane.md`](harness-adoption-plane.md) | domain | `domain-current` | executable initialize/migrate/upgrade/verify/rollback, file ownership, repository-local skill, policy extraction, versioned repo-local View handoff를 설계할 때 | 이미 설치된 harness의 ordinary task execution | medium | harness-adoption | repository adoption/migration |
| [`ubiquitous-language.md`](ubiquitous-language.md) | term-registry | `term-excerpt` | canonical term, naming, status vocabulary, boundary vocabulary 판단이 필요할 때 | ordinary task work에서 full document를 기본 로딩할 때 | small | all domains | all term-linked docs |

## Change Log

- 2026-05-16: reusable design retrieval index created.
- 2026-07-15: retrieval-plane domain design selection rule added.
- 2026-07-15: policy governance and execution loop design selection rules added.
- 2026-07-15: human-control-view-plane을 execution loop에서 분리했다.
- 2026-07-15: mature repository adoption과 policy extraction을 위한 harness-adoption-plane을 추가했다.
- 2026-07-16: harness-adoption-plane selection rule에 repository-local harness skill을 추가했다.
- 2026-07-16: harness-adoption-plane을 executable v1 lifecycle/schema/status/reference View contract에 정렬했다.
