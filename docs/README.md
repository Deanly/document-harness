# Docs Harness

이 디렉터리는 프로젝트의 문서를 "현재 truth"와 "실행 이력"으로 분리해서 관리하기 위한 하네스입니다.

좋은 문서의 기준은 아래와 같습니다.

- DDD design 문서는 AI Domain Expert가 지속적으로 관리하고, 위임 범위 또는 중요한 사람 결정으로 권위가 확인된 현재 도메인 진실값을 담습니다.
- `task`와 `project`는 append-only 상태 이력을 남깁니다.
- `guide`는 반복되는 판단을 재사용 가능한 규칙으로 압축합니다.
- 모든 문서는 서로를 명시적으로 참조합니다.
- 문서는 구현을 따라가는 보고서가 아니라, 구현과 운영을 정렬시키는 인터페이스입니다.

## Directory Layout

- `docs/tasks/`: 작업 단위 문서
- `docs/projects/`: 프로젝트 단위 문서
- `docs/initiatives/`: 정책·지침을 delivery portfolio로 잇는 추진안 문서
- `docs/design/`: DDD 전용 domain landscape, context map, bounded-context model, ubiquitous language, executable examples
- `docs/architecture/`: 기술 구조, runtime, control plane, retrieval, execution mechanism
- `docs/governance/`: policy, approval, initiative authority와 traceability 체계
- `docs/guide/`: 반복적으로 참조하는 운영/구현/판단 가이드
- `docs/reports/`: 요청성 보고 문서
- `docs/qa/`: 기획·설계에서 파생된 QA 전략, 계획, 케이스, 런북 문서
- `docs/examples/`: 완성형 샘플 문서
- `docs/_templates/`: 문서 템플릿
- `docs/_indexes/`: active docs, design map, context packet, machine-readable retrieval/execution policy
- downstream `docs/checkpoints/`: loop-enabled task의 unnumbered current execution checkpoint
- `docs/bin/`: 문서 생성 및 검증 도구
- `AGENTS.md`: Codex가 자동으로 읽는 repository-level instruction surface
- `CLAUDE.md`: `AGENTS.md`를 import하는 thin Claude Code instruction adapter
- `.agents/skills/operate-document-harness/`: 각 repository에 설치하는 canonical project skill
- `.claude/skills/operate-document-harness/`: canonical skill을 읽는 thin Claude project adapter
- 프로젝트별 `raw/` 또는 `sources/`: 필요 시 원문 source를 불변으로 두는 입력 계층

## Harness Philosophy

- boundary-first: 구현보다 먼저 책임 경계와 비범위를 고정합니다.
- domain-model authority: `design`은 DDD 도메인 모델만 담고, exact delegated-AI 또는 human-confirmed receipt가 있는 bytes만 current authority가 됩니다.
- AI domain expertise: `ai-domain-expert`는 사람 바로 아래의 최고 감독 권한자로서 역할 AI 사이의 domain modeling, ubiquitous language와 implementation alignment를 통제합니다. routine 변경 비용은 AI가 감당하지만 material/strategic 결정과 위험 수용은 Board에서 사람이 담당합니다.
- whole-system control: 기술 목표, pipeline, runtime invariant, handoff는 `architecture` control surface가 붙잡습니다.
- strategy-to-delivery lineage: `initiative`는 정책·지침을 portfolio outcome으로, `project`는 bounded delivery로, `task`는 실행 slice로 연결합니다.
- focused execution: `project`와 `task`는 승인된 추진안의 방향을 잃지 않은 채 delivery와 실행에 집중하게 만드는 focus surface여야 합니다.
- human-issued initiative: `I####`는 exact human issuance approval 뒤에만 발급하고, activation approval과 lifecycle을 별도로 관리합니다.
- human-approved project: `project`는 bounded delivery boundary를 잠그므로 사람의 명시적 요청 또는 승인 하에서 발급합니다.
- human-governed policy: AI는 policy/standard/exception proposal을 작성할 수 있지만 human approval 없이 effective로 만들지 않습니다.
- observable execution: loop-enabled task는 current checkpoint, next actor/action, attention, evidence receipt, stop/resume 상태를 외부화합니다.
- human-view projection: Markdown/Git은 authority로 유지하고 사용자를 위한 화면은 freshness가 보이는 rebuildable read-only projection으로 만듭니다.
- human-readable Board gate: 정책·지침·추진안·도메인의 사람용 제목과 설명이 없으면 기술 원문을 정상 항목으로 대신 표시하지 않고 검토 attention으로 돌립니다.
- ownership-aware adoption: mature repository는 파일 복사가 아니라 project-owned surface와 dirty state를 보존하는 plan/apply migration으로 도입합니다.
- evidence-backed: 완료, 위험, 운영 판단은 실제 관찰 결과와 연결합니다.
- goal-locked completion: 발급 시점의 목적과 완료 기준은 나중에 더 작은 조각으로 쪼개도 약해지지 않습니다.
- current-truth design: DDD 설계 문서는 append-only 이력보다 현재 도메인 모델의 정확성을 우선하고, stable model ID로 역할 간 추적성을 유지합니다.
- append-only execution history: `task`와 `project`의 `Status`는 실행 이력을 시간순으로 누적합니다.
- source-backed synthesis: 원문 source는 불변으로 두고, 생성 문서는 `source_refs`와 본문 참조로 근거를 연결합니다.
- compounding answers: 재사용 가치가 생긴 답변, 비교, 판단은 대화에만 두지 않고 `report`, `guide`, `design`, `project`, `task` 중 맞는 surface로 파일링합니다.
- property-first markdown: YAML frontmatter는 에이전트, Obsidian, Dataview가 읽는 machine-readable index surface로 유지합니다.
- codex-readable entrypoint: 루트 `AGENTS.md`는 Codex가 즉시 읽는 짧은 instruction surface이고, 상세 규칙은 `docs/guide/`로 연결합니다.
- repository-local skill: harness workflow router는 target repository의 `.agents/skills/operate-document-harness/`에 설치하고 user-global skill에 의존하지 않습니다.
- verifiable agent work: Codex가 완료 여부를 확인할 수 있도록 한 번에 실행 가능한 validator를 제공합니다.
- narrow scope: v1 범위를 명시적으로 좁게 고정하고, 후속 경계는 먼저 같은 project 아래 `task`로 수용하며 별도 delivery boundary일 때만 새 `project`로 분리합니다.
- ubiquitous language: 핵심 용어는 한 곳에서 canonical term을 고정하고 설계 변경과 함께 갱신합니다.
- human-readable active surface: active 문서는 폴더 입구와 문서 첫 화면에서 바로 식별 가능해야 합니다.
- source-authoritative retrieval: 검색 index는 재생성 가능한 후보 surface이며, 방금 바뀌었거나 freshness가 불확실한 파일은 원문을 직접 읽습니다.

