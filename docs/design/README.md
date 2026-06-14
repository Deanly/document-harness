# Design Retrieval Index

이 파일은 `docs/design/` 문서를 LLM/Codex가 통째로 읽지 않고 작업 성격에 맞게 선택하도록 돕는 retrieval index입니다.

## Rules

- `docs/design/control-plane.md`는 whole-system orientation용 `core-start` 문서입니다.
- `docs/design/ubiquitous-language.md`는 canonical term registry이지만 기본 전체 로딩 대상이 아닙니다. 용어 판단이 필요한 section만 읽는 section-load 문서입니다.
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
| [`ubiquitous-language.md`](ubiquitous-language.md) | term-registry | `term-excerpt` | canonical term, naming, status vocabulary, boundary vocabulary 판단이 필요할 때 | ordinary task work에서 full document를 기본 로딩할 때 | small | all domains | all term-linked docs |

## Change Log

- 2026-05-16: reusable design retrieval index created.
