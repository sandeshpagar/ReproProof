# ReproProof Project Implementation Plan

**Status:** Ready for implementation
**Recommended execution model:** Six phases with a test gate after every phase
**Last updated:** 2026-10-19

## 1. Implementation strategy

ReproProof should be implemented as a sequence of small, reversible milestones. The project is a solo buildathon entry, so each phase must produce a demonstrable result rather than a large unfinished subsystem.

The implementation priority is:

1. A working, reproducible foundation.
2. A trustworthy static audit engine.
3. Evidence-producing command execution.
4. A polished single-screen dashboard.
5. Offline QA and security hardening.
6. Submission-ready documentation and demo.

## 2. Phase gates

No phase is complete until:

- Its acceptance criteria pass.
- The smallest meaningful test has been run.
- The repository is in a working state.
- The change is committed to Git.
- The README or relevant documentation is updated.

## 3. Phase 1 — Foundation and application shell

### Objectives

- Establish the runtime and build contract.
- Create a minimal local application.
- Make the project buildable and testable before feature work begins.

### Work items

- Initialize Git.
- Add `.nvmrc` with Node.js 22.19 or the selected compatible version.
- Create `package.json` and `package-lock.json`.
- Create TypeScript and build configuration if TypeScript remains the selected language.
- Add `.gitignore`, `.dockerignore`, and `.env.example` if configuration needs it.
- Add a minimal local server and health endpoint.
- Add a basic browser shell.
- Add the Dockerfile.
- Add the first unit test and the `npm test` command.

### Exit criteria

```bash
npm ci
npm test
npm run build
docker build -t reproproof .
```

all complete successfully.

## 4. Phase 2 — Static audit engine

### Objectives

Build the core product value without relying on Docker or external services.

### Work items

- Define the repository snapshot model.
- Define the check interface.
- Add controlled filesystem access.
- Add runtime pin detection.
- Add lockfile detection.
- Add Dockerfile detection.
- Add `.env.example` detection.
- Add README instruction checks.
- Add test-command discovery.
- Add absolute-path detection.
- Add secret-like pattern detection with redaction.
- Add deterministic score calculation.
- Add broken and passing fixture repositories.

### Exit criteria

- The broken fixture produces expected blockers.
- The passing fixture produces expected passes.
- Each finding contains evidence and remediation guidance.
- Unit and integration tests cover the rules.

## 5. Phase 3 — Execution and clean-room rehearsal

**Status:** Implemented through the local test and Docker rehearsal adapters; final Docker verification depends on the local Docker daemon.

### Objectives

Prove behavior rather than only inspect files.

### Work items

- Implement the controlled command runner.
- Add argument-array execution rather than shell interpolation.
- Add timeout and output limits.
- Capture exit code, signal, duration, and network mode.
- Add Docker availability detection.
- Add Docker build and network-isolated test adapter.
- Distinguish passed, failed, and skipped rehearsal results.
- Add regression tests for timeouts and command failures.

### Exit criteria

```bash
docker run --rm --network none reproproof npm test
```

passes for the ReproProof project, and the demo fixture can show both a failed and successful rehearsal.

## 6. Phase 4 — Dashboard and user experience

**Status:** Implemented with the browser audit workflow, evidence views, execution controls, and client-side exports.

### Objectives

Make the workflow understandable and impressive in a short demo.

### Work items

- Add repository path input.
- Add audit progress states.
- Add score summary.
- Add finding list with severity filters.
- Add evidence details.
- Add rehearsal output view.
- Add report export buttons.
- Add empty, error, and Docker-unavailable states.
- Add keyboard and contrast improvements.

### Exit criteria

A first-time user can select a fixture, run the audit, inspect a blocker, run rehearsal, and understand the result without reading project source code.

## 7. Phase 5 — Reports, security, and hardening

**Status:** Implemented with versioned reports, API/CLI exports, path hardening, redaction, and malformed/empty repository coverage.

### Objectives

Make the product safe, portable, and credible to a reviewer.

### Work items

- Generate Markdown reports.
- Generate JSON reports.
- Add report version and timestamp.
- Redact secret-like output.
- Validate paths and prevent traversal.
- Handle symlinks according to policy.
- Verify cross-platform path behavior.
- Add malformed-file and empty-repository tests.
- Add offline test execution.
- Review dependency and license choices.

### Exit criteria

- No raw secret-like values appear in the UI, reports, or test artifacts.
- Failure modes are understandable.
- All tests pass without network access.
- The README reflects the actual commands.

## 8. Phase 6 — Release, demo, and submission

### Objectives

Turn the working product into a clear evaluation package.

### Work items

- Run the full local test suite.
- Run Docker build and network-disabled tests.
- Test from a fresh checkout.
- Complete README and screenshots.
- Prepare a broken demo repository and a corrected state.
- Record a two- to three-minute demo.
- Verify public GitHub repository settings.
- Add OmniRush session references.
- Submit before the deadline and preserve the submission ID.

### Exit criteria

An evaluator can clone the repository, follow the README, build it in Docker, run tests offline, and understand the product value from the demo.

## 9. Suggested commit sequence

Use small conventional commits:

```text
chore: initialize reproducible project foundation
feat: add repository snapshot and audit contracts
feat: add static reproducibility checks
feat: add controlled command execution
feat: add Docker clean-room rehearsal
feat: add audit dashboard
feat: add report export and redaction
test: expand fixture and offline coverage
docs: finalize buildathon README and demo instructions
```

## 10. Scope control rules

- Do not add a new ecosystem before the Node.js workflow is complete.
- Do not add hosted authentication during the MVP.
- Do not add an external database.
- Do not build an AI chatbot unless the core audit flow is already complete.
- Do not add auto-fix mutation without a preview and regression test.
- Prefer a complete narrow check set over a broad incomplete scanner.

## 11. Definition of implementation complete

Implementation is complete when ReproProof can audit itself and the two fixture repositories, display evidence-backed findings, execute a controlled offline rehearsal, export reports, pass its own tests, and rebuild from Docker without machine-specific files.