자세한 철학은 `docs/guide/harness-philosophy.md`를, 수명주기와 human reading 규칙은 `docs/guide/document-lifecycle-and-active-reading.md`를, source-backed wiki 운영은 `docs/guide/llm-wiki-operations.md`를, Codex 운영은 `docs/guide/codex-agent-guidance.md`를 봅니다.

## Document Types

### Initiative (사용자 용어: 추진안)

- 파일명 규칙: `I0001-abc.md`
- prefix: `I`
- 의미: 정책과 지침을 여러 bounded project의 outcome portfolio로 연결하는 strategy owner
- 발급 주체: exact human issuance approval이 있을 때만
- 필수 내용:
  - outcome과 why now
  - scope / out of scope
  - issuance approval과 activation approval 분리
  - policy direct relationship (`advances`, `constrained-by`, `exception-to`)
  - guideline direct relationship (`required`, `recommended`) 또는 명시적인 `guideline_disposition` 비적용·검토 사유
  - linked project projection의 비권위 경계
  - success signals와 outcome review
  - risks, review cadence, completion guardrails
  - append-only `Status`

### Task

- 파일명 규칙: `T0001-abc.md`
- prefix: `T`
- 의미: 실제로 수행하고 닫을 수 있는 작업 단위
- 필수 내용:
  - 목적
  - related control plane
  - related project (추진안은 Project의 `related_initiative`를 통해 추적)
  - affected bounded context와 approved/current domain model ref
  - actor role과 domain change 영향
  - whole-system anchor
  - completion mode
  - execution contract, task contract revision, lifecycle과 분리된 loop state
  - policy / normative rule / exception refs
  - execution readiness와 current checkpoint ref
  - attention / decision / verification receipt
  - committed outcome
  - goal inventory
  - goal verification
  - outputs / handoff
  - quality axes in scope
  - completion evidence
  - 범위
  - 비범위
  - 관련 문서 참조
  - dependencies
  - task placement check
  - 내부 WBS
  - 전체 진행률
  - completion criteria
  - completion guardrails
  - append-only `Status`

### Project

- 파일명 규칙: `P0001-abc.md`
- prefix: `P`
- 의미: 승인된 추진안 아래의 하나의 bounded delivery/project 단위
- 기본값: 한 개의 canonical `related_initiative`를 가진 project
- 발급 주체: 사람의 명시적 요청 또는 승인
- 필수 내용:
  - 목적
  - initiative ref와 initiative alignment
  - affected bounded context와 approved/current domain model ref
  - domain change 영향과 domain expert review ref
  - related control plane
  - whole-system anchor
  - completion mode
  - committed outcome
  - goal inventory
  - goal verification
  - outputs / handoff
  - quality axes in scope
  - completion evidence
  - 범위와 비범위
  - 관련 문서 참조
  - project issuance check
  - 프로젝트 WBS
  - 전체 진행률
  - milestones
  - exit criteria
  - completion guardrails
  - append-only `Status`

### Design

