---
type: design
title: ubiquitous-language
status: current
domain: ubiquitous-language
owner:
created: 2026-04-10
updated: 2026-07-17
retrieval_class:
  - term-excerpt
context:
  default_load: false
  section_load: true
  evidence_only: false
  size_tier: small
referenced_by:
  - docs/README.md
  - docs/design/control-plane.md
related_task:
  - docs/tasks/T0001-retrieval-plane-baseline.md
source_refs: []
tags:
  - docs/design
  - ubiquitous-language
---

# ubiquitous-language

- Type: design
- Domain: ubiquitous-language
- Owner:
- Created: 2026-04-10
- Updated: 2026-07-17
- Referenced By:
  - `docs/README.md`
  - `docs/design/control-plane.md`

## Purpose

이 문서는 현재 프로젝트에서 같은 대상을 같은 말로 부르기 위한 canonical term 기준입니다.

새로운 `design` 문서가 추가되거나 기존 설계에서 핵심 개념, 상태, 경계가 바뀌면 같은 변경 셋에서 이 문서도 함께 갱신합니다.

placeholder 대신 채워진 예시가 필요하면 `docs/examples/README.md`를 먼저 봅니다.

이 문서는 `docs/design/control-plane.md`와 함께 whole-system control surface를 이룹니다.

## Retrieval Rule

- 이 문서는 canonical term registry입니다.
- 일반 task/project execution에서 full document를 기본 로딩하지 않습니다.
- 용어 판단이 필요할 때 관련 heading 또는 term section만 section-load 합니다.
- terminology governance 또는 naming design 작업일 때만 전체 문서를 읽습니다.

## Maintenance Rule

- 새로운 design 문서가 추가될 때:
  - 새로운 핵심 명사, 상태, 책임, 경계가 생기면 이 문서에 추가합니다.
- 기존 design 문서가 변경될 때:
  - 용어의 의미나 범위가 바뀌면 이 문서를 함께 수정합니다.
- `initiative`, `task`, `project`, `guide`는 이 문서의 용어를 우선 사용합니다.
- 같은 대상을 가리키는 표현이 여러 개 생기면 canonical term 하나를 고정합니다.

## Core Boundary Terms

### `agent instruction surface`

Codex 같은 coding agent가 작업 전에 자동으로 읽는 짧은 repository guidance를 뜻합니다.

이 하네스에서는 루트 `AGENTS.md`가 기본 agent instruction surface입니다.

### `repository-local harness skill`

document-harness의 initialize/migrate/upgrade, execution, policy extraction, `보드` operation 요청을 현재 repository의 durable entrypoint로 route하는 project-scoped workflow입니다.

canonical path는 `.agents/skills/operate-document-harness/SKILL.md`이고 `.claude/skills/operate-document-harness/SKILL.md`는 그 파일을 읽는 thin adapter입니다. 별도 policy·approval·verification authority를 만들지 않으며 user-global skill로 설치하지 않습니다.

### `project-system-name`

이 프로젝트의 가장 바깥 시스템 이름을 적습니다.

예:

- 수집기
- API
- 배치 파이프라인

### `ingress`

외부 입력이 이 프로젝트 안으로 들어오는 입구를 뜻합니다.

### `core processing`

이 프로젝트가 직접 책임지는 핵심 처리 단계를 뜻합니다.

### `downstream`

이 프로젝트 이후에 결과를 받는 시스템을 뜻합니다.

## Runtime Terms

### `worker`

프로세스가 어떤 실행 모델로 동작하는지 적습니다.

예:

- one-shot worker
- long-running server
- scheduled batch

### `checkpoint`

다음 실행이나 다음 단계가 이전 상태를 이어받기 위해 저장하는 최소 진행 상태를 뜻합니다.

### `operator prerequisite`

운영 환경에서 사람이 먼저 준비해야 하는 전제를 뜻합니다.

예:

- 권한
- 인증 정보
- 외부 서비스 접근

## Domain Terms

### `human policy`

