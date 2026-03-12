import fsPromises from "node:fs/promises";

const UTF8 = "utf8";
const MAX_DOCKER_ERROR_SNIPPET_CHARS = 200;

export async function appendRunnerNote(stderrPath: string, line: string): Promise<void> {
  const suffix = line.endsWith("\n") ? "" : "\n";
  await fsPromises.appendFile(stderrPath, `[runner] ${line}${suffix}`, UTF8);
}

export function singleLineSnippet(text: string): string {
  const first = text.split("\n")[0] ?? "";
  const trimmed = first.trim();
  if (trimmed.length <= MAX_DOCKER_ERROR_SNIPPET_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_DOCKER_ERROR_SNIPPET_CHARS)}…`;
}
