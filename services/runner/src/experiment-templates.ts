import fs from "node:fs/promises";
import path from "node:path";

export type ExperimentTemplateId = "python_smoke";

export const EXPERIMENT_TEMPLATE_IDS: readonly ExperimentTemplateId[] = ["python_smoke"];

export function isExperimentTemplateId(value: string): value is ExperimentTemplateId {
  return (EXPERIMENT_TEMPLATE_IDS as readonly string[]).includes(value);
}

export type RenderedExperimentTemplate = {
  readonly templateId: ExperimentTemplateId;
  readonly files: Readonly<Record<string, string>>;
  readonly entrypoint: readonly string[];
};

function pythonSmokeTemplateSource(): string {
  return [
    "import json",
    "import time",
    "",
    "print('template: start')",
    "time.sleep(0.1)",
    "metrics = {'health': 1}",
    "with open('metrics.json', 'w', encoding='utf-8') as f:",
    "    json.dump(metrics, f, indent=2)",
    "print('template: done')",
    "",
  ].join("\n");
}

export function renderExperimentTemplate(
  templateId: ExperimentTemplateId,
): RenderedExperimentTemplate {
  return {
    templateId,
    files: {
      "main.py": pythonSmokeTemplateSource(),
    },
    entrypoint: ["python", "/out/main.py"],
  };
}

export async function writeTemplateFiles(params: {
  readonly runDir: string;
  readonly files: Readonly<Record<string, string>>;
}): Promise<void> {
  for (const [relativePath, content] of Object.entries(params.files)) {
    const filePath = path.join(params.runDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
  }
}