- 파일명 규칙: `docs/design/domain-landscape.md`, `docs/design/context-map.md`, `docs/design/contexts/<bounded-context>/{domain-model,ubiquitous-language,examples}.md`
- 의미: DDD에 입각한 현재 도메인 모델과 조직의 공통 업무 언어
- 특징:
  - `docs/design/`에는 기술 architecture나 governance mechanism을 두지 않습니다.
  - landscape와 context map이 bounded-context 경계와 관계를 고정합니다.
  - 각 context set은 model, ubiquitous language, executable examples를 함께 가집니다.
  - aggregate, entity, value object, command, event, policy, business rule, scenario에 stable ID를 부여합니다.
  - 고객·기획자·설계자·개발자·QA는 동일한 stable ID를 role-specific packet으로 읽습니다.
  - AI Domain Expert는 source·example·반례·semantic diff를 종합하고 routine·가역 변경을 exact delegation 안에서 current로 만들 수 있습니다.
  - `current` 모델은 repository-relative JSON authority receipt가 human-confirmed 또는 delegated-AI actor, exact source bytes와 authority fence를 고정하고 freshness 검증을 통과해야 합니다.
  - 중요한 변경은 AI Domain Expert가 `bounded-context`, `aggregate`, `entity`, `value-object`, `business-rule`, `state-transition`, `ubiquitous-language`, `scenario` 중 사람이 결정하기 위한 최소 충분 수준을 선택해 Board에 제시합니다.
  - `display_title`, `human_summary`, `presentation_status`, `presentation_ref`는 Board 가독성 상태이며 domain meaning approval와 별도입니다.
  - 사람용 설명이 `missing` 또는 invalid이면 technical title/ID를 정상 Board card로 대체하지 않습니다.
  - Board operation must not create or modify `docs/design/`. View는 고정된 `docs/design/` 원문만 투영하며 원문 없음이나 legacy `BC-DISCOVERY`는 `not_configured` attention으로 처리합니다.
  - 자세한 계약은 `docs/guide/ddd-domain-design.md`를 따릅니다.

### Architecture

- 위치: `docs/architecture/`
- 의미: control plane, runtime, retrieval, execution loop, Human View 같은 기술 구조와 운영 메커니즘
- 특징: 도메인 의미를 재정의하지 않고 approved DDD model을 구현·투영합니다.

### Governance

- 위치: `docs/governance/`
- 의미: policy, guideline, approval, initiative authority, exception, evidence traceability 체계
- 특징: DDD model과 독립된 human authority 경계를 유지하며 AI self-approval을 허용하지 않습니다.

### Guide

- 파일명 규칙: `topic-guide.md`, `topic-qna.md`, `topic-baseline.md`
- 의미: 실무형 설명, 운영 기준, Q&A, 실행 순서, 체크리스트
- 특징:
  - 설계 문서보다 설명적입니다.
  - 요청성 보고보다 지속적으로 재사용됩니다.
  - project/task/design의 의사결정을 보조합니다.
  - `operational-guidance`는 effective design을 실행하는 HOW이며 design에 없는 새 MUST를 단독으로 만들 수 없습니다.

### Report

- 파일명 규칙: `2026-04-10-topic.md`
- 의미: 요청에 의해 생성되는 시점성 보고 문서
- 특징:
  - 고정 번호 체계는 강제하지 않습니다.
  - 날짜를 앞에 두어 시간순 정렬과 human scan을 쉽게 합니다.
  - 요청 목적에 맞는 구조를 사용합니다.
  - 재사용 가치가 생긴 내용은 `guide`, `design`, `project`, `task`로 승격합니다.
  - policy/standard/exception proposal은 `governance_role: proposal`과 `proposal_status`를 사용하며, 승인된 design으로 승격되기 전까지 normative authority가 없습니다.

### QA

- 파일명 규칙: `QA0001-abc.md`
- prefix: `QA`
- 의미: design과 planning source에서 파생된 테스트 전략, 계획, 케이스 카탈로그, 런북
- 상태: `draft`, `current`, `retired`
- 특징:
  - `qa_type`은 `strategy`, `plan`, `cases`, `runbook` 중 하나입니다.
  - source documents와 traceability를 유지합니다.
  - affected context의 approved/current model과 covered business rule/scenario ID를 추적합니다.
  - 번호는 clean, up-to-date `main`에서 발급하고 draft를 즉시 commit합니다.
  - current 문서는 `docs/qa/README.md`와 `docs/_indexes/active-docs.md`에 함께 표시합니다.
  - Domain Scenario → Business Rule → Task/Goal → Check → Evidence → Verdict와 Policy Clause → Standard Rule lineage를 모두 exact version/ID로 추적합니다.

### Harness Language

- 권장 파일: `docs/architecture/harness-language.md`
- 의미: document harness 자체의 canonical technical term 사전
- 특징:
  - 비즈니스 ubiquitous language를 대신하지 않습니다.
  - 비즈니스 용어는 각 `docs/design/contexts/<bounded-context>/ubiquitous-language.md`에서 관리합니다.

### Control Plane

- 권장 파일: `docs/architecture/control-plane.md`
- 의미: 전체 시스템 목표, 표준 pipeline, active control surface, quality axis, validator를 한 곳에 묶는 central control surface
- 특징:
  - 새 프로젝트에서 가장 먼저 채웁니다.
  - active design / project / validator / quality axis를 한 곳에서 연결합니다.
  - 부분 작업 문서는 이 문서를 whole-system anchor로 참조합니다.

### Codex Agent Instructions

