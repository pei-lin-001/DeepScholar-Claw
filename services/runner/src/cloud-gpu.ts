export type CloudGPUProviderId = "autodl" | "runpod";

export type AutoDLConfig = {
  readonly provider: "autodl";
  readonly baseUrl: string;
  readonly apiToken: string;
};

export type RunPodConfig = {
  readonly provider: "runpod";
  readonly baseUrl: string;
  readonly apiKey: string;
};

export type CloudGPUProviderConfig = AutoDLConfig | RunPodConfig;

export type CloudGPUProvider = {
  readonly id: CloudGPUProviderId;
  readonly displayName: string;
  loadConfig: (env: Record<string, string | undefined>) => CloudGPUProviderConfig;
};

const AUTODL_TOKEN_ENV = "DEEPSCHOLAR_AUTODL_API_TOKEN";
const AUTODL_BASE_URL_ENV = "DEEPSCHOLAR_AUTODL_BASE_URL";
const DEFAULT_AUTODL_BASE_URL = "https://api.autodl.com";

const RUNPOD_KEY_ENV = "DEEPSCHOLAR_RUNPOD_API_KEY";
const RUNPOD_BASE_URL_ENV = "DEEPSCHOLAR_RUNPOD_BASE_URL";
const DEFAULT_RUNPOD_BASE_URL = "https://api.runpod.io";

function requireEnvText(env: Record<string, string | undefined>, key: string): string {
  const raw = env[key];
  if (!raw || raw.trim().length === 0) {
    throw new Error(`缺少环境变量 ${key}`);
  }
  return raw.trim();
}

function readEnvText(
  env: Record<string, string | undefined>,
  key: string,
  fallback: string,
): string {
  const raw = env[key];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }
  return raw.trim();
}

export function loadAutodlConfig(env: Record<string, string | undefined>): AutoDLConfig {
  return {
    provider: "autodl",
    baseUrl: readEnvText(env, AUTODL_BASE_URL_ENV, DEFAULT_AUTODL_BASE_URL),
    apiToken: requireEnvText(env, AUTODL_TOKEN_ENV),
  };
}

export function loadRunpodConfig(env: Record<string, string | undefined>): RunPodConfig {
  return {
    provider: "runpod",
    baseUrl: readEnvText(env, RUNPOD_BASE_URL_ENV, DEFAULT_RUNPOD_BASE_URL),
    apiKey: requireEnvText(env, RUNPOD_KEY_ENV),
  };
}

export const autodlProvider: CloudGPUProvider = {
  id: "autodl",
  displayName: "AutoDL",
  loadConfig: loadAutodlConfig,
};

export const runpodProvider: CloudGPUProvider = {
  id: "runpod",
  displayName: "RunPod",
  loadConfig: loadRunpodConfig,
};

export const CLOUD_GPU_PROVIDERS: readonly CloudGPUProvider[] = [autodlProvider, runpodProvider];

export function getCloudGpuProvider(id: CloudGPUProviderId): CloudGPUProvider {
  const provider = CLOUD_GPU_PROVIDERS.find((entry) => entry.id === id);
  if (!provider) {
    throw new Error(`未知云 GPU provider: ${id}`);
  }
  return provider;
}
