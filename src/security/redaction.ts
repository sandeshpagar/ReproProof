const REDACTION = "[REDACTED]";

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\b(?:ghp|github_pat|sk_live|sk_test|xox[baprs])_[A-Za-z0-9_-]{8,}\b/gi,
  /(\b(?:password|passwd|api[_-]?key|secret|token)\s*[:=]\s*["']?)[A-Za-z0-9_./+=-]{8,}/gi,
];

export function redactSecrets(value: string): { value: string; redactionsApplied: boolean } {
  let redacted = value;
  let redactionsApplied = false;

  for (const pattern of SECRET_PATTERNS) {
    const next = redacted.replace(pattern, (match: string, ...parts: unknown[]) => {
      redactionsApplied = true;
      const prefix = typeof parts[0] === "string" ? parts[0] : undefined;
      return prefix ? `${prefix}${REDACTION}` : REDACTION;
    });

    redacted = next;
  }

  return { value: redacted, redactionsApplied };
}
