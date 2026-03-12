import { describe, expect, it } from "vitest";
import { dockerSandboxArgs, isDockerSandboxProfile } from "./docker-sandbox.ts";

describe("docker sandbox", () => {
  it("recognizes allowed profiles", () => {
    expect(isDockerSandboxProfile("compat")).toBe(true);
    expect(isDockerSandboxProfile("hardened")).toBe(true);
    expect(isDockerSandboxProfile("gvisor")).toBe(true);
    expect(isDockerSandboxProfile("nope")).toBe(false);
  });

  it("produces hardened args", () => {
    const args = dockerSandboxArgs("hardened");
    expect(args).toContain("--read-only");
    expect(args).toContain("--cap-drop");
    expect(args).toContain("ALL");
    expect(args).toContain("--tmpfs");
  });

  it("produces gvisor args (includes runtime runsc)", () => {
    const args = dockerSandboxArgs("gvisor");
    expect(args).toContain("--runtime");
    expect(args).toContain("runsc");
    expect(args).toContain("--read-only");
  });
});
