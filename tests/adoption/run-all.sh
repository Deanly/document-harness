#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '{"schemaVersion":1,"status":"INSTALLED_NOT_VERIFIED","gate":"document-harness-public-release-acceptance","failedGates":["node-runtime"],"exitCode":1}'
  exit 1
fi

exec node "${SCRIPT_DIR}/run-all.mjs"
