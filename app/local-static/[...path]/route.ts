import { readFile } from "node:fs/promises";
import path from "node:path";

import { isArsenalPublicMode } from "@/lib/arsenal-public";
import { getLocalStaticRoot } from "@/lib/local-static-root";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** `base` 直下（子孫）に `resolved` があるか */
function isPathUnderBase(resolved: string, baseResolved: string): boolean {
  const rel = path.relative(baseResolved, resolved);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * ローカル専用: git 外フォルダの HTML 等を同一オリジンで配信する。
 * 公開モード（ARSENAL_PUBLIC）では 404。
 */
export async function GET(_request: Request, context: RouteContext) {
  if (isArsenalPublicMode()) {
    return new Response("Not Found", { status: 404 });
  }

  const segments = (await context.params).path ?? [];
  if (segments.length === 0) {
    return new Response("Not Found", { status: 404 });
  }
  if (segments.some((s) => s === ".." || s.includes("\0"))) {
    return new Response("Bad Request", { status: 400 });
  }

  const root = getLocalStaticRoot();
  const resolved = path.resolve(root, ...segments);
  if (!isPathUnderBase(resolved, root)) {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    const body = await readFile(resolved);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(resolved),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}
