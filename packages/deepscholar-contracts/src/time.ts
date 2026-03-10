export type IsoTimestamp = string;

export function nowIsoTimestamp(): IsoTimestamp {
  return new Date().toISOString();
}

export function isIsoTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
