---
type: architecture
title: harness-adoption-plane
status: current
domain: harness-adoption
owner:
created: 2026-07-15
updated: 2026-07-17
retrieval_class:
  - domain-current
context:
  default_load: false
  section_load: false
  evidence_only: false
  size_tier: medium
referenced_by:
  - docs/ADOPT.md
  - docs/guide/repository-policy-extraction.md
source_refs:
  - docs/releases/document-harness-v1.json
  - docs/governance/policy-to-evidence.md
  - docs/architecture/human-control-view-plane.md
  - docs/architecture/execution-loop-plane.md
  - https://developers.openai.com/codex/skills/
  - https://code.claude.com/docs/en/skills
tags:
  - docs/architecture
  - adoption
  - migration
  - governance
---

# harness-adoption-plane

## Purpose

이 문서는 document-harness를 새 repository와 mature repository에 설치·migration·upgrade할 때 source ownership, executable plan/apply/verify/rollback fence, policy extraction, versioned repo-local View와 continuous quality를 안전하게 연결하는 public v1 contract입니다.

## Authority Boundary

- target repository의 human/repository instruction과 current product design이 target truth를 소유합니다.
- public harness는 reusable schema, invariant, template, validator를 제공합니다.
- initializer/migrator는 truth를 새로 만들지 않고 plan과 conflict를 생성합니다.
- governance extraction은 candidate를 만들지만 승인하지 않습니다.
- View는 source와 catalog의 derived projection이며 migration plan이나 approval을 실행하지 않습니다.

## Repository Classification

| State | Detection | Required Mode |
| --- | --- | --- |
| empty/new | relevant harness surface 없음 | `initialize` |
| mature/custom | AGENTS, docs schema, templates, validators, numbered docs 중 하나 이상 존재 | `migrate` |
| installed | installation lock과 baseline hash 존재 | `upgrade` |
| unknown | instruction/revision/dirty state를 안전하게 판정할 수 없음 | `stopped / attention` |

mode detection 결과는 plan에 포함합니다. `migrate`를 `initialize`로 조용히 downgrade하지 않습니다.

## Ownership Model

| Ownership | Owner | Automatic Action |
| --- | --- | --- |
| `harness-managed` | installed public harness revision | baseline이 unmodified일 때 update 가능 |
| `project-owned` | target repository/human | keep; automatic overwrite forbidden |
| `generated` | declared source + generator | source fence가 맞을 때 rebuild |
| `runtime-local` | local process | untracked create/delete only |

installation lock은 file path, ownership, upstream baseline hash, installed hash, apply 대상 source revision과 migration generation을 기록합니다. `targetSourceRevision`은 이번 initialize/migrate/upgrade plan과 quality gate가 실제로 검사한 target HEAD입니다.

baseline이 없는 same-name file은 modified 여부를 추측할 수 없으므로 `project-owned` 또는 `CONFLICT`로 처리합니다.

신규 설치는 concrete `docs/design/domain-landscape.md`, `docs/design/context-map.md` 또는 `BC-DISCOVERY` 모델을 생성하지 않습니다. 설치 책임은 DDD template·validator·projection contract 제공까지이며, domain truth authoring은 별도의 source-backed DDD workflow 책임입니다. 이전 release lock에만 존재하는 project-owned discovery placeholder는 upgrade inventory에서 허용하되 삭제하거나 현재 모델로 간주하지 않습니다.

`project-owned` 보존은 현재 authoring 계약의 검증 면제가 아닙니다. upgrade 뒤 verify는 `new-doc.sh`, Project/Task template, closeout validator가 Initiative 발급 승인과 Policy/Guideline → Initiative → Project → Task lineage를 의미적으로 구현하는지 검사합니다. exact upstream byte가 아니라 stable field, placeholder, validator/call token을 검사하며, 구형 umbrella-only 계약이면 `LEGACY_GOVERNANCE_AUTHORING_CONTRACT`와 빠진 capability를 반환해 수동 병합 전에는 완료 상태로 올라가지 못하게 합니다.

## Plan And Apply Contract

