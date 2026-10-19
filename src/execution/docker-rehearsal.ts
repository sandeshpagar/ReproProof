import { createHash } from "node:crypto";

import type { ExecutionResult } from "../domain/audit.js";
import { scanRepository } from "../scanner/repository.js";
import { runCommand, type CommandSpec } from "./command-runner.js";

export type RehearsalStatus = "passed" | "failed" | "skipped";

export interface DockerRehearsalResult {
  status: RehearsalStatus;
  networkMode: "none";
  imageTag: string;
  dockerAvailable: boolean;
  reason?: string;
  availability: ExecutionResult;
  build?: ExecutionResult;
  test?: ExecutionResult;
  cleanup?: ExecutionResult;
}

export interface DockerRehearsalOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
  imageTag?: string;
  run?: (spec: CommandSpec) => Promise<ExecutionResult>;
}

function imageTagFor(repositoryPath: string): string {
  const digest = createHash("sha256").update(repositoryPath).digest("hex").slice(0, 12);
  return `reproproof-rehearsal-${digest}`;
}

function dockerCommand(
  label: string,
  args: string[],
  repositoryPath: string,
  options: DockerRehearsalOptions,
  networkMode: CommandSpec["networkMode"] = "unspecified",
): CommandSpec {
  return {
    label,
    executable: "docker",
    args,
    cwd: repositoryPath,
    timeoutMs: options.timeoutMs ?? 120_000,
    maxOutputBytes: options.maxOutputBytes,
    networkMode,
  };
}

export async function runCleanRoomRehearsal(
  repositoryPath: string,
  options: DockerRehearsalOptions = {},
): Promise<DockerRehearsalResult> {
  const snapshot = await scanRepository(repositoryPath);
  const run = options.run ?? runCommand;
  const imageTag = options.imageTag ?? imageTagFor(snapshot.rootPath);
  const availability = await run(dockerCommand(
    "Docker availability check",
    ["version", "--format", "{{.Server.Version}}"],
    snapshot.rootPath,
    { ...options, timeoutMs: Math.min(options.timeoutMs ?? 5_000, 5_000) },
  ));

  if (availability.status !== "passed") {
    return {
      status: "skipped",
      networkMode: "none",
      imageTag,
      dockerAvailable: false,
      reason: "Docker is unavailable or the Docker daemon is not running.",
      availability,
    };
  }

  if (!snapshot.testCommand) {
    return {
      status: "skipped",
      networkMode: "none",
      imageTag,
      dockerAvailable: true,
      reason: "No package scripts.test command was found for the rehearsal.",
      availability,
    };
  }

  const build = await run(dockerCommand(
    "Docker image build",
    ["build", "--tag", imageTag, snapshot.rootPath],
    snapshot.rootPath,
    options,
  ));

  if (build.status !== "passed") {
    const cleanup = await run(dockerCommand(
      "Docker image cleanup",
      ["image", "rm", "--force", imageTag],
      snapshot.rootPath,
      options,
    ));

    return {
      status: "failed",
      networkMode: "none",
      imageTag,
      dockerAvailable: true,
      reason: "Docker image build failed.",
      availability,
      build,
      cleanup,
    };
  }

  const test = await run(dockerCommand(
    "Network-isolated project test",
    ["run", "--rm", "--network", "none", imageTag, "npm", "test"],
    snapshot.rootPath,
    options,
    "none",
  ));
  const cleanup = await run(dockerCommand(
    "Docker image cleanup",
    ["image", "rm", "--force", imageTag],
    snapshot.rootPath,
    options,
  ));

  return {
    status: test.status === "passed" ? "passed" : "failed",
    networkMode: "none",
    imageTag,
    dockerAvailable: true,
    reason: test.status === "passed" ? undefined : "The network-isolated project test failed.",
    availability,
    build,
    test,
    cleanup,
  };
}
