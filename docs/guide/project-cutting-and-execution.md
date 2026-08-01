# project-cutting-and-execution

- Type: guide
- Created: 2026-04-10
- Updated: 2026-08-02

## Purpose

이 문서는 언제 새 `project` 문서를 발급해야 하는지, 작업을 어떤 기준으로 `task`로 분해해야 하는지, 실행 순서와 게이트를 어떻게 문서화해야 하는지를 정리합니다.

## When To Keep Work As Guide Or Design

아직 아래가 고정되지 않았다면 새 `project`보다 `guide` 또는 `design`으로 남기는 편이 낫습니다.

- 경계의 이름과 책임
- 입력과 출력 계약
- 직접 구현할 범위와 후속 시스템 범위
- 종료 조건의 형태

아직 경계가 흐린 상태에서 project를 먼저 발급하면, 미정인 영역을 delivery boundary처럼 잠가버리게 됩니다.

## When To Issue A New Project

새 work가 생기면 기본값은 새 `project`가 아니라 현재 bounded `project` 아래의 새 `task`입니다.

먼저 아래를 확인합니다.

- 현재 `project`의 새 `task`로 처리 가능한가
- 현재 `project`의 WBS와 `Status` 이력 안에서 설명 가능한가
- human이 봤을 때 같은 delivery boundary의 일부로 읽히는가

셋 중 대부분이 `yes`면 새 `project`가 아니라 새 `task`입니다.

아래 조건 중 하나가 명확할 때만 새 `project`를 허용합니다.

- 사용자가 명시적으로 별도 `project` 분리를 요청한 경우
- completion mode가 본질적으로 달라 현재 project 아래 `task`로 담기 어려운 경우
- owner, 운영 검증 체계, handoff 대상이 실질적으로 분리되는 경우

대표적인 예외 트리거:

- runtime/environment phase가 완전히 달라질 때
- downstream 또는 upstream boundary가 새로 열릴 때
- 운영 적용 단계가 기존 bootstrap 단계와 다른 성공 기준을 가질 때

## Human-Issued Project Rule

`project`는 승인된 추진안 아래 bounded delivery boundary를 잠그는 surface이므로 사람의 명시적 요청 또는 승인 하에서 발급합니다. Strategy/portfolio owner는 별도 `initiative`입니다.

- 에이전트는 새 `project` 필요성을 분석하고 `Project Issuance Check` 초안을 준비할 수 있습니다.
- 하지만 사람의 명시적 요청 또는 승인 없이 새 `project` 문서를 발급하거나 기존 work를 새 `project`로 승격하지 않습니다.
- 승인 전 기본값은 현재 `project` 아래의 새 `task`이며, 아직 경계가 흐리면 `guide` 또는 `design`으로 남깁니다.

## Main-Issued Numbered Document Rule

번호가 붙는 `initiative`, `project`, `task` 문서는 항상 `main`의 문서 집합을 기준으로 발급합니다. feature branch에서 직접 번호를 계산하면 branch별 문서 집합이 달라져 같은 번호가 서로 다른 문서를 가리킬 수 있습니다. Initiative는 추가로 exact human issuance-approval ref가 필요합니다.

기본 흐름:

1. 현재 work branch가 dirty하면 `git stash push -u`로 untracked 파일까지 보관합니다.
2. `main`으로 전환하고 remote tracking branch가 있으면 `git pull --ff-only`로 최신화합니다.
3. clean `main`에서 해당 명령을 실행합니다. Initiative는 `./docs/bin/new-doc.sh initiative <slug> <issuance-approval-ref>`, project는 `./docs/bin/new-doc.sh project <slug> <initiative-id> [delivers|supports|explores]`, task는 `./docs/bin/new-doc.sh task <slug> <project-id>`를 사용합니다. Project의 상위 `I####`는 active/approved여야 하고 Task의 `P####`는 그 active/approved Initiative로 해소되어야 하며 기본 상위를 추론하지 않습니다. 명시적인 legacy lineage 세 field를 모두 가진 기존 Project만 migration 동안 예외적으로 Task parent가 될 수 있습니다.
4. `new-doc.sh`가 생성된 `draft` 파일만 즉시 `main`에 별도 commit으로 남깁니다. 공유 remote가 있으면 push 또는 공유까지 끝냅니다.
5. 원래 work branch로 돌아가 `main`을 merge해서 새 문서와 그 사이 `main`에 들어온 배포본을 함께 가져옵니다.
6. stash를 썼다면 merge 후 `git stash pop`하고 충돌을 해결합니다.

