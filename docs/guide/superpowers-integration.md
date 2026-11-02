---
type: guide
title: superpowers-integration
status: current
owner: document-harness maintainers
created: 2026-11-02
updated: 2026-11-02
related_project: []
related_task: []
related_design:
  - docs/architecture/execution-loop-plane.md
  - docs/architecture/harness-adoption-plane.md
source_refs:
  - https://github.com/obra/superpowers
  - docs/EXECUTE.md
  - docs/ADOPT.md
tags:
  - docs/guide
  - execution
  - superpowers
---

# Superpowers integration

## Purpose

document-harness가 설치된 프로젝트에서 Superpowers를 필수 작업 방법으로 사용한다. 하네스는 업무를 이어갈 기억과 계약을 유지하고, Superpowers는 그 계약을 더 잘 수행하는 설계·구현·문제 해결·리뷰·검증 방법을 제공한다. 설치된 upstream 스킬 원문을 읽어 적용하며 이 문서는 스킬 자체를 복제하거나 대체하지 않는다.

## Responsibility

| 소유자 | 책임 | 남기는 결과 |
| --- | --- | --- |
| document-harness | 목표, 범위, 정책·지침·추진안, 도메인 권위, 승인, task/checkpoint, 근거, 중단·재개·인계 | 기존 canonical 문서와 영수증 |
| Superpowers | 요구 구체화, 설계, 실행 계획, TDD, 원인 조사, 리뷰, 완료 전 검증 | 기존 task에 연결된 설계·계획·테스트·리뷰 근거 |
| AI 도구 | 위 두 계약을 읽고 적용하여 승인된 작업 수행 | 실제 실행 결과와 최신 checkpoint |

상위 시스템 지시와 사용자 지시가 우선한다. Superpowers는 정책·승인·도메인 권위를 부여하지 않으며 하네스도 스킬 사용 기록만으로 성공을 판정하지 않는다. 자동 commit/push, 새 project 발급, 전역 설정 변경은 스킬에서 권고하더라도 해당 작업의 실제 권한 범위를 따른다.

## Mandatory Preflight

1. 새 작업 및 재개 시 적용되는 AGENTS/CLAUDE 계약과 repository-local 하네스 라우터를 읽는다.
2. 현재 AI 도구의 스킬 목록에서 Superpowers를 확인하고 `superpowers:using-superpowers`를 호출하거나 그 환경이 제공하는 SKILL.md 원문을 직접 읽는다. 이어서 실제 작업에 적용되는 스킬과 해당 도구용 reference를 읽는다. 기억에 의존하거나 이 guide를 읽은 것으로 upstream 스킬 적용을 대체하지 않는다.
3. 하네스의 현재 task/checkpoint, 목표·완료 조건, 정확한 승인·정책·도메인 참조와 최신 근거를 확인한다. 새 계획 전에 이미 수행한 작업을 확인한다.
4. 사용한 스킬과 실행 방법을 간단히 알리고 현재 checkpoint 또는 작업 근거에 연결한다. 작업별 스킬 선택은 아래 routing을 출발점으로 삼고 설치된 스킬의 적용 조건을 따른다.

필수 스킬이 없거나 읽을 수 없으면 `SUPERPOWERS_UNAVAILABLE`과 누락된 스킬, 수행하지 못한 단계, 설치/활성화 후 재개 위치를 현재 checkpoint 또는 작업 근거에 기록한다. 스킬에 의존하는 구현을 수행했다고 주장하거나 임의의 자체 절차로 통과 처리하지 않는다. 원인 확인·문서 읽기·인계 준비 같은 독립 작업은 계속할 수 있다. 현재 도구의 공식 플러그인 설치/활성화 방법을 안내하고, 사용자 전역 디렉터리에 임의 복사하거나 가짜 skill 경로를 만들지 않는다. Codex와 Claude는 각자 사용하는 환경에서 의존성이 이용 가능한지 확인한다.

## Intent To Completion

하네스의 delivery 작업은 다음 순서로 이어갑니다. 이미 존재하는 유효한 설계·계획·승인은 확인해 재사용하고, 빈 단계만 수행합니다. Superpowers의 해당 스킬 원문이 정하는 질문·설계 승인·테스트·리뷰 경계는 하네스가 생략하거나 대신 승인하지 않습니다.

