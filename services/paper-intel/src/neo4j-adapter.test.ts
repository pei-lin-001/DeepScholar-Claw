import { describe, expect, it, vi } from "vitest";

const run = vi.fn();
const closeSession = vi.fn(async () => {});
const closeDriver = vi.fn(async () => {});

const session = {
  run,
  close: closeSession,
};

const driver = {
  session: vi.fn(() => session),
  close: closeDriver,
};

const authBasic = vi.fn(() => ({ kind: "basic" }));

vi.mock("neo4j-driver", () => ({
  default: {
    driver: vi.fn(() => driver),
    auth: { basic: authBasic },
  },
}));

const { createNeo4jGraphStore } = await import("./graph/graph-store-neo4j.ts");

describe("neo4j graph adapter", () => {
  it("executes cypher for upserts and links", async () => {
    run.mockResolvedValue({ records: [] });

    const store = createNeo4jGraphStore({ uri: "neo4j://localhost", username: "u", password: "p" });

    await store.upsertPaper({ paperId: "P1", title: "t" });
    await store.upsertAuthor({ authorKey: "A1", name: "Alice" });
    await store.linkCitation("P1", "P2");
    await store.linkAuthorship("A1", "P1");

    expect(authBasic).toHaveBeenCalledWith("u", "p");
    expect(run).toHaveBeenCalled();

    const cypher = run.mock.calls.map((call) => String(call[0]));
    expect(cypher.join("\n")).toContain("MERGE (p:Paper");
    expect(cypher.join("\n")).toContain("MERGE (a:Author");
    expect(cypher.join("\n")).toContain("MERGE (from)-[:CITES]->(to)");
    expect(cypher.join("\n")).toContain("MERGE (a)-[:AUTHORED]->(p)");

    await store.close();
    expect(closeDriver).toHaveBeenCalledTimes(1);
  });

  it("reads neighbors from query results", async () => {
    run
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({
        records: [{ get: (key: string) => (key === "paperId" ? "P2" : "") }],
      })
      .mockResolvedValueOnce({
        records: [{ get: (key: string) => (key === "authorKey" ? "A1" : "") }],
      });

    const store = createNeo4jGraphStore({ uri: "neo4j://localhost", username: "u", password: "p" });
    await store.upsertPaper({ paperId: "P1" });
    await store.upsertAuthor({ authorKey: "A1", name: "Alice" });
    await store.linkCitation("P1", "P2");

    const neighbors = await store.getNeighbors("P1");
    expect(neighbors).toEqual({ citedPaperIds: ["P2"], authorKeys: ["A1"] });
  });
});
