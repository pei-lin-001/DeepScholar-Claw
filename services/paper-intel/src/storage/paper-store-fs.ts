import fs from "node:fs/promises";
import path from "node:path";
import type { PaperStore, StoredPaper } from "./paper-store.ts";
import type { DeepScholarHome } from "./paths.ts";
import { resolveProjectPaths } from "./paths.ts";
import { safeIdForFileName } from "./safe-filename.ts";

export type FsPaperStoreOptions = {
  readonly home: DeepScholarHome;
};

function paperFilePath(papersDir: string, paperId: string): string {
  return path.join(papersDir, `${safeIdForFileName(paperId, "paperId")}.json`);
}

export function createFsPaperStore(options: FsPaperStoreOptions): PaperStore {
  async function savePaper(projectId: string, paper: StoredPaper): Promise<void> {
    const paths = resolveProjectPaths(options.home, projectId);
    await fs.mkdir(paths.papersDir, { recursive: true });
    const targetPath = paperFilePath(paths.papersDir, paper.paperId);
    await fs.writeFile(targetPath, JSON.stringify(paper, null, 2), "utf8");
  }

  async function loadPapers(projectId: string): Promise<StoredPaper[]> {
    const paths = resolveProjectPaths(options.home, projectId);
    try {
      const entries = await fs.readdir(paths.papersDir, { withFileTypes: true });
      const paperFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
      const papers = await Promise.all(
        paperFiles.map(async (entry) => {
          const raw = await fs.readFile(path.join(paths.papersDir, entry.name), "utf8");
          return JSON.parse(raw) as StoredPaper;
        }),
      );
      return papers;
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        return [];
      }
      throw err;
    }
  }

  return { savePaper, loadPapers };
}
