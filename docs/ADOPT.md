---
type: guide
title: adopt-document-harness
status: current
owner:
created: 2026-07-15
updated: 2026-07-17
related_design:
  - docs/design/harness-adoption-plane.md
  - docs/design/policy-to-evidence-governance.md
  - docs/design/human-control-view-plane.md
tags:
  - docs/guide
  - adoption
  - migration
---

# Adopt Document Harness

## Purpose

이 문서는 새 repository 또는 이미 자체 문서 하네스가 있는 mature repository에 document-harness를 안전하게 적용하기 위한 단일 reusable entrypoint입니다.

기존 repository에서는 public 최신 파일을 복사하지 않습니다. 먼저 ownership, installed baseline, current revision과 dirty state를 inventory하고, write 없는 migration plan과 policy/guideline extraction을 만든 뒤 exact plan fence에 따라 적용합니다.

## Select The Path

| Repository State | Path |
| --- | --- |
| 문서 하네스가 없는 새 repository | initialize plan |
| templates, validators, AGENTS 또는 control-plane이 이미 존재 | mature-repository migrate plan |
| installed baseline과 file ownership lock이 존재 | versioned upgrade plan |
| source revision/dirty state를 판정할 수 없음 | stop and request attention |

`init`과 `migrate`를 같은 동작으로 취급하지 않습니다. mature repository를 발견하면 자동 overwrite 대신 migration plan으로 전환합니다.

## Required Read Order

1. target repository의 root `AGENTS.md`와 nested instructions
2. 이미 설치되어 있다면 `.agents/skills/operate-document-harness/SKILL.md`
3. target repository의 current control-plane/design와 active task index
4. `docs/design/harness-adoption-plane.md`
5. `docs/guide/repository-policy-extraction.md`
6. governance와 View를 적용할 때 해당 public design/guide
7. target repository가 직접 참조하는 validator와 operator guide

## Adoption Sequence

```text
protect live system and capture rollback fence
  -> inventory repository and existing harness
  -> classify file ownership
  -> generate deterministic no-write plan
  -> resolve migration conflicts without target writes
  -> apply exact approved plan
  -> initialize explicit governance extraction gap and repo-local View
  -> extract source-linked policy/guideline candidates
  -> human review of governance candidates
  -> run project fast/full/continuous gates
  -> record evidence and verify fail-closed
```

`plan`과 `apply`는 정책 문구를 발명하지 않습니다. `governance` profile은 nested migration fence와 `ATTN-POLICY-EXTRACTION`/`GAP-POLICY-EXTRACTION`을 가진 빈 catalog를 설치합니다. 이후 repository-local skill이 exact source를 직접 읽어 schema-valid candidate를 채우고, 인간 결정 receipt와 gate evidence가 완성된 뒤에만 verify가 migration을 완료로 판정합니다.

초기 View와 policy extraction의 기본 표시 언어는 `ko-KR`입니다. AI가 생성하는 project description, direction, title, human summary, why, scope, risk, attention/gap 문구, approval rule, source note와 자유 서술 evidence kind label은 한국어로 작성하고, 기술 ID·enum·path·hash·command·exact source heading/quote는 원형을 보존합니다.

## Executable V1

plan output은 target 밖의 이미 존재하는 directory에 둡니다. 그래야 plan이 target byte, Git index, runtime과 `$HOME`에 0 write라는 계약을 유지할 수 있습니다.

```bash
./docs/bin/harness-adopt plan \
  --target <repository> \
  --profile core,governance,view \
  --output <outside-target>/adoption-plan.json

./docs/bin/harness-adopt apply \
  --plan <outside-target>/adoption-plan.json \
  --expect-plan-hash <planHash>

./docs/bin/harness-adopt verify \
  --target <repository>

./docs/bin/harness-adopt rollback \
  --receipt <repository>/docs/receipts/harness-apply-<plan-prefix>.json
```

지원 profile은 `core`, `governance`, `view`입니다. `core`는 adoption/Execute entrypoint뿐 아니라 reusable project/task/design/guide/report/QA template, terminology surface, `new-doc.sh`, execution/closeout validator와 `close-doc.sh`를 함께 설치합니다. `governance`는 `core`를, `view`는 `core`와 `governance`를 자동으로 포함합니다. plan은 사용자가 고른 `requestedProfiles`와 dependency를 해석한 실제 설치 집합 `profiles`를 별도로 기록합니다. 따라서 `--profile view`는 읽을 수 있는 단독 View에 필요한 세 profile 전체를 설치합니다.

