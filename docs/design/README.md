# DDD Design Index

`docs/design/`은 고객, 도메인 전문가, 기획자, 설계자, 개발자와 QA가 함께 사용하는 DDD domain truth 전용 surface입니다. 기술 구조는 `docs/architecture/`, policy·approval authority는 `docs/governance/`를 사용합니다.

## Rules

- 먼저 [`domain-landscape.md`](domain-landscape.md)에서 domain vision과 subdomain을 확인합니다.
- 다음으로 [`context-map.md`](context-map.md)에서 대상 bounded context와 upstream/downstream 관계를 선택합니다.
- 역할에 맞는 target context의 `domain-model.md`, `ubiquitous-language.md`, `examples.md` section을 읽습니다.
- `current` model은 exact human domain-expert approval receipt가 current bytes와 일치할 때만 authoritative합니다.
- `draft`와 `review_requested`는 유용한 candidate이지만 구현·QA의 current truth로 사용할 수 없습니다.
- 같은 용어가 context마다 다른 뜻이면 하나로 합치지 않고 context map translation을 명시합니다.
- 상세 authoring과 validation은 `docs/guide/ddd-domain-design.md`를 따릅니다.

## Retrieval Classes

| Retrieval Class | Meaning |
| --- | --- |
| `core-start` | domain vision과 subdomain orientation |
| `context-map` | bounded context ownership, relation과 translation |
| `domain-current` | 특정 bounded context의 tactical model |
| `term-excerpt` | 해당 context의 필요한 term section |
| `domain-examples` | role/QA가 사용하는 business examples와 counterexamples |

## Design Index

| Design Doc | Design Kind | Retrieval Class | Status / Validation | Read When | Size Tier | Bounded Context | Role Views |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [`domain-landscape.md`](domain-landscape.md) | domain-landscape | `core-start` | review_requested | domain vision, subdomain portfolio와 core differentiation을 확인할 때 | small | all | all |
| [`context-map.md`](context-map.md) | context-map | `context-map` | review_requested | context 선택, upstream/downstream와 translation을 확인할 때 | small | all | all |
| [`contexts/governance/domain-model.md`](contexts/governance/domain-model.md) | bounded-context | `domain-current` | review_requested | policy, guideline, initiative와 human decision 의미를 다룰 때 | medium | governance | all |
| [`contexts/governance/ubiquitous-language.md`](contexts/governance/ubiquitous-language.md) | ubiquitous-language | `term-excerpt` | review_requested | governance 용어 의미가 필요할 때 | small | governance | all |
| [`contexts/governance/examples.md`](contexts/governance/examples.md) | domain-examples | `domain-examples` | review_requested | approval·activation 정상/거절 example을 사용할 때 | small | governance | all |
| [`contexts/execution/domain-model.md`](contexts/execution/domain-model.md) | bounded-context | `domain-current` | review_requested | task, checkpoint, attention, evidence와 closeout을 다룰 때 | medium | execution | all |
| [`contexts/execution/ubiquitous-language.md`](contexts/execution/ubiquitous-language.md) | ubiquitous-language | `term-excerpt` | review_requested | execution 용어 의미가 필요할 때 | small | execution | all |
| [`contexts/execution/examples.md`](contexts/execution/examples.md) | domain-examples | `domain-examples` | review_requested | 실행·중단·완료 example과 QA를 만들 때 | small | execution | all |
| [`contexts/adoption/domain-model.md`](contexts/adoption/domain-model.md) | bounded-context | `domain-current` | review_requested | initialize/migrate/upgrade/rollback 의미를 다룰 때 | medium | adoption | all |
| [`contexts/adoption/ubiquitous-language.md`](contexts/adoption/ubiquitous-language.md) | ubiquitous-language | `term-excerpt` | review_requested | adoption 용어 의미가 필요할 때 | small | adoption | all |
| [`contexts/adoption/examples.md`](contexts/adoption/examples.md) | domain-examples | `domain-examples` | review_requested | plan/apply/conflict/rollback example을 사용할 때 | small | adoption | all |
| [`contexts/retrieval/domain-model.md`](contexts/retrieval/domain-model.md) | bounded-context | `domain-current` | review_requested | source revision, search visibility와 freshness를 다룰 때 | medium | retrieval | all |
| [`contexts/retrieval/ubiquitous-language.md`](contexts/retrieval/ubiquitous-language.md) | ubiquitous-language | `term-excerpt` | review_requested | retrieval 용어 의미가 필요할 때 | small | retrieval | all |
| [`contexts/retrieval/examples.md`](contexts/retrieval/examples.md) | domain-examples | `domain-examples` | review_requested | write/read/delete/rename freshness example을 사용할 때 | small | retrieval | all |

## Change Log

- 2026-07-29: 범용 control-plane index를 DDD-only landscape/context-map/bounded-context index로 교체했다.
