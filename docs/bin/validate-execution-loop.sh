#!/usr/bin/env bash

set -euo pipefail

DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$DOCS_DIR/.." && pwd)"

EXECUTION_DESIGN="$DOCS_DIR/design/execution-loop-plane.md"
HUMAN_VIEW_DESIGN="$DOCS_DIR/design/human-control-view-plane.md"
GOVERNANCE_DESIGN="$DOCS_DIR/design/policy-to-evidence-governance.md"
EXECUTION_GUIDE="$DOCS_DIR/guide/execution-loop-operations.md"
HUMAN_VIEW_GUIDE="$DOCS_DIR/guide/human-control-view.md"
EXECUTION_ENTRY="$DOCS_DIR/EXECUTE.md"
CHECKPOINT_TEMPLATE="$DOCS_DIR/_templates/execution-checkpoint.md"
EXECUTION_POLICY="$DOCS_DIR/_indexes/execution-loop-policy.yaml"
INSTALLATION_LOCK="$DOCS_DIR/_indexes/harness-installation.yaml"
INITIATIVE_AUTHORITY_VALIDATOR="$DOCS_DIR/lib/initiative-authority.mjs"

error_count=0

usage() {
  cat <<'EOF'
Usage:
  ./docs/bin/validate-execution-loop.sh --all
  ./docs/bin/validate-execution-loop.sh <task-or-checkpoint> [...]

Behavior:
  - Always validates the public execution-loop design/guide/template/policy surfaces.
  - With --all, validates tasks that opt in with `execution_contract: v1` and all
    `docs/checkpoints/*.md` files.
  - Tasks without `execution_contract` are grandfathered and ignored.
  - Opted-in modern tasks must resolve Related Project -> receipt-backed active/approved Initiative;
    complete explicit legacy project lineage remains accepted during migration.
  - A draft task in `ready` may have a blank checkpoint_ref. Active tasks, and
    any task whose loop_state is not ready, require a checkpoint.
EOF
}

error() {
  echo "error: $*" >&2
  error_count=$((error_count + 1))
}

require_file() {
  if [[ ! -f "$1" ]]; then
    error "missing required file: ${1#$REPO_ROOT/}"
    return 1
  fi
}

require_contains() {
  local path="$1"
  local text="$2"

  if ! grep -Fq -- "$text" "$path"; then
    error "missing expected text '$text' in ${path#$REPO_ROOT/}"
  fi
}

require_section() {
  require_contains "$1" "## $2"
}

has_frontmatter() {
  [[ -f "$1" && "$(sed -n '1p' "$1")" == "---" ]]
}

frontmatter_has_key() {
  local file="$1"
  local key="$2"

  awk -v wanted="$key" '
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit found ? 0 : 1 }
    in_frontmatter && $0 ~ "^" wanted ":[[:space:]]*" { found = 1 }
    END { exit found ? 0 : 1 }
  ' "$file"
}

frontmatter_scalar() {
  local file="$1"
  local key="$2"

  awk -v wanted="$key" '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      if (s ~ /^".*"$/ || s ~ /^\047.*\047$/) {
        s = substr(s, 2, length(s) - 2)
      }
      return s
    }
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit }
    in_frontmatter && $0 ~ "^" wanted ":[[:space:]]*" {
      value = $0
      sub("^" wanted ":[[:space:]]*", "", value)
      print trim(value)
      exit
    }
  ' "$file"
}

frontmatter_list_items() {
  local file="$1"
  local key="$2"

  awk -v wanted="$key" '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      if (s ~ /^".*"$/ || s ~ /^\047.*\047$/) {
        s = substr(s, 2, length(s) - 2)
      }
      return s
    }
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit }
    in_frontmatter && $0 ~ "^" wanted ":[[:space:]]*" {
      remainder = $0
      sub("^" wanted ":[[:space:]]*", "", remainder)
      if (remainder == "[]" || remainder == "") {
        in_list = remainder == ""
        next
      }
      if (remainder ~ /^\[.*\]$/) {
        sub(/^\[/, "", remainder)
        sub(/\]$/, "", remainder)
        count = split(remainder, values, ",")
        for (i = 1; i <= count; i++) {
          value = trim(values[i])
          if (value != "") print value
        }
      }
      next
    }
    in_list && /^  -[[:space:]]+/ {
      value = $0
      sub(/^  -[[:space:]]+/, "", value)
      print trim(value)
      next
    }
    in_list && /^[^[:space:]]/ { exit }
  ' "$file"
}

frontmatter_list_count() {
  local file="$1"
  local key="$2"
  local count

  count="$(frontmatter_list_items "$file" "$key" | awk 'NF { count++ } END { print count + 0 }')"
  printf '%s' "$count"
}

frontmatter_nested_scalar() {
  local file="$1"
  local parent="$2"
  local key="$3"

  awk -v wanted_parent="$parent" -v wanted_key="$key" '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit }
    in_frontmatter && $0 == wanted_parent ":" { in_parent = 1; next }
    in_parent && /^[^[:space:]]/ { exit }
    in_parent && $0 ~ "^  " wanted_key ":[[:space:]]*" {
      value = $0
      sub("^  " wanted_key ":[[:space:]]*", "", value)
      print trim(value)
      exit
    }
  ' "$file"
}

