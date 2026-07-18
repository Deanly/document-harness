# 보드 — Document Harness Reference View

This directory is the versioned, harness-managed reference distribution for one repository's Human Control View. Its fixed user-facing name is `보드`; the technical executable remains `human-view` for compatibility. It is copied as a unit; an adopter does not regenerate its design.

Reference View distribution version: `1.3.0`. The public release manifest pins the byte hashes for this complete tree.

## Installed surfaces

- `bin/human-view`: safe operator entrypoint
- `control.mjs`: start/status/url/refresh/test/stop control
- `lib/projection.mjs`: catalog, source, approval-receipt, migration-fence, canonical Markdown checkpoint, and torn-input-safe runtime projection
- `lib/process-identity.mjs`: OS process start identity plus exact managed command/start-token verification
- `lib/runtime-state.mjs`: repository-contained state directory and self-ignoring marker enforcement
- `server.mjs`: exact-loopback, read-only HTTP runtime with OS-assigned port
- `public/`: same-origin HTML, CSS, and JavaScript for the canonical seven-tab page
- `test/`: focused projection, server, control, and view-model regression tests

The initializer renders `runtime/document-harness-view/config.json` as a project-specific generated file. Do not copy `config.example.json` over an existing generated config. The example documents the schema; it is not an installation identity or a runnable placeholder.

Runtime-local state is written only below `.document-harness/runtime/view/` by default. Before lease, snapshot, log, or probe bytes are written, the runtime creates and verifies an exact self-ignoring `.gitignore` marker there. Rebuildable View state therefore does not dirty a repository whose root has no ignore rule. A foreign, changed, or symlinked marker fails closed instead of being overwritten, and a marker is not created over unknown pre-existing directory entries. Only named legacy View state may be adopted.

## Commands

```bash
./runtime/document-harness-view/bin/human-view doctor
./runtime/document-harness-view/bin/human-view refresh
./runtime/document-harness-view/bin/human-view snapshot
./runtime/document-harness-view/bin/human-view start
./runtime/document-harness-view/bin/human-view status
./runtime/document-harness-view/bin/human-view url
./runtime/document-harness-view/bin/human-view stop
./runtime/document-harness-view/bin/human-view test
```

`start` binds exactly `127.0.0.1` and asks the OS for an available port. `stop` sends `SIGTERM` only when the lease, repository fingerprint, instance identity, live health response, OS process start marker, exact server command, and one-time start token agree. It never kills a foreign process to reclaim a port. Loopback probes do not follow redirects and discard responses over 64 KiB before persistence.

## Project-specific config

Only these values vary by repository:

- static project identity and Korean (`ko-KR`) human-facing description
- repository-relative governance catalog and its source refs
- allowlisted credential-free loopback HTTP probes
- declared fast/full/continuous quality commands

The execution checkpoint root (`docs/checkpoints/`), runtime state/probe paths, polling/reconciliation intervals, loopback bind, and OS-assigned port policy are versioned distribution constants. The projector derives candidates only from loop-enabled `docs/tasks/T*.md` `checkpoint_ref` values, requires task ID/revision/lifecycle/loop mirrors, linked-task source hash/revision, budget semantics, and checkpoint execution barriers to agree, and ignores orphan checkpoint files. A `succeeded` checkpoint additionally requires each evidence and receipt ref to resolve to a safe non-empty repository regular file. Each receipt must carry canonical identity/task/checkpoint/actor/time/scope/statement fields, bind the linked-task source revision/hash, and link the checkpoint evidence; all task/checkpoint/support bytes are rechecked before publication. It rejects symlinks or malformed frontmatter. Selection prioritizes active/blocked non-succeeded work, then active closeout, draft work, and historical terminal tasks; each group is ordered by `recorded_at`, `attempt_seq`, `checkpoint_seq` descending and path ascending. A missing checkpoint is shown to the user as `구성되지 않음`; a project cannot redirect these internal paths through config.

An item is projected as `approved` or `effective` only when every source ref has a complete repository revision/hash/line fence, all current bytes still match, and safe in-repository regular files provide both the effective ref and a matching human decision receipt. The receipt must bind the candidate ID, human actor, decision time, repository revision, every source hash, the exact effective ref, and its `effectiveSha256`; the current effective artifact bytes must still match that digest. Missing, private, symlinked, stale, or mismatched evidence fails closed.

The View does not run quality commands. It only displays their declarations and read-only receipts/probes.

## Governance migration fence

The governance catalog records the historical capture independently from current repository state:

```json
{
  "migration": {
    "status": "awaiting_human_review",
    "capturedRepository": {
      "baseCommit": "a full resolvable Git commit object id",
      "workingTreeState": "clean"
    },
    "receiptRef": "docs/receipts/migration.json"
  }
}
```

`baseCommit` must resolve to a commit in the installed repository. A reviewed migration additionally requires a safe human decision receipt for `CATALOG-REVIEW` whose source/effective SHA-256 equals the current catalog bytes; that receipt is part of the torn-input recheck. A missing object or mismatched decision degrades the View and creates review attention. A later current `HEAD` is reported as advanced but does not make unchanged source hashes stale. `migrationFence`, `currentRepository`, and per-source evidence freshness remain separate snapshot fields.

## Presentation and capability contract

- one independent server and static repository identity
- fixed top-left identity `보드 / <repository>`, visible across every tab and scroll position; `보드` is not repository-configurable
- exact horizontal tabs: `개요`, `정책`, `지침`, `추진안`, `검토 대기`, `실행 상태`, `근거` (internal route/hash keys remain stable English identifiers)
- policy and guideline are independent first-class surfaces with reciprocal related-item links and separate search/filter/pagination/expanded state
- Korean (`ko-KR`) UI chrome and synthesized project/governance wording by default; technical IDs, enum values, paths, hashes, commands, exact source headings, and exact quotes remain unchanged
- translation is presentation-only and never changes meaning, authority, approval, enforcement, evidence freshness, source refs/hashes, effective refs, or decision receipts
- IDs and source refs are secondary metadata; long unbroken values wrap inside their own cell/card and never overlap adjacent titles or status content
- no repository selector, workspace switcher, or persistent left sidebar
- same immutable snapshot and read fence across all tabs
- governance catalog and source hashes are rechecked before snapshot publication; torn reads retry and then fail degraded
- degraded fallback keeps prior records only as `lastKnown`, marks governance/evidence/execution unverified, and never carries green approval counts forward as current truth
- tab/search/filter/pagination/expanded-row state survives polling and manual refresh
- missing checkpoint/action/budget inputs display `구성되지 않음`; progress is never inferred
- local same-origin assets only; no CDN, remote font, external script, or image
- `GET`, `HEAD`, and `OPTIONS` only; mutation, execution, and approval are false
