# document-harness

실전에서 검증된 문서 체계를 다른 프로젝트에서도 재사용할 수 있게 일반화한 하네스입니다.

이 하네스의 목표는 문서를 "설계 기준", "실행 단위", "운영 판단", "요청성 보고"로 분리하고, 각 문서가 서로를 참조하면서 프로젝트의 현재 truth와 실행 이력을 함께 유지하게 만드는 것입니다.

특히 `initiative`, `project`, `task`는 각각 outcome, delivery boundary, execution goal을 잠그고, 더 작은 하위 조각만 끝냈다는 이유로 상위 문서를 `done` 처리하지 않는 것을 기본 원칙으로 둡니다.

이 하네스에서 `design`은 DDD에 입각한 도메인 모델의 유일한 current-truth surface입니다. 고객·기획자·설계자·개발자·QA는 같은 bounded context, ubiquitous language, business rule, scenario ID를 역할별 관점으로 읽습니다. 전체 시스템 기술 구조는 `architecture`, 승인·정책 체계는 `governance`, portfolio outcome은 `initiative`, delivery와 실행은 `project`·`task`가 맡습니다.

사용자 화면과 대화에서는 initiative를 `추진안`이라고 부릅니다. canonical hierarchy는 `추진안(I####) → project(P####) → task(T####)`이며, 추진안은 정책과 지침 모두에 직접 연결합니다.

새 추진안은 사람이 exact 발급을 승인한 뒤에만 번호를 부여합니다. 기존 umbrella project는 호환 상태로 유지하며 자동으로 승인된 추진안으로 승격하거나 일괄 rewrite하지 않습니다.

핵심 진입점은 아래와 같습니다.

