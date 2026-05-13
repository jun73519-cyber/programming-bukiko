/**
 * `file:///C:/Users/...` を Windows のローカルパスに変換する（武器庫の file:// リンク用）。
 * UNC やドライブ以外の形式は null。
 */
export function fileUrlToWindowsPath(fileUrl: string): string | null {
  try {
    const u = new URL(fileUrl);
    if (u.protocol !== "file:") return null;
    if (u.hostname && u.hostname !== "localhost") return null;

    let pathname = u.pathname;
    if (/^\/[A-Za-z]:\//.test(pathname)) {
      pathname = pathname.slice(1);
    }
    const decoded = decodeURIComponent(pathname.replace(/\//g, "\\"));
    if (/^[A-Za-z]:\\/.test(decoded)) return decoded;
    return null;
  } catch {
    return null;
  }
}
