#!/usr/bin/env node

/**
 * 公開ポートフォリオ向けの漏洩チェック。
 *
 * 1. tools.json を公開投影した JSON に社内断片が残っていないか
 * 2. public/ に仕事用 HTML・バックアップ等が混入していないか
 * 3. （任意）.next 配下に社内断片が残っていないか
 *
 * 使い方:
 *   node scripts/check-public-leak.mjs
 *   npm run check:public-leak
 *
 * ARSENAL_PUBLIC=1 のビルド後に .next を検査する場合:
 *   node scripts/check-public-leak.mjs --scan-next
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

const LEAK_PATTERNS = [
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

const FORBIDDEN_PUBLIC_FILES = [
  "password-manager.html",
  "reply_assistant.html",
  "fax-template.html",
  "hg_logo.jpg",
  "license-ledger-master.html",
  "reply_backup.json",
  "パスワード管理.html",
  "ライセンス台帳_マスター.html",
  "ライセンス台帳_閲覧用.html",
];

function resolveVisibility(tool, category) {
  return tool.visibility ?? category.defaultVisibility ?? "public";
}

function resolveOrigin(tool, category) {
  return tool.origin ?? category.defaultOrigin ?? "self";
}

function projectToolsForPublic(data) {
  const categories = [];
  for (const category of data.categories) {
    const tools = [];
    for (const tool of category.tools) {
      if (resolveOrigin(tool, category) === "material") continue;
      const visibility = resolveVisibility(tool, category);
      if (visibility === "summary") {
        tools.push({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          tags: tool.tags,
          status: tool.status,
          visibility: "summary",
          origin: resolveOrigin(tool, category),
        });
      } else {
        tools.push({
          ...tool,
          visibility: "public",
          origin: resolveOrigin(tool, category),
        });
      }
    }
    if (tools.length > 0) {
      categories.push({
        id: category.id,
        label: category.label,
        tools,
      });
    }
  }
  return { categories };
}

function findLeaks(text) {
  const hits = [];
  for (const { id, pattern } of LEAK_PATTERNS) {
    const match = text.match(pattern);
    if (match) hits.push({ id, sample: match[0] });
  }
  return hits;
}

function walkFiles(dir, predicate) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      out.push(...walkFiles(full, predicate));
    } else if (predicate(name, full)) {
      out.push(full);
    }
  }
  return out;
}

let failed = false;

const toolsPath = join(ROOT, "data", "tools.json");
const toolsData = JSON.parse(readFileSync(toolsPath, "utf-8"));
const projected = projectToolsForPublic(toolsData);
const projectedJson = JSON.stringify(projected);

const toolCount = projected.categories.reduce((n, c) => n + c.tools.length, 0);
console.log(`公開投影: ${projected.categories.length} カテゴリ / ${toolCount} ツール`);

const projectedLeaks = findLeaks(projectedJson);
if (projectedLeaks.length > 0) {
  failed = true;
  console.error("FAIL: 公開投影後の tools に社内断片が残っています:");
  for (const hit of projectedLeaks) {
    console.error(`  - [${hit.id}] ${hit.sample}`);
  }
} else {
  console.log("OK: 公開投影後の tools に既知の社内断片なし");
}

for (const category of projected.categories) {
  for (const tool of category.tools) {
    if (tool.visibility === "summary" && (tool.url || tool.execInfo)) {
      failed = true;
      console.error(
        `FAIL: summary ツール ${tool.id} に url/execInfo が残っています`,
      );
    }
  }
}

if (!projected.categories.some((c) => c.id === "learning")) {
  console.log("OK: learning（material）カテゴリは公開投影から除外");
} else {
  failed = true;
  console.error("FAIL: learning カテゴリが公開投影に残っています");
}

const publicDir = join(ROOT, "public");
for (const name of FORBIDDEN_PUBLIC_FILES) {
  const full = join(publicDir, name);
  if (existsSync(full)) {
    failed = true;
    console.error(`FAIL: public/${name} が残っています（git 外へ移すこと）`);
  }
}
for (const file of walkFiles(publicDir, (name) =>
  /^passwords_backup.*\.json$/i.test(name) ||
  /^reply_backup.*\.json$/i.test(name),
)) {
  failed = true;
  console.error(`FAIL: 禁止バックアップが public にあります: ${relative(ROOT, file)}`);
}
if (!failed) {
  console.log("OK: public/ に禁止ファイルなし");
}

const scanNext = process.argv.includes("--scan-next");
if (scanNext) {
  // 本番クライアント成果物のみ検査（.next/dev や *.map の絶対パスは対象外）
  const staticDir = join(ROOT, ".next", "static");
  if (!existsSync(staticDir)) {
    console.error(
      "FAIL: --scan-next 指定だが .next/static がありません。先に ARSENAL_PUBLIC=1 で build してください",
    );
    failed = true;
  } else {
    const targets = walkFiles(
      staticDir,
      (name) =>
        !name.endsWith(".map") &&
        (name.endsWith(".js") ||
          name.endsWith(".json") ||
          name.endsWith(".html") ||
          name.endsWith(".rsc")),
    );
    let nextHits = 0;
    for (const file of targets) {
      let text;
      try {
        text = readFileSync(file, "utf-8");
      } catch {
        continue;
      }
      const hits = findLeaks(text);
      if (hits.length > 0) {
        nextHits += 1;
        failed = true;
        console.error(`FAIL: .next/static 漏洩 ${relative(ROOT, file)}`);
        for (const hit of hits) {
          console.error(`  - [${hit.id}] ${hit.sample}`);
        }
      }
    }
    if (nextHits === 0) {
      console.log(
        `OK: .next/static 内 ${targets.length} ファイルに既知の社内断片なし`,
      );
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log("check:public-leak 成功");
