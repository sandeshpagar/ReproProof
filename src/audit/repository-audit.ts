import type { AuditResult } from "../domain/audit.js";
import { runStaticChecks } from "../checks/static-checks.js";
import { calculateScore } from "../scoring/score.js";
import { scanRepository } from "../scanner/repository.js";

export const TOOL_VERSION = "0.1.0";

export async function auditRepository(repositoryPath: string): Promise<AuditResult> {
  const startedAt = new Date().toISOString();
  const snapshot = await scanRepository(repositoryPath);
  const findings = runStaticChecks(snapshot);
  const score = calculateScore(findings);
  const finishedAt = new Date().toISOString();

  return {
    toolVersion: TOOL_VERSION,
    repository: {
      rootPath: snapshot.rootPath,
      displayName: snapshot.displayName,
      detectedEcosystems: snapshot.detectedEcosystems,
      manifestFiles: snapshot.manifestFiles,
      lockFiles: snapshot.lockFiles,
      testCommand: snapshot.testCommand,
    },
    startedAt,
    finishedAt,
    score: score.score,
    scoreBreakdown: score.breakdown,
    findings,
    executions: [],
  };
}
