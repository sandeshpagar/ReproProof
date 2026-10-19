# ReproProof

> Turn “it works on my machine” into verifiable evidence.

ReproProof is a local-first developer tool for auditing whether an open-source repository can be rebuilt and tested on a clean machine. It checks repository configuration, documentation, dependency metadata, environment expectations, and test behavior, then produces evidence-backed findings and a reproducibility report.

## Why it exists

Many repositories are easy to clone but difficult to run. Contributors may discover missing runtime pins, stale README commands, missing environment variables, hardcoded local paths, or tests that require internet access. ReproProof helps maintainers find those problems before publication, review, or judging.

## Buildathon track

**Developer Tools & Open Source**

This project is designed for the OmniRush Frontier Buildathon. It is intentionally local-first and offline-compatible so it can be rebuilt in a clean Linux Docker environment.

## Planned MVP

- Select a local repository.
- Run deterministic repository checks.
- Detect common reproducibility risks.
- Display a score with pass, warning, and blocker findings.
- Show evidence and remediation guidance.
- Run a network-isolated Docker rehearsal when Docker is available.
- Export Markdown and JSON reports.

## Planned checks

- Pinned runtime version.
- Dependency lockfile.
- Dockerfile presence and basic shape.
- Environment template such as `.env.example`.
- README setup and test instructions.
- Discoverable test command.
- Absolute local path detection.
- Secret-like value detection with redaction.
- Test command execution.
- Offline clean-room rehearsal.

## Status

Phase 1 foundation, Phase 2 static audit engine, and Phase 3 execution flow are implemented. The local application exposes a health endpoint, audits repositories through the CLI and API, runs bounded local project tests, and supports a network-isolated Docker rehearsal when Docker is available.

## Requirements

- Node.js 22.19 or newer.
- npm.
- Docker for the optional clean-room rehearsal.

The static audit and application test suite should remain useful without Docker.

## Setup

Install the pinned dependencies:

```bash
npm ci
```

## Run

Start the local application:

```bash
npm start
```

Then open `http://127.0.0.1:4173` in a browser. The server binds to localhost by default. The health endpoint is available at `http://127.0.0.1:4173/api/health`.

## Test

The single required project test command will be:

```bash
npm test
```

Tests must work without an internet connection after dependencies have been installed.

The Phase 1 test verifies the application health response. Phase 2 adds scanner, reproducibility-rule, scoring, fixture, and API coverage. Phase 3 adds bounded command execution, redaction, local test execution, and Docker rehearsal coverage. Report coverage will be added in a later phase.

The Phase 2 suite covers repository scanning, reproducibility checks, deterministic scoring, fixture audits, invalid paths, and the `POST /api/audits` endpoint.

## Audit a repository

Run the static audit from the command line:

```bash
npm run audit -- ./fixtures/passing-repository
npm run audit -- ./fixtures/broken-repository
```

The passing fixture should score `100/100`. The broken fixture intentionally reports reproducibility blockers. For machine-readable output:

```bash
npm run audit -- ./fixtures/passing-repository --json
```

Run the discovered local test command:

```bash
npm run audit -- ./fixtures/passing-repository --test
```

Run the Docker clean-room rehearsal. Docker image build output is captured and the test container always uses `--network none`:

```bash
npm run audit -- ./fixtures/passing-repository --rehearsal
```

The local API accepts only a repository path and never accepts a raw shell command:

```bash
curl.exe --fail --silent \
  -X POST http://127.0.0.1:4173/api/audits \
  -H "content-type: application/json" \
  -d "{\"repositoryPath\":\"./fixtures/passing-repository\"}"
```

The create response includes an `auditId`. Use it to run the Phase 3 checks:

```text
GET  /api/audits/:auditId
POST /api/audits/:auditId/test
POST /api/audits/:auditId/rehearsal
```

If Docker is unavailable, the rehearsal returns `skipped` with a reason. It never reports a skipped rehearsal as passed.

## Docker verification

The judge-style verification will be:

```bash
docker build -t reproproof .
docker run --rm --network none reproproof npm test
```

The final implementation must ensure that this command succeeds on a clean Linux machine.

## Security and privacy

- Repository files remain local.
- No source code is uploaded by the MVP.
- No runtime AI key is required.
- Do not commit `.env` files, credentials, tokens, or private repositories.
- Reports and logs must redact secret-like values.
- Command execution is bounded by a timeout and output limit.

## Project structure

```text
src/       Application, scanner, checks, execution, reports, and security
web/       Local dashboard assets
fixtures/  Broken and passing demo repositories
tests/     Unit, integration, and end-to-end tests
```

## Implementation phases

1. Foundation and application shell.
2. Static audit engine.
3. Test execution and Docker rehearsal.
4. Dashboard and user experience.
5. Reports, security hardening, and offline QA.
6. Release, demo, and submission preparation.

## Documentation

- [Product requirements](prd.md)
- [Technology stack](techstack.md)
- [Architecture](architecture.md)
- [Design](design.md)
- [Database decision](database.md)
- [Implementation plan](projectimplementation.md)
- [Testing and QA](TestingandQA.md)
- [Debugging](debugging.md)
- [MCP connection](MCP%20connection.md)
- [Authentication and security](authentication%20and%20security.md)

## License

License selection will be made before the public repository is finalized. The selected license must be documented here and in the repository metadata.
