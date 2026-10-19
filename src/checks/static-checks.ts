import type {
  Evidence,
  Finding,
  FindingSeverity,
  RepositorySnapshot,
} from "../domain/audit.js";
import { getRepositoryFile } from "../scanner/repository.js";

export const CHECK_WEIGHTS = {
  "runtime-pin": 15,
  lockfile: 15,
  dockerfile: 15,
  "environment-template": 10,
  readme: 10,
  "test-command": 10,
  "absolute-paths": 15,
  "secret-values": 10,
} as const;

type CheckId = keyof typeof CHECK_WEIGHTS;

function lineNumber(text: string | undefined, pattern: RegExp): number | undefined {
  if (!text) {
    return undefined;
  }

  const match = text.match(pattern);

  if (!match || match.index === undefined) {
    return undefined;
  }

  return text.slice(0, match.index).split("\n").length;
}

function finding(
  id: CheckId,
  status: Finding["status"],
  severity: FindingSeverity,
  title: string,
  description: string,
  evidence: Evidence[],
  remediation: string,
  blocking: boolean,
): Finding {
  return {
    id,
    status,
    severity,
    title,
    description,
    evidence,
    remediation,
    blocking,
    weight: CHECK_WEIGHTS[id],
  };
}

function pass(
  id: CheckId,
  title: string,
  description: string,
  evidence: Evidence[],
): Finding {
  return finding(id, "pass", "info", title, description, evidence, "No action is required.", false);
}

function fail(
  id: CheckId,
  severity: FindingSeverity,
  title: string,
  description: string,
  evidence: Evidence[],
  remediation: string,
): Finding {
  return finding(id, "fail", severity, title, description, evidence, remediation, true);
}

function readmeFile(snapshot: RepositorySnapshot) {
  return snapshot.files.find((file) => /^(readme(?:\.md|\.txt)?|docs\/readme\.md)$/i.test(file.path));
}

function envTemplateFile(snapshot: RepositorySnapshot) {
  return snapshot.files.find((file) => /^(?:\.env\.example|\.env\.template|example\.env)$/i.test(file.path));
}

function rootFile(snapshot: RepositorySnapshot, fileName: string) {
  return getRepositoryFile(snapshot, fileName);
}

