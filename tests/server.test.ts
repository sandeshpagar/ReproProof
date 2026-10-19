import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { createAppServer } from "../src/server/index.js";

const projectRoot = resolve(process.cwd());
const passingFixture = resolve(projectRoot, "fixtures", "passing-repository");

async function withServer<T>(callback: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createAppServer();
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
