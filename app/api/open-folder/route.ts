import { exec, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** App Router で Node API（child_process）を使うことを明示 */
export const runtime = "nodejs";

type Body = { path?: string };

/** `base` 直下（子孫）に `resolved` があるか。`..` でベース外へ逃げないことを path.relative で検証する。 */
function isPathUnderBase(resolved: string, baseResolved: string): boolean {
  const rel = path.relative(baseResolved, resolved);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function isPathEqualBase(resolved: string, baseResolved: string): boolean {
  return resolved.toLowerCase() === baseResolved.toLowerCase();
}

/** 例: 武器庫を nozoe.HYPERGEAR で動かしつつ、別プロファイル nozoe 配下の repo を開く。 */
function windowsUsersRootResolved(): string {
  const drive = process.env.SystemDrive ?? "C:";
  return path.resolve(path.join(drive, "Users"));
}

function windowsExplorerExe(): string {
  const root = process.env.Windir ?? process.env.SystemRoot ?? "C:\\Windows";
  return path.join(root, "explorer.exe");
}

/** `spawn` の `stdio: "ignore"` だと Windows 上で GUI 子プロセスが起動しない事例があるため `pipe` にする。 */
function trySpawnDetached(cmd: string, args: string[], timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (cmd.endsWith("explorer.exe") && !fs.existsSync(cmd)) {
      resolve(false);
      return;
    }
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };

    const timer = setTimeout(() => done(false), timeoutMs);

    let child;
    try {
      child = spawn(cmd, args, {
        detached: true,
        stdio: "pipe",
      });
    } catch {
      done(false);
      return;
    }

    child.on("error", () => done(false));
    child.on("spawn", () => {
      child.unref();
      child.stdout?.destroy();
      child.stderr?.destroy();
      done(true);
    });
  });
}

/** PowerShell の単一引用符リテラル内に埋め込むためのエスケープ */
function escapeForPowerShellSingleQuoted(s: string): string {
  return s.replace(/'/g, "''");
}

/** PowerShell から起動すると、Node の直接 spawn よりユーザー画面に付きやすい場合がある。 */
function tryPowerShellStartExplorer(targetDir: string): Promise<boolean> {
  const explorerExe = windowsExplorerExe();
  const fe = escapeForPowerShellSingleQuoted(explorerExe);
  const td = escapeForPowerShellSingleQuoted(targetDir);
  const command = `Start-Process -LiteralPath '${fe}' -ArgumentList '${td}'`;
  return trySpawnDetached(
    "powershell.exe",
    ["-NoProfile", "-STA", "-WindowStyle", "Hidden", "-Command", command],
    5000,
  );
}

/** `cmd start` はユーザー既定の方法でフォルダーを開く（多くの環境で Explorer）。 */
function tryCmdStartFolder(targetDir: string): Promise<boolean> {
  return new Promise((resolve) => {
    const escaped = targetDir.replace(/"/g, '""');
    exec(`start "" "${escaped}"`, { windowsHide: true }, (err) => {
      resolve(!err);
    });
  });
}

async function openFolderOnWindows(resolved: string): Promise<{ ok: true } | { ok: false; detail: string }> {
  const explorerExe = windowsExplorerExe();

  if (await tryPowerShellStartExplorer(resolved)) {
    return { ok: true };
  }

  if (await tryCmdStartFolder(resolved)) {
    return { ok: true };
  }

  if (await trySpawnDetached(explorerExe, [resolved], 3000)) {
    return { ok: true };
  }

  if (await trySpawnDetached(explorerExe, [`/n,${resolved}`], 3000)) {
    return { ok: true };
  }

  return {
    ok: false,
    detail:
      "エクスプローラーの起動依頼に失敗しました（PowerShell・cmd・explorer の各手段）。ウイルス対策やポリシーでブロックされている可能性があります。武器庫に表示されているパスを手でコピーするか、Win + E でエクスプローラーを開いてアドレスバーに貼り付けてください。",
  };
}

export async function POST(request: Request) {
  if (process.platform !== "win32") {
    return Response.json({ error: "Windows のみ対応です" }, { status: 501 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "JSON が不正です" }, { status: 400 });
  }

  const raw = body.path;
  if (typeof raw !== "string" || raw.trim() === "") {
    return Response.json({ error: "path が必要です" }, { status: 400 });
  }

  const homeResolved = path.resolve(os.homedir());
  const usersResolved = windowsUsersRootResolved();
  let resolved: string;
  try {
    resolved = path.normalize(path.resolve(raw.trim()));
  } catch {
    return Response.json({ error: "パスが不正です" }, { status: 400 });
  }

  const underOwnHome =
    isPathEqualBase(resolved, homeResolved) || isPathUnderBase(resolved, homeResolved);
  const underUsersProfiles =
    isPathEqualBase(resolved, usersResolved) || isPathUnderBase(resolved, usersResolved);

  if (!underOwnHome && !underUsersProfiles) {
    return Response.json(
      { error: "許可されていないパスです（Users フォルダー外は開けません）" },
      { status: 403 },
    );
  }

  if (!fs.existsSync(resolved)) {
    return Response.json({ error: "パスが存在しません" }, { status: 404 });
  }

  const st = fs.statSync(resolved);
  if (!st.isDirectory()) {
    return Response.json({ error: "フォルダーではありません" }, { status: 400 });
  }

  const launch = await openFolderOnWindows(resolved);
  if (!launch.ok) {
    return Response.json({ error: launch.detail }, { status: 500 });
  }

  return Response.json({ ok: true });
}