function packageScripts(snapshot: RepositorySnapshot): Record<string, unknown> | undefined {
  const packageFile = rootFile(snapshot, "package.json");

  if (!packageFile?.text) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(packageFile.text);
    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }

    const scripts = (parsed as Record<string, unknown>).scripts;
    return typeof scripts === "object" && scripts !== null ? (scripts as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function runtimePinCheck(snapshot: RepositorySnapshot): Finding {
  const candidates = [".nvmrc", ".node-version", ".tool-versions", "mise.toml", "runtime.txt"];
  const pin = candidates.map((fileName) => rootFile(snapshot, fileName)).find((file) => file?.text?.trim());

  if (pin) {
    return pass(
      "runtime-pin",
      "Runtime version is pinned",
      "The repository declares a concrete runtime version for clean-machine setup.",
      [{ file: pin.path, detail: `Pinned runtime value: ${pin.text?.trim()}` }],
    );
  }

  const packageFile = rootFile(snapshot, "package.json");
  let engineEvidence: Evidence[] = [];

  if (packageFile?.text) {
    try {
      const parsed = JSON.parse(packageFile.text) as { engines?: { node?: unknown } };
      const nodeEngine = parsed.engines?.node;

      if (typeof nodeEngine === "string") {
        engineEvidence = [{ file: packageFile.path, detail: `package.json engines.node is "${nodeEngine}"` }];
      }

      if (/^v?\d+\.\d+\.\d+$/.test(nodeEngine as string)) {
        return pass(
          "runtime-pin",
          "Runtime version is pinned",
          "The package manifest declares an exact Node.js version.",
          engineEvidence,
        );
      }
    } catch {
      engineEvidence = [{ file: packageFile.path, detail: "package.json could not be parsed." }];
    }
  }

  return fail(
    "runtime-pin",
    "high",
    "Runtime version is not pinned",
    "A clean machine cannot know which exact runtime version was tested.",
    engineEvidence.length > 0
      ? engineEvidence
      : [{ detail: "No .nvmrc, .node-version, or exact runtime declaration was found." }],
    "Add an exact runtime pin such as .nvmrc and document the same version in the README.",
  );
}

function lockfileCheck(snapshot: RepositorySnapshot): Finding {
  const nodeProject = snapshot.detectedEcosystems.includes("node");
  const supportedLockfiles = nodeProject
    ? ["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock"]
    : ["uv.lock", "poetry.lock", "go.sum", "cargo.lock"];
  const lockfile = snapshot.lockFiles.find((file) => supportedLockfiles.includes(file.toLowerCase()));

  if (lockfile) {
    return pass(
      "lockfile",
      "Dependency lockfile is present",
      "The repository records dependency resolution for repeatable installation.",
      [{ file: lockfile, detail: "Supported dependency lockfile found." }],
    );
  }

  return fail(
    "lockfile",
    "high",
    "Dependency lockfile is missing",
    "A clean install may resolve different dependency versions from the ones used during development.",
    [{ detail: `Expected one of: ${supportedLockfiles.join(", ")}.` }],
    "Generate and commit the lockfile produced by the selected package manager.",
  );
}

function dockerfileCheck(snapshot: RepositorySnapshot): Finding {
  const dockerfile = rootFile(snapshot, "Dockerfile");

  if (!dockerfile?.text) {
    return fail(
      "dockerfile",
      "high",
      "Dockerfile is missing",
      "The project cannot be rehearsed in a clean Linux container without a container recipe.",
      [{ detail: "No root Dockerfile was found." }],
      "Add a Dockerfile that pins the runtime, installs the lockfile dependencies, and defines a testable command.",
    );
  }

  const hasFrom = /^\s*FROM\s+/im.test(dockerfile.text);
  const hasCopy = /^\s*(?:COPY|ADD)\s+/im.test(dockerfile.text);
  const hasRun = /^\s*RUN\s+/im.test(dockerfile.text);

  if (hasFrom && hasCopy && hasRun) {
    return pass(
      "dockerfile",
      "Dockerfile has a buildable shape",
      "The Dockerfile includes a base image, project copy, and build/install step.",
      [{ file: dockerfile.path, detail: "FROM, COPY/ADD, and RUN instructions found." }],
    );
  }

  return fail(
    "dockerfile",
    "high",
    "Dockerfile is incomplete",
    "The container recipe does not contain the minimum instructions needed for a clean build.",
    [{ file: dockerfile.path, detail: "Expected FROM, COPY or ADD, and RUN instructions." }],
    "Add the missing Dockerfile instructions and verify the image with docker build.",
  );
}

function environmentTemplateCheck(snapshot: RepositorySnapshot): Finding {
  const variableReferences = new Map<string, { file: string; line?: number }>();
  const referencePatterns = [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
    /\$\{([A-Z][A-Z0-9_]*)\}/g,
  ];

  for (const file of snapshot.files) {
    if (!file.text || /(^|\/)\.env\.(?:example|template)$/i.test(file.path)) {
      continue;
    }

    for (const pattern of referencePatterns) {
      for (const match of file.text.matchAll(pattern)) {
        const variable = match[1];
        variableReferences.set(variable, { file: file.path, line: lineNumber(file.text, pattern) });
      }
    }
  }

  const template = envTemplateFile(snapshot);

  if (variableReferences.size === 0) {
    return pass(
      "environment-template",
      "Environment requirements are documented",
      "No runtime environment variables were detected in the scanned files.",
      [{ detail: "No environment variable references found; no template is required for this repository." }],
    );
  }

  if (!template?.text) {
    return fail(
      "environment-template",
      "medium",
      "Environment template is missing",
      "The application references environment variables without documenting their names for a fresh setup.",
      [...variableReferences.entries()].slice(0, 5).map(([variable, location]) => ({
        file: location.file,
        line: location.line,
        detail: `Environment variable ${variable} is referenced here.`,
      })),
      "Add a .env.example containing safe placeholder values for every required variable.",
    );
  }

  const templateVariables = new Set(
    [...template.text.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map((match) => match[1]),
  );
  const missingVariables = [...variableReferences.keys()].filter((variable) => !templateVariables.has(variable));

  if (missingVariables.length > 0) {
    return fail(
      "environment-template",
      "medium",
      "Environment template is incomplete",
      "Some referenced environment variables are not listed in the example template.",
      missingVariables.slice(0, 5).map((variable) => ({
        file: template.path,
        detail: `Missing documented variable: ${variable}`,
      })),
      "Add safe placeholder entries for every required environment variable.",
    );
  }

  return pass(
    "environment-template",
    "Environment requirements are documented",
    "The environment template lists the variables referenced by the scanned files.",
    [{ file: template.path, detail: `Documented variables: ${[...templateVariables].join(", ")}` }],
  );
}

function readmeCheck(snapshot: RepositorySnapshot): Finding {
  const readme = readmeFile(snapshot);

  if (!readme?.text) {
    return fail(
      "readme",
      "medium",
      "README instructions are missing",
      "Contributors do not have a documented entry point for setup and testing.",
      [{ detail: "No README.md, README.txt, or docs/README.md was found." }],
      "Add a README with exact setup, run, and test commands.",
    );
  }

  const hasSetup = /\b(?:setup|install(?:ation)?|getting started|npm\s+(?:ci|install)|pnpm\s+install|yarn\s+install)\b/i.test(
    readme.text,
  );
  const hasTest = /\b(?:npm|pnpm|yarn)\s+test\b|\btesting?\b/i.test(readme.text);

  if (hasSetup && hasTest) {
    return pass(
      "readme",
      "README setup and test instructions are present",
      "The README gives contributors a setup path and a testing reference.",
      [{ file: readme.path, detail: "Setup and test guidance detected." }],
    );
  }

  return fail(
    "readme",
    "medium",
    "README instructions are incomplete",
    "The README does not clearly document both setup and testing.",
    [{ file: readme.path, detail: `Setup guidance: ${hasSetup ? "found" : "missing"}; test guidance: ${hasTest ? "found" : "missing"}.` }],
    "Document exact dependency installation, run, and test commands in the README.",
  );
}

function testCommandCheck(snapshot: RepositorySnapshot): Finding {
  const scripts = packageScripts(snapshot);
  const packageTest = scripts?.test;
  const readme = readmeFile(snapshot);
  const readmeCommand = readme?.text?.match(/\b(?:npm|pnpm|yarn)\s+test\b/);

  if (typeof packageTest === "string" && packageTest.trim().length > 0 && packageTest.trim() !== "...") {
    return pass(
      "test-command",
      "Test command is discoverable",
      "The package manifest declares the command used to run the test suite.",
      [{ file: "package.json", detail: `scripts.test: ${packageTest}` }],
    );
  }

  if (readmeCommand && readme) {
    return pass(
      "test-command",
      "Test command is discoverable",
      "The README documents a standard test command.",
      [{ file: readme.path, line: lineNumber(readme.text, /\b(?:npm|pnpm|yarn)\s+test\b/), detail: readmeCommand[0] }],
    );
  }

  return fail(
    "test-command",
    "high",
    "Test command is not discoverable",
    "A clean machine cannot verify the project without an explicit test command.",
    [{ detail: "No package scripts.test or standard README test command was found." }],
    "Add a deterministic test script and document it in the README.",
  );
}

const ABSOLUTE_PATH_PATTERN = /(?:^|[\s"'(=])(?:[A-Za-z]:[\\/]|\/(?:Users|home|root|mnt\/c)(?:[\\/]|$))/;

function absolutePathCheck(snapshot: RepositorySnapshot): Finding {
  const matches: Evidence[] = [];

  for (const file of snapshot.files) {
    if (!file.text) {
      continue;
    }

    const lines = file.text.split(/\r?\n/);
    lines.forEach((text, index) => {
      if (ABSOLUTE_PATH_PATTERN.test(text)) {
        matches.push({ file: file.path, line: index + 1, detail: "Absolute local path detected; keep paths relative or configurable." });
      }
    });
  }

  if (matches.length === 0) {
    return pass(
      "absolute-paths",
      "No machine-specific absolute paths detected",
      "The scanned text files do not contain common Windows or Unix local paths.",
      [{ detail: "No absolute local path patterns found." }],
    );
  }

  return fail(
    "absolute-paths",
    "high",
    "Machine-specific absolute paths detected",
    "Absolute paths make the project dependent on the original developer's computer.",
    matches.slice(0, 10),
    "Replace absolute paths with repository-relative paths or environment-driven configuration.",
  );
}

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /\b(?:ghp|github_pat|sk_live|sk_test|xox[baprs])_[A-Za-z0-9_-]{8,}\b/i,
  /\b(?:password|passwd|api[_-]?key|secret|token)\s*[:=]\s*["']?([A-Za-z0-9_./+=-]{8,})["']?/i,
];

function secretCheck(snapshot: RepositorySnapshot): Finding {
  const matches: Evidence[] = [];

  for (const file of snapshot.files) {
    if (!file.text || /(^|\/)\.env\.(?:example|template)$/i.test(file.path)) {
      continue;
    }

    const lines = file.text.split(/\r?\n/);
    lines.forEach((text, index) => {
      if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
        matches.push({ file: file.path, line: index + 1, detail: "Secret-like value detected; the value is intentionally not shown." });
      }
    });
  }

  if (matches.length === 0) {
    return pass(
      "secret-values",
      "No secret-like values detected",
      "The scan found no common credential patterns in text files.",
      [{ detail: "No supported secret patterns found." }],
    );
  }

  return fail(
    "secret-values",
    "critical",
    "Secret-like values detected",
    "Credential-like values should not be committed to an open-source repository or included in reports.",
    matches.slice(0, 10),
    "Remove the value, rotate it if it was real, and use environment configuration or a secret manager.",
  );
}

export function runStaticChecks(snapshot: RepositorySnapshot): Finding[] {
  return [
    runtimePinCheck(snapshot),
    lockfileCheck(snapshot),
    dockerfileCheck(snapshot),
    environmentTemplateCheck(snapshot),
    readmeCheck(snapshot),
    testCommandCheck(snapshot),
    absolutePathCheck(snapshot),
    secretCheck(snapshot),
  ];
}