public v1 command surface:

```bash
./docs/bin/harness-adopt plan --target <repository> --profile core,governance,view --output <outside-target>/adoption-plan.json
./docs/bin/harness-adopt apply --plan <outside-target>/adoption-plan.json --expect-plan-hash <planHash>
./docs/bin/harness-adopt verify --target <repository>
./docs/bin/harness-adopt rollback --receipt <repository>/docs/receipts/harness-apply-<plan-prefix>.json
```

### Plan

- default action은 no-write입니다.
- plan JSON 자체도 target 밖에 기록합니다. target 안의 output은 `PLAN_OUTPUT_IN_TARGET`과 `NEEDS_DECISION`으로 거부합니다.
- target revision, dirty status, inventory hash, public harness revision과 selected profile을 pin합니다.
- `requestedProfiles`에는 사용자가 고른 profile만, `profiles`에는 dependency-expanded installation set을 기록합니다. `governance -> core`, `view -> core + governance`를 release manifest가 고정합니다.
- partial bootstrap은 허용하지만 release `verification.requiredProfiles`와 `requiredInstalledPaths`가 완전하지 않으면 `MIGRATION_VERIFIED`로 승격하지 않습니다.
- governance profile에서는 승인·효력 상태인 정책 또는 지침의 `effectiveRef`와 `sourceRefs[].path`를 현재 catalog에서 읽어 release action과 대조합니다. `ADD|UPDATE_UNMODIFIED`가 해당 path의 bytes를 실제로 바꾸면 `APPROVED_GOVERNANCE_SOURCE_MUTATION`으로 fail closed 하며, before/after SHA-256이 같은 mode-only repair는 허용합니다.
- 같은 input은 같은 ordered action set과 plan hash를 만듭니다.
- target source byte, Git index, runtime service와 `$HOME`을 변경하지 않습니다.

### Actions

```text
ADD
UPDATE_UNMODIFIED
KEEP_PROJECT_OWNED
CONFLICT
GRANDFATHER
DEFER
REMOVE_GENERATED
```

각 action은 path, ownership, before hash, expected after hash, reason, rollback action을 가집니다.

### Apply

- exact plan hash, target revision/dirty fence와 public source revision을 다시 확인합니다.
- plan의 mode/status/attention은 authority가 아닙니다. apply는 current repository state, requested profile dependency closure, installation lock과 release actions에서 security-relevant decision state를 다시 계산하고 self-rehashed mismatch를 거부합니다.
- fence mismatch면 0 write로 실패합니다.
- `CONFLICT`와 unresolved human decision이 있으면 affected action을 실행하지 않습니다.
- dangling leaf/ancestor symlink는 lstat 기반 conflict이며 write target이나 parent로 따라가지 않습니다.
- atomic file replace 또는 reversible copy를 사용하고 apply receipt를 남깁니다.
- partial failure는 applied action과 rollback result를 구분해 기록합니다.
- 같은 plan을 두 번 apply하면 no-op 또는 이미 적용됨을 반환합니다.

### Verify And Rollback

- verify는 installation lock의 file hash/mode, installed release fence와 unresolved placeholder, 개인 절대경로, user-global skill path를 fail-closed 검사합니다.
- `MIGRATION_VERIFIED`는 matching migration evidence pack, apply receipt, hash-pinned structured required gate evidence와 completed human review가 모두 있을 때만 반환합니다.
- governance profile은 source-fenced human decision receipt가 없으면 `INSTALLED_AWAITING_REVIEW`에 머뭅니다.
- governance audit finding이 있으면 `INSTALLED_AWAITING_REVIEW`로 완화하지 않고 `INSTALLED_NOT_VERIFIED`입니다. observation 승격, private/secret source, stale/invalid source ref와 approved unresolved conflict는 finding입니다.
- rollback은 active installation lock이 SHA-256으로 anchor한 exact apply mutation set과 successful receipt가 일치하고 각 mutation byte/mode가 그대로일 때만 file preimage를 역순 복원합니다. anchor는 lock mutation의 self-referential after hash만 제외하고 lock preimage와 나머지 mutation descriptor 전체를 포함합니다. receipt에 없는 directory 소유권은 추론하지 않으며, added file 제거 뒤 빈 상위 directory를 자동 삭제하지 않습니다. post-apply drift, subset receipt, anchor 없는 legacy receipt는 `NEEDS_DECISION`, 0 write입니다. legacy v1 lock은 upgrade 입력으로 읽을 수 있지만 새 anchored apply 전에는 rollback authority가 없습니다.

