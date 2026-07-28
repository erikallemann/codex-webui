"use client";

/**
 * TurnStatusCard — turn 边界指示器。
 *
 * 显示 turn 状态（running / completed / failed）、token 用量、时间戳与运行时长。
 * 极简样式：一条分隔线 + 状态标签 + 元信息。
 */

import type { TurnEntry } from "@/stores/active-session";
import { formatTokens } from "@/lib/utils/format";
import { Loader2 } from "lucide-react";

interface TurnStatusCardProps {
  entry: TurnEntry;
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

/** 格式化持续时长（毫秒 → 可读） */
function formatDuration(ms?: number): string | null {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remSec = Math.round(sec % 60);
  return `${min}m${remSec}s`;
}

export function TurnStatusCard({ entry }: TurnStatusCardProps) {
  const startedStr = formatTimestamp(entry.startedAt);
  const completedStr = formatTimestamp(entry.completedAt);
  const durationStr = formatDuration(entry.durationMs);

  return (
    <div className="timeline-item flex items-center gap-2 py-1.5 px-2 flex-wrap">
      <div className="h-px flex-1 bg-[hsl(var(--overlay)/0.05)] min-w-4" />

      {entry.status === "running" && (
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--primary))]">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          running
          {startedStr && (
            <span className="text-[hsl(var(--muted-foreground))] normal-case">
              · {startedStr}
            </span>
          )}
        </span>
      )}

      {entry.status === "completed" && (
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          <span>completed</span>
          {/* 时间戳与时长 */}
          {(startedStr || completedStr || durationStr) && (
            <span className="flex items-center gap-1.5 normal-case text-[hsl(var(--muted-foreground))]/80">
              {startedStr && <span title="started at">{startedStr}</span>}
              {startedStr && completedStr && <span className="opacity-40">→</span>}
              {completedStr && <span title="completed at">{completedStr}</span>}
              {durationStr && (
                <span className="rounded bg-[hsl(var(--overlay)/0.08)] px-1 text-[hsl(var(--info)/0.9)]" title="duration">
                  {durationStr}
                </span>
              )}
            </span>
          )}
          {/* token 用量 */}
          {entry.usage && (
            <span className="flex items-center gap-1.5">
              <span title="input">↑{formatTokens(entry.usage.input_tokens)}</span>
              <span title="output">↓{formatTokens(entry.usage.output_tokens)}</span>
              {entry.usage.cached_input_tokens > 0 && (
                <span title="cached" className="text-[hsl(var(--primary)/0.7)]">
                  ⚡{formatTokens(entry.usage.cached_input_tokens)}
                </span>
              )}
              {entry.usage.reasoning_output_tokens > 0 && (
                <span title="reasoning" className="text-[hsl(var(--info)/0.7)]">
                  ◇{formatTokens(entry.usage.reasoning_output_tokens)}
                </span>
              )}
            </span>
          )}
        </span>
      )}

      {entry.status === "failed" && (
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
      )}

      <div className="h-px flex-1 bg-[hsl(var(--overlay)/0.05)] min-w-4" />
    </div>
  );
}
