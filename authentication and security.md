# ReproProof Authentication and Security Plan

**Status:** Security baseline
**Last updated:** 2026-10-19

## 1. Security objectives

ReproProof operates on source repositories and may inspect files that contain credentials or private implementation details. The application must minimize exposure, avoid unnecessary persistence, and treat repository command execution as a privileged operation.

The MVP security objectives are:

1. Keep repository content on the user’s machine.
2. Bind the local server to localhost by default.
3. Prevent path traversal and unsafe file access.
4. Avoid shell injection when running checks.
5. Bound command duration and output size.
6. Redact secret-like values from evidence, logs, and reports.
7. Avoid committing credentials or private machine paths.
8. Make skipped and failed checks explicit rather than hiding uncertainty.

## 2. Authentication decision

The MVP does not require user authentication because it is a local developer tool. There are no user accounts, remote repositories, cloud sessions, or shared audit histories.

The local server should:

- Bind to `127.0.0.1` by default.
- Use a configurable port with a safe default.
- Avoid advertising itself on the local network.
- Reject unexpected host or origin behavior where practical.
- Show the local URL clearly to the user.

If the application is ever deployed publicly, local-only assumptions must not be reused without a full threat-model review.

## 3. Repository privacy

- Do not upload repository files.
- Do not send repository content to an external AI provider.
- Do not store full source files in audit history.
- Keep reports as explicit local exports.
- Avoid including full file contents in findings.
- Prefer file path, line number, and redacted snippet evidence.

## 4. Path security

All user-provided paths must be validated before access.

Required controls:

- Normalize the path using platform APIs.
- Confirm that it exists and is a directory.
- Resolve the selected root once.
- Ensure scanned paths remain within the selected root.
- Handle symbolic links according to a documented policy.
- Reject traversal sequences after normalization.
- Do not follow links outside the repository unless the user explicitly enables it.
- Avoid absolute machine paths in generated reports when a relative path is sufficient.

## 5. Command execution security

Command execution is optional and must require an explicit user action.

The executor must:

- Use an executable plus argument array rather than concatenated shell strings.
- Use the selected repository as the working directory.
- Avoid invoking a shell unless it is strictly required and protected.
- Apply a timeout.
- Apply stdout and stderr size limits.
- Terminate timed-out processes safely.
- Record exit code and signal.
- Mark the network policy.
- Redact output before it reaches the UI or report.

The browser must not send an arbitrary command string to the server. The server must derive commands from validated project metadata or a small configured policy.

## 6. Docker security

The clean-room rehearsal should:

- Use a project-local image build.
- Use `--network none` for offline verification.
- Avoid mounting the host home directory.
- Avoid passing host credentials into the container.
- Use bounded output and timeouts.
- Report Docker unavailability honestly.

The application should not claim that Docker provides a complete security sandbox for every arbitrary repository. It is an evaluation and reproducibility mechanism, not a hardened malware-analysis environment.

## 7. Secret detection and redaction

Secret-like patterns may include:

- API key prefixes.
- Private key headers.
- Password assignments.
- Token assignments.
- Cloud credential patterns.
- Long high-entropy strings in credential-like contexts.

Detection must be conservative and explain that it is heuristic. It must not copy the complete suspected value into the report.

Redaction rules:

- Replace the sensitive middle with a fixed marker.
- Keep only enough prefix or suffix for debugging where safe.
- Apply redaction before persistence, rendering, and export.
- Test Markdown, JSON, browser, and terminal output separately.

## 8. Configuration and secrets

- Commit `.env.example` with placeholder values only.
- Never commit `.env`.
- Do not put credentials in test fixtures.
- Do not include personal paths in examples.
- Review `git diff --check` and repository status before commits.

## 9. Input validation

Validate:

- Repository path.
- Report format.
- Audit identifier.
- Configuration values.
- Timeouts and output limits.

Reject unknown or malformed fields rather than silently accepting them.

## 10. Denial-of-service controls

Repository scanning can encounter very large files or directories. The scanner should:

- Ignore known dependency and build directories by default.
- Limit individual file size for text analysis.
- Limit total files and bytes processed where appropriate.
- Avoid recursive symlink loops.
- Bound command output.
- Enforce execution timeouts.

The report must explain when a limit caused a check to be skipped.

## 11. Future hosted authentication

If a hosted version is created, it will require:

- Account authentication.
- Repository authorization.
- Short-lived session tokens.
- Encrypted transport.
- Encrypted secret storage.
- Per-job container isolation.
- Resource quotas.
- Audit logs.
- Explicit data retention controls.

Hosted authentication is outside the MVP and must not be simulated with insecure placeholder logic.

## 12. Security acceptance criteria

- The default server is localhost-only.
- A path outside the selected repository cannot be scanned unintentionally.
- Raw shell input is not accepted from the browser.
- Commands time out and output is bounded.
- Secret-like values are redacted in all report formats.
- No real credential exists in the repository or fixtures.
- Docker rehearsal does not receive host credentials.
- Security behavior has automated regression tests.
