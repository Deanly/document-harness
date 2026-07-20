---
type: guide
title: repository-policy-extraction
status: current
owner:
created: 2026-07-15
updated: 2026-07-17
related_design:
  - docs/design/harness-adoption-plane.md
  - docs/design/policy-to-evidence-governance.md
  - docs/design/human-control-view-plane.md
tags:
  - docs/guide
  - governance
  - policy
  - migration
---

# repository-policy-extraction

## Purpose

이 guide는 기존 repository의 문서·설정·코드에서 사람이 검토할 policy/guideline 후보를 추출하고, 승인·effective authority와 혼동하지 않게 View data로 준비하는 절차를 고정합니다.

## Core Rule

```text
what the source says
  != how confidently AI summarized it
  != who has authority
  != whether a human approved it
  != whether code enforces it
```

다섯 질문을 한 상태 값으로 합치지 않습니다.

## Source Priority

### Primary Discovery

1. root/nested `AGENTS.md`, security/policy instructions
2. human-policy 또는 normative-standard governance design
3. status `current`인 control-plane/domain design
4. approved operator/security guide

### Corroboration

5. root README, architecture entry
6. CI, Compose, environment example, registry/config schema
7. validator와 versioned test fixture

### Evidence Only

8. code and tests
9. active task and execution receipt
10. completed task/report and historical source

### Avoid By Default

- template placeholder
- generated index/cache/snapshot
- raw/private source not requested for governance
- `.env`, credential file, token, secret value, key material과 개인 절대경로
- vendored dependency and build output
- broad RAG search result without direct source confirmation

Secret-bearing source는 catalog에 path, hash 또는 body를 복제해 "근거"로 만들지 않습니다. 안전한 repository instruction/security design이 그 경계를 설명하면 해당 문서를 source로 사용하고, 그런 authority source가 없으면 `gaps`/attention에 안전한 설명만 남깁니다. secret을 읽거나 저장해야만 후보를 만들 수 있다면 extraction을 중단합니다.

## Extraction Workflow

### 1. Protect And Inventory

- record target repository revision, dirty status, instruction scope and current runtime health
- require a full captured base commit that resolves in the target before governance initialization; an unborn repository must first create an initial commit
- read direct source before RAG/search projection for recently changed files
- list current designs, active task, security/ops config, validators and tests
- identify generated/historical files so they cannot become authority by accident

### 2. Discover Statements

Look for:

- MUST/SHOULD/MUST NOT language
- invariant, boundary, out of scope, guardrail
- operator-only or approval-required action
- data/network/security restriction
- quality/verification/closeout gate
- architecture choice that is explicitly current
- repeated code/config behavior that may indicate an observation

Do not normalize wording yet. Capture exact repository-relative path, heading, line span, file SHA-256, captured repository commit and dirty status.

### 3. Classify Kind And Authority

```text
policy       human outcome or non-waivable boundary
standard     approved normative rule implementing policy
guideline    recommended operational/implementation method
constraint   scoped prohibition, budget, compatibility boundary
observation  current code/config behavior
proposal     AI-authored change requiring review
```

Authority class:

```text
repository-instruction
human-policy
normative-standard
current-design
approved-guide
task-or-receipt
report-or-history
config-observation
code-observation
unknown
```

### 4. Synthesize Human Wording

For each candidate write:

- title: short decision phrase
- human summary: what a non-specialist should understand
- why: protected outcome
- scope: where it applies
- related guideline: how it is implemented
- current enforcement: enforced, partially enforced, advisory, not implemented, unknown
- risk/conflict: mismatch or missing decision

기본 표시 언어는 configured `presentation.locale`입니다. `direction`, `title`, `humanSummary`, `why`, `scope`, `risk`, attention/gap 문구, `approvalRule`, source-reference `note`와 자유 서술 `evidenceKind` label은 비전문가가 바로 판단할 수 있는 사용자 표시 언어로 합성합니다. 영어 source를 요약해도 technical ID, enum, repository-relative path, revision/hash, command, exact source heading과 quote는 원형을 보존합니다. exact source와 user-language 설명을 같은 값인 것처럼 섞지 않습니다.

Do not hide technical gaps behind softened wording. 번역은 표현만 바꾸는 derived projection이며 source 의미, authority, approval, enforcement 또는 evidence를 바꾸는 수단이 아닙니다.

### 5. Corroborate Enforcement

- instruction/design tells what should be true
- config/code/test tells what is observed or enforced
- runtime receipt tells what was verified at one revision/environment

Use at least one authority source for a policy candidate and separate enforcement evidence where available. Code alone remains observation unless a human source promotes it.

### 6. Detect Conflict And Drift

Expose:

- current design and active index disagree
- policy requires behavior code does not enforce
- code enforces a restriction no source owns
- source hash changed after review/approval
- retrieval authority label is mistaken for governance approval
- operational rollback or verification is absent

Conflicts become attention, not arbitrary winner selection.

### 7. Publish Candidate Projection

