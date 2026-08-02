#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ISSUER_REF="origin/main"
BASELINE_INPUT=""
DELIVERY_BRANCH=""
WORKSTREAM_KIND=""
BRIDGE_WORKTREE=""
CONTROL_PATHS=(AGENTS.md CLAUDE.md .agents .claude docs)

usage() {
  cat <<'EOF'
Usage:
  ./docs/bin/issue-doc-bridge.sh \
    --baseline-ref <immutable-commit-or-tag> \
    --delivery-branch <branch> \
    --workstream-kind <feature|hotfix> \
    [--issuance-ref origin/main] -- \
    <initiative|project|task|qa> <new-doc arguments...>

The command must run from a clean issuer worktree whose current main equals the
issuance ref. It creates two docs-only commits based on the immutable code
baseline:

  D: document control plane plus the newly issued draft
  R: receipt finalization that records D's immutable SHA

Both commits must then be merged without cherry-picking into main and the
delivery branch. A number is confirmed only after the same R commit is visible
from remote main and the remote delivery branch.
EOF
}

cleanup() {
  if [[ -n "$BRIDGE_WORKTREE" && -d "$BRIDGE_WORKTREE" ]]; then
    git -C "$REPO_ROOT" worktree remove --force "$BRIDGE_WORKTREE" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

is_safe_branch_name() {
  local value="$1"
  [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] &&
    [[ "$value" != *..* ]] &&
    [[ "$value" != */. ]] &&
    [[ "$value" != *'@{'* ]]
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline-ref)
      BASELINE_INPUT="${2:-}"
      shift 2
      ;;
    --delivery-branch)
      DELIVERY_BRANCH="${2:-}"
      shift 2
      ;;
    --workstream-kind)
      WORKSTREAM_KIND="${2:-}"
      shift 2
      ;;
    --issuance-ref)
      ISSUER_REF="${2:-}"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$BASELINE_INPUT" || -z "$DELIVERY_BRANCH" || -z "$WORKSTREAM_KIND" || $# -lt 2 ]]; then
  usage >&2
  exit 1
fi
if [[ "$WORKSTREAM_KIND" != "feature" && "$WORKSTREAM_KIND" != "hotfix" ]]; then
  echo "error: workstream kind must be feature or hotfix" >&2
  exit 1
fi
if ! is_safe_branch_name "$DELIVERY_BRANCH"; then
  echo "error: unsafe delivery branch name: $DELIVERY_BRANCH" >&2
  exit 1
fi

CURRENT_BRANCH="$(git -C "$REPO_ROOT" symbolic-ref --quiet --short HEAD || true)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "error: bridge issuance must run from the dedicated main issuer worktree" >&2
  exit 1
fi
if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  echo "error: issuer main worktree must be clean" >&2
  exit 1
fi

BASELINE_REF="$(git -C "$REPO_ROOT" rev-parse --verify "${BASELINE_INPUT}^{commit}")"
DOCUMENT_ISSUANCE_REF="$(git -C "$REPO_ROOT" rev-parse --verify "${ISSUER_REF}^{commit}")"
CURRENT_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
if [[ "$CURRENT_HEAD" != "$DOCUMENT_ISSUANCE_REF" ]]; then
  echo "error: issuer main must exactly equal $ISSUER_REF before number allocation" >&2
  echo "current: $CURRENT_HEAD" >&2
  echo "issuer:  $DOCUMENT_ISSUANCE_REF" >&2
  exit 1
fi

BRIDGE_WORKTREE="$(mktemp -d "${TMPDIR:-/tmp}/document-issuance-bridge.XXXXXX")"
rmdir "$BRIDGE_WORKTREE"
git -C "$REPO_ROOT" worktree add --detach "$BRIDGE_WORKTREE" "$BASELINE_REF" >/dev/null
BRIDGE_WORKTREE="$(cd "$BRIDGE_WORKTREE" && pwd -P)"
if git -C "$REPO_ROOT" cat-file -e "${DOCUMENT_ISSUANCE_REF}:runtime/document-harness-view" 2>/dev/null; then
  CONTROL_PATHS+=(runtime/document-harness-view)
fi
if git -C "$REPO_ROOT" cat-file -e "${DOCUMENT_ISSUANCE_REF}:document-harness.yaml" 2>/dev/null; then
  CONTROL_PATHS+=(document-harness.yaml)
fi

# Replace only the document control plane. Product code remains byte-identical
# to the selected baseline, including when main contains unreleased features.
git -C "$BRIDGE_WORKTREE" rm -r --ignore-unmatch -- "${CONTROL_PATHS[@]}" >/dev/null
git -C "$BRIDGE_WORKTREE" checkout "$DOCUMENT_ISSUANCE_REF" -- "${CONTROL_PATHS[@]}"

