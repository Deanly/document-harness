---
type: architecture
title: project-control-plane
status: draft
domain: control-plane
owner: human
initialization_required: true
source_refs: []
tags:
  - docs/architecture
  - control-plane
  - adoption
---

# Project Control Plane

## Purpose

This project-owned document is the human-readable direction and invariant surface for the repository. Adoption creates it only when the target has no existing `docs/architecture/control-plane.md`; a mature repository's existing control plane is preserved.

## Current Direction

Not established by the initializer. The AI may summarize source-linked policy and guideline candidates, but a human must review the direction before it becomes an effective project constraint.

## Non-Negotiable Boundaries

- Existing project-owned files and dirty tracked or untracked work remain preserved.
- AI-authored policy candidates, observations, and View rows are not human approval.
- `Board` is the configurable user-facing name of the Human Control View, a read-only projection of repository source and receipts. Policy and guideline are separate top-level reading surfaces.
- `docs/design/` is the DDD domain truth. AI Domain Expert is the highest supervisory authority below the human decision owner: it may challenge every delivery role and block unresolved meaning, while material/strategic decisions and risk acceptance remain human.
- Board Domain must present model/implementation conflicts, impacts, options, the AI Domain Expert engineering recommendation, and the exact human decision required. A human choice to change code or model is not completion until a new aligned review exists.
- A migration is incomplete until the installed release fence, required gates, and human review evidence pass verification.

## Project Quality Gates

Replace the generated fast, full, and continuous command declarations with real project checks before claiming `MIGRATION_VERIFIED`. A missing or unavailable command is not a pass.

## Active Control Surfaces

- `docs/ADOPT.md`: initialize, migrate, upgrade, verify, and rollback.
- `docs/EXECUTE.md`: bounded execution loop and checkpoint handoff.
- `docs/design/`: authoritative DDD landscape, context map, bounded-context models, language, and examples.
- `docs/_indexes/governance-catalog.json`: source-linked candidates and review gaps.
- `runtime/document-harness-view/`: repository-local read-only projection.

## Initialization Checklist

- [ ] Human-readable project direction is confirmed.
- [ ] Existing policy and guideline sources are captured with repository revision and SHA-256 fences.
- [ ] Conflicts, unknowns, and missing authority are visible as attention or gaps.
- [ ] Affected delivery work has a current exact-byte AI Domain Expert supervision review and unresolved decisions are visible on Board.
- [ ] Real project fast, full, and continuous quality commands are declared.
- [ ] Human decisions and gate evidence are recorded without AI self-approval.
