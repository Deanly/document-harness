#!/usr/bin/env bash

set -euo pipefail

DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(dirname "$DOCS_DIR")"
AUTHORITY_VALIDATOR="$DOCS_DIR/lib/domain-design-authority.mjs"
error_count=0
TARGETS=()

error() {
  echo "error: $*" >&2
  error_count=$((error_count + 1))
}

frontmatter_scalar() {
  local file="$1"
  local key="$2"
  awk -v wanted="$key" '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      if (value ~ /^".*"$/ || value ~ /^\047.*\047$/) value = substr(value, 2, length(value) - 2)
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

frontmatter_list() {
  local file="$1"
  local key="$2"
  awk -v list_key="$key" '
    $0 ~ "^" list_key ":[[:space:]]*$" { in_list = 1; next }
    in_list && /^  -[[:space:]]+[^[:space:]]/ {
      value = $0
      sub(/^  -[[:space:]]+/, "", value)
      gsub(/^"|"$/, "", value)
      print value
      next
    }
    in_list && /^[^[:space:]]/ { in_list = 0 }
  ' "$file"
}

list_contains() {
  local file="$1"
  local key="$2"
  local wanted="$3"
  frontmatter_list "$file" "$key" | grep -Fqx "$wanted"
}

meaningful() {
  [[ -n "$1" && "$1" != "null" && "$1" != "~" && "$1" != "[]" ]]
}

is_terminal_or_active() {
  case "$1" in
    active|blocked|done|closed|current) return 0 ;;
    *) return 1 ;;
  esac
}

validate_model_ref() {
  local owner="$1"
  local context="$2"
  local model_ref="$3"
  local resolved="$REPO_ROOT/$model_ref"
  local model_context

  [[ "$model_ref" =~ ^docs/design/contexts/[^/]+/domain-model\.md$ ]] || {
    error "$owner domain_model_refs must point to docs/design/contexts/<context>/domain-model.md: $model_ref"
    return
  }
  [[ -f "$resolved" ]] || { error "$owner references missing domain model: $model_ref"; return; }
  model_context="$(frontmatter_scalar "$resolved" bounded_context)"
  [[ "$model_context" == "$context" ]] || error "$owner domain context/ref mismatch: $context != $model_context"
  if ! node "$AUTHORITY_VALIDATOR" --root "$REPO_ROOT" --document "$model_ref" >/dev/null; then
    error "$owner domain model is not approved/current at its exact bytes: $model_ref"
  fi
}

validate_coverage() {
  local file="$1"
  local owner="$2"
  local id
  local ref
  local found

  for id in $(frontmatter_list "$file" covered_rule_ids); do
    [[ "$id" =~ ^BR-[A-Z0-9-]+$ ]] || { error "$owner has invalid covered_rule_ids entry: $id"; continue; }
    grep -Fq "$id" "$file" || error "$owner coverage table is missing rule $id"
    found=0
    while IFS= read -r ref; do
      [[ -f "$REPO_ROOT/$ref" ]] && grep -Fq "$id" "$REPO_ROOT/$ref" && found=1
    done < <(frontmatter_list "$file" domain_model_refs)
    [[ "$found" -eq 1 ]] || error "$owner covered rule is absent from domain_model_refs: $id"
  done
  for id in $(frontmatter_list "$file" covered_scenario_ids); do
    [[ "$id" =~ ^SCN-[A-Z0-9-]+$ ]] || { error "$owner has invalid covered_scenario_ids entry: $id"; continue; }
    grep -Fq "$id" "$file" || error "$owner coverage table is missing scenario $id"
    found=0
    while IFS= read -r ref; do
      [[ -f "$REPO_ROOT/$ref" ]] && grep -Fq "$id" "$REPO_ROOT/$ref" && found=1
      if [[ "$ref" =~ /domain-model\.md$ ]]; then
        local examples_ref="${ref%/domain-model.md}/examples.md"
        [[ -f "$REPO_ROOT/$examples_ref" ]] && grep -Fq "$id" "$REPO_ROOT/$examples_ref" && found=1
      fi
    done < <(frontmatter_list "$file" domain_model_refs)
    [[ "$found" -eq 1 ]] || error "$owner covered scenario is absent from domain model/examples: $id"
  done
}

