# Document Harness Reference View

This directory is the versioned, harness-managed reference distribution for one repository's Human Control View. It is copied as a unit; an adopter does not regenerate its design.

Reference View distribution version: `1.0.0`. The public release manifest pins the byte hashes for this complete tree.

## Installed surfaces

- `bin/human-view`: safe operator entrypoint
- `control.mjs`: start/status/url/refresh/test/stop control
- `lib/projection.mjs`: catalog, source, migration-fence, checkpoint, and torn-input-safe runtime projection
- `lib/process-identity.mjs`: OS process start identity plus exact managed command/start-token verification
- `lib/runtime-state.mjs`: repository-contained state directory and self-ignoring marker enforcement
- `server.mjs`: exact-loopback, read-only HTTP runtime with OS-assigned port
- `public/`: same-origin HTML, CSS, and JavaScript for the canonical five-tab page
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

- static project identity and description
- repository-relative governance catalog and its source refs
- allowlisted credential-free loopback HTTP probes
- declared fast/full/continuous quality commands

The execution checkpoint path (`docs/_indexes/execution-checkpoint.json`), runtime state/probe paths, polling/reconciliation intervals, loopback bind, and OS-assigned port policy are versioned distribution constants. A missing checkpoint is shown as `not configured`; a project cannot redirect these internal paths through config.

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

`baseCommit` must resolve to a commit in the installed repository. A missing object or a receipt revision mismatch degrades the View and creates review attention. A later current `HEAD` is reported as advanced but does not make unchanged source hashes stale. `migrationFence`, `currentRepository`, and per-source evidence freshness remain separate snapshot fields.

## Presentation and capability contract

- one independent server and static repository identity
- exact horizontal tabs: `Overview`, `Policies & Guidelines`, `Review Queue`, `Execution Status`, `Evidence`
- no repository selector, workspace switcher, or persistent left sidebar
- same immutable snapshot and read fence across all tabs
- governance catalog and source hashes are rechecked before snapshot publication; torn reads retry and then fail degraded
- tab/search/filter/pagination/expanded-row state survives polling and manual refresh
- missing checkpoint/action/budget inputs display `not configured`; progress is never inferred
- local same-origin assets only; no CDN, remote font, external script, or image
- `GET`, `HEAD`, and `OPTIONS` only; mutation, execution, and approval are false