사람 또는 authorized human role이 소유하는 outcome, scope, non-waivable constraint, risk authority를 뜻합니다. AI는 초안과 세부화 proposal을 만들 수 있지만 human policy를 스스로 승인할 수 없습니다.

### `policy clause`

policy 안에서 독립적으로 참조하고 검증할 수 있는 stable ID가 있는 규범 단위입니다.

### `proposal`

AI 또는 사람이 작성한 option, standard, exception 후보입니다. `proposed` 또는 `accepted_for_promotion` 상태는 `effective`가 아니며 normative authority가 없습니다.

### `normative standard`

human policy에서 파생되고 승인되어 effective인 MUST/SHOULD, invariant, failure boundary, stable rule ID 집합입니다.

### `approval reference`

human approver, approval time, policy/standard/exception ID, exact source revision 또는 diff, scope를 연결하는 참조입니다. 문서 안의 승인 문자열만으로 authority를 증명하지 않습니다.

### `scoped exception`

base rule을 수정하지 않고 특정 scope/time에만 적용하는 승인된 overlay입니다. human risk acceptor, residual risk, compensating controls, required checks, expiry, exit task가 필요합니다.

### `initiative`

정책과 지침을 하나 이상의 bounded delivery project가 달성할 portfolio outcome으로 연결하는 strategy owner입니다. 사용자 화면과 한국어 대화에서는 `추진안`, 문서 type과 schema에서는 `initiative`, stable ID에서는 `I####`를 사용합니다.

### `initiative ref`

project가 어떤 승인된 추진안의 outcome lineage에 속하는지 가리키는 `I####` stable ID입니다. Project frontmatter에서는 `related_initiative`를 사용하고, Task는 `related_project`를 통해 그 계보를 따릅니다.

### `policy relationship`

추진안이 policy를 `advances`, `constrained-by`, `exception-to` 중 어떤 방식으로 따르는지 설명하는 direct WHY/WHAT 관계입니다. guideline의 policy link만으로 간접 추론하지 않습니다.

### `guideline disposition`

추진안이 guideline을 `required` 또는 `recommended`로 어떻게 적용할지와 rationale/verification을 기록하는 direct HOW/EVIDENCE 관계입니다. 적용할 지침이 없거나 판단이 남으면 개별 관계에 `not-applicable`을 쓰지 않고 `guideline_disposition`과 이유로 표현합니다.

### `legacy umbrella project`

별도 `I####` 계층 도입 전에 `project_role: umbrella`, `umbrella_initiative`, `parent_umbrella_project`로 human-facing lineage를 소유하던 project입니다. migration 전까지 유효하지만 자동으로 승인된 추진안으로 간주하지 않습니다.

### `loop state`

task lifecycle `status`와 별도로 현재 실행 제어 상태를 나타내는 값입니다. `ready`, `running`, `awaiting_user`, `awaiting_external`, `needs_review`, `stopped`, `succeeded`를 사용합니다.

### `execution checkpoint`

한 loop-enabled task의 current resumable snapshot입니다. task contract revision, attempt/checkpoint sequence, current hypothesis, last evidence, next actor/action, resume condition, attention, risk, receipt refs를 담으며 task `Status`의 append-only history를 대체하지 않습니다.

### `attention request`

loop가 계속되기 위해 사람 또는 외부 actor가 제공해야 하는 정확한 input, decision, approval, review를 뜻합니다. why now, requested response, alternatives/impact, risk, revision fence, resume condition을 포함합니다.

### `decision receipt`

누가 어떤 선택을 어떤 source/checkpoint revision에 대해 언제 내렸는지 보존하는 immutable evidence입니다.

### `verification receipt`

어떤 command/check가 어떤 input revision과 환경에서 어떤 결과를 냈는지 보존하는 immutable evidence입니다.

### `evidence barrier`

required check, receipt, goal verification, unresolved attention 여부를 결합해 `succeeded` 또는 closeout을 허용하는 gate입니다.

### `보드`