## Lifecycle Status Model

```text
PLAN_READY
NEEDS_DECISION
APPLY_FAILED
INSTALLED_NOT_VERIFIED
INSTALLED_AWAITING_REVIEW
MIGRATION_VERIFIED
ROLLED_BACK
```

- plan은 `PLAN_READY|NEEDS_DECISION`만 반환합니다.
- apply success는 governance profile이면 `INSTALLED_AWAITING_REVIEW`, 아니면 `INSTALLED_NOT_VERIFIED`입니다. partial failure는 `APPLY_FAILED`와 automatic rollback result를 함께 기록합니다.
- verify는 installed content/governance findings와 evidence에 따라 `INSTALLED_NOT_VERIFIED|INSTALLED_AWAITING_REVIEW|MIGRATION_VERIFIED`를 반환합니다.
- rollback conflict는 `NEEDS_DECISION`; 완전 복원만 `ROLLED_BACK`입니다.

## Mature Repository Preservation

- existing project/task/report ID, status, append-only history를 보존합니다.
- legacy vocabulary는 current truth를 깨지 않는 범위에서 grandfather warning으로 남깁니다.
- 새 execution/governance schema는 새 task 또는 explicitly migrated active task부터 opt-in합니다.
- target AGENTS/control-plane/template/validator에 public 최신본을 wholesale copy하지 않습니다.
- project-specific verification fixture, threshold와 runner를 reusable harness default로 교체하지 않습니다.
- application deploy/sync와 harness migration을 같은 apply action에 섞지 않습니다.

## Governance Extraction Handoff

migration apply는 `docs/_indexes/governance-catalog.json`에 nested captured repository fence, 정책과 추진안 각각의 explicit review attention/extraction gap을 초기화합니다. v1 CLI는 policy 또는 initiative wording을 발명하거나 code를 policy로 승격하지 않습니다. repository-local skill이 direct source를 읽어 schema-valid policy/guideline candidate를 채운 뒤 initiative bootstrap을 수행하는 별도 derived step을 맡습니다.

필수 독립 축:

```text
provenance
authority_class
extraction_confidence
candidate_state
approval_state
enforcement
conflicts
effective_ref
```

catalog migration fence는 `migration.capturedRepository.baseCommit`과 `workingTreeState`를 사용합니다. `baseCommit`은 target에서 resolve 가능한 full Git commit이어야 합니다. 각 source ref는 repository-relative `path`, `heading`, `lineStart`, `lineEnd`, `capturedSha256`, `capturedRepositoryRevision`을 가집니다.

catalog의 `baseCommit`은 정책·지침을 추출한 역사적 기준이고 installation lock의 `targetSourceRevision`은 현재 설치·업그레이드와 quality gate의 기준입니다. 이후 HEAD에서 harness를 upgrade해도 두 revision을 같다고 강제하지 않습니다. human policy decision은 catalog base와 source hash에, gate evidence와 migration evidence pack은 installation lock의 현재 target revision에 각각 묶습니다. 이 분리는 unchanged source evidence를 단순 HEAD 이동만으로 stale 처리하지 않으면서 새 release gate의 provenance를 유지합니다.

code/config observation과 retrieval authority metadata는 human policy approval이 아닙니다. schema는 `code_observation|config_observation`을 `kind: observation`, `approvalState: unreviewed`, `effectiveRef: null`, `decisionReceiptRef: null`로 제한합니다. 승인 receipt는 exact `effectiveRef`와 `effectiveSha256`을 함께 고정하며 adoption verification은 현재 effective artifact bytes가 그 digest와 일치하는지 확인합니다. source hash나 effective bytes가 바뀌면 candidate review/approval은 stale입니다. 현재 HEAD가 captured base보다 이동했다는 사실만으로 unchanged per-source evidence를 stale 처리하지 않습니다.

