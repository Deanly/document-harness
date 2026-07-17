---
type: guide
title: hybrid-retrieval-and-freshness
status: current
owner:
created: 2026-07-15
updated: 2026-07-15
related_project: []
related_task: []
related_design:
  - docs/design/control-plane.md
  - docs/design/retrieval-plane.md
source_refs:
  - https://arxiv.org/abs/2104.08663
  - https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf
  - https://doi.org/10.1109/PDIS.1994.331722
  - https://arxiv.org/abs/2402.03216
  - https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/FSEvents_ProgGuide/UsingtheFSEventsFramework/UsingtheFSEventsFramework.html
tags:
  - docs/guide
  - hybrid-retrieval
  - freshness
---

# hybrid-retrieval-and-freshness

- Type: guide
- Status: current
- Created: 2026-07-15
- Updated: 2026-07-15
- Related Task:
- Related Design: docs/design/control-plane.md; docs/design/retrieval-plane.md

## Purpose

문서 corpus가 수동 `rg`와 context packet만으로 다루기 어려워질 때 hybrid retrieval을 도입하고, 방금 수정·삭제한 source가 stale RAG 결과에 가려지지 않도록 운영하는 절차입니다.

## Operating Principle

`source first, index second`를 유지합니다.

- index는 후보 선택과 ranking을 위한 projection입니다.
- source registry와 metadata filter로 검색 범위를 먼저 제한합니다.
- ID, path, YAML key, 명령, 오류 문자열은 untokenized keyword/term 또는 direct source search로 찾고 BM25 analyzer에 exact 책임을 맡기지 않습니다.
- watcher는 빠른 경로이고 reconciliation scanner가 완전성의 근거입니다.
- 같은 작업에서 바뀐 source는 receipt가 확인되기 전 직접 읽습니다.
- indexed-only fast path가 최신 delta를 제외한다면 기본 검색에 사용하지 않습니다.

Machine-readable 기본값은 `docs/_indexes/retrieval-policy.yaml`을 따르며, downstream은 값 변경 근거와 golden-set 결과를 함께 남깁니다.

## Profile Selection

| Profile | Suitable When | Required Capability |
| --- | --- | --- |
| static | 작은 corpus, 낮은 변경률 | `rg`, README/index, context packet |
| embedded hybrid | single user/process 중심, 수십 project | exact+BM25+dense, RRF, transactional update/delete, searchable delta, single mutation coordinator |
| service hybrid | multi-writer, 독립 배포, 높은 지속 QPS | durable log/WAL, idempotent upsert, acknowledged visibility, snapshot/restore |
| enterprise | ACL, replica/shard, 조직 운영 표준 | authorization filter, NRT cost control, online migration |

30 projects는 override 가능한 embedded hybrid 운영 검토 trigger입니다. 활성화 전 기본은 static이며, 활성화와 backend 승격은 chunk 수, edit rate, query concurrency, visibility lag 측정값으로 결정합니다.

## Ingest Loop

1. versioned registry의 include/exclude, sensitivity, branch scope를 적용하며 필수 metadata가 없으면 fail closed합니다.
2. watcher event를 debounce하고 현재 `revision_seq`와 source hash를 읽습니다.
3. stored manifest와 hash가 같으면 no-op 처리합니다.
4. heading-aware chunk manifest를 만들고 unchanged/changed/new/deleted를 분류합니다.
5. changed/new chunk만 embedding하고 `index_generation + content_hash`로 cache하며 source hash가 처리 중 바뀌지 않았는지 다시 확인합니다.
6. exact/lexical 및 dense 결과를 revision-keyed inactive row로 staging합니다. staging은 active/rollback revision row를 overwrite/delete하지 않습니다.
7. staging write에는 해당 document revision의 전체 chunk manifest를 전달합니다. changed chunk만 전달해 unchanged chunk를 삭제하지 않습니다.
8. pointer publish 직전 document head와 source hash를 검사합니다. current head와 job `revision_seq`가 다르면 staged row를 publish하지 않습니다.
9. exact/lexical이 같은 revision이면 lexical pointer/receipt를 publish하고, 모든 arm이 같은 revision이면 `hybrid_active_revision`을 원자 publish합니다.
10. in-place destructive replacement를 쓰는 adapter는 document lease/CAS를 모든 row write보다 먼저 얻고 pointer/receipt commit까지 유지합니다.
11. deleted chunk와 이전 path는 같은 guard 아래 zero-chunk document head/tombstone revision으로 숨깁니다.
12. startup 및 주기적 scanner가 source/registry/index manifest를 대조해 누락과 orphan을 복구합니다.

Embedded profile의 watcher, scanner, manual sync는 한 mutation coordinator를 통합니다. lexical N 공개 중에도 hybrid N-1 또는 rollback/query fence가 참조하는 row를 보존하고, 어느 pointer/fence도 참조하지 않을 때만 cleanup합니다. dense N 실패 시 N/N-1 arm을 섞지 않고 hybrid-pending 또는 direct-read degraded로 처리합니다.

## Query Loop