- 권장 파일: `AGENTS.md`
- 템플릿: `docs/_templates/agents.md`
- 의미: Codex가 repo를 열자마자 읽는 짧은 작업 규칙과 verification entrypoint
- 특징:
  - full schema를 복제하지 않고 `docs/README.md`와 관련 guide로 연결합니다.
  - `Repository Map`, `Codex Workflow`, `Documentation Rules`, `Verification Commands`, `Done Criteria`를 포함합니다.
  - 상세 규칙은 `docs/guide/codex-agent-guidance.md`로 분리합니다.
  - Codex instruction budget을 고려해 간결하게 유지합니다.

### Repository-Local Harness Skill

- canonical path: `.agents/skills/operate-document-harness/SKILL.md`
- Claude adapter path: `.claude/skills/operate-document-harness/SKILL.md`
- 의미: adoption, loop execution, policy/initiative extraction와 `Board` operation 요청을 repository의 durable entrypoint로 route하는 project skill. “View start”는 현재 repository의 `human-view start` + `url`을 뜻합니다.
- authority: 별도 policy·approval·verification authority를 만들지 않으며 `AGENTS.md`, human-owned policy, effective design과 validator를 따릅니다.
- 설치 범위: 각 target repository 안에 document-harness와 함께 설치하며 user-global location에는 설치하지 않습니다.
- bootstrap: 현재 session 중 처음 설치되면 canonical file을 direct-read하고, 자동 discovery는 새 session 또는 repository reload 뒤 기대합니다.

## Markdown Properties

새 템플릿은 YAML frontmatter를 기본으로 생성합니다. 이 properties는 Obsidian, Dataview, 검색 도구, 에이전트가 문서를 빠르게 분류하고 연결하기 위한 machine-readable surface입니다.

- 공통 property: `type`, `title`, `status`, `owner`, `created`, `updated`, `source_refs`, `tags`
- `initiative`: `doc_id`, `approval_status`, `issuance_approval_ref`, `approval_ref`, `policy_refs`, `guideline_refs`, `related_control_plane`, `quality_axes`
- `project`: `doc_id`, `related_initiative`, `initiative_relation`, `completion_mode`, `related_control_plane`, `quality_axes`
- `task`: `doc_id`, `related_project`, `completion_mode`, `related_control_plane`, `quality_axes`
- legacy bridge: 기존 `project_role`, `umbrella_initiative`, `parent_umbrella_project`, `related_umbrella_project`는 migration 전까지 허용하지만 새 template 기본값은 아닙니다.
- `task` execution: `execution_contract`, `task_contract_revision`, `loop_state`, `risk_tier`, `checkpoint_ref`, `policy_refs`, `normative_refs`, `exception_refs`
- `design`: `domain`, `referenced_by`, optional `governance_role`, `governance_id`, `normative_version`, `approval_ref`, `display_title`, `human_summary`, `presentation_status`, `presentation_ref`
- `design` retrieval hints: `retrieval_class`, `context.default_load`, `context.section_load`, `context.size_tier`
- `guide` / `report`: `related_project`, `related_task`, `related_design`
- governance proposal: `governance_role`, `proposal_kind`, `proposal_status`, `policy_refs`, `standard_refs`
- `qa`: `doc_id`, `qa_type`, `source_documents`, `related_design`, `related_project`

첫 화면의 bullet metadata는 사람이 바로 읽는 mirror입니다. `status`, `updated`, `current_focus`, 관계 property를 바꾸면 frontmatter와 bullet metadata를 같은 변경 셋에서 맞춥니다.

`source_refs`에는 raw source, clipped article, transcript, dataset, 외부 문서 경로를 적습니다. source 자체는 가능한 한 불변으로 두고, 해석과 synthesis는 `design`, `guide`, `report`, `project`, `task`에 남깁니다.

## Issuing Rules

