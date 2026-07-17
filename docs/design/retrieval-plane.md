---
type: design
title: retrieval-plane
status: current
domain: retrieval
owner:
created: 2026-07-15
updated: 2026-07-15
retrieval_class:
  - domain-current
context:
  default_load: false
  section_load: false
  evidence_only: false
  size_tier: medium
referenced_by:
  - docs/design/control-plane.md
  - docs/guide/hybrid-retrieval-and-freshness.md
related_task: []
source_refs:
  - https://doi.org/10.1561/1500000019
  - https://arxiv.org/abs/2104.08663
  - https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf
  - https://doi.org/10.1109/PDIS.1994.331722
  - https://arxiv.org/abs/2402.03216
  - https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/FSEvents_ProgGuide/UsingtheFSEventsFramework/UsingtheFSEventsFramework.html
tags:
  - docs/design
  - retrieval
  - freshness
---

# retrieval-plane

- Type: design
- Domain: retrieval
- Owner:
- Created: 2026-07-15
- Updated: 2026-07-15
- Referenced By:
  - `docs/design/control-plane.md`
  - `docs/guide/hybrid-retrieval-and-freshness.md`

## Purpose

이 문서는 문서 수가 커진 뒤에도 exact identifier, 자연어 의미, 최신 source revision을 함께 찾기 위한 reusable retrieval 계약을 고정합니다.

작은 corpus에서는 `rg`, folder README, `_indexes`만으로 충분합니다. 규모나 변경률이 커질 때는 이 정적 retrieval surface 위에 hybrid index를 추가하되, 원문과 인덱스의 권위를 뒤집지 않습니다.

## Whole-System Role

- manual retrieval surface가 감당하기 어려워진 뒤에만 활성화되는 scale-out layer입니다.
- `control-plane`과 source registry가 검색 범위를 정하고, 이 설계가 relevance와 freshness 계약을 담당합니다.
- downstream runtime은 구현을 선택하지만 source authority, revision, deletion, fallback invariant는 바꿀 수 없습니다.

## Authority Boundary

- filesystem의 현재 Markdown/Git working tree가 authoritative source입니다.
- lexical index, vector index, embedding, chunk manifest는 모두 재생성 가능한 derived projection입니다.
- 검색 결과는 후보와 provenance를 제공하며 source document를 대체하지 않습니다.
- 방금 수정한 파일 또는 freshness가 불확실한 결과는 authoritative source section을 직접 읽어 확인합니다.
- runtime 구현과 backend 선택은 downstream이 소유하고, 이 저장소는 계약과 정적 검증만 소유합니다.

## Invariants

- scope filter 밖 source나 inactive revision을 결과로 반환하지 않습니다.
- 모든 hit는 source identity와 `indexed_revision`을 추적할 수 있어야 합니다.
- 낮은 revision의 늦은 작업이 더 높은 active revision을 덮지 못합니다.
- 삭제·rename된 이전 identity는 physical compaction 전에도 보이지 않습니다.
- watcher event 수신 여부를 correctness proof로 사용하지 않습니다.
- 새·수정된 searchable delta를 background optimize 전부터 검색합니다.
- freshness를 증명할 수 없는 same-session query는 source direct-read로 보완하거나 pending 상태를 명시합니다.

## Scale Activation

Hybrid retrieval 도입은 다음 신호 중 하나가 반복될 때 운영자가 검토하고 활성화합니다.

- 관리 프로젝트가 30개 이상이 되어 수동 검색의 context 비용이 커짐
- exact 검색만으로 paraphrase나 한·영 표현 차이를 자주 놓침
- broad context loading이 prompt budget 또는 응답 latency를 침범함
- 수정·삭제 후 검색 결과 가시성 지연이 업무 흐름을 막음

프로젝트 30개는 override 가능한 운영 검토 trigger이지 capacity 증명값이 아닙니다. 활성화 전 기본 profile은 static이고, 실제 활성화·backend 승격은 document/chunk 수, edit rate, query concurrency, visibility lag, latency를 측정해 결정합니다.

## Retrieval Components

| Component | Responsibility |
| --- | --- |
| source registry | project/source scope, include/exclude, sensitivity를 고정 |
| watcher | 변경을 빠르게 알리는 best-effort latency hint |
| reconciliation scanner | content hash로 누락·고아·낮은 revision을 복구하는 correctness authority |
| chunk manifest | source revision과 logical chunk identity를 연결 |
| exact arm | ID, 경로, YAML key, 명령, 오류 문자열을 untokenized keyword/term 또는 direct source search로 검색 |
| lexical arm | tokenized natural-language evidence를 BM25로 검색 |
| dense arm | 자연어 paraphrase, 의미 유사성, 다국어 표현 차이 검색 |
| fusion | 서로 다른 score scale을 rank 기반으로 결합 |
| freshness barrier | 같은 세션이 최신 revision 이상만 읽도록 보장 |

