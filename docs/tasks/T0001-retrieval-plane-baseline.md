---
type: task
doc_id: T0001
title: retrieval-plane-baseline
status: done
owner: Codex
created: 2026-05-16
updated: 2026-05-16
current_focus: reusable document-harness에 design retrieval index, context loading playbook, retrieval indexes, validator baseline을 추가했다.
completion_mode: functional
related_control_plane: docs/design/control-plane.md
related_umbrella_project: docs/projects/P0001-document-harness-baseline.md
related_project:
related_design:
  - docs/design/control-plane.md
  - docs/design/ubiquitous-language.md
source_refs:
  - "repo:silverstone-core:docs/reports/2026-05-16-document-taxonomy-context-window-analysis.md"
quality_axes:
  - WHOLE
  - GOAL
  - EVIDENCE
tags:
  - docs/task
  - retrieval-plane
---

# T0001 retrieval-plane-baseline

- Type: task
- Document ID: T0001
- Status: done
- Completion Mode: functional
- Owner: Codex
- Created: 2026-05-16
- Updated: 2026-05-16
- Current Focus: reusable document-harness에 design retrieval index, context loading playbook, retrieval indexes, validator baseline을 추가했다.
- Related Control Plane: docs/design/control-plane.md
- Related Umbrella Project: docs/projects/P0001-document-harness-baseline.md
- Related Project:
- Related Design:
  - `docs/design/control-plane.md`
  - `docs/design/ubiquitous-language.md`

## Purpose

이 task의 목적은 `silverstone-core`에서 검증한 document taxonomy / context-window 개선 중 reusable `document-harness`에 일반화할 수 있는 부분만 적용하는 것이다.

핵심은 기존 저장 구조를 바꾸지 않고, LLM/Codex가 어떤 문서를 context-window에 넣어야 하는지 판단할 수 있는 retrieval plane과 validator를 제공하는 것이다.

## Task Placement Check

- 이 작업은 새 project가 아니라 reusable harness의 bounded docs/validator 개선이다.
- active product delivery나 별도 owner가 없으므로 task로 충분하며, 사용자가 새 project 발급을 승인하지 않았다.

## Whole-System Anchor

- document harness는 storage taxonomy와 retrieval taxonomy를 분리해야 한다.
- `design`, `project`, `task`, `guide`, `report`의 저장 위치는 유지한다.
- LLM이 작업을 시작할 때 active/current truth를 먼저 읽고 historical evidence를 나중에 읽도록 guide와 validator가 도와야 한다.

## Completion Mode Notes

- 이 task는 `functional` mode를 사용한다.
- 완료 상태는 retrieval guide/index/validator가 실제로 존재하고 readiness/foundation/closeout validators가 통과하는 것이다.

## Committed Outcome

- `docs/design/README.md`가 design retrieval index로 존재한다.
- `docs/guide/context-loading-playbooks.md`가 work type별 context loading 규칙을 제공한다.
- `docs/_indexes/`가 active docs, design map, context packet manifest를 제공한다.
- `docs/bin/validate-doc-retrieval.sh`가 active surface, design index, context packet broad-load guard를 검증한다.
- 기존 foundation/readiness validator가 retrieval validator를 호출한다.

## Goal Inventory

| Goal ID | Locked Goal | Done When |
| --- | --- | --- |
| G1 | reusable design retrieval index를 추가한다 | `docs/design/README.md`와 `docs/_indexes/design-map.md`가 design docs를 context-loading 관점으로 분류한다 |
| G2 | context loading playbook과 context packet manifest를 추가한다 | work type별 load/avoid/search/output 규칙과 broad-load 금지 manifest가 있다 |
| G3 | retrieval validator를 추가하고 readiness/foundation에 연결한다 | `validate-doc-retrieval.sh`가 통과하고 `validate-harness-foundation.sh` / `validate-codex-readiness.sh`가 이를 실행한다 |
| G4 | docs-only validation으로 닫는다 | readiness, foundation, retrieval, closeout, diff check가 통과한다 |

## Scope

- design retrieval index
- context loading playbook
- `_indexes` retrieval-plane files
- active/design/context packet validator
- README/control-plane/llm-wiki/AGENTS verification command alignment

## Out Of Scope

- project/task/report storage taxonomy 변경
- embedding/RAG system 도입
- 모든 downstream project migration
- `silverstone-core`의 Silverstone-specific design summary card 이식

## References

- `repo:silverstone-core:docs/reports/2026-05-16-document-taxonomy-context-window-analysis.md`
- `docs/design/control-plane.md`
- `docs/design/ubiquitous-language.md`
- `docs/guide/llm-wiki-operations.md`

## Dependencies

- Existing docs harness validators and templates.

## WBS

| ID | Work Item | Status | Progress | Notes |
| --- | --- | --- | --- | --- |
| W1 | Add retrieval guide/index docs | Done | 100% | design README, context playbook, `_indexes` |
| W2 | Add validator and hook into readiness | Done | 100% | `validate-doc-retrieval.sh` plus foundation/readiness path |
| W3 | Update docs references and closeout | Done | 100% | README/control-plane/llm-wiki/AGENTS and validation evidence |

## Overall Progress

- 100%

## Completion Criteria

1. design retrieval index exists.
2. context loading playbook exists.
3. retrieval validator exists and is called by foundation/readiness validation.
4. docs validators pass.

## Completion Evidence

- `./docs/bin/validate-doc-retrieval.sh` passed on 2026-05-16.
- `./docs/bin/validate-harness-foundation.sh` passed on 2026-05-16.
- `./docs/bin/validate-codex-readiness.sh` passed on 2026-05-16.
- `./docs/bin/validate-closeout.sh --all` passed on 2026-05-16.
- `git diff --check` passed on 2026-05-16.

## Outputs / Handoff

- `docs/design/README.md`
- `docs/guide/context-loading-playbooks.md`
- `docs/_indexes/active-docs.md`
- `docs/_indexes/design-map.md`
- `docs/_indexes/context-packets.yaml`
- `docs/bin/validate-doc-retrieval.sh`

## Quality Axes In Scope

| Axis | Why It Matters Here | Required Evidence |
| --- | --- | --- |
| WHOLE | reusable harness must preserve storage taxonomy while adding retrieval control | control-plane/README/guide/index alignment |
| GOAL | retrieval plane must actually be usable by Codex | guide, index, validator files exist |
| EVIDENCE | docs-only work must be validator-backed | docs validators and diff check pass |

## Goal Verification

| Goal ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| G1 | Done | `docs/design/README.md`, `docs/_indexes/design-map.md` | both design docs indexed |
| G2 | Done | `docs/guide/context-loading-playbooks.md`, `docs/_indexes/context-packets.yaml` | default packets avoid broad docs |
| G3 | Done | `docs/bin/validate-doc-retrieval.sh`, foundation/readiness validator updates | validator integrated |
| G4 | Done | readiness/foundation/retrieval/closeout/diff checks passed | runtime verification not required |

## Completion Guardrails

- 기존 storage taxonomy를 바꾸지 않는다.
- active 문서 drift는 validator로 잡는다.
- context packet은 all-design/all-task/full UL 같은 broad load를 기본값으로 삼지 않는다.

## Risks / Open Questions

- This repository is a reusable template, so downstream projects still need to adopt `docs/_indexes/` and playbook content after copying/upgrading the harness.

## Status

- 2026-05-16: task 문서 생성 및 완료. Retrieval plane baseline applied to reusable document harness and docs validators passed.