부분 profile은 단계적 bootstrap에는 사용할 수 있지만 `MIGRATION_VERIFIED` 완료 상태를 주장할 수 없습니다. release verification의 `requiredProfiles`와 `requiredInstalledPaths`가 모두 설치되고 검증된 경우에만 완료 판정을 허용합니다. release `document-harness-public-v1@1.1.0`은 이 dependency/verification closure와 schema, CLI/library, repository-local skill, reusable authoring core, versioned reference View bytes를 `docs/releases/document-harness-v1.json`에서 pin합니다.

### Status Contract

| Status | Meaning | Next Action |
| --- | --- | --- |
| `PLAN_READY` | deterministic plan이 apply 가능한 fence를 가짐 | exact `planHash`로 apply |
| `NEEDS_DECISION` | conflict, unsafe path, unknown repository/lock 또는 fence mismatch; target write 0 | source/ownership/authority를 사람이 해결하고 re-plan |
| `APPLY_FAILED` | apply 중 실패했고 receipt가 자동 rollback 결과를 분리 기록 | `rollback.result` 확인 후 원인 수정 |
| `INSTALLED_NOT_VERIFIED` | installation/release/governance audit finding이 있거나 governance 외 profile의 evidence gate가 미완료 | findings를 해결하고 evidence pack/required gates를 작성한 뒤 verify |
| `INSTALLED_AWAITING_REVIEW` | governance profile이 설치됐고 human review/decision evidence가 미완료 | source-fenced human decision receipt와 gate evidence 보완 |
| `MIGRATION_VERIFIED` | installed bytes/release fence, matching evidence pack, required gate evidence와 human review가 모두 확인됨 | adopted baseline으로 운영 |
| `ROLLED_BACK` | apply receipt의 mutation preimage가 역순으로 복원됨 | 필요하면 같은 fenced plan을 다시 apply |

post-apply file byte 또는 mode가 바뀌면 rollback은 강행하지 않고 `NEEDS_DECISION`, `writes: 0`을 반환합니다. rollback receipt의 exact mutation set은 active installation lock의 SHA-256 anchor와 일치해야 하며 subset receipt는 거부됩니다. rollback은 receipt에 기록된 file만 복원·제거하고 상위 directory는 삭제하지 않으므로 apply 전에 존재하던 빈 directory topology를 훼손하지 않습니다. 같은 성공 plan을 다시 apply하면 existing receipt와 installed mutations가 일치할 때 `alreadyApplied: true`, `writes: 0`입니다.

## Non-Negotiable Rules

- target repository의 dirty tracked/untracked change를 보존합니다.
- project-owned AGENTS, control-plane, design, project, task, report, product code/config/ops를 자동 overwrite하지 않습니다.
- 기존 numbered document를 일괄 재발급하거나 최신 schema로 자동 변환하지 않습니다.
- 높은 extraction confidence를 human approval 또는 effective policy로 표시하지 않습니다.
- code/config behavior는 observation 또는 enforcement evidence이며 policy authority가 아닙니다.
- candidate는 인간 결정 전 `approvalState: unreviewed`, `effectiveRef: null`, `decisionReceiptRef: null`을 유지합니다. 승인 receipt는 exact `effectiveRef`와 현재 artifact bytes의 `effectiveSha256`을 함께 고정합니다.
- initializer가 만든 empty governance catalog는 첫 extraction/review 변경 뒤 project-owned state로 보존합니다. 이후 upgrade는 그 bytes를 덮어쓰지 않고 `KEEP_PROJECT_OWNED`로 이관하며 schema/source/evidence 검증은 계속 적용합니다.
- initialize/migrate actor는 사용자용 View chrome과 synthesized governance/project wording을 `ko-KR`로 준비합니다. 기술 식별자와 provenance는 번역하지 않고 한국어 설명 옆의 보조 metadata로 표시합니다.
- 기존 영어 catalog를 한국어로 바꾸는 작업은 presentation-only migration입니다. stable ID, source ref/hash, authority, approval, enforcement, effective ref, receipt와 evidence freshness를 유지하며, 번역만으로 의미·범위·승인 상태를 바꾸지 않습니다. 의미 보존이 불확실하면 review attention을 남깁니다.
- 긴 ID, path와 hash는 자기 cell/card 안에서 줄바꿈되어야 하며 인접 제목·badge·column과 겹치지 않아야 합니다.
- `.env`, credential, token, private raw source와 secret value는 governance catalog/source body에 수집하지 않습니다. 안전한 authority source가 없으면 policy를 만들지 않고 gap/attention을 남깁니다.
- 모든 candidate source ref는 repository-relative path, heading/line, captured file SHA-256과 captured repository commit을 갖습니다.
- migration captured base는 실제 Git commit object로 resolve되어야 하며, source hash 변화는 candidate review/approval을 stale로 만듭니다. 현재 HEAD 이동만으로 unchanged source evidence를 stale 처리하지 않습니다.
- public harness와 같은 이름의 customized file은 baseline hash가 없으면 conflict입니다.
- dangling leaf symlink와 ancestor symlink는 missing path가 아니라 conflict입니다. plan/apply/rollback은 이를 따라가거나 atomic replace로 덮어쓰지 않습니다.
- apply는 plan의 `status`나 `attention`을 신뢰하지 않고 current target, installation lock, requested profile closure, release action으로 decision state를 다시 계산합니다.
- View runtime state는 cache 삭제 뒤 source에서 rebuild 가능해야 합니다. runtime은 state directory 안의 exact self-ignoring marker를 검증해 root `.gitignore`를 수정하지 않고도 Git working tree에 노출되지 않게 합니다.
- repo별 View는 독립 process이며 기본 `127.0.0.1` + OS-assigned port입니다.
- AI는 approved port envelope 안에서 exact port를 선택할 수 있지만 remote bind나 foreign process kill은 할 수 없습니다.
- document-harness workflow skill은 target repository 안에 설치합니다. user-global skill/config에 설치하거나 의존하지 않습니다.

