import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPaperDraft } from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { createFsRunStore } from "../../runner/src/index.ts";
import { writePaperBundle } from "./paper-bundle-fs.ts";
import { generatePaperVisualization } from "./paper-visualization.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-writing-visual-"));
}

async function seedRunMetrics(
  homeDir: string,
  runId: string,
  metrics: Readonly<Record<string, number>>,
): Promise<void> {
  const store = createFsRunStore({ homeDir });
  const created = await store.create({
    runId,
    projectId: "p1",
    planId: "plan-1",
    experimentId: `exp-${runId}`,
    status: "succeeded",
  });
  await fs.writeFile(created.paths.metricsPath, JSON.stringify(metrics, null, 2), "utf8");
}

describe("paper visualization", () => {
  it("generates table/chart artifacts from run metrics and stitches them into draft", async () => {
    const homeDir = await createTempDir();
    await seedRunMetrics(homeDir, "run-a", { accuracy: 0.91, loss: 0.12 });
    await seedRunMetrics(homeDir, "run-b", { accuracy: 0.95, loss: 0.08 });

    const draft = createPaperDraft({
      draftId: "d1",
      projectId: "p1",
      planId: "plan-1",
      title: "Demo Paper",
      venue: "arxiv",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:01.000Z",
    });
    await writePaperBundle({ homeDir, draft, bibYear: "2026" });

    const result = await generatePaperVisualization({
      homeDir,
      projectId: "p1",
      draftId: "d1",
      visualId: "baseline-vs-model",
      runIds: ["run-a", "run-b"],
      metricNames: ["accuracy", "loss"],
      caption: "Validated metrics snapshot",
      section: "results",
      bibYear: "2026",
    });

    const draftJson = JSON.parse(
      await fs.readFile(path.join(result.draft.mainTexPath ? path.dirname(result.draft.mainTexPath) : "", "draft.json"), "utf8"),
    ) as { sections: { results: string } };
    expect(draftJson.sections.results).toContain("DEEPSCHOLAR_VISUAL_BEGIN baseline-vs-model");
    expect(draftJson.sections.results).toContain("\\input{../../figures/baseline-vs-model/table.tex}");
    expect(draftJson.sections.results).toContain("\\input{../../figures/baseline-vs-model/chart.tex}");

    const tableTex = await fs.readFile(result.tableTexPath, "utf8");
    expect(tableTex).toContain("\\label{tab:baseline-vs-model}");
    expect(tableTex).toContain("accuracy");
    expect(tableTex).toContain("run-a");

    const chartTex = await fs.readFile(result.chartTexPath, "utf8");
    expect(chartTex).toContain("\\label{fig:baseline-vs-model}");
    expect(chartTex).toContain("\\addplot coordinates");

    const source = JSON.parse(await fs.readFile(result.sourceMetricsPath, "utf8")) as Array<{
      runId: string;
    }>;
    expect(source.map((row) => row.runId)).toEqual(["run-a", "run-b"]);
  });

  it("escapes caption and metric names before inserting generated block into LaTeX sections", async () => {
    const homeDir = await createTempDir();
    await seedRunMetrics(homeDir, "run-a", { "acc_score": 0.91 });

    const draft = createPaperDraft({
      draftId: "d2",
      projectId: "p1",
      planId: "plan-1",
      title: "Demo Paper",
      venue: "arxiv",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:01.000Z",
    });
    await writePaperBundle({ homeDir, draft, bibYear: "2026" });

    const result = await generatePaperVisualization({
      homeDir,
      projectId: "p1",
      draftId: "d2",
      visualId: "escaped-visual",
      runIds: ["run-a"],
      metricNames: ["acc_score"],
      caption: "Accuracy_% snapshot",
      section: "results",
      bibYear: "2026",
    });

    const draftJson = JSON.parse(
      await fs.readFile(
        path.join(path.dirname(result.draft.mainTexPath ?? ""), "draft.json"),
        "utf8",
      ),
    ) as { sections: { results: string } };
    expect(draftJson.sections.results).toContain("\\paragraph{Accuracy\\_\\% snapshot}");
    expect(draftJson.sections.results).toContain("acc\\_score");
  });
});
