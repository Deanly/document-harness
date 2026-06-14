#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/.." && pwd)"

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

DOCS_README="$ROOT_DIR/README.md"
CONTROL_PLANE="$ROOT_DIR/design/control-plane.md"
QUALITY_AXES="$ROOT_DIR/guide/quality-axes.md"
ARTIFACT_CONTRACTS="$ROOT_DIR/guide/artifact-contracts.md"
UBIQUITOUS_LANGUAGE="$ROOT_DIR/design/ubiquitous-language.md"
LLM_WIKI_OPERATIONS="$ROOT_DIR/guide/llm-wiki-operations.md"
CODEX_AGENT_GUIDANCE="$ROOT_DIR/guide/codex-agent-guidance.md"
PROJECT_CUTTING="$ROOT_DIR/guide/project-cutting-and-execution.md"
DOCUMENT_LIFECYCLE="$ROOT_DIR/guide/document-lifecycle-and-active-reading.md"
AGENTS_FILE="$REPO_ROOT/AGENTS.md"
AGENTS_TEMPLATE="$ROOT_DIR/_templates/agents.md"
NEW_DOC_SCRIPT="$ROOT_DIR/bin/new-doc.sh"
CODEX_READINESS="$ROOT_DIR/bin/validate-codex-readiness.sh"
DOC_RETRIEVAL="$ROOT_DIR/bin/validate-doc-retrieval.sh"

require_file "$DOCS_README"
require_file "$AGENTS_FILE"
require_file "$AGENTS_TEMPLATE"
require_file "$CONTROL_PLANE"
require_file "$QUALITY_AXES"
require_file "$ARTIFACT_CONTRACTS"
require_file "$UBIQUITOUS_LANGUAGE"
require_file "$LLM_WIKI_OPERATIONS"
require_file "$CODEX_AGENT_GUIDANCE"
require_file "$PROJECT_CUTTING"
require_file "$DOCUMENT_LIFECYCLE"
require_file "$NEW_DOC_SCRIPT"
require_file "$CODEX_READINESS"
require_file "$DOC_RETRIEVAL"

for header in \
  "## Repository Map" \
  "## Codex Workflow" \
  "## Documentation Rules" \
  "## Verification Commands" \
  "## Done Criteria"
do
  require_section "$AGENTS_FILE" "$header"
done

for header in \
  "## Purpose" \
  "## Whole-System Outcome" \
  "## Control Surfaces" \
  "## Active Design Surfaces" \
  "## Umbrella Initiative Policy" \
  "## Active Umbrella Projects" \
  "## Active Execution Surfaces" \
  "## Standard Pipeline" \
  "## Quality Axes" \
  "## Required Validators" \
  "## Handoff Rules" \
  "## Change Log"
do
  require_section "$CONTROL_PLANE" "$header"
done

for header in \
  "## Purpose" \
  "## How To Use" \
  "## Axes" \
  "## Minimum Review Set" \
  "## Change Log"
do
  require_section "$QUALITY_AXES" "$header"
done

for header in \
  "## Purpose" \
  "## Control Surfaces" \
  "## Artifact Contracts By Type" \
  "## Handoff Matrix" \
  "## Change Log"
do
  require_section "$ARTIFACT_CONTRACTS" "$header"
done

for header in \
  "## Purpose" \
  "## Fit To This Harness" \
  "## Source Layer" \
  "## Ingest Workflow" \
  "## Query Workflow" \
  "## Lint Workflow" \
  "## Index And Log Mapping" \
  "## Properties Contract" \
  "## Change Log"
do
  require_section "$LLM_WIKI_OPERATIONS" "$header"
done

for header in \
  "## Purpose" \
  "## Codex Loading Model" \
  "## Harness Mapping" \
  "## Prompt Shape" \
  "## AGENTS.md Contract" \
  "## Numbered Document Issuance Rule" \
  "## Verification Contract" \
  "## Parallel Work Rule" \
  "## Change Log"
do
  require_section "$CODEX_AGENT_GUIDANCE" "$header"
done

require_section "$PROJECT_CUTTING" "## Main-Issued Numbered Document Rule"
require_section "$DOCUMENT_LIFECYCLE" "## Lifecycle Rules"
require_contains "$DOCS_README" '`task`와 `project` 번호 발급 기준 브랜치는 항상 `main`입니다.'
require_contains "$AGENTS_FILE" 'Issue numbered `project`/`task` docs only from clean, up-to-date `main`'
require_contains "$AGENTS_TEMPLATE" 'Issue numbered `project`/`task` docs only from clean, up-to-date `main`'
require_contains "$NEW_DOC_SCRIPT" "require_numbered_doc_issue_context"
require_contains "$NEW_DOC_SCRIPT" "commit_numbered_doc_draft"

"$DOC_RETRIEVAL"

echo "Validated harness foundation."
