import crypto from "node:crypto";
import {
  nowIsoTimestamp,
  type ExperimentExecutionRequest,
  type ExperimentRun,
  type ExperimentRunStatus,
} from "@deepscholar/contracts";
import type { DockerClient } from "./docker-client.ts";
import type { DockerSandboxProfile } from "./docker-sandbox.ts";
import {
  isExperimentTemplateId,
  renderExperimentTemplate,
  writeTemplateFiles,
  type ExperimentTemplateId,
} from "./experiment-templates.ts";
import type { RunStore } from "./run-store-fs.ts";

export type TemplateRunOptions = {
  readonly projectId: string;
  readonly planId: string;
  readonly experimentId: string;
  readonly templateId: string;
  readonly image: string;
  readonly sandboxProfile: DockerSandboxProfile;
  readonly timeoutMs: number;
  readonly retryOfRunId?: string;
};

function containerName(projectId: string, runId: string): string {
  const safe = (value: string) => value.replaceAll(/[^a-zA-Z0-9_.-]/g, "_");
  const name = `deepscholar_${safe(projectId)}_${safe(runId)}`;
  return name.length > 120 ? name.slice(0, 120) : name;
}

function setStatus(
  run: ExperimentRun,
  status: ExperimentRunStatus,
  patch: Partial<ExperimentRun>,
): ExperimentRun {
  return { ...run, ...patch, status, updatedAt: nowIsoTimestamp() };
}

function executionRequest(options: TemplateRunOptions): ExperimentExecutionRequest {
  const templateId = parseTemplateId(options.templateId);
  return {
    driver: "docker",
    kind: "template",
    image: options.image,
    sandboxProfile: options.sandboxProfile,
    templateId,
    timeoutMs: options.timeoutMs,
  };
}

function markRunning(run: ExperimentRun, name: string, options: TemplateRunOptions): ExperimentRun {
  return setStatus(run, "running", {
    startedAt: nowIsoTimestamp(),
    execution: { driver: "docker", containerName: name },
    executionRequest: executionRequest(options),
    retryOfRunId: options.retryOfRunId,
    metricsPath: "metrics.json",
    artifacts: [
      { path: "stdout.log", kind: "log", description: "docker stdout" },
      { path: "stderr.log", kind: "log", description: "docker stderr" },
      { path: "metrics.json", kind: "metric", description: "template metrics" },
      { path: "main.py", kind: "file", description: "rendered template entry" },
    ],
  });
}

function finalizeRun(
  running: ExperimentRun,
  result: { readonly exitCode: number | null; readonly timedOut: boolean },
): ExperimentRun {
  const finishedAt = nowIsoTimestamp();
  if (result.timedOut) {
    return setStatus(running, "timeout", { finishedAt, exitCode: result.exitCode ?? undefined });
  }
  if (result.exitCode === 0) {
    return setStatus(running, "succeeded", { finishedAt, exitCode: 0 });
  }
  return setStatus(running, "failed", {
    finishedAt,
    exitCode: result.exitCode ?? undefined,
    failure: { type: "implementation", message: `exitCode=${String(result.exitCode ?? "null")}` },
  });
}

function parseTemplateId(templateId: string): ExperimentTemplateId {
  if (isExperimentTemplateId(templateId)) {
    return templateId;
  }
  throw new Error(`未知模板: ${templateId}`);
}

export async function runTemplateExperiment(
  store: RunStore,
  docker: DockerClient,
  options: TemplateRunOptions,
): Promise<ExperimentRun> {
  const runId = `run-${crypto.randomUUID()}`;
  const created = await store.create({
    runId,
    projectId: options.projectId,
    planId: options.planId,
    experimentId: options.experimentId,
  });

  const template = renderExperimentTemplate(parseTemplateId(options.templateId));
  await writeTemplateFiles({ runDir: created.paths.runDir, files: template.files });

  const name = containerName(options.projectId, runId);
  const running = markRunning(created.run, name, options);
  await store.save(running);

  const result = await docker.runProgram({
    containerName: name,
    image: options.image,
    runDir: created.paths.runDir,
    stdoutPath: created.paths.stdoutPath,
    stderrPath: created.paths.stderrPath,
    command: template.entrypoint,
    timeoutMs: options.timeoutMs,
    sandboxProfile: options.sandboxProfile,
  });

  const finalized = finalizeRun(running, { exitCode: result.exitCode, timedOut: result.timedOut });
  await store.save(finalized);
  return finalized;
}
