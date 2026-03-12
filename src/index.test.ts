import { describe, expect, it } from "vitest";
import { normalizeCliArgv } from "./index.ts";

describe("CLI entry argv normalization", () => {
  it("drops node executable and script path before handing args to commander", () => {
    expect(
      normalizeCliArgv([
        "/opt/homebrew/Cellar/node/25.3.0/bin/node",
        "/Users/demo/DeepScholar-Claw/src/index.ts",
        "research",
        "paper",
        "visualize",
        "--help",
      ]),
    ).toEqual(["research", "paper", "visualize", "--help"]);
  });

  it("also strips pnpm's argument separator when present", () => {
    expect(
      normalizeCliArgv([
        "/opt/homebrew/Cellar/node/25.3.0/bin/node",
        "/Users/demo/DeepScholar-Claw/src/index.ts",
        "--",
        "research",
        "paper",
        "visualize",
        "--help",
      ]),
    ).toEqual(["research", "paper", "visualize", "--help"]);
  });
});
