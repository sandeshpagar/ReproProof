import type { Finding, ScoreBreakdown } from "../domain/audit.js";
import { CHECK_WEIGHTS } from "../checks/static-checks.js";

export interface ScoreResult {
  score: number;
  breakdown: ScoreBreakdown[];
}

export function calculateScore(findings: Finding[]): ScoreResult {
  const breakdown = Object.entries(CHECK_WEIGHTS).map(([checkId, weight]) => {
    const finding = findings.find((candidate) => candidate.id === checkId);
    const status = finding?.status ?? "skipped";
    const earned = status === "pass" ? weight : status === "warning" ? weight / 2 : 0;

    return {
      checkId,
      weight,
      earned,
      status,
    } satisfies ScoreBreakdown;
  });
  const totalWeight = breakdown.reduce((total, item) => total + item.weight, 0);
  const earnedWeight = breakdown.reduce((total, item) => total + item.earned, 0);

  return {
    score: Math.round((earnedWeight / totalWeight) * 100),
    breakdown,
  };
}