## Interfaces

| Interface | Minimum Contract |
| --- | --- |
| change signal | source scope, relative path, event hint; correctness를 주장하지 않음 |
| source manifest | document identity, current revision, content hash, active paths |
| write receipt | document identity, comparable revision sequence, arm/generation, committed state |
| query request | text, scope filters, mode, optional minimum revisions |
| query result | path, heading, active revision, content hash, rank provenance, freshness state |
| reconciliation report | missing, orphan, stale, failed revision과 복구 결과 |

## Revision And Identity

최소 metadata는 `docs/_indexes/retrieval-policy.yaml`의 역할별 `metadata_contracts`를 따릅니다. chunk row, document head, arm receipt, query envelope/result를 한 레코드처럼 섞지 않습니다.

- `source_id`와 `project_id`는 검색 범위가 섞이지 않게 합니다.
- `doc_id`는 rename에도 유지되는 frontmatter 영구 식별자를 우선합니다. 없으면 catalog가 path와 독립된 identity를 한 번 발급해 보존하며, 단순 path hash fallback은 rename identity를 보장하지 않습니다. 이 catalog mapping은 rebuildable index 밖의 versioned·backup 가능한 control state입니다.
- `chunk_id`는 `doc_id`, heading path, stable section ordinal에서 결정적으로 만듭니다.
- `source_revision`은 receipt와 provenance에 쓰는 opaque source revision입니다.
- `revision_seq`는 같은 document 안에서 순서를 비교할 수 있는 monotonic sequence이고, `source_hash`는 그 revision의 bytes를 확인합니다.
- `indexed_revision`은 arm receipt가 완료한 revision이며, document head의 `lexical_active_revision`과 `hybrid_active_revision`을 별도로 보존합니다.
- `content_hash`는 실제 변경 확인과 unchanged chunk 재사용의 근거입니다.
- `index_generation`은 schema, chunker, tokenizer, embedding model 조합을 식별합니다.
- current registry snapshot은 query-time authoritative control state입니다. chunk row가 기록한 registry revision은 audit provenance일 뿐 current revision과의 전역 equality 조건이 아닙니다.
- registry tightening/exclude는 pointer 공개 전 또는 동시에 fail-closed 적용하고, relaxing/include는 searchable row가 준비된 뒤 공개합니다. 무관한 registry entry 변경 때문에 corpus 전체 row를 다시 쓰지 않습니다.

낮은 revision의 비동기 작업은 더 높은 active revision을 덮을 수 없습니다.

## Incremental Projection

1. watcher가 변경 가능성을 알리거나 scanner가 source/registry revision 차이를 발견합니다.
2. debounce 후 원문을 다시 읽고 content hash로 실제 변경을 확정합니다.
3. heading-aware manifest를 만들고 이전 manifest와 diff합니다.
4. 변경되거나 새로 생긴 chunk만 embedding하고, 동일 `index_generation + content_hash` cache는 재사용합니다.
5. 처리 전후 source hash가 다르면 결과를 폐기하고 최신 revision을 다시 처리합니다.
6. 해당 revision의 exact/lexical row를 revision-keyed inactive staging에 쓰고 dense row도 별도로 staging할 수 있습니다. staging은 current row를 overwrite/delete하지 않습니다.
7. staging input은 변경 chunk만이 아니라 해당 document revision의 전체 chunk manifest입니다. embedding 계산만 changed/new chunk로 제한합니다.
8. document mutation lease 또는 pointer CAS 아래 authoritative head와 source hash가 job revision인지 다시 확인한 뒤에만 lexical/hybrid pointer와 committed receipt를 publish합니다.
9. 삭제·rename은 같은 guard 아래 zero-chunk/tombstone revision을 publish한 뒤 background cleanup합니다.
10. startup과 주기적 reconciliation이 source, registry, index manifest를 다시 맞춥니다.

작업은 deterministic key를 사용해 at-least-once 재시도에도 idempotent해야 합니다.

## Publish And Concurrency Contract

