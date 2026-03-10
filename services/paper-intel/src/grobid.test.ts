import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createGrobidClient } from "./grobid/grobid-client.ts";
import { parseAndStoreTei } from "./grobid/parse-and-store.ts";
import { createRateLimiter } from "./sources/rate-limiter.ts";
import { resolveDeepScholarHome } from "./storage/paths.ts";
import { createFsTeiStore } from "./storage/tei-store-fs.ts";

type LastRequest = { contentType?: string; bytes: number } | null;

type RunningServer = {
  close: () => Promise<void>;
  url: string;
  getLastRequest: () => LastRequest;
};

async function startStubServer(responseStatus: number): Promise<RunningServer> {
  let lastRequest: LastRequest = null;
  const server = http.createServer((req, res) => {
    const contentType = req.headers["content-type"];
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += Buffer.byteLength(chunk);
    });
    req.on("end", () => {
      lastRequest = {
        contentType: typeof contentType === "string" ? contentType : undefined,
        bytes,
      };
      res.statusCode = responseStatus;
      res.setHeader("content-type", "text/plain");
      res.end(responseStatus === 200 ? "<TEI>ok</TEI>" : "boom");
    });
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("stub server listen failed");
  }
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    getLastRequest: () => lastRequest,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-grobid-"));
}

describe("grobid client", () => {
  let running: RunningServer | null = null;

  afterEach(async () => {
    if (running) {
      await running.close();
      running = null;
    }
  });

  it("posts a PDF and stores TEI xml", async () => {
    running = await startStubServer(200);
    const tmp = await createTempDir();
    const teiStore = createFsTeiStore({ home: resolveDeepScholarHome(tmp) });

    const grobid = createGrobidClient({
      fetch,
      rateLimiter: createRateLimiter({ requests: 10, windowMs: 1000 }),
      baseUrl: running.url,
    });

    const tei = await parseAndStoreTei({
      projectId: "proj-1",
      paperId: "paper-1",
      pdfBytes: new Uint8Array([1, 2, 3, 4]),
      grobid,
      teiStore,
    });

    expect(tei).toBe("<TEI>ok</TEI>");
    expect(await teiStore.loadTei("proj-1", "paper-1")).toBe("<TEI>ok</TEI>");
    expect(running.getLastRequest()).toEqual(
      expect.objectContaining({
        bytes: expect.any(Number),
        contentType: expect.stringContaining("multipart/form-data"),
      }),
    );
    expect((running.getLastRequest()?.bytes ?? 0) > 0).toBe(true);
  });

  it("surfaces HTTP errors without hiding them", async () => {
    running = await startStubServer(500);
    const grobid = createGrobidClient({
      fetch,
      rateLimiter: createRateLimiter({ requests: 10, windowMs: 1000 }),
      baseUrl: running.url,
    });

    await expect(grobid.processFulltextDocument(new Uint8Array([9]))).rejects.toThrow(
      /GROBID 解析失败/,
    );
  });
});
