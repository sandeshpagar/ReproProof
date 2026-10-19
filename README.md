# ReproProof

> Turn “it works on my machine” into verifiable evidence.

ReproProof is a local-first developer tool for auditing whether an open-source repository can be rebuilt and tested on a clean machine. It checks repository configuration, documentation, dependency metadata, environment expectations, and test behavior, then produces evidence-backed findings and a reproducibility report.

## Why it exists

Many repositories are easy to clone but difficult to run. Contributors may discover missing runtime pins, stale README commands, missing environment variables, hardcoded local paths, or tests that require internet access. ReproProof helps maintainers find those problems before publication, review, or judging.

## Buildathon track

**Developer Tools & Open Source**

This project is designed for the OmniRush Frontier Buildathon. It is intentionally local-first and offline-compatible so it can be rebuilt in a clean Linux Docker environment.

## What it does

- Select a local repository.
- Run deterministic repository checks.
- Detect common reproducibility risks.
- Display a score with pass, warning, and blocker findings.
- Show evidence and remediation guidance.
- Run a network-isolated Docker rehearsal when Docker is available.
- Export Markdown and JSON reports.

## Audit checks

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

Phase 1 foundation, Phase 2 static audit engine, Phase 3 execution flow, Phase 4 interactive dashboard, Phase 5 reports/security hardening, and Phase 6 release preparation are complete. The local application exposes a health endpoint, audits repositories through the browser, CLI, and API, runs bounded local project tests, supports a network-isolated Docker rehearsal, and exports versioned redacted reports. Demo recording, exact OmniRush session IDs, and the external buildathon submission remain manual submission steps.

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

The dashboard workflow is:

1. Enter a local repository path.
2. Run the static audit.
3. Filter findings by blockers, warnings, or passes.
4. Expand a finding to inspect evidence and remediation.
5. Run local tests or the Docker clean-room rehearsal.
6. Export the current result as Markdown or JSON.

## Test

The single required project test command will be:

```bash
npm test
```

Tests must work without an internet connection after dependencies have been installed.

The Phase 1 test verifies the application health response. Phase 2 adds scanner, reproducibility-rule, scoring, fixture, and API coverage. Phase 3 adds bounded command execution, redaction, local test execution, and Docker rehearsal coverage. Phase 5 adds report and hardening coverage. Phase 6 verifies the release from a fresh checkout.

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

Generate a versioned report. Use `--output` when the JSON or Markdown file will be consumed by another tool:

```bash
npm run audit -- ./fixtures/passing-repository --report markdown --output reproproof-report.md
npm run audit -- ./fixtures/passing-repository --report json --output reproproof-report.json
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
GET  /api/audits/:auditId/report?format=markdown
GET  /api/audits/:auditId/report?format=json
```

Reports contain a schema version, timestamp, score breakdown, findings, and execution results. Absolute local paths and secret-like values are removed or redacted before export. If Docker is unavailable, the rehearsal returns `skipped` with a reason. It never reports a skipped rehearsal as passed.

## Docker verification

The judge-style verification will be:

```bash
docker build -t reproproof .
docker run --rm --network none reproproof npm test
```

The final implementation must ensure that this command succeeds on a clean Linux machine.

## Fresh-checkout verification

After cloning the public repository, run:

```bash
npm ci
npm test
npm run build
```

Once dependencies are available locally, the test command itself is offline-compatible:

```bash
npm ci --offline
npm test
```

The release checklist is in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). The two-minute recording plan is in [DEMO.md](DEMO.md).

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
- [Demo script](DEMO.md)
- [Release checklist](RELEASE_CHECKLIST.md)
- [Contributing](CONTRIBUTING.md)
- [OmniRush session record](OMNIRUSH_SESSIONS.md)

## License

ReproProof is released under the [MIT License](LICENSE).