1. active index와 design map에서 검색 scope를 고릅니다.
2. current registry snapshot으로 project/source/doc type/status/sensitivity/branch/worktree metadata를 prefilter합니다. row가 기록한 과거 registry revision과의 전역 equality를 요구하지 않습니다.
3. exact identifier는 keyword/term과 scoped direct source search로 가져옵니다.
4. BM25와 multilingual dense 후보를 `registry snapshot + generation + pointer epoch + arm backend version(s)`의 logical read fence에서 가져옵니다.
5. hybrid mode에서는 같은 `hybrid_active_revision`의 arm만 결합하고 N lexical과 N-1 dense를 섞지 않습니다.
6. tombstone과 inactive revision을 제거하고 logical chunk로 dedupe합니다.
7. policy의 provisional RRF 기본값으로 fusion합니다.
8. 결과의 path, heading, revision, content hash, logical read fence를 확인합니다.
9. authoritative source section을 직접 읽고 hash/revision을 다시 비교합니다. 다르면 hit를 폐기하고 재검색합니다.

## Same-Session Freshness

파일을 만들거나 수정한 작업은 다음 절차를 사용합니다.

1. 변경 source의 `doc_id`, `revision_seq`, `source_hash`를 dirty set에 기록합니다.
2. 검색 전에 pending ingest를 짧게 drain하거나 incremental scan을 요청합니다.
3. query는 dirty source마다 비교 가능한 minimum `revision_seq + source_hash`를 요구합니다. opaque source revision은 비교에 쓰지 않습니다.
4. deadline 안에 receipt가 없으면 query scope 안의 모든 dirty document를 작은 direct-search candidate union에 넣고 직접 읽습니다.
5. 같은 source의 낮은 revision index hit는 결과에서 mask합니다.

이 fallback은 오류 은폐가 아닙니다. same-session freshness, 실제 shared-index visibility lag, degraded 상태를 서로 다른 지표로 기록해야 합니다.

## Delete And Rename

- delete는 physical compaction을 기다리지 않고 tombstone이 먼저 query visibility를 차단합니다.
- stable `doc_id`가 있는 rename은 identity를 유지하고 path metadata를 원자적으로 바꿉니다.
- stable id가 없으면 rebuildable index 밖의 versioned·backup 가능한 catalog identity를 우선하고, 불가능하면 old path tombstone과 new path activation을 같은 source revision으로 처리합니다.
- reconciliation은 source에 없는 orphan chunk와 old path를 검출해야 합니다.

삭제 판정은 `PRESENT`, `INDETERMINATE`, `ABSENT_CONFIRMED`를 사용합니다. 단일 missing event나 read/parse/permission 오류, source root 접근 실패는 삭제가 아닙니다. readable source root의 settled scan에서 path가 없고 debounce batch가 닫혔으며 stable ID의 rename target도 없거나, 명시적 Git delete/settled rescan 같은 authoritative signal이 있을 때만 tombstone revision을 발급합니다.

## Evaluation And Operations

최초 도입과 backend/model/chunker 변경 전후에 같은 golden set을 사용합니다.

- exact ID, filename, YAML key, 명령, 오류 문자열
- 자연어 paraphrase
- 여러 project에 같은 용어가 있는 질의
- 한글 질의에서 영문 source, 영문 질의에서 한글 source라는 교차언어 목표; model 이름만으로 통과 처리하지 않음
- create, update, delete, rename, rapid save, crash/restart

최소 지표는 exact identifier hit rate, Recall@10, nDCG@10, MRR, scope leakage, stale hit rate, normal-path visibility p50/p95, reconciliation convergence max입니다. p99는 충분한 반복 수와 신뢰구간이 있을 때만 보고합니다. 정적 validator 통과를 runtime freshness 증거로 사용하지 않습니다.

## Failure Response

| Symptom | First Check | Response |
| --- | --- | --- |
| 방금 쓴 token이 안 보임 | source/index revision, pending age | direct-read, incremental scan, lag 기록 |
| 삭제 문서가 보임 | active revision, tombstone | stale hit mask, tombstone 복구, reconciliation |
| rename 전 path가 보임 | stable identity와 manifest | old path tombstone 후 atomic path update |
| 결과 scope가 섞임 | registry snapshot과 metadata filter | query 중단, filter 수정, leakage test 추가 |
| watcher recrawl/overflow | watcher health | full hash reconciliation 실행 |
| 품질이 하락함 | BM25/dense/fused raw rank | golden set으로 arm별 회귀 원인 분리 |
| 낮은 revision chunk 부활 | document head와 job revision | publish 차단, tombstone 복구, out-of-order smoke |
| 한 arm만 새 revision | arm receipts와 logical query fence | hybrid-pending/direct-read degraded, 실패 arm 재시도, 이전 row 보존 |
| 일시적 read/parse 실패 | presence 3상태와 source-root readability | `INDETERMINATE`로 두고 기존 active revision 유지, retry 기록 |
| generation build 중 변경 | cutoff/replay watermark | parity 전 cutover 금지, 이전 generation rollback 유지 |

## References

- [BEIR](https://arxiv.org/abs/2104.08663)
- [Reciprocal Rank Fusion](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf)
- [Session Guarantees for Weakly Consistent Replicated Data](https://doi.org/10.1109/PDIS.1994.331722)
- [BGE-M3 multilingual and cross-lingual evaluation](https://arxiv.org/abs/2402.03216)
- [Apple FSEvents rescan requirements](https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/FSEvents_ProgGuide/UsingtheFSEventsFramework/UsingtheFSEventsFramework.html)

## Change Log

- 2026-07-15: hybrid retrieval 도입, incremental ingest, read-your-writes, tombstone, reconciliation 운영 절차 추가.
