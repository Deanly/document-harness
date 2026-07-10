# AGENTS.md

## Repository Map

- `README.md` is the human quickstart for this reusable document harness.
- `docs/README.md` is the main schema for document types, issuing rules, update rules, and commands.
- `docs/design/control-plane.md` is the top-level control surface for goals, pipeline, validators, and handoff rules.
- `docs/design/ubiquitous-language.md` holds canonical terms.
- `docs/guide/` holds reusable operating rules, including Codex guidance and artifact contracts.
- `docs/_templates/` holds templates used by `docs/bin/new-doc.sh`.
- `docs/bin/` holds deterministic helper scripts and validators.
- `docs/examples/` contains filled examples; use these before inventing a new document shape.

## Codex Workflow

- Start by reading this file, then `docs/README.md`, then the specific guide/design/template relevant to the task.
- For ambiguous or broad work, first identify goal, context, constraints, and done criteria before editing.
- Keep changes scoped to the requested harness behavior. Avoid unrelated rewrites or style churn.
- Prefer `rg` and the scripts in `docs/bin/` for navigation and verification.
- When changing document rules, update the template, the guide that explains the rule, and the validator in the same change when applicable.
- Do not issue a new `project` document unless the user explicitly asks for it or approves it. Suggest the need and rationale instead.
- Issue numbered `project`/`task`/`qa` docs only from clean, up-to-date `main`; commit the draft on `main` immediately, then merge `main` back into the work branch. If the work branch is dirty, stash before switching.

## Documentation Rules

- Preserve YAML frontmatter on generated markdown templates.
- Keep frontmatter properties and first-screen bullet metadata in sync.
- Keep `source_refs` populated when a claim depends on raw source material, external docs, transcripts, datasets, or official references.
- `design` documents hold current truth; `task` and `project` status sections hold append-only execution history.
- If a reusable answer emerges from a report or conversation, promote it into `guide`, `design`, `project`, or `task` as appropriate.
- Prefer adding a narrow guide over expanding `docs/README.md` when a rule needs detailed explanation.

## Verification Commands

Run these after harness changes:

```bash
./docs/bin/validate-codex-readiness.sh
./docs/bin/validate-harness-foundation.sh
./docs/bin/validate-doc-retrieval.sh
./docs/bin/validate-closeout.sh --all
git diff --check
```

When changing only a focused script or template, still run `./docs/bin/validate-codex-readiness.sh` before closing the task if feasible.

## Done Criteria

A harness change is done only when:

- The relevant docs and templates agree with each other.
- Codex-facing instructions remain concise enough to load automatically.
- Validators pass or any skipped validator is explicitly explained.
- The final response names the changed surfaces and the verification result.
