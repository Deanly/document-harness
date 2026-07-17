# Adoption release acceptance

The release gate is intentionally deterministic and does not install packages or browsers while it runs.

Bootstrap a fresh checkout once with the pinned lockfile:

```bash
npm --prefix tests/adoption ci
npm --prefix tests/adoption run setup:browser
```

Then run the complete release acceptance from the repository root:

```bash
./tests/adoption/run-all.sh
```

Set `DOCUMENT_HARNESS_ACCEPTANCE_QUIET=1` when CI should print only the final JSON summary on success; failed gate logs are always retained.

The command discovers all initializer, fixture, and Reference View tests; runs the real Chrome/Chromium interaction and visual gate; runs every public validator; and emits one JSON summary. A passing distribution reports `status: PLAN_READY` and `releaseAcceptance: passed`. It does not report a target repository as `MIGRATION_VERIFIED`.

CI or managed workstations may reuse an existing dependency/browser installation with:

- `DOCUMENT_HARNESS_NODE_MODULES`: directory containing `playwright`, `pngjs`, and `pixelmatch`
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` or `DOCUMENT_HARNESS_CHROME_EXECUTABLE_PATH`: explicit Chrome/Chromium executable
- `PLAYWRIGHT_BROWSERS_PATH`: Playwright-managed browser cache

Missing dependencies or browser executables are release blockers, not skipped gates.
