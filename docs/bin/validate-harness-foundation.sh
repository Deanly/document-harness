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

CONTROL_PLANE="$ROOT_DIR/design/control-plane.md"
QUALITY_AXES="$ROOT_DIR/guide/quality-axes.md"
ARTIFACT_CONTRACTS="$ROOT_DIR/guide/artifact-contracts.md"
UBIQUITOUS_LANGUAGE="$ROOT_DIR/design/ubiquitous-language.md"
LLM_WIKI_OPERATIONS="$ROOT_DIR/guide/llm-wiki-operations.md"
CODEX_AGENT_GUIDANCE="$ROOT_DIR/guide/codex-agent-guidance.md"
AGENTS_FILE="$REPO_ROOT/AGENTS.md"
AGENTS_TEMPLATE="$ROOT_DIR/_templates/agents.md"
CODEX_READINESS="$ROOT_DIR/bin/validate-codex-readiness.sh"

require_file "$AGENTS_FILE"
require_file "$AGENTS_TEMPLATE"
require_file "$CONTROL_PLANE"
require_file "$QUALITY_AXES"
require_file "$ARTIFACT_CONTRACTS"
require_file "$UBIQUITOUS_LANGUAGE"
require_file "$LLM_WIKI_OPERATIONS"
require_file "$CODEX_AGENT_GUIDANCE"
require_file "$CODEX_READINESS"

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
  "## Verification Contract" \
  "## Parallel Work Rule" \
  "## Change Log"
do
  require_section "$CODEX_AGENT_GUIDANCE" "$header"
done

echo "Validated harness foundation."