- `AGENTS.md`: Codex가 자동으로 읽는 repository-level agent instructions
- `CLAUDE.md`: `AGENTS.md`를 import해 같은 권한·검증 계약을 공유하는 Claude Code adapter
- `.agents/skills/operate-document-harness/`: 각 repository에 함께 설치되는 canonical project skill; adoption, execution, policy extraction, View operation을 durable docs로 route
- `.claude/skills/operate-document-harness/`: canonical project skill을 읽는 thin Claude adapter
- `docs/README.md`: 문서 체계, 발급 규칙, 업데이트 규칙
- `docs/ADOPT.md`: 새 저장소 초기화와 mature 저장소의 ownership-aware migration/upgrade 진입점
- `docs/EXECUTE.md`: loop-enabled task의 시작·재개·중단·closeout을 잇는 단일 실행 순서
- `docs/guide/harness-philosophy.md`: 원본 문서군에서 추출한 문서 철학
- `docs/guide/codex-agent-guidance.md`: Codex 친화적 AGENTS.md, prompt shape, validator 운영 규칙
- `docs/guide/project-cutting-and-execution.md`: 프로젝트 분할과 실행 게이트 규칙
- `docs/guide/concurrent-feature-hotfix-operation.md`: 병렬 feature와 배포 기준 hotfix를 별도 worktree로 보존하면서 main-issued 문서를 다루는 권장 운영 방식
- `docs/design/`: DDD 전용 domain landscape, context map, bounded-context model, ubiquitous language, executable examples
- `docs/guide/ddd-domain-design.md`: AI Domain Expert가 역할 AI의 의미를 통제하고 위임된 routine 변경을 관리하며 중요한 모델만 Board에 제시하는 계약
- `docs/governance/initiative-governance.md`: 정책·지침 → 추진안 → project/task 계층과 approval/legacy bridge 계약
- `docs/guide/initiative-governance.md`: 추진안 후보, human issuance/activation, 관계 작성과 migration 운영
- `docs/guide/goal-locked-completion.md`: goal lock, completion mode catalog, required evidence 규칙
- `docs/guide/umbrella-project-governance.md`: 기존 umbrella project adopter를 위한 compatibility/migration 규칙
- `docs/architecture/control-plane.md`: 전체 시스템 목표, pipeline, validator, quality axes를 고정하는 central control surface
- `docs/guide/artifact-contracts.md`: design / initiative / project / task / guide / report 간 책임과 handoff 계약
- `docs/guide/quality-axes.md`: project/task closeout과 review에 쓰는 품질 축
- `docs/guide/llm-wiki-operations.md`: source-backed ingest/query/lint와 markdown properties 운영 규칙
- `docs/architecture/retrieval-plane.md`: 규모 확장 시 hybrid retrieval, revision, freshness의 vendor-neutral 계약
- `docs/guide/hybrid-retrieval-and-freshness.md`: 증분 색인, read-your-writes, 삭제·rename, 복구 운영 절차
- `docs/_indexes/retrieval-policy.yaml`: downstream runtime이 읽을 machine-readable 검색 기본값
- `docs/governance/policy-to-evidence.md`: human policy, AI proposal, approval, exception, policy-to-evidence 권한 계약
- `docs/architecture/execution-loop-plane.md`: Execute checkpoint, attention, stop/resume, evidence barrier 계약
- `docs/architecture/human-control-view-plane.md`: Markdown/Git truth의 projector, snapshot API/SSE, freshness, security/runtime 계약
- `docs/architecture/harness-adoption-plane.md`: initialize/migrate/upgrade, file ownership, plan/apply fence, repo-local View와 quality handoff 계약
- `docs/guide/human-control-view.md`: local read-only 화면의 정보 구조와 사용자 운영 절차
- `docs/guide/repository-policy-extraction.md`: 기존 문서·설정·코드에서 사람이 검토할 정책/지침 후보를 추출하는 계약
- `docs/_indexes/execution-loop-policy.yaml`: loop state, risk gate, retry/stop, receipt의 machine-readable 기본값
- `docs/guide/qa-document-system.md`: QA 문서(전략/계획/케이스 카탈로그/런북) 운영 규칙 — 테스트는 기획·설계 문서에서 파생
- `docs/qa/`: current QA 문서의 human/retrieval entry surface
- `docs/initiatives/`: active `I####` 추진안의 human/retrieval entry surface
- `docs/architecture/harness-language.md`: 새 프로젝트에서 바로 채울 수 있는 용어 기준 문서
- `docs/examples/`: placeholder 대신 참고할 수 있는 완성형 예시 문서
- `docs/_templates/`: `AGENTS`, `CLAUDE`, `initiative`, `task`, `project`, `design`, `guide`, `report`, `qa` 템플릿
- `docs/bin/new-doc.sh`: 번호 발급 및 문서 생성 스크립트
- `docs/bin/validate-codex-readiness.sh`: Codex instruction surface와 핵심 validator를 함께 확인하는 스크립트
- `docs/bin/validate-harness-foundation.sh`: control-plane, quality axes, artifact contract 기본 구조를 검증하는 스크립트
- `docs/bin/validate-domain-design.sh`: DDD 문서 구조, stable ID, 역할 관점, 승인·freshness 경계를 검증하는 스크립트
- `docs/bin/validate-domain-lineage.sh`: project/task/QA가 영향받는 bounded context와 승인된 model·rule·scenario를 추적하는지 검증하는 스크립트
- `docs/bin/validate-domain-supervision.sh`: AI Domain Expert review가 current delivery·model·implementation exact bytes를 감독하고 unresolved 사람 결정·충돌을 closeout에서 막는지 검증하는 스크립트
- `docs/bin/validate-closeout.sh`: `done` 전환 전 목표 달성 여부를 검증하는 스크립트
- `docs/bin/close-doc.sh`: 검증을 통과한 Project/Task만 `done`으로 닫고, coordinated document/register/receipt workflow 전에는 Initiative 종료를 거부하는 스크립트

## Quick Start

### Public Distribution Source

`initiative`, `project`, `task` 문서 발급은 번호 충돌을 막기 위해 clean, up-to-date `main`에서 실행합니다. `new-doc.sh`는 생성된 `draft` 파일만 즉시 `main`에 commit합니다. Initiative 발급에는 exact human issuance-approval ref가 추가로 필요합니다.

