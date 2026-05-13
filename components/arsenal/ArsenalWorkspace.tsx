"use client";

/**
 * ArsenalWorkspace: プログラミング武器庫の 3 ペイン親コンポーネント。
 *
 * レイアウト構造:
 *
 * ```
 * <SidebarProvider> (h-screen)
 * ┌─ Sidebar (Pane 1) ──┬─ SidebarInset ──────────────────────────┐
 * │ カテゴリナビ         │ ┌─ Header (h-12) ───────────────────┐  │
 * │ collapsible="icon"   │ └────────────────────────────────────┘  │
 * │                      │ ┌─ Pane 2 (w-72) ─┬─ Pane 3 (flex-1) ┐ │
 * │                      │ │  ツール一覧      │  ツール詳細       │ │
 * └──────────────────────┴─┴─────────────────┴───────────────────┘
 * ```
 */

import { useMemo, useState } from "react";
import {
  Wrench,
  ExternalLink,
  Tag,
  CircleDashed,
  CircleCheck,
  Info,
  FolderOpen,
} from "lucide-react";
import { type ToolCategory, type Tool } from "@/lib/schema";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Pane1Toggle } from "@/components/workspace/Pane1Toggle";
import { fileUrlToWindowsPath } from "@/lib/file-url-to-windows-path";
import { cn } from "@/lib/utils";

type ArsenalWorkspaceProps = {
  categories: ToolCategory[];
};

