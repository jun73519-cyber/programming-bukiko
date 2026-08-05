import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { toolsDataSchema, type ToolsData } from "@/lib/schema";

/**
 * tools.json をサーバー側だけで読む。
 * 静的 import するとフル JSON がバンドルに載るため、公開ビルドの漏洩検査で不利。
 */
export function loadToolsData(): ToolsData {
  const raw = readFileSync(
    join(process.cwd(), "data", "tools.json"),
    "utf-8",
  );
  const parsed: unknown = JSON.parse(raw);
  const result = toolsDataSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `tools.json の形式が正しくありません: ${result.error.issues[0]?.message}`,
    );
  }
  return result.data;
}
