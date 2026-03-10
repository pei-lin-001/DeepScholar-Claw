const SAFE_CHAR_REGEX = /[^a-zA-Z0-9._-]/g;

export function safeIdForFileName(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} 不能为空`);
  }
  return trimmed.replaceAll(SAFE_CHAR_REGEX, "_");
}
