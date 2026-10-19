# ReproProof Debugging Guide

**Status:** Debugging baseline
**Last updated:** 2026-10-19

## 1. Debugging principles

1. Reproduce the problem before changing code.
2. Record the exact command, repository, and environment.
3. Separate product logic failures from environment failures.
4. Prefer a small regression test over a one-off manual fix.
5. Never include credentials or private repository content in logs.
6. Run the smallest meaningful check first, then the full test suite.

## 2. Standard debugging workflow

### Step 1: Capture the symptom

Record:

- What the user did.
- What was expected.
- What happened instead.
- The exact error message.
- Whether the failure occurred in the scanner, executor, UI, report, or Docker build.

### Step 2: Reproduce with a fixture

Use a small repository fixture whenever possible. Avoid debugging against an uncontrolled production repository because its files, dependencies, and commands may change during investigation.

### Step 3: Classify the failure

| Category | Examples |
|---|---|
| Input | Invalid path, empty folder, unreadable file |
| Scanner | Wrong file detection, ignored directory bug |
| Rule | Incorrect pass, missing evidence, false positive |
| Score | Wrong weight, unstable total, misleading status |
| Execution | Timeout, bad working directory, command injection risk |
| Docker | Missing executable, failed build, network policy issue |
| UI | Stale result, missing loading state, unhandled error |
| Report | Missing section, unredacted value, invalid JSON |
| Packaging | Build failure, missing lockfile, absolute path |

### Step 4: Add a regression test

The test should fail before the fix and pass afterward. If a test cannot be added, document why and add a manual QA item.

### Step 5: Apply the smallest fix

Do not refactor unrelated modules while resolving a failure. Preserve the public result model and safety policy.

### Step 6: Verify progressively

Run:

```bash
npm test
npm run build
```

Then run the Docker checks before marking the issue complete.

## 3. Common failures

### Node version mismatch

Symptoms:

- Dependency installation fails.
- Syntax or API is unavailable.
- Build works locally but not in Docker.

Checks:

- Compare `node --version` with `.nvmrc`.
- Check `package.json` engine constraints.
- Confirm the Docker base image uses the same major version.

### Missing dependency lockfile

Symptoms:

- `npm ci` fails.
- A clean build resolves different versions.

Fix:

- Generate the lockfile with the pinned runtime.
- Commit it.
- Use `npm ci` in Docker rather than `npm install`.

### Docker unavailable

Expected behavior:

- Static audit remains usable.
- The rehearsal is shown as skipped.
- The UI explains how to install or enable Docker.
- The application does not claim a clean-room pass.

### Test command hangs

Checks:

- Confirm the command is non-interactive.
- Apply a timeout.
- Capture only bounded output.
- Terminate the child process and any relevant descendants.
- Report timeout separately from a normal test failure.

### Windows and Linux path differences

Checks:

- Use `node:path` APIs.
- Do not compare raw path strings.
- Normalize separators at the boundary.
- Run path-focused tests with both styles of fixture input.

### Secret appears in output

Immediate action:

1. Stop sharing the output.
2. Remove the value from committed fixtures and logs.
3. Rotate the credential if it was real.
4. Add a regression test for the pattern.
5. Verify Markdown, JSON, UI, and terminal output are redacted.

## 4. Debug logging policy

Development logs may include:

- Check identifiers.
- File names.
- Stage names.
- Durations.
- Exit codes.

Logs must not include:

- Environment variable values.
- Tokens.
- Passwords.
- Private keys.
- Full unbounded command output.
- Repository contents unrelated to the finding.

## 5. Useful diagnostic commands

```bash
node --version
npm --version
npm test
npm run build
git status --short
git diff --check
docker version
docker build -t reproproof .
docker run --rm --network none reproproof npm test
```

## 6. Definition of a fixed bug

A bug is fixed only when:

- The original failure can no longer be reproduced.
- A regression test or documented manual check exists.
- `npm test` passes.
- The Docker test passes when the bug affects packaging or execution.
- The README or troubleshooting documentation is updated if user behavior changed.
