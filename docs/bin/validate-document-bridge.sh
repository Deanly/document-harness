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
  for key in workstream_kind code_baseline_ref document_issuance_ref document_bridge_ref delivery_branch; do
    local expected=""
    case "$key" in
      workstream_kind) expected="$workstream" ;;
      code_baseline_ref) expected="$baseline" ;;
      document_issuance_ref) expected="$issuance" ;;
      document_bridge_ref) expected="$bridge" ;;
      delivery_branch) expected="$delivery" ;;
    esac
    [[ "$(frontmatter_scalar "$REPO_ROOT/$document_path" "$key")" == "$expected" ]] || \
      error "$receipt_rel and $document_path disagree on $key"
  done
  [[ "$(frontmatter_scalar "$REPO_ROOT/$document_path" document_issuance_receipt)" == "$receipt_rel" ]] || \
    error "$document_path does not point back to $receipt_rel"

  if [[ "$(git -C "$REPO_ROOT" rev-parse "${bridge}^")" != "$baseline" ]]; then
    error "$receipt_rel bridge parent is not the declared code baseline"
  fi
  while IFS= read -r changed_path; do
    case "$changed_path" in
      AGENTS.md|CLAUDE.md|.agents/*|.claude/*|docs/*|runtime/document-harness-view/*) ;;
      *) error "$receipt_rel bridge changes product path: $changed_path" ;;
    esac
  done < <(git -C "$REPO_ROOT" diff --name-only "$baseline" "$bridge")

  while IFS= read -r changed_path; do
    [[ "$changed_path" == "$document_path" ]] || \
      error "$receipt_rel bridge does not exactly project issuance docs; unexpected delta: $changed_path"
  done < <(git -C "$REPO_ROOT" diff --name-only "$issuance" "$bridge" -- AGENTS.md CLAUDE.md .agents .claude docs runtime/document-harness-view)

  finalization="$(git -C "$REPO_ROOT" log --diff-filter=A --format=%H -1 -- "$receipt_rel")"
  if [[ -z "$finalization" ]]; then
    error "$receipt_rel is not committed"
    return
  fi
  git -C "$REPO_ROOT" merge-base --is-ancestor "$bridge" "$finalization" || \
    error "$receipt_rel finalization does not descend from the declared bridge"

  if [[ "$REMOTE_MODE" == "true" ]]; then
    for remote_ref in origin/main "origin/$delivery"; do
      git -C "$REPO_ROOT" rev-parse --verify "${remote_ref}^{commit}" >/dev/null 2>&1 || {
        error "missing remote ref: $remote_ref"
        continue
      }
      git -C "$REPO_ROOT" merge-base --is-ancestor "$finalization" "$remote_ref" || \
        error "$finalization is not shared by $remote_ref"
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
