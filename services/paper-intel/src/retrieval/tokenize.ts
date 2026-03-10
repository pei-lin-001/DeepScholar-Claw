const TOKEN_REGEX = /[a-z0-9]+/gi;

export function tokenize(text: string): string[] {
  const lowered = text.toLowerCase();
  const matches = lowered.match(TOKEN_REGEX) ?? [];
  return matches.filter((token) => token.length > 1);
}