export function ArsenalWorkspace({ categories }: ArsenalWorkspaceProps) {
  const firstCategory = categories[0];
  const firstTool = firstCategory?.tools[0] ?? null;

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    firstCategory?.id ?? "",
  );
  const [selectedToolId, setSelectedToolId] = useState<string>(
    firstTool?.id ?? "",
  );

  const activeCategory =
    categories.find((c) => c.id === selectedCategoryId) ?? firstCategory;
  const activeTool =
    activeCategory?.tools.find((t) => t.id === selectedToolId) ??
    activeCategory?.tools[0] ??
    null;

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    const category = categories.find((c) => c.id === categoryId);
    if (category && category.tools.length > 0) {
      setSelectedToolId(category.tools[0].id);
    }
  };

  return (
    <SidebarProvider
      defaultOpen
      className="h-screen w-full overflow-hidden bg-background text-foreground"
    >
      {/* Pane 1: カテゴリナビ */}
      <Sidebar
        collapsible="icon"
        className="border-r border-sidebar-border [&_[data-slot=sidebar-container]]:bg-sidebar"
      >
        <SidebarHeader className="border-b border-sidebar-border p-0">
          <div className="flex h-12 items-center justify-between gap-2 px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[state=expanded]:px-5">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <Wrench className="size-4 shrink-0 text-sidebar-primary" />
              <h2 className="truncate text-sm font-semibold text-sidebar-foreground">
                プログラミング武器庫
              </h2>
            </div>
            <Pane1Toggle />
          </div>
        </SidebarHeader>

        <SidebarContent className="px-1 py-3 group-data-[collapsible=icon]:hidden">
          <SidebarMenu>
            {categories.map((category) => (
              <SidebarMenuItem key={category.id}>
                <SidebarMenuButton
                  isActive={category.id === selectedCategoryId}
                  onClick={() => handleSelectCategory(category.id)}
                  className="gap-2"
                >
                  <span className="truncate">{category.label}</span>
                  <Badge variant="secondary" className="ml-auto shrink-0 text-xs tabular-nums">
                    {category.tools.length}
                  </Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="flex min-w-0 flex-col bg-background">
        {/* Header */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <span className="text-sm font-medium text-foreground">
            {activeCategory?.label ?? "武器庫"}
          </span>
          {activeTool && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm text-muted-foreground">{activeTool.name}</span>
            </>
          )}
        </header>

        {/* Pane 2 + Pane 3 */}
        <div className="flex min-h-0 flex-1">
          {/* Pane 2: ツール一覧 */}
          <div className="pane2-cyber flex w-72 shrink-0 flex-col border-r border-border">
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-1 p-2">
                {(activeCategory?.tools ?? []).map((tool) => (
                  <ToolListItem
                    key={tool.id}
                    tool={tool}
                    isSelected={tool.id === selectedToolId}
                    onSelect={() => setSelectedToolId(tool.id)}
                  />
                ))}
                {(activeCategory?.tools ?? []).length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    ツールがありません
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Pane 3: ツール詳細 */}
          <div className="hologram-panel flex min-w-0 flex-1 flex-col">
            {/* ぼかし背景レイヤー — 画像のテキストを消してロボットアームの形状だけ残す */}
            <div aria-hidden="true" className="pane3-bg" />
            {/* メカニカルフレーム — 四隅のブラケット */}
            <span aria-hidden="true" className="mech-corner mech-corner--tl" />
            <span aria-hidden="true" className="mech-corner mech-corner--tr" />
            <span aria-hidden="true" className="mech-corner mech-corner--bl" />
            <span aria-hidden="true" className="mech-corner mech-corner--br" />
            {activeTool ? (
              <ToolDetailPanel key={activeTool.id} tool={activeTool} />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  左のリストからツールを選択してください
                </p>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// ===== Pane 2 の行コンポーネント =====

type ToolListItemProps = {
  tool: Tool;
  isSelected: boolean;
  onSelect: () => void;
};

function ToolListItem({ tool, isSelected, onSelect }: ToolListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "cyber-list-item flex w-full flex-col gap-1 rounded-[var(--radius-md)] px-3 py-2.5 text-left",
        isSelected ? "cyber-list-item--active" : "",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-foreground">{tool.name}</span>
        <StatusBadge status={tool.status} />
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{tool.description}</p>
    </button>
  );
}

// ===== Pane 3 の詳細パネル =====

type ToolDetailPanelProps = {
  tool: Tool;
};

/** http(s) / file / mailto 以外は同一オリジン上の相対パスとして解決する */
function resolveToolLaunchUrl(raw: string): string {
  const t = raw.trim();
  if (
    t.startsWith("http://") ||
    t.startsWith("https://") ||
    t.startsWith("mailto:") ||
    t.startsWith("file:")
  ) {
    return t;
  }
  if (t.startsWith("/")) {
    return new URL(t, window.location.origin).href;
  }
  return t;
}

/** Windows パスの末尾フォルダ名（表示用） */
function windowsPathLeaf(winPath: string): string {
  const trimmed = winPath.replace(/[/\\]+$/, "");
  const parts = trimmed.split(/[/\\]/);
  return parts[parts.length - 1] || trimmed;
}

function ToolDetailPanel({ tool }: ToolDetailPanelProps) {
  const localExplorerAvailable = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const onLocalhost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1";
    const onWindows = /Win/i.test(navigator.userAgent);
    return onLocalhost && onWindows;
  }, []);

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fileWindowsPath =
    tool.url?.startsWith("file:") && tool.url ? fileUrlToWindowsPath(tool.url) : null;

  return (
    <ScrollArea className="flex-1">
      <div className="p-6">
      <div className="pane3-content flex flex-col gap-6">
        {/* タイトルとステータス */}
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <h1 className="neon-text text-xl font-bold">{tool.name}</h1>
            <StatusBadge status={tool.status} size="md" />
          </div>
          <p className="text-sm text-foreground">{tool.description}</p>
        </div>

        <Separator />

        {/* タグ */}
        <div className="flex flex-col gap-2">
          <div className="neon-label flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
            <Tag className="size-3" />
            タグ
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tool.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* 実行情報（execInfo が有るときのみ表示） */}
        {tool.execInfo && tool.execInfo.length > 0 && (
          <>
            <div className="flex flex-col gap-3">
              <p className="neon-label text-xs font-semibold uppercase tracking-wide">
                実行情報
              </p>
              <dl className="flex flex-col gap-2">
                {tool.execInfo.map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <dt className="flex w-24 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="size-3 shrink-0" />
                      {label}
                    </dt>
                    <dd className="text-sm text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Separator />
          </>
        )}

        {/* 起動・操作 */}
        <div className="flex flex-col gap-3">
          <p className="neon-label text-xs font-semibold uppercase tracking-wide">
            操作
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {fileWindowsPath ? (
                <>
                  {localExplorerAvailable && (
                    <Button
                      type="button"
                      className="neon-breathe gap-1.5"
                      onClick={async () => {
                        setActionMessage(null);
                        try {
                          const res = await fetch("/api/open-folder", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ path: fileWindowsPath }),
                          });
                          const data: { error?: string } = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            setActionMessage(
                              typeof data.error === "string" ? data.error : "開けませんでした",
                            );
                            return;
                          }
                          let copiedOk = false;
                          try {
                            await navigator.clipboard.writeText(fileWindowsPath);
                            copiedOk = true;
                          } catch {
                            copiedOk = false;
                          }
                          const leaf = windowsPathLeaf(fileWindowsPath);
                          setActionMessage(
                            [
                              copiedOk
                                ? "フォルダーのパスをクリップボードにコピーしました。"
                                : "クリップボードへのコピーに失敗しました。下に表示したパスをドラッグで選択し、右クリック→コピーしてください。",
                              "",
                              "エクスプローラーで開くには:",
                              "1. キーボードで Win + E",
                              "2. アドレスバーをクリック → Ctrl + V で貼り付け → Enter",
                              "",
                              `フォルダー「${leaf}」の場所:`,
                              fileWindowsPath,
                              "",
                              "（参考）この PC 上の Next がエクスプローラー自動起動も試みますが、環境によってはウィンドウは出ません。",
                            ].join("\n"),
                          );
                          window.setTimeout(() => setActionMessage(null), 25000);
                        } catch {
                          setActionMessage("通信に失敗しました");
                        }
                      }}
                    >
                      <FolderOpen className="size-4" />
                      パスをコピーして開き方を表示
                    </Button>
                  )}
                  {tool.url && (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setActionMessage(null);
                        const href = resolveToolLaunchUrl(tool.url!);
                        const win = window.open(href, "_blank", "noopener,noreferrer");
                        if (win == null) {
                          setActionMessage(
                            "別タブを開けませんでした（ポップアップブロックの可能性）。ブラウザでポップアップを許可するか、URL を手入力してください。",
                          );
                        }
                      }}
                    >
                      <ExternalLink className="size-4" />
                      file:// を試す
                    </Button>
                  )}
                </>
              ) : tool.url ? (
                <Button
                  type="button"
                  className={cn(buttonVariants({ className: "neon-breathe gap-1.5" }))}
                  onClick={() => {
                    setActionMessage(null);
                    const href = resolveToolLaunchUrl(tool.url!);
                    const win = window.open(href, "_blank", "noopener,noreferrer");
                    if (win == null) {
                      setActionMessage(
                        "別タブを開けませんでした（ポップアップブロックの可能性）。ブラウザでポップアップを許可してください。",
                      );
                    }
                  }}
                >
                  <ExternalLink className="size-4" />
                  ツールを起動
                </Button>
              ) : (
                <Button type="button" disabled className="gap-1.5">
                  <ExternalLink className="size-4" />
                  ツールを起動
                </Button>
              )}
              {tool.status === "wip" && (
                <p className="text-xs text-muted-foreground">
                  このツールは現在開発中です
                </p>
              )}
              {!tool.url && tool.status !== "wip" && (
                <p className="text-xs text-muted-foreground">
                  起動 URL が未設定です
                </p>
              )}
            </div>
            {fileWindowsPath && (
              <p className="text-xs text-muted-foreground">
                ブラウザの仕様で、http ページからの file:// リンクは開けないことがあります。
                「パスをコピーして開き方を表示」は、フォルダーのパスをクリップボードに載せ、エクスプローラーでの開き方を案内します。
                あわせてこの PC の Next がエクスプローラー自動起動を試みますが、環境によってはウィンドウは出ません。
              </p>
            )}
            {actionMessage && (
              <p
                className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-foreground whitespace-pre-wrap break-all"
                role="status"
              >
                {actionMessage}
              </p>
            )}
          </div>
        </div>
      </div>
      </div>
    </ScrollArea>
  );
}

// ===== ステータスバッジ =====

type StatusBadgeProps = {
  status: Tool["status"];
  size?: "sm" | "md";
};

function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const isActive = status === "active";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
        isActive
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
      )}
    >
      {isActive ? (
        <CircleCheck className="size-3" />
      ) : (
        <CircleDashed className="size-3" />
      )}
      {isActive ? "稼働中" : "開発中"}
    </span>
  );
}
