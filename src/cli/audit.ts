import { auditRepository } from "../audit/repository-audit.js";

function printUsage(): void {
  console.error("Usage: npm run audit -- <repository-path> [--json]");
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
const repositoryPath = args.find((arg) => arg !== "--json");

if (!repositoryPath) {
  printUsage();
  process.exitCode = 1;
} else {
  try {
    const result = await auditRepository(repositoryPath);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printHumanResult(result);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Audit failed.");
    process.exitCode = 1;
  }
}
