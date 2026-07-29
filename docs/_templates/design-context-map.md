---
type: design
design_kind: context-map
title: {{TITLE}}
status: draft
domain:
bounded_context: all
bounded_context_id: CONTEXT-MAP
subdomain_type: portfolio
model_revision: 1
validation_status: unreviewed
validation_ref:
domain_expert_roles: []
role_views:
  - customer
  - planner
  - architect
  - developer
  - qa
owner:
created: {{DATE}}
updated: {{DATE}}
retrieval_class:
  - context-map
context:
  default_load: true
  section_load: false
  evidence_only: false
  size_tier: small
referenced_by: []
source_refs: []
tags:
  - docs/design
  - ddd
  - context-map
---

# {{TITLE}}

## Purpose

## Bounded Context Registry

| Bounded Context ID | Name | Responsibility | Subdomain Type | Owner / Expert | Model Ref |
| --- | --- | --- | --- | --- | --- |
| BC-... | | | core / supporting / generic | | |

## Context Relationships

| Upstream | Downstream | Relationship Pattern | Published Language / ACL | Consistency | Failure Ownership |
| --- | --- | --- | --- | --- | --- |
| BC-... | BC-... | Customer-Supplier / ACL / Published Language / Shared Kernel / Conformist | | | |

## Cross-Context Flows

## Translation And Ambiguity Rules

## Role Consumer Contract

## Unknowns And Disputes

## Change Impact

## Change Log

- {{DATE}}: context map draft 생성.