repository 하나의 policy, guideline, initiative, 연결 project, task checkpoint, attention과 evidence를 사람이 읽기 좋게 투영하는 화면의 고정 사용자명입니다. top bar에는 `보드 / <repository>`로 표시하며 repository별로 rename하지 않습니다. “보드를 띄워줘”는 현재 repository의 View를 시작하고 주소를 안내하라는 뜻입니다.

### `human control view`

`보드`를 구현하는 기술 architecture term입니다. policy, guideline, initiative, 연결 project, task checkpoint, attention, evidence를 사람이 빠르게 읽도록 투영한 local-first interface이며 Markdown/Git source에서 재생성 가능해야 하고 자체적으로 task/approval truth를 소유하지 않습니다. 기술 command/path는 호환성을 위해 `human-view`를 유지합니다.

### `view snapshot`

하나의 source read fence에서 원자 publish된 immutable human-view projection 세대입니다. source revision, projection time, lag, freshness, snapshot sequence를 가집니다.

### `hybrid retrieval`

lexical retrieval과 dense retrieval을 독립 실행하고 rank fusion으로 결합하는 검색 방식을 뜻합니다. 이 하네스의 기본 fusion은 RRF입니다.

### `exact arm`

ID, path, YAML key, command, error string처럼 analyzer가 분해하면 안 되는 값을 untokenized keyword/term 또는 scoped direct source search로 찾는 retrieval arm입니다.

### `source revision`

authoritative source의 특정 내용 상태를 provenance에서 식별하는 opaque revision입니다. 순서 비교는 별도 `revision sequence`, byte 동일성 확인은 `source hash`를 사용합니다.

### `revision sequence`

같은 document의 source revision 순서를 비교할 수 있는 monotonic number입니다. content hash는 동일성 확인에 쓰고 revision sequence는 늦은 job의 publish 거부에 씁니다.

### `document head`

한 document의 현재 authoritative revision sequence, source hash, active/tombstone 상태를 가리키는 control record입니다.

### `indexed revision`

검색 결과 row가 실제로 반영한 source revision입니다. source revision보다 낮으면 그 결과는 stale 후보입니다.

### `read-your-writes barrier`

같은 작업 세션의 검색이 자신이 방금 쓴 source revision 이상만 사용하도록 기다리거나 direct-read fallback하는 freshness gate입니다.

### `publish barrier`

exact/lexical/dense arm이 같은 revision을 준비했는지 확인한 뒤 hybrid active revision을 원자 전환하는 gate입니다.

### `logical read fence`

한 query의 여러 retrieval arm이 하나의 논리 snapshot을 읽도록 고정하는 fence입니다. registry snapshot revision, index generation, document-head/pointer epoch, arm별 backend version evidence로 구성하며 backend-native version 하나를 전제로 하지 않습니다.

### `dirty source union`

same-session index receipt가 아직 없는 작은 변경 문서 집합을 direct source search 후보에 합쳐 stale index를 보완하는 계층입니다.

### `registry revision`

source include/exclude, sensitivity, branch/worktree scope 같은 검색 control metadata snapshot의 version입니다. source content가 같아도 registry revision 변화는 별도 mutation이며 chunk row의 과거 revision과 전역 equality를 요구하지 않습니다.

### `presence state`

source의 존재 판정 상태입니다. 정상 확인된 `PRESENT`, 오류나 일시 부재인 `INDETERMINATE`, readable settled scan 또는 authoritative source signal로 삭제가 확인된 `ABSENT_CONFIRMED`를 사용합니다.

### `searchable delta`

background compaction이나 full index rebuild 전에 새·수정 content를 즉시 검색할 수 있게 하는 최신 변경 계층입니다.

### `tombstone`

삭제되거나 rename으로 대체된 identity를 physical cleanup 전부터 검색 결과에서 제외하는 논리 삭제 표식입니다.

### `reconciliation scan`

watcher 이벤트와 무관하게 authoritative source manifest와 index manifest의 content hash를 비교해 누락, orphan, stale revision을 복구하는 점검입니다.

### `index generation`

schema, chunker, tokenizer, embedding model의 호환 가능한 한 조합으로 만든 검색 projection 세대입니다.

### `visibility lag`

