#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TODAY="$(date +%F)"
INITIATIVE_AUTHORITY_VALIDATOR="$ROOT_DIR/lib/initiative-authority.mjs"

usage() {
  cat <<'EOF'
Usage:
  ./docs/bin/new-doc.sh initiative <slug> <issuance-approval-ref>
  ./docs/bin/new-doc.sh project <slug> <initiative-id> [delivers|supports|explores]
  ./docs/bin/new-doc.sh task <slug> <project-id>
  ./docs/bin/new-doc.sh design <domain-landscape|context-map|bounded-context|ubiquitous-language|domain-examples> <bounded-context|all> <slug>
  ./docs/bin/new-doc.sh <guide|report|qa> <slug>

Types:
  initiative -> docs/initiatives/I0001-slug.md
  task      -> docs/tasks/T0001-slug.md
  project   -> docs/projects/P0001-slug.md
  design    -> docs/design/{domain-landscape|context-map}.md or docs/design/contexts/<bounded-context>/<slug>.md
  guide     -> docs/guide/slug.md
  report    -> docs/reports/YYYY-MM-DD-slug.md
  qa        -> docs/qa/QA0001-slug.md

Notes:
  initiative/task/project/qa issuance must run from a clean, up-to-date main branch.
  Initiative issuance requires an exact human issuance-approval ref.
  Project issuance requires a canonical parent Initiative with a current source-fenced human activation receipt.
  Task issuance requires a Project whose modern Initiative lineage passes the same activation authority gate;
  complete explicit legacy Project lineage is accepted only as a migration grandfathering case.
  No default I0001/P0001 is inferred.
  The generated initiative/task/project/qa draft is committed on main automatically.
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

validate_issuance_approval_ref() {
  local value="$1"

  if (( ${#value} > 512 )); then
    echo "error: issuance approval ref must be at most 512 characters" >&2
    exit 1
  fi

  # This value is rendered into unquoted YAML and human-visible Markdown. Keep
  # it to a stable ASCII token/relative-path/URL character set so it cannot
  # create a new YAML key, Markdown construct, or shell-like line of content.
  if [[ ! "$value" =~ ^[A-Za-z0-9][A-Za-z0-9._~:/?@%+,\&=\#-]*$ ]]; then
    echo "error: issuance approval ref contains unsafe characters" >&2
    echo "hint: use a durable ASCII token, repository-relative path, or http(s) URL without whitespace, quotes, brackets, backticks, pipes, or backslashes" >&2
    exit 1
  fi

  if [[ "$value" != http://* && "$value" != https://* && "$value" =~ (^|/)\.\.(/|$) ]]; then
    echo "error: issuance approval ref repository path must not contain '..' segments" >&2
    exit 1
  fi
}

next_number() {
  local dir="$1"
  local prefix="$2"
  local max

  if [[ ! -d "$dir" ]]; then
    printf '0001'
    return
  fi

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
    echo "error: initiative/task/project/qa docs require a git worktree so main-based issuance can be verified" >&2
    exit 1
  fi

  local branch
  branch="$(git -C "$ROOT_DIR" symbolic-ref --quiet --short HEAD || true)"
  if [[ "$branch" != "main" ]]; then
    echo "error: initiative/task/project/qa docs must be issued from main, not '${branch:-detached HEAD}'" >&2
    echo "hint: stash dirty branch work, switch to main, update it, issue and commit the draft, then merge main back into the work branch" >&2
    exit 1
  fi

  if [[ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
    echo "error: initiative/task/project/qa docs must be issued from a clean main worktree" >&2
    echo "hint: commit or stash local changes before issuing the numbered draft" >&2
    exit 1
  fi

  local upstream
  upstream="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [[ -n "$upstream" ]]; then
    local behind
    behind="$(git -C "$ROOT_DIR" rev-list --count "HEAD..$upstream" 2>/dev/null || printf '0')"
    if [[ "${behind:-0}" != "0" ]]; then
      echo "error: main is behind $upstream; update main before issuing an initiative/task/project/qa doc" >&2
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
  local issuance_approval_ref="$5"
  local related_initiative="$6"
  local initiative_relation="$7"
  local related_project="$8"
  local design_kind="$9"
  local bounded_context="${10}"

  DOC_ID_VALUE="$doc_id" \
  TITLE_VALUE="$title" \
  DATE_VALUE="$TODAY" \
  ISSUANCE_APPROVAL_REF_VALUE="$issuance_approval_ref" \
  RELATED_INITIATIVE_VALUE="$related_initiative" \
  INITIATIVE_RELATION_VALUE="$initiative_relation" \
  RELATED_PROJECT_VALUE="$related_project" \
  DESIGN_KIND_VALUE="$design_kind" \
  BOUNDED_CONTEXT_VALUE="$bounded_context" \
    perl -pe '
      s/\{\{DOC_ID\}\}/$ENV{DOC_ID_VALUE}/g;
      s/\{\{TITLE\}\}/$ENV{TITLE_VALUE}/g;
      s/\{\{DATE\}\}/$ENV{DATE_VALUE}/g;
      s/\{\{ISSUANCE_APPROVAL_REF\}\}/$ENV{ISSUANCE_APPROVAL_REF_VALUE}/g;
      s/\{\{RELATED_INITIATIVE\}\}/$ENV{RELATED_INITIATIVE_VALUE}/g;
      s/\{\{INITIATIVE_RELATION\}\}/$ENV{INITIATIVE_RELATION_VALUE}/g;
      s/\{\{RELATED_PROJECT\}\}/$ENV{RELATED_PROJECT_VALUE}/g;
      s/\{\{DESIGN_KIND\}\}/$ENV{DESIGN_KIND_VALUE}/g;
      s/\{\{BOUNDED_CONTEXT\}\}/$ENV{BOUNDED_CONTEXT_VALUE}/g;
    ' "$template" > "$output"
}

require_parent_doc() {
  local directory="$1"
  local doc_id="$2"
  local label="$3"
  local matches=()

  if [[ -d "$directory" ]]; then
    while IFS= read -r match; do
      matches+=("$match")
    done < <(find "$directory" -maxdepth 1 -type f -name "${doc_id}-*.md" -print)
  fi

  if [[ ${#matches[@]} -eq 0 ]]; then
    echo "error: ${label} parent does not exist: ${doc_id}" >&2
    exit 1
  fi
  if [[ ${#matches[@]} -ne 1 ]]; then
    echo "error: ${label} parent ID is ambiguous: ${doc_id}" >&2
    exit 1
  fi

  PARENT_DOC_PATH="${matches[0]}"
}

frontmatter_scalar() {
  local file="$1"
  local requested_key="$2"

  awk -v requested_key="$requested_key" '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      return value
    }
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit }
    in_frontmatter {
      separator = index($0, ":")
      if (separator == 0) next
      key = trim(substr($0, 1, separator - 1))
      if (key != requested_key) next
      value = trim(substr($0, separator + 1))
      if (value ~ /^".*"$/ || value ~ /^\047.*\047$/) value = substr(value, 2, length(value) - 2)
      print value
      exit
    }
  ' "$file"
}

require_active_approved_initiative() {
  local initiative_id="$1"
  local child_label="$2"
  local initiative_path
  local document_type
  local document_id
  local contract
  local lifecycle_status
  local approval_status
  local issuance_approval_ref
  local approval_ref

  require_parent_doc "$ROOT_DIR/initiatives" "$initiative_id" "$child_label"
  initiative_path="$PARENT_DOC_PATH"
  document_type="$(frontmatter_scalar "$initiative_path" "type")"
  document_id="$(frontmatter_scalar "$initiative_path" "doc_id")"
  contract="$(frontmatter_scalar "$initiative_path" "initiative_contract")"
  lifecycle_status="$(frontmatter_scalar "$initiative_path" "status")"
  approval_status="$(frontmatter_scalar "$initiative_path" "approval_status")"
  issuance_approval_ref="$(frontmatter_scalar "$initiative_path" "issuance_approval_ref")"
  approval_ref="$(frontmatter_scalar "$initiative_path" "approval_ref")"

  if [[ "$document_type" != "initiative" || "$document_id" != "$initiative_id" || "$contract" != "v1" ]]; then
    echo "error: ${child_label} parent must be the canonical initiative_contract v1 document: ${initiative_id}" >&2
    exit 1
  fi

  if [[ "$lifecycle_status" != "active" || "$approval_status" != "approved" ]]; then
    echo "error: ${child_label} parent initiative must be active and approved: ${initiative_id}" >&2
    echo "hint: current initiative state is status='${lifecycle_status:-missing}', approval_status='${approval_status:-missing}'" >&2
    exit 1
  fi
  if [[ -z "$issuance_approval_ref" || -z "$approval_ref" ]]; then
    echo "error: ${child_label} parent initiative must retain exact issuance_approval_ref and approval_ref values: ${initiative_id}" >&2
    exit 1
  fi

  if ! node "$INITIATIVE_AUTHORITY_VALIDATOR" \
    --root "$(dirname "$ROOT_DIR")" \
    --initiative "$initiative_id"; then
    echo "error: ${child_label} parent initiative activation authority is not current: ${initiative_id}" >&2
    exit 1
  fi
}

require_task_parent_lineage() {
  local project_id="$1"
  local project_path
  local lineage_contract
  local related_initiative
  local project_role
  local umbrella_initiative
  local parent_umbrella_project

  require_parent_doc "$ROOT_DIR/projects" "$project_id" "task"
  project_path="$PARENT_DOC_PATH"
  lineage_contract="$(frontmatter_scalar "$project_path" "lineage_contract")"
  related_initiative="$(frontmatter_scalar "$project_path" "related_initiative")"

  if [[ -n "$related_initiative" ]]; then
    if [[ ! "$related_initiative" =~ ^I[0-9]{4}$ ]]; then
      echo "error: task parent project has an invalid related_initiative: ${related_initiative}" >&2
      exit 1
    fi
    require_active_approved_initiative "$related_initiative" "task"
    return
  fi

  if [[ "$lineage_contract" == "v2" ]]; then
    echo "error: task parent project declares lineage_contract v2 but has no related_initiative: ${project_id}" >&2
    exit 1
  fi

  project_role="$(frontmatter_scalar "$project_path" "project_role")"
  umbrella_initiative="$(frontmatter_scalar "$project_path" "umbrella_initiative")"
  parent_umbrella_project="$(frontmatter_scalar "$project_path" "parent_umbrella_project")"
  if [[ -z "$project_role" || -z "$umbrella_initiative" || -z "$parent_umbrella_project" ]]; then
    echo "error: task parent project has no approved modern initiative lineage or complete explicit legacy lineage: ${project_id}" >&2
    echo "hint: modern parents need related_initiative -> active/approved I####; legacy parents need project_role, umbrella_initiative, and parent_umbrella_project" >&2
    exit 1
  fi
  if [[ "$project_role" != "umbrella" && "$project_role" != "exception-branch" ]]; then
    echo "error: task parent project has unsupported legacy project_role: ${project_role}" >&2
    exit 1
  fi
}

commit_numbered_doc_draft() {
  local output="$1"
  local doc_id="$2"
  local slug="$3"

  git -C "$ROOT_DIR" add -- "$output"
  git -C "$ROOT_DIR" commit -m "docs: issue ${doc_id} ${slug}"
}

if [[ $# -lt 2 || $# -gt 4 ]]; then
  usage
  exit 1
fi

TYPE="$1"
RAW_SLUG="$2"
ARG3="${3:-}"
ARG4="${4:-}"
DESIGN_KIND=""
BOUNDED_CONTEXT=""
ISSUANCE_APPROVAL_REF=""
RELATED_INITIATIVE=""
INITIATIVE_RELATION=""
RELATED_PROJECT=""
NUMBERED_DOC="false"

if [[ "$TYPE" == "design" ]]; then
  if [[ $# -ne 4 ]]; then
    usage
    exit 1
  fi
  DESIGN_KIND="$2"
  BOUNDED_CONTEXT="$(slugify "$3")"
  RAW_SLUG="$4"
fi

SLUG="$(slugify "$RAW_SLUG")"

if [[ -z "$SLUG" ]]; then
  echo "error: slug must contain at least one letter or number" >&2
  exit 1
fi

case "$TYPE" in
  initiative)
    ISSUANCE_APPROVAL_REF="$ARG3"
    if [[ -n "$ARG4" ]]; then
      echo "error: initiative accepts only <slug> <issuance-approval-ref>" >&2
      exit 1
    fi
    if [[ -z "$ISSUANCE_APPROVAL_REF" ]]; then
      echo "error: initiative issuance requires an exact human approval ref as the third argument" >&2
      echo "hint: prepare an unnumbered proposal first and issue I#### only after explicit human approval" >&2
      exit 1
    fi
    validate_issuance_approval_ref "$ISSUANCE_APPROVAL_REF"
    DOC_DIR="$ROOT_DIR/initiatives"
    TEMPLATE="$ROOT_DIR/_templates/initiative.md"
    NUMBER="$(next_number "$DOC_DIR" "I")"
    DOC_ID="I${NUMBER}"
    TITLE="$SLUG"
    OUTPUT="$DOC_DIR/${DOC_ID}-${SLUG}.md"
    NUMBERED_DOC="true"
    ;;
  task)
    RELATED_PROJECT="$ARG3"
    if [[ ! "$RELATED_PROJECT" =~ ^P[0-9]{4}$ || -n "$ARG4" ]]; then
      echo "error: task issuance requires exactly one existing parent project ID in P#### format" >&2
      exit 1
    fi
    require_task_parent_lineage "$RELATED_PROJECT"
    DOC_DIR="$ROOT_DIR/tasks"
    TEMPLATE="$ROOT_DIR/_templates/task.md"
    NUMBER="$(next_number "$DOC_DIR" "T")"
    DOC_ID="T${NUMBER}"
    TITLE="$SLUG"
    OUTPUT="$DOC_DIR/${DOC_ID}-${SLUG}.md"
    NUMBERED_DOC="true"
    ;;
  project)
    RELATED_INITIATIVE="$ARG3"
    INITIATIVE_RELATION="${ARG4:-delivers}"
    if [[ ! "$RELATED_INITIATIVE" =~ ^I[0-9]{4}$ ]]; then
      echo "error: project issuance requires an existing parent initiative ID in I#### format" >&2
      exit 1
    fi
    if [[ "$INITIATIVE_RELATION" != "delivers" && "$INITIATIVE_RELATION" != "supports" && "$INITIATIVE_RELATION" != "explores" ]]; then
      echo "error: project initiative relation must be delivers, supports, or explores" >&2
      exit 1
    fi
    require_active_approved_initiative "$RELATED_INITIATIVE" "project"
    DOC_DIR="$ROOT_DIR/projects"
    TEMPLATE="$ROOT_DIR/_templates/project.md"
    NUMBER="$(next_number "$DOC_DIR" "P")"
    DOC_ID="P${NUMBER}"
    TITLE="$SLUG"
    OUTPUT="$DOC_DIR/${DOC_ID}-${SLUG}.md"
    NUMBERED_DOC="true"
    ;;
  design)
    case "$DESIGN_KIND" in
      domain-landscape)
        [[ "$BOUNDED_CONTEXT" == "all" ]] || { echo "error: domain-landscape requires bounded-context 'all'" >&2; exit 1; }
        DOC_DIR="$ROOT_DIR/design"
        TEMPLATE="$ROOT_DIR/_templates/design-domain-landscape.md"
        ;;
      context-map)
        [[ "$BOUNDED_CONTEXT" == "all" ]] || { echo "error: context-map requires bounded-context 'all'" >&2; exit 1; }
        DOC_DIR="$ROOT_DIR/design"
        TEMPLATE="$ROOT_DIR/_templates/design-context-map.md"
        ;;
      bounded-context)
        [[ -n "$BOUNDED_CONTEXT" && "$BOUNDED_CONTEXT" != "all" ]] || { echo "error: bounded-context design requires a concrete bounded context" >&2; exit 1; }
        DOC_DIR="$ROOT_DIR/design/contexts/$BOUNDED_CONTEXT"
        TEMPLATE="$ROOT_DIR/_templates/design.md"
        ;;
      ubiquitous-language)
        [[ -n "$BOUNDED_CONTEXT" && "$BOUNDED_CONTEXT" != "all" ]] || { echo "error: ubiquitous-language requires a concrete bounded context" >&2; exit 1; }
        DOC_DIR="$ROOT_DIR/design/contexts/$BOUNDED_CONTEXT"
        TEMPLATE="$ROOT_DIR/_templates/design-ubiquitous-language.md"
        ;;
      domain-examples)
        [[ -n "$BOUNDED_CONTEXT" && "$BOUNDED_CONTEXT" != "all" ]] || { echo "error: domain-examples requires a concrete bounded context" >&2; exit 1; }
        DOC_DIR="$ROOT_DIR/design/contexts/$BOUNDED_CONTEXT"
        TEMPLATE="$ROOT_DIR/_templates/design-examples.md"
        ;;
      *)
        echo "error: unsupported design kind: $DESIGN_KIND" >&2
        usage
        exit 1
        ;;
    esac
    mkdir -p "$DOC_DIR"
    DOC_ID=""
    TITLE="$SLUG"
    OUTPUT="$DOC_DIR/${SLUG}.md"
    ;;
  guide)
    if [[ -n "$ARG3" || -n "$ARG4" ]]; then usage; exit 1; fi
    DOC_DIR="$ROOT_DIR/guide"
    mkdir -p "$DOC_DIR"
    TEMPLATE="$ROOT_DIR/_templates/guide.md"
    DOC_ID=""
    TITLE="$SLUG"
    OUTPUT="$ROOT_DIR/guide/${SLUG}.md"
    ;;
  report)
    if [[ -n "$ARG3" || -n "$ARG4" ]]; then usage; exit 1; fi
    DOC_DIR="$ROOT_DIR/reports"
    mkdir -p "$DOC_DIR"
    TEMPLATE="$ROOT_DIR/_templates/report.md"
    DOC_ID=""
    TITLE="$SLUG"
    OUTPUT="$ROOT_DIR/reports/${TODAY}-${SLUG}.md"
    ;;
  qa)
    if [[ -n "$ARG3" || -n "$ARG4" ]]; then usage; exit 1; fi
    DOC_DIR="$ROOT_DIR/qa"
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
  mkdir -p "$DOC_DIR"
fi

if [[ -e "$OUTPUT" ]]; then
  echo "error: target already exists: $OUTPUT" >&2
  exit 1
fi

render_template "$TEMPLATE" "$OUTPUT" "$DOC_ID" "$TITLE" "$ISSUANCE_APPROVAL_REF" "$RELATED_INITIATIVE" "$INITIATIVE_RELATION" "$RELATED_PROJECT" "$DESIGN_KIND" "$BOUNDED_CONTEXT"
if [[ "$NUMBERED_DOC" == "true" ]]; then
  commit_numbered_doc_draft "$OUTPUT" "$DOC_ID" "$SLUG"
  echo "hint: draft committed on main; push/share if needed, then merge main back into the work branch" >&2
fi
echo "$OUTPUT"
