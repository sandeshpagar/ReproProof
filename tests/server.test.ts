import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import type { DockerRehearsalResult } from "../src/execution/docker-rehearsal.js";
import type { ExecutionResult } from "../src/domain/audit.js";
import { createAppServer, type AppServerOptions } from "../src/server/index.js";

const projectRoot = resolve(process.cwd());
const passingFixture = resolve(projectRoot, "fixtures", "passing-repository");

async function withServer<T>(callback: (baseUrl: string) => Promise<T>, options: AppServerOptions = {}): Promise<T> {
  const server = createAppServer(options);
  await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();

  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Test server did not expose a TCP address.");
  }

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolvePromise, reject) => server.close((error) => (error ? reject(error) : resolvePromise())));
  }
}

test("POST /api/audits returns the static audit result", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/audits`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repositoryPath: passingFixture }),
    });
    const result = (await response.json()) as { score: number; findings: unknown[] };

    assert.equal(response.status, 200);
    assert.equal(result.score, 100);
    assert.equal(result.findings.length, 8);
  });
});

test("POST /api/audits rejects malformed input without running a command", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/audits`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "rm -rf /" }),
    });
    const result = (await response.json()) as { error: string };

    assert.equal(response.status, 400);
    assert.equal(result.error, "repositoryPath must be a string.");
  });
});

test("audit API stores an audit and runs the local project test endpoint", async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/audits`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repositoryPath: passingFixture }),
    });
    const created = (await createResponse.json()) as { auditId: string };

    const getResponse = await fetch(`${baseUrl}/api/audits/${created.auditId}`);
    const stored = (await getResponse.json()) as { auditId: string };
    assert.equal(getResponse.status, 200);
    assert.equal(stored.auditId, created.auditId);

    const testResponse = await fetch(`${baseUrl}/api/audits/${created.auditId}/test`, { method: "POST" });
    const testResult = (await testResponse.json()) as { execution: ExecutionResult; audit: { executions: ExecutionResult[] } };
    assert.equal(testResponse.status, 200);
    assert.equal(testResult.execution.status, "passed");
    assert.equal(testResult.audit.executions.length, 1);
  });
});

test("audit API exposes the clean-room rehearsal endpoint", async () => {
  const fakeRehearsal: DockerRehearsalResult = {
    status: "skipped",
    networkMode: "none",
    imageTag: "reproproof-test-image",
    dockerAvailable: false,
    reason: "Docker is unavailable in this test double.",
    availability: {
      label: "Docker availability check",
      executable: "docker",
      args: ["version"],
      cwd: passingFixture,
      status: "failed",
      exitCode: 1,
      signal: null,
      durationMs: 1,
      stdout: "",
      stderr: "unavailable",
      timedOut: false,
      outputTruncated: false,
      networkMode: "unspecified",
      redactionsApplied: false,
    },
  };

  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/audits`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repositoryPath: passingFixture }),
    });
    const created = (await createResponse.json()) as { auditId: string };
    const rehearsalResponse = await fetch(`${baseUrl}/api/audits/${created.auditId}/rehearsal`, { method: "POST" });
    const rehearsalResult = (await rehearsalResponse.json()) as { rehearsal: DockerRehearsalResult };

    assert.equal(rehearsalResponse.status, 200);
    assert.equal(rehearsalResult.rehearsal.status, "skipped");
    assert.equal(rehearsalResult.rehearsal.networkMode, "none");
  }, { runRehearsal: async () => fakeRehearsal });
});

test("audit API serves versioned JSON and Markdown reports without local paths", async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/audits`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repositoryPath: passingFixture }),
    });
    const created = (await createResponse.json()) as { auditId: string };

    const jsonResponse = await fetch(`${baseUrl}/api/audits/${created.auditId}/report?format=json`);
    const report = (await jsonResponse.json()) as { reportVersion: string; repository: { displayName: string; rootPath?: string } };
    assert.equal(jsonResponse.status, 200);
    assert.equal(report.reportVersion, "1.0.0");
    assert.equal(report.repository.displayName, "passing-repository");
    assert.equal("rootPath" in report.repository, false);
    assert.match(jsonResponse.headers.get("content-disposition") ?? "", /reproproof-report\.json/);

    const markdownResponse = await fetch(`${baseUrl}/api/audits/${created.auditId}/report?format=markdown`);
    const markdown = await markdownResponse.text();
    assert.equal(markdownResponse.status, 200);
    assert.match(markdownResponse.headers.get("content-type") ?? "", /text\/markdown/);
    assert.match(markdown, /# ReproProof reproducibility report/);
    assert.equal(markdown.includes(passingFixture), false);
  });
});

test("audit API rejects unknown report formats", async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/audits`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repositoryPath: passingFixture }),
    });
    const created = (await createResponse.json()) as { auditId: string };
    const response = await fetch(`${baseUrl}/api/audits/${created.auditId}/report?format=xml`);
    const body = (await response.json()) as { error: string };

    assert.equal(response.status, 400);
    assert.match(body.error, /format must be json or markdown/);
  });
});
