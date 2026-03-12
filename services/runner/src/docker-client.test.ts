import { describe, expect, it } from "vitest";
import { buildRunArgs } from "./docker-client.ts";

describe("docker client run args", () => {
  it("sets workdir to /out so relative outputs land in runDir", () => {
    const args = buildRunArgs({
      containerName: "deepscholar_test",
      image: "python:3.11-slim",
      runDir: "/tmp/deepscholar-run",
      sandboxProfile: "compat",
      command: ["python", "/out/main.py"],
    });

    const workdirIndex = args.indexOf("-w");
    expect(workdirIndex).toBeGreaterThanOrEqual(0);
    expect(args[workdirIndex + 1]).toBe("/out");

    const imageIndex = args.indexOf("python:3.11-slim");
    expect(imageIndex).toBeGreaterThan(0);
    expect(workdirIndex).toBeLessThan(imageIndex);
  });
});
