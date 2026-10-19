# ReproProof Demo Script

This is the recommended two- to three-minute demo for the OmniRush Frontier Buildathon.

## Demo goal

Show the complete transformation from an unreliable repository to verifiable clean-machine evidence.

## Before recording

1. Start ReproProof from the repository root:

   ```bash
   npm start
   ```

2. Open `http://127.0.0.1:4173`.
3. Keep Docker Desktop running for the clean-room step.
4. Do not show private paths, credentials, terminal history, or private browser tabs.
5. Use the existing safe fixtures:
   - `./fixtures/broken-repository`
   - `./fixtures/passing-repository`

## Two-minute narration

### 0:00–0:20 — The problem

Say:

> “A repository can be public and still fail on a clean machine. Missing runtime pins, lockfiles, test commands, and environment instructions create the classic ‘it works on my machine’ problem. ReproProof turns that promise into evidence.”

Show the dashboard and the local-only privacy statement.

### 0:20–0:55 — Audit the broken repository

Enter:

```text
./fixtures/broken-repository
```

Click **Run static audit**.

Show:

- Low readiness score.
- Blocker count.
- Missing runtime pin.
- Missing lockfile.
- Missing Dockerfile.
- Absolute path finding.
- Secret-like value finding.

Open one blocker and point out:

- The evidence location.
- Why it matters.
- The suggested remediation.

Say:

> “This is not an opaque AI answer. Every score change is backed by a specific file-level finding.”

### 0:55–1:20 — Show the corrected state

Replace the path with:

```text
./fixtures/passing-repository
```

Run the audit again.

Show:

```text
100 / 100
8 passed
0 blockers
```

Click the **Passed** filter briefly to demonstrate the findings view, then return to **All**.

### 1:20–1:50 — Prove execution

Click **Run project tests**.

Show the passing status, exit code, duration, and network mode.

Then click **Run clean-room rehearsal**.

Show:

- Docker available.
- Image build.
- Network-isolated test.
- `Network: none`.
- Passing result.

Say:

> “The final proof is a real test inside Docker with network access disabled. ReproProof does not confuse a skipped rehearsal with a pass.”

### 1:50–2:10 — Export evidence

Click **Export Markdown** and **Export JSON**.

Mention:

- Reports have a schema version and timestamp.
- Secret-like values are redacted.
- Local absolute paths are excluded.

### 2:10–2:20 — Close

Say:

> “ReproProof helps maintainers discover clean-machine failures before contributors, reviewers, or judges do. It turns ‘works on my machine’ into verifiable evidence.”

## Optional CLI proof

If the recording includes a terminal, use the short version:

```bash
npm run audit -- ./fixtures/broken-repository
npm run audit -- ./fixtures/passing-repository --test --rehearsal
npm run audit -- ./fixtures/passing-repository --report markdown --output reproproof-report.md
```

## Suggested screenshots

Capture these frames for the repository or submission page:

1. Broken fixture with blockers visible.
2. Passing fixture at `100/100`.
3. Clean-room rehearsal with `Network: none` and `passed`.
4. Expanded evidence and remediation panel.

Do not commit screenshots containing personal machine paths or private data.
