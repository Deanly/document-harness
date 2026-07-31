#!/usr/bin/env bash

set -euo pipefail

DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(dirname "$DOCS_DIR")"
DESIGN_ROOT="$DOCS_DIR/design"
AUTHORITY_VALIDATOR="$DOCS_DIR/lib/domain-design-authority.mjs"
PRESENTATION_VALIDATOR="$DOCS_DIR/lib/human-presentation-authority.mjs"
CONTEXT_MAP="$DESIGN_ROOT/context-map.md"
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

frontmatter_list_contains() {
  local file="$1"
  local key="$2"
  local wanted="$3"
  awk -v list_key="$key" -v wanted="$wanted" '
    $0 ~ "^" list_key ":[[:space:]]*$" { in_list = 1; next }
    in_list && /^  -[[:space:]]+/ {
      value = $0
      sub(/^  -[[:space:]]+/, "", value)
      if (value == wanted) found = 1
      next
    }
    in_list && /^[^[:space:]]/ { in_list = 0 }
    END { exit found ? 0 : 1 }
  ' "$file"
}

frontmatter_list_count() {
  local file="$1"
  local key="$2"
  awk -v list_key="$key" '
    $0 ~ "^" list_key ":[[:space:]]*$" { in_list = 1; next }
    in_list && /^  -[[:space:]]+[^[:space:]]/ { count++; next }
    in_list && /^[^[:space:]]/ { in_list = 0 }
    END { print count + 0 }
  ' "$file"
}

require_section() {
  local file="$1"
  local section="$2"
  if ! grep -Fqx "## $section" "$file"; then
    error "${file#$REPO_ROOT/} missing section: ## $section"
  fi
}

require_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if ! grep -Eq "$pattern" "$file"; then
    error "${file#$REPO_ROOT/} missing $label"
  fi
}

