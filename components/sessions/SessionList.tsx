"use client";

/**
 * SessionList — 历史会话列表。
 *
 * SWR 拉取，点击加载回放。按 cwd（项目）分组展示，组标题显示项目名。
 */

import { useSessionList } from "@/hooks/useSessionList";
import { useReplayStream } from "@/hooks/useReplayStream";
import { useConfig } from "@/hooks/useConfig";
import { useActiveSession } from "@/stores/active-session";
import { SessionListItem } from "./SessionListItem";
import { MessageSquare, RefreshCw, Search, Folder } from "lucide-react";
import { useState, useMemo } from "react";
import type { ThreadItem } from "@/types/api";
import { projectName } from "@/lib/utils/format";

export function SessionList() {
  const { prefs } = useConfig();
  const [q, setQ] = useState("");
  const { sessions, isLoading, mutate } = useSessionList(undefined, q || undefined);
  const { replay, isReplaying } = useReplayStream();
  const { state } = useActiveSession();

  // 按 cwd 分组（保持组内按 updatedAt 降序，组间按组内最新会话时间降序）
  const grouped = useMemo(() => {
    const map = new Map<string, ThreadItem[]>();
    for (const s of sessions) {
      const key = s.cwd || "(no project)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    // 每组内部已由 API 返回降序，无需再排
    // 组间按组内最新 updatedAt 降序
    return Array.from(map.entries()).sort((a, b) => {
      const ta = a[1][0]?.updatedAt || "";
      const tb = b[1][0]?.updatedAt || "";
      return tb.localeCompare(ta);
    });
  }, [sessions]);

  // 可选：按 prefs.cwd 高亮当前项目（暂不做过滤，仅标记）
  void prefs;

  return (
    <div className="flex h-full flex-col">
      {/* 搜索框 */}
      <div className="px-3 py-2 border-b border-[hsl(var(--overlay)/0.05)]">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface-2))] px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search sessions…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-[hsl(var(--muted-foreground))] outline-none"
            />
          </div>
          <button
            onClick={() => mutate()}
            className="rounded-md border border-[hsl(var(--overlay)/0.1)] p-1.5 text-[hsl(var(--muted-foreground))] hover:text-foreground hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading && sessions.length === 0 ? (
          <div className="px-3 py-4 text-center font-mono text-xs text-[hsl(var(--muted-foreground))]">
            loading…
          </div>
        ) : grouped.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <MessageSquare className="mx-auto mb-2 h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {q ? "No matching sessions" : "No sessions yet"}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {grouped.map(([cwd, items]) => (
              <SessionGroup
                key={cwd}
                cwd={cwd}
                items={items}
                activeId={state.resumeSessionId || state.threadId}
                replayingId={isReplaying ? state.threadId : null}
                onPick={replay}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SessionGroupProps {
  cwd: string;
  items: ThreadItem[];
  activeId: string | null;
  replayingId: string | null;
  onPick: (id: string) => void;
}

function SessionGroup({ cwd, items, activeId, replayingId, onPick }: SessionGroupProps) {
  // 默认折叠（用户要求：项目菜单默认不展开）
  const [collapsed, setCollapsed] = useState(true);
  const name = projectName(cwd);

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="sticky top-0 z-10 flex w-full items-start gap-1.5 bg-[hsl(var(--surface))] px-3 py-1.5 text-left hover:bg-[hsl(var(--overlay)/0.03)] transition-colors focus-ring border-b border-[hsl(var(--overlay)/0.05)]"
        title={cwd}
      >
        <Folder className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
        <div className="flex-1 min-w-0">
          {/* 项目标题：微软雅黑（跟随 --font-sans），移除 font-mono/uppercase/tracking */}
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-[hsl(var(--muted-foreground))]">
              {name}
            </span>
            <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]/60">
              {items.length}
            </span>
          </div>
          {/* 文件夹路径：标题下方显示完整 cwd，小字号淡色，超长截断 */}
          <div
            className="mt-0.5 truncate text-[10px] leading-tight text-[hsl(var(--muted-foreground))]/50"
            title={cwd}
          >
            {cwd}
          </div>
        </div>
        <span
          className={`mt-0.5 shrink-0 text-xs text-[hsl(var(--muted-foreground))] transition-transform ${
            collapsed ? "" : "rotate-90"
          }`}
        >
          ›
        </span>
      </button>
      {!collapsed && (
        <ul>
          {items.map((s) => (
            <SessionListItem
              key={s.id}
              session={s}
              active={activeId === s.id}
              loading={replayingId === s.id}
              onClick={() => onPick(s.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
