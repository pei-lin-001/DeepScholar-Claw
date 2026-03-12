import os from "node:os";
import path from "node:path";

export type DeepScholarHome = {
  readonly rootDir: string;
};

export type ProjectPaths = {
  readonly projectDir: string;
  readonly literatureDir: string;
  readonly papersDir: string;
  readonly pdfsDir: string;
  readonly parsedDir: string;
  readonly graphDir: string;
};

export function resolveDeepScholarHome(rootDir?: string): DeepScholarHome {
  const resolvedRoot = rootDir ?? path.join(os.homedir(), ".deepscholar");
  return { rootDir: resolvedRoot };
}

export function resolveProjectPaths(home: DeepScholarHome, projectId: string): ProjectPaths {
  const projectDir = path.join(home.rootDir, "projects", projectId);
  const literatureDir = path.join(projectDir, "literature");
  return {
    projectDir,
    literatureDir,
    papersDir: path.join(literatureDir, "papers"),
    pdfsDir: path.join(literatureDir, "pdfs"),
    parsedDir: path.join(literatureDir, "parsed"),
    graphDir: path.join(literatureDir, "graph"),
  };
}