이 흐름에서 `draft` commit은 문서 번호 reservation입니다. 아직 active truth가 아니므로 폴더 README의 active 목록에는 올리지 않습니다. 이후 work branch에서 해당 초안을 채우고, 필요한 경우 같은 branch에서 active 전환과 README 갱신을 수행합니다.

개발 도중 `main`에 이미 배포된 버전을 work branch로 가져오는 것은 허용됩니다. 이는 문서 번호 정합성을 유지하면서 배포된 baseline 위에서 계속 개발하게 만드는 정상적인 refresh입니다.

## Concurrent Feature And Hotfix Operating Recommendation

여러 feature가 동시에 진행되는 중 최근 배포 revision에서 hotfix를 준비해야 한다면, branch 전환과 stash 반복보다 작업별 worktree를 유지하는 편이 좋습니다. hotfix는 실제 배포 tag/SHA를 code baseline으로 삼고, 문서 번호는 기존 계약대로 `main`에서 예약합니다.

현재 `main`에 hotfix가 받아서는 안 되는 미배포 코드가 있으면 문서를 받기 위해 `main` 전체를 병합하는 흐름을 자동 선택하지 않는 편이 좋습니다. 이 경우의 worktree 구성, revision 분리, 선택적 docs-only bridge와 여러 feature의 문서 reservation 운영은 `docs/guide/concurrent-feature-hotfix-operation.md`를 참고합니다.

이 내용은 repository 운영 권장안이며 새 branch policy, `new-doc.sh` 동작 또는 validator gate를 만들지 않습니다.

## Initiative And Project Default

- human-facing strategy/portfolio owner는 `I####` 추진안입니다.
- project는 추진안 outcome에 기여하는 bounded delivery boundary입니다.
- task는 project 아래의 executable slice입니다.
- single-task 성격의 작은 분화는 새 `project`가 아니라 새 `task`입니다.
- legacy umbrella project는 `docs/guide/umbrella-project-governance.md`의 compatibility rule을 따릅니다.

## Project Cutting Rules

- project는 기술 스택이 아니라 책임 경계로 자릅니다.
- 책임 경계가 달라 보여도 현재 delivery boundary 안에서 task로 담길 수 있으면 기본값은 새 `task`입니다.
- 구현 준비 단계와 현장 검증 단계의 성공 조건이 다르면 project 분리를 검토합니다.
- 후속 시스템이 아직 설계되지 않았다면 "다음 project 후보"로만 남기고 현재 project에 포함시키지 않습니다.
- project 문서의 WBS는 실제 `task` 문서와 1:1 대응시키는 것을 기본으로 합니다.

## New Project Exception Record

새 `project`를 발급하려면 발급 전에 아래 두 문장을 남깁니다.

- 왜 현재 `project`의 `task`로 처리하면 안 되는지
- 왜 human 입장에서 별도 `project`가 더 이해하기 쉬운지

이 기록은 `Project Issuance Check` 섹션에 남깁니다.

## Goal Lock Rule

`project`와 `task`의 `Purpose`, `Scope`, `Out Of Scope`, `Completion Mode`, `Completion Criteria` 또는 `Exit Criteria`는 발급 시점의 완료 계약입니다.

- WBS를 더 세밀하게 나누는 것은 허용됩니다.
- 후속 `task`나 `project`를 새로 발급하는 것도 허용됩니다.
- 하지만 이런 분해는 기존 문서의 `done` 기준을 낮추는 근거가 되지 않습니다.

