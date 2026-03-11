export type DockerSandboxProfile = "compat" | "hardened" | "gvisor";

export const DOCKER_SANDBOX_PROFILES: readonly DockerSandboxProfile[] = [
  "compat",
  "hardened",
  "gvisor",
];

export function isDockerSandboxProfile(value: string): value is DockerSandboxProfile {
  return (DOCKER_SANDBOX_PROFILES as readonly string[]).includes(value);
}

const TMPFS_TMP_DIR = "/tmp";
const TMPFS_TMP_SIZE = "64m";
const PID_LIMIT = "256";

function hardenedSandboxArgs(): string[] {
  return [
    "--read-only",
    "--security-opt",
    "no-new-privileges:true",
    "--cap-drop",
    "ALL",
    "--pids-limit",
    PID_LIMIT,
    "--tmpfs",
    `${TMPFS_TMP_DIR}:rw,size=${TMPFS_TMP_SIZE}`,
  ];
}

function gvisorSandboxArgs(): string[] {
  return ["--runtime", "runsc", ...hardenedSandboxArgs()];
}

export function dockerSandboxArgs(profile: DockerSandboxProfile): string[] {
  if (profile === "compat") {
    return [];
  }
  if (profile === "hardened") {
    return hardenedSandboxArgs();
  }
  return gvisorSandboxArgs();
}
