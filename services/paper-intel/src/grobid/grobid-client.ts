import type { FetchLike, RateLimiter } from "../sources/types.ts";

export type GrobidClientOptions = {
  readonly fetch: FetchLike;
  readonly rateLimiter: RateLimiter;
  readonly baseUrl: string;
};

const DEFAULT_FILE_NAME = "paper.pdf";

async function readErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

export function createGrobidClient(options: GrobidClientOptions) {
  async function processFulltextDocument(
    pdfBytes: Uint8Array,
    fileName: string = DEFAULT_FILE_NAME,
  ): Promise<string> {
    await options.rateLimiter.acquireSlot();

    const form = new FormData();
    const payload = Buffer.from(pdfBytes);
    form.append("input", new Blob([payload], { type: "application/pdf" }), fileName);

    const url = new URL("/api/processFulltextDocument", options.baseUrl).toString();
    const res = await options.fetch(url, { method: "POST", body: form });
    if (!res.ok) {
      const body = await readErrorBody(res);
      throw new Error(
        `GROBID 解析失败: ${res.status} ${res.statusText}${body ? ` | ${body}` : ""}`,
      );
    }
    return await res.text();
  }

  return { processFulltextDocument };
}
