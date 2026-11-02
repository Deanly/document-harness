@AGENTS.md

# Claude Code

Superpowers is a required execution-method dependency. Follow `docs/guide/superpowers-integration.md`: read `superpowers:using-superpowers` and applicable installed skills before work; preserve document-harness goals, authority, approvals, checkpoints, and evidence as the continuity contract. Resume existing approved work instead of restarting it. Record missing skills as `SUPERPOWERS_UNAVAILABLE` and do not claim dependent execution is verified. The integration guide defines routing, recovery, adoption, and evidence requirements for both Codex and Claude.

- For document-harness workflows, use the project skill at `.claude/skills/operate-document-harness/SKILL.md`; it delegates to the canonical `.agents` skill and adds no authority.
- For repository initialization, migration, or upgrade, read `docs/ADOPT.md` before writing.
- For loop-enabled task execution, read `docs/EXECUTE.md` and the current checkpoint before acting.
- Before project/task work, follow the mandatory governance preflight in `docs/guide/governance-authoring-assistance.md` and stop on missing, stale, unapproved-required, or conflicting policy/guideline/initiative authority.
- When helping a user write governance, use the same guide's question-led locale-appropriate draft and human-review protocol; keep policy WHY, guideline HOW, and initiative outcome separate.
- Apply the same human-policy, approval, ownership, checkpoint, stop, and verification boundaries defined in `AGENTS.md`; this file does not create a second rule set.
- Treat instructions as behavioral guidance and deterministic validators/permission controls as the enforcement layer.
