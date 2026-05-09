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
CODEX_GUIDE="$DOCS_DIR/guide/codex-agent-guidance.md"

require_file "$AGENTS_FILE"
require_file "$AGENTS_TEMPLATE"
require_file "$CODEX_GUIDE"

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
  "## Verification Contract" \
  "## Parallel Work Rule" \
  "## Change Log"
do
  require_section "$CODEX_GUIDE" "$header"
done

for template in \
  "$DOCS_DIR/_templates/design.md" \
  "$DOCS_DIR/_templates/guide.md" \
  "$DOCS_DIR/_templates/project.md" \
  "$DOCS_DIR/_templates/report.md" \
  "$DOCS_DIR/_templates/task.md"
do
  require_frontmatter "$template"
done

"$DOCS_DIR/bin/validate-harness-foundation.sh"
"$DOCS_DIR/bin/validate-closeout.sh" --all

echo "Validated Codex readiness."