| Phase | Superpowers method | Harness record |
| --- | --- | --- |
| Intent | 요청의 목적, 영향을 받는 사람, 원하는 결과, 완료 조건과 비범위를 확인합니다. 새 기능·행동 변경·불명확한 요구에는 `superpowers:brainstorming`을 적용합니다. | 기존 task의 Purpose, Goal Inventory, Scope/Out Of Scope와 현재 checkpoint에 확인된 의도·미해결 질문을 연결합니다. |
| Design | 적용되는 Superpowers 설계 절차로 접근과 tradeoff를 검토하고 필요한 사람의 설계 결정을 받습니다. 도메인 의미와 정책 권위는 별도 하네스 gate로 확인합니다. | 설계 문서 또는 유효한 기존 설계의 exact ref를 task References와 checkpoint evidence에 연결합니다. 미승인 설계를 승인된 truth로 표시하지 않습니다. |
| Milestones | 여러 단계의 작업에는 `superpowers:writing-plans`로 검증 가능한 구현 단계를 만들고, 실행에는 해당 계획 실행 스킬을 사용합니다. | 계획 ref와 각 단계의 산출물·검사를 task WBS의 `W#` 항목 및 checkpoint next action에 연결합니다. WBS 진행률은 실제 완료 근거로만 갱신합니다. |
| Completion | 계획을 실행하며 적용되는 TDD·디버깅·리뷰 스킬을 사용하고, 완료 주장 전에 `superpowers:verification-before-completion`으로 실제 검사를 다시 확인합니다. | checkpoint의 실행·검사·리뷰 evidence와 task Goal Verification을 Goal ID별로 대조합니다. 미완료 WBS, 미해결 attention 또는 필요한 승인·검사가 남으면 `succeeded`/`done`으로 닫지 않습니다. |

새로운 병렬 상태 원장이나 스킬 사용만을 증명하는 빈 체크박스를 만들지 않습니다. 계획 파일과 Superpowers 진행 기록이 별도로 필요하면 기존 task/checkpoint에서 정확한 경로로 참조합니다. 설계나 계획의 선택지가 사람 결정을 요구하면 그 결정에 의존하는 행동만 멈추고, 독립된 근거 수집은 계속할 수 있습니다.

## Skill Routing

| 작업 상황 | 필수로 검토·적용할 Superpowers 스킬 | 하네스 연결 |
| --- | --- | --- |
| 새 기능·동작 변경·불명확한 요구 | `superpowers:brainstorming` | 기존 목표·승인·범위를 입력으로 사용하고 설계 결과를 task에 연결 |
| 여러 단계 실행 | `superpowers:writing-plans` | 실행 계획을 현재 task/checkpoint에 연결 |
| 계획 실행 | `superpowers:executing-plans` 또는 `superpowers:subagent-driven-development` | 도구와 사용자 위임에 맞는 실행 방법, 단계별 근거·재개 지점 유지 |
| 기능 구현·결함 수정 | `superpowers:test-driven-development` | 실패→수정→성공 검사 결과를 검증 근거로 연결 |
| 테스트 실패·예상 밖 동작 | `superpowers:systematic-debugging` | 관찰·가설·원인·재현·수정 검증 기록 |
| 리뷰 요청·피드백 처리 | `superpowers:requesting-code-review`, `superpowers:receiving-code-review` | 지적·처리·미해결 영향 연결 |
| 완료 주장·commit·PR 전 | `superpowers:verification-before-completion` | 새 실제 검사 결과와 기존 완료 조건 1:1 확인 |
| 작업 격리·브랜치 마무리 | `superpowers:using-git-worktrees`, `superpowers:finishing-a-development-branch` | 저장소 소유권과 명시된 commit/push/merge 권한 보존 |

스킬을 전부 매번 로드하지 않는다. 적용되는 스킬은 반드시 읽고 수행하며, 적용되지 않는 단계나 사용자 지시로 조정된 절차는 이유를 기록한다. 이미 유효한 승인·설계·계획이 있으면 정확한 내용을 재사용하고 새 변경분이 무엇인지 확인한다. 동일 승인 질문을 매 턴 새로 만들지 않는다.

## Resume

컨텍스트 압축·AI 도구 변경·새 세션·실패 후 재개 시 canonical task와 최신 checkpoint를 먼저 복구한다. 완료된 단계와 실제 Git/검증 근거를 확인하고 미완료 단계부터 이어간다. Superpowers의 계획·진행 기록은 기존 task에 링크하고 두 번째 경쟁 상태 원장을 만들지 않는다. upstream이 별도 계획 파일이나 실행 ledger를 요구하면 해당 파일도 checkpoint에서 정확히 참조한다.

공개 하네스 자체의 개발 spec/plan/report는 바깥 관리 작업공간에 둔다. downstream에서는 프로젝트의 문서 소유 규칙을 따르며 domain truth는 `docs/design/`, 실행 방법과 기술 구조는 `docs/architecture/` 또는 해당 운영 문서에 둔다. 새 task/project/initiative 발급은 기존 하네스의 발급·승인 규칙을 따른다.

## Evidence

기존 checkpoint의 action/evidence/next-action 영역 또는 작업 문서에 다음을 남긴다. 별도 lifecycle enum이나 승인 영수증 형식을 만들지 않는다.

