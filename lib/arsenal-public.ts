import type { Tool, ToolCategory, ToolsData, ToolOrigin, ToolVisibility } from "@/lib/schema";

/** Vercel 本番など、公開ポートフォリオ向けモード */
export function isArsenalPublicMode(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.ARSENAL_PUBLIC === "1" || env.ARSENAL_PUBLIC === "true";
}

export function resolveToolVisibility(
  tool: Tool,
  category: ToolCategory,
): ToolVisibility {
  return tool.visibility ?? category.defaultVisibility ?? "public";
}

export function resolveToolOrigin(
  tool: Tool,
  category: ToolCategory,
): ToolOrigin {
  return tool.origin ?? category.defaultOrigin ?? "self";
}

/**
 * 公開配信用に投影する。
 * - origin: material → 除外
 * - visibility: summary → url / execInfo を落とす
 */
export function projectToolsForPublic(data: ToolsData): ToolsData {
  const categories: ToolCategory[] = [];

  for (const category of data.categories) {
    const tools: Tool[] = [];
    for (const tool of category.tools) {
      if (resolveToolOrigin(tool, category) === "material") continue;

      const visibility = resolveToolVisibility(tool, category);
      if (visibility === "summary") {
        tools.push({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          tags: tool.tags,
          status: tool.status,
          visibility: "summary",
          origin: resolveToolOrigin(tool, category),
        });
      } else {
        tools.push({
          ...tool,
          visibility: "public",
          origin: resolveToolOrigin(tool, category),
        });
      }
    }
    if (tools.length > 0) {
      categories.push({
        id: category.id,
        label: category.label,
        defaultVisibility: category.defaultVisibility,
        defaultOrigin: category.defaultOrigin,
        tools,
      });
    }
  }

  return { categories };
}

/** ローカル／公開どちらでも、解決済み visibility/origin を明示したコピーを返す */
export function hydrateToolClassification(data: ToolsData): ToolsData {
  return {
    categories: data.categories.map((category) => ({
      ...category,
      tools: category.tools.map((tool) => ({
        ...tool,
        visibility: resolveToolVisibility(tool, category),
        origin: resolveToolOrigin(tool, category),
      })),
    })),
  };
}

/**
 * 公開成果物に含めてはいけない断片。
 * tools.json のフル版には残ってよいが、projectToolsForPublic 後や .next には出てはならない。
 */
export const PUBLIC_LEAK_PATTERNS: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  { id: "lan-ip", pattern: /192\.168\.\d+\.\d+/ },
  { id: "unc-share", pattern: /\\\\192\.168\./ },
  { id: "n-drive-file-url", pattern: /file:\/\/\/N:/i },
  { id: "n-drive-path", pattern: /N:\\nozoe/i },
  { id: "local-static-dir", pattern: /programming-bukiko-local-static/ },
  { id: "passwords-backup", pattern: /passwords_backup/i },
  { id: "sales-admin-tools", pattern: /sales-admin-tools/ },
  { id: "evidence-share", pattern: /証憑保存/ },
  { id: "company-onedrive", pattern: /株式会社ハイパーギア/ },
  { id: "hypergear-user-path", pattern: /nozoe\.HYPERGEAR/i },
];

export type LeakHit = { id: string; sample: string };

export function findPublicLeaks(text: string): LeakHit[] {
  const hits: LeakHit[] = [];
  for (const { id, pattern } of PUBLIC_LEAK_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      hits.push({ id, sample: match[0] });
    }
  }
  return hits;
}

/** http(s) でブラウザから起動できるか（公開 UI のリンクボタン判定） */
export function isWebLaunchUrl(url: string | undefined): boolean {
  if (!url) return false;
  const t = url.trim().toLowerCase();
  return t.startsWith("http://") || t.startsWith("https://");
}
