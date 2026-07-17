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
- `governance`: `core` + source-linked policy/guideline catalog와 human-review contract
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
- `.env`, credential, private source와 개인 절대경로를 governance/View artifact에 넣지 않습니다.
- View는 exact loopback과 OS-assigned port만 사용하고 foreign process를 종료하지 않습니다.

## Installed Authoring Workflow

`core`와 이를 포함하는 full profile은 reusable template, `new-doc.sh`, execution/closeout validators와 `close-doc.sh`를 함께 설치합니다. numbered project/task/QA draft는 clean `main`에서 먼저 발급합니다.

```bash
./docs/bin/new-doc.sh project umbrella-project
./docs/bin/new-doc.sh task first-task
./docs/bin/new-doc.sh qa first-test-strategy
# Fill the generated QA type/owner fields and commit the numbered drafts before continuing.
./docs/bin/new-doc.sh design service-boundary
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
```

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

View freshness나 apply success만으로 migration을 verified 처리하지 않습니다. required gate evidence와 source-fenced human decisions가 완성돼야 합니다.

## References

- `docs/design/harness-adoption-plane.md`
- `docs/guide/repository-policy-extraction.md`
- `docs/design/policy-to-evidence-governance.md`
- `docs/design/human-control-view-plane.md`
- `docs/EXECUTE.md`

## Change Log

- document-harness adoption: installed reusable authoring, execution, governance와 View lifecycle을 정리했습니다.
