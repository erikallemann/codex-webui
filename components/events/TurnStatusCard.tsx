"use client";

/**
 * TurnStatusCard — turn 边界指示器（可折叠）。
 *
 * 三种状态：
 * - running：分隔线 + 旋转图标 + "running" + 开始时间
 * - failed：分隔线 + "failed" + 时间戳
 * - completed：可折叠触发器 "已处理 {duration} >"，点击折叠/展开该 turn 内容；
 *   右侧弱化显示 token 用量。视觉对齐 codex cli 的 turn 折叠行。
 *
 * 折叠语义由 EventTimeline 控制：折叠时隐藏该 turn 内的 response_block，
 * 保留 user_message 与 error。
 */

import type { TurnEntry } from "@/stores/active-session";
import { formatTokens } from "@/lib/utils/format";
import { Loader2, ChevronRight } from "lucide-react";

interface TurnStatusCardProps {
  entry: TurnEntry;
  /** completed 状态下是否展开；undefined 表示不可折叠（running/failed） */
  expanded?: boolean;
  /** 折叠/展开回调；仅 completed 状态提供 */
  onToggle?: () => void;
}

/** 格式化 Unix 秒时间戳为 HH:MM:SS */
function formatTimestamp(unixSec?: number): string | null {
  if (!unixSec || !Number.isFinite(unixSec)) return null;
  try {
    return new Date(unixSec * 1000).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return null;
  }
}

/** 格式化持续时长（毫秒 → 可读），对齐 codex cli 的 "Xm Ys" 风格 */
function formatDuration(ms?: number): string | null {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return null;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remSec = Math.round(sec % 60);
  return `${min}m ${remSec}s`;
}

export function TurnStatusCard({ entry, expanded, onToggle }: TurnStatusCardProps) {
  const startedStr = formatTimestamp(entry.startedAt);
  const completedStr = formatTimestamp(entry.completedAt);
  const durationStr = formatDuration(entry.durationMs);

  // running 状态：不可折叠，保持分隔线 + 旋转图标样式
  if (entry.status === "running") {
    return (
      <div className="timeline-item flex items-center gap-2 py-1.5 px-2">
        <div className="h-px flex-1 bg-[hsl(var(--overlay)/0.05)] min-w-4" />
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--primary))]">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          running
          {startedStr && (
            <span className="text-[hsl(var(--muted-foreground))] normal-case">
              · {startedStr}
            </span>
          )}
        </span>
        <div className="h-px flex-1 bg-[hsl(var(--overlay)/0.05)] min-w-4" />
      </div>
    );
  }

  // failed 状态：不可折叠，保持分隔线 + 错误样式
  if (entry.status === "failed") {
    return (
      <div className="timeline-item flex items-center gap-2 py-1.5 px-2">
        <div className="h-px flex-1 bg-[hsl(var(--overlay)/0.05)] min-w-4" />
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--danger))]">
          <span>failed</span>
          {startedStr && (
            <span className="text-[hsl(var(--muted-foreground))] normal-case">
              · {startedStr}
            </span>
          )}
          {completedStr && (
            <span className="text-[hsl(var(--muted-foreground))] normal-case">
              → {completedStr}
            </span>
          )}
        </span>
        <div className="h-px flex-1 bg-[hsl(var(--overlay)/0.05)] min-w-4" />
      </div>
    );
  }

  // completed 状态：可折叠触发器 "已处理 {duration} >"
  const isCollapsible = typeof expanded === "boolean" && !!onToggle;
  const isExpanded = expanded === true;

  const triggerContent = (
    <>
      <ChevronRight
        className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]/70 transition-transform ${
          isExpanded ? "rotate-90" : ""
        }`}
      />
      <span className="text-sm text-[hsl(var(--muted-foreground))]">
        已处理
      </span>
      {durationStr && (
        <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]/80">
          {durationStr}
        </span>
      )}
    </>
  );

  return (
    <div className="timeline-item flex items-center gap-2 py-1 px-2">
      {isCollapsible ? (
        <button
          onClick={onToggle}
          aria-expanded={isExpanded}
          className="flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors hover:bg-[hsl(var(--overlay)/0.04)] hover:text-foreground focus-ring"
        >
          {triggerContent}
        </button>
      ) : (
        <span className="flex items-center gap-1.5">{triggerContent}</span>
      )}

      {/* 右侧弱化 token 用量 */}
      {entry.usage && (
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]/50">
          <span title="input">↑{formatTokens(entry.usage.input_tokens)}</span>
          <span title="output">↓{formatTokens(entry.usage.output_tokens)}</span>
          {entry.usage.cached_input_tokens > 0 && (
            <span title="cached" className="text-[hsl(var(--primary)/0.6)]">
              ⚡{formatTokens(entry.usage.cached_input_tokens)}
            </span>
          )}
          {entry.usage.reasoning_output_tokens > 0 && (
            <span title="reasoning" className="text-[hsl(var(--info)/0.6)]">
              ◇{formatTokens(entry.usage.reasoning_output_tokens)}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
