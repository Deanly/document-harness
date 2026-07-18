import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "..", "..");

test("close-doc fails closed before validation when asked to close an Initiative", (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "harness-close-initiative-"));
  const binDir = path.join(root, "docs", "bin");
  const initiativeDir = path.join(root, "docs", "initiatives");
  const marker = path.join(root, "validator-called");
  mkdirSync(binDir, { recursive: true });
  mkdirSync(initiativeDir, { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const closeDoc = path.join(binDir, "close-doc.sh");
  const validator = path.join(binDir, "validate-closeout.sh");
  copyFileSync(path.join(REPO_ROOT, "docs", "bin", "close-doc.sh"), closeDoc);
  writeFileSync(
    validator,
    "#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' called > \"${CLOSE_DOC_VALIDATOR_MARKER:?}\"\n",
    "utf8",
  );
  chmodSync(closeDoc, 0o755);
  chmodSync(validator, 0o755);

  const initiativePath = path.join(initiativeDir, "I0001-safe-outcome.md");
  const original = `---
type: initiative
doc_id: I0001
status: active
updated: 2026-07-18
---

# I0001 Safe Outcome

- Type: initiative
- Status: active
- Updated: 2026-07-18

## Status

- 2026-07-18: active after human approval.
`;
  writeFileSync(initiativePath, original, "utf8");

  const result = spawnSync(closeDoc, [initiativePath, "must not mutate one surface"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CLOSE_DOC_VALIDATOR_MARKER: marker },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Initiative closeout is not supported by close-doc\.sh/);
  assert.match(result.stderr, /canonical Initiative document/);
  assert.match(result.stderr, /docs\/_indexes\/initiative-register\.json/);
  assert.match(result.stderr, /exact terminal decision receipt/);
  assert.match(result.stderr, /validate-closeout\.sh/);
  assert.equal(readFileSync(initiativePath, "utf8"), original);
  assert.equal(existsSync(marker), false, "Initiative refusal must happen before closeout validation");
});
