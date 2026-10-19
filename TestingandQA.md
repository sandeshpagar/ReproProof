# ReproProof Testing and Quality Assurance

**Status:** Test strategy baseline
**Primary command:** `npm test`
**Last updated:** 2026-10-19

## 1. Quality goals

ReproProof must be trustworthy in the areas it claims to measure. The score must be deterministic, findings must have evidence, execution must be bounded, and the project must rebuild in the same offline conditions expected by the buildathon judges.

## 2. Test pyramid

```text
              +----------------+
              | End-to-end      |
              +----------------+
             +------------------+
             | Integration      |
             +------------------+
            +--------------------+
            | Unit tests         |
            +--------------------+
```

Most checks should be covered by fast unit tests. A smaller number of integration tests should verify the scanner against real fixture directories. End-to-end tests should cover the main UI journey without becoming the only evidence of correctness.

## 3. Unit test coverage

### Filesystem and path safety

- Normalize a repository path.
- Reject an empty path.
- Reject a path that does not exist.
- Reject a file when a directory is required.
- Handle Windows-style and Linux-style separators.
- Prevent a path from escaping the selected repository.

### Runtime and lockfile checks

- Detect `.nvmrc`.
- Detect `.node-version`.
- Detect a supported runtime declaration.
- Detect a package lockfile.
- Report missing runtime pin as a warning or blocker according to the scoring policy.

### Documentation checks

- Detect a README.
- Detect setup instructions.
- Detect a test instruction.
- Identify a documented command without executing it during static analysis.
- Report missing or contradictory instructions.

### Environment and secret checks

- Detect `.env.example`.
- Detect required environment names without values where possible.
- Identify secret-like patterns.
- Mask matching values in evidence.
- Avoid false positives for safe placeholders such as `your-token-here`.

### Path checks

- Detect Windows absolute paths.
- Detect Unix home-directory paths.
- Ignore paths inside fixture descriptions when explicitly marked as examples.
- Include file and line evidence.

### Scoring

- Score all passes as expected.
- Apply severity weights consistently.
- Clamp the score to the documented range.
- Produce the same score for the same result set.
- Include a score breakdown.

## 4. Integration tests

The repository will contain at least two fixture projects:

### Broken fixture

Contains safe, intentional issues such as:

- Missing runtime pin.
- Missing environment template.
- Missing or stale test documentation.
- A test that fails under the offline policy.

The fixture must not contain real secrets or machine-specific private paths.

### Passing fixture

Contains:

- Pinned runtime.
- Lockfile.
- Environment template with placeholders.
- Working test command.
- Dockerfile.
- README instructions.
- No secret-like values.

Integration tests must verify that the expected findings are produced for each fixture.

## 5. Execution tests

- Successful command returns exit code zero.
- Failing command returns a failure result.
- Missing command returns a clear error.
- Timeout terminates the process.
- Output is truncated at the configured limit.
- stderr is captured separately.
- Non-zero signal is represented safely.
- Docker unavailable produces a skipped result rather than a false pass.
- Network mode is recorded accurately.

## 6. Report tests

- Markdown contains repository name, score, timestamp, findings, and execution status.
- JSON conforms to the documented result shape.
- Reports are deterministic except for explicitly documented timestamps.
- Redacted values do not reappear in output.
- Empty finding lists render correctly.
- Failed and skipped rehearsals are distinguishable from passes.

## 7. UI and end-to-end tests

The critical browser flow is:

1. Load the application.
2. Enter or select a fixture path.
3. Start an audit.
4. Observe progress.
5. Read the score.
6. Expand a blocker.
7. Start the rehearsal.
8. Export a report.

The UI must also be tested for:

- Invalid paths.
- Empty repositories.
- Audit in progress.
- Docker unavailable.
- Server error.
- Keyboard navigation.

## 8. Offline verification

After dependencies are installed, run the project test suite with networking disabled where the environment permits it:

```bash
npm test
```

The judge-style Docker check is:

```bash
docker build -t reproproof .
docker run --rm --network none reproproof npm test
```

No test may silently download data, call an external API, or depend on a developer-specific path.

## 9. Manual QA checklist

- [ ] Fresh checkout works.
- [ ] README commands match package scripts.
- [ ] Dashboard loads on localhost.
- [ ] Static audit finishes for a small repository.
- [ ] Findings show useful evidence.
- [ ] Score changes when a fixture is corrected.
- [ ] Docker-unavailable state is honest.
- [ ] Command timeouts are visible.
- [ ] Reports contain no secrets.
- [ ] Windows development paths do not appear in committed files.
- [ ] Docker image builds from the project directory.
- [ ] `npm test` passes with network disabled.

## 10. Quality gates

Every implementation phase must run the smallest relevant test. Before release, all of the following must pass:

```bash
npm test
npm run build
docker build -t reproproof .
docker run --rm --network none reproproof npm test
```

## 11. Coverage philosophy

Coverage percentage is not the only quality measure. Priority should be given to:

- High-severity checks.
- Path and command safety.
- Broken and passing fixture behavior.
- Report correctness.
- Offline and Docker behavior.
- Regression tests for every fixed bug.
