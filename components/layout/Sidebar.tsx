"use client";

/**
 * Sidebar — 左栏：新建会话 + 历史列表。
 *
 * 宽度 320px，可滚动。顶部固定「New Session」按钮，中间历史列表。
 * 配置面板已移至 SessionView 底部（每会话独立 config）。
 */

import { SessionList } from "@/components/sessions/SessionList";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useActiveSession } from "@/stores/active-session";
import { Plus, Terminal } from "lucide-react";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function Sidebar() {
  const { dispatch } = useActiveSession();
  const { t } = useLanguage();

  const newSession = () => {
    dispatch({ type: "RESET" });
    dispatch({ type: "SET_RESUME", sessionId: null });
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface))]">
      {/* 顶部：Logo + 主题切换 + New Session */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--overlay)/0.05)]">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-[hsl(var(--primary))]" />
          <span className="font-mono text-sm font-semibold tracking-tight">
            codex<span className="text-[hsl(var(--muted-foreground))]">-webui</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <LanguageToggle />
          <button
            onClick={newSession}
            className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--overlay)/0.05)] px-2 py-1 text-xs font-medium text-foreground/80 hover:bg-[hsl(var(--overlay)/0.1)] hover:text-foreground transition-colors focus-ring"
            title={t("sidebar.newSession")}
          >
            <Plus className="h-3 w-3" />
            {t("sidebar.new")}
          </button>
        </div>
      </div>

      {/* 中间：历史会话列表（可滚动） */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <SessionList />
      </div>
    </aside>
  );
}
