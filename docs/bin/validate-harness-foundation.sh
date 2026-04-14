#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

require_file "$CONTROL_PLANE"
require_file "$QUALITY_AXES"
require_file "$ARTIFACT_CONTRACTS"
require_file "$UBIQUITOUS_LANGUAGE"

for header in \
  "## Purpose" \
  "## Whole-System Outcome" \
  "## Control Surfaces" \
  "## Active Design Surfaces" \
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

echo "Validated harness foundation."
