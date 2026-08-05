import { describe, it, expect } from "vitest";

import toolsData from "@/data/tools.json";
import {
  findPublicLeaks,
  hydrateToolClassification,
  isArsenalPublicMode,
  isWebLaunchUrl,
  projectToolsForPublic,
} from "@/lib/arsenal-public";
import { toolsDataSchema } from "@/lib/schema";

describe("tools.json arsenal schema", () => {
  it("data/tools.json は toolsDataSchema を満たす", () => {
    const result = toolsDataSchema.safeParse(toolsData);
    expect(result.success).toBe(true);
  });

  it("カテゴリに公開分類のデフォルトがある", () => {
    const result = toolsDataSchema.parse(toolsData);
    const byId = Object.fromEntries(result.categories.map((c) => [c.id, c]));
    expect(byId.work.defaultVisibility).toBe("summary");
    expect(byId.work.defaultOrigin).toBe("self");
    expect(byId.private.defaultVisibility).toBe("public");
    expect(byId.learning.defaultOrigin).toBe("material");
  });
});

describe("projectToolsForPublic", () => {
  const data = toolsDataSchema.parse(toolsData);

  it("material（学習用）を除外し、summary から url/execInfo を落とす", () => {
    const projected = projectToolsForPublic(data);
    expect(projected.categories.some((c) => c.id === "learning")).toBe(false);

    const work = projected.categories.find((c) => c.id === "work");
    expect(work).toBeDefined();
    expect(work!.tools.length).toBe(7);
    for (const tool of work!.tools) {
      expect(tool.visibility).toBe("summary");
      expect(tool.url).toBeUndefined();
      expect(tool.execInfo).toBeUndefined();
    }

    const privateCat = projected.categories.find((c) => c.id === "private");
    expect(privateCat).toBeDefined();
    expect(privateCat!.tools.length).toBe(8);
    const withUrl = privateCat!.tools.filter((t) => t.url);
    expect(withUrl.length).toBeGreaterThan(0);
  });

  it("公開投影後の JSON に既知の社内断片が無い", () => {
    const projected = projectToolsForPublic(data);
    const hits = findPublicLeaks(JSON.stringify(projected));
    expect(hits).toEqual([]);
  });

  it("フル tools.json には社内断片が残っている（ローカル用）", () => {
    const hits = findPublicLeaks(JSON.stringify(data));
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe("hydrateToolClassification", () => {
  it("省略時はカテゴリデフォルトを埋める", () => {
    const data = toolsDataSchema.parse(toolsData);
    const hydrated = hydrateToolClassification(data);
    const workTool = hydrated.categories
      .find((c) => c.id === "work")!
      .tools[0];
    expect(workTool.visibility).toBe("summary");
    expect(workTool.origin).toBe("self");
  });
});

describe("isArsenalPublicMode / isWebLaunchUrl", () => {
  it("ARSENAL_PUBLIC=1/true で公開モード", () => {
    expect(isArsenalPublicMode({ ARSENAL_PUBLIC: "1" })).toBe(true);
    expect(isArsenalPublicMode({ ARSENAL_PUBLIC: "true" })).toBe(true);
    expect(isArsenalPublicMode({})).toBe(false);
  });

  it("http(s) のみ Web 起動とみなす", () => {
    expect(isWebLaunchUrl("https://example.com")).toBe(true);
    expect(isWebLaunchUrl("file:///C:/tmp")).toBe(false);
    expect(isWebLaunchUrl(undefined)).toBe(false);
  });
});
