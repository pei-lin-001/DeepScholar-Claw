import { pathToFileURL } from "node:url";
import type { ServiceDescriptor } from "@deepscholar/contracts";

export { summarizeClaimLedger, type ClaimLedgerSummary } from "./claim-ledger.ts";

export const provenanceService: ServiceDescriptor = {
  id: "provenance",
  displayName: "Claim Provenance",
  owns: ["claim ledger", "figure lineage", "audit status", "verification summaries"],
  consumes: ["run outputs", "paper sections", "citation snippets"],
  produces: ["verified claims", "audit decisions", "dispute records"],
  outOfScope: ["training orchestration", "proposal generation", "human approvals"],
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  console.log(JSON.stringify(provenanceService, null, 2));
}
