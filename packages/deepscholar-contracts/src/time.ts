export type IsoTimestamp = string;

export function nowIsoTimestamp(): IsoTimestamp {
  return new Date().toISOString();
}

const ISO_PREFIX_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function isIsoTimestamp(value: string): boolean {
  return ISO_PREFIX_RE.test(value) && Number.isFinite(Date.parse(value));
}
