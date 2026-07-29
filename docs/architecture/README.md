# Architecture Index

`docs/architecture/`는 domain model을 구현·투영·운영하는 기술 구조와 control contract를 담습니다. 이 문서는 `docs/design/`의 business meaning을 재정의하지 않습니다.

| Architecture Doc | Responsibility |
| --- | --- |
| [`control-plane.md`](control-plane.md) | whole-system control surface와 validator alignment |
| [`retrieval-plane.md`](retrieval-plane.md) | retrieval, revision, freshness |
| [`execution-loop-plane.md`](execution-loop-plane.md) | checkpoint, attention, receipt, execution state |
| [`harness-adoption-plane.md`](harness-adoption-plane.md) | initialize/migrate/upgrade/verify/rollback |
| [`human-control-view-plane.md`](human-control-view-plane.md) | Board projection, freshness, read-only runtime |
| [`harness-language.md`](harness-language.md) | harness implementation and control vocabulary |
