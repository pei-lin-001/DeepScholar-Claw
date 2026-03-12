import type { ExperimentRun } from "@deepscholar/contracts";
import type { DockerClient } from "./docker-client.ts";
import type { RunStore } from "./run-store-fs.ts";
import { runSmokeExperiment } from "./smoke-runner.ts";
import { runTemplateExperiment } from "./template-runner.ts";

function ensureRetryable(run: ExperimentRun): void {
  if (run.status === "queued" || run.status === "running") {
    throw new Error(`run 仍未结束（status=${run.status}），无法 retry`);
  }
  if (run.status === "succeeded") {
    throw new Error("run 已成功（status=succeeded），无需 retry");
  }
}

export async function retryRun(
  store: RunStore,
  docker: DockerClient,
  input: { readonly projectId: string; readonly runId: string },
): Promise<ExperimentRun> {
  const original = await store.load(input.projectId, input.runId);
  ensureRetryable(original);
  const req = original.executionRequest;
  if (!req || req.driver !== "docker") {
    throw new Error("run 缺少 executionRequest(driver=docker)，无法重试复刻");
  }

  if (req.kind === "smoke") {
    return await runSmokeExperiment(store, docker, {
      projectId: original.projectId,
      planId: original.planId,
      experimentId: original.experimentId,
      image: req.image,
      sandboxProfile: req.sandboxProfile,
      holdSeconds: req.holdSeconds,
      timeoutMs: req.timeoutMs,
      retryOfRunId: original.runId,
    });
  }
  if (req.kind === "template") {
    return await runTemplateExperiment(store, docker, {
      projectId: original.projectId,
      planId: original.planId,
      experimentId: original.experimentId,
      templateId: req.templateId,
      image: req.image,
      sandboxProfile: req.sandboxProfile,
      timeoutMs: req.timeoutMs,
      retryOfRunId: original.runId,
    });
  }
  throw new Error(`当前 kind=${req.kind} 暂不支持 retry`);
}
