#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DOCS_DIR}/.." && pwd)"

failures=0

error() {
  echo "ERROR: $*" >&2
  failures=$((failures + 1))
}

require_file() {
  [[ -f "$1" ]] || error "missing file: ${1#${REPO_ROOT}/}"
}

require_executable() {
  [[ -x "$1" ]] || error "missing executable bit: ${1#${REPO_ROOT}/}"
}

require_contains() {
  local file="$1"
  local value="$2"
  rg -F -q -- "$value" "$file" || error "missing '$value' in ${file#${REPO_ROOT}/}"
}

ADOPT="${DOCS_DIR}/ADOPT.md"
ADOPT_TEMPLATE="${DOCS_DIR}/_templates/adoption/adopt.md"
DESIGN="${DOCS_DIR}/architecture/harness-adoption-plane.md"
GUIDE="${DOCS_DIR}/guide/repository-policy-extraction.md"
HUMAN_VIEW_DESIGN="${DOCS_DIR}/architecture/human-control-view-plane.md"
HUMAN_VIEW_GUIDE="${DOCS_DIR}/guide/human-control-view.md"
PROFILE="${DOCS_DIR}/_templates/document-harness.yaml"
PLAN_TEMPLATE="${DOCS_DIR}/_templates/adoption/adoption-plan.json"
CONTROL_PLANE_TEMPLATE="${DOCS_DIR}/_templates/adoption/control-plane.md"
EXECUTION_CHECKPOINT_TEMPLATE="${DOCS_DIR}/_templates/execution-checkpoint.md"
EXECUTION_POLICY="${DOCS_DIR}/_indexes/execution-loop-policy.yaml"
CATALOG_TEMPLATE="${DOCS_DIR}/_templates/governance-catalog.json"
VIEW_TEMPLATE="${DOCS_DIR}/_templates/view-runtime.json"
RELEASE="${DOCS_DIR}/releases/document-harness-v1.json"
SCHEMA_DIR="${DOCS_DIR}/schemas"
ADOPT_LIB="${DOCS_DIR}/lib/harness-adopt.mjs"
ADOPT_CLI_LIB="${DOCS_DIR}/lib/harness-adopt-cli.mjs"
ADOPT_CLI="${DOCS_DIR}/bin/harness-adopt"
EXECUTION_VALIDATOR="${DOCS_DIR}/bin/validate-execution-loop.sh"
REFERENCE_VIEW="${REPO_ROOT}/runtime/document-harness-view"
CODEX_SKILL="${REPO_ROOT}/.agents/skills/operate-document-harness/SKILL.md"
CODEX_SKILL_METADATA="${REPO_ROOT}/.agents/skills/operate-document-harness/agents/openai.yaml"
CLAUDE_SKILL="${REPO_ROOT}/.claude/skills/operate-document-harness/SKILL.md"

for file in \
  "$ADOPT" "$ADOPT_TEMPLATE" "$DESIGN" "$GUIDE" "$HUMAN_VIEW_DESIGN" "$HUMAN_VIEW_GUIDE" \
  "$PROFILE" "$PLAN_TEMPLATE" "$CONTROL_PLANE_TEMPLATE" "$EXECUTION_CHECKPOINT_TEMPLATE" \
  "$EXECUTION_POLICY" "$CATALOG_TEMPLATE" "$VIEW_TEMPLATE" "$RELEASE" \
  "$ADOPT_LIB" "$ADOPT_CLI_LIB" "$ADOPT_CLI" "$EXECUTION_VALIDATOR" \
  "$REFERENCE_VIEW/README.md" "$REFERENCE_VIEW/bin/human-view" \
  "$REFERENCE_VIEW/control.mjs" "$REFERENCE_VIEW/lib/projection.mjs" \
  "$REFERENCE_VIEW/lib/process-identity.mjs" "$REFERENCE_VIEW/lib/runtime-state.mjs" \
  "$REFERENCE_VIEW/server.mjs" "$REFERENCE_VIEW/public/index.html" \
  "$REFERENCE_VIEW/public/app.mjs" "$REFERENCE_VIEW/public/styles.css" \
  "$REFERENCE_VIEW/test/runtime-state.test.mjs" \
  "$CODEX_SKILL" "$CODEX_SKILL_METADATA" "$CLAUDE_SKILL"; do
  require_file "$file"