- `initiative`, `task`, `project`, `qa`는 각각 독립된 번호 시퀀스를 가집니다.
- 번호는 중앙 카운터 파일 없이 기존 파일을 스캔해 계산합니다.
- `initiative`, `task`, `project`, `qa` 번호 발급 기준 브랜치는 항상 `main`입니다.
- numbered document 발급 전에는 local `main`을 remote tracking branch 기준으로 최신화합니다.
- `./docs/bin/new-doc.sh initiative|task|project|qa ...`는 clean, up-to-date `main`에서만 실행하며, 생성된 `draft` 파일만 즉시 `main`에 별도 commit으로 남깁니다.
- initiative는 `./docs/bin/new-doc.sh initiative <slug> <issuance-approval-ref>` 형식으로만 발급하며 exact human approval ref가 없으면 생성하지 않습니다.
- `<issuance-approval-ref>`는 안전한 ASCII token, repository-relative path 또는 `http(s)` URL만 허용합니다. YAML/Markdown 구조를 바꿀 수 있는 공백, quote, bracket, backtick, pipe, backslash와 control character는 거부합니다.
- project는 `./docs/bin/new-doc.sh project <slug> <initiative-id> [delivers|supports|explores]` 형식으로 발급하며 canonical `I####`를 반드시 지정합니다. `status: active`, `approval_status: approved` 문자열만으로 충분하지 않으며 `approval_ref`가 repository-relative JSON activation receipt이고 human actor·approved decision·candidate ID·source revision/hashes·canonical initiative bytes를 정확히 고정해야 합니다. 관계 기본값은 `delivers`입니다.
- task는 `./docs/bin/new-doc.sh task <slug> <project-id>` 형식으로 발급하며 존재하는 canonical `P####`를 반드시 지정합니다. modern Project의 `related_initiative`는 위 activation receipt와 current effective/approved policy, required guideline까지 검증된 active `I####`로 해소되어야 합니다. 추진안 도입 전 legacy Project는 `project_role`, `umbrella_initiative`, `parent_umbrella_project` 세 field가 모두 명시된 경우에만 grandfathered parent로 허용합니다.
- 발급된 `draft` commit은 번호 reservation입니다. 공유 remote가 있으면 work branch로 돌아가기 전에 push 또는 공유까지 끝냅니다.
- 발급 후 기존 work branch는 `main`을 merge해서 새 문서와 그 사이 `main`에 들어온 배포본을 함께 가져온 뒤 작업을 이어갑니다.
- work branch가 dirty해서 바로 `main`으로 전환할 수 없으면 untracked 파일을 포함해 stash하고, `main` 병합 후 stash를 되돌리며 충돌을 해결합니다.
- 개발 도중 `main`에 이미 배포된 버전을 가져오는 것은 정상적인 baseline refresh로 허용합니다.
- 여러 feature와 배포 기준 hotfix가 동시에 존재할 때의 worktree 구성, baseline 분리와 선택적 docs-only bridge는 mandatory issuance rule이 아니라 이 repository의 운영 권장안입니다. `docs/guide/concurrent-feature-hotfix-operation.md`를 참고합니다.
- 번호는 4자리 고정입니다.
- slug는 공백 대신 hyphen을 사용하는 kebab-case를 기본으로 하며, 한글을 포함한 유니코드 문자도 허용합니다.
- 기존 문서를 삭제하지 않는 한 번호는 재사용하지 않습니다.
- `guide`, `design`, `report`는 번호보다 의미 있는 slug를 우선합니다.
- `report`는 발행일을 파일명 앞에 두는 것을 기본으로 합니다.

## Update Rules

