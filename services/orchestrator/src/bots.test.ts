import { describe, expect, it } from "vitest";
import { FIXED_BOTS, getFixedBot } from "./bots/fixed-bots.ts";
import { createInMemoryBotTemplateRegistry } from "./bots/template-registry.ts";

describe("bots", () => {
  it("exposes the three fixed roles", () => {
    expect(FIXED_BOTS.map((bot) => bot.botId)).toEqual(["editor", "auditor", "finance"]);
    expect(getFixedBot("editor").displayName).toContain("主编");
    expect(getFixedBot("auditor").displayName).toContain("审计");
    expect(getFixedBot("finance").displayName).toContain("财务");
  });

  it("registers and retrieves dynamic templates", () => {
    const registry = createInMemoryBotTemplateRegistry();
    registry.register({
      templateId: "literature-crawler",
      displayName: "文献抓取特战队",
      mission: "快速拉取并入库指定领域的论文元数据。",
      allowedSteps: ["step1_literature_crawl"],
    });

    expect(registry.list()).toHaveLength(1);
    expect(registry.get("literature-crawler").allowedSteps).toEqual(["step1_literature_crawl"]);
    expect(() =>
      registry.register({
        templateId: "literature-crawler",
        displayName: "重复",
        mission: "重复",
        allowedSteps: ["step1_literature_crawl"],
      }),
    ).toThrow(/已存在/);
  });
});
