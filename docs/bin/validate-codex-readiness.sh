#!/usr/bin/env bash

set -euo pipefail

DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$DOCS_DIR/.." && pwd)"
MAX_AGENTS_BYTES=32768

require_file() {
  local path="$1"

  if [[ ! -f "$path" ]]; then
    echo "error: missing required file: $path" >&2
    return 1
  fi
}

require_section() {
  local path="$1"
  local header="$2"

  if ! grep -Fq "$header" "$path"; then
    echo "error: missing section '$header' in $path" >&2
    return 1
  fi
}

require_contains() {
  local path="$1"
  local pattern="$2"

  if ! grep -Fq "$pattern" "$path"; then
    echo "error: missing expected text '$pattern' in $path" >&2
    return 1
  fi
}

require_frontmatter() {
  local path="$1"

  require_file "$path"

  if [[ "$(sed -n '1p' "$path")" != "---" ]]; then
    echo "error: missing YAML frontmatter start in $path" >&2
    return 1
  fi

  require_contains "$path" "source_refs:"
  require_contains "$path" "tags:"
}

AGENTS_FILE="$REPO_ROOT/AGENTS.md"
AGENTS_TEMPLATE="$DOCS_DIR/_templates/agents.md"
CLAUDE_FILE="$REPO_ROOT/CLAUDE.md"
CLAUDE_TEMPLATE="$DOCS_DIR/_templates/claude.md"
CODEX_GUIDE="$DOCS_DIR/guide/codex-agent-guidance.md"
NEW_DOC_SCRIPT="$DOCS_DIR/bin/new-doc.sh"
EXECUTION_ENTRY="$DOCS_DIR/EXECUTE.md"
EXECUTION_LOOP="$DOCS_DIR/architecture/execution-loop-plane.md"
HUMAN_VIEW_DESIGN="$DOCS_DIR/architecture/human-control-view-plane.md"
POLICY_GOVERNANCE="$DOCS_DIR/governance/policy-to-evidence.md"
EXECUTION_POLICY="$DOCS_DIR/_indexes/execution-loop-policy.yaml"
EXECUTION_CHECKPOINT_TEMPLATE="$DOCS_DIR/_templates/execution-checkpoint.md"
EXECUTION_VALIDATOR="$DOCS_DIR/bin/validate-execution-loop.sh"
ADOPTION_ENTRY="$DOCS_DIR/ADOPT.md"
ADOPTION_DESIGN="$DOCS_DIR/architecture/harness-adoption-plane.md"
ADOPTION_GUIDE="$DOCS_DIR/guide/repository-policy-extraction.md"
ADOPTION_VALIDATOR="$DOCS_DIR/bin/validate-harness-adoption.sh"
DOMAIN_DESIGN_GUIDE="$DOCS_DIR/guide/ddd-domain-design.md"
DOMAIN_DESIGN_VALIDATOR="$DOCS_DIR/bin/validate-domain-design.sh"
DOMAIN_LINEAGE_VALIDATOR="$DOCS_DIR/bin/validate-domain-lineage.sh"
CODEX_HARNESS_SKILL="$REPO_ROOT/.agents/skills/operate-document-harness/SKILL.md"
CODEX_HARNESS_SKILL_METADATA="$REPO_ROOT/.agents/skills/operate-document-harness/agents/openai.yaml"
CLAUDE_HARNESS_SKILL="$REPO_ROOT/.claude/skills/operate-document-harness/SKILL.md"