done

for schema in \
  adoption-plan apply-receipt domain-authority-delegation-receipt domain-design-approval-receipt governance-catalog harness-installation-lock \
  human-policy-decision-receipt initiative-activation-receipt initiative-register migration-evidence-pack release-manifest \
  rollback-receipt verification-receipt; do
  require_file "$SCHEMA_DIR/${schema}.schema.json"
done

require_executable "$ADOPT_CLI"
require_executable "$EXECUTION_VALIDATOR"
require_executable "$REFERENCE_VIEW/bin/human-view"

for value in \
  "Select The Path" "Adoption Sequence" "Executable V1" "Status Contract" \
  "Non-Negotiable Rules" "Mature Repository Governance Bootstrap" "Project Skill Bootstrap" "Start Gate" \
  "requestedProfiles" "requiredProfiles" "requiredInstalledPaths"; do
  require_contains "$ADOPT" "$value"
done

for value in "Locale-Configured Human Projection" "Mature Repository Governance Bootstrap" "INIT-*" "presentation.locale" "presentation-only localization" "long ID"; do
  require_contains "$ADOPT_TEMPLATE" "$value"
done

for command in \
  "./docs/bin/harness-adopt plan" \
  "./docs/bin/harness-adopt apply" \
  "./docs/bin/harness-adopt verify" \
  "./docs/bin/harness-adopt rollback"; do
  require_contains "$ADOPT" "$command"
  require_contains "$CODEX_SKILL" "$command"
done

for status in \
  PLAN_READY NEEDS_DECISION APPLY_FAILED INSTALLED_NOT_VERIFIED \
  INSTALLED_AWAITING_REVIEW MIGRATION_VERIFIED ROLLED_BACK; do
  require_contains "$ADOPT" "$status"
  require_contains "$DESIGN" "$status"
  require_contains "$CODEX_SKILL" "$status"
done

for value in \
  "Ownership Model" "Plan And Apply Contract" "Verify And Rollback" \
  "Lifecycle Status Model" "Governance Extraction Handoff" \
  "Repo-Local View Instance Contract" "Continuous Quality Handoff"; do
  require_contains "$DESIGN" "$value"
done

for value in \
  "Source Priority" "Extraction Workflow" "Publish Candidate Projection" \
  "Validate Migration And Source Fences" "State Model" \
  "Human Review And Promotion" "Skill Packaging"; do
  require_contains "$GUIDE" "$value"
done

for value in \
  '"capturedRepository"' '"baseCommit"' '"capturedSha256"' \
  '"capturedRepositoryRevision"' '"approvalState": "unreviewed"' \
  '"effectiveRef": null' '"decisionReceiptRef": null' \
  "code/config source" "Secret-bearing source"; do
  require_contains "$GUIDE" "$value"
done

for value in \
  "Single-Repository Presentation Contract" "Interaction Stability Contract" \
  "Semantic Visual Contract" "Migration And Evidence Fence" \
  "versioned reference View distribution"; do
  require_contains "$HUMAN_VIEW_DESIGN" "$value"
done

for value in \
  "Seven-Tab Product Plan" "Reference View Operations" \
  "Interaction And Refresh Stability" "Semantic Design System"; do
  require_contains "$HUMAN_VIEW_GUIDE" "$value"
done

for value in "displayName" "locale" "tabLabels" "overview" "domain" "policies" "guidelines" "initiatives" "review" "execution" "evidence"; do
  require_contains "$HUMAN_VIEW_DESIGN" "$value"
  require_contains "$HUMAN_VIEW_GUIDE" "$value"
done

for value in "harness-managed" "project-owned" "generated" "runtime-local" "127.0.0.1:0" "foreign process"; do
  require_contains "$DESIGN" "$value"
done

