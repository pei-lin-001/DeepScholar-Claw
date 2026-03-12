import type { IsoTimestamp } from "@deepscholar/contracts";

export type PaperSourceId = "semantic-scholar" | "openalex" | "fixture";

export type PaperAuthor = {
  readonly name: string;
  readonly authorId?: string;
};

export type PaperReference = {
  readonly paperId: string;
  readonly title?: string;
};

export type RawPaper = {
  readonly paperId: string;
  readonly title: string;
  readonly abstract?: string;
  readonly year?: number;
  readonly venue?: string;
  readonly citationCount?: number;
  readonly tldr?: string;
  readonly authors: readonly PaperAuthor[];
  readonly references: readonly PaperReference[];
  readonly openAccessPdfUrl?: string;
  readonly doi?: string;
  readonly source: PaperSourceId;
  readonly fetchedAt: IsoTimestamp;
};

export type PaperSearchQuery = {
  readonly query: string;
  readonly limit: number;
};

export type RateLimitPolicy = {
  readonly requests: number;
  readonly windowMs: number;
};

export type RateLimiter = {
  acquireSlot(): Promise<void>;
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
