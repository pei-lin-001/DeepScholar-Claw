import { describe, expect, it, vi } from "vitest";
import { createOpenAlexClient } from "./sources/openalex.ts";
import { createRateLimiter } from "./sources/rate-limiter.ts";
import { createSemanticScholarClient } from "./sources/semantic-scholar.ts";

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

describe("paper-intel sources", () => {
  it("rate limiter rejects invalid policy", () => {
    expect(() => createRateLimiter({ requests: 0, windowMs: 1000 })).toThrow();
    expect(() => createRateLimiter({ requests: 1, windowMs: 0 })).toThrow();
  });

  it("Semantic Scholar client parses papers and filters invalid rows", async () => {
    const acquireSlot = vi.fn(async () => {});
    const fetchCalls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchStub = vi.fn(async (input: string, init?: RequestInit) => {
      fetchCalls.push({
        url: input,
        headers: (init?.headers as Record<string, string>) ?? {},
      });
      return jsonResponse({
        data: [
          { paperId: " ", title: "missing id" },
          {
            paperId: "abc",
            title: "  My Paper  ",
            abstract: "  hello  ",
            year: 2026,
            venue: "  TestConf  ",
            citationCount: 12,
            tldr: { text: "  short  " },
            openAccessPdf: { url: " https://example.com/p.pdf " },
            externalIds: { DOI: " 10.1234/xyz " },
            authors: [{ name: " Alice " }, { name: "" }],
            references: [{ paperId: "ref1", title: "Ref 1" }, { paperId: "" }],
          },
        ],
      });
    });

    const client = createSemanticScholarClient({
      fetch: fetchStub,
      rateLimiter: { acquireSlot },
      apiKey: "secret",
      baseUrl: "https://api.semanticscholar.org/graph/v1",
    });

    const papers = await client.searchPapers({ query: "test", limit: 2 });
    expect(acquireSlot).toHaveBeenCalledTimes(1);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(fetchCalls[0]?.headers["x-api-key"]).toBe("secret");
    expect(papers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paperId: "abc",
          title: "My Paper",
          abstract: "hello",
          year: 2026,
          venue: "TestConf",
          citationCount: 12,
          tldr: "short",
          openAccessPdfUrl: "https://example.com/p.pdf",
          doi: "10.1234/xyz",
          source: "semantic-scholar",
        }),
      ]),
    );
    expect(papers[0]?.authors[0]?.name).toBe("Alice");
    expect(papers[0]?.references[0]?.paperId).toBe("ref1");
  });

  it("OpenAlex client reconstructs abstract and normalizes IDs", async () => {
    const acquireSlot = vi.fn(async () => {});
    const fetchStub = vi.fn(async () => {
      return jsonResponse({
        results: [
          {
            id: "https://openalex.org/W123",
            doi: "https://doi.org/10.5555/abc",
            display_name: "Hello World",
            publication_year: 2024,
            cited_by_count: 7,
            abstract_inverted_index: { Hello: [0], world: [1] },
            referenced_works: ["https://openalex.org/W999"],
            authorships: [{ author: { id: "https://openalex.org/A1", display_name: "Bob" } }],
            primary_location: { source: { display_name: "VenueX" } },
            open_access: { oa_url: "https://example.com/open.pdf" },
          },
        ],
      });
    });

    const client = createOpenAlexClient({
      fetch: fetchStub,
      rateLimiter: { acquireSlot },
      baseUrl: "https://api.openalex.org",
    });

    const papers = await client.searchPapers({ query: "hello", limit: 1 });
    expect(acquireSlot).toHaveBeenCalledTimes(1);
    expect(papers).toHaveLength(1);
    expect(papers[0]).toEqual(
      expect.objectContaining({
        paperId: "W123",
        title: "Hello World",
        abstract: "Hello world",
        year: 2024,
        venue: "VenueX",
        citationCount: 7,
        openAccessPdfUrl: "https://example.com/open.pdf",
        doi: "10.5555/abc",
        source: "openalex",
      }),
    );
    expect(papers[0]?.authors[0]?.authorId).toBe("A1");
    expect(papers[0]?.references[0]?.paperId).toBe("W999");
  });
});
