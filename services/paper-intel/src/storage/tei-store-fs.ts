import fs from "node:fs/promises";
import path from "node:path";
import type { DeepScholarHome } from "./paths.ts";
import { resolveProjectPaths } from "./paths.ts";
import { safeIdForFileName } from "./safe-filename.ts";
import type { TeiStore, TeiXml } from "./tei-store.ts";

export type FsTeiStoreOptions = {
  readonly home: DeepScholarHome;
};

function teiFilePath(parsedDir: string, paperId: string): string {
  return path.join(parsedDir, `${safeIdForFileName(paperId, "paperId")}.tei.xml`);
}

export function createFsTeiStore(options: FsTeiStoreOptions): TeiStore {
  async function saveTei(projectId: string, paperId: string, tei: TeiXml): Promise<void> {
    const paths = resolveProjectPaths(options.home, projectId);
    await fs.mkdir(paths.parsedDir, { recursive: true });
    await fs.writeFile(teiFilePath(paths.parsedDir, paperId), tei, "utf8");
  }

  async function loadTei(projectId: string, paperId: string): Promise<TeiXml | null> {
    const paths = resolveProjectPaths(options.home, projectId);
    try {
      return await fs.readFile(teiFilePath(paths.parsedDir, paperId), "utf8");
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  return { saveTei, loadTei };
}
