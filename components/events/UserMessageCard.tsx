"use client";

/**
 * UserMessageCard — 用户消息（回放时从 rollout 映射）。
 *
 * 右对齐气泡布局：头像 + 内容靠右，内容包裹在灰色圆角矩形背景中。
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
    <div className="timeline-item flex flex-row-reverse gap-3 py-2 px-2">
      {/* 头像 */}
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--overlay)/0.05)]">
        <User className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      </div>
      {/* 气泡内容：靠右对齐，最大宽度限制 80% */}
      <div className="flex max-w-[80%] min-w-0 flex-col items-end">
        {/* 头部：you + 时间戳 */}
        <div className="mb-1.5 flex items-center gap-2">
          {timestamp && (
            <span
              className="text-xs text-[hsl(var(--muted-foreground))]"
              title={new Date(timestamp).toString()}
            >
              {formatItemTime(timestamp)}
            </span>
          )}
          <span className="text-sm font-semibold text-foreground">
            you
          </span>
        </div>
        {/* 灰色圆角矩形背景包裹正文 */}
        <div className="rounded-xl bg-[hsl(var(--overlay)/0.06)] px-3.5 py-2.5 text-sm text-foreground/90">
          <Markdown>{item.text}</Markdown>
        </div>
      </div>
    </div>
  );
}