`.env`, credential, token, private raw source와 secret value는 candidate catalog에 수집하지 않습니다. 안전한 source-backed statement가 없으면 `gaps`와 attention을 생성하며 policy를 추측하지 않습니다.

사람이 읽는 projection의 기본 언어는 configured `presentation.locale`입니다. extraction actor는 `direction`, `title`, `humanSummary`, `why`, `scope`, `risk`, attention/gap 문구, `approvalRule`, source-reference `note`와 자유 서술 `evidenceKind` label을 사용자 표시 언어로 합성합니다. policy/guideline/attention ID, enum, path, hash, command, exact source heading과 quote는 원형을 보존합니다. 기존 영어 catalog의 localization은 stable ID, source/effective/decision ref와 hash, authority, approval, enforcement를 그대로 둔 presentation-only migration이며, 번역만으로 후보의 의미나 상태를 승격하지 않습니다.

세부 절차는 `docs/guide/repository-policy-extraction.md`가 소유합니다.

### Mature Repository Initiative Bootstrap

정책·지침 후보를 분리한 다음 기존 project/design/roadmap/task에서 여러 delivery를 하나의 outcome으로 묶는 근거를 찾습니다. 초기화 결과는 다음 둘 중 하나를 반드시 가져야 합니다.

```text
source-backed INIT-* migration candidate
OR
ATTN-INITIATIVE-EXTRACTION + GAP-INITIATIVE-EXTRACTION
```

`INIT-*` candidate는 다음 migration fence를 만족합니다.

- `lifecycleState: draft`이며 검토 중인 후보는 `approvalState: unreviewed|review_requested`입니다. rejected/stale/superseded 후보만 남았다면 새 gap/attention이 필요합니다.
- `documentRef`, `effectiveRef`, `decisionReceiptRef`는 `null`입니다.
- 하나 이상의 existing `P####`를 `legacyProjectRefs`로 연결합니다.
- 하나 이상의 policy를 exact `policyRelationships`로 연결하고, 적용할 guideline은 exact `guidelineRelationships`로 연결합니다.
- outcome, why now, current focus, success signals, risks와 source revision/hash/line을 기록합니다.
- candidate가 있다는 사실은 `I####` 발급, activation 또는 approval이 아닙니다.

근거가 부족하거나 portfolio 경계가 충돌하면 AI는 빈 register를 완료처럼 두지 않고 initiative gap과 decision attention을 함께 유지합니다. 둘 중 하나가 누락되거나, candidate가 auto-approved·source-stale·private-source·broken-lineage 상태면 adoption verify는 finding을 반환합니다. 후보와 gap은 일부 portfolio만 분류된 상태를 정직하게 표현하기 위해 함께 존재할 수 있습니다.

## Repo-Local View Instance Contract

각 adopted repository는 독립 View instance를 가집니다. 사용자에게 보이는 이름은 `presentation.displayName`이고 기본값은 `Board`입니다. 기술 executable은 호환성을 위해 `human-view`를 유지합니다. top bar 왼쪽의 `<displayName> / <repository>`는 모든 tab과 scroll 위치에서 유지됩니다.

human-owned envelope 예시:

```yaml
view:
  enabled: true
  bind_host: 127.0.0.1
  port_mode: auto
  presentation:
    profile: single-repository-top-tabs-v3
    display_name: Board
    locale: en-US
    sort_locale: en
    tabs:
      overview: Overview
      policies: Policies
      guidelines: Guidelines
      initiatives: Initiatives
      review: Review
      execution: Execution
      evidence: Evidence
    repository_identity: static
    repository_selector: false
    sidebar: false
  capabilities:
    read: true
    write: false
    execution: false
    approval: false
```

`port_mode: auto`는 AI가 exact port를 재질문하지 않고 `127.0.0.1:0`에 bind해 OS가 선택하도록 위임합니다.

