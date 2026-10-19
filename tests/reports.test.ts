import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { auditRepository } from "../src/audit/repository-audit.js";
import type { ExecutionResult } from "../src/domain/audit.js";
import { createReport, renderJsonReport, renderMarkdownReport, REPORT_VERSION } from "../src/reports/report.js";
import { RepositoryValidationError, toRelativeRepositoryPath, validateRepositoryPath } from "../src/security/paths.js";
import { redactSecrets } from "../src/security/redaction.js";

const projectRoot = resolve(process.cwd());
const passingFixture = resolve(projectRoot, "fixtures", "passing-repository");

function sampleExecution(rootPath: string): ExecutionResult {
  return {
    label: "Project test suite",
    executable: "npm",
    args: ["test", rootPath],
    cwd: rootPath,
    status: "passed",
    exitCode: 0,
    signal: null,
    durationMs: 12,
    stdout: "token=super-secret-value",
    stderr: "",
    timedOut: false,
    outputTruncated: false,
    networkMode: "local",
    redactionsApplied: true,
  };
}

test("reports have a versioned redacted JSON and Markdown representation", async () => {
  const audit = await auditRepository(passingFixture);
  audit.executions = [sampleExecution(audit.repository.rootPath)];
  audit.repository.testCommand = "node C:\\Users\\developer\\private-test.js";
  const report = createReport(audit, undefined, "2026-01-01T00:00:00.000Z");
  const json = renderJsonReport(report);
  const markdown = renderMarkdownReport(report);

  assert.equal(report.reportVersion, REPORT_VERSION);
  assert.equal(report.generatedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(report.repository.displayName, "passing-repository");
  assert.equal("rootPath" in report.repository, false);
  assert.equal(json.includes(audit.repository.rootPath), false);
  assert.equal(json.includes("cwd"), false);
  assert.equal(json.includes("super-secret-value"), false);
  assert.equal(json.includes("C:\\Users\\developer"), false);
  assert.match(json, /"reportVersion": "1\.0\.0"/);
  assert.match(markdown, /# ReproProof reproducibility report/);
  assert.match(markdown, /## Findings/);
  assert.match(markdown, /## Execution results/);
});

test("empty and malformed repositories return findings instead of crashing", async () => {
  const emptyDirectory = await mkdtemp(resolve(tmpdir(), "reproproof-empty-"));
  const malformedDirectory = await mkdtemp(resolve(tmpdir(), "reproproof-malformed-"));

  try {
    const emptyAudit = await auditRepository(emptyDirectory);
    assert.equal(emptyAudit.findings.length, 8);
    assert.ok(emptyAudit.score < 100);

    await writeFile(resolve(malformedDirectory, "package.json"), "{not valid json", "utf8");
    await writeFile(resolve(malformedDirectory, "README.md"), "# Malformed fixture\n", "utf8");
    const malformedAudit = await auditRepository(malformedDirectory);
    assert.equal(malformedAudit.findings.length, 8);
    assert.ok(malformedAudit.findings.some((finding) => finding.id === "runtime-pin" && finding.status === "fail"));
  } finally {
    await Promise.all([rm(emptyDirectory, { recursive: true, force: true }), rm(malformedDirectory, { recursive: true, force: true })]);
  }
});

test("path handling is cross-platform and refuses traversal", async () => {
  assert.equal(toRelativeRepositoryPath("C:\\repo", "C:\\repo\\src\\index.ts"), "src/index.ts");
  assert.equal(toRelativeRepositoryPath("D:\\workspace\\repo", "D:\\workspace\\repo\\README.md"), "README.md");
  assert.throws(() => toRelativeRepositoryPath("C:\\repo", "C:\\other\\secret.txt"), RepositoryValidationError);
  await assert.rejects(() => validateRepositoryPath("bad\0path"), RepositoryValidationError);
});

test("secret redaction masks credentials without exposing the raw value", () => {
  const result = redactSecrets("token=super-secret-value password=another-secret-value");

  assert.equal(result.redactionsApplied, true);
  assert.equal(result.value.includes("super-secret-value"), false);
  assert.equal(result.value.includes("another-secret-value"), false);
  assert.match(result.value, /\[REDACTED\]/);
});

test("report JSON can be written as an explicit local artifact", async () => {
  const audit = await auditRepository(passingFixture);
  const report = createReport(audit, undefined, "2026-01-01T00:00:00.000Z");
  const directory = await mkdtemp(resolve(tmpdir(), "reproproof-report-"));
  const reportPath = resolve(directory, "report.json");

  try {
    await writeFile(reportPath, renderJsonReport(report), "utf8");
    const parsed = JSON.parse(await readFile(reportPath, "utf8")) as { score: number; reportVersion: string };
    assert.equal(parsed.score, 100);
    assert.equal(parsed.reportVersion, REPORT_VERSION);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
