#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TODAY="$(date +%F)"

usage() {
  cat <<'EOF'
Usage:
  ./docs/bin/close-doc.sh <doc-path> "<status-note>"

Behavior:
  - Refuses Initiative closeout until coordinated document/register/receipt updates exist.
  - For Project and Task, runs validate-closeout first.
  - Sets top-level Status to done.
  - Updates Updated date to today.
  - Appends a closeout entry in the Status section.
EOF
}

metadata_value() {
  local file="$1"
  local key="$2"

  awk -v prefix="- ${key}: " -v raw_key="$key" '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }

    BEGIN {
      fm_key = tolower(raw_key)
      gsub(/[ -]+/, "_", fm_key)
    }

    NR == 1 && $0 == "---" {
      in_frontmatter = 1
      next
    }

    in_frontmatter && $0 == "---" {
      in_frontmatter = 0
      next
    }

    in_frontmatter && $0 ~ /^[A-Za-z_][A-Za-z0-9_]*:[[:space:]]*/ {
      key = $0
      sub(/:.*/, "", key)
      value = $0
      sub(/^[^:]*:[[:space:]]*/, "", value)
      value = trim(value)
      if (tolower(key) == fm_key && value != "") {
        print value
        exit
      }
      next
    }

    index($0, prefix) == 1 {
      value = substr($0, length(prefix) + 1)
      print trim(value)
      exit
    }
  ' "$file"
}

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

DOC_PATH="$1"
shift
STATUS_NOTE="$*"

if [[ ! -f "$DOC_PATH" ]]; then
  echo "error: file not found: $DOC_PATH" >&2
  exit 1
fi

DOC_TYPE="$(metadata_value "$DOC_PATH" "Type")"
DOC_STATUS="$(metadata_value "$DOC_PATH" "Status")"

if [[ "$DOC_TYPE" != "initiative" && "$DOC_TYPE" != "task" && "$DOC_TYPE" != "project" ]]; then
  echo "error: only initiative/task/project docs can be closed with this script: $DOC_PATH" >&2
  exit 1
fi

if [[ "$DOC_TYPE" == "initiative" ]]; then
  echo "error: Initiative closeout is not supported by close-doc.sh until a coordinated document/register/receipt workflow is implemented." >&2
  echo "action: have a human update the canonical Initiative document, docs/_indexes/initiative-register.json, and the exact terminal decision receipt in one change set, then run ./docs/bin/validate-closeout.sh $DOC_PATH." >&2
  exit 1
fi

case "$DOC_STATUS" in
  done|closed|cancelled|superseded)
    echo "error: document already has terminal status '$DOC_STATUS': $DOC_PATH" >&2
    exit 1
    ;;
esac

"$ROOT_DIR/bin/validate-closeout.sh" "$DOC_PATH"

TMP_FILE="$(mktemp)"
cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT

STATUS_LINE="- ${TODAY}: closeout gate passed via \`./docs/bin/validate-closeout.sh ${DOC_PATH}\`. ${STATUS_NOTE}"

awk -v today="$TODAY" -v status_line="$STATUS_LINE" '
  BEGIN {
    updated_rewritten = 0
    status_rewritten = 0
    fm_updated_rewritten = 0
    fm_status_rewritten = 0
    in_status_section = 0
    status_section_seen = 0
    status_line_inserted = 0
  }

  NR == 1 && $0 == "---" {
    print
    in_frontmatter = 1
    frontmatter_seen = 1
    next
  }

  in_frontmatter && $0 == "---" {
    print
    in_frontmatter = 0
    next
  }

  in_frontmatter && /^status:[[:space:]]*/ && !fm_status_rewritten {
    print "status: done"
    fm_status_rewritten = 1
    next
  }

  in_frontmatter && /^updated:[[:space:]]*/ && !fm_updated_rewritten {
    print "updated: " today
    fm_updated_rewritten = 1
    next
  }

  $0 == "## Status" {
    if (in_status_section && !status_line_inserted) {
      print status_line
      status_line_inserted = 1
    }
    print
    in_status_section = 1
    status_section_seen = 1
    next
  }

  /^## / && in_status_section {
    if (!status_line_inserted) {
      print status_line
      status_line_inserted = 1
    }
    in_status_section = 0
  }

  /^- Status: / && !status_rewritten {
    print "- Status: done"
    status_rewritten = 1
    next
  }

  /^- Updated: / && !updated_rewritten {
    print "- Updated: " today
    updated_rewritten = 1
    next
  }

  {
    print
  }

  END {
    if (!status_rewritten) {
      exit 10
    }
    if (!updated_rewritten) {
      exit 11
    }
    if (!status_section_seen) {
      exit 12
    }
    if (frontmatter_seen && !fm_status_rewritten) {
      exit 13
    }
    if (frontmatter_seen && !fm_updated_rewritten) {
      exit 14
    }
    if (in_status_section && !status_line_inserted) {
      print status_line
    }
  }
' "$DOC_PATH" > "$TMP_FILE"

"$ROOT_DIR/bin/validate-closeout.sh" "$TMP_FILE"

mv "$TMP_FILE" "$DOC_PATH"
trap - EXIT

echo "$DOC_PATH"
