import path from "node:path";

/** git 外の仕事用静的ツール置き場（リポジトリの兄弟ディレクトリ） */
export function getLocalStaticRoot(): string {
  return path.resolve(process.cwd(), "..", "programming-bukiko-local-static");
}
