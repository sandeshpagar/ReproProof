import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import type { ExecutionResult } from "../src/domain/audit.js";
import { runCleanRoomRehearsal } from "../src/execution/docker-rehearsal.js";
import { runCommand } from "../src/execution/command-runner.js";
import { runProjectTest } from "../src/execution/project-test.js";

const projectRoot = resolve(process.cwd());
const passingFixture = resolve(projectRoot, "fixtures", "passing-repository");
const brokenFixture = resolve(projectRoot, "fixtures", "broken-repository");

function nodeCommand(code: string) {
  return {
    label: "Node test command",
    executable: process.execPath,
    args: ["-e", code],
    cwd: projectRoot,
  };
}

function fakeExecution(status: ExecutionResult["status"], spec: { label: string; executable: string; args: string[]; cwd: string; networkMode?: ExecutionResult["networkMode"] }): ExecutionResult {
  return {
    label: spec.label,
    executable: spec.executable,
    args: spec.args,
    cwd: spec.cwd,
    status,
    exitCode: status === "passed" ? 0 : 1,
    signal: null,
    durationMs: 1,
    stdout: status === "passed" ? "ok" : "",
    stderr: status === "passed" ? "" : "failed",
    timedOut: status === "timed_out",
    outputTruncated: false,
    networkMode: spec.networkMode ?? "unspecified",
    redactionsApplied: false,
  };
}

test("command runner executes an argument array and captures success", async () => {
  const result = await runCommand({
    ...nodeCommand("process.stdout.write('ok')"),
    networkMode: "local",
  });

  assert.equal(result.status, "passed");
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "ok");
  assert.equal(result.networkMode, "local");
});

test("command runner captures failures and redacts secret-like output", async () => {
  const result = await runCommand({
    ...nodeCommand("process.stderr.write('token=super-secret-value'); process.exitCode = 3"),
  });

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 3);
  assert.match(result.stderr, /token=\[REDACTED\]/);
  assert.equal(result.redactionsApplied, true);
});

test("command runner enforces timeout and output limits", async () => {
  const timeout = await runCommand({
    ...nodeCommand("setTimeout(() => {}, 1000)"),
    timeoutMs: 25,
  });
  const output = await runCommand({
    ...nodeCommand("process.stdout.write('x'.repeat(1000))"),
    maxOutputBytes: 32,
  });

  assert.equal(timeout.status, "timed_out");
  assert.equal(timeout.timedOut, true);
  assert.equal(output.status, "passed");
  assert.equal(output.outputTruncated, true);
  assert.ok(Buffer.byteLength(output.stdout, "utf8") <= 35);
});

test("project test verification runs the discovered Node test command", async () => {
  const result = await runProjectTest(passingFixture);

  assert.equal(result.status, "passed");
  assert.equal(result.networkMode, "local");
});

test("project test verification skips repositories without a test command", async () => {
  const result = await runProjectTest(brokenFixture);

  assert.equal(result.status, "skipped");
  assert.match(result.error ?? "", /No package scripts\.test/);
});

test("Docker rehearsal runs build and the test with network disabled", async () => {
  const calls: string[][] = [];
  const fakeRun = async (spec: { args: string[]; label: string; executable: string; cwd: string; networkMode?: ExecutionResult["networkMode"] }) => {
    calls.push(spec.args);
    return fakeExecution("passed", spec);
  };

  const result = await runCleanRoomRehearsal(passingFixture, {
    imageTag: "reproproof-test-image",
    run: fakeRun,
  });

  assert.equal(result.status, "passed");
  assert.equal(result.networkMode, "none");
  assert.deepEqual(calls[0], ["version", "--format", "{{.Server.Version}}"]);
  assert.deepEqual(calls[1], ["build", "--tag", "reproproof-test-image", passingFixture]);
  assert.deepEqual(calls[2], ["run", "--rm", "--network", "none", "reproproof-test-image", "npm", "test"]);
  assert.deepEqual(calls[3], ["image", "rm", "--force", "reproproof-test-image"]);
});

test("Docker rehearsal skips cleanly when the daemon is unavailable", async () => {
  const calls: string[][] = [];
  const fakeRun = async (spec: { args: string[]; label: string; executable: string; cwd: string; networkMode?: ExecutionResult["networkMode"] }) => {
    calls.push(spec.args);
    return fakeExecution("failed", spec);
  };

  const result = await runCleanRoomRehearsal(passingFixture, { run: fakeRun });

  assert.equal(result.status, "skipped");
  assert.equal(result.dockerAvailable, false);
  assert.equal(calls.length, 1);
});
