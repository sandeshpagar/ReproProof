# ReproProof Architecture

**Status:** Planning baseline
**Architecture style:** Local modular application
**Last updated:** 2026-10-19

## 1. Architectural goals

The architecture must make the following properties obvious:

- Scanning is deterministic.
- Checks can be added without changing the server or UI.
- Command execution is isolated behind a safety boundary.
- Reports are generated from a stable domain model.
- The application remains useful when Docker is unavailable.
- The same services can be called by a CLI, web UI, tests, or a future MCP adapter.

## 2. High-level diagram

```text
+-----------------------+
| Browser dashboard     |
+-----------+-----------+
            |
            v
+-----------------------+
| Local HTTP API        |
| Request validation    |
+-----------+-----------+
            |
            v
+-----------------------+
| Audit orchestrator    |
+---+--------+------+---+
    |        |      |
    v        v      v
 Scanner   Checks  Executor
    |        |      |
    +--------+------+
             |
             v
       Result model
             |
       +-----+------+
       |            |
       v            v
   Score engine   Reports
```

## 3. Proposed project structure

```text
.
├── src/
│   ├── audit/
│   ├── cli/
│   ├── domain/
│   ├── checks/
│   ├── scanner/
│   ├── scoring/
│   ├── security/
│   ├── server/
│   ├── execution/
│   ├── reports/
│   └── config/
├── web/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── fixtures/
│   ├── broken-repository/
│   └── passing-repository/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
├── prd.md
├── techstack.md
├── architecture.md
└── README.md
```

The exact file names may be adjusted during implementation if a simpler layout improves portability, but the domain boundaries must remain.

## 4. Domain model

### RepositoryDescriptor

```text
rootPath
displayName
detectedEcosystems[]
manifestFiles[]
lockFiles[]
```

### Finding

```text
id
status: pass | warning | fail | skipped
severity: info | low | medium | high | critical
title
description
evidence[]
remediation
blocking
```

### ExecutionResult

```text
commandLabel
exitCode
signal
durationMs
stdout
stderr
timedOut
networkMode
redactionsApplied
```

### AuditResult

```text
toolVersion
repository
startedAt
finishedAt
score
findings[]
executions[]
```

## 5. Module responsibilities

### `scanner`

Reads repository metadata through a controlled filesystem abstraction. It should not decide whether a finding passes; it only provides facts.

### `checks`

Contains independent rules. Each rule receives a repository snapshot and returns one structured finding. Rules must be deterministic and side-effect-free unless explicitly marked as an execution check.

### `scoring`

Maps findings to a stable score. The score configuration must be versioned so reports remain understandable if weights change in a later release.

### `execution`

Runs validated commands with timeout, output limits, working-directory enforcement, and redaction. Docker execution must be a separate adapter from local process execution.

### `reports`

Converts the domain result to Markdown and JSON. Report generation must not rescan the repository or run commands.

### `server`

Validates HTTP input, calls application services, and maps errors to safe responses. It must not contain check logic.

### `cli`

Provides a scriptable entry point for auditing and report generation. The CLI and server should call the same application services.

### `security`

Provides path validation, redaction, command policy, symlink handling, and output limits.

## 6. Audit flow

```text
1. Validate repository path.
2. Create a repository snapshot.
3. Detect supported ecosystem hints.
4. Run static checks.
5. Calculate preliminary score.
6. Ask for explicit execution checks.
7. Run local or Docker verification under policy.
8. Merge execution findings.
9. Recalculate final score.
10. Return result to UI and report generators.
```

## 7. Execution boundary

The execution layer is the highest-risk part of the product. It must:

- Use an allowlisted command shape where possible.
- Use an argument array rather than shell string interpolation.
- Set the repository as the working directory.
- Apply a timeout.
- Limit stdout and stderr.
- Stop child processes on timeout.
- Mark network policy in the result.
- Redact secret-like output before display.
- Clearly distinguish skipped, failed, and passed execution.

The application must not claim that a check passed when Docker or a required command was unavailable.

## 8. API shape for the MVP

The local API may expose endpoints similar to:

```text
GET  /api/health
POST /api/audits
GET  /api/audits/:id
POST /api/audits/:id/rehearsal
GET  /api/audits/:id/report?format=markdown
```

The API must validate request bodies and never accept a raw shell command from the browser.

Phase 2 implements `POST /api/audits` with a JSON body containing only `repositoryPath`. It performs the static audit and returns the evidence-backed result. Execution and Docker rehearsal endpoints remain Phase 3 work.

## 9. Future MCP boundary

An MCP adapter may call application services such as:

- `auditRepository`
- `runCleanRoomRehearsal`
- `generateReport`

The MCP layer must not duplicate scanner rules or bypass the execution policy.

## 10. Error handling

Errors should be classified as:

- Invalid user input.
- Repository access failure.
- Unsupported repository shape.
- Check failure.
- Execution timeout.
- Docker unavailable.
- Report generation failure.

Internal stack traces may be logged during development but must not be sent to the browser by default.

## 11. Architecture decisions

| Decision | Rationale |
|---|---|
| Local-first | Protects source code and works offline |
| Modular checks | Makes the scanner extensible |
| Shared application services | Keeps CLI, UI, tests, and MCP consistent |
| No required database | Removes infrastructure and credential risk |
| Docker as optional execution adapter | Preserves static audit usefulness without Docker |
| Deterministic scoring | Makes results testable and explainable |
