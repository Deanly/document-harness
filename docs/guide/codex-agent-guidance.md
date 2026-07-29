---
type: guide
title: codex-agent-guidance
status: current
owner:
created: 2026-05-09
updated: 2026-07-29
related_project: []
related_task: []
related_design:
  - docs/architecture/control-plane.md
  - docs/governance/initiative-governance.md
  - docs/architecture/retrieval-plane.md
  - docs/architecture/harness-adoption-plane.md
source_refs:
  - https://developers.openai.com/codex/guides/agents-md
  - https://developers.openai.com/codex/learn/best-practices
  - https://developers.openai.com/codex/prompting
  - https://developers.openai.com/codex/skills/
  - https://code.claude.com/docs/en/skills
tags:
  - docs/guide
  - codex
---

# codex-agent-guidance

- Type: guide
- Created: 2026-05-09
- Updated: 2026-07-17
- Related Project:
- Related Task:
- Related Design: docs/architecture/control-plane.md; docs/architecture/retrieval-plane.md

## Purpose

이 문서는 이 하네스를 Codex가 바로 읽고, 계획하고, 수정하고, 검증할 수 있게 만드는 agent-facing 운영 규칙을 고정합니다.

Codex 공식 문서는 `AGENTS.md`를 자동으로 읽는 project guidance로 다루며, 좋은 작업 입력에는 goal, context, constraints, done criteria가 있어야 하고, 검증 가능한 명령이 있을수록 결과가 좋아진다고 설명합니다. 이 하네스는 그 기준을 문서 구조와 validator로 흡수합니다.

## Codex Loading Model

- 루트 `AGENTS.md`는 Codex가 저장소를 열 때 자동으로 읽는 기본 instruction surface입니다.
- 더 세부적인 하위 디렉터리 규칙이 필요하면 해당 디렉터리에 `AGENTS.md` 또는 `AGENTS.override.md`를 둡니다.
- 하위 instruction은 루트 instruction 뒤에 읽히므로, specialized directory rule은 가능한 한 해당 작업 디렉터리에 가깝게 둡니다.
- instruction은 기본 로딩 한도를 고려해 짧게 유지합니다. 상세 설명은 `docs/guide/`로 빼고 `AGENTS.md`에서는 링크와 핵심 규칙만 둡니다.
- Codex는 repository의 `.agents/skills/`에서 project skill을 발견합니다. document-harness operation은 user-global skill이 아니라 target repository의 `.agents/skills/operate-document-harness/`에 둡니다.

## Harness Mapping

| Codex Need | Harness Surface |
| --- | --- |
| durable repo guidance | root `AGENTS.md` |
| reusable agent templates | `docs/_templates/agents.md`, `docs/_templates/claude.md` |
| repository-local harness workflow | `.agents/skills/operate-document-harness/SKILL.md` and thin `.claude/skills/operate-document-harness/SKILL.md` adapter |
| mature repository adoption | `docs/ADOPT.md`, `docs/architecture/harness-adoption-plane.md` |
| detailed operating rules | `docs/guide/codex-agent-guidance.md` |
| goal and system context | `docs/architecture/control-plane.md` |
| DDD domain truth | `docs/design/domain-landscape.md`, `docs/design/context-map.md`, affected `docs/design/contexts/<context>/` set |
| DDD authoring and role loading | `docs/guide/ddd-domain-design.md`, `docs/_indexes/context-packets.yaml` |
| harness vocabulary | `docs/architecture/harness-language.md` |
| scalable retrieval and freshness | `docs/architecture/retrieval-plane.md`, `docs/_indexes/retrieval-policy.yaml` |
| policy authority and approval | `docs/governance/policy-to-evidence.md`, `docs/guide/policy-proposal-and-approval.md` |
| policy/guideline to delivery portfolio | `docs/governance/initiative-governance.md`, `docs/guide/initiative-governance.md`, `docs/initiatives/` |
| resumable execution state | current task, current checkpoint, `docs/architecture/execution-loop-plane.md` |
| human-readable status (`Board`) | `docs/guide/human-control-view.md` derived projection |
| repository policy extraction | `docs/guide/repository-policy-extraction.md` candidate workflow |
| work decomposition | `docs/initiatives/`, `docs/projects/`, and `docs/tasks/` |
| verification | `docs/bin/validate-codex-readiness.sh` and related validators |