```bash
./docs/bin/new-doc.sh initiative service-resilience DECISION-EXAMPLE
# Complete human activation review; project issuance requires I0001 to be active and approved.
./docs/bin/new-doc.sh project example-project I0001
# Task issuance verifies P0001 resolves to an active, approved initiative.
./docs/bin/new-doc.sh task first-task P0001
./docs/bin/new-doc.sh qa first-test-strategy
# Fill required QA fields and commit numbered drafts before creating unnumbered drafts.
./docs/bin/new-doc.sh design bounded-context core domain-model
./docs/bin/new-doc.sh design ubiquitous-language core ubiquitous-language
./docs/bin/new-doc.sh design domain-examples core examples
./docs/bin/validate-codex-readiness.sh
./docs/bin/validate-harness-foundation.sh
./docs/bin/validate-harness-adoption.sh
./docs/bin/validate-doc-retrieval.sh
./docs/bin/validate-domain-design.sh --all
./docs/bin/validate-domain-lineage.sh --all
./docs/bin/validate-domain-supervision.sh --all
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
```

위 명령은 예시입니다. `DECISION-EXAMPLE`은 실제 human decision ref로 교체해야 하며, initiative와 project 생성은 사람의 명시적 요청 또는 승인 하에서만 실행합니다.

한글 slug도 허용됩니다. 예: `./docs/bin/new-doc.sh task "첫 작업" P0001`.

`validate-codex-readiness`, `validate-harness-foundation`, `validate-harness-adoption`, `validate-doc-retrieval`은 이 public distribution source의 전체 문서·release surface를 검증합니다. adopted target에 이 public-repository 전용 validator가 설치된다고 가정하지 않습니다.

### Adopted Repository

새 저장소에 처음 적용한다면 repository-local `operate-document-harness` skill과 authoring core를 full profile로 initialize하고 `docs/architecture/harness-language.md`를 실제 프로젝트 용어로 채웁니다. public distribution을 직접 살펴보는 경우에만 `docs/examples/`를 참고하며, adopted target의 authoring workflow는 examples에 의존하지 않습니다. 이미 AGENTS, design, task, validator가 있는 mature 저장소에는 최신 파일을 단순 복사하지 말고 먼저 `docs/ADOPT.md`의 no-write migration plan을 사용합니다. 이 workflow skill은 user-global 위치에 설치하지 않습니다.

full-profile adoption은 다음 reusable authoring command와 그 template/reference/validator closure를 target에 함께 설치합니다.

```bash
./docs/bin/new-doc.sh initiative service-resilience DECISION-EXAMPLE
# Complete human activation review; project issuance requires I0001 to be active and approved.
./docs/bin/new-doc.sh project example-project I0001
# Task issuance verifies P0001 resolves to an active, approved initiative.
./docs/bin/new-doc.sh task first-task P0001
./docs/bin/new-doc.sh qa first-test-strategy
# Fill required QA fields and commit numbered drafts before creating unnumbered drafts.
./docs/bin/new-doc.sh design bounded-context core domain-model
./docs/bin/new-doc.sh design ubiquitous-language core ubiquitous-language
./docs/bin/new-doc.sh design domain-examples core examples
./docs/bin/validate-domain-design.sh --all
./docs/bin/validate-domain-lineage.sh --all
./docs/bin/validate-domain-supervision.sh --all
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
./docs/bin/harness-adopt verify --target .
```

새 프로젝트로 초기화한 뒤에는 아래 순서를 권장합니다. mature 저장소는 이 순서에 앞서 ownership inventory, policy/guideline extraction, human conflict review를 수행합니다.