원래 핵심 목표를 후속 문서로 옮겼다면 현재 문서는 `done`이 아니라 계속 `active` 또는 `blocked`로 남아야 합니다. 목적 자체가 바뀌었다면 `superseded` 또는 `cancelled`로 닫습니다.

## Completion Mode Selection

기본 `Completion Mode`는 `functional`입니다. 대부분의 `project`와 `task`는 여기에 머무는 것이 맞습니다.

지원 mode는 아래와 같습니다.

- `functional`: 하나의 기능 단위, 운영 경계, delivery boundary가 실제로 동작해야 합니다.
- `design-lock`: 설계, 계약, 정책, 인터페이스가 authoritative truth로 잠겨야 합니다.
- `decision-lock`: 경쟁안 비교가 끝나고 하나의 의사결정이 공식 기준으로 잠겨야 합니다.
- `investigation`: 핵심 불확실성이 재현 가능한 사실과 함께 줄어들어 다음 실행 경계가 분명해져야 합니다.
- `integration`: 기존 경계 두 개 이상이 실제로 연결되고 handshake가 확인되어야 합니다.
- `migration`: 데이터, 트래픽, 운영 책임이 source에서 target으로 옮겨지고 정합성이 확인되어야 합니다.
- `operational-baseline`: 운영 runbook, ownership, alert, rollback 또는 대응 기준이 실제로 성립해야 합니다.
- `remediation`: 결함이나 위험이 제거되고 재발 방지 장치까지 들어가야 합니다.
- `decommission`: 기존 기능, 시스템, 경로가 안전하게 제거되고 잔존 의존성이 정리되어야 합니다.

`Completion Mode`는 terminal condition이어야 하며, `implementation-only`, `test-only`, `documentation-only`, `analysis-only` 같은 phase 이름은 쓰지 않습니다.

## Task Slicing Rules

좋은 `task`는 아래를 만족합니다.

- 선택한 `Completion Mode` 기준으로 하나의 종료 상태를 닫는 독립 목적이 있다.
- whole-system anchor가 있어 현재 task가 전체 시스템에서 무엇을 보존하는지 설명할 수 있다.
- 완료 기준이 검증 가능하다.
- 설계 문서와 연결된다.
- 너무 크지 않아 Status와 WBS가 실제 진행을 설명할 수 있다.

작업을 `task`로 자를 때는 아래 순서를 권장합니다.

1. boundary 또는 contract를 고정하는 slice
2. 실제 데이터를 만나는 reality-check slice
3. parser, normalization, persistence 같은 정렬 slice
4. end-to-end cycle 또는 운영 baseline slice

## Split Or Reissue Rule

작업이 커졌다고 느껴질 때는 먼저 "이것이 여전히 하나의 기능 단위를 닫는 문서인가"를 확인합니다.

- 하나의 기능 단위가 여전히 같은 문서에서 닫힌다면 새 `task`를 발급하기보다 내부 WBS를 더 세밀하게 쪼갭니다.
- 별도의 기능 경계, 별도 gate, 별도 책임자가 생겼다면 새 `task`를 발급하고 project WBS를 함께 갱신합니다.
- 기존 `task`가 잘못 발급되었다고 판단되면 새 문서를 발급하되, 기존 문서는 `done`이 아니라 `superseded`로 닫습니다.

후속 문서로 남은 핵심 목표를 넘겼다는 사실 자체는 현재 문서를 `done`으로 만들지 않습니다.

## Whole-System Anchor Rule

`project`와 `task`는 부분 작업 문서이므로, 발급 시 아래를 함께 적어야 합니다.

- `Related Control Plane`
- project: `Initiative Ref`; task: `Related Project`; 또는 legacy `Related Umbrella Project`
- `Whole-System Anchor`
- `Outputs / Handoff`
- `Quality Axes In Scope`