Use `docs/schemas/governance-catalog.schema.json`. The top-level migration fence is nested and separate from each candidate's file evidence:

```json
{
  "schemaVersion": 1,
  "migration": {
    "status": "awaiting_human_review",
    "capturedRepository": {
      "baseCommit": "0123456789abcdef0123456789abcdef01234567",
      "workingTreeState": "dirty"
    },
    "capturedAt": "2026-07-16T00:00:00Z",
    "approvalRule": "AI가 추출한 후보는 출처에 연결된 사람의 결정 영수증이 존재하기 전까지 승인되지 않은 상태로 유지됩니다."
  },
  "direction": [],
  "policies": [],
  "guidelines": [],
  "attention": [],
  "gaps": []
}
```

Minimum candidate shape:

```json
{
  "id": "POL-001",
  "kind": "policy",
  "title": "짧은 결정 문구",
  "humanSummary": "비전문가가 이해해야 할 핵심 설명입니다.",
  "why": "보호하려는 결과",
  "scope": "적용되는 범위",
  "risk": "알려진 공백 또는 충돌",
  "authorityClass": "current_design",
  "authorityState": "proposed",
  "approvalState": "unreviewed",
  "enforcement": "partially_enforced",
  "confidence": "high",
  "effectiveRef": null,
  "decisionReceiptRef": null,
  "sourceRefs": [
    {
      "path": "docs/design/control-plane.md",
      "heading": "Invariants",
      "lineStart": 10,
      "lineEnd": 18,
      "capturedSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "capturedRepositoryRevision": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    }
  ],
  "conflicts": []
}
```

`policies`와 `guidelines`는 같은 candidate schema를 사용합니다. guideline은 `policyRefs`로 관련 policy ID를 연결할 수 있습니다. code/config source에서만 얻은 항목은 반드시 `kind: observation`, `authorityClass: code_observation|config_observation`, `approvalState: unreviewed`, `effectiveRef: null`, `decisionReceiptRef: null`입니다.

### 8. Validate Migration And Source Fences

- `migration.capturedRepository.baseCommit`은 exact 40-character commit이고 target Git object로 resolve되어야 합니다.
- optional `migration.receiptRef`가 있으면 receipt captured revision이 migration base와 일치해야 합니다.
- 각 source ref의 `capturedRepositoryRevision`은 extraction 당시 commit을, `capturedSha256`은 exact source bytes를 고정합니다.
- current HEAD가 나중에 이동했다는 사실은 별도 current-repository observation입니다. unchanged source hash를 stale로 만들지 않습니다.
- current source SHA-256이 captured value와 다르면 관련 candidate review/approval은 stale입니다.
- missing/escaped source나 invalid/contradictory migration fence는 degraded attention이며 fresh로 표시하지 않습니다.

기존 catalog의 영어 human-facing field를 사용자 표시 언어로 바꿀 때는 stable candidate/attention/gap ID, kind/enum, source ref와 hash, authority/approval/enforcement, effective ref와 decision receipt를 그대로 유지합니다. 번역 전후 의미가 다르거나 정책 범위를 넓히는 경우에는 단순 localization으로 처리하지 않고 새 candidate 또는 human review attention으로 분리합니다.

### 9. Human Review And Promotion

Allowed review outcomes:

```text
correct wording
reject
defer
approve for promotion
approve exception
request more evidence
```

Human response becomes durable `human-policy-decision-receipt` fenced to candidate ID, catalog `migration.capturedRepository.baseCommit`, source hashes, exact `effectiveRef`, and the effective artifact's `effectiveSha256`. Only then may an effective governance design be created or updated. 승인 상태는 receipt와 현재 effective artifact bytes가 receipt의 digest와 일치하기 전에는 `approved`로 바꾸지 않습니다.

catalog review를 닫으려면 `migration.status: reviewed`와 `migration.receiptRef`를 설정하고, 해당 receipt는 `candidateId: CATALOG-REVIEW`, decision `approved|exception_accepted`, catalog migration base, exact current catalog bytes SHA-256을 포함해야 합니다. code/config observation은 계속 `unreviewed`로 남고, 다른 policy/guideline candidate는 각각 `approved|rejected` 상태와 ID/source-hash가 일치하는 decision receipt를 가져야 합니다. 이후 harness upgrade의 quality gate와 migration evidence pack은 별도로 installation lock의 새 `targetSourceRevision`을 사용하며, unchanged catalog decision을 새 HEAD로 위조하거나 재작성하지 않습니다.

required quality gate evidence는 단순 text file이 아니라 schema version, gate ID/result, command/exit code, target/release revision과 observed time을 가진 JSON receipt입니다. migration evidence pack은 각 `evidenceRef`와 `evidenceSha256`을 함께 pin합니다.

Chat text, View badge or AI-authored `approved: true` is not enough.

## State Model

```text
discovered
  -> candidate
  -> proposed
  -> accepted_for_promotion
  -> effective
  -> superseded

candidate/proposed
  -> rejected | deferred

any reviewed state + source hash change
  -> stale
```

