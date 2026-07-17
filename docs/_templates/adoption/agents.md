# Repository Agent Contract

This repository uses the repository-local document harness.

- Read `docs/ADOPT.md` before initialize, migrate, upgrade, verify, or rollback work.
- Read `docs/EXECUTE.md` before starting or resuming loop-enabled work.
- Use `.agents/skills/operate-document-harness/SKILL.md` as the local workflow router; it creates no policy or approval authority.
- Preserve project-owned files and dirty tracked/untracked changes.
- Never self-approve policy, exceptions, migration conflicts, risk acceptance, or weakened checks.
- Operate the read-only View through `runtime/document-harness-view/bin/human-view` on exact loopback and an OS-assigned port.
- Treat `INSTALLED_NOT_VERIFIED` and `INSTALLED_AWAITING_REVIEW` as incomplete.

Project-specific instructions may extend this file. They must not weaken human approval, source-fence, ownership, rollback, or verification boundaries.
