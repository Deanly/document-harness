---
type: design
design_kind: context-map
title: repository-context-map
status: draft
domain: repository-domain
bounded_context: all
bounded_context_id: CONTEXT-MAP-REPOSITORY
subdomain_type: portfolio
model_revision: 1
validation_status: unreviewed
validation_ref:
domain_expert_roles:
  - repository-domain-owner
role_views:
  - customer
  - planner
  - architect
  - developer
  - qa
owner: repository-domain-owner
created: 2026-07-29
updated: 2026-07-29
source_refs:
  - docs/design/domain-landscape.md
tags:
  - docs/design
  - ddd
  - adoption
---

# Repository Context Map

## Purpose

This draft makes the missing domain discovery explicit. It must not be treated as a map of actual business boundaries.

## Bounded Context Registry

| Bounded Context ID | Name | Responsibility | Subdomain Type | Owner / Expert | Model Ref |
| --- | --- | --- | --- | --- | --- |
| BC-DISCOVERY | discovery-required | Establish source-backed business boundaries. | supporting | repository-domain-owner | not-issued |

## Context Relationships

| Upstream | Downstream | Relationship Pattern | Published Language / ACL | Consistency | Failure Ownership |
| --- | --- | --- | --- | --- | --- |
| BC-DISCOVERY | BC-DISCOVERY | discovery-only | no published language yet | not established | repository-domain-owner |

## Cross-Context Flows

- Not established by initialization.

## Translation And Ambiguity Rules

- Directory, service, team, and database boundaries are candidates, not bounded-context proof.

## Role Consumer Contract

- All roles stop at BC-DISCOVERY until human-reviewed landscape, context model, language, and examples exist.

## Unknowns And Disputes

- Actual upstream/downstream, relationship pattern, translation, consistency, and failure ownership require domain-expert review.

## Change Impact

- Issuing real context sets requires updating this map, role packets, delivery lineage, and Board projection.

## References

- See `source_refs` in frontmatter.

## Change Log

- 2026-07-29: initialization-safe discovery context map added.
