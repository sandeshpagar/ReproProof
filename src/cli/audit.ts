import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { auditRepository } from "../audit/repository-audit.js";
import { runCleanRoomRehearsal } from "../execution/docker-rehearsal.js";
import { runProjectTest } from "../execution/project-test.js";
import { createReport, renderJsonReport, renderMarkdownReport } from "../reports/report.js";

type ReportFormat = "markdown" | "json";

interface CliOptions {
  repositoryPath?: string;
  jsonOutput: boolean;
  runTest: boolean;
  runRehearsal: boolean;
  reportFormat?: ReportFormat;
  outputPath?: string;
  invalidReportFormat: boolean;
}

function printUsage(): void {
  console.error("Usage: npm run audit -- <repository-path> [--json] [--test] [--rehearsal] [--report markdown|json] [--output file]");
}

function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = { jsonOutput: false, runTest: false, runRehearsal: false, invalidReportFormat: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--json") {
      options.jsonOutput = true;
    } else if (argument === "--test") {
      options.runTest = true;
    } else if (argument === "--rehearsal") {
      options.runRehearsal = true;
    } else if (argument === "--report") {
      const value = args[index + 1];
      index += 1;
      if (value === "markdown" || value === "json") {
        options.reportFormat = value;
      } else {
        options.invalidReportFormat = true;
      }
    } else if (argument.startsWith("--report=")) {
      const value = argument.slice("--report=".length);
      if (value === "markdown" || value === "json") {
        options.reportFormat = value;
      } else {
        options.invalidReportFormat = true;
      }
    } else if (argument === "--output") {
      options.outputPath = args[index + 1];
      index += 1;
    } else if (argument.startsWith("--output=")) {
      options.outputPath = argument.slice("--output=".length);
    } else if (!argument.startsWith("--") && !options.repositoryPath) {
      options.repositoryPath = argument;
    }
  }

  return options;
}

function printHumanResult(result: Awaited<ReturnType<typeof auditRepository>>): void {
  const passed = result.findings.filter((finding) => finding.status === "pass").length;
  const warnings = result.findings.filter((finding) => finding.status === "warning").length;
  const failures = result.findings.filter((finding) => finding.status === "fail").length;

  console.log(`ReproProof audit: ${result.repository.displayName}`);
  console.log(`Score: ${result.score}/100`);
  console.log(`Checks: ${passed} passed · ${warnings} warnings · ${failures} blockers`);
  console.log("");

  for (const finding of result.findings) {
    const marker = finding.status === "pass" ? "PASS" : finding.status.toUpperCase();
    console.log(`[${marker}] ${finding.title}`);

    if (finding.status !== "pass") {
      console.log(`      ${finding.description}`);
      console.log(`      Fix: ${finding.remediation}`);
    }
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));

  if (!options.repositoryPath || options.invalidReportFormat || (options.outputPath && !options.reportFormat)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const result = await auditRepository(options.repositoryPath);
  const execution = options.runTest ? await runProjectTest(options.repositoryPath) : undefined;
  const rehearsal = options.runRehearsal ? await runCleanRoomRehearsal(options.repositoryPath) : undefined;
  const reportAudit = execution ? { ...result, executions: [...result.executions, execution] } : result;

  if (options.reportFormat) {
    const report = createReport(reportAudit, rehearsal);
    const content = options.reportFormat === "markdown" ? renderMarkdownReport(report) : renderJsonReport(report);

    if (options.outputPath) {
      await writeFile(resolve(options.outputPath), content, "utf8");
      console.error(`Report written to ${resolve(options.outputPath)}`);
    } else {
      process.stdout.write(content);
    }

    return;
  }

  if (options.jsonOutput) {
    console.log(JSON.stringify({ ...result, execution, rehearsal }, null, 2));
    return;
  }

  printHumanResult(result);

  if (execution) {
    console.log(`\nProject test: ${execution.status}`);
    console.log(`Duration: ${execution.durationMs}ms`);
    if (execution.stderr) {
      console.log(execution.stderr);
    }
  }

  if (rehearsal) {
    console.log(`\nClean-room rehearsal: ${rehearsal.status}`);
    if (rehearsal.reason) {
      console.log(`Reason: ${rehearsal.reason}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Audit failed.");
  process.exitCode = 1;
});
