import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { auditRepository } from "../audit/repository-audit.js";
import { RepositoryValidationError } from "../security/paths.js";
import { getHealthResponse } from "./health.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4173;
const webFiles: Record<string, string> = {
  "/": "index.html",
  "/index.html": "index.html",
  "/styles.css": "styles.css",
  "/app.js": "app.js",
};

export interface AppServerOptions {
  webRoot?: string;
  runAudit?: typeof auditRepository;
}

function getPort(value: string | undefined): number {
  const port = Number(value ?? DEFAULT_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return DEFAULT_PORT;
  }

  return port;
}

function writeJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function serveStaticFile(
  response: import("node:http").ServerResponse,
  webRoot: string,
  pathname: string,
): Promise<void> {
  const fileName = webFiles[pathname];

  if (!fileName) {
    writeJson(response, 404, { error: "Not found" });
    return;
  }

  const filePath = resolve(webRoot, fileName);
  const content = await readFile(filePath);
  response.writeHead(200, { "content-type": contentType(filePath) });
  response.end(content);
}

async function readJsonBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const maxBodyBytes = 64 * 1024;
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > maxBodyBytes) {
      throw new Error("Request body is too large.");
    }

    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

export function createAppServer(options: AppServerOptions = {}) {
  const webRoot = options.webRoot ?? resolve(process.cwd(), "web");
  const runAudit = options.runAudit ?? auditRepository;

  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "GET" && requestUrl.pathname === "/api/health") {
        writeJson(response, 200, getHealthResponse());
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/audits") {
        const body = await readJsonBody(request);

        if (typeof body !== "object" || body === null || typeof (body as { repositoryPath?: unknown }).repositoryPath !== "string") {
          writeJson(response, 400, { error: "repositoryPath must be a string." });
          return;
        }

        const result = await runAudit((body as { repositoryPath: string }).repositoryPath);
        writeJson(response, 200, result);
        return;
      }

      if (request.method === "GET") {
        await serveStaticFile(response, webRoot, requestUrl.pathname);
        return;
      }

      writeJson(response, 405, { error: "Method not allowed" });
    } catch (error) {
      if (error instanceof RepositoryValidationError) {
        writeJson(response, 400, { error: error.message, code: error.code });
        return;
      }

      if (error instanceof Error && (error.message === "Request body is too large." || error.message === "Request body must be valid JSON.")) {
        writeJson(response, 400, { error: error.message });
        return;
      }

      console.error("Request failed:", error instanceof Error ? error.message : "unknown error");
      writeJson(response, 500, { error: "Internal server error" });
    }
  });
}

export function startServer(): ReturnType<typeof createAppServer> {
  const host = process.env.HOST ?? DEFAULT_HOST;
  const port = getPort(process.env.PORT);
  const server = createAppServer();

  server.listen(port, host, () => {
    console.log(`ReproProof is running at http://${host}:${port}`);
  });

  return server;
}

const currentModulePath = fileURLToPath(import.meta.url);
const entryPointPath = process.argv[1] ? resolve(process.argv[1]) : "";

if (currentModulePath === entryPointPath) {
  startServer();
}
