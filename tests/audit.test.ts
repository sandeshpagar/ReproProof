import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { auditRepository } from "../src/audit/repository-audit.js";
import { runStaticChecks } from "../src/checks/static-checks.js";
import { RepositoryValidationError } from "../src/security/paths.js";
import { scanRepository } from "../src/scanner/repository.js";

const projectRoot = resolve(process.cwd());
const passingFixture = resolve(projectRoot, "fixtures", "passing-repository");
const brokenFixture = resolve(projectRoot, "fixtures", "broken-repository");

test("passing fixture satisfies every Phase 2 static check", async () => {
  const result = await auditRepository(passingFixture);

  assert.equal(result.score, 100);
  assert.equal(result.findings.length, 8);
  assert.ok(result.findings.every((finding) => finding.status === "pass"));
  assert.ok(result.findings.every((finding) => finding.evidence.length > 0));
  assert.ok(result.findings.every((finding) => finding.remediation.length > 0));
  assert.deepEqual(result.repository.detectedEcosystems, ["node"]);
  assert.equal(result.repository.testCommand, "node test.js");
});

test("broken fixture reports evidence-backed reproducibility blockers", async () => {
  const result = await auditRepository(brokenFixture);
  const failedIds = result.findings.filter((finding) => finding.status === "fail").map((finding) => finding.id);

  assert.ok(result.score < 100);
  assert.ok(failedIds.includes("runtime-pin"));
  assert.ok(failedIds.includes("lockfile"));
  assert.ok(failedIds.includes("dockerfile"));
  assert.ok(failedIds.includes("test-command"));
  assert.ok(failedIds.includes("absolute-paths"));
  assert.ok(failedIds.includes("secret-values"));

  for (const finding of result.findings) {
    assert.ok(finding.title.length > 0);
    assert.ok(finding.description.length > 0);
    assert.ok(finding.remediation.length > 0);
    assert.ok(finding.evidence.length > 0);
  }
});

test("static scoring is deterministic for an unchanged repository", async () => {
  const first = await auditRepository(passingFixture);
  const second = await auditRepository(passingFixture);

  assert.equal(first.score, second.score);
  assert.deepEqual(first.scoreBreakdown, second.scoreBreakdown);
  assert.deepEqual(first.findings, second.findings);
});

test("scanner skips symlinks and exposes repository metadata", async () => {
  const snapshot = await scanRepository(passingFixture);

  assert.equal(snapshot.displayName, "passing-repository");
  assert.ok(snapshot.files.some((file) => file.path === "package.json"));
  assert.ok(snapshot.manifestFiles.includes("package.json"));
  assert.ok(snapshot.lockFiles.includes("package-lock.json"));
});

test("invalid repository paths fail before scanning", async () => {
  await assert.rejects(
    () => scanRepository(resolve(projectRoot, "fixtures", "missing-repository")),
    (error: unknown) => error instanceof RepositoryValidationError,
  );
});

test("static checks always return the documented check set", async () => {
  const snapshot = await scanRepository(passingFixture);
  const ids = runStaticChecks(snapshot).map((finding) => finding.id);

  assert.deepEqual(ids, [
    "runtime-pin",
    "lockfile",
    "dockerfile",
    "environment-template",
    "readme",
    "test-command",
    "absolute-paths",
    "secret-values",
  ]);
});