frontmatter_section_exists() {
  local file="$1"
  local section="$2"
  grep -Fq "## $section" "$file"
}

has_meaningful_frontmatter_value() {
  local value="$1"
  [[ -n "$value" && "$value" != "null" && "$value" != "~" && "$value" != "[]" ]]
}

is_explicit_legacy_project_path() {
  [[ "$1" =~ ^docs/projects/P[0-9]{4}(-[A-Za-z0-9._-]+)?\.md$ ]]
}

find_canonical_numbered_doc() {
  local directory="$1"
  local doc_id="$2"
  local expected_type="$3"
  local owner="$4"
  local candidate
  local candidate_id
  local candidate_type
  local nullglob_was_set=0
  local -a matches=()

  CANONICAL_DOC_PATH=""
  shopt -q nullglob && nullglob_was_set=1
  shopt -s nullglob
  for candidate in "$directory/$doc_id.md" "$directory/$doc_id-"*.md; do
    [[ -f "$candidate" ]] || continue
    candidate_id="$(frontmatter_scalar "$candidate" doc_id)"
    [[ "$candidate_id" == "$doc_id" ]] && matches+=("$candidate")
  done
  (( nullglob_was_set == 1 )) || shopt -u nullglob

  if [[ ${#matches[@]} -eq 0 ]]; then
    error "$owner references missing canonical $expected_type document: $doc_id"
    return 1
  fi
  if [[ ${#matches[@]} -gt 1 ]]; then
    error "$owner resolves $doc_id to multiple canonical $expected_type documents"
    return 1
  fi

  candidate="${matches[0]}"
  candidate_type="$(frontmatter_scalar "$candidate" type)"
  if [[ "$candidate_type" != "$expected_type" ]]; then
    error "$owner resolves $doc_id to type '${candidate_type:-missing}', expected $expected_type"
    return 1
  fi
  CANONICAL_DOC_PATH="$candidate"
}

validate_active_approved_initiative_ref() {
  local initiative_id="$1"
  local owner="$2"
  local initiative_path
  local initiative_contract
  local status
  local approval_status
  local issuance_approval_ref
  local approval_ref

  if [[ ! "$initiative_id" =~ ^I[0-9]{4}$ ]]; then
    error "$owner Related Initiative must match I####: ${initiative_id:-<empty>}"
    return 1
  fi
  if ! find_canonical_numbered_doc "$DOCS_DIR/initiatives" "$initiative_id" initiative "$owner"; then
    return 1
  fi
  initiative_path="$CANONICAL_DOC_PATH"
  initiative_contract="$(frontmatter_scalar "$initiative_path" initiative_contract)"
  status="$(frontmatter_scalar "$initiative_path" status)"
  approval_status="$(frontmatter_scalar "$initiative_path" approval_status)"
  issuance_approval_ref="$(frontmatter_scalar "$initiative_path" issuance_approval_ref)"
  approval_ref="$(frontmatter_scalar "$initiative_path" approval_ref)"

  if [[ "$initiative_contract" != "v1" ]]; then
    error "$owner parent initiative $initiative_id must declare initiative_contract: v1"
    return 1
  fi
  if [[ "$status" != "active" || "$approval_status" != "approved" ]]; then
    error "$owner parent initiative $initiative_id must be active and approved (status='${status:-missing}', approval_status='${approval_status:-missing}')"
    return 1
  fi
  if ! has_meaningful_frontmatter_value "$issuance_approval_ref" || ! has_meaningful_frontmatter_value "$approval_ref"; then
    error "$owner parent initiative $initiative_id must retain exact issuance_approval_ref and approval_ref values"
    return 1
  fi

  if ! node "$INITIATIVE_AUTHORITY_VALIDATOR" \
    --root "$REPO_ROOT" \
    --initiative "$initiative_id"; then
    error "$owner parent initiative $initiative_id has no current source-fenced human activation authority"
    return 1
  fi
}

validate_explicit_legacy_project_lineage() {
  local project_path="$1"
  local owner="$2"
  local project_role
  local umbrella_initiative
  local parent_umbrella_project

  project_role="$(frontmatter_scalar "$project_path" project_role)"
  umbrella_initiative="$(frontmatter_scalar "$project_path" umbrella_initiative)"
  parent_umbrella_project="$(frontmatter_scalar "$project_path" parent_umbrella_project)"

  if [[ -z "$project_role" || -z "$umbrella_initiative" || -z "$parent_umbrella_project" ]]; then
    error "$owner has no approved modern initiative lineage or complete explicit legacy lineage"
    return 1
  fi
  if [[ "$project_role" != "umbrella" && "$project_role" != "exception-branch" ]]; then
    error "$owner has unsupported legacy project_role: $project_role"
    return 1
  fi
  if [[ "$project_role" == "umbrella" && "$parent_umbrella_project" != "self" ]]; then
    error "$owner legacy umbrella project must use parent_umbrella_project: self"
    return 1
  fi
  if [[ "$project_role" == "exception-branch" && "$parent_umbrella_project" == "self" ]]; then
    error "$owner legacy exception-branch project must reference its parent umbrella project"
    return 1
  fi
}

validate_project_governance_lineage() {
  local project_path="$1"
  local owner="$2"
  local lineage_contract
  local related_initiative

  lineage_contract="$(frontmatter_scalar "$project_path" lineage_contract)"
  related_initiative="$(frontmatter_scalar "$project_path" related_initiative)"

  if [[ -n "$lineage_contract" && "$lineage_contract" != "v2" ]]; then
    error "$owner has unsupported lineage_contract: $lineage_contract"
    return 1
  fi

  if [[ "$lineage_contract" == "v2" || -n "$related_initiative" ]]; then
    if [[ -z "$related_initiative" ]]; then
      error "$owner declares modern lineage but has no related_initiative"
      return 1
    fi
    validate_active_approved_initiative_ref "$related_initiative" "$owner"
    return $?
  fi

  validate_explicit_legacy_project_lineage "$project_path" "$owner"
}

validate_execution_task_lineage() {
  local task_path="$1"
  local owner="${task_path#$REPO_ROOT/}"
  local lineage_contract
  local related_project
  local related_umbrella_project
  local project_path

  lineage_contract="$(frontmatter_scalar "$task_path" lineage_contract)"
  related_project="$(frontmatter_scalar "$task_path" related_project)"
  related_umbrella_project="$(frontmatter_scalar "$task_path" related_umbrella_project)"

  if [[ -n "$lineage_contract" && "$lineage_contract" != "v2" ]]; then
    error "$owner has unsupported lineage_contract: $lineage_contract"
    return 1
  fi

  if [[ "$lineage_contract" == "v2" || "$related_project" =~ ^P[0-9]{4}$ ]]; then
    if [[ ! "$related_project" =~ ^P[0-9]{4}$ ]]; then
      error "$owner modern Related Project must match P####: ${related_project:-<empty>}"
      return 1
    fi
    if ! find_canonical_numbered_doc "$DOCS_DIR/projects" "$related_project" project "$owner"; then
      return 1
    fi
    project_path="$CANONICAL_DOC_PATH"
    validate_project_governance_lineage "$project_path" "$owner -> $related_project"
    return $?
  fi

  if [[ -z "$related_umbrella_project" ]]; then
    error "$owner requires modern related_project or an explicit legacy related_umbrella_project bridge"
    return 1
  fi
  if [[ -n "$related_project" ]] && ! is_explicit_legacy_project_path "$related_project"; then
    error "$owner legacy related_project mirror must be empty or match docs/projects/P####[-slug].md: $related_project"
    return 1
  fi
}

sha256_file() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{ print $1 }'
  else
    error "no SHA-256 command is available"
    return 1
  fi
}

sha256_stdin() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{ print $1 }'
  else
    error "no SHA-256 command is available"
    return 1
  fi
}

is_loop_state() {
  case "$1" in
    ready|running|awaiting_user|awaiting_external|needs_review|stopped|succeeded) return 0 ;;
    *) return 1 ;;
  esac
}

is_stop_reason() {
  case "$1" in
    NO_PROGRESS|BUDGET_EXCEEDED|BLOCKED|CONFLICT|SAFETY) return 0 ;;
    *) return 1 ;;
  esac
}

