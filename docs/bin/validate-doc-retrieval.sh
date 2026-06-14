#!/usr/bin/env bash

set -euo pipefail

DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESIGN_README="$DOCS_DIR/design/README.md"
CONTEXT_PACKETS="$DOCS_DIR/_indexes/context-packets.yaml"

error_count=0

error() {
  echo "error: $*" >&2
  error_count=$((error_count + 1))
}

status_of() {
  local file="$1"

  awk '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }

    NR == 1 && $0 == "---" {
      in_frontmatter = 1
      next
    }

    in_frontmatter && $0 == "---" {
      in_frontmatter = 0
      next
    }

    in_frontmatter && tolower($0) ~ /^status:[[:space:]]*/ {
      value = $0
      sub(/^[^:]*:[[:space:]]*/, "", value)
      print tolower(trim(value))
      found = 1
      exit
    }

    /^- Status:[[:space:]]*/ {
      value = $0
      sub(/^- Status:[[:space:]]*/, "", value)
      print tolower(trim(value))
      found = 1
      exit
    }

    END {
      if (!found) {
        print ""
      }
    }
  ' "$file"
}

has_frontmatter() {
  [[ -f "$1" && "$(sed -n '1p' "$1")" == "---" ]]
}

is_active_status() {
  case "$1" in
    active|current) return 0 ;;
    *) return 1 ;;
  esac
}

is_inactive_status() {
  case "$1" in
    done|closed|completed|cancelled|superseded) return 0 ;;
    *) return 1 ;;
  esac
}

active_section() {
  local readme="$1"

  awk '
    /^## Active[[:space:]]*$/ {
      in_active = 1
      next
    }
    in_active && /^## / {
      in_active = 0
    }
    in_active {
      print
    }
  ' "$readme"
}

validate_active_folder() {
  local folder="$1"
  local glob="$2"
  local readme="$folder/README.md"
  local active_text
  local file
  local base
  local status

  if [[ ! -f "$readme" ]]; then
    error "missing active README: $readme"
    return
  fi

  active_text="$(active_section "$readme")"

  shopt -s nullglob
  for file in "$folder"/$glob; do
    [[ "$(basename "$file")" == "README.md" ]] && continue
    base="$(basename "$file")"
    status="$(status_of "$file")"

    if is_active_status "$status"; then
      if ! grep -Fq "$base" <<<"$active_text"; then
        error "active doc missing from README Active section: $file"
      fi
      if ! has_frontmatter "$file"; then
        error "active doc missing YAML frontmatter: $file"
      fi
    elif is_inactive_status "$status"; then
      if grep -Fq "$base" <<<"$active_text"; then
        error "README Active section includes inactive doc ($status): $file"
      fi
    fi
  done
  shopt -u nullglob
}

validate_design_index() {
  local file
  local base
  local count
  local line
  local pipes

  if [[ ! -f "$DESIGN_README" ]]; then
    error "missing design retrieval index: $DESIGN_README"
    return
  fi

  shopt -s nullglob
  for file in "$DOCS_DIR"/design/*.md; do
    base="$(basename "$file")"
    [[ "$base" == "README.md" ]] && continue

    if ! has_frontmatter "$file"; then
      error "design doc missing YAML frontmatter: $file"
    fi

    count="$(grep -F "$base" "$DESIGN_README" | grep -Ec '^\| \[' || true)"
    if [[ "$count" != "1" ]]; then
      error "design doc must appear exactly once in docs/design/README.md: $base (found $count)"
      continue
    fi

    line="$(grep -F "$base" "$DESIGN_README" | grep -E '^\| \[')"
    pipes="$(awk -F'|' '{ print NF - 1 }' <<<"$line")"
    if (( pipes < 8 )); then
      error "design index row is missing required columns: $base"
    fi
  done
  shopt -u nullglob

  if ! grep -F "control-plane.md" "$DESIGN_README" | grep -Fq "core-start"; then
    error "control-plane.md must be marked as core-start in docs/design/README.md"
  fi

  if ! grep -F "ubiquitous-language.md" "$DESIGN_README" | grep -Fq "term-excerpt"; then
    error "ubiquitous-language.md must be marked as term-excerpt in docs/design/README.md"
  fi

  if ! grep -Fq "section-load" "$DESIGN_README"; then
    error "docs/design/README.md must document section-load behavior for ubiquitous-language.md"
  fi
}

validate_context_packets() {
  if [[ ! -f "$CONTEXT_PACKETS" ]]; then
    error "missing context packet manifest: $CONTEXT_PACKETS"
    return
  fi

  awk -v path="$CONTEXT_PACKETS" '
    function push_error(message) {
      errors[++error_count] = message
    }

    /^[[:space:]]{4}default_load:[[:space:]]*$/ {
      in_default = 1
      next
    }

    /^[[:space:]]{4}[A-Za-z_][A-Za-z0-9_-]*:[[:space:]]*$/ && $0 !~ /^[[:space:]]{4}default_load:/ {
      in_default = 0
    }

    in_default && /docs\/design\/\*\.md/ {
      push_error("default context packet includes all design docs")
    }

    in_default && /docs\/tasks\/\*\.md/ {
      push_error("default context packet includes all task docs")
    }

    in_default && /docs\/projects\/\*\.md/ {
      push_error("default context packet includes all project docs")
    }

    in_default && /docs\/design\/ubiquitous-language\.md/ {
      push_error("default context packet includes full ubiquitous-language.md")
    }

    END {
      for (i = 1; i <= error_count; i++) {
        print "error: " errors[i] " in " path > "/dev/stderr"
      }
      exit error_count ? 1 : 0
    }
  ' "$CONTEXT_PACKETS" || error "context packet manifest has forbidden default load entries"
}

validate_active_folder "$DOCS_DIR/projects" 'P*.md'
validate_active_folder "$DOCS_DIR/tasks" 'T*.md'
validate_active_folder "$DOCS_DIR/reports" '*.md'
validate_design_index
validate_context_packets

if (( error_count > 0 )); then
  exit 1
fi

echo "Validated doc retrieval surfaces."