- port scan 후 bind하지 않습니다.
- fixed port collision은 fail하고 foreign process를 kill하지 않습니다.
- actual bound port와 repo identity를 untracked runtime receipt에 atomic publish합니다.
- stop은 repo fingerprint, instance, PID/start identity와 live health가 일치할 때만 허용합니다.
- remote bind, privileged port, browser external exposure는 separate human decision입니다.
- static repository identity는 runtime이 시작된 target repository에서만 계산하며 selector나 workspace switcher를 제공하지 않습니다.
- page shell은 left sidebar 없이 `overview`, `domain`, `policies`, `guidelines`, `initiatives`, `review`, `execution`, `evidence`의 exact eight horizontal tab keys를 사용합니다. 사용자 label은 `presentation.tabLabels`에서 읽고 기본값은 `Overview`, `Domain`, `Policies`, `Guidelines`, `Initiatives`, `Review`, `Execution`, `Evidence`입니다.
- 정책과 지침은 서로 연결되지만 독립된 first-class tab입니다. 정책 detail은 관련 지침을, 지침 detail은 관련 정책을 보여주고 각 tab의 search/filter/pagination/expanded state를 따로 유지합니다.
- 모든 tab은 같은 snapshot/read fence를 공유하고 polling/manual refresh 뒤 active tab, tab별 filter/search/pagination과 expanded item을 유지합니다.
- UI asset은 same-origin local file로 제공하며 external CDN, remote font와 third-party runtime fetch를 사용하지 않습니다.

`view` profile은 `runtime/document-harness-view/`의 versioned, harness-managed reference distribution과 repository-specific generated `config.json`을 함께 설치합니다. adopter가 HTML/CSS/interaction을 매번 다시 생성하지 않습니다. reference runtime은 Node built-in module만 사용하고 persistent DB 없이 `.document-harness/runtime/view/`에 rebuildable runtime-local state를 둡니다. controller는 `doctor|refresh|start|status|url|stop|test`, exact loopback auto-port, lease/health identity safe-stop과 ETag polling을 제공합니다.

View runtime upgrade가 새 필수 config field를 도입하면 known-safe legacy shape에 한해서 누락 field만 additive migration하고, 기존 project identity·probe·quality command·extension 값은 보존합니다. 이 mutation은 preimage-fenced rollback 대상이며, config JSON 또는 legacy shape를 안전하게 판정할 수 없으면 runtime만 먼저 교체하지 않고 plan을 `CONFLICT`로 중단합니다.

View runtime은 `docs/architecture/human-control-view-plane.md`의 source/snapshot/freshness/security 계약을 유지합니다. alternate downstream runtime은 같은 release artifact로 간주하지 않으며 별도 profile, installation baseline과 acceptance evidence가 필요합니다.

## Initializing Human-Readable Data

mature repository의 첫 View는 silent empty dashboard가 아니어야 합니다. apply 직후 아직 source extraction이 없다면 generated catalog의 정책 extraction gap/attention과 `ATTN-INITIATIVE-EXTRACTION`/`GAP-INITIATIVE-EXTRACTION`, migration fence, repository identity와 execution not-configured state를 사용자 표시 언어 human summary와 함께 명시합니다. repository-local AI extraction이 끝난 뒤에는 정책·지침과 source-backed `INIT-*` 후보 또는 계속 유효한 initiative gap을 projection하며, 이 단계 전에는 `MIGRATION_VERIFIED`를 선언하지 않습니다.

첫 source-linked 변경 뒤 governance catalog는 project-owned state입니다. upgrade planner는 이를 release template으로 덮어쓰지 않고 `KEEP_PROJECT_OWNED`로 보존하며, installation lock의 ownership/baseline을 갱신합니다. 보존은 검증 면제가 아니므로 catalog schema, source freshness, secret exclusion과 human decision/evidence barrier는 계속 fail closed로 검사합니다. catalog가 승인·효력 상태로 가리키는 release-managed source/effective artifact의 bytes도 묵시적으로 갱신하지 않습니다. plan과 apply가 같은 decision evaluator에서 mutation attention을 재계산하므로 plan JSON의 status/attention을 바꿔도 이 경계를 우회할 수 없습니다.

