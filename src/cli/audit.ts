import { auditRepository } from "../audit/repository-audit.js";
import { runCleanRoomRehearsal } from "../execution/docker-rehearsal.js";
import { runProjectTest } from "../execution/project-test.js";

function printUsage(): void {
  console.error("Usage: npm run audit -- <repository-path> [--json] [--test] [--rehearsal]");
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

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const runTest = args.includes("--test");
const runRehearsal = args.includes("--rehearsal");
const flags = new Set(["--json", "--test", "--rehearsal"]);
const repositoryPath = args.find((arg) => !flags.has(arg));

if (!repositoryPath) {
  printUsage();
  process.exitCode = 1;
} else {
  try {
    const result = await auditRepository(repositoryPath);
    const execution = runTest ? await runProjectTest(repositoryPath) : undefined;
    const rehearsal = runRehearsal ? await runCleanRoomRehearsal(repositoryPath) : undefined;

    if (jsonOutput) {
      console.log(JSON.stringify({ ...result, execution, rehearsal }, null, 2));
    } else {
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
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Audit failed.");
    process.exitCode = 1;
  }
}
