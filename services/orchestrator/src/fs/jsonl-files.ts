import fs from "node:fs/promises";

export async function appendJsonlLine(filePath: string, value: unknown): Promise<void> {
  const line = `${JSON.stringify(value)}\n`;
  await fs.appendFile(filePath, line, "utf8");
}

export async function readJsonlFile<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}
