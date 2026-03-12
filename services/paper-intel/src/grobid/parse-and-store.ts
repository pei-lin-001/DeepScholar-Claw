import type { TeiStore } from "../storage/tei-store.ts";
import type { createGrobidClient } from "./grobid-client.ts";

export type GrobidClient = ReturnType<typeof createGrobidClient>;

export async function parseAndStoreTei(options: {
  readonly projectId: string;
  readonly paperId: string;
  readonly pdfBytes: Uint8Array;
  readonly grobid: GrobidClient;
  readonly teiStore: TeiStore;
}): Promise<string> {
  const tei = await options.grobid.processFulltextDocument(options.pdfBytes);
  await options.teiStore.saveTei(options.projectId, options.paperId, tei);
  return tei;
}
