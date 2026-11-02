#!/usr/bin/env bash

set -euo pipefail

DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(dirname "$DOCS_DIR")"
AUTHORITY_VALIDATOR="$DOCS_DIR/lib/domain-supervision-authority.mjs"
MODE="inspect"
TARGETS=()
error_count=0
LEGACY_BASE_COMMIT=""

if [[ -f "$DOCS_DIR/_indexes/harness-installation.yaml" && -f "$DOCS_DIR/_indexes/governance-catalog.json" ]]; then
  LEGACY_BASE_COMMIT="$(node -e '
    const fs = require("node:fs");
    try {
      const lock = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const catalog = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
      const base = catalog?.migration?.capturedRepository?.baseCommit;
      if (lock?.release?.id === "document-harness-public-v1" && /^[a-f0-9]{40}$/.test(base)) process.stdout.write(base);
    } catch {}
  ' "$DOCS_DIR/_indexes/harness-installation.yaml" "$DOCS_DIR/_indexes/governance-catalog.json")"
  if [[ -n "$LEGACY_BASE_COMMIT" ]] && ! git -C "$REPO_ROOT" merge-base --is-ancestor "$LEGACY_BASE_COMMIT" HEAD 2>/dev/null; then
    LEGACY_BASE_COMMIT=""
  fi
fi

usage() {
  cat <<'EOF'
Usage:
  ./docs/bin/validate-domain-supervision.sh --all
  ./docs/bin/validate-domain-supervision.sh [--closeout] <project-or-task-or-qa> [...]

Active/current domain_contract v2 documents require an exact-byte AI Domain Expert
supervision review. Closeout additionally refuses unresolved decisions and conflicts;
only aligned delivery or an exact human-accepted temporary deviation may pass.
EOF
}

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

is_enforced_status() {
  case "$1" in
    active|blocked|done|closed|current) return 0 ;;
    *) return 1 ;;
  esac
}

collect_default_targets() {
  local root
  for root in "$DOCS_DIR/projects" "$DOCS_DIR/tasks" "$DOCS_DIR/qa"; do
    [[ -d "$root" ]] || continue
    while IFS= read -r -d '' file; do TARGETS+=("$file"); done < <(
      find "$root" -maxdepth 1 -type f -name '*.md' ! -name README.md -print0 | sort -z
    )
  done
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      collect_default_targets
      shift
      ;;
    --closeout)
      MODE="closeout"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      candidate="$1"
      [[ "$candidate" = /* ]] || candidate="$REPO_ROOT/$candidate"
      TARGETS+=("$candidate")
      shift
      ;;
  esac
done

if [[ ${#TARGETS[@]} -eq 0 ]]; then
  collect_default_targets
fi

validated=0
for file in "${TARGETS[@]}"; do
  [[ -f "$file" ]] || { error "file not found: $file"; continue; }
  type="$(frontmatter_scalar "$file" type)"
  case "$type" in project|task|qa) ;; *) continue ;; esac
  contract="$(frontmatter_scalar "$file" domain_contract)"
  status="$(frontmatter_scalar "$file" status)"
  relative="${file#$REPO_ROOT/}"
  supervision_state="$(frontmatter_scalar "$file" domain_supervision_state)"
  review_ref="$(frontmatter_scalar "$file" domain_supervision_ref)"
  decision_ref="$(frontmatter_scalar "$file" domain_decision_ref)"

  if [[ -z "$contract" && -n "$LEGACY_BASE_COMMIT" ]] &&
     git -C "$REPO_ROOT" cat-file -e "${LEGACY_BASE_COMMIT}:${relative}" 2>/dev/null; then
    legacy_doc_id="$(git -C "$REPO_ROOT" show "${LEGACY_BASE_COMMIT}:${relative}" | awk -F: '
      $1 == "doc_id" { sub(/^[[:space:]]+/, "", $2); sub(/[[:space:]]+$/, "", $2); print $2; exit }
    ')"
    if [[ -n "$legacy_doc_id" && "$legacy_doc_id" == "$(frontmatter_scalar "$file" doc_id)" ]]; then
      continue
    fi
  fi

  if [[ "$contract" == "legacy-v0" ]]; then
    continue
  fi
  if [[ "$contract" == "v1" ]]; then
    if is_enforced_status "$status" && [[ "$status" != "done" && "$status" != "closed" ]]; then
      error "$relative domain_contract v1 is transitional and cannot remain active/current; migrate it to v2 with AI Domain Expert supervision"
    fi
    continue
  fi
  [[ "$contract" == "v2" ]] || { error "$relative must declare domain_contract: v2 or an explicit historical contract"; continue; }
  if ! is_enforced_status "$status" && [[ -z "$review_ref" ]]; then
    continue
  fi

  case "$supervision_state" in aligned|decision-required|blocked-conflict) ;; *) error "$relative has unsupported domain_supervision_state: ${supervision_state:-missing}"; continue ;; esac
  [[ -n "$review_ref" ]] || { error "$relative requires domain_supervision_ref"; continue; }

  args=(--root "$REPO_ROOT" --subject "$relative" --review "$review_ref")
  [[ -n "$decision_ref" ]] && args+=(--decision "$decision_ref")
  [[ "$MODE" == "closeout" ]] && args+=(--closeout)
  if ! node "$AUTHORITY_VALIDATOR" "${args[@]}" >/dev/null; then
    error "$relative domain supervision review is invalid in $MODE mode"
    continue
  fi
  validated=$((validated + 1))
done

if [[ "$error_count" -gt 0 ]]; then
  echo "Domain supervision validation failed with $error_count error(s)." >&2
  exit 1
fi

echo "Validated domain supervision for $validated v2 document(s) in $MODE mode."