for value in \
  "name: operate-document-harness" \
  "scope: repository" \
  "canonical_path: .agents/skills/operate-document-harness/SKILL.md" \
  "claude_adapter_path: .claude/skills/operate-document-harness/SKILL.md" \
  "global_install: false" \
  "bind_host: 127.0.0.1" \
  "port_mode: auto" \
  "profile: single-repository-top-tabs-v3" \
  "repository_identity: static" \
  "repository_selector: false" \
  "sidebar: false" \
  "cross_tab_snapshot_fence: single" \
  "external_assets: false" \
  "overwrite_project_owned: false"; do
  require_contains "$PROFILE" "$value"
done

for value in \
  "name: operate-document-harness" \
  "Treat this skill as a repository-local router" \
  "Do not install, update, or depend on a user-global document-harness skill" \
  "docs/ADOPT.md" "docs/EXECUTE.md" \
  "docs/guide/repository-policy-extraction.md" \
  "docs/guide/human-control-view.md"; do
  require_contains "$CODEX_SKILL" "$value"
done

for value in 'display_name: "Document Harness 운영"' 'default_prompt: "Use $operate-document-harness'; do
  require_contains "$CODEX_SKILL_METADATA" "$value"
done

for value in "name: operate-document-harness" "../../../.agents/skills/operate-document-harness/SKILL.md" "adds no authority"; do
  require_contains "$CLAUDE_SKILL" "$value"
done

for value in "user-global skill" "direct-read" "reload"; do
  require_contains "$DESIGN" "$value"
  require_contains "$GUIDE" "$value"
done

if command -v node >/dev/null 2>&1; then
  node --check "$ADOPT_LIB" || error "harness-adopt engine syntax is invalid"
  node --check "$ADOPT_CLI_LIB" || error "harness-adopt CLI syntax is invalid"
  node --check "$REFERENCE_VIEW/lib/projection.mjs" || error "reference View projector syntax is invalid"
  node --check "$REFERENCE_VIEW/lib/runtime-state.mjs" || error "reference View runtime-state syntax is invalid"
  node --check "$REFERENCE_VIEW/server.mjs" || error "reference View server syntax is invalid"

  node --input-type=module - \
    "$CATALOG_TEMPLATE" "$VIEW_TEMPLATE" "$RELEASE" "$SCHEMA_DIR" \
    "$ADOPT_LIB" "$REFERENCE_VIEW" <<'NODE' \
    || error "machine-readable adoption v1 contracts are inconsistent"
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [catalogFile, viewFile, releaseFile, schemaDir, adoptLib, referenceViewRoot] = process.argv.slice(2);
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const schema = (name) => readJson(path.join(schemaDir, `${name}.schema.json`));

const catalog = readJson(catalogFile);
assert.equal(catalog.schemaVersion, 1);
assert.deepEqual(Object.keys(catalog.migration.capturedRepository).sort(), ["baseCommit", "workingTreeState"]);
assert.equal(catalog.migration.status, "awaiting_human_review");
assert.ok(Array.isArray(catalog.gaps) && catalog.gaps.length > 0);
assert.ok(catalog.attention.some(({ id, severity }) => id === "ATTN-INITIATIVE-EXTRACTION" && severity === "decision"));
assert.ok(catalog.gaps.some(({ id }) => id === "GAP-INITIATIVE-EXTRACTION"));

const governance = schema("governance-catalog");
assert.ok(governance.properties.migration.required.includes("capturedRepository"));
assert.equal(
  governance.properties.migration.properties.capturedRepository.properties.baseCommit.pattern,
  "^[a-f0-9]{40}$",
);
for (const field of [
  "id", "kind", "title", "humanSummary", "authorityClass", "authorityState",
  "approvalState", "enforcement", "confidence", "effectiveRef",
  "decisionReceiptRef", "sourceRefs", "conflicts",
]) assert.ok(governance.$defs.candidate.required.includes(field), `candidate requires ${field}`);
for (const field of ["path", "heading", "lineStart", "lineEnd", "capturedSha256", "capturedRepositoryRevision"]) {
  assert.ok(governance.$defs.sourceRef.required.includes(field), `sourceRef requires ${field}`);
}
const observationGuard = governance.$defs.candidate.allOf.find((rule) =>
  rule.if?.properties?.authorityClass?.enum?.includes("code_observation"));
