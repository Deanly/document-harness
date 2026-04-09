#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TODAY="$(date +%F)"

usage() {
  cat <<'EOF'
Usage:
  ./docs/bin/new-doc.sh <type> <slug>

Types:
  task      -> docs/tasks/T0001-slug.md
  project   -> docs/projects/P0001-slug.md
  design    -> docs/design/slug.md
  guide     -> docs/guide/slug.md
  report    -> docs/reports/report-slug.md
EOF
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

next_number() {
  local dir="$1"
  local prefix="$2"
  local max

  max="$(
    find "$dir" -maxdepth 1 -type f -name "${prefix}[0-9][0-9][0-9][0-9]-*.md" \
      | sed -E "s|.*/${prefix}([0-9]{4})-.*|\\1|" \
      | sort -n \
      | tail -1
  )"

  if [[ -z "${max:-}" ]]; then
    printf '0001'
  else
    printf '%04d' "$((10#$max + 1))"
  fi
}

render_template() {
  local template="$1"
  local output="$2"
  local doc_id="$3"
  local title="$4"

  sed \
    -e "s/{{DOC_ID}}/${doc_id}/g" \
    -e "s/{{TITLE}}/${title}/g" \
    -e "s/{{DATE}}/${TODAY}/g" \
    "$template" > "$output"
}

if [[ $# -ne 2 ]]; then
  usage
  exit 1
fi

TYPE="$1"
RAW_SLUG="$2"
SLUG="$(slugify "$RAW_SLUG")"

if [[ -z "$SLUG" ]]; then
  echo "error: slug must contain at least one alphanumeric character" >&2
  exit 1
fi

case "$TYPE" in
  task)
    DOC_DIR="$ROOT_DIR/tasks"
    TEMPLATE="$ROOT_DIR/_templates/task.md"
    NUMBER="$(next_number "$DOC_DIR" "T")"
    DOC_ID="T${NUMBER}"
    TITLE="$SLUG"
    OUTPUT="$DOC_DIR/${DOC_ID}-${SLUG}.md"
    ;;
  project)
    DOC_DIR="$ROOT_DIR/projects"
    TEMPLATE="$ROOT_DIR/_templates/project.md"
    NUMBER="$(next_number "$DOC_DIR" "P")"
    DOC_ID="P${NUMBER}"
    TITLE="$SLUG"
    OUTPUT="$DOC_DIR/${DOC_ID}-${SLUG}.md"
    ;;
  design)
    TEMPLATE="$ROOT_DIR/_templates/design.md"
    DOC_ID=""
    TITLE="$SLUG"
    OUTPUT="$ROOT_DIR/design/${SLUG}.md"
    ;;
  guide)
    TEMPLATE="$ROOT_DIR/_templates/guide.md"
    DOC_ID=""
    TITLE="$SLUG"
    OUTPUT="$ROOT_DIR/guide/${SLUG}.md"
    ;;
  report)
    TEMPLATE="$ROOT_DIR/_templates/report.md"
    DOC_ID=""
    TITLE="$SLUG"
    OUTPUT="$ROOT_DIR/reports/report-${SLUG}.md"
    ;;
  *)
    usage
    exit 1
    ;;
esac

if [[ -e "$OUTPUT" ]]; then
  echo "error: target already exists: $OUTPUT" >&2
  exit 1
fi

render_template "$TEMPLATE" "$OUTPUT" "$DOC_ID" "$TITLE"
echo "$OUTPUT"
