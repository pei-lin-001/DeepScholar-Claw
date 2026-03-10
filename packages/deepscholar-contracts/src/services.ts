export type ServiceDescriptor = {
  id: string;
  displayName: string;
  owns: string[];
  consumes: string[];
  produces: string[];
  outOfScope: string[];
};

export const CORE_SERVICE_IDS = ["orchestrator", "paper-intel", "runner", "provenance"] as const;

export type CoreServiceId = (typeof CORE_SERVICE_IDS)[number];
