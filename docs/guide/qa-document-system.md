---
type: guide
title: qa-document-system
status: current
owner:
created: 2026-07-10
updated: 2026-07-15
source_refs: []
tags:
  - docs/guide
---

# qa-document-system

- Type: guide
- Status: current
- Created: 2026-07-10
- Updated: 2026-07-15

## Purpose

QA(테스트) 문서를 harness의 1급 통제 문서로 운영하는 규칙. 핵심 원칙은 하나다: **테스트는 기획·설계 문서에서 파생된다. 코드에서 역산해 만들지 않는다.** 테스트가 "코드가 지금 하는 일"을 단언하면 코드가 잘못돼도 green이다. 테스트는 "문서가 요구하는 계약"을 단언해야 하고, 그 계약의 출처와 추적성을 QA 문서가 보존한다.

## The Four QA Types

`./docs/bin/new-doc.sh qa <slug>` → `docs/qa/QA####-slug.md`. frontmatter `qa_type`으로 역할을 선언한다.

QA 번호도 task/project와 마찬가지로 clean, up-to-date `main`에서 발급하며, 생성된 draft를 즉시 commit해 번호를 예약합니다.

| qa_type | 역할 | 답하는 질문 |
| --- | --- | --- |
| `strategy` | 테스트 레벨(예: L1 순수 로직 ~ L6 실기기)·환경 정책·원칙 | "어떤 층위로, 어떤 원칙으로 검증하는가" — 결함 회고 시 "어느 레벨이 놓쳤나"의 기준 |
| `plan` | 스위트 구성·실행 주기·릴리스 게이트·위험 기반 우선순위 | "무엇을 언제 돌리고, 무엇이 출하 조건인가" |
| `cases` | **살아있는 케이스 카탈로그**: 계약↔자동화 테스트↔증거 추적표 + 방어 갭 백로그 | "이 불변식은 어느 테스트가 지키는가 / 알려졌지만 방어 없는 위험은 무엇인가" |
| `runbook` | 자동화가 못 덮는 검증 절차의 통제판(판정 기준·함정 포함) | "수동/반자동 검증을 누구든 동일하게 재현하려면" |

계층 관계(단방향 파생 사슬):

```
design (불변식·위험)  →  strategy (레벨·원칙)  →  plan (스위트·게이트)
                                                      ↓
                              cases (계약↔테스트↔증거 + 갭 백로그)
                                                      ↓
                              runbook (자동화 밖 절차)
```

## Derivation Rule (핵심 규칙)

1. `cases` 문서의 케이스는 **`Source Documents`에 나열된 문서의 변경, 또는 결함 task closeout에서만** 추가된다.
2. **신규 방어 테스트는 `cases`의 갭 백로그에서만 파생**된다 — "무작정 테스트 작성"을 구조적으로 차단한다.
3. 새 기능은 수용 케이스를 `cases`에 먼저 등재한 뒤 구현한다.

governance-sensitive work에서는 `Source Documents`의 effective design만 normative source로 사용하고 다음 trace를 한 행에 유지합니다.

```text
Policy Clause → Standard Rule → Task / Goal → Check → Evidence → Exception → Verdict
```

- proposal report는 승인된 normative design으로 승격되기 전까지 case의 의무 근거가 아닙니다.
- policy/standard는 `latest`가 아니라 exact version과 stable clause/rule ID를 pin합니다.
- exception은 base failure를 pass로 바꾸지 않고 `excepted` verdict, exception ID, expiry, compensating check를 남깁니다.

## Anti-Decay Mechanisms

문서 체계의 실패 모드는 부패다. 세 장치로 막는다:

1. **Validator 강제**: `validate-closeout.sh`가 qa 문서의 타입·어휘(qa_type, status: draft|current|retired)·필수 섹션(`Source Documents`/`Traceability`/`Maintenance Rules` 등)을 기계 검증한다. `--all`에 포함된다.
2. **갱신 트리거 명문화**: 각 qa 문서의 `Maintenance Rules`가 "언제 갱신해야 하는가"를 선언한다. 최소 규칙 — Source Documents의 design이 바뀌면 같은 변경에서 갱신, 관련 task가 닫히면 같은 커밋에서 케이스의 자동화/증거 컬럼 갱신, 갭 구현 시 백로그에서 본표로 승격.
3. **중복 금지**: 이미 진실인 실행 자산(시나리오 manifest, 체크리스트 등)은 참조만 한다. 같은 정보가 두 곳이면 한쪽은 반드시 썩는다.

## What Not To Add

- 별도 RTM(추적성 매트릭스) 문서: `cases`의 행에 내장한다. 분리하면 이중 관리가 된다.
- 회차별 테스트 리포트: 증거는 커밋·task Completion Evidence·케이스 증거 컬럼이 담당한다. 정말 필요해지면 qa_type 어휘를 확장한다(템플릿·validator·본 가이드를 같은 변경에서).
- 결함 로그: task 문서가 그 역할이다. `cases`는 task ID를 증거로 참조한다.

## Adoption Checklist

1. 프로젝트의 design 문서에서 불변식/위험이 식별돼 있는가 (없으면 design부터).
2. `new-doc.sh qa`로 strategy → plan → cases → (필요 시) runbook 순으로 발급.
3. 기존 일회성 테스트 문서(스냅샷)가 있으면 승계 표기를 남기고 `cases`로 이관.
4. task closeout 절차에 "관련 케이스 갱신"을 포함.

## Change Log

- 2026-07-10: 최초 작성 — DeepMusic 파일럿(재생 도메인, QA0001~0004)에서 검증된 체계를 일반화.
- 2026-07-15: QA 번호의 main-issued draft 규칙을 명시.
- 2026-07-15: policy-to-evidence traceability와 proposal/exception 판정 규칙을 추가.
