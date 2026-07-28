"use client";

/**
 * AppShell — 三栏布局容器。
 *
 * 左栏（Sidebar）：新建会话 + 历史列表
 * 右栏（MainArea）：TopBar 状态条 + 主内容（SessionView / EmptyState） + ConfigPanel
 * 全屏 DiffViewerDialog（受控，由 FileChangeCard 触发）
 *
 * ConfigPanel 统一放在 <main> 下方，这样：
 * - 会话状态：位于 Composer（对话框）下方
 * - 空状态：位于欢迎页下方，便于在发起会话前设置 cwd 等配置
 * 每个会话的 config 独立持久化（见 useConfig 的 per-session 偏好）。
 *
 * 设计：暗色基底，1px 分隔线，无阴影，信息密度高。
 */

import { useState, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { SessionView } from "@/components/session/SessionView";
import { EmptyState } from "@/components/session/EmptyState";
import { ConfigPanel } from "@/components/config/ConfigPanel";
import { DiffViewerDialog } from "@/components/diff/DiffViewerDialog";
import { Toaster } from "@/components/ui/Toaster";
import type { FileChangeItem } from "@/types/api";
import { useActiveSession } from "@/stores/active-session";

export function AppShell() {
  const { state } = useActiveSession();
  const [diffTarget, setDiffTarget] = useState<FileChangeItem | null>(null);

  const openDiff = useCallback((item: FileChangeItem) => setDiffTarget(item), []);
  const closeDiff = useCallback(() => setDiffTarget(null), []);

  const hasContent = state.timeline.length > 0 || state.status !== "idle";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* 左栏 */}
      <Sidebar />

      {/* 右栏 */}
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar />
        <main className="flex-1 min-h-0 overflow-hidden">
          {hasContent ? <SessionView onOpenDiff={openDiff} /> : <EmptyState />}
        </main>

        {/* 配置面板：始终在主区域底部（对话框下方），每会话独立 */}
        <div className="shrink-0 border-t border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface))]">
          <ConfigPanel />
        </div>
      </div>

      {/* 全屏 Diff 查看器 */}
      {diffTarget && (
        <DiffViewerDialog item={diffTarget} onClose={closeDiff} />
      )}

      {/* 全局通知（右下角 toast） */}
      <Toaster />
    </div>
  );
}
