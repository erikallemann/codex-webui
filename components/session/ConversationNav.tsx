"use client";

/**
 * ConversationNav — 对话快捷翻页条。
 *
 * 位于时间线左侧中间，用圆点表示用户的每一条发言：
 * - 默认态：小圆点（muted 色）
 * - hover：圆点变大变色，右侧浮出 tooltip 显示用户发言内容
 * - active：当前可见区域对应的用户消息圆点高亮（primary 色）
 * - 点击：调用 onJump(index)，由 EventTimeline 用 virtualizer.scrollToIndex 滚动
 *
 * 圆点数量随用户消息增多而增多；超过最大高度后内部滚动（隐藏滚动条），
 * 保证大量消息时仍不遮挡内容。
 */

import { useState } from "react";

export interface ConversationAnchor {
  /** 对应 annotated / virtualizer 中的索引 */
  index: number;
  /** 用户消息预览文本（已截断） */
  preview: string;
  /** 条目 id（作为 key） */
  id: string;
}

interface Props {
  anchors: ConversationAnchor[];
  /** 当前激活的 anchor 索引（基于滚动位置计算） */
  activeIndex?: number;
  onJump: (index: number) => void;
}

export function ConversationNav({ anchors, activeIndex = -1, onJump }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  // 少于 2 条用户消息时不显示翻页条（无翻页意义）
  if (anchors.length < 2) return null;

  return (
    <div
      className="absolute left-1.5 top-1/2 z-20 flex max-h-[70vh] -translate-y-1/2 flex-col items-center gap-1 overflow-y-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label="对话翻页导航"
    >
      {anchors.map((anchor, i) => {
        const isActive = activeIndex === i;
        const isHovered = hovered === i;
        return (
          <button
            key={anchor.id}
            onClick={() => onJump(anchor.index)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            className="group relative flex h-4 w-4 shrink-0 items-center justify-center focus-ring rounded"
            aria-label={`跳转到第 ${i + 1} 条用户消息`}
            title={anchor.preview}
          >
            {/* 圆点：默认小且淡，hover/active 时变大变亮 */}
            <span
              className={`block rounded-full transition-all duration-150 ${
                isActive
                  ? "h-2.5 w-2.5 bg-[hsl(var(--primary))]"
                  : isHovered
                    ? "h-2.5 w-2.5 bg-[hsl(var(--primary)/0.65)]"
                    : "h-1.5 w-1.5 bg-[hsl(var(--muted-foreground)/0.35)] group-hover:bg-[hsl(var(--primary)/0.5)]"
              }`}
            />
            {/* tooltip：圆点右侧浮出，显示用户发言内容（截断到 3 行） */}
            {isHovered && (
              <div
                className="pointer-events-none absolute left-full ml-3 top-1/2 z-30 w-64 max-w-[min(16rem,40vw)] -translate-y-1/2 rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface))] px-3 py-2 text-xs leading-relaxed text-[hsl(var(--foreground))] shadow-lg"
                role="tooltip"
              >
                <p className="line-clamp-4 whitespace-normal break-words">{anchor.preview}</p>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