1. repository identity, revision, dirty state와 migration status
2. 사람이 이해하는 product direction
3. source-linked policy candidates
4. related implementation guidelines
5. source-backed initiative migration candidate 또는 부족한 source/decision을 설명하는 initiative gap
6. approval state와 effective source ref
7. code/config enforcement와 last verification
8. conflict, missing decision, known risk attention
9. project fast/full/continuous quality status

이 data는 첫 snapshot의 exact read fence에서 함께 publish하고 다음 tab으로 배치합니다. 사람이 읽는 project description과 derived wording은 configured `presentation.locale`이 기본이며, 긴 stable ID는 각 cell/card 안에서 줄바꿈되는 보조 metadata로 표시해 제목과 겹치지 않게 합니다.

- `개요`: repository direction, summary count, current attention과 freshness
- `정책`: policy candidate, authority, approval, enforcement, related guideline summary와 provenance
- `지침`: guideline candidate, linked policy, authority, approval, enforcement와 provenance
- `검토 대기`: conflict, missing decision, stale approval와 사람이 판단할 action
- `실행 상태`: task/checkpoint/loop/quality 상태 또는 명시적인 not-configured gap
- `근거`: source, validator, decision/approval와 handoff receipt

Markdown 전체를 rendering하지 않습니다. source content는 allowlisted structured field로 요약하고 exact path/line/hash를 drill-down provenance로 제공합니다.

## Continuous Quality Handoff

target repository가 소유하는 trusted executable entrypoint를 연결합니다.

```text
fast        bounded change/checkpoint 전
full        succeeded/closeout 전
continuous scheduled 또는 quality-sensitive change
```

runtime unavailable은 `pass`가 아니라 `blocked/not_run`입니다. gate, fixture, threshold 완화는 implementation actor가 자기 승인할 수 없습니다. View는 receipt verdict를 projection할 뿐 verdict를 만들지 않습니다.

## AI Instruction Packaging

각 target repository의 installation set은 다음을 포함합니다.

- target root AGENTS: adoption/execute/view entrypoint와 stop rule
- `.agents/skills/operate-document-harness/SKILL.md`: Codex와 Agent Skills 호환 도구가 발견하는 canonical project workflow router
- `.agents/skills/operate-document-harness/agents/openai.yaml`: Codex UI metadata
- `.claude/skills/operate-document-harness/SKILL.md`: canonical project skill을 읽는 thin Claude adapter
- `docs/ADOPT.md`: initialize/migrate orchestration
- `docs/EXECUTE.md`: adopted task execution
- reusable project/task/design/guide/report/QA와 execution-checkpoint template
- project-owned terminology surface와 goal/project/QA/quality operation guide
- `new-doc.sh`, execution/closeout validator와 validation-gated `close-doc.sh`
- governance와 View static/runtime validators

skill은 detailed rule을 복제하지 않고 intent를 repository의 durable entrypoint로 route합니다. AGENTS, human policy, effective design, approval receipt와 validator가 authority를 계속 소유합니다.

document-harness workflow는 user-global skill로 설치하지 않습니다. repository별 customization, policy scope, verification command와 View runtime identity가 다르기 때문에 canonical skill과 tool adapter를 해당 repository 안에 version-control 가능한 project surface로 둡니다.

bootstrap session에서 skill을 새로 추가한 경우 현재 agent는 file을 직접 읽고 workflow를 계속합니다. 자동 discovery는 새 session 또는 repository reload 뒤 기대합니다.

## Acceptance Scenarios

