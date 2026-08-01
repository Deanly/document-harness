#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/.." && pwd)"

require_file() {
  local path="$1"

  if [[ ! -f "$path" ]]; then
    echo "error: missing required file: $path" >&2
    return 1
  fi
}

require_section() {
  local path="$1"
  local header="$2"

  if ! grep -Fq "$header" "$path"; then
    echo "error: missing section '$header' in $path" >&2
    return 1
  fi
}

require_contains() {
  local path="$1"
  local pattern="$2"

  if ! grep -Fq -- "$pattern" "$path"; then
    echo "error: missing expected text '$pattern' in $path" >&2
    return 1
  fi
}

DOCS_README="$ROOT_DIR/README.md"
EXECUTION_ENTRY="$ROOT_DIR/EXECUTE.md"
CONTROL_PLANE="$ROOT_DIR/architecture/control-plane.md"
QUALITY_AXES="$ROOT_DIR/guide/quality-axes.md"
ARTIFACT_CONTRACTS="$ROOT_DIR/guide/artifact-contracts.md"
HARNESS_LANGUAGE="$ROOT_DIR/architecture/harness-language.md"
RETRIEVAL_PLANE="$ROOT_DIR/architecture/retrieval-plane.md"
POLICY_GOVERNANCE="$ROOT_DIR/governance/policy-to-evidence.md"
INITIATIVE_GOVERNANCE="$ROOT_DIR/governance/initiative-governance.md"
EXECUTION_LOOP="$ROOT_DIR/architecture/execution-loop-plane.md"
HUMAN_VIEW_DESIGN="$ROOT_DIR/architecture/human-control-view-plane.md"
DOMAIN_LANDSCAPE="$ROOT_DIR/design/domain-landscape.md"
DOMAIN_CONTEXT_MAP="$ROOT_DIR/design/context-map.md"
DOMAIN_DESIGN_GUIDE="$ROOT_DIR/guide/ddd-domain-design.md"
LLM_WIKI_OPERATIONS="$ROOT_DIR/guide/llm-wiki-operations.md"
HYBRID_RETRIEVAL="$ROOT_DIR/guide/hybrid-retrieval-and-freshness.md"
POLICY_GUIDE="$ROOT_DIR/guide/policy-proposal-and-approval.md"
INITIATIVE_GUIDE="$ROOT_DIR/guide/initiative-governance.md"
EXECUTION_GUIDE="$ROOT_DIR/guide/execution-loop-operations.md"
HUMAN_VIEW="$ROOT_DIR/guide/human-control-view.md"
CODEX_AGENT_GUIDANCE="$ROOT_DIR/guide/codex-agent-guidance.md"
PROJECT_CUTTING="$ROOT_DIR/guide/project-cutting-and-execution.md"
DOCUMENT_LIFECYCLE="$ROOT_DIR/guide/document-lifecycle-and-active-reading.md"
AGENTS_FILE="$REPO_ROOT/AGENTS.md"
AGENTS_TEMPLATE="$ROOT_DIR/_templates/agents.md"
NEW_DOC_SCRIPT="$ROOT_DIR/bin/new-doc.sh"
ISSUE_DOC_BRIDGE="$ROOT_DIR/bin/issue-doc-bridge.sh"
DOCUMENT_BRIDGE_VALIDATOR="$ROOT_DIR/bin/validate-document-bridge.sh"
CODEX_READINESS="$ROOT_DIR/bin/validate-codex-readiness.sh"
DOC_RETRIEVAL="$ROOT_DIR/bin/validate-doc-retrieval.sh"
RETRIEVAL_POLICY="$ROOT_DIR/_indexes/retrieval-policy.yaml"
EXECUTION_POLICY="$ROOT_DIR/_indexes/execution-loop-policy.yaml"
EXECUTION_CHECKPOINT_TEMPLATE="$ROOT_DIR/_templates/execution-checkpoint.md"
EXECUTION_VALIDATOR="$ROOT_DIR/bin/validate-execution-loop.sh"
DOMAIN_DESIGN_VALIDATOR="$ROOT_DIR/bin/validate-domain-design.sh"
DOMAIN_LINEAGE_VALIDATOR="$ROOT_DIR/bin/validate-domain-lineage.sh"
DOMAIN_SUPERVISION_VALIDATOR="$ROOT_DIR/bin/validate-domain-supervision.sh"
TASK_TEMPLATE="$ROOT_DIR/_templates/task.md"
PROJECT_TEMPLATE="$ROOT_DIR/_templates/project.md"
INITIATIVE_TEMPLATE="$ROOT_DIR/_templates/initiative.md"
INITIATIVE_README="$ROOT_DIR/initiatives/README.md"
REPORT_TEMPLATE="$ROOT_DIR/_templates/report.md"
QA_TEMPLATE="$ROOT_DIR/_templates/qa.md"

