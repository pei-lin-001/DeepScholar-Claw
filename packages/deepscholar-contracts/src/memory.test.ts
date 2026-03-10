import { describe, expect, it } from "vitest";
import { createMemoryItem, validateMemoryItem } from "./index.ts";

describe("memory contracts", () => {
  it("normalizes tags and validates required fields", () => {
    const item = createMemoryItem({
      memoryId: "m1",
      layer: "recall",
      createdAt: "2026-03-10T00:00:00.000Z",
      step: "step1_literature_crawl",
      title: "note",
      text: "hello",
      tags: ["a", "a", " b "],
      source: "paper-intel",
    });
    expect(item.tags).toEqual(["a", "b"]);
    expect(validateMemoryItem(item)).toEqual([]);
  });
});
