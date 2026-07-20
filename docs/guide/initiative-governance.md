# initiative-governance

- Type: guide
- Created: 2026-07-18
- Updated: 2026-07-18

## Purpose

이 문서는 정책과 지침을 정돈한 뒤 `추진안`을 만들고, 그 추진안에 프로젝트를 연결해 실제 업무 방향을 유지하는 운영 순서를 설명합니다. 기술 term은 `initiative`, stable ID는 `I####`입니다.

## Operating Principle

추진안은 정책과 지침 중 하나만 선택해 연결하지 않습니다.

- 정책은 추진안의 방향·결과·금지선인 WHY/WHAT을 제공합니다.
- 지침은 프로젝트가 그 방향을 적용하고 검증하는 HOW/EVIDENCE를 제공합니다.
- 추진안은 두 관계를 직접 보존하고 여러 프로젝트의 delivery portfolio를 묶습니다.
- 프로젝트는 bounded delivery를, 태스크는 실제 실행을 소유합니다.

## Before Drafting

1. exact policy ID와 approval 상태를 확인합니다.
2. 관련 guideline ID, 적용 범위, source evidence를 확인합니다.
3. 기존 active initiative와 legacy umbrella project를 검색해 중복을 확인합니다.
4. outcome, why now, scope, out of scope, success signal을 먼저 적습니다.
5. 연결 후보 project가 있으면 관계를 `delivers`, `supports`, `explores`로 구분합니다.

## Candidate Workflow

AI는 먼저 unnumbered proposal report로 아래를 준비할 수 있습니다.

- 추진안 후보명과 사람이 읽는 한 줄 설명
- 기대 outcome과 성공 신호
- 정책 direct link와 `advances` / `constrained-by` / `exception-to` 근거
- 지침 direct link와 `required` / `recommended` 적용 수준 또는 명시적인 비적용·검토 사유
- 기존·후보 프로젝트 link와 관계
- 위험, 충돌, missing human decision

이 proposal은 numbered initiative나 active portfolio truth가 아닙니다.

기존 umbrella project를 Board에서 먼저 검토해야 할 때는 initiative register에 `INIT-*` ID의 `draft` migration candidate를 둘 수 있습니다. 이 후보는 `documentRef: null`, 승인되지 않은 상태와 `legacyProjectRefs`만 사용하며 `I####` 문서나 확정 Project lineage를 대신하지 않습니다.

## Human Issuance Gate

새 `I####`는 사람이 발급을 명시적으로 승인한 뒤에만 생성합니다.

```bash
./docs/bin/new-doc.sh initiative <slug> <issuance-approval-ref>
```

- 명령은 clean, up-to-date `main`에서 실행합니다.
- `<issuance-approval-ref>`는 exact human decision receipt, approved issue/comment 또는 repository가 정한 durable decision ref입니다.
- ref는 안전한 ASCII token, repository-relative path 또는 `http(s)` URL로 전달합니다. 공백, quote, bracket, backtick, pipe, backslash 또는 control character가 필요한 설명문은 ref에 넣지 말고 별도 decision artifact에 기록합니다.
- 대화 맥락을 임의로 승인으로 해석하지 않습니다.
- 번호 발급 승인과 `status: active` activation approval은 서로 다른 gate입니다.

번호 발급 commit은 stable ID와 draft 문서만 확보합니다. 관계와 근거 작성을 마친 뒤 Board에 노출할 때 canonical 문서와 `docs/_indexes/initiative-register.json` entry를 같은 변경 셋에서 추가합니다. 이후 lifecycle, approval, policy/guideline ref, disposition, 관계 rationale·verification을 바꿀 때도 두 mirror를 함께 갱신하고 `human-view test|snapshot`으로 불일치를 차단합니다.

## Relationship Authoring

### Policy Alignment

각 policy마다 stable ID, relation, rationale를 적습니다. 예외 관계라면 active exception receipt도 함께 연결합니다.

### Guideline Disposition

먼저 `guideline_disposition`을 `linked`, `no_applicable_guideline`, `needs_review` 중 하나로 정하고 `guideline_disposition_reason`에 사람이 판단할 수 있는 이유를 적습니다. `linked`라면 각 guideline의 stable ID, adoption, rationale, verification을 적습니다. `no_applicable_guideline`이면 refs와 관계 표를 비운 뒤 비적용 범위와 재검토 조건을 남깁니다. 단지 policy가 같다는 이유로 disposition을 생략하지 않습니다.

### Linked Projects

project source가 `related_initiative`와 관계를 소유합니다. View와 index는 이를 reverse-index해 stable `P####`, 관계, source status, 한 줄 note를 보여줍니다. 추진안 source에 project 목록을 중복 저장하거나 project WBS와 task 상태를 복제하지 않습니다.

## Activation Review

사람이 아래를 확인하고 exact initiative revision을 승인할 때만 active로 전환합니다.

- outcome과 scope가 정책에 부합하는가
- 지침 적용 수준과 verification이 현실적인가
- 다른 추진안과 중복하거나 충돌하지 않는가
- 연결 project가 실제 delivery boundary인가
- success signal이 활동량이 아니라 outcome을 판정하는가
- owner, review cadence, 위험과 중단 조건이 분명한가

