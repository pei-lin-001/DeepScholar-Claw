import { describe, expect, it } from "vitest";
import { getCloudGpuProvider, loadAutodlConfig, loadRunpodConfig } from "./cloud-gpu.ts";

describe("cloud gpu provider config", () => {
  it("loads AutoDL config from env and fails explicitly when missing token", () => {
    expect(() => loadAutodlConfig({})).toThrowError(/DEEPSCHOLAR_AUTODL_API_TOKEN/);
    const cfg = loadAutodlConfig({ DEEPSCHOLAR_AUTODL_API_TOKEN: "t" });
    expect(cfg.provider).toBe("autodl");
    expect(cfg.apiToken).toBe("t");
    expect(cfg.baseUrl).toContain("autodl");
  });

  it("loads RunPod config from env and fails explicitly when missing api key", () => {
    expect(() => loadRunpodConfig({})).toThrowError(/DEEPSCHOLAR_RUNPOD_API_KEY/);
    const cfg = loadRunpodConfig({ DEEPSCHOLAR_RUNPOD_API_KEY: "k" });
    expect(cfg.provider).toBe("runpod");
    expect(cfg.apiKey).toBe("k");
    expect(cfg.baseUrl).toContain("runpod");
  });

  it("resolves providers by id", () => {
    expect(getCloudGpuProvider("autodl").displayName).toBe("AutoDL");
    expect(getCloudGpuProvider("runpod").displayName).toBe("RunPod");
  });
});
