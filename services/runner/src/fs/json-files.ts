import fs from "node:fs/promises";
import path from "node:path";

async function ensureDirForFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function writeJsonFileAtomic(filePath: string, value: unknown): Promise<void> {
  await ensureDirForFile(filePath);
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmpPath, filePath);
}
