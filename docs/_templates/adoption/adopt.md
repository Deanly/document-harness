---
type: guide
title: adopt-document-harness
status: current
owner: document-harness
related_design:
  - docs/design/harness-adoption-plane.md
  - docs/design/policy-to-evidence-governance.md
  - docs/design/human-control-view-plane.md
source_refs:
  - docs/releases/document-harness-v1.json
tags:
  - docs/guide
  - adoption
  - migration
---

# Adopt Document Harness

## Purpose

이 문서는 현재 repository에 설치된 document-harness를 initialize, migrate, upgrade, verify 또는 rollback하는 repository-local entrypoint입니다. 기존 project-owned bytes와 dirty tracked/untracked work를 보존합니다.

## Profiles

- `core`: repository-local skill, reusable document authoring, execution contract와 validators
- `governance`: `core` + source-linked policy/guideline catalog, initiative bootstrap과 human-review contract
- `view`: `core` + `governance` + independent read-only Human Control View

`view` 선택은 dependency를 포함한 full profile을 설치합니다. partial profile은 `MIGRATION_VERIFIED`를 주장할 수 없습니다.

## Lifecycle

plan output은 target 밖의 이미 존재하는 directory에 둡니다.

```bash
./docs/bin/harness-adopt plan --target <repository> --profile core,governance,view --output <outside-target>/adoption-plan.json
./docs/bin/harness-adopt apply --plan <outside-target>/adoption-plan.json --expect-plan-hash <planHash>
./docs/bin/harness-adopt verify --target <repository>
./docs/bin/harness-adopt rollback --receipt <repository>/docs/receipts/harness-apply-<plan-prefix>.json
```

- `PLAN_READY`: exact plan hash로 apply 가능
- `NEEDS_DECISION`: conflict, unsafe path 또는 fence mismatch; target write 0
- `APPLY_FAILED`: automatic rollback 결과와 failure receipt 확인 필요
- `INSTALLED_NOT_VERIFIED`: installed/evidence gate 미완료
- `INSTALLED_AWAITING_REVIEW`: governance human review 미완료
- `MIGRATION_VERIFIED`: release fence, required gates와 human review가 모두 확인됨
- `ROLLED_BACK`: apply preimage가 안전하게 복원됨

## Ownership And Safety

- project-owned AGENTS, control-plane, design와 기존 document를 자동 overwrite하지 않습니다.
- same-name customized file에 trusted installation baseline이 없으면 conflict입니다.
- plan 후 target revision/index/bytes 또는 release bytes가 바뀌면 apply하지 않습니다.
- policy wording, human approval, gate pass와 migration conflict를 AI가 발명하거나 self-approve하지 않습니다.
- 승인·효력 상태인 정책·지침의 `effectiveRef` 또는 `sourceRefs[].path` bytes를 release upgrade가 바꾸려 하면 `APPROVED_GOVERNANCE_SOURCE_MUTATION`으로 중단하고 새 인간 결정을 요구합니다. bytes가 같은 mode-only repair와 project-owned governance catalog 보존은 허용합니다.
- mature repository는 policy/guideline extraction 뒤 source-backed unapproved `INIT-*` candidate 또는 `ATTN-INITIATIVE-EXTRACTION` + `GAP-INITIATIVE-EXTRACTION`을 반드시 남깁니다.
- `.env`, credential, private source와 개인 절대경로를 governance/View artifact에 넣지 않습니다.
- View는 exact loopback과 OS-assigned port만 사용하고 foreign process를 종료하지 않습니다.

## Korean-First Human Projection

- 사용자에게 보이는 고정 이름은 `보드`입니다. top bar 왼쪽에는 `보드 / <repository>`를 모든 tab과 scroll 위치에서 표시하고, 기술 executable/path는 `human-view` 호환성을 유지합니다.
- 사용자용 View chrome과 AI가 합성하는 project description, direction, policy/guideline title·summary·why·scope·risk, attention/gap, approval rule, source note와 자유 서술 evidence kind label은 `ko-KR`를 기본으로 합니다.
- stable technical ID, enum, repository-relative path, hash, command와 exact source heading/quote는 원형을 보존하고 한국어 설명 옆의 보조 metadata로 표시합니다.
- 기존 영어 사용자 문구의 번역은 presentation-only migration입니다. 의미·범위·authority·approval·enforcement·effective ref·receipt·evidence freshness를 바꾸지 않으며, 의미 보존이 불확실하면 review attention을 남깁니다.
- 긴 ID, path와 hash는 자기 cell/card 안에서 줄바꿈하고 인접 제목·badge·column과 겹치지 않게 desktop과 narrow viewport에서 검증합니다.
- canonical tab은 `개요`, `정책`, `지침`, `추진안`, `검토 대기`, `실행 상태`, `근거` 순서입니다. 정책/지침/추진안은 각각 독립 search/filter/pagination/detail을 가지며 추진안은 Project의 `related_initiative`를 역색인합니다.

