---
type: governance
title: initiative-governance-plane
status: current
domain: initiative-governance
owner:
created: 2026-07-18
updated: 2026-07-18
retrieval_class:
  - domain-current
context:
  default_load: false
  section_load: false
  evidence_only: false
  size_tier: small
referenced_by:
  - docs/README.md
  - docs/architecture/control-plane.md
  - docs/guide/initiative-governance.md
source_refs: []
tags:
  - docs/governance
  - initiative
  - governance
---

# initiative-governance-plane

- Type: design
- Domain: initiative-governance
- Status: current
- Owner:
- Created: 2026-07-18
- Updated: 2026-07-18

## Purpose

이 문서는 사람이 정한 정책과 지침을 실제 delivery portfolio로 이어 주는 별도 `initiative` 계층의 현재 계약을 고정합니다. 사용자 화면에서는 `추진안`, 문서·schema·코드에서는 `initiative`, stable ID에서는 `I####`를 사용합니다.

## Authority Boundary

- 정책은 추진안이 추구하거나 지켜야 할 방향·결과·제약, 즉 WHY와 WHAT의 authority입니다.
- 지침은 그 방향을 적용하고 검증하는 방법, 즉 HOW와 EVIDENCE의 operational contract입니다.
- 추진안은 정책이나 지침을 새로 승인하는 surface가 아닙니다. AI는 후보와 연결 근거를 작성할 수 있지만, 정책·지침·추진안 어느 것도 스스로 승인할 수 없습니다.
- 프로젝트와 태스크의 실행 결과는 추진안의 근거가 될 수 있지만, 결과가 존재한다는 사실만으로 추진안의 human approval을 대신하지 않습니다.

## Canonical Hierarchy

```text
정책 / 지침
    ↓
추진안 (Initiative, strategy / portfolio owner)
    ↓
프로젝트 (bounded delivery boundary)
    ↓
태스크 (executable work slice)
```

- 하나의 추진안은 여러 프로젝트를 연결할 수 있습니다.
- 하나의 프로젝트는 기본적으로 하나의 주 추진안에 속합니다. 다중 추진안에 기여해야 한다면 주 추진안 하나를 `related_initiative`로 선택하고 보조 관계는 별도 proposal로 사람에게 요청합니다.
- 태스크는 `related_project`를 가져 Project를 통해 추진안 lineage에 연결합니다. 추진안 ID를 Task에 중복 저장하지 않습니다.

## Relationship Contract

추진안은 정책과 지침 모두에 직접 연결합니다. 지침이 이미 정책을 참조하더라도, 전략적 authority를 간접 추론하지 않습니다.

### Policy Link

| Field | Allowed Value | Meaning |
| --- | --- | --- |
| `policy_ref` | stable policy ID | exact policy clause 또는 policy record |
| `relation` | `advances`, `constrained-by`, `exception-to` | 추진안이 정책을 진전시키는지, 제약을 받는지, 승인된 예외를 사용하는지 |
| `rationale` | human-readable text | 이 정책이 추진안의 outcome과 scope에 미치는 영향 |

`exception-to`는 active exception receipt를 별도로 참조할 때만 사용할 수 있습니다.

### Guideline Link

먼저 `guideline_disposition`을 `linked`, `no_applicable_guideline`, `needs_review` 중 하나로 정하고 `guideline_disposition_reason`에 그 판단의 근거를 적습니다. `linked`일 때만 `guideline_refs`를 하나 이상 연결하고, `no_applicable_guideline`이면 refs와 관계 표를 비워 둔 채 비적용 범위와 재검토 조건을 남깁니다. `needs_review`는 적용 판단이 끝나지 않았음을 뜻하므로 active/done 추진안에 사용할 수 없습니다.

| Field | Allowed Value | Meaning |
| --- | --- | --- |
| `guideline_ref` | stable guideline ID | exact guideline record |
| `adoption` | `required`, `recommended` | linked guideline의 추진안 portfolio 적용 수준 |
| `rationale` | human-readable text | 적용 수준을 선택한 이유 |
| `verification` | human-readable text 또는 check ref | 프로젝트에서 확인할 방법 |

적용 가능한 지침이 없거나 판단이 남았다는 사실은 relation 누락이 아니라 `guideline_disposition`과 `guideline_disposition_reason`으로 명시합니다. `required` 지침을 쓰는 active/done 추진안은 해당 지침이 current·effective·approved 상태인지 확인해야 합니다.

