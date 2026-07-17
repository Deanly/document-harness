# Adoption Fixture Matrix

These files are immutable seed inputs for `fixture-matrix.test.mjs`. The test copies a selected seed into a disposable Git repository and exercises the real `harness-adopt` lifecycle. A fixture never writes into this directory.

- `adoption/manifest.json` names every initializer safety scenario and its expected lifecycle result.
- `adoption/seeds/` contains project-owned repository bytes, including intentionally damaged metadata.
- `governance/manifest.json` classifies repository evidence without granting approval.
- `governance/repository/` contains public, synthetic source material. The file under `private/` is a classification marker only and contains no credential.

Dynamic state such as Git index changes, symlinks, failure injection, installation locks, receipts, and source mutation is created only in the disposable test repository.