## Mature Repository Governance Bootstrap

정책과 지침 후보를 먼저 source-backed catalog로 정리한 다음 기존 project/design/roadmap/task에서 outcome portfolio를 찾습니다.

- 근거가 충분하면 `docs/_indexes/initiative-register.json`에 `INIT-*` migration candidate를 씁니다. `draft`, `unreviewed|review_requested`, null document/effective/decision refs를 유지하고 existing `P####`, policy/guideline 관계, success signal, risk와 exact source hash/revision을 포함합니다.
- 근거가 부족하거나 서로 충돌하면 빈 register를 숨기지 말고 governance catalog에 `ATTN-INITIATIVE-EXTRACTION`과 `GAP-INITIATIVE-EXTRACTION`을 함께 유지합니다. 부족한 source와 사용자가 내려야 할 결정을 한국어로 적습니다.
- AI는 `INIT-*`를 numbered `I####`로 발급하거나 activate/approve하지 않습니다. 후보 작성, initiative issuance와 activation approval은 서로 다른 단계입니다.

## Installed Authoring Workflow

`core`와 이를 포함하는 full profile은 reusable template, `new-doc.sh`, execution/closeout validators와 `close-doc.sh`를 함께 설치합니다. numbered initiative/project/task/QA draft는 clean `main`에서 먼저 발급합니다.

```bash
./docs/bin/new-doc.sh initiative service-resilience DECISION-EXAMPLE
# Complete human activation review; project issuance requires I0001 to be active and approved.
./docs/bin/new-doc.sh project umbrella-project I0001
# Task issuance verifies P0001 resolves to an active, approved initiative.
./docs/bin/new-doc.sh task first-task P0001
./docs/bin/new-doc.sh qa first-test-strategy
# Fill the generated QA type/owner fields and commit the numbered drafts before continuing.
./docs/bin/new-doc.sh design service-boundary
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
```

`DECISION-EXAMPLE`은 실제 human issuance-approval ref로 교체합니다. Project는 active/approved Initiative를, Task는 그 lineage로 해소되는 Project를 명시하며 기본 `I0001`/`P0001`을 추론하지 않습니다. 완전한 legacy lineage field를 가진 기존 Project만 migration 동안 Task parent로 grandfathering합니다.

generated placeholder와 project-owned `docs/design/ubiquitous-language.md`를 실제 source에 맞게 채운 뒤 commit합니다.

## Verification

모든 profile에서 설치되는 common checks:

```bash
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
./docs/bin/harness-adopt verify --target .
git diff --check
```

`view` profile이 설치된 경우에만 실행하는 View checks:

```bash
./runtime/document-harness-view/bin/human-view doctor
./runtime/document-harness-view/bin/human-view test
./runtime/document-harness-view/bin/human-view snapshot
```

View freshness나 apply success만으로 migration을 verified 처리하지 않습니다. source provenance의 `capturedSha256`은 과거 revision 파일 전체를 고정하고, 현재 freshness는 `lineStart..lineEnd`가 걸친 Markdown 제목 묶음을 비교합니다. 인용 구간 밖의 변경은 file drift로만 표시하지만, 인용 구간 변경·anchor 소실·legacy non-Markdown 전체 파일 변경은 stale입니다. `verify`는 source-backed `INIT-*` candidate 또는 paired initiative gap/attention이 없으면 fail closed 합니다. required gate evidence와 source-fenced human decisions도 완성돼야 합니다.

## References

- `docs/design/harness-adoption-plane.md`
- `docs/guide/repository-policy-extraction.md`
- `docs/guide/initiative-governance.md`
- `docs/design/policy-to-evidence-governance.md`
- `docs/design/human-control-view-plane.md`
- `docs/EXECUTE.md`

## Change Log

- document-harness adoption: installed reusable authoring, execution, governance와 View lifecycle을 정리했습니다.
- mature repository initiative bootstrap: unapproved source-backed candidate 또는 explicit extraction gap/attention을 필수화했습니다.