승인 후 `docs/_templates/initiative-activation-receipt.json`으로 repository-relative JSON receipt를 작성합니다. receipt는 human actor, `decision: approved`, `candidateId: I####`, register가 고정한 source revision/hash, canonical initiative path와 현재 문서 SHA-256을 포함해야 합니다. 그 exact receipt path를 `approval_ref`와 register의 `decisionReceiptRef`에 동일하게 기록하고 `approval_status: approved`, `status: active`, `effectiveRef`를 문서/register에 함께 반영합니다. 채팅 문자열, 이슈 제목 또는 AI가 작성한 `approved` 문자열만으로는 activation authority가 되지 않습니다.

active/done 전환 시 모든 정책은 source-fenced current·effective·approved 상태여야 하며, `required` 지침도 같은 상태여야 합니다. `needs_review` disposition이나 검증되지 않은 `exception-to` 관계가 남아 있으면 activation을 중단하고 사람의 검토 또는 exception receipt 검증을 요청합니다. `docs/lib/initiative-authority.mjs`는 이 계약을 `new-doc.sh`, execution-loop validator, closeout validator에서 동일하게 판정합니다.

activation과 종료 변경은 canonical 문서, register의 `lifecycleState`/`approvalState`/`effectiveRef`/`decisionReceiptRef`, exact terminal human decision receipt를 한 변경 셋으로 다룹니다. 현재 `close-doc.sh`는 이 세 surface를 원자적으로 조정하지 못하므로 Initiative 입력을 명시적으로 거부합니다. 사람의 종료 결정을 받은 뒤 세 surface를 같은 변경 셋에서 직접 갱신하고 `./docs/bin/validate-closeout.sh <initiative-path>`와 `--all`을 실행합니다. 어느 하나라도 빠지거나 서로 다르면 terminal로 간주하지 않습니다. terminal 추진안은 register에서 삭제하지 않고 outcome review와 마지막 관계를 보존합니다. `INIT-*` 이관 후보를 `I####`로 전환할 때는 후보를 조용히 덮어쓰지 말고 발급 승인과 source fence를 보존한 numbered entry로 교체한 사실을 검토 기록에 남깁니다.

## Project And Task Issuance

- 새 project는 `./docs/bin/new-doc.sh project <slug> <initiative-id> [delivers|supports|explores]`로 발급합니다. 스크립트는 상위 추진안의 active/approved 문자열뿐 아니라 canonical document, register/catalog mirror, source-fenced human activation receipt와 current policy/required guideline authority를 검증하고 Project의 `related_initiative`에 기록합니다.
- 새 task는 `./docs/bin/new-doc.sh task <slug> <project-id>`로 발급합니다. 스크립트는 Project가 존재하고 modern `related_initiative`가 active/approved 추진안으로 해소되는지 확인합니다. 추진안 ID를 Task에 중복 저장하지 않습니다.
- 추진안 도입 전 legacy Project는 `project_role`, `umbrella_initiative`, `parent_umbrella_project`가 모두 명시된 경우에만 Task parent로 grandfathering합니다. `lineage_contract: v2`이거나 `related_initiative`가 존재하면 modern gate를 우회할 수 없습니다.
- project/task는 추진안의 outcome을 임의로 축소하거나 정책·지침 관계를 재해석하지 않습니다.
- task의 실행 단계에서는 추진안 summary만으로 충분하지 않으며 exact policy/normative/exception refs를 계속 읽습니다.

## Human View Presentation

`추진안` tab에서는 아래를 한 화면에서 읽을 수 있어야 합니다.

- outcome, 현재 초점, owner, approval/lifecycle state
- policy와 guideline direct relationships
- success signals, risks, review attention
- 연결 project의 ID, 제목, 관계, source status, path

View는 project/task authoring 또는 실행 UI가 아닙니다. 연결성을 보여주되 project/task truth는 원문에 남깁니다.

## Legacy Migration

기존 umbrella project를 발견해도 자동으로 승인된 추진안으로 바꾸지 않습니다.

1. `project_role`, `umbrella_initiative`, `parent_umbrella_project`, WBS와 source를 inventory합니다.
2. umbrella 이름과 목적을 추진안 candidate로 제안합니다.
3. policy/guideline direct relationships와 success signals를 새로 작성합니다.
4. 사람의 발급 승인을 받습니다.
5. `I####`를 발급하고 activation review를 거칩니다.
6. project에 `related_initiative`, task에 `related_project`를 점진적으로 보강합니다.
7. legacy field는 downstream consumer가 모두 전환될 때까지 보존할 수 있습니다.

`related_initiative`가 없는 legacy 문서는 기존 validator에서 계속 허용하며 migration 자체를 기존 work의 blocker로 만들지 않습니다.

## Change Log

- 2026-07-18: 추진안 candidate, human issuance/activation, policy/guideline relationship, project linkage와 legacy migration 운영 절차를 정의했다.
- 2026-07-18: Initiative 종료는 canonical 문서·register·terminal human decision receipt를 같은 변경 셋으로 갱신해야 하며, coordinated workflow 전까지 `close-doc.sh`가 이를 거부하도록 명시했다.
- 2026-07-18: activation receipt의 human/source/effective hash 계약과 발급·실행·closeout 공통 검증 절차를 추가했다.
