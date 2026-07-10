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
  report    -> docs/reports/YYYY-MM-DD-slug.md
  qa        -> docs/qa/QA0001-slug.md

Notes:
  task/project/qa issuance must run from a clean, up-to-date main branch.
  The generated task/project/qa draft is committed on main automatically.
EOF
}

slugify() {
  printf '%s' "$1" \
    | perl -CS -Mutf8 -pe '
        $_ = lc $_;
        s/^\s+|\s+$//g;
        s{[/\\]+}{-}g;
        s/\s+/-/g;
        s/[^\p{Letter}\p{Number}\-]+/-/g;
        s/-+/-/g;
        s/^-+//;
        s/-+$//;
      '
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

require_numbered_doc_issue_context() {
  if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "error: task/project docs require a git worktree so main-based issuance can be verified" >&2
    exit 1
  fi

  local branch
  branch="$(git -C "$ROOT_DIR" symbolic-ref --quiet --short HEAD || true)"
  if [[ "$branch" != "main" ]]; then
    echo "error: task/project docs must be issued from main, not '${branch:-detached HEAD}'" >&2
    echo "hint: stash dirty branch work, switch to main, update it, issue and commit the draft, then merge main back into the work branch" >&2
    exit 1
  fi

  if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
    echo "error: task/project docs must be issued from a clean main worktree" >&2
    echo "hint: commit or stash local changes before issuing the numbered draft" >&2
    exit 1
  fi

  local upstream
  upstream="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [[ -n "$upstream" ]]; then
    local behind
    behind="$(git -C "$ROOT_DIR" rev-list --count "HEAD..$upstream" 2>/dev/null || printf '0')"
    if [[ "${behind:-0}" != "0" ]]; then
      echo "error: main is behind $upstream; update main before issuing a task/project doc" >&2
      echo "hint: git pull --ff-only" >&2
      exit 1
    fi
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

commit_numbered_doc_draft() {
  local output="$1"
  local doc_id="$2"
  local slug="$3"

  git -C "$ROOT_DIR" add -- "$output"
  git -C "$ROOT_DIR" commit -m "docs: issue ${doc_id} ${slug}"
}

if [[ $# -ne 2 ]]; then
  usage
  exit 1
fi

TYPE="$1"
RAW_SLUG="$2"
SLUG="$(slugify "$RAW_SLUG")"
NUMBERED_DOC="false"

if [[ -z "$SLUG" ]]; then
  echo "error: slug must contain at least one letter or number" >&2
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
    NUMBERED_DOC="true"
    ;;
  project)
    DOC_DIR="$ROOT_DIR/projects"
    TEMPLATE="$ROOT_DIR/_templates/project.md"
    NUMBER="$(next_number "$DOC_DIR" "P")"
    DOC_ID="P${NUMBER}"
    TITLE="$SLUG"
    OUTPUT="$DOC_DIR/${DOC_ID}-${SLUG}.md"
    NUMBERED_DOC="true"
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
    OUTPUT="$ROOT_DIR/reports/${TODAY}-${SLUG}.md"
    ;;
  qa)
    DOC_DIR="$ROOT_DIR/qa"
    mkdir -p "$DOC_DIR"
    TEMPLATE="$ROOT_DIR/_templates/qa.md"
    NUMBER="$(next_number "$DOC_DIR" "QA")"
    DOC_ID="QA${NUMBER}"
    TITLE="$SLUG"
    OUTPUT="$DOC_DIR/${DOC_ID}-${SLUG}.md"
    NUMBERED_DOC="true"
    ;;
  *)
    usage
    exit 1
    ;;
esac

if [[ "$NUMBERED_DOC" == "true" ]]; then
  require_numbered_doc_issue_context
fi

if [[ -e "$OUTPUT" ]]; then
  echo "error: target already exists: $OUTPUT" >&2
  exit 1
fi

render_template "$TEMPLATE" "$OUTPUT" "$DOC_ID" "$TITLE"
if [[ "$NUMBERED_DOC" == "true" ]]; then
  commit_numbered_doc_draft "$OUTPUT" "$DOC_ID" "$SLUG"
  echo "hint: draft committed on main; push/share if needed, then merge main back into the work branch" >&2
fi
echo "$OUTPUT"
