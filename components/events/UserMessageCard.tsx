"use client";

/**
 * UserMessageCard — 用户消息（回放时从 rollout 映射）。
 *
 * 使用 Markdown 渲染：用户可能输入代码块、LaTeX 或 markdown 格式文本。
 * 显示时间戳（如果可用）。
 */

import type { UserMessageItem } from "@/types/api";
import { User } from "lucide-react";
import { Markdown } from "./Markdown";
import { formatItemTime } from "@/lib/utils/format";

interface Props {
  item: UserMessageItem;
  /** item 时间戳（ISO 字符串） */
  timestamp?: string;
}

export function UserMessageCard({ item, timestamp }: Props) {
  return (
    <div className="timeline-item flex gap-3 py-2 px-2">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--overlay)/0.05)]">
        <User className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            you
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