require_file "$AGENTS_FILE"
require_file "$AGENTS_TEMPLATE"
require_file "$CLAUDE_FILE"
require_file "$CLAUDE_TEMPLATE"
require_file "$CODEX_GUIDE"
require_file "$NEW_DOC_SCRIPT"
require_file "$EXECUTION_ENTRY"
require_file "$EXECUTION_LOOP"
require_file "$HUMAN_VIEW_DESIGN"
require_file "$POLICY_GOVERNANCE"
require_file "$EXECUTION_POLICY"
require_file "$EXECUTION_CHECKPOINT_TEMPLATE"
require_file "$EXECUTION_VALIDATOR"
require_file "$ADOPTION_ENTRY"
require_file "$ADOPTION_DESIGN"
require_file "$ADOPTION_GUIDE"
require_file "$ADOPTION_VALIDATOR"
require_file "$DOMAIN_DESIGN_GUIDE"
require_file "$DOMAIN_DESIGN_VALIDATOR"
require_file "$DOMAIN_LINEAGE_VALIDATOR"
require_file "$CODEX_HARNESS_SKILL"
require_file "$CODEX_HARNESS_SKILL_METADATA"
require_file "$CLAUDE_HARNESS_SKILL"

agents_bytes="$(wc -c < "$AGENTS_FILE" | tr -d '[:space:]')"
if (( agents_bytes > MAX_AGENTS_BYTES )); then
  echo "error: AGENTS.md is ${agents_bytes} bytes, above ${MAX_AGENTS_BYTES}" >&2
  exit 1
fi

for header in \
  "## Repository Map" \
  "## Codex Workflow" \
  "## Documentation Rules" \
  "## Verification Commands" \
  "## Done Criteria"
do
  require_section "$AGENTS_FILE" "$header"
  require_section "$AGENTS_TEMPLATE" "$header"
done

for header in \
  "## Purpose" \
  "## Codex Loading Model" \
  "## Harness Mapping" \
  "## Prompt Shape" \
  "## AGENTS.md Contract" \
  "## Repository-Local Harness Skill" \
  "## Numbered Document Issuance Rule" \
  "## Verification Contract" \
  "## Parallel Work Rule" \
  "## Change Log"
do
  require_section "$CODEX_GUIDE" "$header"
done

require_contains "$AGENTS_FILE" 'Issue numbered `initiative`/`project`/`task`/`qa` docs only from clean, up-to-date `main`'
require_contains "$AGENTS_TEMPLATE" 'Issue numbered `initiative`/`project`/`task`/`qa` docs only from clean, up-to-date `main`'
require_contains "$AGENTS_FILE" 'Issue Project only under an active/approved Initiative'
require_contains "$AGENTS_TEMPLATE" 'Issue Project only under an active/approved Initiative'
require_contains "$AGENTS_FILE" 'If a file changed during the current task or retrieval freshness is uncertain, read the source file directly; never treat an index hit as authoritative.'
require_contains "$AGENTS_TEMPLATE" 'If a file changed during the current task or retrieval freshness is uncertain, read the source file directly; never treat an index hit as authoritative.'
require_contains "$AGENTS_FILE" 'AI may draft policy/standard/exception proposals but must not self-approve them.'
require_contains "$AGENTS_TEMPLATE" 'AI may draft policy/standard/exception proposals but must not self-approve them.'
require_contains "$AGENTS_FILE" 'docs/ADOPT.md'
require_contains "$AGENTS_TEMPLATE" 'docs/ADOPT.md'
require_contains "$AGENTS_FILE" 'docs/EXECUTE.md'
require_contains "$AGENTS_TEMPLATE" 'docs/EXECUTE.md'
require_contains "$AGENTS_FILE" '.agents/skills/operate-document-harness/SKILL.md'
require_contains "$AGENTS_TEMPLATE" '.agents/skills/operate-document-harness/SKILL.md'
require_contains "$AGENTS_FILE" 'never install or update a user-global document-harness skill'
require_contains "$AGENTS_TEMPLATE" 'never install or update a user-global document-harness skill'
require_contains "$AGENTS_FILE" './docs/bin/validate-execution-loop.sh --all'
require_contains "$AGENTS_TEMPLATE" './docs/bin/validate-execution-loop.sh --all'
require_contains "$AGENTS_FILE" './docs/bin/validate-harness-adoption.sh'
require_contains "$AGENTS_TEMPLATE" './docs/bin/validate-harness-adoption.sh'
require_contains "$AGENTS_FILE" './docs/bin/validate-domain-design.sh --all'
require_contains "$AGENTS_TEMPLATE" './docs/bin/validate-domain-design.sh --all'
require_contains "$AGENTS_FILE" 'docs/design/` is reserved for DDD domain-model truth'
require_contains "$AGENTS_TEMPLATE" 'docs/design/` is reserved for DDD domain-model truth'
require_contains "$CLAUDE_FILE" '@AGENTS.md'
require_contains "$CLAUDE_TEMPLATE" '@AGENTS.md'
require_contains "$CLAUDE_FILE" 'docs/ADOPT.md'
require_contains "$CLAUDE_TEMPLATE" 'docs/ADOPT.md'
require_contains "$CLAUDE_FILE" 'docs/EXECUTE.md'
require_contains "$CLAUDE_TEMPLATE" 'docs/EXECUTE.md'
require_contains "$CLAUDE_FILE" '.claude/skills/operate-document-harness/SKILL.md'
require_contains "$CLAUDE_TEMPLATE" '.claude/skills/operate-document-harness/SKILL.md'
require_contains "$CODEX_HARNESS_SKILL" 'name: operate-document-harness'
require_contains "$CODEX_HARNESS_SKILL" 'repository-local router'
require_contains "$CODEX_HARNESS_SKILL_METADATA" 'Use $operate-document-harness'
require_contains "$CLAUDE_HARNESS_SKILL" '../../../.agents/skills/operate-document-harness/SKILL.md'
require_contains "$NEW_DOC_SCRIPT" "require_numbered_doc_issue_context"
require_contains "$NEW_DOC_SCRIPT" "commit_numbered_doc_draft"
require_contains "$NEW_DOC_SCRIPT" "validate_issuance_approval_ref"
require_contains "$NEW_DOC_SCRIPT" "require_active_approved_initiative"
require_contains "$NEW_DOC_SCRIPT" "require_task_parent_lineage"

