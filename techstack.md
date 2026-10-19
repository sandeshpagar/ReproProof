# ReproProof Technology Stack

**Status:** Planning baseline
**Target:** Offline-compatible MVP
**Last updated:** 2026-10-19

## 1. Stack decision

ReproProof will use a small Node.js and TypeScript application with a local web interface. The stack is intentionally conservative so that the project can be rebuilt in a clean Linux Docker environment and tested without network access.

## 2. Runtime and language

| Area | Decision | Reason |
|---|---|---|
| Runtime | Node.js 22.19 or newer | Matches the buildathon guidance and provides modern APIs |
| Language | TypeScript | Safer module boundaries and clearer domain types |
| Package manager | npm | Available with Node and produces a committed lockfile |
| Module format | ESM | Consistent modern Node.js module behavior |
| Runtime pin | `.nvmrc` and `engines` in `package.json` | Makes local and CI expectations explicit |

## 3. Application layers

### Server

The server will expose a local HTTP API and serve the static dashboard. The MVP should prefer Node's built-in HTTP primitives or a very small, well-supported framework. Avoid a large framework unless it materially reduces implementation risk.

### Domain

The domain layer will contain framework-independent types and services:

- Repository descriptor.
- Audit check contract.
- Finding and severity types.
- Audit result.
- Score calculation.
- Execution result.
- Report model.

### Scanner

The scanner will read repository metadata and files through a controlled filesystem adapter. It will use path-aware utilities rather than string-based path assumptions.

### Execution

The execution layer will wrap child-process and Docker calls. It will enforce timeouts, output limits, signal handling, and redaction before results reach the UI.

### Frontend

The first interface will use plain HTML, CSS, and browser JavaScript or a very small TypeScript client. The goal is a polished single-dashboard flow, not a large frontend framework migration.

## 4. Recommended dependencies

Keep runtime dependencies minimal. Candidate packages should be evaluated against the following rules:

- Must work with the pinned Node version.
- Must install deterministically through `npm ci`.
- Must not require a runtime network connection.
- Must have a compatible license.
- Must reduce complexity rather than introduce a new subsystem.

The initial implementation should use Node built-ins wherever practical:

- `node:fs/promises` for filesystem access.
- `node:path` for path handling.
- `node:child_process` for controlled process execution.
- `node:http` for the local server if sufficient.
- `node:test` and `node:assert/strict` for tests.

## 5. Build and test tools

Required project files:

- `.nvmrc` with the selected Node version.
- `package.json` with scripts and engine constraints.
- `package-lock.json`.
- `tsconfig.json` if TypeScript is used.
- `Dockerfile`.
- `.dockerignore`.
- `.gitignore`.
- `.env.example` if configuration variables are introduced.

Required scripts:

```json
{
  "scripts": {
    "dev": "...",
    "build": "...",
    "start": "...",
    "test": "...",
    "audit": "..."
  }
}
```

The exact command implementation will be finalized in Phase 1. `npm test` is the single required verification command.

## 6. Docker strategy

The project Dockerfile will:

1. Start from `node:22-slim`.
2. Set a project-local working directory.
3. Copy `package.json` and `package-lock.json` first.
4. Run `npm ci`.
5. Copy application files.
6. Build the application.
7. Define a predictable start command.

The judge-style verification command will be:

```bash
docker build -t reproproof .
docker run --rm --network none reproproof npm test
```

## 7. Configuration

Configuration must be explicit and safe. Possible values include:

- Local server port.
- Command timeout.
- Maximum captured output size.
- Optional Docker executable path.

Configuration must have safe defaults. No credentials or personal paths may be committed.

## 8. Versioning and compatibility

The first release targets:

- Node.js 22.19+.
- Windows development.
- Linux Docker judging.
- Git repositories with primarily local files.

Support for Python, Go, Rust, and additional ecosystems should be added through check plugins after the Node.js MVP is stable.

## 9. Technology trade-offs

### Why not a hosted database?

It would add secrets, network dependency, and deployment risk without improving the core audit workflow.

### Why not an embedded runtime AI model?

The product must work offline and the value comes from evidence-backed checks. A deterministic analyzer is easier to trust and test.

### Why not a full frontend framework initially?

The application has one primary screen. A minimal frontend shortens build time and reduces dependency risk.

## 10. Exit criteria for the stack

The stack is accepted when:

- The project installs through `npm ci`.
- The application builds without network access after installation.
- Tests run through `npm test`.
- The Docker image builds from the repository alone.
- The Docker test passes with `--network none`.
- No absolute machine paths or secrets are embedded in the repository.
