import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import type { RepositoryFile, RepositorySnapshot } from "../domain/audit.js";
import { toRelativeRepositoryPath, validateRepositoryPath } from "../security/paths.js";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  "out",
  "target",
  "vendor",
  ".reproproof",
]);

const MAX_FILES = 2_000;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

interface ScanState {
  files: RepositoryFile[];
  skippedPaths: string[];
  totalBytes: number;
}

function isTextBuffer(buffer: Buffer): boolean {
  return !buffer.subarray(0, Math.min(buffer.length, 8_192)).includes(0);
}

async function scanDirectory(rootPath: string, currentPath: string, state: ScanState): Promise<void> {
  if (state.files.length >= MAX_FILES || state.totalBytes >= MAX_TOTAL_BYTES) {
    return;
  }

  const entries = (await readdir(currentPath, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const entry of entries) {
    if (state.files.length >= MAX_FILES || state.totalBytes >= MAX_TOTAL_BYTES) {
      break;
    }

    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const fullPath = join(currentPath, entry.name);
    const relativePath = toRelativeRepositoryPath(rootPath, fullPath);

    // Symlinks are deliberately skipped so an audit cannot walk outside the selected root.
    if (entry.isSymbolicLink()) {
      state.skippedPaths.push(relativePath);
      continue;
    }

    if (entry.isDirectory()) {
      await scanDirectory(rootPath, fullPath, state);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    let details;

    try {
      details = await lstat(fullPath);
    } catch {
      state.skippedPaths.push(relativePath);
      continue;
    }

    if (details.size > MAX_FILE_BYTES || state.totalBytes + details.size > MAX_TOTAL_BYTES) {
      state.skippedPaths.push(relativePath);
      continue;
    }

    try {
      const buffer = await readFile(fullPath);
      state.totalBytes += buffer.byteLength;
      state.files.push({
        path: relativePath,
        size: buffer.byteLength,
        text: isTextBuffer(buffer) ? buffer.toString("utf8") : undefined,
      });
    } catch {
      state.skippedPaths.push(relativePath);
    }
  }
}

function findFile(files: RepositoryFile[], filePath: string): RepositoryFile | undefined {
  return files.find((file) => file.path.toLowerCase() === filePath.toLowerCase());
}

function parsePackageJson(files: RepositoryFile[]): Record<string, unknown> | undefined {
  const packageFile = findFile(files, "package.json");

  if (!packageFile?.text) {
    return undefined;
  }

  try {
    const value: unknown = JSON.parse(packageFile.text);
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function getStringScript(packageJson: Record<string, unknown> | undefined): string | undefined {
  const scripts = packageJson?.scripts;

  if (typeof scripts !== "object" || scripts === null) {
    return undefined;
  }

  const testScript = (scripts as Record<string, unknown>).test;
  return typeof testScript === "string" && testScript.trim().length > 0 ? testScript.trim() : undefined;
}

export async function scanRepository(inputPath: string): Promise<RepositorySnapshot> {
  const rootPath = await validateRepositoryPath(inputPath);
  const state: ScanState = { files: [], skippedPaths: [], totalBytes: 0 };
  await scanDirectory(rootPath, rootPath, state);

  const manifestFiles = state.files
    .filter((file) =>
      ["package.json", "pyproject.toml", "go.mod", "Cargo.toml", "pom.xml", "build.gradle"].includes(
        file.path,
      ),
    )
    .map((file) => file.path);
  const lockFiles = state.files
    .filter((file) =>
      [
        "package-lock.json",
        "npm-shrinkwrap.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "uv.lock",
        "poetry.lock",
        "go.sum",
        "cargo.lock",
      ].includes(file.path.toLowerCase()),
    )
    .map((file) => file.path);
  const packageJson = parsePackageJson(state.files);
  const detectedEcosystems: string[] = [];

  if (findFile(state.files, "package.json")) {
    detectedEcosystems.push("node");
  }

  if (findFile(state.files, "pyproject.toml")) {
    detectedEcosystems.push("python");
  }

  if (findFile(state.files, "go.mod")) {
    detectedEcosystems.push("go");
  }

  if (findFile(state.files, "cargo.toml")) {
    detectedEcosystems.push("rust");
  }

  return {
    rootPath,
    displayName: basename(rootPath),
    detectedEcosystems,
    manifestFiles,
    lockFiles,
    testCommand: getStringScript(packageJson),
    files: state.files,
    skippedPaths: state.skippedPaths,
  };
}

export function getRepositoryFile(snapshot: RepositorySnapshot, filePath: string): RepositoryFile | undefined {
  return snapshot.files.find((file) => file.path.toLowerCase() === filePath.toLowerCase());
}
