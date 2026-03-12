import crypto from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { nowIsoTimestamp, type IsoTimestamp } from "@deepscholar/contracts";
import type { FetchLike } from "../sources/types.ts";

const DEFAULT_USER_AGENT = "DeepScholar-Claw/pdf-downloader";
const PDF_MAGIC = "%PDF";
const PDF_MAGIC_BYTES = 4;

export type PdfDownloadMeta = {
  readonly sourceUrl: string;
  readonly finalUrl: string;
  readonly fetchedAt: IsoTimestamp;
  readonly httpStatus: number;
  readonly contentType: string | null;
  readonly bytes: number;
  readonly sha256: string;
};

export type PdfDownloadResult = PdfDownloadMeta & {
  readonly pdfPath: string;
  readonly metaPath: string;
};

function looksLikePdfHeader(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC_BYTES) {
    return false;
  }
  const head = Buffer.from(bytes.subarray(0, PDF_MAGIC_BYTES)).toString("utf8");
  return head === PDF_MAGIC;
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fsPromises.unlink(filePath);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return;
    }
    throw err;
  }
}

async function readFirstBytes(filePath: string, count: number): Promise<Uint8Array> {
  const handle = await fsPromises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(count);
    const read = await handle.read(buffer, 0, count, 0);
    return buffer.subarray(0, read.bytesRead);
  } finally {
    await handle.close();
  }
}

function explainHttpFailure(params: {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly contentType: string | null;
  readonly bodySnippet: string;
}): string {
  const snippet = params.bodySnippet.trim() ? ` body=${JSON.stringify(params.bodySnippet)}` : "";
  return [
    `HTTP ${params.status} ${params.statusText}`,
    `url=${params.url}`,
    `contentType=${params.contentType ?? "(none)"}`,
  ].join(" ") + snippet;
}

export async function downloadOpenAccessPdfToFile(input: {
  readonly fetch: FetchLike;
  readonly url: string;
  readonly pdfPath: string;
  readonly metaPath: string;
  readonly userAgent?: string;
}): Promise<PdfDownloadResult> {
  const userAgent = input.userAgent ?? DEFAULT_USER_AGENT;
  const response = await input.fetch(input.url, {
    redirect: "follow",
    headers: { "user-agent": userAgent },
  });

  const contentType = response.headers.get("content-type");
  if (!response.ok) {
    const bodySnippet = await response.text().catch(() => "");
    throw new Error(
      `PDF 下载失败: ${explainHttpFailure({
        status: response.status,
        statusText: response.statusText,
        url: response.url || input.url,
        contentType,
        bodySnippet: bodySnippet.slice(0, 500),
      })}`,
    );
  }
  if (!response.body) {
    throw new Error("PDF 下载失败: response body 为空");
  }

  await fsPromises.mkdir(path.dirname(input.pdfPath), { recursive: true });
  await fsPromises.mkdir(path.dirname(input.metaPath), { recursive: true });

  const tmpPath = `${input.pdfPath}.tmp-${crypto.randomUUID()}`;
  const hasher = crypto.createHash("sha256");
  let bytes = 0;

  const tap = new Transform({
    transform(chunk, _encoding, callback) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buf.length;
      hasher.update(buf);
      callback(null, buf);
    },
  });

  try {
    // `fetch()` returns a web ReadableStream; Node's `Readable.fromWeb` expects the
    // node:stream/web type, so we cast across the lib.dom/lib.node type mismatch.
    const body = response.body as unknown as NodeReadableStream<Uint8Array>;
    await pipeline(Readable.fromWeb(body), tap, fs.createWriteStream(tmpPath));
    await fsPromises.rename(tmpPath, input.pdfPath);
  } catch (err) {
    await safeUnlink(tmpPath);
    throw err;
  }

  const head = await readFirstBytes(input.pdfPath, PDF_MAGIC_BYTES);
  if (!looksLikePdfHeader(head)) {
    await safeUnlink(input.pdfPath);
    const headText = Buffer.from(head).toString("utf8");
    throw new Error(
      `PDF 下载内容不是有效 PDF（缺少 %PDF 头）: contentType=${contentType ?? "(none)"} head=${JSON.stringify(headText)}`,
    );
  }

  const finalUrl = response.url || input.url;
  const fetchedAt = nowIsoTimestamp();
  const sha256 = hasher.digest("hex");
  const meta: PdfDownloadMeta = {
    sourceUrl: input.url,
    finalUrl,
    fetchedAt,
    httpStatus: response.status,
    contentType,
    bytes,
    sha256,
  };
  await fsPromises.writeFile(input.metaPath, JSON.stringify(meta, null, 2), "utf8");
  return { ...meta, pdfPath: input.pdfPath, metaPath: input.metaPath };
}
