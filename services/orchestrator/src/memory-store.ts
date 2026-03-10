import type { MemoryItem, MemoryLayer } from "@deepscholar/contracts";

export type MemorySearchHit = {
  readonly item: MemoryItem;
  readonly matchedIn: "title" | "text";
};

export type MemoryStore = {
  append: (projectId: string, item: MemoryItem) => Promise<void>;
  list: (projectId: string, layer?: MemoryLayer) => Promise<MemoryItem[]>;
  search: (projectId: string, query: string, limit: number) => Promise<MemorySearchHit[]>;
  compactWorkingToArchival: (projectId: string) => Promise<{ archived: MemoryItem; moved: number }>;
};