| ID | Scenario | Expected |
| --- | --- | --- |
| ADOPT-01 | new repo plan | selected profile의 add만 제시, target write 0 |
| ADOPT-02 | mature repo detection | initialize가 아니라 migrate plan |
| ADOPT-03 | fresh full-profile authoring | clean main에서 project/task/QA 발급 후 design/guide/report 생성, installed execution/closeout validator 통과, public development-only tree 의존 0 |
| MIG-01 | customized same-name file | overwrite 0, conflict/project-owned |
| MIG-02 | dirty repo | tracked/untracked bytes 보존 |
| MIG-03 | second apply | no-op 또는 same unresolved conflict |
| MIG-04 | target/public fence changed | apply write 0, `NEEDS_DECISION` |
| MIG-05 | partial apply failure | preimage auto-restore와 `APPLY_FAILED` receipt |
| MIG-06 | rollback after target edit | overwrite 0, `NEEDS_DECISION` |
| MIG-07 | dangling leaf/ancestor symlink | overwrite 0, explicit conflict |
| MIG-08 | self-rehashed status/attention bypass | recomputed decision mismatch, write 0 |
| MIG-09 | subset apply receipt rollback | lock anchor mismatch, write 0 |
| GOV-01 | code observation | policy approval로 표시하지 않음 |
| GOV-02 | source change | candidate/approval stale |
| GOV-03 | no safe authority source | invented policy 0, explicit gap/attention |
| GOV-04 | captured migration base invalid | View degraded attention; source hash freshness와 별도 표시 |
| GOV-05 | current HEAD moved only | migration fence relation 표시, unchanged source evidence fresh |
| GOV-06 | mature initiative extraction | source-backed unapproved `INIT-*` candidate, valid numbered `I####`, 또는 explicit initiative gap/attention |
| GOV-07 | initiative candidate authority | AI self-approval 0, exact source/legacy project/policy-guideline relation fence |
| GOV-08 | project-owned legacy authoring | customized bytes 보존, repo-local skill·ADOPT/EXECUTE, source-fenced activation validator, modern Initiative issuance/Project/Task/closeout lineage 의미 계약 누락 시 fail closed |
| GOV-09 | approved governance release reference | source/effective bytes 변경은 `NEEDS_DECISION`·write 0, mode-only repair와 catalog 보존은 허용 |
| GOV-10 | numbered Initiative tamper | `I####` schema, relationship, canonical document, lifecycle, effective/decision receipt, committed source fence 불일치 시 fail closed |
| VIEW-01 | two repositories | distinct OS ports와 repo fingerprints |
| VIEW-02 | foreign PID | stop/kill 0 |
| VIEW-03 | source/cache | cache 삭제 뒤 rebuild |
| VIEW-04 | single-repository shell | `<displayName> / <repository>` configurable chrome, selector/sidebar 0, exact seven top tabs |
| VIEW-05 | refresh while reading | same snapshot fence and tab/filter/search/expansion continuity |
| VIEW-06 | asset isolation | external CDN/font/script request 0 |
| VIEW-07 | Locale-configured initialization | chrome, project description와 synthesized governance wording은 configured `presentation.locale`; technical/source value는 원형 |
| VIEW-08 | long technical metadata | 긴 ID/path/hash가 자기 container 안에서 줄바꿈되고 adjacent content와 겹치지 않음 |
| VIEW-09 | independent governance tabs | 정책/지침 각각 독립 search/filter/pagination/detail, related refs 양방향 연결 |
| QUAL-01 | runtime unavailable | blocked/not_run, never pass |
| SKILL-01 | initialize or migrate | canonical project skill과 thin Claude adapter 설치 |
| SKILL-02 | plan/apply inventory | user-global document-harness skill/config write 0 |
| SKILL-03 | bootstrap session | direct-read 후 진행, reload 전 auto-discovery 가정 0 |
| VERIFY-01 | apply succeeded, evidence missing | `INSTALLED_NOT_VERIFIED` 또는 `INSTALLED_AWAITING_REVIEW`, never verified |
| VERIFY-02 | matching gates and human decisions | `MIGRATION_VERIFIED` |

## Decisions

