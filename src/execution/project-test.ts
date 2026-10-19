import type { ExecutionResult } from "../domain/audit.js";
import { nodePackageManagerInvocation, runCommand } from "./command-runner.js";
import { scanRepository } from "../scanner/repository.js";

export interface ProjectTestOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export async function runProjectTest(repositoryPath: string, options: ProjectTestOptions = {}): Promise<ExecutionResult> {
  const snapshot = await scanRepository(repositoryPath);
  const invocation = nodePackageManagerInvocation(["test"]);

  if (!snapshot.testCommand) {
    return {
      label: "Project test suite",
      executable: invocation.executable,
      args: invocation.args,
      cwd: snapshot.rootPath,
      status: "skipped",
      exitCode: null,
      signal: null,
      durationMs: 0,
      stdout: "",
      stderr: "",
      timedOut: false,
      outputTruncated: false,
      networkMode: "local",
      redactionsApplied: false,
      error: "No package scripts.test command was found.",
    };
  }

  return runCommand({
    label: "Project test suite",
    executable: invocation.executable,
    args: invocation.args,
    cwd: snapshot.rootPath,
    timeoutMs: options.timeoutMs,
    maxOutputBytes: options.maxOutputBytes,
    networkMode: "local",
  });
}
