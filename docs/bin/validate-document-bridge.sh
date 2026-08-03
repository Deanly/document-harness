#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_MODE="false"
TARGET=""
ERRORS=0

usage() {
  cat <<'EOF'
Usage:
  ./docs/bin/validate-document-bridge.sh [--remote] <receipt.json|--all>

Without --remote, validates immutable refs, receipt/document alignment and that
the bridge changes document-control paths only. --remote additionally requires
the exact finalization commit to be reachable from origin/main and the receipt's
origin/<deliveryBranch>.
EOF
}

error() {
  echo "error: $*" >&2
  ERRORS=$((ERRORS + 1))
}

json_value() {
  node -e '
    const fs = require("node:fs");
    const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))[process.argv[2]];
    if (value !== undefined && value !== null) process.stdout.write(String(value));
  ' "$1" "$2"
}

frontmatter_scalar() {
  local file="$1"
  local requested_key="$2"
  awk -v requested_key="$requested_key" '
    function trim(value) { sub(/^[[:space:]]+/, "", value); sub(/[[:space:]]+$/, "", value); return value }
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit }
    in_frontmatter {
      separator = index($0, ":"); if (separator == 0) next
      key = trim(substr($0, 1, separator - 1)); if (key != requested_key) next
      print trim(substr($0, separator + 1)); exit
    }
  ' "$file"
}

frontmatter_scalar_at_ref() {
  local ref="$1"
  local file="$2"
  local requested_key="$3"
  git -C "$REPO_ROOT" show "${ref}:${file}" 2>/dev/null | awk -v requested_key="$requested_key" '
    function trim(value) { sub(/^[[:space:]]+/, "", value); sub(/[[:space:]]+$/, "", value); return value }
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit }
    in_frontmatter {
      separator = index($0, ":"); if (separator == 0) next
      key = trim(substr($0, 1, separator - 1)); if (key != requested_key) next
      print trim(substr($0, separator + 1)); exit
    }
  '
}