Existing current design can be reported as an existing repository rule, but the extraction migration itself must say whether that current status is inherited source truth or a new human approval. Do not rewrite history.

## View Requirements

The first human screen should show:

- project direction in plain language
- candidate/effective/approved counts separately
- policy card with why, scope, authority, approval and enforcement
- related guidelines
- exact source path/line/hash freshness
- critical gaps and conflicts
- repository revision/dirty state and latest verification

이 항목은 repository별 독립 View의 `single-repository-top-tabs-v2` profile에 다음처럼 배치합니다.

- top bar: 스크롤 중에도 유지되는 `<displayName> / <repository>`, revision/dirty, snapshot/freshness, local-only/read-only
- `개요`: product direction, count summary, critical gap와 latest verification
- `정책`: policy candidate/effective/approved count, policy row, related guideline, authority/approval/enforcement와 exact provenance
- `지침`: guideline candidate/effective/approved count, guideline row, related policy, authority/approval/enforcement와 exact provenance
- `검토 대기`: conflict, missing decision, stale review/approval와 exact requested action
- `실행 상태`: current task/checkpoint/quality receipt 또는 source가 없다는 explicit gap
- `근거`: source hash, config/code observation, test/validator와 decision/approval receipt

repository selector와 left sidebar는 제공하지 않습니다. 정책과 지침은 서로의 stable ID를 양방향으로 연결하지만 각각 독립 search/filter/pagination/detail을 제공합니다. 모든 tab은 같은 snapshot/read fence를 사용하며 polling/manual refresh가 active tab, tab별 filter/search/pagination과 expanded policy/guideline을 초기화하지 않습니다.

policy/guideline/attention ID는 제목보다 낮은 위계의 보조 metadata로 표시합니다. 긴 ID, path와 hash는 자신의 cell 또는 detail 안에서 줄바꿈해 인접 field와 겹치지 않아야 하며 원문 복사 가능성은 유지합니다.

The View must not render arbitrary Markdown HTML, load external CDN/font/script assets or offer mutation endpoints in v1.

## Quality Checks

- every candidate has exact provenance
- synthesized human-facing field와 project description은 기본 configured `presentation.locale`이고 exact technical/source value는 원형이다
- localization은 stable ID, authority, approval, enforcement와 evidence/source fence를 변경하지 않는다
- every migration has nested `capturedRepository` and a resolvable base commit
- dirty source is not presented as committed clean evidence
- confidence, authority, approval and enforcement are independent
- code/config behavior is observation unless promoted
- secret/private source content, credential, token and personal absolute path are absent
- AI candidate has no effective ref before approval
- source change makes review/approval stale
- current HEAD movement without source hash movement does not make evidence stale
- conflicting statement is visible attention
- high-availability or other attractive policy is not invented when current scope says otherwise
- first projection identifies the repository statically and never invites cross-repository selection
- `<displayName> / <repository>` identity stays visible in every tab and scroll position
- policy count, guideline count, review queue, execution gap and evidence use one snapshot/read fence
- policy and guideline tabs expose reciprocal relationships with independent search/filter/pagination/detail state
- periodic update preserves the human's active tab, filters, search and expanded policy/guideline
- long ID/path/hash stays contained inside its own cell or detail and never overlaps adjacent content

## Skill Packaging

Install `operate-document-harness` with document-harness inside each target repository:

- canonical workflow router: `.agents/skills/operate-document-harness/SKILL.md`
- thin Claude project adapter: `.claude/skills/operate-document-harness/SKILL.md`
- durable authority and details: target `AGENTS.md`, `docs/ADOPT.md`, this guide, governance designs, extractor/schema and validators

The skill routes work to these repository-specific sources. It does not contain extracted policy truth, approve candidates, weaken deterministic gates, or replace project instructions.

Do not install this workflow as a user-global skill. When it is first added during an active session, direct-read the canonical file and reload the repository or start a new session before relying on automatic discovery.

## Change Log

- 2026-07-15: source priority, candidate/authority/approval/enforcement separation, conflict detection, View projection과 human promotion workflow를 생성했다.
- 2026-07-16: policy extraction을 repository-local canonical skill과 thin Claude adapter로 route하고 user-global install을 금지했다.
- 2026-07-16: extracted governance를 static repository identity와 exact five top tabs에 배치하고 cross-tab fence와 reading-state continuity를 고정했다.
- 2026-07-16: flat candidate example을 executable governance-catalog schema로 교체하고 nested migration fence, observation-only code/config, secret exclusion과 source-hash stale rule을 명시했다.
- 2026-07-17: configured `presentation.locale` human wording, technical provenance 원형 보존, presentation-only localization과 긴 ID containment 규칙을 추가했다.
- 2026-07-17: `Board` displayName 기반 이름과 정책/지침 독립 tab 및 양방향 관계 표시를 extraction handoff에 추가했다.
