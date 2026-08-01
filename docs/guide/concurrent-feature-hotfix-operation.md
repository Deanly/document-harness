---
type: guide
title: concurrent-feature-hotfix-operation
status: current
governance_role: operational-guidance
owner:
created: 2026-08-02
updated: 2026-08-02
related_project: []
related_task: []
related_design: []
standard_refs: []
source_refs: []
tags:
  - docs/guide
  - git-worktree
  - feature
  - hotfix
  - document-issuance
---

# concurrent-feature-hotfix-operation

- Type: guide
- Governance Role: operational-guidance
- Status: current
- Created: 2026-08-02
- Updated: 2026-08-02
- Related Project:
- Related Task:
- Related Design:

## Purpose

이 guide는 여러 feature가 동시에 진행되는 동안 최근 배포본에서 hotfix를 준비해야 하고, 번호 문서는 `main`에서 발급하는 repository에서 작업 공간과 기준 revision을 어떻게 나누어 쓰면 좋은지 설명합니다.

목표는 아래 세 가지를 함께 지키는 것입니다.

- 진행 중인 feature worktree와 미완료 변경을 보존합니다.
- hotfix 코드에는 최근 배포본 이후의 미배포 feature 변경이 섞이지 않게 합니다.
- 문서 번호는 `main`의 단일 시퀀스에서 예약해 여러 작업이 같은 번호를 발급하지 않게 합니다.

## Recommendation Status

이 문서는 이 repository를 운영할 때 선택할 수 있는 권장 방식입니다. 새 policy, normative design 또는 validator contract가 아닙니다.

- 기존의 clean, up-to-date `main` 기반 번호 발급 계약은 바꾸지 않습니다.
- 이 guide만으로 branch protection, release policy, worktree layout 또는 docs-only bridge 사용을 강제하지 않습니다.
- adopted repository는 실제 배포 방식과 협업 규칙에 맞지 않으면 이 방식을 선택하지 않아도 됩니다.
- `AGENTS.md`, template, `new-doc.sh`와 validator는 이 guide 때문에 추가 제약을 적용하지 않습니다.

## Separate The Three Revisions

feature와 hotfix를 함께 운영할 때는 branch 이름 하나에 모든 기준을 맡기지 않는 편이 좋습니다.

| Revision | 의미 | 권장 기준 |
| --- | --- | --- |
| document issuance revision | 번호와 draft가 예약된 문서 기준 | 최신 공유 `main` revision |
| code baseline revision | 해당 작업이 변경을 시작한 코드 기준 | feature의 승인된 integration 기준 또는 hotfix의 실제 배포 tag/SHA |
| delivery revision | 검증·배포 또는 main 통합 대상으로 선택한 결과 | 작업 완료 뒤 생성된 immutable commit/tag |

Task의 `Status`, checkpoint 또는 evidence에는 필요할 때 branch 이름뿐 아니라 실제 code baseline SHA, document issuance SHA와 배포 대상 SHA를 남기는 편이 좋습니다. 이 권장은 새 frontmatter property를 요구하지 않습니다.

## Recommended Repository Layout

동시에 살아 있는 작업은 branch 전환과 stash 반복보다 별도 worktree로 유지하는 편이 안전합니다.

```text
repository-main/        main 문서 발급과 통합 확인
repository-feature-a/   feature A
repository-feature-b/   feature B
repository-hotfix-x/    최근 배포 revision에서 시작한 hotfix
```

- `main` issuer worktree는 clean 상태를 유지하고 번호 발급과 공유 여부를 확인하는 데 사용합니다.
- feature마다 branch와 worktree를 분리해 하나의 feature 준비가 다른 feature의 dirty state를 요구하지 않게 합니다.
- hotfix worktree는 branch 이름이 아니라 실제 배포 receipt가 가리키는 tag/SHA에서 시작합니다.
- 작업별 Task를 분리하되 같은 delivery boundary라면 기존 Project 아래에 둡니다. hotfix라는 이유만으로 새 Project를 만들지는 않습니다.

## Preferred Flow When Main Is Deployment-Safe

이 repository에서 가장 단순하게 운영하려면 `main`을 최신 운영 기준으로 받아들일 수 있는 상태로 유지하는 편이 좋습니다. feature 구현은 feature branch에 보존하고, `main`에는 배포된 코드와 문서 reservation 같은 통합 가능한 변경만 둡니다.

1. 각 feature는 별도 worktree에서 계속 작업합니다.
2. 번호 문서가 필요하면 clean, up-to-date `main` issuer worktree에서 발급하고 공유 remote에 reservation을 반영합니다.
3. 해당 feature 또는 hotfix가 현재 `main`의 코드를 안전한 baseline으로 받아들일 수 있는지 확인합니다.
4. 안전하다면 작업 branch에 `main`을 병합해 발급 문서와 승인된 baseline을 함께 받습니다.
5. hotfix는 실제 배포 revision과 `main`의 차이가 의도한 문서·운영 변경뿐인지 확인한 뒤 진행합니다.

