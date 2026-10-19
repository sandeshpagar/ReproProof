import type { AuditResult, ExecutionResult, Finding } from "../domain/audit.js";
import type { DockerRehearsalResult } from "../execution/docker-rehearsal.js";
import { redactSecrets } from "../security/redaction.js";

export const REPORT_VERSION = "1.0.0";

export interface ReportExecution {
  label: string;
  executable: string;
  args: string[];
  status: ExecutionResult["status"];
  exitCode: number | null;
  signal: string | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputTruncated: boolean;
  networkMode: ExecutionResult["networkMode"];
  redactionsApplied: boolean;
  error?: string;
}

export interface ReportRehearsal {
  status: DockerRehearsalResult["status"];
  networkMode: "none";
  imageTag: string;
  dockerAvailable: boolean;
  reason?: string;
  availability: ReportExecution;
  build?: ReportExecution;
  test?: ReportExecution;
  cleanup?: ReportExecution;
}

export interface ReportDocument {
  reportVersion: string;
  generatedAt: string;
  toolVersion: string;
  auditId?: string;
  repository: {
    displayName: string;
    detectedEcosystems: string[];
    manifestFiles: string[];
    lockFiles: string[];
    testCommand?: string;
  };
  score: number;
  scoreBreakdown: AuditResult["scoreBreakdown"];
  findings: Finding[];
  executions: ReportExecution[];
  rehearsal?: ReportRehearsal;
}

const ABSOLUTE_PATH_PATTERN = /(^|[\s"'(=])((?:[A-Za-z]:[\\/]|\/(?:Users|home|root|mnt\/c)(?:[\\/]))[^\s,;)"]*)/g;

function safeText(value: string): string {
  const redacted = redactSecrets(value).value;
  return redacted.replace(ABSOLUTE_PATH_PATTERN, (_match, prefix: string) => `${prefix}<local-path>`);
}

function isPathInside(rootPath: string, value: string): boolean {
  const normalizedRoot = rootPath.replace(/[\\/]$/, "").toLowerCase();
  const normalizedValue = value.toLowerCase();
  return normalizedValue === normalizedRoot || normalizedValue.startsWith(`${normalizedRoot}\\`) || normalizedValue.startsWith(`${normalizedRoot}/`);
}

function safeArgument(value: string, rootPath: string): string {
  if (isPathInside(rootPath, value)) {
    return "<repository>";
  }

  return safeText(value);
}

function safeExecution(execution: ExecutionResult, rootPath: string): ReportExecution {
  return {
    label: safeText(execution.label),
    executable: safeText(execution.executable),
    args: execution.args.map((arg) => safeArgument(arg, rootPath)),
    status: execution.status,
    exitCode: execution.exitCode,
    signal: execution.signal,
    durationMs: execution.durationMs,
    stdout: safeText(execution.stdout),
    stderr: safeText(execution.stderr),
    timedOut: execution.timedOut,
    outputTruncated: execution.outputTruncated,
    networkMode: execution.networkMode,
    redactionsApplied: execution.redactionsApplied,
    error: execution.error ? safeText(execution.error) : undefined,
  };
}

function safeFinding(finding: Finding): Finding {
  return {
    ...finding,
    title: safeText(finding.title),
    description: safeText(finding.description),
    remediation: safeText(finding.remediation),
    evidence: finding.evidence.map((evidence) => ({
      ...evidence,
      file: evidence.file ? safeText(evidence.file) : undefined,
      detail: safeText(evidence.detail),
    })),
  };
}

function safeRehearsal(rehearsal: DockerRehearsalResult, rootPath: string): ReportRehearsal {
  return {
    status: rehearsal.status,
    networkMode: rehearsal.networkMode,
    imageTag: safeText(rehearsal.imageTag),
    dockerAvailable: rehearsal.dockerAvailable,
    reason: rehearsal.reason ? safeText(rehearsal.reason) : undefined,
    availability: safeExecution(rehearsal.availability, rootPath),
    build: rehearsal.build ? safeExecution(rehearsal.build, rootPath) : undefined,
    test: rehearsal.test ? safeExecution(rehearsal.test, rootPath) : undefined,
    cleanup: rehearsal.cleanup ? safeExecution(rehearsal.cleanup, rootPath) : undefined,
  };
}

