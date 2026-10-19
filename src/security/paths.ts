import { realpath, stat } from "node:fs/promises";

export class RepositoryValidationError extends Error {
  public readonly code = "INVALID_REPOSITORY_PATH";

  public constructor(message: string) {
    super(message);
    this.name = "RepositoryValidationError";
  }
}

export async function validateRepositoryPath(input: string): Promise<string> {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new RepositoryValidationError("A repository directory path is required.");
  }

  let resolvedPath: string;

  try {
    resolvedPath = await realpath(input);
  } catch {
    throw new RepositoryValidationError("The repository directory does not exist or cannot be read.");
  }

  try {
    const details = await stat(resolvedPath);

    if (!details.isDirectory()) {
      throw new RepositoryValidationError("The selected repository path must be a directory.");
    }
  } catch (error) {
    if (error instanceof RepositoryValidationError) {
      throw error;
    }

    throw new RepositoryValidationError("The repository directory cannot be accessed.");
  }

  return resolvedPath;
}

export function toRelativeRepositoryPath(rootPath: string, filePath: string): string {
  const relativePath = filePath.slice(rootPath.length).replace(/^[\\/]+/, "");
  return relativePath.split("\\").join("/");
}