이 흐름은 현재 `new-doc.sh` 계약을 그대로 사용하면서 feature 수와 관계없이 문서 번호 할당만 직렬화합니다.

## When Main Contains Unreleased Code

현재 `main`에 hotfix가 받아서는 안 되는 미배포 코드가 있으면 문서를 받기 위한 이유만으로 `main` 전체를 hotfix branch에 병합하지 않는 편이 좋습니다.

이때 repository 운영자는 아래 중 하나를 선택할 수 있습니다.

| 선택 | 적합한 경우 | 주의점 |
| --- | --- | --- |
| `main`을 다시 deployment-safe하게 운영 | release 흐름을 조정할 수 있음 | 가장 단순하며 현재 발급 도구와 잘 맞음 |
| reviewed docs-only bridge | 같은 repository 안에서 hotfix baseline과 최신 문서 projection을 함께 써야 함 | 별도 생성·검토 절차가 필요함 |
| 별도 document ledger/ref | 장기간 많은 branch와 repository가 병렬 운영됨 | 운영·권한·validator 구조가 더 복잡해짐 |

선택이 정해지기 전에는 hotfix branch가 최신 문서를 받았다고 간주하거나, 미배포 코드가 섞인 merge를 정상 baseline refresh라고 기록하지 않습니다.

## Optional Docs-Only Bridge Pattern

docs-only bridge는 현재 `main`의 문서 control-plane을 대상 작업의 code baseline 위에 투영한 commit을 `main`과 대상 branch가 함께 조상으로 가지게 하는 선택적 Git 운용 패턴입니다.

```text
deployed R ---- docs bridge D ---- hotfix H
      \                 \
       \                 +---- main이 같은 D를 병합
        +---- 기존 main/feature history
```

권장되는 bridge의 성질은 아래와 같습니다.

- 부모 revision은 hotfix의 배포 기준 또는 feature의 안전한 공통 baseline입니다.
- product code tree는 그 baseline과 같고, 사전에 정한 문서 control-plane 경로만 최신 `main` projection을 사용합니다.
- 새 numbered draft와 문서 projection의 source `main` SHA를 함께 식별할 수 있어야 합니다.
- `main`과 대상 branch는 독립 cherry-pick 사본이 아니라 같은 bridge commit SHA를 병합하는 편이 좋습니다.
- 여러 feature가 서로 다른 Task를 쓴다면 Task마다 main reservation을 직렬화하고 각 작업의 baseline에 맞는 bridge를 별도로 검토합니다.

이 repository의 현재 `new-doc.sh`는 draft를 `main`에 직접 commit하며 docs-only bridge를 생성하지 않습니다. 이미 생성된 main-issued commit을 단순히 cherry-pick한 것을 같은 bridge로 간주하지 않습니다. 이 패턴을 실제 기본 흐름으로 채택하려면 별도 도구·검토·복구 절차를 먼저 합의하는 편이 좋으며, 이 guide는 그 채택이나 구현을 승인하지 않습니다.

## Multiple Feature Guidance

- feature 수만큼 작업 공간을 둘 수 있지만 번호 allocator는 하나만 둡니다.
- 번호 reservation은 공유 `main` 반영이 확인된 뒤 확정된 것으로 취급하는 편이 좋습니다.
- 다른 작업이 먼저 번호를 예약했다면 최신 `main`을 기준으로 다시 발급합니다.
- 서로 다른 feature가 같은 Task 문서를 동시에 수정하기보다 하나의 Project 아래 별도 Task로 실행 경계를 나누는 편이 좋습니다.
- hotfix가 main에 통합된 뒤에도 진행 중인 feature는 자동으로 새 baseline을 받았다고 보지 않고, 각 feature가 hotfix 변경을 가져올 시점을 따로 선택합니다.

## Review Checklist

- hotfix의 code baseline이 실제 최근 배포 tag/SHA인가
- current `main`에 hotfix가 받아서는 안 되는 미배포 코드가 있는가
- numbered draft가 최신 공유 `main`에서 유일하게 예약되었는가
- 각 feature와 hotfix의 dirty state가 별도 worktree에 보존되어 있는가
- 문서 전달을 위해 불필요한 product code merge를 만들지 않았는가
- 선택한 문서 전달 방식과 실제 source/target SHA를 Status, checkpoint 또는 evidence에서 다시 찾을 수 있는가
- docs-only bridge를 썼다면 code path가 baseline과 동일하고 양쪽 history가 같은 bridge SHA를 공유하는지 독립 검토했는가

## References

- `docs/README.md`
- `docs/guide/project-cutting-and-execution.md`
- `docs/guide/document-lifecycle-and-active-reading.md`
- `docs/bin/new-doc.sh`

## Change Log

- 2026-08-02: 병렬 feature, 배포 기준 hotfix와 main-issued 문서가 함께 존재할 때의 repository-local 권장 운영 방식을 추가.