- embedded profile은 document mutation을 single coordinator로 직렬화합니다. 여러 writer를 허용하는 profile은 document head compare-and-swap과 conflict retry를 제공합니다.
- job은 `(source_id, doc_id, revision_seq, index_generation)`으로 식별합니다. 계산은 lock 밖에서 할 수 있지만 revision row는 immutable inactive staging으로만 씁니다.
- pointer publish 직전에 authoritative document head와 source hash를 다시 확인합니다. job revision이 current가 아니면 staged row를 inactive로 남기거나 폐기하고 pointer를 전환하지 않습니다.
- in-place replacement처럼 active row를 파괴하는 구현은 document lease/CAS를 **모든** insert/delete보다 먼저 얻고 pointer/receipt commit이 끝날 때까지 유지해야 합니다.
- exact/BM25 arm receipt가 revision N을 완료하면 document head의 `lexical_active_revision=N`을 publish할 수 있습니다.
- hybrid revision N은 exact/lexical/dense arm이 모두 N을 확인한 뒤에만 `hybrid_active_revision=N`으로 원자 전환합니다.
- lexical N 공개는 hybrid pointer가 참조하는 이전 revision row를 overwrite/delete하지 않습니다. 어느 active/rollback pointer나 진행 중 query fence도 참조하지 않을 때만 old row를 cleanup합니다.
- dense N 실패 중에는 N lexical과 N-1 dense를 섞지 않습니다. 해당 document를 hybrid-pending으로 제외하거나 direct-read degraded 경로를 사용합니다.
- hybrid query는 `registry snapshot + index_generation + pointer epoch + arm backend version(s)`로 구성된 logical read fence 안에서 같은 active revision의 arm만 결합합니다. native cross-arm snapshot이 없으면 fence를 전후 두 번 읽고 변경 시 결과를 폐기해 bounded retry하며, 반복 변동 시 pending/degraded를 반환합니다.
- registry include/exclude, sensitivity, branch scope 변경도 versioned mutation입니다. 필요한 metadata나 current registry revision이 없으면 결과를 fail-closed하게 제외합니다.

## Query Contract

1. current registry revision을 읽고 `project_id`, `source_id`, `doc_type`, `status`, sensitivity, branch/worktree metadata로 범위를 먼저 제한합니다.
2. identifier-like query는 untokenized keyword/term arm과 scoped direct source search를 사용합니다. BM25 analyzer에 exact match 책임을 맡기지 않습니다.
3. natural-language query는 BM25 lexical arm과 multilingual dense arm을 독립적으로 실행합니다.
4. inactive revision과 tombstone을 제거하고 logical chunk identity로 중복을 없앱니다.
5. Reciprocal Rank Fusion으로 순위를 결합합니다. policy의 `rrf_k`와 candidate 수는 provisional 초기값이며 corpus golden set으로 검증합니다.
6. 필요할 때만 소수 fused 후보에 reranker를 적용합니다.
7. 결과는 path, heading, source/index revision, content hash, logical read fence, retrieval provenance를 반환합니다.
8. LLM context에 넣기 전 authoritative source section을 다시 fetch하고 hit의 revision/hash와 일치하는지 확인합니다. 다르면 결과를 폐기하고 재검색하거나 direct-read degraded 결과로 전환합니다.

검색 backend가 indexed base와 아직 compact되지 않은 searchable delta를 함께 읽을 수 있어야 합니다. 최신 delta를 제외하는 indexed-only 최적화는 기본 경로에서 금지합니다.

## Freshness Contract

### Same Session

- write receipt의 비교 가능한 `revision_seq`와 `source_hash`를 다음 query의 document별 minimum으로 전달합니다. opaque `source_revision`은 provenance로만 사용합니다.
- query deadline 안에 그 revision이 searchable하지 않으면 query scope 안의 dirty source 문서를 작은 direct-search candidate union에 주입하고, authoritative section을 직접 읽으며 해당 문서의 오래된 index hit를 mask합니다.
- 최신성을 보장할 수 없으면 stale 결과를 조용히 반환하지 않고 pending 상태를 드러냅니다.

### Shared Visibility

- 정상 watcher 경로의 lexical, hybrid, delete visibility lag와 same-session fallback 사용률을 별도로 측정합니다. direct-read 성공으로 index visibility lag를 숨기지 않습니다.
- watcher 성공을 freshness 증거로 사용하지 않습니다.
- physical compaction 전에도 tombstone은 삭제된 revision을 즉시 제외해야 합니다.
- watcher drop/overflow 경로는 normal p95와 별도로 reconciliation convergence maximum을 검증합니다.

## Failure Recovery

| Failure | Required Recovery |
| --- | --- |
| watcher event drop/overflow | reconciliation scan으로 source manifest 재대조 |
| rapid or atomic save | debounce 후 final hash만 active 처리 |
| embedding 중 재수정 | stale computation 폐기 및 최신 revision 재큐잉 |
| process crash | persisted receipt와 source hash 차이로 재시작 수렴 |
| delete/rename lag | tombstone mask 후 physical cleanup |
| model/schema change | build cutoff 이후 mutation replay/dual-write, watermark parity 확인, atomic pointer 전환, rollback generation 보존 |
| backend unavailable | scoped direct source search와 명시적 degraded status |
| transient read/parse/permission failure | presence를 `INDETERMINATE`로 두고 기존 active revision 유지, retry/failure record |