assert.ok(observationGuard);
assert.equal(observationGuard.then.properties.kind.const, "observation");
assert.equal(observationGuard.then.properties.approvalState.const, "unreviewed");
assert.equal(observationGuard.then.properties.effectiveRef.type, "null");
assert.equal(observationGuard.then.properties.decisionReceiptRef.type, "null");
const approvalGuard = governance.$defs.candidate.allOf.find((rule) =>
  rule.if?.properties?.approvalState?.const === "approved");
assert.ok(approvalGuard);
assert.equal(approvalGuard.then.properties.effectiveRef.type, "string");
assert.equal(approvalGuard.then.properties.decisionReceiptRef.type, "string");

const initiatives = schema("initiative-register");
for (const field of [
  "id", "kind", "title", "humanSummary", "outcome", "whyNow", "lifecycleState",
  "approvalState", "owner", "currentFocus", "policyRefs", "policyRelationships", "guidelineRefs", "guidelineRelationships",
  "guidelineDisposition", "guidelineDispositionReason", "legacyProjectRefs", "documentRef", "sourceRevision", "sourceRefs",
]) assert.ok(initiatives.$defs.initiative.required.includes(field), `initiative requires ${field}`);
assert.equal(initiatives.$defs.initiative.properties.id.pattern, "^(?:I[0-9]{4}|INIT-[A-Z0-9][A-Z0-9-]*)$");
assert.equal(initiatives.$defs.initiative.properties.policyRefs.minItems, 1);

const evidencePack = schema("migration-evidence-pack");
assert.ok(evidencePack.properties.gates.items.required.includes("evidenceSha256"));
assert.equal(evidencePack.properties.gates.items.properties.evidenceSha256.pattern, "^[a-f0-9]{64}$");
const humanDecision = schema("human-policy-decision-receipt");
assert.ok(humanDecision.required.includes("effectiveSha256"));
assert.equal(humanDecision.properties.effectiveSha256.pattern, "^[a-f0-9]{64}$");
const effectiveDecisionGuard = humanDecision.allOf.find((rule) =>
  rule.if?.properties?.decision?.enum?.includes("approved"));
assert.ok(effectiveDecisionGuard);
assert.equal(effectiveDecisionGuard.then.properties.effectiveSha256.type, "string");

const { ALLOWED_ACTIONS, ALLOWED_STATUSES } = await import(pathToFileURL(adoptLib));
const adoptSource = readFileSync(adoptLib, "utf8");
for (const contractMarker of [
  "GOVERNANCE_CATALOG_PATH", "INITIATIVE_REGISTER_PATH", "INITIATIVE_BOOTSTRAP_UNRESOLVED",
  "INVALID_INITIATIVE_MIGRATION_CANDIDATE", "OBSERVATION_PROMOTED_WITHOUT_POLICY_AUTHORITY",
  "PRIVATE_SOURCE_EXCLUDED", "STALE_OR_INVALID_SOURCE_REF",
  "CONFLICTING_CANDIDATE_AUTO_RESOLVED", "CATALOG-REVIEW", "evidenceSha256", "effectiveSha256",
]) assert.ok(adoptSource.includes(contractMarker), `adoption engine enforces ${contractMarker}`);
assert.deepEqual(ALLOWED_ACTIONS, [
  "ADD", "UPDATE_UNMODIFIED", "KEEP_PROJECT_OWNED", "CONFLICT",
  "GRANDFATHER", "DEFER", "REMOVE_GENERATED",
]);
assert.deepEqual(ALLOWED_STATUSES, [
  "PLAN_READY", "NEEDS_DECISION", "APPLY_FAILED", "INSTALLED_NOT_VERIFIED",
  "INSTALLED_AWAITING_REVIEW", "MIGRATION_VERIFIED", "ROLLED_BACK",
]);
const adoptionPlan = schema("adoption-plan");
assert.deepEqual(adoptionPlan.properties.status.enum, ["PLAN_READY", "NEEDS_DECISION"]);
assert.ok(adoptionPlan.required.includes("requestedProfiles"));
assert.deepEqual(schema("apply-receipt").properties.status.enum, [
  "APPLY_FAILED", "INSTALLED_NOT_VERIFIED", "INSTALLED_AWAITING_REVIEW",
]);
assert.deepEqual(schema("verification-receipt").properties.status.enum, [
  "INSTALLED_NOT_VERIFIED", "INSTALLED_AWAITING_REVIEW", "MIGRATION_VERIFIED",
]);
assert.equal(schema("rollback-receipt").properties.status.const, "ROLLED_BACK");

