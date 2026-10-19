# ReproProof MCP Connection Plan

**Status:** Optional future integration
**Last updated:** 2026-10-19

## 1. Purpose

This document records how ReproProof could expose its audit capabilities through the Model Context Protocol (MCP) without making the core application depend on MCP, a hosted model, or an external network service.

## 2. MVP decision

MCP is intentionally outside the MVP execution path.

The first release must be able to:

- Run as a local web application.
- Run as a CLI.
- Audit a repository offline.
- Generate reports without an AI provider.
- Pass Docker tests with networking disabled.

Adding MCP before the audit engine is stable would increase integration and debugging risk without improving the core product demonstration.

## 3. Future use case

An MCP-capable coding assistant could ask ReproProof to:

1. Audit a repository.
2. List blocking reproducibility findings.
3. Run a clean-room rehearsal.
4. Generate a report.
5. Explain the highest-impact remediation.

The MCP adapter should call the same application services used by the CLI and web UI. It must not duplicate checks or bypass the command execution safety boundary.

## 4. Proposed tools

### `audit_repository`

Input:

```json
{
  "repositoryPath": "./project",
  "includeExecutionChecks": false
}
```

Output:

```json
{
  "auditId": "local-audit-id",
  "score": 72,
  "status": "needs_attention",
  "blockingFindings": 2,
  "findings": []
}
```

### `run_clean_room_rehearsal`

Input:

```json
{
  "auditId": "local-audit-id",
  "networkMode": "none"
}
```

Output:

```json
{
  "status": "passed",
  "exitCode": 0,
  "durationMs": 1200,
  "networkMode": "none",
  "output": "redacted"
}
```

### `generate_reproducibility_report`

Input:

```json
{
  "auditId": "local-audit-id",
  "format": "markdown"
}
```

Output:

```json
{
  "format": "markdown",
  "content": "# ReproProof report..."
}
```

## 5. MCP safety requirements

- Require explicit repository path input.
- Validate that the path exists and is a directory.
- Do not accept arbitrary shell commands from MCP input.
- Apply the same timeout and output limit as the UI.
- Preserve the network policy in the result.
- Redact sensitive values before returning content.
- Never upload repository contents to a remote MCP service by default.
- Return skipped rather than passed when Docker is unavailable.

## 6. Integration boundary

```text
MCP adapter
    |
Application service interface
    |
Audit orchestrator
    |
Scanner / checks / execution / reports
```

The application service interface should remain framework-independent. This allows MCP to be added later without changing domain rules or the browser UI.

## 7. Acceptance criteria for a future MCP phase

- MCP can invoke a static audit through the shared service layer.
- MCP cannot bypass path and command validation.
- MCP returns the same findings and score as the CLI and UI.
- MCP works in a local-only configuration.
- MCP tests run without network access.
- MCP documentation includes setup and teardown instructions.
