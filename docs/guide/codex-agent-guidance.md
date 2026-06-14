---
type: guide
title: codex-agent-guidance
status: current
owner:
created: 2026-05-09
updated: 2026-06-14
related_project: []
related_task: []
related_design:
  - docs/design/control-plane.md
source_refs:
  - https://developers.openai.com/codex/guides/agents-md
  - https://developers.openai.com/codex/learn/best-practices
  - https://developers.openai.com/codex/prompting
tags:
  - docs/guide
  - codex
---

# codex-agent-guidance

- Type: guide
- Created: 2026-05-09
- Updated: 2026-06-14
- Related Project:
- Related Task:
- Related Design: docs/design/control-plane.md

## Purpose

이 문서는 이 하네스를 Codex가 바로 읽고, 계획하고, 수정하고, 검증할 수 있게 만드는 agent-facing 운영 규칙을 고정합니다.

Codex 공식 문서는 `AGENTS.md`를 자동으로 읽는 project guidance로 다루며, 좋은 작업 입력에는 goal, context, constraints, done criteria가 있어야 하고, 검증 가능한 명령이 있을수록 결과가 좋아진다고 설명합니다. 이 하네스는 그 기준을 문서 구조와 validator로 흡수합니다.

## Codex Loading Model

- 루트 `AGENTS.md`는 Codex가 저장소를 열 때 자동으로 읽는 기본 instruction surface입니다.
- 더 세부적인 하위 디렉터리 규칙이 필요하면 해당 디렉터리에 `AGENTS.md` 또는 `AGENTS.override.md`를 둡니다.
- 하위 instruction은 루트 instruction 뒤에 읽히므로, specialized directory rule은 가능한 한 해당 작업 디렉터리에 가깝게 둡니다.
- instruction은 기본 로딩 한도를 고려해 짧게 유지합니다. 상세 설명은 `docs/guide/`로 빼고 `AGENTS.md`에서는 링크와 핵심 규칙만 둡니다.

## Harness Mapping

| Codex Need | Harness Surface |
| --- | --- |
| durable repo guidance | root `AGENTS.md` |
| reusable agent template | `docs/_templates/agents.md` |
| detailed operating rules | `docs/guide/codex-agent-guidance.md` |
| goal and system context | `docs/design/control-plane.md` |
| domain vocabulary | `docs/design/ubiquitous-language.md` |
| work decomposition | `docs/projects/` and `docs/tasks/` |
| verification | `docs/bin/validate-codex-readiness.sh` and related validators |

## Prompt Shape

When a human asks Codex to do harness work, prefer this shape:

1. Goal: what should change or become possible.
2. Context: relevant docs, templates, examples, failures, or official references.
3. Constraints: scope, project issuance rules, source handling, compatibility, or safety rules.
4. Done when: validators, generated docs, closeout evidence, or human-visible result.

If the request is broad or ambiguous, Codex should first identify the likely surfaces and propose a short plan before editing. If the task is narrow and clear, Codex should implement and verify directly.

## AGENTS.md Contract

Root `AGENTS.md` should stay concise and include these sections:

- `Repository Map`
- `Codex Workflow`
- `Documentation Rules`
- `Verification Commands`
- `Done Criteria`

Do not duplicate the full contents of `docs/README.md` in `AGENTS.md`. Link to durable docs and keep only the high-value operating rules that Codex needs before it can safely choose files.

## Numbered Document Issuance Rule

When Codex needs to issue a numbered `project` or `task` document, it must not run `docs/bin/new-doc.sh` from a feature branch. The document number is allocated from clean, up-to-date `main`; `new-doc.sh` commits the generated `draft` file on `main` immediately, and the work branch then merges `main` before continuing.

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
- Codex guidance is part of the foundation.
- markdown templates still include frontmatter properties.
- foundation and closeout validators still pass.

## Parallel Work Rule

Codex can run multiple threads, but two concurrent tasks should not modify the same document, template, or validator. For parallel documentation work, split ownership by directory or explicit file list.

## Change Log

- 2026-05-09: Codex-facing AGENTS.md, prompt shape, and readiness validator contract added.
- 2026-06-14: Numbered `project`/`task` issuance rule added for main-based draft commits.