DOC_ABS="$({
  HARNESS_DOCUMENT_BRIDGE_MODE=1 \
  HARNESS_WORKSTREAM_KIND="$WORKSTREAM_KIND" \
  HARNESS_CODE_BASELINE_REF="$BASELINE_REF" \
  HARNESS_DOCUMENT_ISSUANCE_REF="$DOCUMENT_ISSUANCE_REF" \
  HARNESS_DOCUMENT_BRIDGE_REF=pending \
  HARNESS_DOCUMENT_ISSUANCE_RECEIPT=pending \
  HARNESS_DELIVERY_BRANCH="$DELIVERY_BRANCH" \
    "$BRIDGE_WORKTREE/docs/bin/new-doc.sh" "$@"
} )"
DOC_PATH="${DOC_ABS#$BRIDGE_WORKTREE/}"
if [[ "$DOC_PATH" == "$DOC_ABS" || "$DOC_PATH" != docs/* || ! -f "$BRIDGE_WORKTREE/$DOC_PATH" ]]; then
  echo "error: bridge renderer returned an invalid document path: $DOC_ABS" >&2
  exit 1
fi

git -C "$BRIDGE_WORKTREE" add -- "${CONTROL_PATHS[@]}"
while IFS= read -r changed_path; do
  case "$changed_path" in
    AGENTS.md|CLAUDE.md|document-harness.yaml|.agents/*|.claude/*|docs/*|runtime/document-harness-view/*) ;;
    *)
      echo "error: bridge would change product path: $changed_path" >&2
      exit 1
      ;;
  esac
done < <(git -C "$BRIDGE_WORKTREE" diff --cached --name-only "$BASELINE_REF")

DOC_ID="$(basename "$DOC_PATH" | sed -E 's/^((I|P|T|QA)[0-9]{4})-.*/\1/')"
if [[ ! "$DOC_ID" =~ ^(I|P|T|QA)[0-9]{4}$ ]]; then
  echo "error: unable to derive numbered document ID from $DOC_PATH" >&2
  exit 1
fi

git -C "$BRIDGE_WORKTREE" commit -m "docs: bridge issuance ${DOC_ID}" >/dev/null
DOCUMENT_BRIDGE_REF="$(git -C "$BRIDGE_WORKTREE" rev-parse HEAD)"
RECEIPT_PATH="docs/receipts/document-issuance/${DOC_ID}-${DOCUMENT_BRIDGE_REF:0:12}.json"
mkdir -p "$BRIDGE_WORKTREE/$(dirname "$RECEIPT_PATH")"

DOCUMENT_BRIDGE_VALUE="$DOCUMENT_BRIDGE_REF" \
DOCUMENT_RECEIPT_VALUE="$RECEIPT_PATH" \
  perl -0pi -e '
    s/^document_bridge_ref: pending$/document_bridge_ref: $ENV{DOCUMENT_BRIDGE_VALUE}/m;
    s/^document_issuance_receipt: pending$/document_issuance_receipt: $ENV{DOCUMENT_RECEIPT_VALUE}/m;
    s/^- Document Bridge Ref: pending$/- Document Bridge Ref: $ENV{DOCUMENT_BRIDGE_VALUE}/m;
    s/^- Document Issuance Receipt: pending$/- Document Issuance Receipt: $ENV{DOCUMENT_RECEIPT_VALUE}/m;
  ' "$BRIDGE_WORKTREE/$DOC_PATH"

RECORDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "$BRIDGE_WORKTREE/$RECEIPT_PATH" <<EOF
{
  "schemaVersion": 1,
  "receiptKind": "numbered-issuance",
  "receiptId": "DIR-${DOC_ID}-${DOCUMENT_BRIDGE_REF:0:12}",
  "documentId": "$DOC_ID",
  "documentPath": "$DOC_PATH",
  "workstreamKind": "$WORKSTREAM_KIND",
  "codeBaselineRef": "$BASELINE_REF",
  "documentIssuanceRef": "$DOCUMENT_ISSUANCE_REF",
  "documentBridgeRef": "$DOCUMENT_BRIDGE_REF",
  "deliveryBranch": "$DELIVERY_BRANCH",
  "recordedAt": "$RECORDED_AT"
}
EOF

git -C "$BRIDGE_WORKTREE" add -- "$DOC_PATH" "$RECEIPT_PATH"
git -C "$BRIDGE_WORKTREE" commit -m "docs: finalize ${DOC_ID} issuance receipt" >/dev/null
FINALIZATION_REF="$(git -C "$BRIDGE_WORKTREE" rev-parse HEAD)"
DOC_ID_LOWER="$(printf '%s' "$DOC_ID" | tr '[:upper:]' '[:lower:]')"
BRIDGE_BRANCH="docs-bridge/${DOC_ID_LOWER}-${DOCUMENT_BRIDGE_REF:0:12}"
git -C "$REPO_ROOT" branch "$BRIDGE_BRANCH" "$FINALIZATION_REF"

cat <<EOF
document_id=$DOC_ID
document_path=$DOC_PATH
workstream_kind=$WORKSTREAM_KIND
code_baseline_ref=$BASELINE_REF
document_issuance_ref=$DOCUMENT_ISSUANCE_REF
document_bridge_ref=$DOCUMENT_BRIDGE_REF
document_issuance_receipt=$RECEIPT_PATH
document_finalization_ref=$FINALIZATION_REF
bridge_branch=$BRIDGE_BRANCH
delivery_branch=$DELIVERY_BRANCH

The number remains unconfirmed until $FINALIZATION_REF is an ancestor of both
origin/main and origin/$DELIVERY_BRANCH. Merge the bridge branch into each
branch without cherry-picking, push both, then run:

  ./docs/bin/validate-document-bridge.sh --remote $RECEIPT_PATH
EOF
