# ReproProof Product Requirements Document

**Status:** Approved planning baseline
**Product:** ReproProof
**Track:** Developer Tools & Open Source
**Document owner:** Project owner
**Last updated:** 2026-10-19

## 1. Product summary

ReproProof is a local-first developer tool that verifies whether an open-source repository can be rebuilt and tested on a clean machine. It scans a repository for reproducibility risks, runs safe verification commands, produces evidence-backed findings, and exports a report that maintainers can share with contributors or reviewers.

> **Product promise:** Turn “it works on my machine” into verifiable evidence.

The first release is deliberately deterministic and offline-compatible. It does not require a hosted AI service, a cloud database, GitHub OAuth, or an internet connection at runtime.

## 2. Problem statement

Open-source projects often document a setup process without proving that the process works on a fresh machine. Contributors encounter missing runtime pins, stale instructions, missing environment variables, lockfile drift, hardcoded local paths, network-dependent tests, and Dockerfiles that do not actually run the project. Maintainers usually learn about these failures only after a contributor or CI system reports them.

Existing linters inspect source code, but they rarely test the full repository contract: dependencies, setup documentation, test commands, containerization, and offline execution. Maintainers need a fast way to rehearse a clean-room build before publishing or accepting contributions.

## 3. Target users

### Primary users

- Open-source maintainers preparing a repository for contributors.
- Solo developers shipping small projects.
- Hackathon participants preparing a project for judging.

### Secondary users

- Student teams onboarding to unfamiliar repositories.
- Code reviewers evaluating project quality.
- Educators checking whether assignments are reproducible.

## 4. Goals

### Product goals

1. Detect common repository reproducibility risks quickly.
2. Show evidence for every finding instead of returning an opaque score.
3. Verify the documented test command where it is safe to do so.
4. Run a network-isolated Docker rehearsal when Docker is available.
5. Provide prioritized, actionable remediation guidance.
6. Export a Markdown and JSON report.
7. Work without an external service or runtime API key.

### Buildathon goals

1. Demonstrate a real developer-tool problem with a polished end-to-end demo.
2. Satisfy the clean rebuild, lockfile, pinned runtime, Dockerfile, offline test, and README expectations.
3. Keep the implementation small enough for one person to finish and verify.
4. Show disciplined OmniRush sessions, tests, commits, and debugging evidence.

## 5. Non-goals for the MVP

- Supporting every programming language and build system.
- Automatically editing arbitrary repositories without a preview.
- GitHub account access, pull-request automation, or hosted repository scanning.
- Multi-user accounts, billing, or team permissions.
- A general-purpose AI chat interface.
- Replacing language-specific security scanners.
- Guaranteeing that arbitrary third-party scripts are safe to execute.

## 6. Core user journey

1. The user opens ReproProof locally.
2. The user selects a repository directory.
3. ReproProof validates the path and presents an audit configuration.
4. The user starts a static audit.
5. ReproProof scans the repository and displays a score with pass, warning, and blocker counts.
6. The user opens a finding to see evidence, affected files, and a suggested fix.
7. The user starts a clean-room rehearsal when Docker is available.
8. ReproProof captures the command, exit status, bounded output, and result.
9. The user exports a Markdown or JSON report.

## 7. Functional requirements

### FR-1: Repository selection

- The application must accept a local repository path.
- The default server must bind to localhost only.
- The path must be normalized and validated before scanning.
- The scanner must not follow unsafe paths outside the selected repository.

### FR-2: Repository discovery

The scanner must identify, when present:

- Runtime manifests and version pin files.
- Package manifests and lockfiles.
- Dockerfiles and container metadata.
- Environment templates such as `.env.example`.
- README files and documented commands.
- Test configuration and common test scripts.
- Candidate source files for absolute-path and secret-like-value checks.

### FR-3: Audit checks

The initial check set must include:

1. Runtime version is pinned.
2. A package lockfile is present when the ecosystem uses one.
3. A Dockerfile exists and has a buildable shape.
4. An environment template documents required variables.
5. README setup and test instructions are present.
6. A test command can be identified.
7. Absolute local paths are not present in tracked project files.
8. Secret-like values are not exposed in tracked files or reports.
9. The test command succeeds when executed under the configured policy.
10. The project does not require network access for the offline test rehearsal.

### FR-4: Findings

Every finding must include:

- Stable check identifier.
- Status: pass, warning, or failure.
- Severity.
- Human-readable title.
- Explanation.
- Evidence location.
- Suggested remediation.
- Whether the finding blocks a clean-room pass.

### FR-5: Score

The first version must calculate a deterministic score from weighted checks. The score must be reproducible for the same repository state. The UI must show the score breakdown so that the number is not misleading.

### FR-6: Command execution

- Commands must be constructed from validated project metadata.
- Execution must use a timeout and bounded output.
- Exit status, signal, duration, and truncated output must be captured.
- The user must explicitly start execution checks.
- Failures must be reported without leaking secrets.

### FR-7: Clean-room rehearsal

When Docker is available, ReproProof must support an isolated test command using a network-disabled container. If Docker is unavailable, the UI must explain that the rehearsal was skipped rather than silently reporting a pass.

### FR-8: Reports

The user must be able to export:

- A human-readable Markdown report.
- A machine-readable JSON report.

Reports must contain the repository identifier, timestamp, score, findings, execution results, and tool version. Sensitive values must be redacted.

## 8. Non-functional requirements

### NFR-1: Reproducibility

The application must build from a clean Linux machine using the committed lockfile and Dockerfile.

### NFR-2: Offline operation

Static audits, fixture tests, report generation, and the application test suite must work without network access after dependencies are installed.

### NFR-3: Portability

The code must avoid absolute paths and machine-specific assumptions. Path handling must work on Windows during development and Linux during judging.

### NFR-4: Safety

Repository files must not be uploaded. Command execution must be bounded, observable, and protected against shell injection.

### NFR-5: Usability

A first-time user must be able to understand the score and the top blocking findings without reading source code.

## 9. Acceptance criteria

The MVP is complete when:

- A user can select a local fixture repository.
- The audit returns at least eight deterministic checks.
- A broken fixture produces known failures.
- A passing fixture produces known passes.
- Every displayed finding includes evidence and a remediation hint.
- A test command can be executed with timeout and output capture.
- Docker rehearsal uses `--network none` when Docker is available.
- Markdown and JSON reports can be exported.
- `npm test` passes offline after dependency installation.
- `docker build` succeeds on the project.
- `docker run --rm --network none reproproof npm test` passes.
- The README explains setup, run, test, Docker, and submission usage.

## 10. Success metrics for the demo

- Audit completes for the demo repository in under 30 seconds for static checks.
- The demo clearly shows a score improvement from a broken fixture to a passing fixture.
- The clean-room rehearsal result is visible in the recording.
- A reviewer can understand the product value in the first 30 seconds.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope expands to every ecosystem | Start with Node.js and generic file checks |
| Arbitrary commands are unsafe | Use explicit execution policy, timeout, bounded output, and warnings |
| Docker is unavailable on a demo machine | Keep static audit complete and explain skipped rehearsal |
| Secret values appear in reports | Redact before storage, display, and export |
| Offline testing is flaky | Use local fixtures and deterministic Node tests |
| UI consumes too much time | Build a single dashboard instead of multiple pages |

## 12. Definition of done

The product is considered done for the buildathon when the complete user journey works from repository selection through report export, the fixtures prove both failure and success paths, the project passes its own offline Docker test, and the public README allows a fresh user to reproduce the result.