### Project Link

| Field | Allowed Value | Meaning |
| --- | --- | --- |
| `related_initiative` | `I####` on a `P####` source | project가 선언한 canonical lineage |
| `relation` | `delivers`, `supports`, `explores` | outcome에 대한 프로젝트 기여 방식 |
| `status` | project source에서 읽은 lifecycle state | View용 요약이며 project truth를 대체하지 않음 |
| `note` | human-readable text | 연결 이유와 현재 역할 |

## Artifact Contract

- canonical path: `docs/initiatives/I####-<slug>.md`
- 초기 이관 중 Board 검토용 `INIT-*` record는 번호 문서가 아닌 `draft` migration candidate이며, 사람 승인 전에는 active initiative authority가 아닙니다.
- canonical template: `docs/_templates/initiative.md`
- active entry: `docs/initiatives/README.md`
- `policy_refs`, `guideline_refs`는 빠른 검색을 위한 stable ID 목록입니다.
- 본문의 `Policy Alignment`, `Guideline Disposition` 표는 각 관계의 의미와 근거를 보존하는 human-readable contract이며 register와 1:1로 일치해야 합니다.
- project source가 `related_initiative`를 소유하고 View와 index가 이를 reverse-index합니다. Initiative source에 project 목록을 중복 저장하지 않습니다.
- `Success Signals`와 `Outcome Review`는 추진안을 활동 목록이 아니라 결과 계약으로 유지합니다.
- 번호 발급 commit은 canonical draft ID를 확보하는 단계입니다. Board에 published record를 만들거나 lifecycle/approval/relationship을 바꿀 때는 initiative 문서와 `initiative-register.json` mirror를 같은 변경 셋에서 정렬합니다.
- terminal initiative도 register에서 삭제하지 않고 outcome evidence와 마지막 project lineage를 보존합니다.

## Issuance And Approval Contract

- 새 추진안 번호 발급은 사람이 정확한 추진안 초안 또는 발급 요청을 명시적으로 승인한 뒤에만 수행합니다.
- AI는 추진안 후보를 unnumbered proposal report로 준비하고 필요한 정책·지침·프로젝트 관계를 제안할 수 있습니다.
- `./docs/bin/issue-doc-bridge.sh --baseline-ref <ref> --delivery-branch <branch> --workstream-kind <feature|hotfix> -- initiative <slug> <issuance-approval-ref>`를 clean issuer `main == origin/main`에서 실행합니다. 생성된 draft는 제품 코드와 분리된 bridge/finalization commit으로 `main`과 delivery branch가 동일 SHA를 공유합니다.
- `issuance_approval_ref`는 번호 발급을 허용한 human decision을 가리킵니다. 이것은 추진안 내용의 activation approval과 분리하며 YAML/Markdown을 깨지 않는 안전한 token, repository-relative path 또는 `http(s)` URL 문자 집합으로만 렌더링합니다.
- `status: active` 전환에는 `approval_status: approved`와 exact `approval_ref`가 필요합니다. `approval_ref`는 임의 문자열이나 대화 링크가 아니라 repository-relative JSON activation receipt여야 합니다.
- activation receipt는 `docs/schemas/initiative-activation-receipt.schema.json` 계약을 따라 human actor, `decision: approved`, `candidateId: I####`, canonical initiative `effectiveRef`, 현재 문서 bytes의 `effectiveSha256`, register의 `sourceRevision`과 모든 `sourceRefs[].capturedSha256`을 고정합니다. issuance approval은 draft 번호 발급만 허용하므로 이 activation receipt와 계속 분리합니다.
- 새 Project 발급은 existing `I####`나 frontmatter 문자열만 확인하지 않습니다. `docs/lib/initiative-authority.mjs`로 canonical 문서·initiative register·governance catalog·activation receipt·현재 source/effective bytes를 함께 검증합니다.
- 새 Task 발급은 Project 존재 여부와 Project의 modern `related_initiative`가 active/approved `I####`로 해소되는지 확인합니다. 추진안 도입 전 Project는 `project_role`, `umbrella_initiative`, `parent_umbrella_project`를 모두 명시한 경우에만 migration grandfathering을 허용하며, modern field가 하나라도 있으면 modern gate가 우선합니다.
- AI가 작성했다는 사실, 기존 umbrella project가 있다는 사실, 코드가 이미 존재한다는 사실은 발급 또는 activation approval이 아닙니다.

