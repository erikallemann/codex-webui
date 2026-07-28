"use client";

/**
 * SessionView — 活跃会话主区域。
 *
 * 上方：事件时间线（EventTimeline 自带虚拟滚动容器）
 * 下方：Composer（输入框 + 发送/停止）
 *
 * 配置面板（ConfigPanel）由 AppShell 统一放置在 <main> 下方，
 * 这样空状态与会话状态都能看到 config，且始终位于对话框下方。
 *
 * 滚动逻辑已下沉到 EventTimeline（virtualizer 需要直接持有 scrollElement）。
 */

import type { FileChangeItem } from "@/types/api";
import { EventTimeline } from "./EventTimeline";
import { Composer } from "./Composer";

interface SessionViewProps {
  onOpenDiff: (item: FileChangeItem) => void;
}

export function SessionView({ onOpenDiff }: SessionViewProps) {
  return (
    <div className="flex h-full flex-col">
      {/* 时间线（自带虚拟滚动容器） */}
      <div className="min-h-0 flex-1">
        <EventTimeline onOpenDiff={onOpenDiff} />
      </div>

      {/* 输入区 */}
      <Composer />
    </div>
  );
}