validate_common() {
  local file="$1"
  local relative="${file#$REPO_ROOT/}"
  local type
  local kind
  local status
  local validation_status
  local model_revision
  local bounded_context_id
  local presentation_status
  local domain_expert_agent
  local authority_mode
  local decision_tier
  local board_review_level
  local board_review_status

  [[ "$(head -n 1 "$file")" == "---" ]] || error "$relative missing YAML frontmatter"
  type="$(frontmatter_scalar "$file" type)"
  kind="$(frontmatter_scalar "$file" design_kind)"
  status="$(frontmatter_scalar "$file" status)"
  validation_status="$(frontmatter_scalar "$file" validation_status)"
  model_revision="$(frontmatter_scalar "$file" model_revision)"
  bounded_context_id="$(frontmatter_scalar "$file" bounded_context_id)"
  presentation_status="$(frontmatter_scalar "$file" presentation_status)"
  domain_expert_agent="$(frontmatter_scalar "$file" domain_expert_agent)"
  authority_mode="$(frontmatter_scalar "$file" authority_mode)"
  decision_tier="$(frontmatter_scalar "$file" decision_tier)"
  board_review_level="$(frontmatter_scalar "$file" board_review_level)"
  board_review_status="$(frontmatter_scalar "$file" board_review_status)"

  [[ "$type" == "design" ]] || error "$relative must declare type: design"
  case "$kind" in
    domain-landscape|context-map|bounded-context|ubiquitous-language|domain-examples) ;;
    *) error "$relative has unsupported design_kind: ${kind:-missing}" ;;
  esac
  case "$status" in
    draft|review_requested|current|superseded) ;;
    *) error "$relative has unsupported status: ${status:-missing}" ;;
  esac
  case "$validation_status" in
    unreviewed|review_requested|ai-validated|approved|superseded) ;;
    *) error "$relative has unsupported validation_status: ${validation_status:-missing}" ;;
  esac
  [[ "$model_revision" =~ ^[1-9][0-9]*$ ]] || error "$relative model_revision must be a positive integer"
  [[ -n "$(frontmatter_scalar "$file" domain)" ]] || error "$relative missing domain"
  [[ -n "$(frontmatter_scalar "$file" bounded_context)" ]] || error "$relative missing bounded_context"
  [[ "$bounded_context_id" =~ ^(BC|DOMAIN|CONTEXT-MAP)-[A-Z0-9-]+$ ]] || error "$relative bounded_context_id has unsupported format: ${bounded_context_id:-missing}"
  [[ -n "$(frontmatter_scalar "$file" subdomain_type)" ]] || error "$relative missing subdomain_type"
  [[ -n "$(frontmatter_scalar "$file" owner)" ]] || error "$relative missing owner"
  [[ "$(frontmatter_list_count "$file" domain_expert_roles)" -gt 0 ]] || error "$relative requires domain_expert_roles"
  [[ "$(frontmatter_list_count "$file" source_refs)" -gt 0 ]] || error "$relative requires source_refs"
  for role in customer planner developer qa; do
    frontmatter_list_contains "$file" role_views "$role" || error "$relative role_views missing $role"
  done
  if [[ "$kind" != "domain-examples" ]]; then
    frontmatter_list_contains "$file" role_views architect || error "$relative role_views missing architect"
  fi
  if grep -Eq '\{\{[^}]+\}\}|(TERM|BC|AGG|ENT|VO|CMD|EVT|POL|BR|SCN)-\.\.\.' "$file"; then
    error "$relative contains unresolved placeholders"
  fi
  if [[ -n "$presentation_status" ]]; then
    case "$presentation_status" in
      missing|review_requested|ready) ;;
      *) error "$relative has unsupported presentation_status: $presentation_status" ;;
    esac
  fi
  if ! node "$PRESENTATION_VALIDATOR" --root "$REPO_ROOT" --document "$relative" --allow-review >/dev/null; then
    error "$relative human-facing presentation is invalid"
  fi
  if [[ "$presentation_status" == "review_requested" || "$presentation_status" == "ready" ]]; then
    case "$kind" in
      domain-landscape|context-map|bounded-context)
        require_section "$file" "Human Review Summary"
        ;;
    esac
  fi

  if [[ "$kind" == "bounded-context" ]]; then
    [[ "$domain_expert_agent" == "ai-domain-expert" ]] || error "$relative bounded-context must declare domain_expert_agent: ai-domain-expert"
    case "$authority_mode" in
      delegated-ai|human-required|human-confirmed) ;;
      *) error "$relative has unsupported authority_mode: ${authority_mode:-missing}" ;;
    esac
    case "$decision_tier" in
      routine|material|strategic) ;;
      *) error "$relative has unsupported decision_tier: ${decision_tier:-missing}" ;;
    esac
    case "$board_review_level" in
      bounded-context|aggregate|entity|value-object|business-rule|state-transition|ubiquitous-language|scenario) ;;
      *) error "$relative has unsupported board_review_level: ${board_review_level:-missing}" ;;
    esac
    case "$board_review_status" in
      not_required|review_requested|confirmed) ;;
      *) error "$relative has unsupported board_review_status: ${board_review_status:-missing}" ;;
    esac
    require_section "$file" "AI Domain Expert Board Review"
    require_pattern "$file" '^- 권고 결정:[[:space:]]*[^[:space:]].*$' "AI Domain Expert recommendation"
    require_pattern "$file" "^- 선택한 모델링 수준:[[:space:]]*$board_review_level[[:space:]]*$" "matching Board modeling level"
    require_pattern "$file" '^- 이 수준을 선택한 이유:[[:space:]]*[^[:space:]].*$' "Board level rationale"
    require_pattern "$file" '^- 사람이 확인할 핵심:[[:space:]]*[^[:space:]].*$' "human decision question"
    require_pattern "$file" '^- 승인하면 보호되는 결과:[[:space:]]*[^[:space:]].*$' "protected outcome"
    require_pattern "$file" '^- 반대하거나 수정해야 하는 조건:[[:space:]]*[^[:space:]].*$' "counter-condition"
    case "$board_review_level" in
      bounded-context) require_pattern "$file" '^- (포함|제외)(:|하는)[[:space:]]*[^[:space:]].*$' "bounded-context model slice" ;;
      aggregate) require_pattern "$file" '^\|[[:space:]]*AGG-[A-Z0-9-]+[[:space:]]*\|' "aggregate Board model slice" ;;
      entity) require_pattern "$file" '^\|[[:space:]]*ENT-[A-Z0-9-]+[[:space:]]*\|' "entity Board model slice" ;;
      value-object) require_pattern "$file" '^\|[[:space:]]*VO-[A-Z0-9-]+[[:space:]]*\|' "value-object Board model slice" ;;
      business-rule) require_pattern "$file" '^\|[[:space:]]*BR-[A-Z0-9-]+[[:space:]]*\|' "business-rule Board model slice" ;;
      state-transition) require_pattern "$file" '^\|[[:space:]]*[^|]+\|[[:space:]]*[^|]+\|[[:space:]]*CMD-[A-Z0-9-]+' "state-transition Board model slice" ;;
      ubiquitous-language) require_pattern "$file" '^\|[[:space:]]*TERM-[A-Z0-9-]+[[:space:]]*\|' "ubiquitous-language Board model slice" ;;
      scenario) require_pattern "$file" '^\|[[:space:]]*SCN-[A-Z0-9-]+[[:space:]]*\|' "scenario Board model slice" ;;
    esac
    if [[ "$decision_tier" == "routine" && "$board_review_status" != "not_required" ]]; then
      error "$relative routine decision must use board_review_status: not_required"
    fi
    if [[ "$decision_tier" != "routine" && "$board_review_status" == "not_required" ]]; then
      error "$relative material/strategic decision must be review_requested or confirmed on the Board"
    fi
    if [[ "$authority_mode" == "delegated-ai" && "$decision_tier" != "routine" ]]; then
      error "$relative delegated-ai authority is limited to decision_tier: routine"
    fi
    if [[ "$authority_mode" == "human-required" && "$board_review_status" != "review_requested" ]]; then
      error "$relative human-required authority must use board_review_status: review_requested"
    fi
    if [[ "$authority_mode" == "human-confirmed" && "$board_review_status" != "confirmed" ]]; then
      error "$relative human-confirmed authority must use board_review_status: confirmed"
    fi
  fi

  case "$status" in
    draft)
      [[ "$validation_status" == "unreviewed" || "$validation_status" == "review_requested" ]] || error "$relative draft has incompatible validation_status"
      ;;
    review_requested)
      [[ "$validation_status" == "review_requested" ]] || error "$relative review_requested must use validation_status: review_requested"
      ;;
    current)
      [[ "$validation_status" == "approved" || "$validation_status" == "ai-validated" ]] || error "$relative current must use validation_status: approved|ai-validated"
      if ! node "$AUTHORITY_VALIDATOR" --root "$REPO_ROOT" --document "$relative" >/dev/null; then
        error "$relative has no valid exact-byte domain authority receipt"
      fi
      ;;
    superseded)
      [[ "$validation_status" == "approved" || "$validation_status" == "superseded" ]] || error "$relative superseded has incompatible validation_status"
      ;;
  esac
}

