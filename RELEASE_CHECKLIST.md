# ReproProof Release and Submission Checklist

Use this checklist before publishing the final buildathon submission.

## Repository hygiene

- [ ] `git status --short` is clean.
- [ ] No `.env` files are tracked.
- [ ] No credentials, tokens, or private payloads are tracked.
- [ ] No personal absolute paths appear in committed application files.
- [ ] `LICENSE` is present and matches the README.
- [ ] `package-lock.json` is committed.
- [ ] `.nvmrc` is committed.
- [ ] `Dockerfile` is committed.
- [ ] `.env.example` contains placeholders only.

## Fresh-checkout verification

From a fresh checkout, run:

```bash
npm ci
npm test
npm run build
```

After the dependency cache is populated, also verify:

```bash
npm ci --offline
npm test
```

Then run the judge-style Docker verification:

```bash
docker build -t reproproof .
docker run --rm --network none reproproof npm test
```

## Product verification

- [ ] `npm start` opens the dashboard.
- [ ] Passing fixture scores `100/100`.
- [ ] Broken fixture shows the expected blockers.
- [ ] Finding filters work.
- [ ] Evidence panels open.
- [ ] Local project test passes.
- [ ] Docker rehearsal passes when Docker is available.
- [ ] Docker unavailable is displayed as `skipped`, not `passed`.
- [ ] Markdown report downloads.
- [ ] JSON report downloads.
- [ ] Reports contain no raw secret-like values.
- [ ] Reports contain no absolute local working directory.

## Public repository verification

- [ ] GitHub repository is public.
- [ ] Repository URL is the account connected to the buildathon.
- [ ] `origin/master` points to the final release commit.
- [ ] GitHub Actions workflow is present and green.
- [ ] README setup, run, test, Docker, and demo instructions are current.
- [ ] `DEMO.md` has been reviewed before recording.
- [ ] Screenshots do not contain private paths or credentials.

## Buildathon submission

- [ ] Join/buildathon registration is complete.
- [ ] Exact OmniRush session IDs are copied into the buildathon submission form.
- [ ] Demo video is recorded and uploaded as unlisted/public according to the rules.
- [ ] Public GitHub repository URL is submitted.
- [ ] Live link is supplied if one is available.
- [ ] Submission is completed before the published deadline.
- [ ] Submission ID is saved in private notes.

## Final evidence to preserve

Record these values privately after submission:

```text
Final commit: ______________________________
GitHub URL: ________________________________
Demo URL: __________________________________
Submission ID: _____________________________
Submitted at: ______________________________
```