## Initial Outputs

```text
<outside-target>/adoption-plan.json             # no-write plan and planHash
document-harness.yaml                            # generated repository profile
.agents/skills/operate-document-harness/        # canonical repository-local agent skill
.claude/skills/operate-document-harness/         # thin Claude project adapter
docs/_templates/{project,task,design,guide,report,qa}.md
docs/bin/new-doc.sh                               # clean-main numbered and unnumbered draft issuance
docs/bin/validate-execution-loop.sh               # task/checkpoint loop contract
docs/bin/validate-closeout.sh                     # project/task/QA completion contract
docs/bin/close-doc.sh                             # validation-gated project/task closeout
docs/design/ubiquitous-language.md                # project-owned terminology surface
docs/guide/                                       # reusable goal, project/task, QA, and quality guidance
docs/_indexes/harness-installation.yaml         # JSON installation/version/ownership lock
docs/_indexes/governance-catalog.json           # nested migration fence + candidate/gap projection
runtime/document-harness-view/                  # versioned harness-managed reference View
runtime/document-harness-view/config.json       # generated static repository identity
docs/receipts/harness-apply-<plan-prefix>.json  # preimages and apply result
docs/receipts/migration-evidence-pack.json      # gate/human-review completion evidence
.document-harness/runtime/view/                 # untracked lease/cache/probe
```

위 경로는 public v1 executable contract입니다. 다른 경로/runtime을 쓰는 downstream extension은 v1 installation lock과 release verification을 그대로 통과한다고 가정할 수 없으며 별도 profile과 acceptance가 필요합니다.

## Korean-First Initialization And Migration

새 repository와 mature repository에 동일한 human projection 품질을 적용합니다.

1. target의 exact source를 읽고 stable technical ID와 provenance fence를 먼저 고정합니다.
2. source-backed policy/guideline 후보를 작성하되 사람이 읽는 field만 한국어로 합성합니다.
3. View project description과 empty/gap/attention 문구를 한국어로 준비하고 canonical tab을 `개요`, `정책·지침`, `검토 대기`, `실행 상태`, `근거` 순서로 표시합니다.
4. 기존 영어 human-facing field는 stable ID와 모든 governance/evidence fence를 유지한 채 번역합니다. authority나 approval이 달라지는 변경은 localization과 분리합니다.
5. 긴 technical ID/source ref가 자기 container 안에서 줄바꿈되고 adjacent content와 겹치지 않는지 desktop와 narrow viewport에서 확인합니다.
6. 새 snapshot을 생성한 뒤 source freshness, project-owned catalog 보존과 human review barrier를 다시 검증합니다.

## Project Skill Bootstrap