for template in \
  "$DOCS_DIR/_templates/design.md" \
  "$DOCS_DIR/_templates/guide.md" \
  "$DOCS_DIR/_templates/initiative.md" \
  "$DOCS_DIR/_templates/project.md" \
  "$DOCS_DIR/_templates/qa.md" \
  "$DOCS_DIR/_templates/report.md" \
  "$DOCS_DIR/_templates/task.md" \
  "$EXECUTION_CHECKPOINT_TEMPLATE"
do
  require_frontmatter "$template"
done

require_contains "$DOCS_DIR/_templates/design.md" 'design_kind: bounded-context'
require_contains "$DOCS_DIR/_templates/design.md" 'domain_expert_roles:'
require_contains "$DOCS_DIR/_templates/design.md" 'role_views:'
require_contains "$DOCS_DIR/_templates/report.md" 'proposal_status:'
require_contains "$DOCS_DIR/_templates/task.md" 'execution_contract: v1'
require_contains "$DOCS_DIR/_templates/task.md" 'loop_state: ready'
require_contains "$DOCS_DIR/_templates/task.md" 'domain_contract: v1'
require_contains "$DOCS_DIR/_templates/project.md" 'domain_contract: v1'
require_contains "$DOCS_DIR/_templates/qa.md" '| Rule ID | Scenario ID |'

for header in \
  '## Purpose' '## Load Order' '## Start Gate' '## Execute Loop' \
  '## State Routing' '## Evidence Barrier' '## Stop And Ask' \
  '## Closeout' '## Verification' '## Human Handoff'
do
  require_section "$EXECUTION_ENTRY" "$header"
done

"$DOCS_DIR/bin/validate-harness-foundation.sh"
"$ADOPTION_VALIDATOR"
"$DOCS_DIR/bin/validate-closeout.sh" --all

echo "Validated Codex readiness."
