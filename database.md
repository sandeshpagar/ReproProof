# ReproProof Database and Storage Decision

**Status:** Planning decision
**MVP decision:** No external database
**Last updated:** 2026-10-19

## 1. Decision summary

The ReproProof MVP will not use PostgreSQL, MongoDB, Firebase, Supabase, or another hosted database. The application is a local repository auditor, and a remote persistence layer would add complexity without improving the core workflow.

## 2. Why no database is needed

The primary data is derived directly from the selected repository:

- Repository metadata.
- Audit findings.
- Command execution output.
- Score breakdown.
- Generated reports.

The user does not need a shared account, remote history, or collaboration feature for the MVP. Keeping results local improves privacy and makes offline judging straightforward.

## 3. MVP storage model

### In-memory session state

The local server may keep the current audit result in memory during a session. A result should be identified by a non-sensitive local identifier and include an audit timestamp.

### Exported reports

Users may explicitly save:

- `reproproof-report.md`
- `reproproof-report.json`

Reports must be written only to a user-selected or application-controlled local path.

### Repository files

ReproProof reads repository files but does not copy the repository into an application database. The scanner should retain only the minimum data required for an audit result.

## 4. Sensitive data policy

The application must not persist:

- Environment variable values.
- Access tokens.
- Passwords.
- Private keys.
- Full secret-like file contents.
- Unbounded command output.

Evidence should contain file names, line references, and redacted snippets where necessary.

## 5. Future SQLite option

If a later release needs audit history, SQLite is the preferred first persistence option because it is local, file-based, and compatible with offline use.

Potential tables:

```text
audits
  id
  repository_name
  repository_path_hash
  started_at
  finished_at
  score
  status
  tool_version

findings
  id
  audit_id
  check_id
  status
  severity
  title
  blocking
  evidence_json
  remediation

executions
  id
  audit_id
  command_label
  exit_code
  duration_ms
  network_mode
  output_redacted
```

This schema is not part of the MVP and must not block the initial implementation.

## 6. Storage acceptance criteria

- The MVP runs without a database service.
- An audit can be completed and reported without network access.
- Reports are explicit user exports rather than hidden persistence.
- Sensitive values are not stored in raw form.
- A future database adapter can be added without changing the audit domain model.