const view = readJson(viewFile);
assert.deepEqual(Object.keys(view).sort(), [
  "bindHost", "governanceCatalog", "initiativeRegister", "portMode", "presentation", "probes", "project", "qualityCommands", "schemaVersion",
]);
assert.equal(view.bindHost, "127.0.0.1");
assert.equal(view.portMode, "auto");
assert.equal(view.presentation.displayName, "Board");
assert.equal(view.presentation.locale, "en-US");
assert.deepEqual(Object.keys(view.qualityCommands).sort(), ["continuous", "fast", "full"]);
for (const fixedRuntimeKey of ["stateDir", "runtimeProbes", "executionCheckpoint", "projectRoot", "refreshIntervalMs", "reconcileIntervalMs", "consistency"]) {
  assert.equal(Object.hasOwn(view, fixedRuntimeKey), false, `${fixedRuntimeKey} belongs to the versioned runtime, not project config`);
}

const release = readJson(releaseFile);
assert.equal(release.releaseId, "document-harness-public-v1");
assert.equal(release.version, "1.8.0");
assert.deepEqual(release.profileDependencies, {
  core: [],
  governance: ["core"],
  view: ["core", "governance"],
});
assert.deepEqual(release.verification.requiredProfiles, ["core", "governance", "view"]);
assert.equal(release.verification.verifiedStatusRequiresAllGates, true);
assert.equal(release.verification.verifiedStatusRequiresHumanReview, true);
assert.deepEqual(release.verification.requiredGateIds, [
  "view-doctor", "view-test", "quality-fast", "quality-full", "quality-continuous",
]);
const targets = new Set(release.files.map(({ targetPath }) => targetPath));
for (const requiredPath of release.verification.requiredInstalledPaths) {
  assert.ok(targets.has(requiredPath), `required installed path is release-managed: ${requiredPath}`);
}
for (const target of [
  "docs/bin/harness-adopt", "docs/lib/harness-adopt.mjs", "docs/lib/harness-adopt-cli.mjs",
  "docs/bin/validate-execution-loop.sh", "docs/_indexes/execution-loop-policy.yaml",
  "docs/_templates/execution-checkpoint.md", "docs/architecture/control-plane.md",
  "docs/schemas/governance-catalog.schema.json", "runtime/document-harness-view/bin/human-view",
  "docs/schemas/initiative-register.schema.json", "docs/_indexes/initiative-register.json",
  "runtime/document-harness-view/lib/projection.mjs", "runtime/document-harness-view/lib/runtime-state.mjs",
  "runtime/document-harness-view/test/runtime-state.test.mjs", "runtime/document-harness-view/public/index.html",
  "runtime/document-harness-view/server.mjs", "runtime/document-harness-view/config.json",
]) assert.ok(targets.has(target), `release manages ${target}`);

function walk(root, current = "", result = []) {
  for (const entry of readdirSync(path.join(root, current), { withFileTypes: true })) {
    const relative = current ? `${current}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(root, relative, result);
    else result.push(relative);
  }
  return result;
}
for (const relative of walk(referenceViewRoot)) {
  assert.ok(targets.has(`runtime/document-harness-view/${relative}`), `release pins reference View ${relative}`);
}
NODE

  "$ADOPT_CLI" help >/dev/null || error "harness-adopt help failed"
else
  error "node is required to validate adoption schemas, engine, and reference View"
fi

if [[ "$failures" -ne 0 ]]; then
  echo "Harness adoption validation failed: ${failures} error(s)." >&2
  exit 1
fi

echo "Harness adoption validation passed."