is_next_actor() {
  case "$1" in
    agent|user|reviewer|external|none) return 0 ;;
    *) return 1 ;;
  esac
}

is_task_status() {
  case "$1" in
    draft|active|blocked|done|closed|superseded|cancelled) return 0 ;;
    *) return 1 ;;
  esac
}

is_status_state_compatible() {
  local status="$1"
  local state="$2"

  case "$status:$state" in
    draft:ready) return 0 ;;
    active:ready|active:running|active:awaiting_user|active:awaiting_external|active:needs_review|active:stopped|active:succeeded) return 0 ;;
    blocked:awaiting_user|blocked:awaiting_external|blocked:needs_review|blocked:stopped) return 0 ;;
    done:succeeded|closed:succeeded) return 0 ;;
    superseded:stopped|cancelled:stopped) return 0 ;;
    *) return 1 ;;
  esac
}

validate_local_ref() {
  local ref="$1"
  local owner="$2"

  [[ -z "$ref" ]] && return

  if [[ "$ref" == /* || "$ref" == *".."* || "$ref" == file://* ]]; then
    error "$owner contains unsafe local ref: $ref"
    return
  fi

  if [[ "$ref" == docs/* && ! -e "$REPO_ROOT/$ref" ]]; then
    error "$owner references missing path: $ref"
  fi
}

validate_durable_ref() {
  local ref="$1"
  local owner="$2"
  local cursor="$REPO_ROOT"
  local segment

  validate_local_ref "$ref" "$owner"
  if [[ -z "$ref" || "$ref" == /* || "$ref" == *".."* || "$ref" == file://* ]]; then
    return
  fi
  if [[ "$ref" =~ (^|/)(\.env($|\.)|secrets?|credentials?|private[-_.]?keys?|id_rsa($|\.)|[^/]+\.(pem|key|p12|pfx))($|/) ]]; then
    error "$owner contains a private/credential ref: $ref"
    return
  fi
  IFS='/' read -r -a ref_segments <<< "$ref"
  for segment in "${ref_segments[@]}"; do
    cursor="$cursor/$segment"
    if [[ -L "$cursor" ]]; then
      error "$owner contains a symlink ref: $ref"
      return
    fi
  done
  if [[ ! -f "$cursor" || ! -s "$cursor" ]]; then
    error "$owner must reference a non-empty regular file: $ref"
  fi
}

validate_public_surfaces() {
  local section
  local field
  local value

  require_file "$EXECUTION_DESIGN" || true
  require_file "$EXECUTION_GUIDE" || true
  require_file "$EXECUTION_ENTRY" || true
  require_file "$CHECKPOINT_TEMPLATE" || true
  require_file "$EXECUTION_POLICY" || true
  if [[ ! -f "$INSTALLATION_LOCK" ]]; then
    require_file "$HUMAN_VIEW_DESIGN" || true
    require_file "$GOVERNANCE_DESIGN" || true
    require_file "$HUMAN_VIEW_GUIDE" || true
  fi

  if [[ -f "$EXECUTION_DESIGN" ]]; then
    for section in \
      Purpose 'Authority Boundary' 'Lifecycle Status And Loop State' \
      'Checkpoint Contract' 'Human View Projection Handoff' 'Approval Fence' 'Runtime Boundary' \
      'Acceptance Scenarios' 'Change Log'
    do
      require_section "$EXECUTION_DESIGN" "$section"
    done
    for value in ready running awaiting_user awaiting_external needs_review stopped succeeded; do
      require_contains "$EXECUTION_DESIGN" "\`$value\`"
    done
  fi

  if [[ -f "$HUMAN_VIEW_DESIGN" ]]; then
    for section in \
      Purpose 'Authority Boundary' Invariants 'Projection Pipeline' \
      'Single-Repository Presentation Contract' 'Interaction Stability Contract' 'Semantic Visual Contract' \
      'Snapshot API Contract' 'SSE Contract' 'Freshness And Consistency Contract' \
      'Read-Only And Security Boundary' 'Runtime Boundary' \
      'Failure Boundaries And Recovery' Observability 'Acceptance Scenarios' \
      Decisions 'Open Questions' References 'Change Log'
    do
      require_section "$HUMAN_VIEW_DESIGN" "$section"
    done
    for value in fresh updating direct degraded unknown; do
      require_contains "$HUMAN_VIEW_DESIGN" "\`$value\`"
    done
    require_contains "$HUMAN_VIEW_DESIGN" '405 Method Not Allowed'
    require_contains "$HUMAN_VIEW_DESIGN" 'capabilities'
    require_contains "$HUMAN_VIEW_DESIGN" 'snapshot.published'
    require_contains "$HUMAN_VIEW_DESIGN" 'resync.required'
    for value in 'displayName' 'locale' 'tabLabels' 'overview' 'policies' 'guidelines' 'initiatives' 'review' 'execution' 'evidence'; do
      require_contains "$HUMAN_VIEW_DESIGN" "$value"
    done
  fi

  if [[ -f "$GOVERNANCE_DESIGN" ]]; then
    for section in Context 'Authority Boundary' 'Artifact Contracts' 'Change Log'; do
      require_section "$GOVERNANCE_DESIGN" "$section"
    done
    for value in human-policy normative-standard proposal approval exception evidence; do
      require_contains "$GOVERNANCE_DESIGN" "$value"
    done
  fi

  if [[ -f "$EXECUTION_GUIDE" ]]; then
    for section in \
      Purpose 'Operating Principle' 'Artifact Roles' 'Task Opt-In Contract' \
      'Directive And Policy Resolution' 'Execution Loop' 'State Transitions' \
      'Checkpoint Update Contract' 'Human Attention And Handoff' \
      'Evidence And Receipt Contract' 'Stop And Resume Rules' \
      'Risk And Approval' Closeout 'Failure Response' 'Downstream Adoption' \
      References 'Change Log'
    do
      require_section "$EXECUTION_GUIDE" "$section"
    done
  fi

  if [[ -f "$HUMAN_VIEW_GUIDE" ]]; then
    for section in \
      Purpose 'Information Architecture' 'Seven-Tab Product Plan' \
      'Interaction And Refresh Stability' 'Semantic Design System' \
      'Attention Queue' 'Policy To Task Trace View' 'Evidence Review' \
      'Read-Only Interaction Rule' 'Approval Workflow' 'Acceptance Checklist' \
      References 'Change Log'
    do
      require_section "$HUMAN_VIEW_GUIDE" "$section"
    done
    for value in ready running awaiting_user awaiting_external needs_review stopped succeeded; do
      require_contains "$HUMAN_VIEW_GUIDE" "$value"
    done
    require_contains "$HUMAN_VIEW_GUIDE" 'proposed / accepted_for_promotion / effective / superseded'
    for value in 'displayName' 'locale' 'tabLabels' 'overview' 'policies' 'guidelines' 'initiatives' 'review' 'execution' 'evidence'; do
      require_contains "$HUMAN_VIEW_GUIDE" "$value"
    done
  fi

  if [[ -f "$EXECUTION_ENTRY" ]]; then
    for section in \
      Purpose 'Load Order' 'Start Gate' 'Execute Loop' 'State Routing' \
      'Evidence Barrier' 'Stop And Ask' Closeout Verification 'Human Handoff' \
      References 'Change Log'
    do
      require_section "$EXECUTION_ENTRY" "$section"
    done
    require_contains "$EXECUTION_ENTRY" 'stopped / CONFLICT'
    require_contains "$EXECUTION_ENTRY" 'Goal Verification'
  fi

  for value in \
    '`executing`' '`verifying`' '`awaiting-human-input`' \
    '`awaiting-human-approval`' '`awaiting-external`' '`ready-for-review`' \
    'loop_state: closed'
  do
    for file in "$EXECUTION_DESIGN" "$HUMAN_VIEW_DESIGN" "$HUMAN_VIEW_GUIDE"; do
      if [[ -f "$file" ]] && grep -Fq -- "$value" "$file"; then
        error "deprecated loop state token '$value' remains in public execution/view contract"
      fi
    done
  done

  if [[ -f "$CHECKPOINT_TEMPLATE" ]]; then
    for field in \
      type execution_contract checkpoint_id checkpoint_seq task_id \
      task_contract_revision attempt_seq loop_state stop_reason next_actor \
      current_hypothesis last_action next_action resume_when policy_refs \
      directive_refs evidence risks attention receipts budget source_revision \
      source_hash recorded_at
    do
      if ! frontmatter_has_key "$CHECKPOINT_TEMPLATE" "$field"; then
        error "checkpoint template missing frontmatter field: $field"
      fi
    done
    for section in \
      Purpose 'Human Snapshot' 'Task Contract Fence' 'Policy And Directive Refs' \
      'Current Hypothesis' 'Last Action' 'Next Actor And Action' \
      'Resume Condition' Evidence Risks Attention Receipts Budget 'Transition Note'
    do
      require_section "$CHECKPOINT_TEMPLATE" "$section"
    done
  fi

  if [[ -f "$EXECUTION_POLICY" ]]; then
    for value in \
      'version: 1' 'contract: v1' 'grandfather_without_opt_in: true' \
      'task_status_separate: true' 'ai_self_approval: forbidden' \
      'task_goal_weakening: supersede_or_reissue' \
      'unresolved_conflict: stop_with_conflict' \
      'lifecycle_compatibility:' \
      'required_loop_state: succeeded' \
      'trusted_runtime_verification_separate_from_static_validation: true'
    do
      require_contains "$EXECUTION_POLICY" "$value"
    done
    for value in ready running awaiting_user awaiting_external needs_review stopped succeeded; do
      require_contains "$EXECUTION_POLICY" "    - $value"
    done
    for value in NO_PROGRESS BUDGET_EXCEEDED BLOCKED CONFLICT SAFETY; do
      require_contains "$EXECUTION_POLICY" "    - $value"
    done
    for value in draft active blocked done closed superseded cancelled; do
      require_contains "$EXECUTION_POLICY" "    - $value"
    done
    for field in \
      checkpoint_id checkpoint_seq task_id task_contract_revision attempt_seq \
      loop_state stop_reason next_actor current_hypothesis last_action next_action \
      resume_when policy_refs directive_refs evidence risks attention receipts \
      budget source_revision source_hash recorded_at
    do
      require_contains "$EXECUTION_POLICY" "    - $field"
    done
  fi

  if [[ -f "$EXECUTION_DESIGN" ]]; then
    require_contains "$EXECUTION_DESIGN" 'time_limit_minutes: 60'
    require_contains "$EXECUTION_DESIGN" 'receipt_kind: command | test | review | decision | approval | handoff'
  fi
}

find_task_by_id() {
  local wanted_id="$1"
  local file

  shopt -s nullglob
  for file in "$DOCS_DIR"/tasks/T*.md; do
    if [[ "$(frontmatter_scalar "$file" doc_id)" == "$wanted_id" ]]; then
      printf '%s\n' "$file"
      shopt -u nullglob
      return 0
    fi
  done
  shopt -u nullglob
  return 1
}

validate_checkpoint() {
  local file="$1"
  local task_id
  local task_file
  local state
  local stop_reason
  local next_actor
  local value
  local key
  local count
  local task_revision
  local task_state
  local iterations_used
  local iterations_max
  local elapsed_minutes
  local time_limit_minutes
  local source_hash
  local source_revision
  local task_source_hash
  local committed_task_hash
  local task_relative
  local budget_exhausted=0

  if [[ ! -f "$file" ]]; then
    error "checkpoint not found: ${file#$REPO_ROOT/}"
    return
  fi
  if ! has_frontmatter "$file"; then
    error "checkpoint missing YAML frontmatter: ${file#$REPO_ROOT/}"
    return
  fi

  for key in \
    type execution_contract checkpoint_id checkpoint_seq task_id \
    task_contract_revision attempt_seq loop_state stop_reason next_actor \
    current_hypothesis last_action next_action resume_when policy_refs \
    directive_refs evidence risks attention receipts budget source_revision \
    source_hash recorded_at
  do
    if ! frontmatter_has_key "$file" "$key"; then
      error "checkpoint missing frontmatter field '$key': ${file#$REPO_ROOT/}"
    fi
  done

  [[ "$(frontmatter_scalar "$file" type)" == "execution-checkpoint" ]] || \
    error "checkpoint type must be execution-checkpoint: ${file#$REPO_ROOT/}"
  [[ "$(frontmatter_scalar "$file" execution_contract)" == "v1" ]] || \
    error "checkpoint execution_contract must be v1: ${file#$REPO_ROOT/}"

  value="$(frontmatter_scalar "$file" checkpoint_id)"
  [[ -n "$value" ]] || error "checkpoint_id must be non-empty: ${file#$REPO_ROOT/}"

  for key in checkpoint_seq attempt_seq; do
    value="$(frontmatter_scalar "$file" "$key")"
    if [[ ! "$value" =~ ^[1-9][0-9]*$ ]]; then
      error "$key must be a positive integer in ${file#$REPO_ROOT/}: ${value:-<empty>}"
    fi
  done

  for key in task_id task_contract_revision current_hypothesis last_action next_action resume_when source_revision source_hash recorded_at; do
    value="$(frontmatter_scalar "$file" "$key")"
    [[ -n "$value" ]] || error "$key must be non-empty: ${file#$REPO_ROOT/}"
  done

  task_id="$(frontmatter_scalar "$file" task_id)"
  if [[ ! "$task_id" =~ ^T[0-9]{4}$ ]]; then
    error "checkpoint task_id must match T####: ${file#$REPO_ROOT/}: $task_id"
  elif task_file="$(find_task_by_id "$task_id")"; then
    if [[ "$(frontmatter_scalar "$task_file" execution_contract)" != "v1" ]]; then
      error "checkpoint task is not opted into execution_contract v1: $task_id"
    else
      task_revision="$(frontmatter_scalar "$task_file" task_contract_revision)"
      task_state="$(frontmatter_scalar "$task_file" loop_state)"
      if [[ "$task_revision" != "$(frontmatter_scalar "$file" task_contract_revision)" ]]; then
        error "checkpoint task_contract_revision does not match $task_id"
      fi
      if [[ "$task_state" != "$(frontmatter_scalar "$file" loop_state)" ]]; then
        error "checkpoint loop_state does not match task mirror for $task_id"
      fi
      source_hash="$(frontmatter_scalar "$file" source_hash)"
      task_source_hash="$(sha256_file "$task_file")"
      if [[ "$source_hash" != "$task_source_hash" ]]; then
        error "checkpoint source_hash does not match linked task bytes for $task_id"
      fi
      source_revision="$(frontmatter_scalar "$file" source_revision)"
      if [[ "$source_revision" != "working-tree" ]]; then
        if [[ ! "$source_revision" =~ ^[a-f0-9]{40}$ ]] || \
           ! git -C "$REPO_ROOT" rev-parse --verify "${source_revision}^{commit}" >/dev/null 2>&1; then
          error "checkpoint source_revision must be working-tree or a resolvable full Git commit for $task_id"
        else
          task_relative="${task_file#$REPO_ROOT/}"
          if committed_task_hash="$(git -C "$REPO_ROOT" show "${source_revision}:${task_relative}" | sha256_stdin)"; then
            [[ "$committed_task_hash" == "$source_hash" ]] || \
              error "checkpoint source_revision does not resolve the linked task bytes for $task_id"
          else
            error "checkpoint source_revision cannot read the linked task for $task_id"
          fi
        fi
      fi
    fi
  else
    error "checkpoint references missing task: $task_id"
  fi

  state="$(frontmatter_scalar "$file" loop_state)"
  if ! is_loop_state "$state"; then
    error "unsupported loop_state '$state' in ${file#$REPO_ROOT/}"
  fi

  stop_reason="$(frontmatter_scalar "$file" stop_reason)"
  if [[ "$state" == "stopped" ]]; then
    if ! is_stop_reason "$stop_reason"; then
      error "stopped checkpoint requires a supported stop_reason in ${file#$REPO_ROOT/}"
    fi
  elif [[ -n "$stop_reason" && "$stop_reason" != "none" ]]; then
    error "only stopped checkpoint may declare stop_reason in ${file#$REPO_ROOT/}"
  fi

  next_actor="$(frontmatter_scalar "$file" next_actor)"
  if ! is_next_actor "$next_actor"; then
    error "unsupported next_actor '$next_actor' in ${file#$REPO_ROOT/}"
  fi

  case "$state" in
    ready|running)
      [[ "$next_actor" == "agent" ]] || error "$state checkpoint must use next_actor: agent in ${file#$REPO_ROOT/}"
      ;;
    awaiting_user)
      [[ "$next_actor" == "user" ]] || error "awaiting_user checkpoint must use next_actor: user in ${file#$REPO_ROOT/}"
      ;;
    awaiting_external)
      [[ "$next_actor" == "external" ]] || error "awaiting_external checkpoint must use next_actor: external in ${file#$REPO_ROOT/}"
      ;;
    needs_review)
      [[ "$next_actor" == "reviewer" || "$next_actor" == "user" ]] || \
        error "needs_review checkpoint must use next_actor reviewer|user in ${file#$REPO_ROOT/}"
      ;;
    stopped)
      [[ "$next_actor" != "none" ]] || error "stopped checkpoint must name a next actor in ${file#$REPO_ROOT/}"
      ;;
    succeeded)
      [[ "$next_actor" == "none" ]] || error "succeeded checkpoint must use next_actor: none in ${file#$REPO_ROOT/}"
      ;;
  esac

  if ! frontmatter_has_key "$file" policy_refs || [[ "$(frontmatter_list_count "$file" policy_refs)" == "0" ]]; then
    error "checkpoint requires at least one policy_refs entry: ${file#$REPO_ROOT/}"
  fi
  if ! frontmatter_has_key "$file" directive_refs; then
    error "checkpoint must declare directive_refs, even when empty: ${file#$REPO_ROOT/}"
  fi

  while IFS= read -r value; do
    validate_local_ref "$value" "${file#$REPO_ROOT/} policy_refs"
  done < <(frontmatter_list_items "$file" policy_refs)
  while IFS= read -r value; do
    validate_local_ref "$value" "${file#$REPO_ROOT/} directive_refs"
  done < <(frontmatter_list_items "$file" directive_refs)
  for key in evidence attention receipts; do
    while IFS= read -r value; do
      validate_local_ref "$value" "${file#$REPO_ROOT/} $key"
    done < <(frontmatter_list_items "$file" "$key")
  done

  for key in iterations_used iterations_max elapsed_minutes time_limit_minutes; do
    value="$(frontmatter_nested_scalar "$file" budget "$key")"
    if [[ ! "$value" =~ ^[0-9]+$ ]]; then
      error "checkpoint budget.$key must be a non-negative integer in ${file#$REPO_ROOT/}"
    fi
  done

  iterations_used="$(frontmatter_nested_scalar "$file" budget iterations_used)"
  iterations_max="$(frontmatter_nested_scalar "$file" budget iterations_max)"
  elapsed_minutes="$(frontmatter_nested_scalar "$file" budget elapsed_minutes)"
  time_limit_minutes="$(frontmatter_nested_scalar "$file" budget time_limit_minutes)"
  if [[ "$iterations_used" =~ ^[0-9]+$ && "$iterations_max" =~ ^[0-9]+$ ]] && \
     (( iterations_used > iterations_max )); then
    error "checkpoint budget iterations_used exceeds iterations_max in ${file#$REPO_ROOT/}"
  fi
  if [[ "$elapsed_minutes" =~ ^[0-9]+$ && "$time_limit_minutes" =~ ^[0-9]+$ ]] && \
     (( elapsed_minutes > time_limit_minutes )); then
    error "checkpoint budget elapsed_minutes exceeds time_limit_minutes in ${file#$REPO_ROOT/}"
  fi
  if [[ "$iterations_max" =~ ^[0-9]+$ ]] && (( iterations_max < 1 )); then
    error "checkpoint budget.iterations_max must be positive in ${file#$REPO_ROOT/}"
  fi
  if [[ "$time_limit_minutes" =~ ^[0-9]+$ ]] && (( time_limit_minutes < 1 )); then
    error "checkpoint budget.time_limit_minutes must be positive in ${file#$REPO_ROOT/}"
  fi
  if [[ "$iterations_used" =~ ^[0-9]+$ && "$iterations_max" =~ ^[1-9][0-9]*$ && \
        "$elapsed_minutes" =~ ^[0-9]+$ && "$time_limit_minutes" =~ ^[1-9][0-9]*$ ]]; then
    if (( iterations_used >= iterations_max || elapsed_minutes >= time_limit_minutes )); then
      budget_exhausted=1
    fi
    if (( budget_exhausted == 1 )) && [[ "$state" != "stopped" && "$state" != "succeeded" ]]; then
      error "exhausted checkpoint budget requires stopped/BUDGET_EXCEEDED or succeeded in ${file#$REPO_ROOT/}"
    fi
    if [[ "$state" == "stopped" && "$stop_reason" == "BUDGET_EXCEEDED" ]] && (( budget_exhausted == 0 )); then
      error "BUDGET_EXCEEDED checkpoint has not reached a declared budget limit in ${file#$REPO_ROOT/}"
    fi
    if [[ "$state" == "stopped" && "$stop_reason" != "BUDGET_EXCEEDED" ]] && (( budget_exhausted == 1 )); then
      error "stopped checkpoint at a budget limit must use BUDGET_EXCEEDED in ${file#$REPO_ROOT/}"
    fi
  fi

  source_hash="$(frontmatter_scalar "$file" source_hash)"
  source_revision="$(frontmatter_scalar "$file" source_revision)"
  [[ "$source_hash" =~ ^[a-f0-9]{64}$ ]] || \
    error "checkpoint source_hash must be a SHA-256 digest in ${file#$REPO_ROOT/}"
  [[ "$source_revision" == "working-tree" || "$source_revision" =~ ^[a-f0-9]{40}$ ]] || \
    error "checkpoint source_revision must be working-tree or a full Git commit in ${file#$REPO_ROOT/}"

  if [[ "$state" == "awaiting_user" || "$state" == "awaiting_external" || "$state" == "needs_review" || "$state" == "stopped" ]]; then
    count="$(frontmatter_list_count "$file" attention)"
    if [[ "$count" == "0" ]]; then
      error "$state checkpoint requires at least one attention ref in ${file#$REPO_ROOT/}"
    fi
  fi

  if [[ "$state" == "succeeded" ]]; then
    [[ "$(frontmatter_list_count "$file" evidence)" != "0" ]] || \
      error "succeeded checkpoint requires evidence refs in ${file#$REPO_ROOT/}"
    [[ "$(frontmatter_list_count "$file" receipts)" != "0" ]] || \
      error "succeeded checkpoint requires receipt refs in ${file#$REPO_ROOT/}"
    [[ "$(frontmatter_list_count "$file" attention)" == "0" ]] || \
      error "succeeded checkpoint cannot retain unresolved attention in ${file#$REPO_ROOT/}"
    for key in evidence receipts; do
      while IFS= read -r value; do
        validate_durable_ref "$value" "${file#$REPO_ROOT/} $key"
      done < <(frontmatter_list_items "$file" "$key")
    done
  fi

  for key in \
    Purpose 'Human Snapshot' 'Task Contract Fence' 'Policy And Directive Refs' \
    'Current Hypothesis' 'Last Action' 'Next Actor And Action' \
    'Resume Condition' Evidence Risks Attention Receipts Budget 'Transition Note'
  do
    if ! frontmatter_section_exists "$file" "$key"; then
      error "checkpoint missing section '## $key': ${file#$REPO_ROOT/}"
    fi
  done
}

validate_opt_in_task() {
  local file="$1"
  local contract
  local task_id
  local task_status
  local task_revision
  local task_state
  local checkpoint_ref
  local checkpoint_path

  if ! has_frontmatter "$file"; then
    return
  fi

  contract="$(frontmatter_scalar "$file" execution_contract)"
  if [[ -z "$contract" ]]; then
    return
  fi
  if [[ "$contract" != "v1" ]]; then
    error "unsupported execution_contract '$contract' in ${file#$REPO_ROOT/}"
    return
  fi

  validate_execution_task_lineage "$file" || true

  [[ "$(frontmatter_scalar "$file" type)" == "task" ]] || \
    error "execution_contract v1 is currently supported only for task docs: ${file#$REPO_ROOT/}"

  for key in task_contract_revision loop_state checkpoint_ref; do
    if ! frontmatter_has_key "$file" "$key"; then
      error "opt-in task missing frontmatter field '$key': ${file#$REPO_ROOT/}"
    fi
  done

  task_id="$(frontmatter_scalar "$file" doc_id)"
  task_status="$(frontmatter_scalar "$file" status)"
  task_revision="$(frontmatter_scalar "$file" task_contract_revision)"
  task_state="$(frontmatter_scalar "$file" loop_state)"
  checkpoint_ref="$(frontmatter_scalar "$file" checkpoint_ref)"

  [[ "$task_id" =~ ^T[0-9]{4}$ ]] || error "opt-in task doc_id must match T####: ${file#$REPO_ROOT/}"
  [[ "$task_revision" =~ ^[1-9][0-9]*$ ]] || \
    error "opt-in task task_contract_revision must be a positive integer: ${file#$REPO_ROOT/}"
  is_task_status "$task_status" || error "unsupported task status '$task_status': ${file#$REPO_ROOT/}"
  is_loop_state "$task_state" || error "unsupported task loop_state '$task_state': ${file#$REPO_ROOT/}"

  if is_task_status "$task_status" && is_loop_state "$task_state" && \
     ! is_status_state_compatible "$task_status" "$task_state"; then
    error "task status '$task_status' is incompatible with loop_state '$task_state': ${file#$REPO_ROOT/}"
  fi

  if [[ -z "$checkpoint_ref" ]]; then
    if [[ "$task_status" != "draft" || "$task_state" != "ready" ]]; then
      error "active or non-ready opt-in task requires checkpoint_ref: ${file#$REPO_ROOT/}"
    fi
    return
  fi

  if [[ "$checkpoint_ref" != docs/checkpoints/*.md ]]; then
    error "checkpoint_ref must be a docs/checkpoints/*.md path: ${file#$REPO_ROOT/}: $checkpoint_ref"
    return
  fi

  validate_local_ref "$checkpoint_ref" "${file#$REPO_ROOT/} checkpoint_ref"
  checkpoint_path="$REPO_ROOT/$checkpoint_ref"
  if [[ -f "$checkpoint_path" ]]; then
    if [[ "$(frontmatter_scalar "$checkpoint_path" task_id)" != "$task_id" ]]; then
      error "checkpoint_ref task_id mismatch for ${file#$REPO_ROOT/}"
    fi
    if [[ "$(frontmatter_scalar "$checkpoint_path" task_contract_revision)" != "$task_revision" ]]; then
      error "checkpoint_ref task_contract_revision mismatch for ${file#$REPO_ROOT/}"
    fi
    if [[ "$(frontmatter_scalar "$checkpoint_path" loop_state)" != "$task_state" ]]; then
      error "checkpoint_ref loop_state mismatch for ${file#$REPO_ROOT/}"
    fi
  fi
}

validate_all() {
  local file

  shopt -s nullglob
  for file in "$DOCS_DIR"/tasks/T*.md; do
    validate_opt_in_task "$file"
  done
  for file in "$DOCS_DIR"/checkpoints/*.md; do
    validate_checkpoint "$file"
  done
  shopt -u nullglob
}

validate_target() {
  local file="$1"
  local target_type

  if [[ ! -f "$file" ]]; then
    error "target not found: $file"
    return
  fi

  target_type="$(frontmatter_scalar "$file" type)"
  case "$target_type" in
    task) validate_opt_in_task "$file" ;;
    execution-checkpoint) validate_checkpoint "$file" ;;
    *) error "target must have frontmatter type task or execution-checkpoint: $file" ;;
  esac
}

validate_public_surfaces

if [[ $# -eq 0 || ( $# -eq 1 && "$1" == "--all" ) ]]; then
  validate_all
else
  for target in "$@"; do
    validate_target "$target"
  done
fi

if (( error_count > 0 )); then
  exit 1
fi

echo "Validated execution loop surfaces."
