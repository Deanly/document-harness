# umbrella-project-governance

- Type: guide
- Created: 2026-04-16
- Updated: 2026-07-18
- Status: compatibility

## Purpose

이 문서는 별도 `initiative` 계층 도입 전에 human-facing initiative를 umbrella project가 겸하던 저장소를 안전하게 유지하고 점진적으로 migration하는 compatibility 규칙을 고정합니다.

새 authoring의 canonical model은 `docs/governance/initiative-governance.md`와 `docs/guide/initiative-governance.md`의 `추진안(I####) → Project(P####) → Task(T####)`입니다.

## Legacy Shape

아래 field를 가진 기존 문서는 legacy umbrella shape입니다.

- project: `project_role`, `umbrella_initiative`, `parent_umbrella_project`
- task: `related_umbrella_project`
- project body: `Umbrella Lineage`

이 shape는 기존 adopter의 source와 history를 보존하기 위해 계속 읽을 수 있지만, 새 template의 기본값은 아닙니다.

## Compatibility Rule

- legacy project/task를 initiative 도입만을 이유로 일괄 rewrite하지 않습니다.
- `umbrella_initiative`의 이름이나 코드 설명을 승인된 추진안으로 해석하지 않습니다.
- legacy umbrella project는 migration 전까지 human-facing lineage owner로 계속 표시할 수 있습니다.
- validator는 legacy shape와 modern `related_initiative` shape를 모두 허용합니다.
- modern field가 추가되면 `related_initiative`가 canonical lineage이고 legacy field는 compatibility metadata입니다.

## Migration Gate

기존 umbrella project를 별도 추진안으로 바꾸려면 아래 순서를 따릅니다.

1. umbrella project의 purpose, scope, WBS, related task와 source refs를 inventory합니다.
2. 정책과 지침의 exact stable ID, authority, approval state를 확인합니다.
3. 추진안 candidate의 outcome, success signals, policy relationship, guideline disposition을 proposal로 작성합니다.
4. 사람이 exact issuance를 승인합니다.
5. clean, up-to-date `main`에서 `I####` draft를 발급합니다.
6. activation approval 뒤 project에 `related_initiative`와 `initiative_relation`을 추가합니다.
7. task에는 `related_project`를 점진적으로 추가해 Project를 통해 추진안 계보를 따르게 합니다.
8. downstream consumer와 validator가 modern shape를 읽는지 검증한 뒤에만 legacy field 제거를 별도 변경으로 검토합니다.

## No Self-Approval Rule

- AI는 legacy source에서 추진안 후보를 추출할 수 있습니다.
- 기존 project가 active라는 사실은 추진안 발급이나 activation approval이 아닙니다.
- migration convenience, code existence, View 표시만으로 approval을 만들어내지 않습니다.
- policy/guideline conflict나 missing authority가 있으면 candidate 상태에서 멈추고 human attention을 만듭니다.

## Project And Task Behavior During Migration

- legacy project 아래 새 work를 이어가야 하면 기존 `related_umbrella_project` task를 계속 발급할 수 있습니다.
- human-approved initiative가 생긴 뒤 새 project는 modern `related_initiative` model을 사용하고, 새 task는 `related_project`로 그 Project를 참조합니다.
- 한 문서에 modern과 legacy field가 함께 있으면 modern ref가 lineage를 결정하고 legacy field는 migration note로만 읽습니다.
- migration 자체가 원래 project/task의 done criteria를 축소하거나 lifecycle state를 바꾸지 않습니다.

## View Rule

- legacy umbrella project는 `추진안 후보` 또는 `이전 형식`임을 분명히 표시합니다.
- `I####`가 없는 legacy row를 승인된 추진안과 같은 상태로 표시하지 않습니다.
- modern initiative의 linked project는 project source의 `related_initiative`를 reverse-index해 보여줍니다.

## Change Log

- 2026-04-16: umbrella project default, task-first issuance, exception rule 추가.
- 2026-05-01: project human issuance 규칙 추가.
- 2026-06-14: main-issued draft 기반 project/task 번호 reservation 규칙 추가.
- 2026-07-18: 별도 initiative 계층 도입에 따라 기존 umbrella model을 compatibility/migration bridge로 전환.
