import { spawn } from "node:child_process";

import type { ExecutionResult, NetworkMode } from "../domain/audit.js";
import { redactSecrets } from "../security/redaction.js";

export interface CommandSpec {
  label: string;
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  networkMode?: NetworkMode;
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;

function appendBounded(buffer: string, chunk: Buffer, maxBytes: number): { value: string; truncated: boolean } {
  const remainingBytes = maxBytes - Buffer.byteLength(buffer, "utf8");

  if (remainingBytes <= 0) {
    return { value: buffer, truncated: true };
  }

  const chunkText = chunk.toString("utf8");

  if (Buffer.byteLength(chunkText, "utf8") <= remainingBytes) {
    return { value: buffer + chunkText, truncated: false };
  }

  return {
    value: buffer + chunkText.slice(0, Math.max(0, remainingBytes - 1)) + "…",
    truncated: true,
  };
}

export function runCommand(spec: CommandSpec): Promise<ExecutionResult> {
  const timeoutMs = spec.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = spec.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let outputTruncated = false;
    let timedOut = false;
    let settled = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const finish = (result: Omit<ExecutionResult, "durationMs" | "stdout" | "stderr" | "outputTruncated" | "redactionsApplied">) => {
      if (settled) {
        return;
      }

      settled = true;

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      const redactedStdout = redactSecrets(stdout);
      const redactedStderr = redactSecrets(stderr);

      resolve({
        ...result,
        durationMs: Date.now() - startedAt,
        stdout: redactedStdout.value,
        stderr: redactedStderr.value,
        outputTruncated,
        redactionsApplied: redactedStdout.redactionsApplied || redactedStderr.redactionsApplied,
      });
    };

    let child;

    try {
      child = spawn(spec.executable, spec.args, {
        cwd: spec.cwd,
        env: spec.env ?? process.env,
        shell: false,
        windowsHide: true,
      });
    } catch (error) {
      finish({
        label: spec.label,
        executable: spec.executable,
        args: spec.args,
        cwd: spec.cwd,
        status: "spawn_error",
        exitCode: null,
        signal: null,
        timedOut: false,
        networkMode: spec.networkMode ?? "unspecified",
        error: error instanceof Error ? error.message : "Unable to start command.",
      });
      return;
    }

    child.stdout.on("data", (chunk: Buffer) => {
      const result = appendBounded(stdout, chunk, maxOutputBytes);
      stdout = result.value;
      outputTruncated ||= result.truncated;
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const result = appendBounded(stderr, chunk, maxOutputBytes);
      stderr = result.value;
      outputTruncated ||= result.truncated;
    });

    child.once("error", (error) => {
      finish({
        label: spec.label,
        executable: spec.executable,
        args: spec.args,
        cwd: spec.cwd,
        status: "spawn_error",
        exitCode: null,
        signal: null,
        timedOut,
        networkMode: spec.networkMode ?? "unspecified",
        error: error.message,
      });
    });

    child.once("close", (exitCode, signal) => {
      const status = timedOut ? "timed_out" : exitCode === 0 ? "passed" : "failed";

      finish({
        label: spec.label,
        executable: spec.executable,
        args: spec.args,
        cwd: spec.cwd,
        status,
        exitCode,
        signal,
        timedOut,
        networkMode: spec.networkMode ?? "unspecified",
      });
    });

    timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
  });
}

export function nodePackageManager(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function nodePackageManagerInvocation(args: string[]): { executable: string; args: string[] } {
  if (process.platform === "win32") {
    // Windows exposes npm as a .cmd shim. The command and every argument here are
    // selected by ReproProof, never supplied as a raw shell string by the user.
    return {
      executable: process.env.ComSpec ?? "cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd", ...args],
    };
  }

  return { executable: "npm", args };
}