1. `docs/architecture/control-plane.md`와 `docs/architecture/harness-language.md`의 placeholder를 실제 프로젝트 기준으로 교체합니다.
2. 정책과 지침을 정돈하고, AI proposal과 human approval을 분리해 첫 `I####` 추진안을 발급합니다.
3. 승인된 추진안 아래에 bounded delivery `project`를 발급합니다.
4. 별도의 source-backed DDD 모델링 작업에서 `docs/design/domain-landscape.md`와 `docs/design/context-map.md`의 bounded context를 정하고, 각 context에 domain model·ubiquitous language·executable examples를 함께 작성합니다. Board operation은 `docs/design/`을 만들거나 수정하지 않고 이 원문만 투영합니다. AI Domain Expert는 routine 변경을 exact delegation 안에서 관리하고, 중요한 변경은 사람이 읽을 최소 충분 모델링 수준의 Board package로 `review_requested` 상태에 둡니다.
5. source를 누적하는 프로젝트라면 원문을 불변으로 둘 `raw/` 또는 `sources/` 위치를 정하고, 생성 문서의 `source_refs` property로 연결합니다.
6. 실제 실행 단위는 현재 project 아래 `task`로 수용하되, 번호 발급은 `main`에서 수행합니다.
7. 별도 delivery boundary가 명확하고 사람이 승인할 때만 새 `project`를 발급하고, 왜 task가 아닌지 먼저 남깁니다.
8. exact policy/normative rule뿐 아니라 affected bounded context, approved domain model revision, business rule ID, scenario ID를 project/task/QA에 계속 연결합니다.
9. `project`와 `task`는 지원되는 `Completion Mode` 중 하나를 선택하고, whole-system anchor와 quality axes를 명시합니다. 대부분의 경우 기본값인 `functional`을 유지합니다.
10. loop-enabled task는 현재 checkpoint, next actor/action, attention, evidence receipt를 외부화합니다.
11. 새 문서는 YAML frontmatter properties와 첫 화면 bullet metadata를 함께 유지합니다.
12. Codex가 바로 읽어야 하는 프로젝트라면 루트 `AGENTS.md`를 실제 repo 기준으로 조정하고 `.agents/skills/operate-document-harness/`를 project-local로 유지합니다. Claude Code도 운영한다면 `.claude/skills/operate-document-harness/`와 `docs/_templates/claude.md`의 thin adapters로 같은 canonical 규칙을 위임합니다.
13. 현재 session 중 skill이 처음 설치됐다면 canonical `SKILL.md`를 직접 읽어 계속하고, 자동 discovery에 의존하기 전 새 session 또는 repository reload를 수행합니다.
14. `./docs/bin/validate-domain-design.sh --all`, `./docs/bin/validate-domain-lineage.sh --all`, `./docs/bin/validate-domain-supervision.sh --all`, `./docs/bin/validate-execution-loop.sh --all`, `./docs/bin/harness-adopt verify --target .`로 installed domain/execution/release surface를 확인합니다.
15. `done` 전환 전에는 `./docs/bin/validate-closeout.sh --all`을 통과시키고, Project/Task는 가능하면 `./docs/bin/close-doc.sh`로 닫습니다. Initiative는 canonical 문서·register·exact terminal human decision receipt를 같은 변경 셋으로 갱신하고 validator를 다시 실행합니다.

## Closeout Gate

이 하네스는 `done`을 자유 서술 메타데이터가 아니라 문서 내부 목표와 증빙을 통과한 결과로 다루는 것을 권장합니다.

```bash
./docs/bin/validate-codex-readiness.sh
./docs/bin/validate-harness-foundation.sh
./docs/bin/validate-harness-adoption.sh
./docs/bin/validate-doc-retrieval.sh
./docs/bin/validate-domain-design.sh --all
./docs/bin/validate-domain-lineage.sh --all
./docs/bin/validate-domain-supervision.sh --all
./docs/bin/validate-execution-loop.sh --all
./docs/bin/validate-closeout.sh --all
./docs/bin/close-doc.sh docs/tasks/T0001-first-task.md "issued goals and evidence verified"
```

`close-doc.sh`는 Initiative를 Markdown만 `done`으로 바꾸지 않도록 fail closed 합니다. Initiative 종료는 사람의 exact terminal decision을 근거로 canonical 문서, `docs/_indexes/initiative-register.json`, decision receipt를 같은 변경 셋에서 갱신한 뒤 `validate-closeout.sh <initiative-path>`와 `validate-closeout.sh --all`로 확인합니다.

GitHub를 쓰는 경우에는 위 검증 명령을 repository의 CI 또는 pre-push gate에 명시적으로 연결해 PR과 push에서 다시 확인합니다. 이 저장소는 특정 CI provider의 workflow를 기본 설치하지 않습니다.

## License

MIT. 자세한 내용은 `LICENSE`를 봅니다.