export function createReport(audit: AuditResult, rehearsal?: DockerRehearsalResult, generatedAt = new Date().toISOString()): ReportDocument {
  return {
    reportVersion: REPORT_VERSION,
    generatedAt,
    toolVersion: audit.toolVersion,
    auditId: audit.auditId,
    repository: {
      displayName: safeText(audit.repository.displayName),
      detectedEcosystems: audit.repository.detectedEcosystems.map(safeText),
      manifestFiles: audit.repository.manifestFiles.map(safeText),
      lockFiles: audit.repository.lockFiles.map(safeText),
      testCommand: audit.repository.testCommand ? safeText(audit.repository.testCommand) : undefined,
    },
    score: audit.score,
    scoreBreakdown: audit.scoreBreakdown.map((item) => ({ ...item })),
    findings: audit.findings.map(safeFinding),
    executions: audit.executions.map((execution) => safeExecution(execution, audit.repository.rootPath)),
    rehearsal: rehearsal ? safeRehearsal(rehearsal, audit.repository.rootPath) : undefined,
  };
}

export function renderJsonReport(report: ReportDocument): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function renderExecution(execution: ReportExecution | undefined): string {
  if (!execution) {
    return "_Not run._";
  }

  const output = [execution.stdout, execution.stderr].filter(Boolean).join("\n");
  return [
    `- **Status:** ${execution.status}`,
    `- **Exit code:** ${execution.exitCode ?? "—"}`,
    `- **Duration:** ${execution.durationMs} ms`,
    `- **Network:** ${execution.networkMode}`,
    output ? `\n\`\`\`text\n${output}\n\`\`\`` : "",
  ].filter(Boolean).join("\n");
}

export function renderMarkdownReport(report: ReportDocument): string {
  const findings = report.findings.map((finding) => {
    const evidence = finding.evidence.map((item) => `- ${item.file ?? "Repository"}${item.line ? `:${item.line}` : ""}: ${item.detail}`).join("\n");
    return [
      `### ${finding.status.toUpperCase()} · ${finding.title}`,
      "",
      finding.description,
      "",
      "**Evidence**",
      evidence,
      "",
      "**Suggested remediation**",
      finding.remediation,
    ].join("\n");
  }).join("\n\n");

  const executions = report.executions.length > 0
    ? report.executions.map((execution) => `### ${execution.label}\n\n${renderExecution(execution)}`).join("\n\n")
    : "_No local execution was recorded._";
  const rehearsal = report.rehearsal
    ? `### Clean-room rehearsal\n\n- **Status:** ${report.rehearsal.status}\n- **Docker available:** ${report.rehearsal.dockerAvailable ? "yes" : "no"}\n- **Network mode:** ${report.rehearsal.networkMode}\n${report.rehearsal.reason ? `- **Reason:** ${report.rehearsal.reason}\n` : ""}\n#### Image build\n\n${renderExecution(report.rehearsal.build)}\n\n#### Network-isolated test\n\n${renderExecution(report.rehearsal.test)}`
    : "_No clean-room rehearsal was recorded._";

  return [
    "# ReproProof reproducibility report",
    "",
    `- **Report version:** ${report.reportVersion}`,
    `- **Tool version:** ${report.toolVersion}`,
    `- **Generated:** ${report.generatedAt}`,
    `- **Repository:** ${report.repository.displayName}`,
    `- **Score:** ${report.score}/100`,
    "",
    "## Repository",
    "",
    `- **Ecosystems:** ${report.repository.detectedEcosystems.join(", ") || "Not detected"}`,
    `- **Manifests:** ${report.repository.manifestFiles.join(", ") || "None"}`,
    `- **Lockfiles:** ${report.repository.lockFiles.join(", ") || "None"}`,
    `- **Test command:** ${report.repository.testCommand ?? "Not detected"}`,
    "",
    "## Score breakdown",
    "",
    "| Check | Status | Earned | Weight |",
    "|---|---|---:|---:|",
    ...report.scoreBreakdown.map((item) => `| ${item.checkId} | ${item.status} | ${item.earned} | ${item.weight} |`),
    "",
    "## Findings",
    "",
    findings || "_No findings._",
    "",
    "## Execution results",
    "",
    executions,
    "",
    "## Clean-room rehearsal",
    "",
    rehearsal,
    "",
  ].join("\n");
}