- YAML frontmatter는 검색과 index를 위한 properties이고, 첫 화면 bullet metadata는 human scan을 위한 mirror입니다.
- 새 문서는 템플릿의 properties를 유지하며, 임의 key가 필요하면 템플릿과 `docs/guide/llm-wiki-operations.md`를 함께 갱신합니다.
- source 기반 판단을 남길 때는 `source_refs`와 본문 `References` 또는 `Inputs`를 함께 채웁니다.
- AI-facing 규칙을 바꾸면 루트 `AGENTS.md`, `CLAUDE.md`, `.agents/skills/operate-document-harness/`, `.claude/skills/operate-document-harness/`, `docs/_templates/agents.md`, `docs/_templates/claude.md`, `docs/guide/codex-agent-guidance.md`, `./docs/bin/validate-codex-readiness.sh`를 함께 검토합니다.
- `initiative`, `task`, `project`의 `Status` 섹션은 append-only로 운영합니다.
- 새 이력은 문서 하단에 계속 추가합니다.
- WBS와 진행률은 현재 상태를 반영하도록 갱신합니다.
- 새 `task`·`project`·`qa`는 `domain_contract: v2`, `domain_impact`, affected bounded context, actor role, authoritative/current domain model ref와 exact AI Domain Expert supervision state/ref를 명시합니다. active/current v1은 migration 대상이며 사람 결정 또는 구현 변경을 숨긴 채 통과하지 않습니다.
- QA는 source model뿐 아니라 covered business rule ID와 scenario ID를 명시합니다.
- `task`와 `project`는 `Related Control Plane`을 통해 whole-system 기준 문서를 명시적으로 참조합니다.
- human-facing strategy/portfolio owner는 별도 `initiative`로 유지하고 project는 bounded delivery만 소유합니다.
- 추진안은 policy와 guideline을 모두 직접 연결하되 WHY/WHAT과 HOW/EVIDENCE 역할을 구분합니다.
- 새 work는 먼저 기존 project의 새 `task`로 수용 가능한지 검토합니다.
- 새 `project`는 별도 delivery boundary가 명확하고 사람이 요청하거나 승인할 때만 발급합니다.
- `project`는 `Initiative Ref`, `Initiative Alignment`, `Project Issuance Check`를 통해 추진안 lineage와 분리 이유를 남깁니다.
- `task`는 `Related Project`, `Task Placement Check`를 통해 왜 task가 맞고 왜 project가 아닌지 남기며, 해당 Project의 `related_initiative`를 통해 추진안 계보를 따릅니다.
- 기존 umbrella field는 `docs/governance/initiative-governance.md`의 legacy bridge에 따라 점진적으로 migration하며 일괄 rewrite하지 않습니다.
- `Goal Inventory`는 발급 시점에 잠그는 목표 목록입니다. `Goal ID`는 후속 분해가 생겨도 유지합니다.
- `Goal Verification`은 `Goal Inventory`의 각 `Goal ID`를 1:1로 다시 적고 현재 상태와 evidence를 기록합니다.
- `Whole-System Anchor`에는 이 문서가 전체 시스템에서 무엇을 보존해야 하는지, 어떤 invariant와 design surface를 깨면 안 되는지를 적습니다.
- `Outputs / Handoff`에는 이 문서가 닫힐 때 다음 문서나 시스템으로 무엇이 넘어가는지 적습니다.
- `Quality Axes In Scope`에는 `docs/guide/quality-axes.md`에서 선택한 축과 필요한 evidence를 적습니다.
- `Completion Mode`는 `docs/guide/goal-locked-completion.md`에 정의된 지원 mode 중 하나만 사용합니다.
- `Completion Mode`는 work phase가 아니라 terminal condition을 적습니다.
- 발급 후 `Completion Mode` 자체를 바꿔야 한다면 기존 문서를 `superseded` 또는 `cancelled`로 닫고 새 문서를 발급하는 쪽을 기본으로 합니다.
- `task`와 `project`의 `Purpose`, `Scope`, `Out Of Scope`, `Completion Mode`, `Completion Criteria` 또는 `Exit Criteria`는 발급 시점의 완료 계약으로 취급합니다.
- 후속 `task`나 `project`를 새로 발급해도 기존 항목의 완료 기준을 더 작은 하위 조각으로 축소하지 않습니다.
- 남은 핵심 목표를 후속 문서로 넘겼다면 현재 문서는 `done`이 아니라 계속 `active` 또는 `blocked`로 두거나, 범위 재발급 근거와 함께 `superseded` 또는 `cancelled`로 닫습니다.
- `done` 또는 `closed` 전환 전에는 `./docs/bin/validate-closeout.sh`를 통과해야 합니다.
- whole-system control surface의 기본 구조는 `./docs/bin/validate-harness-foundation.sh`를 통과해야 합니다.
- Codex-facing surface의 기본 구조는 `./docs/bin/validate-codex-readiness.sh`를 통과해야 합니다.
- retrieval-plane surface의 기본 구조는 `./docs/bin/validate-doc-retrieval.sh`를 통과해야 합니다.
- DDD structure, Board review package와 exact-byte authority/freshness는 `./docs/bin/validate-domain-design.sh --all`을 통과해야 합니다.
- project/task/QA domain traceability는 `./docs/bin/validate-domain-lineage.sh --all`을 통과해야 합니다.
- project/task/QA의 current model-implementation supervision은 `./docs/bin/validate-domain-supervision.sh --all`을 통과해야 하며 closeout에서는 unresolved decision/conflict를 거부합니다.
- hybrid runtime을 쓰더라도 filesystem source가 authoritative하며, 현재 작업에서 바뀐 파일이나 freshness가 불확실한 결과는 source를 직접 읽습니다.
- retrieval runtime은 `docs/_indexes/retrieval-policy.yaml`의 revision, tombstone, direct-read fallback 계약을 따릅니다.
- lifecycle `status`와 execution `loop_state`를 분리하고, active execution은 current checkpoint를 연결합니다.
- policy/standard/exception proposal은 human approval과 effective design revision 없이 mandatory rule이 될 수 없습니다.
- view cache와 AI summary는 derived projection이며 task, approval, evidence의 유일한 truth를 소유하지 않습니다.
- `project`와 `task`의 `done` 전환은 가능하면 메타데이터를 직접 고치기보다 `./docs/bin/close-doc.sh <doc-path> "<note>"`를 사용합니다. Initiative 종료는 canonical 문서, initiative register, exact terminal human decision receipt를 한 변경 셋으로 갱신해야 하므로 현재 스크립트가 거부합니다.
- `project` 문서의 WBS는 실제 `task` 문서와 1:1로 대응하는 것을 기본 규칙으로 합니다.
- initiative tab의 project link는 project source에서 reverse-index한 projection이며 WBS나 task 상태를 복제하지 않습니다.
- `project` 문서의 WBS `ID`는 해당 `task`의 문서 번호를 그대로 사용합니다.
- `task` 내부 WBS의 `ID`는 `W1`, `W2`, `W3` 형식을 사용합니다.
- `project`, `task`, `report`는 기본적으로 제자리에서 닫습니다. `archive/`는 기본 규칙이 아닙니다.
- `docs/initiatives/README.md`, `docs/projects/README.md`, `docs/tasks/README.md`, `docs/reports/README.md`는 active 문서만, `docs/qa/README.md`는 current QA 문서만 보여주는 얇은 입구로 유지합니다.
- 문서가 `active`가 되거나 닫히면 해당 폴더 `README.md`도 같은 변경 셋에서 갱신합니다.
- active `project`, `task`, `report`는 첫 화면에 `Status`, `Owner`, `Updated`, `Current Focus`를 드러냅니다.
- `report`는 살아 있는 truth를 누적하는 문서가 아닙니다. 재사용 규칙이나 현재 기준이 생기면 해당 타입 문서로 승격하고 링크를 남깁니다.
- 설계가 변경되면:
  - 먼저 affected bounded context의 domain model, ubiquitous language, examples를 같은 변경 셋에서 수정합니다.
  - 경계나 upstream/downstream 관계가 바뀌면 landscape와 context map도 함께 수정합니다.
  - AI Domain Expert는 routine 변경은 delegation 안에서 검증하고, 중요한 초안은 최소 충분 모델링 수준의 Board review package와 함께 `review_requested`로 둡니다.
  - 승인 receipt와 freshness 검증 뒤 관련 `task`, `project`, `qa`, `guide`, architecture 참조를 갱신합니다.

