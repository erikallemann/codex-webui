"use client";

/**
 * SessionListItem — 单条会话列表项。
 *
 * 标题（首条用户消息 preview）+ 时间标注（绝对时间 + 相对时间）。
 * cwd 已在组标题展示，此处不再重复。
 */

import type { ThreadItem } from "@/types/api";
import { formatTime, timeAgo } from "@/lib/utils/format";
import { Loader2, ChevronRight } from "lucide-react";

interface Props {
  session: ThreadItem;
  active: boolean;
  loading: boolean;
  onClick: () => void;
  /** 项目组内会话缩进；非项目对话顶层列表不缩进 */
  indented?: boolean;
}

export function SessionListItem({ session, active, loading, onClick, indented = true }: Props) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`group flex w-full items-start gap-2 py-2 pr-3 text-left transition-colors focus-ring ${indented ? "pl-8" : "pl-3"} ${
          active
            ? "bg-[hsl(var(--primary)/0.08)] border-l-2 border-[hsl(var(--primary))]"
            : "hover:bg-[hsl(var(--overlay)/0.03)] border-l-2 border-transparent"
        }`}
      >
        <div className="flex-1 min-w-0">
          {/* 标题：首条用户消息 */}
          <div className="text-sm font-medium text-foreground/90 line-clamp-2 leading-snug">
            {session.preview}
          </div>
          {/* 时间标注：绝对时间 + 相对时间 */}
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
            <span className="shrink-0" title={new Date(session.updatedAt).toString()}>
              {formatTime(session.updatedAt)}
            </span>
            <span className="shrink-0 opacity-50">·</span>
            <span className="shrink-0 opacity-80">{timeAgo(session.updatedAt)}</span>
          </div>
        </div>

        {loading ? (
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-[hsl(var(--primary))]" />
        ) : (
          <ChevronRight
            className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-opacity ${
              active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          />
        )}
      </button>
    </li>
  );
}