- mature repository adoption은 initialization과 다른 migration mode입니다.
- file ownership과 installed baseline hash 없이 same-name file을 자동 update하지 않습니다.
- plan is default, apply requires exact fence, and repeat apply is idempotent.
- governance extraction은 high-confidence candidate도 human approval로 승격하지 않습니다.
- repo-local View는 independent loopback process와 OS-assigned port를 기본으로 합니다.
- repo-local View presentation은 `single-repository-top-tabs-v3`로 고정하고 repository selector와 left sidebar를 두지 않습니다.
- 사용자용 View 이름은 `presentation.displayName`이며 기본값은 `Board`입니다. 기술 command/path의 `human-view` 호환성을 유지합니다.
- application deploy와 harness migration은 별도 failure/rollback boundary입니다.
- document-harness operation skill은 repository-local canonical surface와 thin tool adapter로 함께 설치합니다.
- project skill은 router이며 repository instructions, human authority 또는 deterministic enforcement를 대체하지 않습니다.
- user-global document-harness skill/config는 adoption surface가 아닙니다.
- public v1 initializer는 Node-based repository-local executable이며 release manifest가 CLI/library/schema, reusable authoring core와 reference View byte set을 pin합니다.
- reference View distribution은 public repo에 versioned `harness-managed` surface로 vendor하며 project identity/config만 generator가 만듭니다.
- governance initialization은 nested migration fence와 explicit extraction gap을 만들고 policy wording은 source-backed extraction에서만 추가합니다.
- mature initiative bootstrap은 source-backed `INIT-*` candidate 또는 paired gap/attention을 요구하며 AI가 `I####` issuance/activation/approval을 추론하지 못하게 합니다.
- human-facing initialization/migration은 configured `presentation.locale`이 기본이며 localization은 stable ID, authority, approval와 evidence fence를 바꾸지 않습니다.

## Open Questions

- signed release manifest와 distribution trust profile
- approval receipt의 human identity/signature profile
- installation lock의 supported version compatibility window
- alternate runtime/profile interoperability와 compatibility declaration

## References

- `docs/governance/policy-to-evidence.md`
- `docs/governance/initiative-governance.md`
- `docs/architecture/human-control-view-plane.md`
- `docs/architecture/execution-loop-plane.md`
- [Codex Skills](https://developers.openai.com/codex/skills/)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)

## Change Log

- 2026-07-15: initialize/migrate/upgrade 분리, ownership-aware plan/apply, governance extraction, repo-local View auto-port와 continuous quality handoff 계약을 생성했다.
- 2026-07-16: repository-local `operate-document-harness` canonical skill, thin Claude adapter, bootstrap reload와 no-global-install contract를 추가했다.
- 2026-07-16: adopted repository별 static identity, exact five top tabs, single snapshot fence와 refresh-stable local asset profile을 추가했다.
- 2026-07-16: Node executable initializer v1, seven lifecycle statuses, lifecycle schemas/release manifest, nested governance migration fence, fail-closed verification/rollback과 versioned reference View distribution을 current contract로 고정했다.
- 2026-07-17: fresh full-profile target가 public 개발 tree 없이 문서를 실제 발급·검증·종료할 수 있도록 reusable authoring core와 end-to-end acceptance를 release closure에 포함했다.
- 2026-07-17: configured `presentation.locale` initialization/migration, technical provenance 원형 보존과 long-ID containment acceptance를 추가했다.
- 2026-07-17: `Board` displayName 기반 사용자명과 정책/지침 독립 최상위 tab 계약을 adoption profile에 반영했다.
- 2026-07-18: mature repository의 정책·지침 추출 뒤 unapproved `INIT-*` candidate 또는 explicit initiative extraction gap/attention을 요구하는 bootstrap/verification 계약을 추가했다.
- 2026-07-18: project-owned authoring surface를 byte overwrite 없이 보존하되 modern Initiative lineage 의미 계약 누락은 verify finding으로 차단하도록 했다.
- 2026-07-18: 승인·효력 상태인 governance source/effective path의 release byte 변경을 plan/apply 양쪽에서 fail closed 하고 mode-only repair와 catalog 보존을 허용하는 upgrade fence를 추가했다.
- 2026-07-18: numbered `I####` register와 project-owned AGENTS/CLAUDE governance entrypoint도 adoption verify가 의미·근거 기준으로 감사하도록 확장했다.
