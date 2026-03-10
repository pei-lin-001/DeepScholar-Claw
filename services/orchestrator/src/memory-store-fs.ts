import fs from "node:fs/promises";
import {
  createMemoryItem,
  nowIsoTimestamp,
  validateMemoryItem,
  type MemoryItem,
} from "@deepscholar/contracts";
import type { MemoryLayer } from "@deepscholar/contracts";
import type { MemorySearchHit, MemoryStore } from "./memory-store.ts";
import {
  resolveDeepScholarHome,
  resolveProjectPaths,
  type DeepScholarHome,
} from "./project-paths.ts";

export type FsMemoryStoreOptions = {
  readonly homeDir?: string;
  readonly home?: DeepScholarHome;
};

const DEFAULT_SEARCH_LIMIT = 20;

function layerPath(paths: ReturnType<typeof resolveProjectPaths>, layer: MemoryLayer): string {
  if (layer === "working") {
    return paths.memoryWorkingPath;
  }
  if (layer === "recall") {
    return paths.memoryRecallPath;
  }
  return paths.memoryArchivalPath;
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
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

function buildCompactionText(items: readonly MemoryItem[]): string {
  const lines = items.map((item, index) => {
    const snippet = item.text.split("\n")[0]?.slice(0, 120) ?? "";
    return `${index + 1}. ${item.title}: ${snippet}`.trim();
  });
  return lines.join("\n");
}

function matchItem(item: MemoryItem, query: string): MemorySearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [];
  }
  const hits: MemorySearchHit[] = [];
  if (item.title.toLowerCase().includes(q)) {
    hits.push({ item, matchedIn: "title" });
  } else if (item.text.toLowerCase().includes(q)) {
    hits.push({ item, matchedIn: "text" });
  }
  return hits;
}

export function createFsMemoryStore(options: FsMemoryStoreOptions = {}): MemoryStore {
  const home = options.home ?? resolveDeepScholarHome(options.homeDir);

  async function append(projectId: string, item: MemoryItem): Promise<void> {
    const issues = validateMemoryItem(item);
    if (issues.length > 0) {
      throw new Error(
        `MemoryItem 校验失败: ${issues.map((i) => `${i.field}:${i.message}`).join(", ")}`,
      );
    }
    const paths = resolveProjectPaths(home, projectId);
    await fs.mkdir(paths.memoryDir, { recursive: true });
    await fs.appendFile(layerPath(paths, item.layer), `${JSON.stringify(item)}\n`, "utf8");
  }

  async function list(projectId: string, layer?: MemoryLayer): Promise<MemoryItem[]> {
    const paths = resolveProjectPaths(home, projectId);
    if (layer) {
      return await readJsonl<MemoryItem>(layerPath(paths, layer));
    }
    const [working, recall, archival] = await Promise.all([
      readJsonl<MemoryItem>(paths.memoryWorkingPath),
      readJsonl<MemoryItem>(paths.memoryRecallPath),
      readJsonl<MemoryItem>(paths.memoryArchivalPath),
    ]);
    return [...working, ...recall, ...archival];
  }

  async function search(
    projectId: string,
    query: string,
    limit: number,
  ): Promise<MemorySearchHit[]> {
    const items = await list(projectId);
    const hits = items.flatMap((item) => matchItem(item, query));
    return hits.slice(0, Math.max(1, limit || DEFAULT_SEARCH_LIMIT));
  }

  async function compactWorkingToArchival(
    projectId: string,
  ): Promise<{ archived: MemoryItem; moved: number }> {
    const paths = resolveProjectPaths(home, projectId);
    const working = await readJsonl<MemoryItem>(paths.memoryWorkingPath);
    if (working.length === 0) {
      throw new Error("Working 记忆为空，无需压缩");
    }
    const archived = createMemoryItem({
      memoryId: `compaction-${Date.now()}`,
      layer: "archival",
      createdAt: nowIsoTimestamp(),
      step: working[working.length - 1]?.step ?? "step0_plan_freeze",
      title: `Working 压缩摘要(${working.length}条)`,
      text: buildCompactionText(working),
      tags: ["compaction", "working"],
      source: "orchestrator",
    });
    await fs.mkdir(paths.memoryDir, { recursive: true });
    await fs.appendFile(paths.memoryArchivalPath, `${JSON.stringify(archived)}\n`, "utf8");
    await fs.writeFile(paths.memoryWorkingPath, "", "utf8");
    return { archived, moved: working.length };
  }

  return { append, list, search, compactWorkingToArchival };
}
