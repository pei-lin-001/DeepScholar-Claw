import type { RawPaper } from "../sources/types.ts";

export type StoredPaper = RawPaper;

export type PaperStore = {
  savePaper(projectId: string, paper: StoredPaper): Promise<void>;
  loadPapers(projectId: string): Promise<StoredPaper[]>;
};
