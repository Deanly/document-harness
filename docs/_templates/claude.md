@AGENTS.md

# Claude Code

- For document-harness workflows, use the project skill at `.claude/skills/operate-document-harness/SKILL.md`; it delegates to the canonical `.agents` skill and adds no authority.
- For repository initialization, migration, or upgrade, read `docs/ADOPT.md` before writing.
- For loop-enabled task execution, read `docs/EXECUTE.md` and the current checkpoint before acting.
- Apply the same human-policy, approval, ownership, checkpoint, stop, and verification boundaries defined in `AGENTS.md`; this file does not create a second rule set.
- Treat instructions as behavioral guidance and deterministic validators/permission controls as the enforcement layer.