삭제는 `PRESENT`, `INDETERMINATE`, `ABSENT_CONFIRMED`의 3상태로 판정합니다. 단일 watcher missing이나 read/parse/permission 오류는 `INDETERMINATE`입니다. readable source root의 settled scan에서 부재하고 debounce batch가 닫혔으며 stable ID의 rename target도 없거나, 명시적 Git delete/settled rescan 같은 authoritative signal이 있을 때만 새 `revision_seq`의 tombstone을 publish합니다.

## Failure Boundaries

- retrieval runtime은 누락된 watcher event, 중복 delivery, out-of-order job, crash 후 재시도를 흡수합니다.
- source parse 실패, embedding 실패, revision mismatch는 완료 처리하지 않고 관측 가능한 failure record로 남깁니다.
- registry scope 위반, stale delete 노출, freshness를 증명할 수 없는 응답은 조용히 통과시키지 않습니다.
- backend의 replication, snapshot, access control 같은 운영 책임은 선택한 downstream profile로 넘깁니다.

## Evaluation Contract

- BM25-only, dense-only, hybrid를 같은 golden query set으로 비교합니다.
- 최소 지표는 Recall@10, nDCG@10, MRR, stale hit rate, visibility lag입니다.
- golden set은 exact identifier, paraphrase, 동일 용어의 project collision, 한·영 교차 검색 목표, create/update/delete/rename/crash를 포함합니다. 교차언어 품질은 model 이름만으로 보장하지 않고 local corpus 결과로 판단합니다.
- static validator는 문서·policy 정합성만 증명합니다. runtime freshness는 mutation smoke와 운영 지표로 별도 검증합니다.

## Quality Axes

- correctness: current revision과 citation이 authoritative source와 일치해야 합니다.
- freshness: create/update/delete/rename visibility lag와 same-session stale hit를 측정합니다.
- relevance: exact와 semantic query 모두 golden set gate를 통과해야 합니다.
- recoverability: watcher loss와 crash 뒤 reconciliation으로 자동 수렴해야 합니다.
- operability: pending age, failures, orphan, generation 상태가 관측 가능해야 합니다.

## Decisions

- lexical과 dense를 상호 대체하지 않고 독립 arm으로 유지합니다.
- raw score 정규화 대신 검증된 rank-fusion 기본값을 사용합니다.
- watcher+scanner 이중 경로와 revision-gated upsert를 기본 ingest 모델로 둡니다.
- read-your-writes barrier와 direct-read fallback을 same-session freshness 계약으로 둡니다.
- static, embedded, service, enterprise profile 간 승격은 project count가 아니라 측정값으로 결정합니다.

## Artifact Contracts

- 이 설계의 machine-readable 기본값은 `docs/_indexes/retrieval-policy.yaml`입니다.
- 실행 순서와 fallback은 `docs/guide/hybrid-retrieval-and-freshness.md`를 따릅니다.
- context packet 선택은 `docs/guide/context-loading-playbooks.md`와 `docs/_indexes/context-packets.yaml`을 따릅니다.
- 계약 변경 시 design index, design map, ubiquitous language, 관련 template, validator를 같은 변경 셋에서 갱신합니다.

## Out Of Scope

- 특정 vector database나 embedding vendor 강제
- private source registry와 로컬 절대경로 저장
- static validator가 runtime freshness를 보장한다는 주장
- 모든 문서를 기본 context에 broad-load하는 방식

## Open Questions

- downstream corpus에 맞는 multilingual embedding model과 lexical tokenizer는 무엇인가?
- visibility SLO를 만족하면서 사용할 debounce, reconciliation, compaction 주기는 얼마인가?
- embedded profile에서 service profile로 승격할 latency, concurrency, 운영 비용 threshold는 얼마인가?

## References

- [BM25 and Beyond](https://doi.org/10.1561/1500000019)
- [BEIR](https://arxiv.org/abs/2104.08663)
- [Reciprocal Rank Fusion](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf)
- [Session Guarantees for Weakly Consistent Replicated Data](https://doi.org/10.1109/PDIS.1994.331722)
- [BGE-M3 multilingual and cross-lingual evaluation](https://arxiv.org/abs/2402.03216)
- [Apple FSEvents rescan requirements](https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/FSEvents_ProgGuide/UsingtheFSEventsFramework/UsingtheFSEventsFramework.html)

## Change Log

- 2026-07-15: vendor-neutral hybrid retrieval, revision, freshness, reconciliation 계약 추가.
