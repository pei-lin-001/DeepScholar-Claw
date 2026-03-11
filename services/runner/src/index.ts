import { pathToFileURL } from "node:url";
import type { ExperimentSpec, ServiceDescriptor } from "@deepscholar/contracts";
import { createExperimentSpec } from "@deepscholar/contracts";

export { classifyFailure, failurePolicy, type FailureSignal, type FailureType } from "./failure.ts";
export {
  createNodeDockerClient,
  type DockerClient,
  type DockerRunResult,
} from "./docker-client.ts";
export { createFsRunStore, type RunStore } from "./run-store-fs.ts";
export {
  resolveDeepScholarHome,
  resolveRunnerProjectPaths,
  resolveRunPaths,
  type DeepScholarHome,
  type RunPaths,
  type RunnerProjectPaths,
} from "./runner-paths.ts";
export { abortRun, runSmokeExperiment, type SmokeRunOptions } from "./smoke-runner.ts";

export const runnerService: ServiceDescriptor = {
  id: "runner",
  displayName: "Experiment Runner",
  owns: ["sandbox execution", "job lifecycle", "failure classification", "artifact export"],
  consumes: ["approved experiment specs", "budget decisions"],
  produces: ["run status", "metrics", "artifacts", "failure reports"],
  outOfScope: ["topic selection", "citation retrieval", "claim approval"],
};

export function createSmokeExperiment(projectId: string): ExperimentSpec {
  return createExperimentSpec({
    experimentId: `${projectId}-smoke`,
    projectId,
    planId: `${projectId}-plan`,
    summary: "最小冒烟实验",
    runtimeProfile: "smoke",
    datasets: ["fixture"],
    metrics: ["health"],
    requiredArtifacts: ["stdout.log"],
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  console.log(JSON.stringify(runnerService, null, 2));
}
