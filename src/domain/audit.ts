export type FindingStatus = "pass" | "warning" | "fail" | "skipped";

export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface Evidence {
  file?: string;
  line?: number;
  detail: string;
}

export interface Finding {
  id: string;
  status: FindingStatus;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Evidence[];
  remediation: string;
  blocking: boolean;
  weight: number;
}

export interface RepositoryFile {
  path: string;
  size: number;
  text?: string;
}

export interface RepositoryDescriptor {
  rootPath: string;
  displayName: string;
  detectedEcosystems: string[];
  manifestFiles: string[];
  lockFiles: string[];
  testCommand?: string;
}

export interface RepositorySnapshot extends RepositoryDescriptor {
  files: RepositoryFile[];
  skippedPaths: string[];
}

export interface ScoreBreakdown {
  checkId: string;
  weight: number;
  earned: number;
  status: FindingStatus;
}

export type ExecutionStatus = "passed" | "failed" | "timed_out" | "skipped" | "spawn_error";

export type NetworkMode = "none" | "local" | "unspecified";

export interface ExecutionResult {
  label: string;
  executable: string;
  args: string[];
  cwd: string;
  status: ExecutionStatus;
  exitCode: number | null;
  signal: string | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputTruncated: boolean;
  networkMode: NetworkMode;
  redactionsApplied: boolean;
  error?: string;
}

export interface AuditResult {
  toolVersion: string;
  auditId?: string;
  repository: RepositoryDescriptor;
  startedAt: string;
  finishedAt: string;
  score: number;
  scoreBreakdown: ScoreBreakdown[];
  findings: Finding[];
  executions: ExecutionResult[];
}