resolve_delivery_branch() {
  local receipt_rel="$1"
  local document_id="$2"
  local document_path="$3"
  local issued_delivery="$4"
  local current_delivery="$5"

  RESOLVED_DELIVERY_BRANCH="$issued_delivery"
  RESOLVED_MIGRATION_REF=""
  RESOLVED_MIGRATION_RECEIPT_COMMIT=""
  if [[ "$current_delivery" == "$issued_delivery" ]]; then
    return
  fi

  local migration_dir="$REPO_ROOT/docs/receipts/document-delivery-migration"
  local migration_rel=""
  local migration_count=0
  local candidate candidate_rel candidate_issuance candidate_to
  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] || continue
    candidate_rel="${candidate#$REPO_ROOT/}"
    candidate_issuance="$(json_value "$candidate" originalIssuanceReceipt)"
    candidate_to="$(json_value "$candidate" toDeliveryBranch)"
    if [[ "$candidate_issuance" == "$receipt_rel" && "$candidate_to" == "$current_delivery" ]]; then
      migration_rel="$candidate_rel"
      migration_count=$((migration_count + 1))
    fi
  done < <(find "$migration_dir" -type f -name "${document_id}-*.json" 2>/dev/null | sort)

  if (( migration_count != 1 )); then
    error "$receipt_rel and $document_path disagree on delivery_branch; expected exactly one matching delivery-branch migration receipt, found $migration_count"
    return
  fi

  local migration="$REPO_ROOT/$migration_rel"
  local receipt_kind migration_document_id migration_document_path original_issuance
  local from_delivery to_delivery migration_ref decision_ref alignment_ref migration_receipt_commit
  receipt_kind="$(json_value "$migration" receiptKind)"
  migration_document_id="$(json_value "$migration" documentId)"
  migration_document_path="$(json_value "$migration" documentPath)"
  original_issuance="$(json_value "$migration" originalIssuanceReceipt)"
  from_delivery="$(json_value "$migration" fromDeliveryBranch)"
  to_delivery="$(json_value "$migration" toDeliveryBranch)"
  migration_ref="$(json_value "$migration" migrationRef)"
  decision_ref="$(json_value "$migration" decisionRef)"
  alignment_ref="$(json_value "$migration" alignmentRef)"

  [[ "$receipt_kind" == "document-delivery-branch-migration" ]] || error "$migration_rel has invalid receiptKind"
  [[ "$migration_document_id" == "$document_id" ]] || error "$migration_rel documentId does not match $receipt_rel"
  [[ "$migration_document_path" == "$document_path" ]] || error "$migration_rel documentPath does not match $receipt_rel"
  [[ "$original_issuance" == "$receipt_rel" ]] || error "$migration_rel originalIssuanceReceipt does not match $receipt_rel"
  [[ "$from_delivery" == "$issued_delivery" ]] || error "$migration_rel fromDeliveryBranch does not match the immutable issuance receipt"
  [[ "$to_delivery" == "$current_delivery" ]] || error "$migration_rel toDeliveryBranch does not match $document_path"
  [[ "$migration_ref" =~ ^[0-9a-f]{40}$ ]] || error "$migration_rel migrationRef is not a full immutable commit SHA"
  git -C "$REPO_ROOT" cat-file -e "${migration_ref}^{commit}" 2>/dev/null || error "$migration_rel cannot resolve migrationRef $migration_ref"
  [[ -n "$decision_ref" && -f "$REPO_ROOT/$decision_ref" ]] || error "$migration_rel decisionRef does not exist: $decision_ref"
  [[ -z "$alignment_ref" || -f "$REPO_ROOT/$alignment_ref" ]] || error "$migration_rel alignmentRef does not exist: $alignment_ref"

  [[ "$(frontmatter_scalar_at_ref "${migration_ref}^" "$document_path" delivery_branch)" == "$from_delivery" ]] || \
    error "$migration_rel migrationRef parent does not show fromDeliveryBranch"
  [[ "$(frontmatter_scalar_at_ref "$migration_ref" "$document_path" delivery_branch)" == "$to_delivery" ]] || \
    error "$migration_rel migrationRef does not show toDeliveryBranch"
  git -C "$REPO_ROOT" merge-base --is-ancestor "$migration_ref" HEAD || \
    error "$migration_rel migrationRef is not reachable from the current branch"

  migration_receipt_commit="$(git -C "$REPO_ROOT" log --diff-filter=A --format=%H -1 -- "$migration_rel")"
  if [[ -z "$migration_receipt_commit" ]]; then
    error "$migration_rel is not committed"
    return
  fi
  git -C "$REPO_ROOT" merge-base --is-ancestor "$migration_ref" "$migration_receipt_commit" || \
    error "$migration_rel receipt commit does not descend from migrationRef"

  RESOLVED_DELIVERY_BRANCH="$to_delivery"
  RESOLVED_MIGRATION_REF="$migration_ref"
  RESOLVED_MIGRATION_RECEIPT_COMMIT="$migration_receipt_commit"
}