validate_kind() {
  local file="$1"
  local kind
  kind="$(frontmatter_scalar "$file" design_kind)"
  case "$kind" in
    domain-landscape)
      for section in "Domain Vision And Customer Outcomes" "Domain Experts And Sources" "Subdomain Portfolio" "Core Domain Differentiation" "Cross-Context Business Flows" "Role Consumer Contract" "Unknowns And Disputes" "Change Impact" "Change Log"; do
        require_section "$file" "$section"
      done
      require_pattern "$file" 'BC-[A-Z0-9-]+' "bounded context IDs"
      ;;
    context-map)
      for section in "Purpose" "Bounded Context Registry" "Context Relationships" "Cross-Context Flows" "Translation And Ambiguity Rules" "Role Consumer Contract" "Unknowns And Disputes" "Change Impact" "Change Log"; do
        require_section "$file" "$section"
      done
      require_pattern "$file" 'BC-[A-Z0-9-]+' "bounded context IDs"
      ;;
    bounded-context)
      for section in "Domain Purpose And Customer Outcome" "Domain Experts And Sources" "Bounded Context Boundary" "Ubiquitous Language" "Domain Scenarios" "Domain Model" "Business Rules And Invariants" "State Transitions" "Context Relationships And Integration" "Failure And Exception Semantics" "Role Consumer Contract" "Traceability" "Decisions" "Unknowns And Disputes" "Change Impact" "Change Log"; do
        require_section "$file" "$section"
      done
      for requirement in 'AGG-[A-Z0-9-]+' 'CMD-[A-Z0-9-]+' 'EVT-[A-Z0-9-]+' 'BR-[A-Z0-9-]+' 'SCN-[A-Z0-9-]+'; do
        require_pattern "$file" "$requirement" "$requirement model IDs"
      done
      ;;
    ubiquitous-language)
      for section in "Context Language Boundary" "Terms" "State And Event Vocabulary" "Cross-Context Translations" "Ambiguities And Disputes" "Change Impact" "Change Log"; do
        require_section "$file" "$section"
      done
      require_pattern "$file" 'TERM-[A-Z0-9-]+' "TERM model IDs"
      ;;
    domain-examples)
      for section in "Purpose" "Business Examples" "Counterexamples" "QA Derivation" "Unknowns And Disputes" "Change Log"; do
        require_section "$file" "$section"
      done
      require_pattern "$file" 'SCN-[A-Z0-9-]+' "SCN model IDs"
      require_pattern "$file" 'BR-[A-Z0-9-]+' "BR model references"
      ;;
  esac
}

