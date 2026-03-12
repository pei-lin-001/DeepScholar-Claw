const LATEX_SPECIAL: ReadonlyMap<string, string> = new Map([
  ["\\", "\\textbackslash{}"],
  ["{", "\\{"],
  ["}", "\\}"],
  ["$", "\\$"],
  ["&", "\\&"],
  ["%", "\\%"],
  ["#", "\\#"],
  ["_", "\\_"],
  ["~", "\\textasciitilde{}"],
  ["^", "\\textasciicircum{}"],
]);

const LATEX_SPECIAL_REGEX = /[\\{}$&%#_~^]/g;

export function escapeLatex(value: string): string {
  return value.replaceAll(LATEX_SPECIAL_REGEX, (ch) => LATEX_SPECIAL.get(ch) ?? ch);
}