## Writing Bar

- Purpose는 "왜 이 문서가 존재하는가"를 첫 단락에서 바로 말해야 합니다.
- Scope와 Out Of Scope는 모두 씁니다. 좋은 문서는 포함 범위만이 아니라 제외 범위도 분명합니다.
- `project`와 `task`는 선택한 `Completion Mode`가 무엇을 닫는 문서인지 명확해야 합니다. 대부분의 경우 기본값은 `functional`입니다.
- `Completion Mode`는 `implementation-only`, `test-only`, `documentation-only`, `analysis-only` 같은 phase 이름을 쓰지 않습니다.
- single-task 성격의 작은 분화는 새 `project` 대신 새 `task`로 처리합니다.
- 새 `project`가 필요하다고 판단되면 왜 task가 안 되는지와 왜 human에게 별도 project가 더 이해하기 쉬운지를 먼저 씁니다.
- `Goal Inventory`는 발급 시점 목표를 잠그는 계약이며, `Goal Verification`은 그 계약의 달성 여부를 문서 안에서 다시 점검하는 게이트입니다.
- `Whole-System Anchor`는 부분 작업이 전체를 훼손하지 않게 만드는 연결 지점입니다.
- `Outputs / Handoff`는 부분 작업이 다음 slice나 downstream으로 무엇을 넘기는지 분명하게 적어야 합니다.
- `Quality Axes In Scope`는 review와 closeout을 같은 언어로 반복 가능하게 만드는 장치입니다.
- 실행 순서가 중요한 경우 Dependencies, Gates, Exit Criteria를 문서에 드러냅니다.
- 설계는 원칙이 아니라 계약과 규칙까지 고정합니다.
- Status는 "작업했다"가 아니라 "무엇을 고정했고 어떤 증빙이 있는가"를 적습니다.
- `Completion Evidence`에는 선택한 mode를 닫는 데 필요한 로그, 문서, 측정치, 상태 변화 같은 근거를 적습니다.
- 발행된 목적을 나중에 더 작은 하위 조각으로 줄여 `done` 처리하지 않습니다.
- active 문서를 열었을 때 첫 화면만으로도 현재 초점과 담당자를 파악할 수 있어야 합니다.
- 구현 전 브레인스토밍과 실제 기준 문서를 섞지 않습니다.
- 아직 경계가 잠기지 않았다면 새 `project`보다 `guide`나 `design`으로 남기는 편이 낫습니다.
- placeholder를 그대로 남기지 않습니다. 시작이 필요하면 `docs/examples/`를 먼저 참고합니다.

## WBS Conventions

### Project WBS

- 한 행은 하나의 `task` 문서에 대응합니다.
- `ID`는 해당 task의 문서 번호를 그대로 사용합니다.
- `Work Item`은 task 제목 또는 대표 작업명을 사용합니다.
- `Notes`에는 해당 task의 핵심 목적이나 산출물을 적습니다.

### Task WBS

- task 내부 WBS는 그 task를 수행하기 위한 세부 작업입니다.
- 내부 `ID`는 `W1`, `W2`, `W3` 형식을 사용합니다.
- `T0001` 같은 문서 번호 형태를 task 내부 WBS ID로 사용하지 않습니다.

## Recommended Workflow