collect_targets() {
  if [[ $# -eq 0 || "${1:-}" == "--all" ]]; then
    while IFS= read -r -d '' file; do TARGETS+=("$file"); done < <(
      find "$DESIGN_ROOT" -type f -name '*.md' ! -name README.md -print0 | sort -z
    )
  else
    local candidate
    for candidate in "$@"; do
      [[ "$candidate" = /* ]] || candidate="$REPO_ROOT/$candidate"
      TARGETS+=("$candidate")
    done
  fi
}

validate_context_closure() {
  local context_dir
  local model
  local context_id
  for context_dir in "$DESIGN_ROOT"/contexts/*; do
    [[ -d "$context_dir" ]] || continue
    for required in domain-model.md ubiquitous-language.md examples.md; do
      [[ -f "$context_dir/$required" ]] || error "${context_dir#$REPO_ROOT/} missing $required"
    done
    model="$context_dir/domain-model.md"
    [[ -f "$model" ]] || continue
    context_id="$(frontmatter_scalar "$model" bounded_context_id)"
    grep -Fq "| $context_id |" "$CONTEXT_MAP" || error "docs/design/context-map.md does not register $context_id"
  done
}

collect_targets "$@"
[[ ${#TARGETS[@]} -gt 0 ]] || error "no domain design documents found"
for file in "${TARGETS[@]}"; do
  [[ -f "$file" ]] || { error "file not found: ${file#$REPO_ROOT/}"; continue; }
  validate_common "$file"
  validate_kind "$file"
done
if [[ $# -eq 0 || "${1:-}" == "--all" ]]; then
  validate_context_closure
fi

if [[ "$error_count" -gt 0 ]]; then
  echo "Domain design validation failed with $error_count error(s)." >&2
  exit 1
fi
echo "Validated ${#TARGETS[@]} DDD domain design document(s)."
