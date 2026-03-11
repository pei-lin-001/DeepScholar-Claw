import type { ResearchStep } from "./steps.ts";
import { isIsoTimestamp, type IsoTimestamp } from "./time.ts";
import {
  isNonEmptyText,
  isOneOf,
  pushIf,
  uniqueStrings,
  type ValidationIssue,
} from "./validation.ts";

export type MemoryLayer = "working" | "recall" | "archival";

const MEMORY_LAYERS: readonly MemoryLayer[] = ["working", "recall", "archival"];

export type MemoryItem = {
  readonly memoryId: string;
  readonly layer: MemoryLayer;
  readonly createdAt: IsoTimestamp;
  readonly step: ResearchStep;
  readonly title: string;
  readonly text: string;
  readonly tags: readonly string[];
  readonly source: string;
};

export type CreateMemoryItemInput = {
  readonly memoryId: string;
  readonly layer: MemoryLayer;
  readonly createdAt: IsoTimestamp;
  readonly step: ResearchStep;
  readonly title: string;
  readonly text: string;
  readonly tags?: readonly string[];
  readonly source?: string;
};

export function createMemoryItem(input: CreateMemoryItemInput): MemoryItem {
  return {
    memoryId: input.memoryId,
    layer: input.layer,
    createdAt: input.createdAt,
    step: input.step,
    title: input.title,
    text: input.text,
    tags: uniqueStrings(input.tags ?? []),
    source: input.source ?? "system",
  };
}

export function validateMemoryItem(item: MemoryItem): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(item.memoryId), "memoryId", "memoryId 不能为空");
  pushIf(
    issues,
    !isOneOf(item.layer, MEMORY_LAYERS),
    "layer",
    `记忆层级必须是 ${MEMORY_LAYERS.join("/")}`,
  );
  pushIf(issues, !isIsoTimestamp(item.createdAt), "createdAt", "createdAt 必须是合法时间戳");
  pushIf(issues, !isNonEmptyText(item.title), "title", "title 不能为空");
  pushIf(issues, !isNonEmptyText(item.text), "text", "text 不能为空");
  pushIf(issues, !isNonEmptyText(item.source), "source", "source 不能为空");
  return issues;
}
