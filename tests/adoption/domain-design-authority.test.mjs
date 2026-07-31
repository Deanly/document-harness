import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateDomainDesignAuthority } from "../../docs/lib/domain-design-authority.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function write(root, relativePath, value) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, value, "utf8");
}

test("delegated AI domain authority is routine, human-fenced, and exact-byte stale", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "domain-authority-ai-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const modelRef = "docs/design/contexts/catalog/domain-model.md";
  const receiptRef = "docs/design/receipts/catalog-ai-r1.json";
  const delegationRef = "docs/governance/receipts/domain-delegation.json";
  const model = `---
type: design
design_kind: bounded-context
status: current
bounded_context: catalog
bounded_context_id: BC-CATALOG
model_revision: 1
validation_status: ai-validated
validation_ref: ${receiptRef}
domain_expert_agent: ai-domain-expert
authority_mode: delegated-ai
decision_tier: routine
board_review_level: ubiquitous-language
board_review_status: not_required
---

# Catalog
`;
  const delegation = JSON.stringify({
    schemaVersion: 1,
    kind: "domain-authority-delegation",
    receiptId: "DDD-DELEGATION-CATALOG",
    decision: "approved",
    allowedDecisionTier: "routine",
    allowedChangeClasses: ["terminology-clarification"],
    forbiddenChangeClasses: ["customer-rights"],
    decidedBy: { actorKind: "human", identifier: "catalog-owner" },
    decidedAt: "2026-07-31T00:00:00.000Z",
    reason: "Delegate reversible terminology clarification."
  });
  await write(root, modelRef, model);
  await write(root, delegationRef, delegation);
  await write(root, receiptRef, JSON.stringify({
    schemaVersion: 2,
    kind: "domain-design-approval",
    receiptId: "DDD-AI-AUTHORITY-CATALOG-1",
    decision: "approved",
    documentRef: modelRef,
    documentSha256: sha256(model),
    modelRevision: 1,
    boundedContext: "catalog",
    authorityMode: "delegated-ai",
    decisionTier: "routine",
    modelingLevel: "ubiquitous-language",
    decidedBy: { actorKind: "ai-agent", identifier: "ai-domain-expert" },
    decidedAt: "2026-07-31T00:01:00.000Z",
    reason: "Clarified existing language without changing behavior.",
    evidenceRefs: [modelRef],
    challengeSummary: "No rule, boundary, lifecycle, or customer-right change was found.",
    delegatedAuthorityRef: delegationRef,
    delegationSha256: sha256(delegation)
  }));

  const result = await validateDomainDesignAuthority({ root, documentPath: modelRef });
  assert.equal(result.authorityMode, "delegated-ai");
  assert.equal(result.decidedBy, "ai-domain-expert");

  await write(root, delegationRef, `${delegation}\n`);
  await assert.rejects(
    validateDomainDesignAuthority({ root, documentPath: modelRef }),
    /delegation bytes/
  );
});

test("material domain meaning requires a human-confirmed v2 receipt", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "domain-authority-human-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const modelRef = "docs/design/contexts/payment/domain-model.md";
  const receiptRef = "docs/design/receipts/payment-human-r1.json";
  const model = `---
type: design
design_kind: bounded-context
status: current
bounded_context: payment
bounded_context_id: BC-PAYMENT
model_revision: 1
validation_status: approved
validation_ref: ${receiptRef}
domain_expert_agent: ai-domain-expert
authority_mode: human-confirmed
decision_tier: material
board_review_level: business-rule
board_review_status: confirmed
---

# Payment
`;
  await write(root, modelRef, model);
  await write(root, receiptRef, JSON.stringify({
    schemaVersion: 2,
    kind: "domain-design-approval",
    receiptId: "DDD-HUMAN-PAYMENT-1",
    decision: "approved",
    documentRef: modelRef,
    documentSha256: sha256(model),
    modelRevision: 1,
    boundedContext: "payment",
    authorityMode: "human-confirmed",
    decisionTier: "material",
    modelingLevel: "business-rule",
    decidedBy: { actorKind: "human", identifier: "payment-owner" },
    decidedAt: "2026-07-31T00:00:00.000Z",
    reason: "Confirmed the customer-visible payment rule.",
    evidenceRefs: [modelRef],
    challengeSummary: "The rejection and customer outcome were reviewed."
  }));

  const result = await validateDomainDesignAuthority({ root, documentPath: modelRef });
  assert.equal(result.authorityMode, "human-confirmed");
  assert.equal(result.decidedBy, "payment-owner");
});