- new repository initialize와 mature repository migrate/upgrade plan은 canonical `.agents/skills/operate-document-harness/SKILL.md`와 thin `.claude/skills/operate-document-harness/SKILL.md` adapter를 target-owned installation set에 포함합니다.
- canonical skill은 요청을 `ADOPT`, `EXECUTE`, policy extraction, View guide로 route할 뿐 policy·approval·migration authority를 만들지 않습니다.
- Claude adapter는 canonical skill을 읽도록 위임하며 별도 규칙 집합을 복제하지 않습니다.
- skill이 현재 agent session 중 처음 설치되면 그 session은 canonical file을 직접 읽어 계속합니다. 자동 discovery에 의존하기 전에는 새 session을 시작하거나 repository를 reload합니다.
- `$HOME` 또는 다른 user-global location은 plan/apply의 write surface가 아닙니다.

## Start Gate

Before writing, answer:

- What is the target repository revision and dirty state?
- Is this initialize, mature migration, or versioned upgrade?
- Which files are project-owned and therefore protected?
- Which public profiles are requested: core, governance, view?
- Which dependency-expanded profiles will actually be installed, and is this a partial bootstrap or a verification-complete adoption?
- What plan hash and source revision fence will apply authorize?
- Which policy candidates need human review before they can become effective?
- Are both repository-local skill paths included without a user-global install action?
- Are synthesized human-facing fields Korean while IDs, enums, paths, hashes, commands, and exact source headings remain unchanged?
- Do long IDs and source refs stay inside their own View cell/card without overlapping adjacent content?
- What commands prove the target application is unchanged or recoverable?

Missing answers produce a no-write plan or human attention, not guessed defaults.

## Verification

Public release source에서는 `./tests/adoption/run-all.sh`로 initializer, fixture, Reference View browser/runtime과 public validator 전체를 검증합니다. fresh checkout의 pinned browser bootstrap은 `tests/adoption/README.md`를 따릅니다. gate 실행 자체는 package/browser를 설치하거나 network를 사용하지 않으며, 누락된 전제는 skip하지 않고 실패합니다. 성공한 public distribution은 `PLAN_READY`와 `releaseAcceptance: passed`를 반환하며 특정 target migration을 `MIGRATION_VERIFIED`라고 주장하지 않습니다. 이 public release 전용 validator/test tree는 adopted target에 복사하지 않습니다.

Adopted target에서는 모든 profile에 설치되는 authoring/execution/closeout checks와 release verification을 먼저 실행합니다.

```bash
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
./docs/bin/harness-adopt verify --target .
git diff --check
```

`view` profile이 설치된 경우에만 repository-specific quality command와 다음 View checks를 실행하고 structured gate receipt로 고정합니다.

```bash
./runtime/document-harness-view/bin/human-view doctor
./runtime/document-harness-view/bin/human-view test
./runtime/document-harness-view/bin/human-view snapshot
```

`verify`는 installed file hash/mode, public release fence와 governance catalog source refs를 먼저 검사합니다. code/config observation 승격, private/secret source path, changed/missing source hash, unresolved approved conflict는 finding입니다. `MIGRATION_VERIFIED`는 matching installation receipt, release/target fence, SHA-256으로 pin된 structured gate evidence, `allRequiredGatesPassed: true`, `humanReviewComplete: true`, `migration.status: reviewed`와 source-fenced catalog/candidate human decision receipts가 모두 있어야 반환합니다. 단순히 View가 fresh이거나 apply가 성공했다는 사실은 verification이 아닙니다.

## References

- `docs/design/harness-adoption-plane.md`
- `docs/guide/repository-policy-extraction.md`
- `docs/design/policy-to-evidence-governance.md`
- `docs/design/human-control-view-plane.md`
- `docs/EXECUTE.md`

## Change Log

- 2026-07-15: new/mature/versioned adoption routing, ownership-aware plan/apply, policy extraction과 repo-local View handoff를 reusable entrypoint로 추가했다.
- 2026-07-16: canonical project skill과 thin Claude adapter를 repository별 initialize/migrate output으로 추가하고 global install을 금지했다.
- 2026-07-16: executable `plan|apply|verify|rollback`, exact status model, versioned reference View, nested governance migration fence와 fail-closed verification 절차를 v1 entrypoint에 정렬했다.
- 2026-07-17: fresh full-profile target가 public 개발 tree에 의존하지 않고 문서를 발급·검증·종료할 수 있도록 reusable authoring core와 실제 실행 E2E를 release closure에 추가했다.
- 2026-07-17: 한국어 우선 initialization/migration, technical provenance 원형 보존과 긴 ID containment gate를 추가했다.