1. 새 repository인지 mature repository인지 먼저 판정합니다. 기존 AGENTS, design, template, validator 또는 numbered doc가 있다면 `docs/ADOPT.md`의 no-write migrate plan부터 사용하고 public 파일을 단순 복사하지 않습니다.
2. 새 프로젝트 시작 시 `docs/architecture/control-plane.md`, `docs/design/domain-landscape.md`, `docs/design/context-map.md`를 먼저 채웁니다.
3. source를 누적하는 프로젝트라면 원문을 둘 `raw/` 또는 `sources/` 위치와 불변 규칙을 정합니다.
4. Codex가 작업할 프로젝트라면 루트 `AGENTS.md`와 repository-local `operate-document-harness` skill을 실제 repo 기준으로 조정합니다.
5. 정책·지침을 검토한 뒤 사람의 exact approval로 첫 `I####` 추진안을 발급합니다.
6. AI Domain Expert가 bounded context별 model·ubiquitous language·examples를 작성·검토하고 exact-byte authority receipt 또는 중요한 Board 결정을 연결한 뒤, 승인된 추진안 아래 첫 bounded `project`를 발급합니다.
7. 새 source를 ingest할 때는 `source_refs`, 관련 `design`/`guide`/`report`, 폴더 README를 함께 갱신합니다.
8. 실제 작업 단위가 생기면 먼저 현재 project 아래 `task`로 수용하되, 번호 발급은 `main`에서 수행합니다.
9. 별도 delivery boundary가 명확하고 사람이 승인할 때만 새 `project`를 발급하고 issuance check에 그 이유를 남깁니다.
10. 인간 policy를 받으면 missing decision과 AI proposal을 먼저 분리하고, 승인된 rule만 normative design으로 승격합니다.
11. `project`와 `task`에는 whole-system anchor, outputs / handoff, quality axes in scope를 함께 적습니다.
12. loop-enabled task 실행 중에는 current checkpoint, attention, decision/verification receipt를 갱신합니다.
13. 현재 읽어야 하는 문서가 생기면 해당 폴더 `README.md`의 active 목록도 함께 갱신합니다.
14. 반복적으로 참조할 설명, 체크리스트, 운영 기준은 `guide`로 남깁니다.
15. 요청성 정리나 특정 시점 보고는 `report`로 남기고, 재사용 가치가 생기면 다른 타입으로 승격합니다.
16. 주기적으로 `docs/guide/llm-wiki-operations.md`의 lint workflow로 stale claim, orphan, property drift를 점검합니다.
17. corpus 규모나 freshness 병목이 생기면 `docs/architecture/retrieval-plane.md`와 `docs/guide/hybrid-retrieval-and-freshness.md`에 따라 hybrid profile을 활성화합니다.
18. `./docs/bin/validate-codex-readiness.sh`와 `./docs/bin/validate-harness-adoption.sh`로 Codex/adoption entrypoint를 확인합니다.
19. `./docs/bin/validate-harness-foundation.sh`, `./docs/bin/validate-execution-loop.sh --all`, `./docs/bin/validate-closeout.sh`로 control, loop, closeout gate를 확인합니다.

프로젝트 분할 규칙은 `docs/guide/project-cutting-and-execution.md`를 우선합니다.

## Commands

`project`, `task`, `qa` 발급 명령은 clean, up-to-date `main`에서만 실행합니다.

```bash
./docs/bin/new-doc.sh initiative service-resilience DECISION-EXAMPLE
# Complete human activation review; project issuance requires I0001 to be active and approved.
./docs/bin/new-doc.sh project example-runtime-boundary I0001
# Task issuance verifies P0001 resolves to an active, approved initiative.
./docs/bin/new-doc.sh task bootstrap-ingestion-worker P0001
./docs/bin/new-doc.sh task "문서 하네스 정리" P0001
./docs/bin/new-doc.sh qa first-test-strategy
./docs/bin/new-doc.sh design bounded-context ingestion domain-model
./docs/bin/new-doc.sh design ubiquitous-language ingestion ubiquitous-language
./docs/bin/new-doc.sh design domain-examples ingestion examples
./docs/bin/new-doc.sh guide project-cutting-and-execution
./docs/bin/new-doc.sh report sprint-01-status
./docs/bin/validate-codex-readiness.sh
./docs/bin/validate-harness-foundation.sh
./docs/bin/validate-harness-adoption.sh
./docs/bin/validate-doc-retrieval.sh
./docs/bin/validate-domain-design.sh --all
./docs/bin/validate-domain-lineage.sh --all
./docs/bin/validate-domain-supervision.sh --all
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
./docs/bin/close-doc.sh docs/tasks/T0001-bootstrap-ingest.md "issued goals and evidence verified"
```

## Starter Docs

- `docs/EXECUTE.md`
- `docs/ADOPT.md`
- `CLAUDE.md`
- `.agents/skills/operate-document-harness/SKILL.md`
- `.claude/skills/operate-document-harness/SKILL.md`
- `docs/architecture/harness-language.md`
- `docs/design/domain-landscape.md`
- `docs/design/context-map.md`
- `docs/guide/ddd-domain-design.md`
- `docs/architecture/control-plane.md`
- `docs/governance/initiative-governance.md`
- `docs/architecture/harness-adoption-plane.md`
- `docs/architecture/retrieval-plane.md`
- `docs/governance/policy-to-evidence.md`
- `docs/architecture/execution-loop-plane.md`
- `docs/architecture/human-control-view-plane.md`
- `AGENTS.md`
- `docs/guide/harness-philosophy.md`
- `docs/guide/codex-agent-guidance.md`
- `docs/guide/umbrella-project-governance.md`
- `docs/guide/initiative-governance.md`
- `docs/guide/artifact-contracts.md`
- `docs/guide/quality-axes.md`
- `docs/guide/llm-wiki-operations.md`
- `docs/guide/hybrid-retrieval-and-freshness.md`
- `docs/guide/policy-proposal-and-approval.md`
- `docs/guide/execution-loop-operations.md`
- `docs/guide/human-control-view.md`
- `docs/guide/repository-policy-extraction.md`
- `docs/guide/document-lifecycle-and-active-reading.md`
- `docs/guide/project-cutting-and-execution.md`
- `docs/guide/goal-locked-completion.md`

## Active Entry Points

- `docs/EXECUTE.md`
- `docs/ADOPT.md`
- `docs/projects/README.md`
- `docs/initiatives/README.md`
- `docs/tasks/README.md`
- `docs/reports/README.md`
- `docs/qa/README.md`

## Examples

- `docs/examples/README.md`