require_file "$DOCS_README"
require_file "$EXECUTION_ENTRY"
require_file "$AGENTS_FILE"
require_file "$AGENTS_TEMPLATE"
require_file "$ISSUE_DOC_BRIDGE"
require_file "$DOCUMENT_BRIDGE_VALIDATOR"
require_file "$DOMAIN_SUPERVISION_VALIDATOR"
require_file "$CONTROL_PLANE"
require_file "$QUALITY_AXES"
require_file "$ARTIFACT_CONTRACTS"
require_file "$HARNESS_LANGUAGE"
require_file "$RETRIEVAL_PLANE"
require_file "$POLICY_GOVERNANCE"
require_file "$INITIATIVE_GOVERNANCE"
require_file "$EXECUTION_LOOP"
require_file "$HUMAN_VIEW_DESIGN"
require_file "$DOMAIN_LANDSCAPE"
require_file "$DOMAIN_CONTEXT_MAP"
require_file "$DOMAIN_DESIGN_GUIDE"
require_file "$LLM_WIKI_OPERATIONS"
require_file "$HYBRID_RETRIEVAL"
require_file "$POLICY_GUIDE"
require_file "$INITIATIVE_GUIDE"
require_file "$EXECUTION_GUIDE"
require_file "$HUMAN_VIEW"
require_file "$CODEX_AGENT_GUIDANCE"
require_file "$PROJECT_CUTTING"
require_file "$DOCUMENT_LIFECYCLE"
require_file "$NEW_DOC_SCRIPT"
require_file "$CODEX_READINESS"
require_file "$DOC_RETRIEVAL"
require_file "$RETRIEVAL_POLICY"
require_file "$EXECUTION_POLICY"
require_file "$EXECUTION_CHECKPOINT_TEMPLATE"
require_file "$EXECUTION_VALIDATOR"
require_file "$DOMAIN_DESIGN_VALIDATOR"
require_file "$DOMAIN_LINEAGE_VALIDATOR"
require_file "$TASK_TEMPLATE"
require_file "$PROJECT_TEMPLATE"
require_file "$INITIATIVE_TEMPLATE"
require_file "$INITIATIVE_README"
require_file "$REPORT_TEMPLATE"
require_file "$QA_TEMPLATE"

for header in \
  "## Purpose" \
  "## Authority Boundary" \
  "## Design Surface Contract" \
  "## Authoring Workflow" \
  "## Stable Model IDs" \
  "## Role Loading Contract" \
  "## Change And Freshness Contract" \
  "## Validation" \
  "## Migration"
do
  require_section "$DOMAIN_DESIGN_GUIDE" "$header"
done

for header in \
  "## Domain Vision And Customer Outcomes" \
  "## Domain Experts And Sources" \
  "## Subdomain Portfolio" \
  "## Core Domain Differentiation" \
  "## Cross-Context Business Flows" \
  "## Role Consumer Contract" \
  "## Unknowns And Disputes"
do
  require_section "$DOMAIN_LANDSCAPE" "$header"
done

for header in \
  "## Bounded Context Registry" \
  "## Context Relationships" \
  "## Cross-Context Flows" \
  "## Translation And Ambiguity Rules" \
  "## Role Consumer Contract" \
  "## Unknowns And Disputes"
do
  require_section "$DOMAIN_CONTEXT_MAP" "$header"
done

for header in \
  '## Purpose' '## Load Order' '## Start Gate' '## Execute Loop' \
  '## State Routing' '## Evidence Barrier' '## Stop And Ask' \
  '## Closeout' '## Verification' '## Human Handoff'
do
  require_section "$EXECUTION_ENTRY" "$header"
done

for header in \
  "## Purpose" \
  "## Authority Boundary" \
  "## Canonical Hierarchy" \
  "## Relationship Contract" \
  "## Artifact Contract" \
  "## Issuance And Approval Contract" \
  "## Lifecycle Contract" \
  "## Human View Projection Contract" \
  "## Legacy Umbrella Project Bridge" \
  "## Invariants" \
  "## Failure Boundaries" \
  "## Change Log"
do
  require_section "$INITIATIVE_GOVERNANCE" "$header"
done

for header in \
  "## Purpose" \
  "## Operating Principle" \
  "## Before Drafting" \
  "## Candidate Workflow" \
  "## Human Issuance Gate" \
  "## Relationship Authoring" \
  "## Activation Review" \
  "## Project And Task Issuance" \
  "## Human View Presentation" \
  "## Legacy Migration" \
  "## Change Log"
do
  require_section "$INITIATIVE_GUIDE" "$header"
