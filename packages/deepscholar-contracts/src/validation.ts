export type ValidationIssue = {
  readonly field: string;
  readonly message: string;
};

export function isNonEmptyText(value: string): boolean {
  return value.trim().length > 0;
}

export function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function isNonNegativeNumber(value: number): boolean {
  return isFiniteNumber(value) && value >= 0;
}

export function isPositiveNumber(value: number): boolean {
  return isFiniteNumber(value) && value > 0;
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