## Prompt Shape

When a human asks Codex to do harness work, prefer this shape:

1. Goal: what should change or become possible.
2. Context: relevant docs, templates, examples, failures, or official references.
3. Constraints: scope, project issuance rules, source handling, compatibility, or safety rules.
4. Done when: validators, generated docs, closeout evidence, or human-visible result.

When policy or risk authority is involved, also separate:

5. Effective authority: exact human policy, normative rule, approval, and exception refs.
6. Proposal: AI inference, options, assumptions, and exact human decision still needed.

For loop-enabled work, externalize current hypothesis, last evidence, next actor/action, attention, and stop/resume conditions in the checkpoint rather than relying on chat history.

If the request is broad or ambiguous, Codex should first identify the likely surfaces and propose a short plan before editing. If the task is narrow and clear, Codex should implement and verify directly.

## AGENTS.md Contract

Root `AGENTS.md` should stay concise and include these sections:

- `Repository Map`
- `Codex Workflow`
- `Documentation Rules`
- `Verification Commands`
- `Done Criteria`

Do not duplicate the full contents of `docs/README.md` in `AGENTS.md`. Link to durable docs and keep only the high-value operating rules that Codex needs before it can safely choose files.

When a source file changed during the current task, or an index cannot prove it contains the required source revision, Codex reads the source file directly and treats the index only as a candidate-selection surface. This rule belongs in both root `AGENTS.md` and the reusable template.

Root guidance also states that AI-authored policy/standard/exception proposals cannot self-approve, lifecycle `status` remains separate from `loop_state`, and meaningful execution transitions update the current checkpoint. Detailed schema stays in the governance and execution guides rather than expanding `AGENTS.md` into a manual.

It also states that a new `I####` requires explicit human issuance authority and an exact approval ref. AI may draft an unnumbered initiative proposal, but it must not infer issuance or activation approval from an existing umbrella project, code, or chat context.

`docs/design/` is reserved for DDD domain-model truth. Root guidance requires the agent to identify affected bounded contexts, load the actor-specific packet, and verify approved/current exact model bytes before delivery. Architecture mechanics belong in `docs/architecture/`; governance authority mechanics belong in `docs/governance/`. An AI-authored model remains `draft` or `review_requested` until a domain expert approves the exact bytes through a validation receipt.

For Claude Code, keep a short root `CLAUDE.md` that imports `AGENTS.md` with `@AGENTS.md` and adds only Claude-specific routing. It must point adoption work to `docs/ADOPT.md` and execution work to `docs/EXECUTE.md`; it must not copy the policy, ownership, stop, or verification rules into a competing instruction set.

During mature repository adoption, the agent reads project-owned instructions and current designs first, generates a no-write ownership/conflict plan, and keeps extraction confidence, authority, approval, and enforcement independent. Repo-local View operation remains exact-loopback/read-only and must not obtain a port by terminating another process.

## Repository-Local Harness Skill

`operate-document-harness` is installed in each adopted repository. Its canonical file is `.agents/skills/operate-document-harness/SKILL.md`; Claude uses the project adapter at `.claude/skills/operate-document-harness/SKILL.md`, which reads the canonical file instead of maintaining a second workflow.

The skill is an intent router:

- initialize, migrate, upgrade -> `docs/ADOPT.md`
- start, resume, stop, close -> `docs/EXECUTE.md` plus the current task/checkpoint
- policy/guideline extraction -> `docs/guide/repository-policy-extraction.md`
- DDD model discovery, authoring, review, or change -> `docs/guide/ddd-domain-design.md` plus the landscape, context map, and affected context set
- `Board` / Human Control View operation -> `docs/guide/human-control-view.md`

“View start” 또는 “View open”는 현재 repository에서 `human-view start` 후 `human-view url`을 수행하라는 뜻입니다. `View status`, `View refresh`, `View stop`는 각각 `status`, `refresh`, `stop`으로 route합니다. 이 별칭은 remote bind, 다른 repository 선택 또는 foreign process 종료 권한을 만들지 않습니다.

It does not own policy, approval, migration decisions, quality verdicts, execution truth, or View truth. `AGENTS.md`, human-owned governance sources, effective designs, source files, checkpoints, receipts and deterministic validators keep those responsibilities.

