# ReproProof Product and Interface Design

**Status:** Planning baseline
**Design direction:** Evidence-first developer tooling
**Last updated:** 2026-10-19

## 1. Design principles

### Evidence over decoration

The product must explain why it reached a result. A score without evidence is not useful to a maintainer.

### One clear primary workflow

The first release should guide the user from repository selection to audit result to report export without requiring multiple configuration pages.

### Serious but approachable

The visual style should feel like a trusted developer tool, not a game or marketing landing page. Use plain language and explain technical terms in context.

### Failure is useful information

Errors should tell the user what happened, why it matters, and what to try next. A skipped Docker rehearsal must not look like a passing rehearsal.

## 2. Primary user journey

```text
Select repository
        |
        v
Review audit scope
        |
        v
Run static audit
        |
        v
Understand score and findings
        |
        v
Run clean-room rehearsal
        |
        v
Export report
```

## 3. Screen design

### Screen A: Audit start

Purpose: let the user start quickly and understand what will happen.

Elements:

- ReproProof logo and short product promise.
- Repository path input.
- Browse/select control where supported.
- Recent local paths only for the current session; no remote history.
- Audit scope summary:
  - Static checks.
  - Test command discovery.
  - Optional Docker rehearsal.
- Primary button: `Run Audit`.
- Small note: “Your repository stays on this machine.”

### Screen B: Audit summary

Purpose: answer “Can this project be rebuilt?” at a glance.

Suggested layout:

```text
+----------------------------------------------------------------+
| ReproProof                         /sample-project              |
| Clean-machine readiness audit                                  |
+----------------------------------------------------------------+
|             72 / 100                                           |
|       Needs attention                                           |
|  6 passed       2 warnings       2 blockers                     |
+----------------------------------------------------------------+
| [Run clean-room rehearsal] [Export Markdown] [Export JSON]      |
+----------------------------------------------------------------+
| Blockers                                                        |
| [!] Runtime version is not pinned                    HIGH      |
| [!] Test command requires network access             HIGH      |
+----------------------------------------------------------------+
| Warnings                                                        |
| [!] .env.example is missing                         MEDIUM     |
+----------------------------------------------------------------+
```

### Screen C: Finding details

Each finding opens a detail panel or expands inline.

Required sections:

1. Finding title.
2. Status and severity.
3. Why it matters.
4. Evidence.
5. Affected file and line when available.
6. Recommended remediation.
7. Whether it blocks a clean-room pass.

Example:

```text
Runtime version is not pinned

HIGH · BLOCKING

Why it matters
The package requires Node.js 22, but a fresh machine has no exact
version instruction. A different runtime can resolve or execute the
project differently.

Evidence
package.json: engines.node = ">=22"
No .nvmrc, .node-version, or toolchain file found.

Suggested remediation
Add an .nvmrc file with the tested Node.js version and document it in
the README.
```

### Screen D: Rehearsal output

Purpose: show whether the project actually ran in the selected policy.

Show:

- Docker availability.
- Network mode.
- Image build status.
- Test command.
- Duration.
- Exit code.
- Bounded stdout and stderr.
- Clear result: passed, failed, or skipped.

### Screen E: Empty and error states

The UI must cover:

- No repository selected.
- Empty directory.
- Invalid path.
- Unsupported project shape.
- Docker unavailable.
- Audit already running.
- Command timeout.
- Report export failure.

Each state must have a clear next action.

## 4. Visual system

### Color semantics

| Meaning | Color family | Usage |
|---|---|---|
| Passed | Green | Successful checks and completed rehearsal |
| Warning | Amber | Non-blocking improvement |
| Failure | Red | Blocking issue or failed command |
| Information | Blue | Explanatory and neutral status |
| Primary action | Indigo or violet | Buttons and selected navigation |

Colors must not be the only signal. Every status also needs text and an icon or label for accessibility.

### Typography

- Use a highly readable sans-serif for UI text.
- Use a monospace font for paths, commands, and evidence.
- Keep headings short and sentence case.
- Avoid unexplained abbreviations.

### Layout

- Desktop-first because repository auditing is primarily a developer workflow.
- Responsive enough for a narrow laptop viewport.
- Keep the score visible while findings scroll.
- Use cards sparingly; avoid excessive rounded containers.

## 5. Interaction rules

- Disable the audit button while an audit is running.
- Show progress by stage: scanning, checking, executing, reporting.
- Preserve the last completed result in the current session.
- Allow the user to rerun after changing repository files.
- Never present stale findings as current without showing the audit timestamp.
- Make report export available only after a result exists.
- Require confirmation before starting execution checks if the repository is not trusted.

## 6. Accessibility requirements

- Keyboard-operable controls.
- Visible focus state.
- Labels associated with inputs.
- Sufficient color contrast.
- Status text readable by screen readers.
- Do not rely on hover-only explanations.
- Use `aria-live` for audit progress and completion updates.

## 7. Demo-oriented design choices

The most important visual moment is the score transition:

```text
Before: 48 / 100 · 3 blockers
After:  100 / 100 · clean-room rehearsal passed
```

The demo fixture should contain realistic but safe problems. The interface should make the reason for each score change obvious.

## 8. Design acceptance criteria

- A first-time user can start an audit without documentation.
- The score and blocker count are visible immediately after completion.
- A user can reach the evidence for every blocker in one interaction.
- A skipped Docker check is visibly different from a pass.
- Report export is discoverable.
- The dashboard remains usable at laptop width.
