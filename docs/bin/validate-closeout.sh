#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXECUTION_VALIDATOR="$ROOT_DIR/bin/validate-execution-loop.sh"
DOMAIN_LINEAGE_VALIDATOR="$ROOT_DIR/bin/validate-domain-lineage.sh"
INITIATIVE_AUTHORITY_VALIDATOR="$ROOT_DIR/lib/initiative-authority.mjs"

usage() {
  cat <<'EOF'
Usage:
  ./docs/bin/validate-closeout.sh --all
  ./docs/bin/validate-closeout.sh <doc-path> [<doc-path> ...]

Rules:
  - Initiative docs get issuance/activation approval, policy/guideline relation, success-signal, and outcome-evidence rules.
  - Task/project docs get closeout rules; docs/qa/QA*.md get QA-document rules (type/doc_id/qa_type/status vocabulary, status match, required sections).
  - Related Control Plane must be present.
  - Modern tasks resolve Related Project to a unique P#### source, then require its canonical I#### Initiative and source-fenced human activation receipt to be current.
  - Modern projects resolve Related Initiative to the same receipt-backed authority; complete explicit legacy umbrella lineage remains accepted.
  - Whole-System Anchor, Outputs / Handoff, Quality Axes In Scope must exist.
  - Goal Inventory and Goal Verification must both exist.
  - Goal IDs must match 1:1 between both sections.
  - If Status is done/closed, every goal must be Done with non-empty evidence.
  - If Status is done/closed, WBS cannot contain Todo/In Progress/Pending/Blocked items.
  - execution_contract v1 tasks must also satisfy checkpoint, loop_state, attention, and receipt barriers.
  - Active/terminal delivery and current QA must pin authoritative/current DDD models or carry an explicit AI Domain Expert no-domain-impact review.
EOF
}

collect_default_targets() {
  local path

  shopt -s nullglob
  for path in "$ROOT_DIR"/initiatives/I*.md "$ROOT_DIR"/tasks/T*.md "$ROOT_DIR"/projects/P*.md "$ROOT_DIR"/qa/QA*.md; do
    TARGETS+=("$path")
  done
  shopt -u nullglob
}

