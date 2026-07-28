"use client";

/**
 * TurnStatusCard — turn 边界指示器（仅 running/failed）。
 *
 * completed turn 不再渲染此组件：其「已处理 Xm Ys」折叠头已合并到
 * ResponseBlockCard 的过程块头部，由 expandedTurns 控制展开/折叠。
 *
 * - running：分隔线 + 旋转图标 + "running" + 开始时间
 * - failed：分隔线 + "failed" + 时间戳
 */

import type { TurnEntry } from "@/stores/active-session";
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

export function TurnStatusCard({ entry }: TurnStatusCardProps) {
  const startedStr = formatTimestamp(entry.startedAt);
  const completedStr = formatTimestamp(entry.completedAt);

  // running 状态：分隔线 + 旋转图标 + "running"
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

  // failed 状态：分隔线 + "failed"
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
