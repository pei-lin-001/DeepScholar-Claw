import {
  collectUnverifiedClaims,
  validateClaimLedgerEntry,
  type ClaimLedgerEntry,
  type ValidationIssue,
} from "@deepscholar/contracts";

export type ClaimLedgerSummary = {
  readonly total: number;
  readonly verified: number;
  readonly pending: number;
  readonly issues: readonly ValidationIssue[];
};

export function summarizeClaimLedger(entries: readonly ClaimLedgerEntry[]): ClaimLedgerSummary {
  const pending = collectUnverifiedClaims(entries);
  const issues = entries.flatMap((entry) => validateClaimLedgerEntry(entry));
  return {
    total: entries.length,
    verified: entries.length - pending.length,
    pending: pending.length,
    issues,
  };
}
