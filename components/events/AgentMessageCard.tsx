"use client";

/**
 * AgentMessageCard — agent 消息（markdown 渲染，支持 LaTeX + 代码高亮）。
 *
 * 头像/名字分组逻辑：
 * - showHeader=true（每轮首个 agent_message）：显示 codex 头像 + 名字 + 时间戳
 * - showHeader=false（同一轮后续续接消息）：不显示头像/名字，仅缩进对齐正文，保持回复连贯
 *
 * 这样一个对话中 codex 的回复只在「开始回复」时显示头像+名字，
 * 中间的子回复不显示，直到用户下一次发消息才再次显示。
 */

import type { AgentMessageItem } from "@/types/api";
import { Bot } from "lucide-react";
import { Markdown } from "./Markdown";
import { formatItemTime } from "@/lib/utils/format";

interface Props {
  item: AgentMessageItem;
  /** item 时间戳（ISO 字符串） */
  timestamp?: string;
  /** 是否显示头像+名字（每轮首个 agent_message 为 true） */
  showHeader?: boolean;
}

export function AgentMessageCard({ item, timestamp, showHeader = true }: Props) {
  // 续接消息（同一轮后续）：不显示头像/名字，缩进对齐正文（与有头像时的正文左边界对齐）
  // 但仍显示时间戳，方便定位每条子回复的时间
  if (!showHeader) {
    return (
      <div className="timeline-item py-1.5 pl-11 pr-2">
        {timestamp && (
          <div className="mb-0.5 flex justify-end">
            <span
              className="text-xs text-[hsl(var(--muted-foreground))]/60"
              title={new Date(timestamp).toString()}
            >
              {formatItemTime(timestamp)}
            </span>
          </div>
        )}
        <Markdown>{item.text}</Markdown>
      </div>
    );
  }

  // 首个回复：显示头像 + 名字 + 时间戳
  return (
    <div className="timeline-item flex gap-3 py-2 px-2">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)]">
        <Bot className="h-4 w-4 text-[hsl(var(--primary))]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            codex
          </span>
          {timestamp && (
            <span
              className="text-xs text-[hsl(var(--muted-foreground))]"
              title={new Date(timestamp).toString()}
            >
              {formatItemTime(timestamp)}
            </span>
          )}
        </div>
        <Markdown>{item.text}</Markdown>
      </div>
    </div>
  );
}