frontmatter_scalar() {
  local file="$1"
  local wanted_key="$2"

  awk -v wanted="$wanted_key" '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      if (value ~ /^".*"$/ || value ~ /^\047.*\047$/) {
        value = substr(value, 2, length(value) - 2)
      }
      return value
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
    echo "error: $owner references missing canonical $expected_type document: $doc_id" >&2
    return 1
  fi
  if [[ ${#matches[@]} -gt 1 ]]; then
    echo "error: $owner resolves $doc_id to multiple canonical $expected_type documents" >&2
    return 1
  fi

  candidate="${matches[0]}"
  candidate_type="$(frontmatter_scalar "$candidate" type)"
  if [[ "$candidate_type" != "$expected_type" ]]; then
    echo "error: $owner resolves $doc_id to type '${candidate_type:-missing}', expected $expected_type" >&2
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
    echo "error: $owner Related Initiative must match I####: ${initiative_id:-<empty>}" >&2
    return 1
  fi
  find_canonical_numbered_doc "$ROOT_DIR/initiatives" "$initiative_id" initiative "$owner" || return 1
  initiative_path="$CANONICAL_DOC_PATH"
  initiative_contract="$(frontmatter_scalar "$initiative_path" initiative_contract)"
  status="$(frontmatter_scalar "$initiative_path" status)"
  approval_status="$(frontmatter_scalar "$initiative_path" approval_status)"
  issuance_approval_ref="$(frontmatter_scalar "$initiative_path" issuance_approval_ref)"
  approval_ref="$(frontmatter_scalar "$initiative_path" approval_ref)"

  if [[ "$initiative_contract" != "v1" ]]; then
    echo "error: $owner parent initiative $initiative_id must declare initiative_contract: v1" >&2
    return 1
  fi
  if [[ "$status" != "active" || "$approval_status" != "approved" ]]; then
    echo "error: $owner parent initiative $initiative_id must be active and approved (status='${status:-missing}', approval_status='${approval_status:-missing}')" >&2
    return 1
  fi
  if ! has_meaningful_frontmatter_value "$issuance_approval_ref" || ! has_meaningful_frontmatter_value "$approval_ref"; then
    echo "error: $owner parent initiative $initiative_id must retain exact issuance_approval_ref and approval_ref values" >&2
    return 1
  fi

  if ! node "$INITIATIVE_AUTHORITY_VALIDATOR" \
    --root "$(dirname "$ROOT_DIR")" \
    --initiative "$initiative_id"; then
    echo "error: $owner parent initiative $initiative_id has no current source-fenced human activation authority" >&2
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
    echo "error: $owner has no approved modern initiative lineage or complete explicit legacy lineage" >&2
    echo "hint: legacy parents require project_role, umbrella_initiative, and parent_umbrella_project" >&2
    return 1
  fi
  if [[ "$project_role" != "umbrella" && "$project_role" != "exception-branch" ]]; then
    echo "error: $owner has unsupported legacy project_role: $project_role" >&2
    return 1
  fi
  if [[ "$project_role" == "umbrella" && "$parent_umbrella_project" != "self" ]]; then
    echo "error: $owner legacy umbrella project must use parent_umbrella_project: self" >&2
    return 1
  fi
  if [[ "$project_role" == "exception-branch" && "$parent_umbrella_project" == "self" ]]; then
    echo "error: $owner legacy exception-branch project must reference its parent umbrella project" >&2
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
    echo "error: $owner has unsupported lineage_contract: $lineage_contract" >&2
    return 1
  fi

  if [[ "$lineage_contract" == "v2" || -n "$related_initiative" ]]; then
    if [[ -z "$related_initiative" ]]; then
      echo "error: $owner declares modern lineage but has no related_initiative" >&2
      return 1
    fi
    validate_active_approved_initiative_ref "$related_initiative" "$owner"
    return $?
  fi

  validate_explicit_legacy_project_lineage "$project_path" "$owner"
}

validate_task_governance_lineage() {
  local task_path="$1"
  local owner="${task_path#$ROOT_DIR/}"
  local lineage_contract
  local related_project
  local related_umbrella_project
  local project_path

  lineage_contract="$(frontmatter_scalar "$task_path" lineage_contract)"
  related_project="$(frontmatter_scalar "$task_path" related_project)"
  related_umbrella_project="$(frontmatter_scalar "$task_path" related_umbrella_project)"

  if [[ -n "$lineage_contract" && "$lineage_contract" != "v2" ]]; then
    echo "error: $owner has unsupported lineage_contract: $lineage_contract" >&2
    return 1
  fi

  if [[ "$lineage_contract" == "v2" || "$related_project" =~ ^P[0-9]{4}$ ]]; then
    if [[ ! "$related_project" =~ ^P[0-9]{4}$ ]]; then
      echo "error: $owner modern Related Project must match P####: ${related_project:-<empty>}" >&2
      return 1
    fi
    find_canonical_numbered_doc "$ROOT_DIR/projects" "$related_project" project "$owner" || return 1
    project_path="$CANONICAL_DOC_PATH"
    validate_project_governance_lineage "$project_path" "$owner -> $related_project"
    return $?
  fi

  if [[ -z "$related_umbrella_project" ]]; then
    echo "error: $owner requires modern related_project or an explicit legacy related_umbrella_project bridge" >&2
    return 1
  fi
  if [[ -n "$related_project" ]] && ! is_explicit_legacy_project_path "$related_project"; then
    echo "error: $owner legacy related_project mirror must be empty or match docs/projects/P####[-slug].md: $related_project" >&2
    return 1
  fi
}

validate_initiative_file() {
  local file="$1"

  awk -v path="$file" '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }
    function push_error(msg) {
      errors[++error_count] = msg
    }
    function is_separator(line, stripped) {
      stripped = line
      gsub(/[[:space:]]/, "", stripped)
      return stripped ~ /^\|?[-:|]+\|?$/
    }
    function invalid_evidence(value, lowered) {
      lowered = tolower(trim(value))
      return lowered == "" || lowered == "-" || lowered == "todo" || lowered == "tbd" || lowered == "pending" || lowered == "n/a"
    }
    NR == 1 && $0 == "---" { in_frontmatter = 1; frontmatter_seen = 1; next }
    in_frontmatter && $0 == "---" { in_frontmatter = 0; current_list = ""; next }
    in_frontmatter {
      if ($0 ~ /^[A-Za-z_][A-Za-z0-9_]*:[[:space:]]*/) {
        idx = index($0, ":")
        key = trim(substr($0, 1, idx - 1))
        value = trim(substr($0, idx + 1))
        current_list = ""
        if (key == "type") fm_type = value
        else if (key == "doc_id") fm_doc_id = value
        else if (key == "status") fm_status = value
        else if (key == "approval_status") fm_approval_status = value
        else if (key == "issuance_approval_ref") fm_issuance_approval_ref = value
        else if (key == "approval_ref") fm_approval_ref = value
        else if (key == "related_control_plane") fm_related_control_plane = value
        else if (key == "policy_refs") current_list = "policy_refs"
        else if (key == "guideline_refs") current_list = "guideline_refs"
        else if (key == "guideline_disposition") fm_guideline_disposition = value
        else if (key == "guideline_disposition_reason") fm_guideline_disposition_reason = value
        next
      }
      if (current_list != "" && $0 ~ /^  -[[:space:]]+[^[:space:]]/) {
        list_value = trim(substr($0, index($0, "-") + 1))
        if (current_list == "policy_refs") {
          policy_ref_count++
          policy_refs[list_value] = 1
        } else if (current_list == "guideline_refs") {
          guideline_ref_count++
          guideline_refs[list_value] = 1
        }
        next
      }
      if ($0 ~ /^[^[:space:]]/) current_list = ""
      next
    }
    /^- Type: / { visible_type = trim(substr($0, length("- Type: ") + 1)); next }
    /^- Document ID: / { visible_doc_id = trim(substr($0, length("- Document ID: ") + 1)); next }
    /^- Status: / { visible_status = trim(substr($0, length("- Status: ") + 1)); next }
    /^- Approval Status: / { visible_approval_status = trim(substr($0, length("- Approval Status: ") + 1)); next }
    /^- Issuance Approval Ref: / { visible_issuance_approval_ref = trim(substr($0, length("- Issuance Approval Ref: ") + 1)); next }
    /^- Approval Ref: / { visible_approval_ref = trim(substr($0, length("- Approval Ref: ") + 1)); next }
    /^- Guideline Disposition: / { visible_guideline_disposition = trim(substr($0, length("- Guideline Disposition: ") + 1)); next }
    /^- Guideline Disposition Reason: / { visible_guideline_disposition_reason = trim(substr($0, length("- Guideline Disposition Reason: ") + 1)); next }
    /^- Related Control Plane: / { visible_related_control_plane = trim(substr($0, length("- Related Control Plane: ") + 1)); next }
    /^## / { section = $0; sections[$0] = 1; next }
    section == "## Policy Alignment" && /^\|/ {
      if (!policy_header_seen) { policy_header_seen = 1; next }
      if (is_separator($0)) next
      split($0, cells, "|")
      policy_id = trim(cells[2])
      relation = trim(cells[3])
      rationale = trim(cells[4])
      exception_ref = trim(cells[5])
      gsub(/^`|`$/, "", policy_id)
      if (policy_id == "" && relation == "" && rationale == "" && exception_ref == "") next
      policy_relation_count++
      if (policy_id in policy_relation_seen) push_error("duplicate Policy Alignment id: " policy_id)
      policy_relation_seen[policy_id] = 1
      if (relation != "advances" && relation != "constrained-by" && relation != "exception-to") push_error("unsupported Policy Alignment relation for " policy_id ": " relation)
      if (rationale == "") push_error("Policy Alignment rationale is missing for " policy_id)
      if (relation == "exception-to" && exception_ref == "") push_error("exception-to Policy Alignment requires Exception Ref for " policy_id)
      if (relation != "exception-to" && exception_ref != "") push_error("only exception-to Policy Alignment may use Exception Ref for " policy_id)
      next
    }
    section == "## Guideline Disposition" && /^\|/ {
      if (!guideline_header_seen) { guideline_header_seen = 1; next }
      if (is_separator($0)) next
      split($0, cells, "|")
      guideline_id = trim(cells[2])
      adoption = trim(cells[3])
      rationale = trim(cells[4])
      verification = trim(cells[5])
      gsub(/^`|`$/, "", guideline_id)
      if (guideline_id == "" && adoption == "" && rationale == "" && verification == "") next
      guideline_relation_count++
      if (guideline_id in guideline_relation_seen) push_error("duplicate Guideline Disposition id: " guideline_id)
      guideline_relation_seen[guideline_id] = 1
      if (adoption != "required" && adoption != "recommended") push_error("unsupported guideline adoption for " guideline_id ": " adoption)
      if (rationale == "") push_error("Guideline Disposition rationale is missing for " guideline_id)
      if (verification == "") push_error("Guideline Disposition verification is missing for " guideline_id)
      next
    }
    section == "## Success Signals" && /^\|/ {
      if (!signal_header_seen) { signal_header_seen = 1; next }
      if (is_separator($0)) next
      split($0, cells, "|")
      signal_id = trim(cells[2])
      measure = trim(cells[3])
      target = trim(cells[4])
      if (signal_id == "" && measure == "" && target == "") next
      signal_count++
      signal_ids[signal_count] = signal_id
      if (signal_id in signal_measure) push_error("duplicate Success Signals id: " signal_id)
      signal_measure[signal_id] = measure
      signal_target[signal_id] = target
      next
    }
    section == "## Outcome Review" && /^\|/ {
      if (!review_header_seen) { review_header_seen = 1; next }
      if (is_separator($0)) next
      split($0, cells, "|")
      signal_id = trim(cells[2])
      outcome_status = trim(cells[3])
      evidence = trim(cells[4])
      if (signal_id == "" && outcome_status == "" && evidence == "") next
      review_count++
      if (signal_id in review_status) push_error("duplicate Outcome Review id: " signal_id)
      review_status[signal_id] = outcome_status
      review_evidence[signal_id] = evidence
      next
    }
    END {
      allowed_status["draft"] = 1
      allowed_status["active"] = 1
      allowed_status["blocked"] = 1
      allowed_status["done"] = 1
      allowed_status["cancelled"] = 1
      allowed_status["superseded"] = 1
      allowed_approval["unreviewed"] = 1
      allowed_approval["review_requested"] = 1
      allowed_approval["approved"] = 1
      allowed_approval["rejected"] = 1
      allowed_approval["stale"] = 1
      allowed_approval["superseded"] = 1
      allowed_review["Pending"] = 1
      allowed_review["In Progress"] = 1
      allowed_review["Met"] = 1
      allowed_review["Blocked"] = 1
      allowed_review["N/A"] = 1

      if (!frontmatter_seen) push_error("missing frontmatter")
      if (fm_type != "initiative") push_error("initiative doc must declare type: initiative, found: " fm_type)
      if (fm_doc_id !~ /^I[0-9][0-9][0-9][0-9]$/) push_error("initiative doc_id must match I####, found: " fm_doc_id)
      if (!(fm_status in allowed_status)) push_error("unsupported initiative status: " fm_status)
      if (!(fm_approval_status in allowed_approval)) push_error("unsupported approval_status: " fm_approval_status)
      if (fm_guideline_disposition != "linked" && fm_guideline_disposition != "no_applicable_guideline" && fm_guideline_disposition != "needs_review") push_error("unsupported guideline_disposition: " fm_guideline_disposition)
      if (fm_guideline_disposition_reason == "") push_error("missing guideline_disposition_reason")
      if (fm_issuance_approval_ref == "") push_error("missing issuance_approval_ref")
      if (fm_related_control_plane == "") push_error("missing related_control_plane")
      if (visible_type != "" && visible_type != fm_type) push_error("frontmatter type does not match visible metadata")
      if (visible_doc_id != "" && visible_doc_id != fm_doc_id) push_error("frontmatter doc_id does not match visible metadata")
      if (visible_status != "" && visible_status != fm_status) push_error("frontmatter status does not match visible metadata")
      if (visible_approval_status != "" && visible_approval_status != fm_approval_status) push_error("frontmatter approval_status does not match visible metadata")
      if (visible_issuance_approval_ref != "" && visible_issuance_approval_ref != fm_issuance_approval_ref) push_error("frontmatter issuance_approval_ref does not match visible metadata")
      if (visible_approval_ref != fm_approval_ref) push_error("frontmatter approval_ref does not match visible metadata")
      if (visible_guideline_disposition != "" && visible_guideline_disposition != fm_guideline_disposition) push_error("frontmatter guideline_disposition does not match visible metadata")
      if (visible_guideline_disposition_reason != fm_guideline_disposition_reason) push_error("frontmatter guideline_disposition_reason does not match visible metadata")
      if (visible_related_control_plane != "" && visible_related_control_plane != fm_related_control_plane) push_error("frontmatter related_control_plane does not match visible metadata")

      split("## Purpose|## Human Approval Gate|## Outcome|## Why Now|## Scope|## Out Of Scope|## Policy Alignment|## Guideline Disposition|## Linked Projects|## Success Signals|## Risks And Assumptions|## Review Cadence|## Outcome Review|## Completion Guardrails|## Status", required, "|")
      for (i in required) if (!(required[i] in sections)) push_error("missing section: " required[i])

      if (signal_count < 1) push_error("Success Signals must contain at least one signal row")
      if (review_count < 1) push_error("Outcome Review must contain at least one signal row")
      for (i = 1; i <= signal_count; i++) {
        signal_id = signal_ids[i]
        if (signal_id !~ /^S[0-9]+$/) push_error("Success Signal id must use S<number> format: " signal_id)
        if (signal_measure[signal_id] == "") push_error("Success Signal is missing measure: " signal_id)
        if (signal_target[signal_id] == "") push_error("Success Signal is missing target: " signal_id)
        if (!(signal_id in review_status)) push_error("Outcome Review is missing row for " signal_id)
        else if (!(review_status[signal_id] in allowed_review)) push_error("unsupported Outcome Review status for " signal_id ": " review_status[signal_id])
        if (fm_status == "done") {
          if (review_status[signal_id] != "Met") push_error("done initiative requires Outcome Review status Met for " signal_id)
          if (invalid_evidence(review_evidence[signal_id])) push_error("done initiative requires non-empty evidence for " signal_id)
        }
      }
      for (signal_id in review_status) if (!(signal_id in signal_measure)) push_error("Outcome Review has extra row: " signal_id)

      if (fm_status == "active" || fm_status == "done") {
        if (fm_approval_status != "approved") push_error("active/done initiative requires approval_status: approved")
        if (fm_approval_ref == "") push_error("active/done initiative requires approval_ref")
        if (policy_ref_count < 1) push_error("active/done initiative requires at least one policy_refs entry")
        if (fm_guideline_disposition == "needs_review") push_error("active/done initiative cannot retain guideline_disposition: needs_review")
      }
      if (fm_guideline_disposition == "linked" && guideline_ref_count < 1) push_error("guideline_disposition linked requires at least one guideline_refs entry")
      if (fm_guideline_disposition == "no_applicable_guideline" && guideline_ref_count > 0) push_error("guideline_disposition no_applicable_guideline requires empty guideline_refs")
      if (policy_ref_count != policy_relation_count) push_error("policy_refs and Policy Alignment rows must match 1:1")
      if (guideline_ref_count != guideline_relation_count) push_error("guideline_refs and Guideline Disposition rows must match 1:1")
      for (policy_id in policy_refs) if (!(policy_id in policy_relation_seen)) push_error("Policy Alignment is missing policy_refs entry: " policy_id)
      for (policy_id in policy_relation_seen) if (!(policy_id in policy_refs)) push_error("Policy Alignment has unlisted policy ref: " policy_id)
      for (guideline_id in guideline_refs) if (!(guideline_id in guideline_relation_seen)) push_error("Guideline Disposition is missing guideline_refs entry: " guideline_id)
      for (guideline_id in guideline_relation_seen) if (!(guideline_id in guideline_refs)) push_error("Guideline Disposition has unlisted guideline ref: " guideline_id)

      if (error_count > 0) {
        for (i = 1; i <= error_count; i++) printf "error: %s: %s\n", path, errors[i] > "/dev/stderr"
        exit 1
      }
    }
  ' "$file"
}

validate_qa_file() {
  local file="$1"

  awk -v path="$file" '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }
    function push_error(msg) {
      errors[++error_count] = msg
    }
    NR == 1 && $0 == "---" { in_frontmatter = 1; frontmatter_seen = 1; next }
    in_frontmatter && $0 == "---" { in_frontmatter = 0; next }
    in_frontmatter {
      idx = index($0, ":")
      if (idx > 0) {
        key = trim(substr($0, 1, idx - 1))
        value = trim(substr($0, idx + 1))
        if (key == "type") fm_type = value
        if (key == "doc_id") fm_doc_id = value
        if (key == "qa_type") fm_qa_type = value
        if (key == "status") fm_status = value
        if (key == "owner") fm_owner = value
      }
      next
    }
    /^## / { sections[$0] = 1 }
    /^- Status:/ { visible_status = trim(substr($0, 10)) }
    END {
      if (!frontmatter_seen) push_error("missing frontmatter")
      if (fm_type != "qa") push_error("qa doc must declare type: qa, found: " fm_type)
      if (fm_doc_id !~ /^QA[0-9]{4}$/) push_error("qa doc_id must match QA####, found: " fm_doc_id)
      if (fm_qa_type != "strategy" && fm_qa_type != "plan" && fm_qa_type != "cases" && fm_qa_type != "runbook") {
        push_error("qa_type must be strategy|plan|cases|runbook, found: " fm_qa_type)
      }
      if (fm_status != "draft" && fm_status != "current" && fm_status != "retired") {
        push_error("qa status must be draft|current|retired, found: " fm_status)
      }
      if (visible_status != "" && fm_status != visible_status) {
        push_error("frontmatter status does not match visible metadata: " fm_status " != " visible_status)
      }
      if (fm_owner == "") push_error("missing owner")
      split("## Purpose|## Scope|## Source Documents|## Traceability|## Maintenance Rules|## Change Log", req, "|")
      for (i in req) {
        if (!(req[i] in sections)) push_error("missing section: " req[i])
      }
      if (error_count > 0) {
        for (i = 1; i <= error_count; i++) {
          printf "error: %s: %s\n", path, errors[i] > "/dev/stderr"
        }
        exit 1
      }
    }
  ' "$file"
}

validate_file() {
  local file="$1"
  local doc_type

  if [[ ! -f "$file" ]]; then
    echo "error: file not found: $file" >&2
    return 1
  fi

  case "$file" in
    *"/qa/QA"*.md)
      validate_qa_file "$file"
      return $?
      ;;
  esac

  doc_type="$(frontmatter_scalar "$file" type)"
  if [[ "$doc_type" == "initiative" ]]; then
    validate_initiative_file "$file" || return $?
    case "$(frontmatter_scalar "$file" status)" in
      active|done)
        node "$INITIATIVE_AUTHORITY_VALIDATOR" \
          --root "$(dirname "$ROOT_DIR")" \
          --initiative "$(frontmatter_scalar "$file" doc_id)" \
          --allow-done
        return $?
        ;;
      *) return 0 ;;
    esac
  fi
  if [[ "$doc_type" == "project" ]]; then
    validate_project_governance_lineage "$file" "${file#$ROOT_DIR/}" || return 1
  elif [[ "$doc_type" == "task" ]]; then
    validate_task_governance_lineage "$file" || return 1
  fi

  awk -v path="$file" '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }

    function push_error(msg) {
      errors[++error_count] = msg
    }

    function is_separator(line, stripped) {
      stripped = line
      gsub(/[[:space:]]/, "", stripped)
      return stripped ~ /^\|?[-:|]+\|?$/
    }

    function invalid_evidence(value, lowered) {
      lowered = tolower(trim(value))
      return lowered == "" || lowered == "-" || lowered == "todo" || lowered == "tbd" || lowered == "pending" || lowered == "n/a"
    }

    BEGIN {
      section = ""
    }

    NR == 1 && $0 == "---" {
      in_frontmatter = 1
      frontmatter_seen = 1
      next
    }

    in_frontmatter && $0 == "---" {
      in_frontmatter = 0
      next
    }

    in_frontmatter {
      if ($0 ~ /^[A-Za-z_][A-Za-z0-9_]*:[[:space:]]*/) {
        key = $0
        sub(/:.*/, "", key)
        value = $0
        sub(/^[^:]*:[[:space:]]*/, "", value)
        value = trim(value)

        if (key == "type") {
          fm_type = value
        } else if (key == "status") {
          fm_doc_status = value
        } else if (key == "completion_mode") {
          fm_completion_mode = value
        } else if (key == "lineage_contract") {
          fm_lineage_contract = value
        } else if (key == "project_role") {
          fm_project_role = value
        } else if (key == "umbrella_initiative") {
          fm_umbrella_initiative = value
        } else if (key == "parent_umbrella_project") {
          fm_parent_umbrella_project = value
        } else if (key == "related_control_plane") {
          fm_related_control_plane = value
        } else if (key == "related_umbrella_project") {
          fm_related_umbrella_project = value
        } else if (key == "related_initiative") {
          fm_related_initiative = value
        } else if (key == "initiative_relation") {
          fm_initiative_relation = value
        } else if (key == "related_project") {
          fm_related_project = value
        }
      }
      next
    }

    /^- Type: / {
      type = trim(substr($0, length("- Type: ") + 1))
      next
    }

    /^- Status: / {
      doc_status = trim(substr($0, length("- Status: ") + 1))
      next
    }

    /^- Completion Mode: / {
      completion_mode = trim(substr($0, length("- Completion Mode: ") + 1))
      next
    }

    /^- Project Role: / {
      project_role = trim(substr($0, length("- Project Role: ") + 1))
      next
    }

    /^- Umbrella Initiative: / {
      umbrella_initiative = trim(substr($0, length("- Umbrella Initiative: ") + 1))
      next
    }

    /^- Parent Umbrella Project: / {
      parent_umbrella_project = trim(substr($0, length("- Parent Umbrella Project: ") + 1))
      next
    }

    /^- Related Control Plane: / {
      related_control_plane = trim(substr($0, length("- Related Control Plane: ") + 1))
      next
    }

    /^- Related Umbrella Project: / {
      related_umbrella_project = trim(substr($0, length("- Related Umbrella Project: ") + 1))
      next
    }

    /^- Related Initiative: / {
      related_initiative = trim(substr($0, length("- Related Initiative: ") + 1))
      next
    }

    /^- Initiative Relation: / {
      initiative_relation = trim(substr($0, length("- Initiative Relation: ") + 1))
      next
    }

    /^- Related Project: / {
      related_project = trim(substr($0, length("- Related Project: ") + 1))
      next
    }

    /^## / {
      section = $0
      sections[section] = 1
      next
    }

    section == "## Goal Inventory" && /^\|/ {
      if (!inventory_header_seen) {
        inventory_header_seen = 1
        next
      }
      if (is_separator($0)) {
        next
      }

      split($0, cells, "|")
      goal_id = trim(cells[2])
      locked_goal = trim(cells[3])
      done_when = trim(cells[4])

      if (goal_id == "" && locked_goal == "" && done_when == "") {
        next
      }

      inventory_count++
      inventory_ids[inventory_count] = goal_id

      if (goal_id in inventory_goal) {
        push_error("duplicate Goal Inventory id: " goal_id)
      }

      inventory_goal[goal_id] = locked_goal
      inventory_done_when[goal_id] = done_when
      next
    }

    section == "## Goal Verification" && /^\|/ {
      if (!verification_header_seen) {
        verification_header_seen = 1
        next
      }
      if (is_separator($0)) {
        next
      }

      split($0, cells, "|")
      goal_id = trim(cells[2])
      goal_status = trim(cells[3])
      evidence = trim(cells[4])
      notes = trim(cells[5])

      if (goal_id == "" && goal_status == "" && evidence == "" && notes == "") {
        next
      }

      verification_count++

      if (goal_id in verification_status) {
        push_error("duplicate Goal Verification id: " goal_id)
      }

      verification_status[goal_id] = goal_status
      verification_evidence[goal_id] = evidence
      verification_notes[goal_id] = notes
      next
    }

    section == "## WBS" && /^\|/ {
      if (!wbs_header_seen) {
        wbs_header_seen = 1
        next
      }
      if (is_separator($0)) {
        next
      }

      split($0, cells, "|")
      wbs_id = trim(cells[2])
      wbs_status = trim(cells[4])

      if (wbs_id != "" || wbs_status != "") {
        wbs_count++
        wbs_ids[wbs_count] = wbs_id
        wbs_statuses[wbs_count] = wbs_status
      }
      next
    }

    END {
      allowed_verification_status["Pending"] = 1
      allowed_verification_status["In Progress"] = 1
      allowed_verification_status["Done"] = 1
      allowed_verification_status["Blocked"] = 1
      allowed_verification_status["Cancelled"] = 1
      allowed_verification_status["Superseded"] = 1
      allowed_verification_status["N/A"] = 1
      allowed_doc_status["draft"] = 1
      allowed_doc_status["active"] = 1
      allowed_doc_status["blocked"] = 1
      allowed_doc_status["done"] = 1
      allowed_doc_status["closed"] = 1
      allowed_doc_status["superseded"] = 1
      allowed_doc_status["cancelled"] = 1

      if (fm_type != "") {
        if (type == "") {
          type = fm_type
        } else if (type != fm_type) {
          push_error("frontmatter type does not match visible metadata: " fm_type " != " type)
        }
      }

      if (fm_doc_status != "") {
        if (doc_status == "") {
          doc_status = fm_doc_status
        } else if (doc_status != fm_doc_status) {
          push_error("frontmatter status does not match visible metadata: " fm_doc_status " != " doc_status)
        }
      }

      if (fm_completion_mode != "") {
        if (completion_mode == "") {
          completion_mode = fm_completion_mode
        } else if (completion_mode != fm_completion_mode) {
          push_error("frontmatter completion_mode does not match visible metadata: " fm_completion_mode " != " completion_mode)
        }
      }

      if (fm_project_role != "") {
        if (project_role == "") {
          project_role = fm_project_role
        } else if (project_role != fm_project_role) {
          push_error("frontmatter project_role does not match visible metadata: " fm_project_role " != " project_role)
        }
      }

      if (fm_umbrella_initiative != "") {
        if (umbrella_initiative == "") {
          umbrella_initiative = fm_umbrella_initiative
        } else if (umbrella_initiative != fm_umbrella_initiative) {
          push_error("frontmatter umbrella_initiative does not match visible metadata: " fm_umbrella_initiative " != " umbrella_initiative)
        }
      }

      if (fm_parent_umbrella_project != "") {
        if (parent_umbrella_project == "") {
          parent_umbrella_project = fm_parent_umbrella_project
        } else if (parent_umbrella_project != fm_parent_umbrella_project) {
          push_error("frontmatter parent_umbrella_project does not match visible metadata: " fm_parent_umbrella_project " != " parent_umbrella_project)
        }
      }

      if (fm_related_control_plane != "") {
        if (related_control_plane == "") {
          related_control_plane = fm_related_control_plane
        } else if (related_control_plane != fm_related_control_plane) {
          push_error("frontmatter related_control_plane does not match visible metadata: " fm_related_control_plane " != " related_control_plane)
        }
      }

      if (fm_related_umbrella_project != "") {
        if (related_umbrella_project == "") {
          related_umbrella_project = fm_related_umbrella_project
        } else if (related_umbrella_project != fm_related_umbrella_project) {
          push_error("frontmatter related_umbrella_project does not match visible metadata: " fm_related_umbrella_project " != " related_umbrella_project)
        }
      }

      if (fm_related_initiative != "") {
        if (related_initiative == "") {
          related_initiative = fm_related_initiative
        } else if (related_initiative != fm_related_initiative) {
          push_error("frontmatter related_initiative does not match visible metadata: " fm_related_initiative " != " related_initiative)
        }
      }

      if (fm_initiative_relation != "") {
        if (initiative_relation == "") {
          initiative_relation = fm_initiative_relation
        } else if (initiative_relation != fm_initiative_relation) {
          push_error("frontmatter initiative_relation does not match visible metadata: " fm_initiative_relation " != " initiative_relation)
        }
      }

      if (fm_related_project != "") {
        if (related_project == "") {
          related_project = fm_related_project
        } else if (related_project != fm_related_project) {
          push_error("frontmatter related_project does not match visible metadata: " fm_related_project " != " related_project)
        }
      }

      if (type != "task" && type != "project") {
        push_error("only task/project docs are supported, found Type: " type)
      }

      if (doc_status == "") {
        push_error("missing Status metadata")
      } else if (!(doc_status in allowed_doc_status)) {
        push_error("unsupported Status: " doc_status)
      }

      if (completion_mode == "") {
        push_error("missing Completion Mode metadata")
      }

      if (related_control_plane == "") {
        push_error("missing Related Control Plane metadata")
      }

      required_sections["## Purpose"] = 1
      required_sections["## Whole-System Anchor"] = 1
      required_sections["## Committed Outcome"] = 1
      required_sections["## Goal Inventory"] = 1
      required_sections["## Outputs / Handoff"] = 1
      required_sections["## Quality Axes In Scope"] = 1
      required_sections["## Goal Verification"] = 1
      required_sections["## Completion Evidence"] = 1
      required_sections["## Completion Guardrails"] = 1
      required_sections["## Status"] = 1

      if (type == "task") {
        required_sections["## Completion Criteria"] = 1
        required_sections["## Task Placement Check"] = 1
      }

      if (type == "task" && (fm_lineage_contract == "v2" || related_project ~ /^P[0-9][0-9][0-9][0-9]$/)) {
        if (related_project !~ /^P[0-9][0-9][0-9][0-9]$/) {
          push_error("modern task Related Project must match P####: " related_project)
        }
      } else if (type == "task") {
        if (related_umbrella_project == "") {
          push_error("task requires modern Related Project or legacy Related Umbrella Project metadata")
        }
        if (related_project != "" && related_project !~ /^docs\/projects\/P[0-9][0-9][0-9][0-9](-[A-Za-z0-9._-]+)?\.md$/) {
          push_error("legacy Related Project mirror must be empty or match docs/projects/P####[-slug].md: " related_project)
        }
      }

      if (type == "project") {
        required_sections["## Exit Criteria"] = 1
        required_sections["## Project Issuance Check"] = 1
      }

      if (type == "project" && related_initiative != "") {
        required_sections["## Initiative Alignment"] = 1
        if (related_initiative !~ /^I[0-9][0-9][0-9][0-9]$/) {
          push_error("modern project Related Initiative must match I####: " related_initiative)
        }
        if (initiative_relation != "delivers" && initiative_relation != "supports" && initiative_relation != "explores") {
          push_error("modern project Initiative Relation must be delivers|supports|explores, found: " initiative_relation)
        }
      } else if (type == "project") {
        required_sections["## Umbrella Lineage"] = 1
        if (project_role == "") push_error("legacy project is missing Project Role metadata")
        if (umbrella_initiative == "") push_error("legacy project is missing Umbrella Initiative metadata")
        if (parent_umbrella_project == "") push_error("legacy project is missing Parent Umbrella Project metadata")
      }

      if (type == "project" && related_initiative == "" && project_role != "") {
        if (project_role != "umbrella" && project_role != "exception-branch") {
          push_error("unsupported Project Role: " project_role)
        }

        if (project_role == "umbrella" && parent_umbrella_project != "self") {
          push_error("umbrella project must use Parent Umbrella Project: self")
        }

        if (project_role == "exception-branch" && (parent_umbrella_project == "" || parent_umbrella_project == "self")) {
          push_error("exception-branch project must reference a parent umbrella project")
        }
      }

      for (header in required_sections) {
        if (!(header in sections)) {
          push_error("missing section: " header)
        }
      }

      if (inventory_count < 1) {
        push_error("Goal Inventory must contain at least one goal row")
      }

      if (verification_count < 1) {
        push_error("Goal Verification must contain at least one goal row")
      }

      for (i = 1; i <= inventory_count; i++) {
        goal_id = inventory_ids[i]

        if (goal_id !~ /^G[0-9]+$/) {
          push_error("Goal Inventory id must use G<number> format: " goal_id)
        }

        if (trim(inventory_goal[goal_id]) == "") {
          push_error("Goal Inventory row is missing Locked Goal text: " goal_id)
        }

        if (trim(inventory_done_when[goal_id]) == "") {
          push_error("Goal Inventory row is missing Done When text: " goal_id)
        }

        if (!(goal_id in verification_status)) {
          push_error("Goal Verification is missing row for " goal_id)
          continue
        }

        if (!(verification_status[goal_id] in allowed_verification_status)) {
          push_error("Goal Verification has unsupported status for " goal_id ": " verification_status[goal_id])
        }

        if (doc_status == "done" || doc_status == "closed") {
          if (verification_status[goal_id] != "Done") {
            push_error("terminal doc requires Goal Verification status Done for " goal_id)
          }

          if (invalid_evidence(verification_evidence[goal_id])) {
            push_error("terminal doc requires non-empty evidence for " goal_id)
          }
        }
      }

      for (goal_id in verification_status) {
        if (!(goal_id in inventory_goal)) {
          push_error("Goal Verification has extra row not present in Goal Inventory: " goal_id)
        }
      }

      if (doc_status == "done" || doc_status == "closed") {
        for (i = 1; i <= wbs_count; i++) {
          if (wbs_statuses[i] ~ /^(Todo|In Progress|Pending|Blocked)$/) {
            push_error("terminal doc cannot keep unresolved WBS item " wbs_ids[i] " with status " wbs_statuses[i])
          }
        }
      }

      if (error_count > 0) {
        for (i = 1; i <= error_count; i++) {
          print "error: " path ": " errors[i] > "/dev/stderr"
        }
        exit 1
      }
    }
  ' "$file"
}

is_task_doc() {
  awk '
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit found ? 0 : 1 }
    in_frontmatter && /^type:[[:space:]]*task[[:space:]]*$/ { found = 1 }
    END { exit found ? 0 : 1 }
  ' "$1"
}

TARGETS=()

if [[ $# -eq 0 ]]; then
  collect_default_targets
elif [[ $# -eq 1 && "$1" == "--all" ]]; then
  collect_default_targets
else
  for arg in "$@"; do
    TARGETS+=("$arg")
  done
fi

if [[ ${#TARGETS[@]} -eq 0 ]]; then
  echo "No initiative/task/project/qa docs to validate."
  exit 0
fi

EXECUTION_TARGETS=()
for file in "${TARGETS[@]}"; do
  validate_file "$file"
  if is_task_doc "$file"; then
    EXECUTION_TARGETS+=("$file")
  fi
done

"$EXECUTION_VALIDATOR" --all
if [[ ${#EXECUTION_TARGETS[@]} -gt 0 ]]; then
  "$EXECUTION_VALIDATOR" "${EXECUTION_TARGETS[@]}"
fi
"$DOMAIN_LINEAGE_VALIDATOR" "${TARGETS[@]}"

echo "Validated ${#TARGETS[@]} doc(s)."