Do not install or update a user-global document-harness skill during repository adoption or operation. Repository-specific instructions, ports, gates and policy scope must travel with that repository.

When an adoption apply first installs the skill during an active agent session, read the canonical `SKILL.md` directly for that session. Start a new session or reload the repository before depending on automatic discovery.

## Numbered Document Issuance Rule

When Codex needs to issue a numbered `initiative`, `project`, `task`, or `qa` document, it must not run `docs/bin/new-doc.sh` from a feature branch. The document number is allocated from clean, up-to-date `main`; `new-doc.sh` commits the generated `draft` file on `main` immediately, and the work branch then merges `main` before continuing. Initiative uses `new-doc.sh initiative <slug> <issuance-approval-ref>` and must not be issued without the exact human approval ref. The ref must use the script's safe token/path/URL character set. Project uses `new-doc.sh project <slug> <initiative-id> [delivers|supports|explores]`, and the parent Initiative must be active/approved. Task uses `new-doc.sh task <slug> <project-id>`; the Project must exist and its modern Initiative lineage must resolve active/approved. Only an existing Project with complete explicit legacy `project_role`, `umbrella_initiative`, and `parent_umbrella_project` fields may use the migration grandfathering path. Codex must not infer `I0001` or `P0001` as a default.

If the current work branch is dirty, stash the work with untracked files before switching. After the main-issued draft commit is merged back into the work branch, pop the stash and resolve any conflicts. Incoming changes already deployed through `main` are accepted as the current baseline.

## Verification Contract

Codex-friendly work needs a single obvious command that checks the agent-facing harness. Use:

```bash
./docs/bin/validate-codex-readiness.sh
```

That command should check:

- root `AGENTS.md` exists and has the required sections.
- `AGENTS.md` remains below the default project instruction budget.
- the reusable AGENTS template exists.
- the root and reusable Claude adapters import `AGENTS.md` and route to ADOPT/EXECUTE without duplicating authority.
- Codex guidance is part of the foundation.
- markdown templates still include frontmatter properties.
- design templates include retrieval metadata and the agent surfaces require direct source reads for uncertain freshness.
- DDD templates contain bounded-context semantics, stable model IDs, actor views, domain-expert ownership, and exact-byte validation metadata.
- domain design and delivery lineage validators pass, including role-specific project/task/QA traceability.
- foundation and closeout validators still pass.
- governance/execution design, guide, policy index, checkpoint template, and execution validator stay aligned.
- adoption entry, ownership/policy extraction contract, templates, and validator stay aligned.
- loop-enabled task closeout cannot bypass unresolved attention or missing terminal receipts.

## Parallel Work Rule

Codex can run multiple threads, but two concurrent tasks should not modify the same document, template, or validator. For parallel documentation work, split ownership by directory or explicit file list.

## References

- [Codex AGENTS.md guidance](https://developers.openai.com/codex/guides/agents-md)
- [Codex best practices](https://developers.openai.com/codex/learn/best-practices)
- [Codex prompting](https://developers.openai.com/codex/prompting)
- [Codex Skills](https://developers.openai.com/codex/skills/)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)

## Change Log

- 2026-05-09: Codex-facing AGENTS.md, prompt shape, and readiness validator contract added.
- 2026-06-14: Numbered `project`/`task` issuance rule added for main-based draft commits.
- 2026-07-15: numbered `qa` alignment and source-authoritative freshness rule added.
- 2026-07-15: human policy authority, resumable execution checkpoint, and human-view projection mapping added.
- 2026-07-15: mature adoption routing and a thin Claude Code `@AGENTS.md` adapter were added so both tools share one authority surface.
- 2026-07-16: repository-local `operate-document-harness` canonical skill, thin Claude project adapter, no-global-install and bootstrap reload contract added.
- 2026-07-17: `Board` 사용자명과 사용자 표시 언어 View operation phrase routing을 repository-local skill contract에 추가했다.
- 2026-07-18: explicit human-approved `I####` issuance, initiative→project→task hierarchy와 legacy umbrella non-promotion rule을 추가했다.
- 2026-07-29: `docs/design/`을 DDD 전용 authority surface로 고정하고 역할별 로딩, exact-byte domain-expert approval, delivery lineage 검증 계약을 추가했다.