source write가 완료된 시점부터 해당 revision이 authoritative 검색 결과로 보이거나 삭제 결과가 사라질 때까지의 지연입니다.

### `raw source`

LLM이 해석하기 전의 원문 파일, clipping, transcript, image, PDF, dataset을 뜻합니다.

raw source는 가능한 한 불변으로 두고, 해석과 synthesis는 생성 문서에 남깁니다.

### `source ref`

생성 문서가 근거로 읽은 raw source나 외부 문서 경로를 뜻합니다.

markdown properties에서는 `source_refs` key를 사용합니다.

### `markdown properties`

문서 상단 YAML frontmatter에 적는 machine-readable metadata를 뜻합니다.

Obsidian, Dataview, 검색 도구, LLM agent가 문서를 분류하고 연결할 때 우선 읽는 index surface입니다.

### `wiki surface`

LLM이 유지하는 persistent markdown artifact를 뜻합니다.

이 하네스에서는 `design`, `guide`, `initiative`, `project`, `task`, `report`가 wiki surface입니다.

### `ingest`

새 source를 읽고, summary와 source_refs를 남기며, 관련 wiki surface의 current truth나 실행 이력을 갱신하는 작업을 뜻합니다.

### `lint pass`

문서의 stale claim, orphan, missing cross-reference, property drift, source gap을 점검하는 health-check 작업을 뜻합니다.

### `done criteria`

Codex 또는 사람이 작업을 닫기 전에 참이어야 하는 검증 가능한 완료 조건을 뜻합니다.

prompt에서는 `done when`으로 표현할 수 있고, 이 하네스에서는 `Completion Criteria`, `Exit Criteria`, `Goal Verification`, validator 결과로 구체화합니다.

### `main-issued draft`

`initiative`, `project`, `task` 또는 `qa` 문서 번호를 `main`의 문서 집합 기준으로 예약하기 위해 clean, up-to-date `main`에서 생성하고 즉시 commit한 `draft` 문서를 뜻합니다. Initiative는 exact human issuance-approval ref가 추가로 필요합니다.

main-issued draft는 active truth가 아니라 번호 reservation이며, work branch가 `main`을 merge한 뒤 내용을 채우고 필요할 때 active 전환합니다.

### `source record`

원문 기준으로 보존되는 가장 초기 데이터 단위를 적습니다.

### `normalized record`

정규화 규칙이 적용된 내부 canonical data를 적습니다.

### `result event`

downstream에 전달하거나 이후 단계가 소비하는 구조화 결과를 적습니다.

### `failure record`

실패를 버리지 않고 보존할 때 쓰는 canonical term을 적습니다.

## Out-Of-Scope Terms

### `future subsystem`

후속 `task` 또는 예외 branch `project`, 다른 별도 경계로 넘길 시스템을 적습니다.

### `final truth`

현재 프로젝트가 직접 확정하지 않는 최종 진실값이 있다면 그 term을 적습니다.

## Change Log

- 2026-07-17: Human Control View의 고정 사용자명을 `보드`로 정하고 기술명·명령과의 경계를 추가했다.
- 2026-07-18: `추진안`/`initiative`/`I####`, initiative ref, policy relationship, guideline disposition, legacy umbrella project 용어를 추가했다.
- 2026-07-16: repository-local harness skill, canonical project path, thin Claude adapter와 no-global-install 경계를 추가했다.
- 2026-07-15: human policy, proposal, normative standard, approval, exception, loop/checkpoint/attention/receipt, human control view vocabulary 추가.

- 2026-04-10: 하네스 starter 문서 생성.
- 2026-04-14: control-plane과의 whole-system control surface 연결 규칙 추가.
- 2026-05-09: LLM Wiki 운영을 위한 raw source, source_refs, markdown properties, ingest/lint 용어 추가.
- 2026-05-09: Codex 운영을 위한 agent instruction surface와 done criteria 용어 추가.
- 2026-06-14: main-issued draft 용어 추가.
- 2026-07-15: hybrid retrieval, revision, read-your-writes, searchable delta, tombstone, reconciliation, visibility 용어 추가.