done

for header in \
  "## Repository Map" \
  "## Codex Workflow" \
  "## Documentation Rules" \
  "## Verification Commands" \
  "## Done Criteria"
do
  require_section "$AGENTS_FILE" "$header"
done

for header in \
  "## Context" \
  "## Authority Boundary" \
  "## Governance Roles" \
  "## Proposal And Promotion Contract" \
  "## Policy To Evidence Traceability" \
  "## Approval Contract" \
  "## Exception Contract" \
  "## View Projection Contract" \
  "## Invariants" \
  "## Failure Boundaries" \
  "## References" \
  "## Change Log"
do
  require_section "$POLICY_GOVERNANCE" "$header"
done

for header in \
  "## Purpose" \
  "## Operating Principle" \
  "## Policy Intake" \
  "## Proposal Workflow" \
  "## Human Review And Approval" \
  "## Promotion Workflow" \
  "## Task And QA Traceability" \
  "## Exception Workflow" \
  "## Human View Presentation" \
  "## Change Log"
do
  require_section "$POLICY_GUIDE" "$header"
done

for header in \
  "## Purpose" \
  "## Whole-System Outcome" \
  "## Control Surfaces" \
  "## Active Design Surfaces" \
  "## Initiative Portfolio Policy" \
  "## Active Initiatives" \
  "## Active Delivery Projects" \
  "## Legacy Umbrella Project Bridge" \
  "## Active Execution Surfaces" \
  "## Standard Pipeline" \
  "## Quality Axes" \
  "## Required Validators" \
  "## Handoff Rules" \
  "## Change Log"
do
  require_section "$CONTROL_PLANE" "$header"
done

for header in \
  "## Purpose" \
  "## How To Use" \
  "## Axes" \
  "## Minimum Review Set" \
  "## Change Log"
do
  require_section "$QUALITY_AXES" "$header"
done

for header in \
  "## Purpose" \
  "## Control Surfaces" \
  "## Artifact Contracts By Type" \
  "## Handoff Matrix" \
  "## Change Log"
do
  require_section "$ARTIFACT_CONTRACTS" "$header"
done

for header in \
  "## Purpose" \
  "## Fit To This Harness" \
  "## Source Layer" \
  "## Ingest Workflow" \
  "## Query Workflow" \
  "## Scalable Retrieval Loop" \
  "## Lint Workflow" \
  "## Index And Log Mapping" \
  "## Properties Contract" \
  "## Change Log"
do
  require_section "$LLM_WIKI_OPERATIONS" "$header"
done

for header in \
  "## Purpose" \
  "## Whole-System Role" \
  "## Authority Boundary" \
  "## Invariants" \
  "## Scale Activation" \
  "## Retrieval Components" \
  "## Interfaces" \
  "## Revision And Identity" \
  "## Incremental Projection" \
  "## Publish And Concurrency Contract" \
  "## Query Contract" \
  "## Freshness Contract" \
  "## Failure Recovery" \
  "## Failure Boundaries" \
  "## Evaluation Contract" \
  "## Quality Axes" \
  "## Decisions" \
  "## Artifact Contracts" \
  "## Open Questions" \
  "## References" \
  "## Change Log"
do
  require_section "$RETRIEVAL_PLANE" "$header"
done

for header in \
  "## Purpose" \
  "## Operating Principle" \
  "## Profile Selection" \
  "## Ingest Loop" \
  "## Query Loop" \
  "## Same-Session Freshness" \
  "## Delete And Rename" \
  "## Evaluation And Operations" \
  "## Failure Response" \
  "## References" \
  "## Change Log"
do
  require_section "$HYBRID_RETRIEVAL" "$header"
done

for header in \
  "## Purpose" \
  "## Codex Loading Model" \
  "## Harness Mapping" \
  "## Prompt Shape" \
  "## AGENTS.md Contract" \
  "## Numbered Document Issuance Rule" \
  "## Verification Contract" \
  "## Parallel Work Rule" \
  "## Change Log"
do
  require_section "$CODEX_AGENT_GUIDANCE" "$header"
done

