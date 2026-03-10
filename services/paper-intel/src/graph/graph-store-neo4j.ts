import neo4j from "neo4j-driver";
import type { Session } from "neo4j-driver";
import type { GraphAuthorNode, GraphPaperNode, GraphStore, PaperNeighbors } from "./graph-store.ts";

export type Neo4jGraphStoreOptions = {
  readonly uri: string;
  readonly username: string;
  readonly password: string;
};

function readRecordsString(records: unknown[], key: string): string[] {
  return records
    .map((record) => {
      if (
        record &&
        typeof record === "object" &&
        "get" in record &&
        typeof record.get === "function"
      ) {
        return String(record.get(key));
      }
      return "";
    })
    .filter((value) => value.length > 0);
}

export function createNeo4jGraphStore(options: Neo4jGraphStoreOptions): GraphStore {
  const driver = neo4j.driver(options.uri, neo4j.auth.basic(options.username, options.password));

  async function withSession<T>(fn: (session: Session) => Promise<T>): Promise<T> {
    const session = driver.session();
    try {
      return await fn(session);
    } finally {
      await session.close();
    }
  }

  async function upsertPaper(paper: GraphPaperNode): Promise<void> {
    await withSession(async (session) => {
      await session.run(
        [
          "MERGE (p:Paper {paperId: $paperId})",
          "SET p.title = coalesce($title, p.title)",
          "SET p.year = coalesce($year, p.year)",
          "SET p.venue = coalesce($venue, p.venue)",
        ].join("\n"),
        paper,
      );
    });
  }

  async function upsertAuthor(author: GraphAuthorNode): Promise<void> {
    await withSession(async (session) => {
      await session.run(
        [
          "MERGE (a:Author {authorKey: $authorKey})",
          "SET a.name = coalesce($name, a.name)",
          "SET a.authorId = coalesce($authorId, a.authorId)",
        ].join("\n"),
        author,
      );
    });
  }

  async function linkCitation(fromPaperId: string, toPaperId: string): Promise<void> {
    await withSession(async (session) => {
      await session.run(
        [
          "MERGE (from:Paper {paperId: $fromPaperId})",
          "MERGE (to:Paper {paperId: $toPaperId})",
          "MERGE (from)-[:CITES]->(to)",
        ].join("\n"),
        { fromPaperId, toPaperId },
      );
    });
  }

  async function linkAuthorship(authorKey: string, paperId: string): Promise<void> {
    await withSession(async (session) => {
      await session.run(
        [
          "MERGE (a:Author {authorKey: $authorKey})",
          "MERGE (p:Paper {paperId: $paperId})",
          "MERGE (a)-[:AUTHORED]->(p)",
        ].join("\n"),
        { authorKey, paperId },
      );
    });
  }

  async function getNeighbors(paperId: string): Promise<PaperNeighbors> {
    return await withSession(async (session) => {
      const citedResult = await session.run(
        "MATCH (:Paper {paperId: $paperId})-[:CITES]->(to:Paper) RETURN to.paperId as paperId",
        { paperId },
      );
      const authorResult = await session.run(
        "MATCH (a:Author)-[:AUTHORED]->(:Paper {paperId: $paperId}) RETURN a.authorKey as authorKey",
        { paperId },
      );

      return {
        citedPaperIds: readRecordsString(citedResult.records, "paperId"),
        authorKeys: readRecordsString(authorResult.records, "authorKey"),
      };
    });
  }

  async function close(): Promise<void> {
    await driver.close();
  }

  return {
    upsertPaper,
    upsertAuthor,
    linkCitation,
    linkAuthorship,
    getNeighbors,
    close,
  };
}
