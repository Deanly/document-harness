# project-cutting-and-execution

- Type: guide
- Created: 2026-04-10
- Updated: 2026-04-10

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

새 `project`는 아래 중 대부분이 참일 때 발급합니다.

- 새로운 bounded responsibility가 생겼다.
- 목적을 한 문단으로 분명하게 설명할 수 있다.
- Scope와 Out Of Scope를 쓸 수 있다.
- 이후 `task`로 분해 가능한 work surface가 보인다.
- 기존 project의 연장선이 아니라 별도 종료 기준이 필요하다.

대표적인 트리거:

- runtime/environment phase가 완전히 달라질 때
- downstream 또는 upstream boundary가 새로 열릴 때
- 운영 적용 단계가 기존 bootstrap 단계와 다른 성공 기준을 가질 때

## Project Cutting Rules

- project는 기술 스택이 아니라 책임 경계로 자릅니다.
- 구현 준비 단계와 현장 검증 단계의 성공 조건이 다르면 project 분리를 검토합니다.
- 후속 시스템이 아직 설계되지 않았다면 "다음 project 후보"로만 남기고 현재 project에 포함시키지 않습니다.
- project 문서의 WBS는 실제 `task` 문서와 1:1 대응시키는 것을 기본으로 합니다.

## Task Slicing Rules

좋은 `task`는 아래를 만족합니다.

- 독립 목적이 있다.
- 완료 기준이 검증 가능하다.
- 설계 문서와 연결된다.
- 너무 크지 않아 Status와 WBS가 실제 진행을 설명할 수 있다.

작업을 `task`로 자를 때는 아래 순서를 권장합니다.

1. boundary 또는 contract를 고정하는 slice
2. 실제 데이터를 만나는 reality-check slice
3. parser, normalization, persistence 같은 정렬 slice
4. end-to-end cycle 또는 운영 baseline slice

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

## Exit Criteria

project나 task를 닫을 때는 종료 기준이 필요합니다.

좋은 종료 기준의 특징:

- 실제 검증 관점이다.
- 증빙 가능한 결과를 요구한다.
- 단순 구현 완료가 아니라 동작/관찰/기록까지 포함한다.
- 후속 project로 넘길 잔여 범위를 명시한다.

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