require_section "$PROJECT_CUTTING" "## Baseline-Separated Numbered Document Rule"
require_section "$DOCUMENT_LIFECYCLE" "## Lifecycle Rules"
require_contains "$DOCS_README" '`initiative`, `task`, `project`, `qa` 번호와 문서 권위는 최신 `origin/main` 문서 집합을 기준으로 직렬 발급합니다.'
require_contains "$AGENTS_FILE" 'Use `docs/bin/issue-doc-bridge.sh` with an immutable code baseline'
require_contains "$AGENTS_TEMPLATE" 'Use `docs/bin/issue-doc-bridge.sh` with an immutable code baseline'
require_contains "$AGENTS_FILE" 'Issue Project only under an active/approved Initiative'
require_contains "$AGENTS_TEMPLATE" 'Issue Project only under an active/approved Initiative'
require_contains "$RETRIEVAL_POLICY" 'source_of_truth: filesystem'
require_contains "$RETRIEVAL_POLICY" 'profile_after_activation: hybrid'
require_contains "$RETRIEVAL_POLICY" 'exact: keyword_or_direct_source'
require_contains "$RETRIEVAL_POLICY" 'indexed_only_search: false'
require_contains "$AGENTS_FILE" 'AI may draft policy/standard/exception proposals but must not self-approve them.'
require_contains "$AGENTS_TEMPLATE" 'AI may draft policy/standard/exception proposals but must not self-approve them.'
require_contains "$TASK_TEMPLATE" 'execution_contract: v1'
require_contains "$TASK_TEMPLATE" 'loop_state: ready'
require_contains "$TASK_TEMPLATE" '## Execution Readiness'
require_contains "$TASK_TEMPLATE" '## Execution Loop'
require_contains "$TASK_TEMPLATE" 'lineage_contract: v2'
require_contains "$TASK_TEMPLATE" 'related_project: {{RELATED_PROJECT}}'
require_contains "$PROJECT_TEMPLATE" 'related_initiative: {{RELATED_INITIATIVE}}'
require_contains "$PROJECT_TEMPLATE" 'initiative_relation: {{INITIATIVE_RELATION}}'
require_contains "$INITIATIVE_TEMPLATE" 'issuance_approval_ref: {{ISSUANCE_APPROVAL_REF}}'
require_contains "$INITIATIVE_TEMPLATE" '## Policy Alignment'
require_contains "$INITIATIVE_TEMPLATE" '## Guideline Disposition'
require_contains "$INITIATIVE_TEMPLATE" '## Success Signals'
require_contains "$REPORT_TEMPLATE" 'proposal_status:'
require_contains "$QA_TEMPLATE" '| Rule ID | Scenario ID |'
require_contains "$PROJECT_TEMPLATE" 'domain_contract: v2'
require_contains "$TASK_TEMPLATE" 'domain_contract: v2'
require_contains "$QA_TEMPLATE" 'domain_contract: v2'
require_contains "$TASK_TEMPLATE" 'domain_supervision_state: pending'
require_contains "$DOMAIN_DESIGN_GUIDE" '### Supervisory Authority'
require_contains "$DOMAIN_DESIGN_GUIDE" '### Persistent Supervision Contract'
require_contains "$ROOT_DIR/_templates/design.md" 'domain_expert_agent: ai-domain-expert'
require_contains "$ROOT_DIR/_templates/design.md" 'board_review_level:'
require_contains "$ROOT_DIR/_templates/design.md" '## AI Domain Expert Board Review'
require_contains "$DOMAIN_DESIGN_GUIDE" '## AI Domain Expert Contract'
require_contains "$DOMAIN_DESIGN_GUIDE" '## Board Review Contract'
require_contains "$NEW_DOC_SCRIPT" "require_numbered_doc_issue_context"
require_contains "$NEW_DOC_SCRIPT" "validate_issuance_approval_ref"
require_contains "$NEW_DOC_SCRIPT" "require_active_approved_initiative"
require_contains "$NEW_DOC_SCRIPT" "require_task_parent_lineage"
require_contains "$ISSUE_DOC_BRIDGE" '--baseline-ref'
require_contains "$ISSUE_DOC_BRIDGE" 'HARNESS_DOCUMENT_BRIDGE_MODE=1'
require_contains "$DOCUMENT_BRIDGE_VALIDATOR" 'bridge changes product path'
require_contains "$TASK_TEMPLATE" 'code_baseline_ref: {{CODE_BASELINE_REF}}'
require_contains "$EXECUTION_CHECKPOINT_TEMPLATE" 'document_bridge_ref:'
require_contains "$NEW_DOC_SCRIPT" 'initiative)'
require_contains "$NEW_DOC_SCRIPT" 'initiative issuance requires an exact human approval ref'
require_contains "$DOCS_README" './docs/bin/new-doc.sh project <slug> <initiative-id> [delivers|supports|explores]'
require_contains "$DOCS_README" './docs/bin/new-doc.sh task <slug> <project-id>'

"$DOC_RETRIEVAL"
"$DOMAIN_DESIGN_VALIDATOR" --all
"$DOMAIN_LINEAGE_VALIDATOR" --all
"$DOMAIN_SUPERVISION_VALIDATOR" --all
"$EXECUTION_VALIDATOR" --all

echo "Validated harness foundation."