이 다섯 가지가 없으면 부분 작업은 전체와 분리된 local memo가 되기 쉽습니다.

## Non-Functional Mode Rule

`functional`이 아닌 mode를 쓰려면 아래가 함께 적혀야 합니다.

- 왜 `functional`이 아니라 그 mode가 맞는지
- 무엇이 authoritative artifact 또는 closed state가 되는지
- 어떤 evidence가 있어야 닫히는지
- 후속 구현, 운영, migration 문서가 있다면 무엇인지

이미 발급된 문서를 나중에 더 약한 mode로 재해석해 닫지 않습니다.

## Gate Writing Rules

후속 작업의 의미가 선행 현실 확인에 의존하면 gate를 명시합니다.

gate 문서화 규칙:

- gate 이름을 붙입니다.
- "무엇이 열려야 다음 단계가 의미가 생기는가"를 적습니다.
- 완료 기준을 bullet로 적습니다.
- gate가 닫힌 상태에서 가능한 병렬 작업만 따로 적습니다.

## Parallelism Policy

모든 일을 동시에 진행하지 않습니다. 아래 원칙을 따릅니다.

- critical path는 하나의 main execution 흐름이 소유합니다.
- 문서 정합성, 운영 초안, fixture 정리처럼 비차단 작업은 병렬화합니다.
- final lock은 선행 gate가 열린 뒤에만 합니다.
- 운영 baseline은 end-to-end 검증 이전에 실제 적용 기준으로 확정하지 않습니다.

## Execution Start Rule

구현에 들어가기 전에는 최소한 아래를 한 번 정렬합니다.

- active `initiative`가 무엇인지
- active bounded `project`가 무엇인지
- active `task`가 무엇인지
- 이번 작업이 왜 새 `project`가 아니라 해당 project 아래 `task`인지

이 정렬 없이 바로 분해를 시작하면, 실행 중간에 lineage가 쉽게 흔들립니다.

## Exit Criteria

project나 task를 닫을 때는 종료 기준이 필요합니다.

좋은 종료 기준의 특징:

- 실제 검증 관점이다.
- 증빙 가능한 결과를 요구한다.
- 단순 구현 완료가 아니라 동작/관찰/기록까지 포함한다.
- 후속 `task` 또는 예외 `project`로 넘길 잔여 범위를 명시한다.

`done` 전에 아래를 확인합니다.

- 발급 시점의 Purpose가 그대로 달성되었는가
- 필수 Scope가 실제로 닫혔는가
- whole-system anchor를 깨지 않고 필요한 outputs / handoff를 남겼는가
- 선택한 `Completion Mode`가 요구하는 evidence가 있는가
- 남은 핵심 목표를 후속 문서로 넘긴 뒤 `done`으로 위장하지 않았는가

## Evidence Rule

Status와 완료 판단에는 가능하면 아래를 남깁니다.

- 실제 샘플
- 빌드 또는 실행 결과
- 로그 분포
- persistence 결과
- 확인된 실패 유형과 허용 여부

증빙 없는 완료 선언은 문서 품질을 급격히 떨어뜨립니다.

## Change Log

- 2026-04-10: 프로젝트 분할, task slicing, gate-driven execution 규칙 정리.
- 2026-04-13: goal lock, completion mode catalog, non-functional mode 규칙 추가.
- 2026-04-14: whole-system anchor, handoff, quality axes 요구사항 추가.
- 2026-04-16: umbrella project default, task-first issuance, exception record 규칙 추가.
- 2026-05-01: project human issuance 규칙 추가.
- 2026-06-14: `project`/`task` 번호 발급을 clean, up-to-date `main`에서만 수행하고 draft를 즉시 commit하는 규칙 추가.
- 2026-07-18: strategy owner를 별도 `I####` 추진안으로 분리하고 project/task cutting을 initiative→project→task hierarchy에 정렬.
- 2026-08-02: 병렬 feature와 배포 기준 hotfix의 worktree·문서 전달 운영 권장안을 별도 guide로 연결.
