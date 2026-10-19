# Contributing to ReproProof

ReproProof is a local-first open-source developer tool. Contributions should preserve its privacy, portability, and offline-friendly behavior.

## Development requirements

- Node.js 22.19 or newer.
- npm.
- Docker for clean-room rehearsal changes.

## Setup

```bash
npm ci
```

## Checks before opening a pull request

```bash
npm test
npm run build
docker build -t reproproof .
docker run --rm --network none reproproof npm test
```

## Contribution rules

- Keep repository analysis local; do not upload source files.
- Do not commit `.env`, credentials, tokens, or private payloads.
- Do not add runtime dependencies without documenting why they are needed.
- Preserve the committed lockfile.
- Add a regression test for every bug fix.
- Keep command execution bounded and argument-array based.
- Redact secrets and machine-local paths in user-visible reports.
- Update the README when commands or user behavior change.

## Commit style

Use a concise conventional commit message such as:

```text
feat: add Python lockfile detection
fix: redact command output paths
test: cover malformed manifest handling
docs: update clean-room instructions
```

## Scope

The project currently prioritizes a complete Node.js workflow over broad ecosystem support. New ecosystem adapters should land only after they include fixtures, tests, documentation, and a safe command policy.
