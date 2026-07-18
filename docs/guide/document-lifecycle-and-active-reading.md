# document-lifecycle-and-active-reading

- Type: guide
- Created: 2026-04-10
- Updated: 2026-07-18

## Purpose

이 문서는 `docs/initiatives`, `docs/projects`, `docs/reports`, `docs/tasks`, `docs/qa` 구조를 유지한 채, 소모성 문서의 수명주기와 사람이 현재 문서를 읽고 찾기 쉬운 운영 규칙을 고정합니다.

## Core Decisions

- `docs/initiatives`, `docs/projects`, `docs/reports`, `docs/tasks`, `docs/qa`는 문서 타입 경계이므로 유지합니다.
- 기본값으로 `archive/`를 도입하지 않습니다.
- 문서는 이동보다 `Status`와 상태 이력으로 제자리에서 닫습니다.
- 운영 규칙은 AI 검색성뿐 아니라 human scan에도 맞춰야 합니다.

## Lifecycle Rules

- 모든 `initiative`, `project`, `task`, `report` 문서는 `Status`를 가집니다.
- `draft`는 발급되었지만 아직 현재 읽을 문서 목록에 올리지 않은 상태입니다.
- `initiative`, `project`, `task`의 `draft`는 `main`에서 즉시 commit되는 번호 reservation으로 쓰일 수 있으며, active truth가 아니므로 폴더 active 목록에 올리지 않습니다. Initiative는 exact human issuance-approval ref가 있어야 draft를 발급합니다.
- `qa`도 `draft`는 번호 reservation, `current`는 현재 QA truth, `retired`는 비활성 상태로 사용합니다.
- `active`는 지금 사람이 읽고 추적해야 하는 문서입니다.
- `closed`, `done`, `cancelled`, `superseded` 같은 비활성 상태는 폴더의 active 목록에서 제외합니다.
- `done`은 발급 시점의 `Purpose`와 `Completion Mode`가 충족되었을 때만 씁니다.
- `Completion Mode`는 지원 catalog 중 하나여야 하며, work phase 이름을 임의로 쓰지 않습니다.
- `Completion Mode`를 바꿔야 할 정도로 종료 조건이 바뀌면 기존 문서는 보통 `superseded`입니다.
- `done` 전환은 `Goal Inventory`와 `Goal Verification`이 맞물리고 `./docs/bin/validate-closeout.sh`를 통과했을 때만 허용합니다.
- active `initiative`, `project`, `task`는 `Related Control Plane`을 통해 전체 기준면과 연결되어 있어야 합니다.
- active project는 `related_initiative`로 추진안에 연결되고 task는 `related_project`를 통해 계보를 따릅니다. Task에 추진안 ID를 중복 저장하지 않습니다. Legacy 문서는 migration 전까지 umbrella ref를 사용할 수 있습니다.
- `project`와 `task`는 가능하면 `Status: done`을 직접 편집하지 말고 `./docs/bin/close-doc.sh`로 닫습니다. Initiative는 canonical 문서·initiative register·exact terminal human decision receipt를 함께 바꿔야 하므로 coordinated workflow가 생기기 전까지 이 스크립트가 거부합니다.
- 원래 핵심 목표를 후속 문서로 넘겼다면 `done`이 아니라 계속 `active` 또는 `blocked`로 두거나, 범위 재발급 근거와 함께 `superseded` 또는 `cancelled`로 닫습니다.
- `superseded`는 기존 문서의 책임 경계나 목표가 새 문서로 재발급되어 더 이상 현재 기준이 아닐 때 씁니다.
- `cancelled`는 목표를 달성하지 않은 상태에서 의도적으로 중단했을 때 씁니다.
- `initiative`, `project`, `task`는 닫을 때 본문 `Status`에 종료 근거, 증빙, 남은 범위를 append-only로 남깁니다.
- `report`도 제자리에서 닫고, 마지막 결론과 후속 승격 문서 링크를 남깁니다.

## Report Promotion Rule

- `report`는 시점성 증적을 담는 surface입니다.
- `report` 안의 내용이 재사용 규칙, 현재 기준, 후속 실행 경계로 굳어지면 `guide`, `design`, `project`, `task`로 승격합니다.
- 승격 후에는 `report`를 계속 truth 문서처럼 키우지 말고, 승격된 문서를 링크로 연결합니다.

## Human Entry Rules