- 이번 목표·기존 task 및 계획 참조
- 실제 읽고 적용한 Superpowers 스킬 이름과 확인 가능한 버전(제공되지 않으면 unknown)
- 수행 결과, 실행한 검사와 결과, 리뷰 지적과 미해결 사항
- 사용자 지시로 조정한 단계와 그 근거
- 다음 행동, 담당자, 중단 이유 및 재개 위치

스킬 invocation 자체는 테스트 통과나 사람 승인의 근거가 아니다. 완료 전 원래 완료 조건과 실제 검증 결과를 확인하고, HTML Board 대상 원본이 변경되면 `human-view export`로 재생성한다.

## Adoption And Verification

## Upgrade Recommendations

초기 적용, 명시적 최신화 요청, 새 세션에서 기존 작업을 재개할 때 AI는 설치 receipt/lock의 하네스 버전과 실제 사용할 배포본, 현재 도구의 Superpowers 가용성을 확인한다. 매 턴 원격 조회를 반복할 필요는 없다. 최신 배포본을 확인하지 못했다면 최신 여부를 미확인으로 표시하고 업데이트가 있다고 단정하지 않는다.

다음 상황은 사용자가 먼저 묻지 않아도 권고한다.

| 확인된 상황 | 사용자에게 권할 내용 |
| --- | --- |
| 설치 버전이 확인된 최신 배포본보다 오래됨 | 현재/대상 버전, 주요 이점, 영향 범위를 설명하고 ownership-aware upgrade 계획·충돌 검토·적용·검증 제안 |
| 버전은 같지만 필수 지침·결합 guide가 빠졌거나 설치 검증이 실패함 | 누락/불일치 근거를 설명하고 migration 또는 설치 복구 계획 제안; 버전 문자열만으로 정상 판정하지 않음 |
| Superpowers 또는 필요한 스킬이 없음/비활성임 | 해당 Codex/Claude 환경의 공식 설치·활성화 방법과 설치 후 재개할 단계 안내 |
| 최신 여부를 확인할 수 없음 | 확인 불가 이유와 최신 배포본 비교 점검 제안 |

권고는 사용자의 언어로 현재 상태 → 권하는 조치 → 기대 효과와 영향 → 바로 사용할 요청 예시 순서로 짧게 전달한다. 예: “이 프로젝트에는 Superpowers 결합 지침이 아직 없습니다. 기존 문서와 승인 상태를 보존하는 upgrade 계획을 만든 뒤 충돌을 확인해 반영하는 것을 권합니다. ‘이 프로젝트의 document-harness를 최신 배포본과 비교하고 필요한 upgrade를 적용·검증해줘’라고 요청하시면 됩니다.” 플러그인 누락은 하네스 upgrade와 별개로 설명한다.

사용자가 이미 최신화/설치/적용을 요청했다면 그 승인 범위에서 수행하고 같은 작업을 다시 권하거나 재승인을 요구하지 않는다. 새 사람 결정이 필요한 충돌만 최소 범위로 확인한다. 단순 점검에서의 권고 자체를 설치·전역 설정 변경·원격 쓰기 권한으로 해석하지 않는다. 같은 버전·같은 누락에 대한 미수용 권고는 기존 checkpoint/근거를 재사용하고 상태 변경이나 명시적 재점검 요청이 없으면 반복 알림하지 않는다.

## Installation Verification

initialize/migrate/upgrade 계획에 Superpowers 가용성 확인을 포함한다. 하네스는 공용 integration guide와 필수 진입 지침을 배포하지만 upstream 플러그인 파일을 vendor하지 않는다. 프로젝트 소유 AGENTS/CLAUDE 변경은 기존 ownership-aware migration으로 합의된 부분만 반영한다. 기존 설치 프로젝트는 upgrade 계획과 충돌 검토 후 갱신한다.

`validate-codex-readiness.sh`는 배포된 지침·템플릿·guide·manifest 정합성을 검사한다. 이 정적 검증의 성공은 실행 호스트의 플러그인 설치나 실제 스킬 준수를 증명하지 않는다. AI 도구는 세션 preflight와 작업 근거로 그 부분을 별도 확인해야 한다.

## References

- [Superpowers upstream 및 도구별 설치 안내](https://github.com/obra/superpowers): 설치 환경별 활성화와 최신 원문 확인. 이 결합 계약은 7.0.1 스킬 세트를 기준으로 검토했으며, 특정 기기의 캐시 경로나 버전을 하드코딩하지 않는다. 업데이트 후에는 가용 스킬·도구별 reference·이 계약과의 충돌을 다시 확인한다.

- `docs/EXECUTE.md`: task/checkpoint 및 실행 orchestration 계약.
- `docs/ADOPT.md`: ownership-aware initialize/migrate/upgrade 계약.
