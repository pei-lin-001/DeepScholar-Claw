import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createMemoryItem } from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { createFsMemoryStore } from "./memory-store-fs.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-orch-mem-"));
}

describe("memory store (fs)", () => {
  it("appends, lists, searches, and compacts working memory", async () => {
    const homeDir = await createTempDir();
    const store = createFsMemoryStore({ homeDir });

    const w1 = createMemoryItem({
      memoryId: "w1",
      layer: "working",
      createdAt: "2026-03-10T00:00:00.000Z",
      step: "step0_plan_freeze",
      title: "Hypothesis",
      text: "We improve X",
      tags: ["plan"],
      source: "editor",
    });
    const w2 = createMemoryItem({
      memoryId: "w2",
      layer: "working",
      createdAt: "2026-03-10T00:00:01.000Z",
      step: "step0_plan_freeze",
      title: "Success Metric",
      text: "accuracy >= 0.9",
      tags: ["plan"],
      source: "editor",
    });
    await store.append("p1", w1);
    await store.append("p1", w2);

    const working = await store.list("p1", "working");
    expect(working.map((item) => item.memoryId)).toEqual(["w1", "w2"]);

    const hits = await store.search("p1", "accuracy", 10);
    expect(hits[0]?.item.memoryId).toBe("w2");
    expect(hits[0]?.matchedIn).toBe("text");

    const compacted = await store.compactWorkingToArchival("p1");
    expect(compacted.moved).toBe(2);
    expect(compacted.archived.layer).toBe("archival");

    expect(await store.list("p1", "working")).toEqual([]);
    const archival = await store.list("p1", "archival");
    // 2 original items preserved + 1 compaction summary
    expect(archival).toHaveLength(3);
    expect(archival[0]?.memoryId).toBe("w1");
    expect(archival[1]?.memoryId).toBe("w2");
    expect(archival[2]?.text).toContain("Hypothesis");
  });

  it("rejects invalid memory items", async () => {
    const store = createFsMemoryStore({ homeDir: await createTempDir() });
    await expect(
      store.append(
        "p1",
        createMemoryItem({
          memoryId: "",
          layer: "working",
          createdAt: "bad",
          step: "step0_plan_freeze",
          title: "",
          text: "",
          tags: [],
          source: "",
        }),
      ),
    ).rejects.toThrow(/MemoryItem 校验失败/);
  });
});
