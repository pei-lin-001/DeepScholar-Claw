import fs from "node:fs/promises";
import type { ExperimentRun } from "@deepscholar/contracts";
import type { RunStore } from "./run-store-fs.ts";

export type RunCollectedSnapshot = {
  readonly run: ExperimentRun;
  readonly metrics: unknown;
  readonly stdoutTail: string;
  readonly stderrTail: string;
  readonly artifacts: readonly { path: string; kind: string; description?: string }[];
};

const UTF8 = "utf8";
const DEFAULT_TAIL_BYTES = 4096;

async function readTextFileTailBytes(filePath: string, tailBytes: number): Promise<string> {
  const requested = Number.isFinite(tailBytes) && tailBytes > 0 ? Math.floor(tailBytes) : 1;
  const stat = await fs.stat(filePath);
  const size = stat.size;
  const start = Math.max(0, size - requested);
  const handle = await fs.open(filePath, "r");
  try {
    const buf = Buffer.alloc(size - start);
    await handle.read(buf, 0, buf.length, start);
    return buf.toString(UTF8);
  } finally {
    await handle.close();
  }
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, UTF8);
  try {
    return JSON.parse(raw) as unknown;
  } catch (err) {
    throw new Error(`无法解析 JSON: ${filePath}: ${String(err)}`, { cause: err });
  }
}

export async function collectRunSummary(params: {
  readonly store: RunStore;
  readonly projectId: string;
  readonly runId: string;
  readonly tailBytes?: number;
}): Promise<RunCollectedSnapshot> {
  const run = await params.store.load(params.projectId, params.runId);
  const paths = params.store.pathsFor(params.projectId, params.runId);
  const tailBytes = params.tailBytes ?? DEFAULT_TAIL_BYTES;

  const [metrics, stdoutTail, stderrTail] = await Promise.all([
    readJsonFile(paths.metricsPath),
    readTextFileTailBytes(paths.stdoutPath, tailBytes),
    readTextFileTailBytes(paths.stderrPath, tailBytes),
  ]);

  return {
    run,
    metrics,
    stdoutTail,
    stderrTail,
    artifacts: run.artifacts.map((artifact) => ({
      path: artifact.path,
      kind: artifact.kind,
      description: artifact.description,
    })),
  };
}