- `docs/initiatives/README.md`, `docs/projects/README.md`, `docs/tasks/README.md`, `docs/reports/README.md`는 active 문서만, `docs/qa/README.md`는 current QA 문서만 보여주는 얇은 입구입니다.
- 각 항목에는 문서 링크, 한 줄 설명, `Updated` 날짜만 적는 것을 기본으로 합니다.
- active `initiatives/README.md`는 승인된 추진안의 outcome, owner와 linked project 수를 먼저 보여줍니다.
- active `projects/README.md`는 각 project가 어느 `I####`에 속하는지 보여줍니다.
- active `tasks/README.md`는 각 task의 initiative와 project를 드러냅니다.
- 문서가 `active`가 되거나 닫히거나, 현재 초점이 크게 바뀌면 폴더 `README.md`를 같은 변경 셋에서 함께 갱신합니다.

## First-Screen Rule

- 모든 active `initiative`, `project`, `task`, `report`는 첫 화면에 아래 네 줄을 드러냅니다.
- `Status`
- `Owner`
- `Updated`
- `Current Focus`

이 네 줄만으로 사람이 아래를 바로 판단할 수 있어야 합니다.

- 지금 살아 있는 문서인가
- 누가 책임지는가
- 언제 마지막으로 갱신되었는가
- 지금 왜 이 문서를 읽어야 하는가

## Properties Rule

- 모든 새 템플릿은 YAML frontmatter properties를 가집니다.
- properties는 검색, Dataview, lint, agent navigation을 위한 machine-readable surface입니다.
- 첫 화면 bullet metadata는 사람이 읽는 visible mirror입니다.
- `status`, `owner`, `updated`, `current_focus`, 관계 property를 바꿀 때는 frontmatter와 bullet metadata를 함께 맞춥니다.
- `./docs/bin/close-doc.sh`는 `project`, `task`의 `status`/`updated`를 frontmatter와 bullet metadata 모두에서 갱신합니다. Initiative 종료는 사람이 canonical 문서, `docs/_indexes/initiative-register.json`, exact terminal decision receipt를 한 변경 셋에서 갱신한 뒤 `validate-closeout.sh`로 검증합니다.
- source 기반 문서는 `source_refs` property와 본문 `References` 또는 `Inputs`를 같이 채웁니다.
- 새 property key가 필요하면 `docs/_templates/`와 `docs/guide/llm-wiki-operations.md`를 같은 변경 셋에서 갱신합니다.

## Codex Reading Rule

- 루트 `AGENTS.md`는 Codex가 자동으로 읽는 첫 번째 repo entrypoint입니다.
- `AGENTS.md`는 human-facing README보다 짧고, Codex가 바로 행동할 수 있는 map, workflow, rules, verification만 담습니다.
- 상세한 문서 철학과 schema는 `docs/README.md`와 `docs/guide/`에 두고 `AGENTS.md`에서 링크합니다.
- Codex-facing 규칙이 바뀌면 `./docs/bin/validate-codex-readiness.sh`를 실행합니다.

## Filename Rules

- `initiative`: `I0001-slug.md`
- `project`: `P0001-slug.md`
- `task`: `T0001-slug.md`
- `report`: `YYYY-MM-DD-slug.md`
- `qa`: `QA0001-slug.md`

상태값인 `active`, `closed`는 파일명에 넣지 않습니다. 상태는 메타데이터와 폴더 입구 문서로 드러냅니다.

## Maintenance Rule

- active 목록은 최대한 얇게 유지합니다.
- 폴더가 시끄러워졌다면 보통 문제는 하위 구조 부족이 아니라 stale active 문서입니다.
- flat 구조가 실제 운영상 버거워지기 전까지는 `archive/`나 추가 하위 폴더를 먼저 만들지 않습니다.

## Change Log

- 2026-04-10: 문서 수명주기와 human-friendly active reading 규칙 고정.
- 2026-04-14: `done`, `superseded`, closeout validation 사용 기준 반영.
- 2026-04-16: umbrella lineage와 active surface 표시 규칙 추가.
- 2026-05-09: YAML properties와 visible metadata mirror 규칙 추가.
- 2026-05-09: Codex-facing AGENTS.md reading rule 추가.
- 2026-06-14: `project`/`task` draft를 main-issued 번호 reservation으로 commit할 수 있는 규칙 추가.
- 2026-07-15: QA draft/current/retired lifecycle과 current entry surface 추가.
- 2026-07-18: initiative lifecycle, active entry, modern initiative/project/task refs와 legacy bridge를 추가.
- 2026-07-18: coordinated closeout이 없는 상태에서 Initiative를 Markdown만 `done`으로 바꾸지 않도록 `close-doc.sh`의 fail-closed 경계를 추가.