## Lifecycle Contract

- `draft`: 번호는 발급되었지만 active portfolio truth가 아님
- `active`: 사람이 승인했고 현재 프로젝트 방향을 이끄는 추진안
- `blocked`: 필요한 human decision, policy conflict, dependency 때문에 진행할 수 없음
- `done`: outcome success signal과 evidence가 모두 충족됨
- `cancelled`: outcome을 달성하지 않고 의도적으로 종료함
- `superseded`: 새 추진안이 책임과 outcome을 대체함

`approval_status`는 lifecycle `status`와 분리하며 `unreviewed`, `review_requested`, `approved`, `rejected`, `stale`, `superseded`를 사용합니다.

## Human View Projection Contract

- `추진안`은 `지침` 오른쪽의 독립 top-level tab입니다.
- 화면은 추진안의 outcome, 현재 초점, policy/guideline 관계, 성공 신호, 위험, 검토 상태를 읽기 좋게 보여줍니다.
- 연결된 프로젝트는 project source의 `related_initiative`를 reverse-index해 ID, 제목, 관계, source status, 경로까지만 보여줍니다.
- 프로젝트·태스크 생성, 상태 변경, 실행 제어는 추진안 tab의 책임이 아닙니다.
- 화면의 project status와 link는 source에서 재생성되는 projection이며 project 문서를 대신하지 않습니다.

## Legacy Umbrella Project Bridge

기존 adopter의 `project_role: umbrella`, `umbrella_initiative`, `parent_umbrella_project`, task의 `related_umbrella_project`는 즉시 삭제하거나 일괄 rewrite하지 않습니다.

- `related_initiative`가 없는 기존 umbrella project는 `legacy umbrella project`로 계속 유효합니다.
- legacy `umbrella_initiative` 문자열은 migration candidate의 이름 근거일 뿐, 승인된 추진안이나 `I####` authority로 승격되지 않습니다.
- modern `related_initiative`가 추가되면 그것이 canonical lineage이며 legacy field는 호환 메타데이터로만 취급합니다.
- migration은 후보 추출 → policy/guideline 관계 작성 → human approval → `I####` 발급 → project/task ref 보강 순서로 진행합니다.
- migration 전후 validator는 legacy와 modern shape를 모두 허용해야 하며 기존 adopter에 일괄 rewrite를 요구하지 않습니다.

## Invariants

- 추진안은 정책만 또는 지침만 간접 연결한 채 나머지 관계를 추론하게 두지 않습니다.
- 승인되지 않은 추진안은 active portfolio truth로 표시하지 않습니다.
- 프로젝트 link projection이 project source의 lifecycle truth를 소유하지 않습니다.
- 추진안의 완료는 연결 프로젝트의 개수나 task 완료 수가 아니라 success signal evidence로 판단합니다.
- legacy bridge는 compatibility일 뿐 새 문서의 기본 authoring model이 아닙니다.

## Failure Boundaries

- 정책 또는 지침 ID가 없거나 stale하면 추진안을 active로 만들지 않고 review attention을 남깁니다.
- `exception-to` 관계는 active exception receipt를 결정론적으로 검증할 수 있을 때만 활성화합니다. 현재 verifier가 그 receipt 계약을 검증하지 못하면 fail closed로 activation을 거부합니다.
- 추진안 activation approval이 exact source revision/hash와 현재 canonical document hash에 함께 묶이지 않으면 `approved`로 표시하지 않으며 Project/Task 발급·실행·closeout authority로 사용하지 않습니다.
- linked project source를 찾을 수 없으면 관계를 삭제하지 않고 unresolved link로 표시합니다.
- 하나의 프로젝트가 상충하는 여러 주 추진안을 주장하면 human portfolio decision이 있을 때까지 실행 범위를 확장하지 않습니다.

## Change Log

- 2026-07-18: 정책·지침과 project/task 사이의 별도 Initiative 계층, `추진안`/`I####`, direct asymmetric links, guideline disposition, human issuance/activation approval, legacy umbrella bridge를 정의했다.
- 2026-07-18: activation approval을 source-fenced repository JSON receipt로 고정하고 Project/Task 발급·실행·closeout이 같은 결정론적 authority helper를 사용하도록 강화했다.