validate_receipt() {
  local receipt_rel="$1"
  local receipt="$REPO_ROOT/$receipt_rel"
  if [[ ! -f "$receipt" ]]; then
    error "missing issuance receipt: $receipt_rel"
    return
  fi

  local document_id document_path workstream baseline issuance bridge delivery finalization
  document_id="$(json_value "$receipt" documentId)"
  document_path="$(json_value "$receipt" documentPath)"
  workstream="$(json_value "$receipt" workstreamKind)"
  baseline="$(json_value "$receipt" codeBaselineRef)"
  issuance="$(json_value "$receipt" documentIssuanceRef)"
  bridge="$(json_value "$receipt" documentBridgeRef)"
  delivery="$(json_value "$receipt" deliveryBranch)"

  [[ "$document_id" =~ ^(I|P|T|QA)[0-9]{4}$ ]] || error "$receipt_rel has invalid documentId"
  [[ "$workstream" == "feature" || "$workstream" == "hotfix" ]] || error "$receipt_rel has invalid workstreamKind"
  for value_name in baseline issuance bridge; do
    local value="${!value_name}"
    [[ "$value" =~ ^[0-9a-f]{40}$ ]] || error "$receipt_rel $value_name is not a full immutable commit SHA"
    git -C "$REPO_ROOT" cat-file -e "${value}^{commit}" 2>/dev/null || error "$receipt_rel cannot resolve $value_name $value"
  done
  [[ "$delivery" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] || error "$receipt_rel has invalid deliveryBranch"

  if [[ ! -f "$REPO_ROOT/$document_path" ]]; then
    error "$receipt_rel documentPath does not exist: $document_path"
    return
  fi
  for key in workstream_kind code_baseline_ref document_issuance_ref document_bridge_ref; do
    local expected=""
    case "$key" in
      workstream_kind) expected="$workstream" ;;
      code_baseline_ref) expected="$baseline" ;;
      document_issuance_ref) expected="$issuance" ;;
      document_bridge_ref) expected="$bridge" ;;
    esac
    [[ "$(frontmatter_scalar "$REPO_ROOT/$document_path" "$key")" == "$expected" ]] || \
      error "$receipt_rel and $document_path disagree on $key"
  done
  local current_delivery
  current_delivery="$(frontmatter_scalar "$REPO_ROOT/$document_path" delivery_branch)"
  resolve_delivery_branch "$receipt_rel" "$document_id" "$document_path" "$delivery" "$current_delivery"
  local effective_delivery="$RESOLVED_DELIVERY_BRANCH"
  local migration_ref="$RESOLVED_MIGRATION_REF"
  local migration_receipt_commit="$RESOLVED_MIGRATION_RECEIPT_COMMIT"
  [[ "$(frontmatter_scalar "$REPO_ROOT/$document_path" document_issuance_receipt)" == "$receipt_rel" ]] || \
    error "$document_path does not point back to $receipt_rel"

  if [[ "$(git -C "$REPO_ROOT" rev-parse "${bridge}^")" != "$baseline" ]]; then
    error "$receipt_rel bridge parent is not the declared code baseline"
  fi
  while IFS= read -r changed_path; do
    case "$changed_path" in
      AGENTS.md|CLAUDE.md|document-harness.yaml|.agents/*|.claude/*|docs/*|runtime/document-harness-view/*) ;;
      *) error "$receipt_rel bridge changes product path: $changed_path" ;;
    esac
  done < <(git -C "$REPO_ROOT" diff --name-only "$baseline" "$bridge")

  while IFS= read -r changed_path; do
    [[ "$changed_path" == "$document_path" ]] || \
      error "$receipt_rel bridge does not exactly project issuance docs; unexpected delta: $changed_path"
  done < <(git -C "$REPO_ROOT" diff --name-only "$issuance" "$bridge" -- AGENTS.md CLAUDE.md document-harness.yaml .agents .claude docs runtime/document-harness-view)

  finalization="$(git -C "$REPO_ROOT" log --diff-filter=A --format=%H -1 -- "$receipt_rel")"
  if [[ -z "$finalization" ]]; then
    error "$receipt_rel is not committed"
    return
  fi
  git -C "$REPO_ROOT" merge-base --is-ancestor "$bridge" "$finalization" || \
    error "$receipt_rel finalization does not descend from the declared bridge"

  if [[ "$REMOTE_MODE" == "true" ]]; then
    for remote_ref in origin/main "origin/$effective_delivery"; do
      git -C "$REPO_ROOT" rev-parse --verify "${remote_ref}^{commit}" >/dev/null 2>&1 || {
        error "missing remote ref: $remote_ref"
        continue
      }
      git -C "$REPO_ROOT" merge-base --is-ancestor "$finalization" "$remote_ref" || \
        error "$finalization is not shared by $remote_ref"
      if [[ -n "$migration_ref" ]]; then
        git -C "$REPO_ROOT" merge-base --is-ancestor "$migration_ref" "$remote_ref" || \
          error "$migration_ref is not shared by $remote_ref"
        git -C "$REPO_ROOT" merge-base --is-ancestor "$migration_receipt_commit" "$remote_ref" || \
          error "$migration_receipt_commit is not shared by $remote_ref"
      fi
    done
  fi
}

if [[ "${1:-}" == "--remote" ]]; then
  REMOTE_MODE="true"
  shift
fi
TARGET="${1:-}"
if [[ -z "$TARGET" || $# -ne 1 ]]; then
  usage >&2
  exit 1
fi

if [[ "$TARGET" == "--all" ]]; then
  while IFS= read -r receipt; do
    validate_receipt "${receipt#$REPO_ROOT/}"
  done < <(find "$REPO_ROOT/docs/receipts/document-issuance" -type f -name '*.json' 2>/dev/null | sort)
else
  validate_receipt "${TARGET#./}"
fi

if (( ERRORS > 0 )); then
  echo "Document bridge validation failed with $ERRORS error(s)." >&2
  exit 1
fi
echo "Validated document issuance bridge receipts."