validate_file() {
  local file="$1"
  local relative="${file#$REPO_ROOT/}"
  local type
  local status
  local contract
  local impact
  local context_count
  local ref_count
  local context
  local ref
  local index

  [[ -f "$file" ]] || { error "file not found: $relative"; return; }
  type="$(frontmatter_scalar "$file" type)"
  if [[ "$type" != "project" && "$type" != "task" && "$type" != "qa" ]]; then
    return 0
  fi
  status="$(frontmatter_scalar "$file" status)"
  contract="$(frontmatter_scalar "$file" domain_contract)"
  impact="$(frontmatter_scalar "$file" domain_impact)"

  if [[ "$contract" == "legacy-v0" ]]; then
    if [[ "$status" != "done" && "$status" != "closed" && "$status" != "retired" ]]; then
      error "$relative legacy-v0 is allowed only for terminal historical documents"
    fi
    return
  fi
  [[ "$contract" == "v1" ]] || { error "$relative must declare domain_contract: v1 or explicit terminal legacy-v0"; return; }
  case "$impact" in required|none) ;; *) error "$relative domain_impact must be required|none";; esac
  if [[ "$(frontmatter_list "$file" actor_roles | wc -l | tr -d ' ')" -eq 0 ]]; then
    error "$relative requires actor_roles"
  fi
  if ! is_terminal_or_active "$status"; then return; fi

  if [[ "$impact" == "none" ]]; then
    meaningful "$(frontmatter_scalar "$file" domain_impact_reason)" || error "$relative domain_impact none requires domain_impact_reason"
    meaningful "$(frontmatter_scalar "$file" domain_review_ref)" || error "$relative domain_impact none requires human domain_review_ref"
    return
  fi

  context_count="$(frontmatter_list "$file" domain_contexts | wc -l | tr -d ' ')"
  ref_count="$(frontmatter_list "$file" domain_model_refs | wc -l | tr -d ' ')"
  [[ "$context_count" -gt 0 ]] || error "$relative required domain impact needs domain_contexts"
  [[ "$ref_count" -gt 0 ]] || error "$relative required domain impact needs domain_model_refs"
  [[ "$context_count" -eq "$ref_count" ]] || error "$relative domain_contexts and domain_model_refs must have 1:1 cardinality"

  index=1
  while IFS= read -r context; do
    ref="$(frontmatter_list "$file" domain_model_refs | sed -n "${index}p")"
    validate_model_ref "$relative" "$context" "$ref"
    index=$((index + 1))
  done < <(frontmatter_list "$file" domain_contexts)

  if [[ "$type" == "qa" ]]; then
    [[ "$(frontmatter_list "$file" covered_rule_ids | wc -l | tr -d ' ')" -gt 0 ]] || error "$relative current QA requires covered_rule_ids"
    [[ "$(frontmatter_list "$file" covered_scenario_ids | wc -l | tr -d ' ')" -gt 0 ]] || error "$relative current QA requires covered_scenario_ids"
    [[ "$(frontmatter_list "$file" source_documents | wc -l | tr -d ' ')" -gt 0 ]] || error "$relative current QA requires source_documents"
    validate_coverage "$file" "$relative"
  fi
}

if [[ $# -eq 0 || "${1:-}" == "--all" ]]; then
  while IFS= read -r -d '' file; do TARGETS+=("$file"); done < <(
    find "$DOCS_DIR"/projects "$DOCS_DIR"/tasks "$DOCS_DIR"/qa -maxdepth 1 -type f -name '*.md' ! -name README.md -print0 | sort -z
  )
else
  for candidate in "$@"; do
    [[ "$candidate" = /* ]] || candidate="$REPO_ROOT/$candidate"
    TARGETS+=("$candidate")
  done
fi

for file in "${TARGETS[@]}"; do validate_file "$file"; done
if [[ "$error_count" -gt 0 ]]; then
  echo "Domain lineage validation failed with $error_count error(s)." >&2
  exit 1
fi
echo "Validated domain lineage for ${#TARGETS[@]} delivery/QA document(s)."
