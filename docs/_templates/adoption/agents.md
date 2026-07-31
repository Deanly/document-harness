# Repository Agent Contract

This repository uses the repository-local document harness.

- Read `docs/ADOPT.md` before initialize, migrate, upgrade, verify, or rollback work.
- Read `docs/EXECUTE.md` before starting or resuming loop-enabled work.
- Use `.agents/skills/operate-document-harness/SKILL.md` as the local workflow router; it creates no policy or approval authority.
- Treat policy, guideline, and initiative as mandatory upper governance. Before project/task work, direct-read current lineage, effective refs, approvals, and freshness; stop on missing, stale, unapproved-required, or conflicting governance.
- Treat `docs/design/` as DDD-only domain truth. Before project/task/QA work, identify affected bounded contexts, load the actor-specific packet, and verify authoritative/current exact model bytes through `docs/lib/domain-design-authority.mjs`. Route semantic changes through `ai-domain-expert`; it may promote routine, reversible changes only inside an exact delegated-authority fence and must escalate material, strategic, conflicted, low-confidence, customer-rights, money, legal, security, ownership, context split/merge, or irreversible decisions to the Board as a minimum-sufficient human-readable domain model.
- Use `docs/guide/governance-authoring-assistance.md` to help users with question-led locale-appropriate drafts that keep policy WHY, guideline HOW, and initiative outcome separate. AI assistance never grants approval.
- Normal Board content requires a short human-facing title and complete summary in configured `presentation.locale`. If presentation is missing or invalid, show only a `사람용 설명 필요` attention with the exact source ref; never promote IDs, paths, commands, hashes, or technical headings as the visible title or summary.
- Use `docs/bin/new-doc.sh` for reusable document drafts. Issue numbered initiative/project/task/QA documents only from a clean, current `main`; the script commits those drafts on `main`. Initiative needs a safe exact human issuance ref. Project/Task modern lineage also needs a repository-relative JSON activation receipt whose human decision, candidate ID, source revision/hashes and current canonical Initiative bytes pass `docs/lib/initiative-authority.mjs`; active/approved prose alone grants no authority. Do not infer default parent IDs; complete explicit legacy Project lineage is the migration-only exception.
- Run `docs/bin/validate-domain-design.sh --all`, `docs/bin/validate-domain-lineage.sh --all`, `docs/bin/validate-execution-loop.sh --all`, and `docs/bin/validate-closeout.sh --all` before claiming project/task/QA completion.
- Preserve project-owned files and dirty tracked/untracked changes.
- Never self-grant or widen domain authority, and never self-approve policy, exceptions, migration conflicts, risk acceptance, organizational ownership, strategic domain decisions, or weakened checks.
- Treat `Board` as the configurable user-facing name of this repository's read-only View. Route “View start” to `runtime/document-harness-view/bin/human-view start` followed by `url`; keep exact loopback and an OS-assigned port.
- Treat `INSTALLED_NOT_VERIFIED` and `INSTALLED_AWAITING_REVIEW` as incomplete.

Project-specific instructions may extend this file. They must not weaken human approval, source-fence, ownership, rollback, or verification boundaries.
