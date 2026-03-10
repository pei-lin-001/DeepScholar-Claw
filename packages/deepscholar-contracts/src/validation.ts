export type ValidationIssue = {
  readonly field: string;
  readonly message: string;
};

export function isNonEmptyText(value: string): boolean {
  return value.trim().length > 0;
}

export function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function pushIf(
  issues: ValidationIssue[],
  invalid: boolean,
  field: string,
  message: string,
): void {
  if (invalid) {
    issues.push({ field, message });
  }
}
