#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./docs/bin/validate-closeout.sh --all
  ./docs/bin/validate-closeout.sh <doc-path> [<doc-path> ...]

Rules:
  - Only task/project docs are validated.
  - Related Control Plane must be present.
  - Tasks must declare Related Umbrella Project and Task Placement Check.
  - Projects must declare Project Role, Umbrella Initiative, Parent Umbrella Project, Umbrella Lineage, and Project Issuance Check.
  - Whole-System Anchor, Outputs / Handoff, Quality Axes In Scope must exist.
  - Goal Inventory and Goal Verification must both exist.
  - Goal IDs must match 1:1 between both sections.
  - If Status is done/closed, every goal must be Done with non-empty evidence.
  - If Status is done/closed, WBS cannot contain Todo/In Progress/Pending/Blocked items.
EOF
}

collect_default_targets() {
  local path

  shopt -s nullglob
  for path in "$ROOT_DIR"/tasks/T*.md "$ROOT_DIR"/projects/P*.md; do
    TARGETS+=("$path")
  done
  shopt -u nullglob
}

validate_file() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    echo "error: file not found: $file" >&2
    return 1
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

      if (type != "task" && type != "project") {
        push_error("only task/project docs are supported, found Type: " type)
      }

      if (doc_status == "") {
        push_error("missing Status metadata")
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

      if (type == "task" && related_umbrella_project == "") {
        push_error("missing Related Umbrella Project metadata")
      }

      if (type == "project") {
        required_sections["## Exit Criteria"] = 1
        required_sections["## Umbrella Lineage"] = 1
        required_sections["## Project Issuance Check"] = 1
      }

      if (type == "project" && project_role == "") {
        push_error("missing Project Role metadata")
      }

      if (type == "project" && umbrella_initiative == "") {
        push_error("missing Umbrella Initiative metadata")
      }

      if (type == "project" && parent_umbrella_project == "") {
        push_error("missing Parent Umbrella Project metadata")
      }

      if (type == "project" && project_role != "") {
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
  echo "No task/project docs to validate."
  exit 0
fi

for file in "${TARGETS[@]}"; do
  validate_file "$file"
done

echo "Validated ${#TARGETS[@]} doc(s)."
