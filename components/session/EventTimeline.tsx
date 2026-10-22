"use client";

/**
 * EventTimeline — 虚拟滚动事件时间线。
 *
 * 使用 @tanstack/react-virtual 处理长会话（数百~上千事件）：
 * - 估算高度初始布局，DOM 挂载后用 ResizeObserver 动态测量真实高度
 * - 稳定 key（entry.id）避免重排闪烁
 * - 用户在底部时新事件自动滚动到底；中途滚动则不抢占
 *
 * 滚动容器由本组件持有（供 virtualizer 的 scrollElement），外层 SessionView
 * 只负责 flex 布局（时间线 flex-1 + Composer）。
 */

import { useRef, useEffect, useLayoutEffect, useCallback, useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FileChangeItem, ResponseItem } from "@/types/api";
import { useActiveSession } from "@/stores/active-session";
import { TurnStatusCard } from "@/components/events/TurnStatusCard";
import { EventCard } from "@/components/events/EventCard";
import { ResponseBlockCard, type TurnMeta } from "@/components/events/ResponseBlockCard";
import { shouldFollowScroll } from "@/lib/session/scroll-follow";
import {
  ConversationNav,
  type ConversationAnchor,
} from "./ConversationNav";

/**
 * 展示用时间线条目类型（annotated useMemo 产物）。
 *
 * - turn：running/failed turn 边界（渲染 TurnStatusCard 分隔线）
 * - item：独立条目（user_message / error）
 * - response_block：单轮 codex 回复整体块，包含头像+名字、可折叠过程块、
 *   最终输出。completed turn 的元数据（duration/usage）附加到此块，
 *   由 ResponseBlockCard 渲染「已处理 Xm Ys」折叠头。
 *   running turn 同样附加 turnMeta，渲染「执行中」始终展开。
 */
type DisplayEntry =
  | { kind: "turn"; id: string; status: "running" | "failed"; startedAt?: number; completedAt?: number; durationMs?: number }
  | { kind: "item"; id: string; item: ResponseItem; timestamp?: string; showHeader: boolean }
  | { kind: "response_block"; id: string; processItems: ResponseItem[]; finalMessage?: ResponseItem; timestamp?: string; turnMeta?: TurnMeta };

/** 中间过程事件类型：这些会被合并到 response_block 的 processItems 中 */
const INTERMEDIATE_TYPES = new Set([
  "reasoning",
  "command_execution",
  "file_change",
  "web_search",
  "mcp_tool_call",
  "plan_update",
]);

interface EventTimelineProps {
  onOpenDiff: (item: FileChangeItem) => void;
}

export function EventTimeline({ onOpenDiff }: EventTimelineProps) {
  const { state } = useActiveSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const previousScrollTopRef = useRef(0);
  const prevSessionIdRef = useRef<string | null>(null);

  const entries = useMemo(() => state.timeline, [state.timeline]);
  const hasEntries = entries.length > 0;

  /**
   * turn 过程块展开状态：记录被用户展开的 completed turn id（Set）。
   * 默认折叠（Set 为空），用户点击「已处理 Xm Ys」可展开该 turn 的过程块，
   * 展开后显示中间 agent_message + reasoning + 动作；finalMessage 始终可见。
   * running turn 始终展开（实时显示进度），不受此 Set 控制。
   */
  const [expandedTurns, setExpandedTurns] = useState<Set<string>>(new Set());
  const toggleTurn = useCallback((turnId: string) => {
    setExpandedTurns((prev) => {
      const next = new Set(prev);
      if (next.has(turnId)) next.delete(turnId);
      else next.add(turnId);
      return next;
    });
  }, []);

  /**
   * 将原始 timeline 条目转换为展示用条目（DisplayEntry[]）：
   *
   * 每个 turn 的所有事件（agent_message + reasoning + 动作）合并为一个 response_block：
   * - processItems：中间过程（第一次输出 → 最后一次思考过程），含中间 agent_message
   * - finalMessage：最后一条 agent_message（最终输出），始终展开显示
   *
   * turn 处理：
   * - completed：不单独渲染 TurnStatusCard，turnMeta 附加到 response_block，
   *   由 ResponseBlockCard 渲染「已处理 Xm Ys」折叠头（默认折叠）。
   * - running/failed：渲染 TurnStatusCard 分隔线；running 的 turnMeta 附加到
   *   response_block（渲染「执行中」始终展开）。
   *
   * 边界事件（user_message / error）会 flush 当前 block。
   * function_call / function_call_output 直接跳过。
   * 空 reasoning（无文本且无加密内容）在 flush 时过滤。
   */
  const annotated = useMemo<DisplayEntry[]>(() => {
    const result: DisplayEntry[] = [];
    let groupCounter = 0;

    // 当前 response_block 累积状态
    let blockStarted = false;
    let blockProcessItems: ResponseItem[] = [];
    let blockFinalMessage: ResponseItem | undefined = undefined;
    let blockTimestamp: string | undefined = undefined;
    let blockId: string | undefined = undefined;
    let blockTurnMeta: TurnMeta | undefined = undefined;

    /** 判断 reasoning 是否为空（无文本且无加密内容） */
    const isReasoningEmpty = (item: ResponseItem): boolean => {
      if (item.type !== "reasoning") return false;
      const text = typeof item.text === "string" ? item.text.trim() : "";
      const hasEncrypted =
        typeof item.encrypted_content === "string" && item.encrypted_content.length > 0;
      return text.length === 0 && !hasEncrypted;
    };

    /**
     * flush 当前 response_block（过滤空 reasoning 后输出）。
     *
     * 注意：不重置 blockTurnMeta。turn 元数据由 turn 条目设置，需要跨越
     * user_message 边界保留——因为 turn 条目在 user_message 之前到达，
     * user_message 会触发 flush（空 block 不输出），之后的 codex 回复
     * （reasoning / agent_message / 动作）通过兜底逻辑开启新 block 时，
     * 需要继承同一 turn 的 turnMeta 才能正确渲染「已处理 Xm Ys」。
     * blockTurnMeta 仅在新 turn 条目到达时被覆盖（或 failed 时置 undefined）。
     */
    const flushBlock = () => {
      if (!blockStarted) return;
      const filtered = blockProcessItems.filter((item) => !isReasoningEmpty(item));
      // 有最终输出或有中间过程时才输出 block
      if (blockFinalMessage || filtered.length > 0) {
        result.push({
          kind: "response_block",
          id: blockId!,
          processItems: filtered,
          finalMessage: blockFinalMessage,
          timestamp: blockTimestamp,
          turnMeta: blockTurnMeta,
        });
      }
      blockStarted = false;
      blockProcessItems = [];
      blockFinalMessage = undefined;
      blockTimestamp = undefined;
      blockId = undefined;
      // blockTurnMeta 故意不重置：保留给后续同 turn 的 codex 回复块使用
    };

    for (const e of entries) {
      // turn 边界：flush + 输出 turn 状态行（仅 running/failed）+ 开启新 block
      if (e.kind === "turn") {
        flushBlock();
        if (e.status === "running" || e.status === "failed") {
          // running/failed：渲染 TurnStatusCard 分隔线
          result.push({
            kind: "turn",
            id: e.id,
            status: e.status,
            startedAt: e.startedAt,
            completedAt: e.completedAt,
            durationMs: e.durationMs,
          });
        }
        // completed 不单独渲染 turn 行，turnMeta 附加到 response_block
        // 设置 turnMeta：completed/running 有，failed 无（用兜底内部状态）
        if (e.status === "completed" || e.status === "running") {
          blockTurnMeta = {
            id: e.id,
            status: e.status,
            durationMs: e.durationMs,
            usage: e.usage,
          };
        } else {
          blockTurnMeta = undefined;
        }
        // 开启新 block（所有状态都开启，累积后续事件）
        blockStarted = true;
        blockId = `rb_${groupCounter++}`;
        continue;
      }

      const rawType = (e.item as { type?: string }).type ?? "";

      // 跳过 codex 原始工具调用记录（EventCard 未实现，渲染为 null）
      if (rawType === "function_call" || rawType === "function_call_output") {
        continue;
      }

      // user_message：flush + 独立输出
      if (rawType === "user_message") {
        flushBlock();
        result.push({ kind: "item", id: e.id, item: e.item, timestamp: e.timestamp, showHeader: false });
        continue;
      }

      // error / 结构化提问：flush + 独立输出。提问必须在 turn 未结束时立即可见。
      if (rawType === "error" || rawType === "user_input_request") {
        flushBlock();
        result.push({ kind: "item", id: e.id, item: e.item, timestamp: e.timestamp, showHeader: false });
        continue;
      }

      // 兜底：事件出现在 turn 之前（无 turn 条目）时也开启 block
      if (!blockStarted) {
        blockStarted = true;
        blockId = `rb_${groupCounter++}`;
      }

      // agent_message：旧 final 推入 processItems，新 message 成为 final
      if (rawType === "agent_message") {
        if (blockFinalMessage) {
          blockProcessItems.push(blockFinalMessage);
        }
        blockFinalMessage = e.item;
        if (!blockTimestamp) blockTimestamp = e.timestamp;
      } else if (INTERMEDIATE_TYPES.has(rawType)) {
        // 中间过程事件：累积到 processItems
        blockProcessItems.push(e.item);
        if (!blockTimestamp) blockTimestamp = e.timestamp;
      }
    }
    flushBlock();

    return result;
  }, [entries]);

  /**
   * 用户消息锚点：用于左侧翻页条。
   * 从 annotated（已过滤）中提取 user_message，记录其 annotated 索引与预览文本。
   * 翻页条点击圆点时调用 virtualizer.scrollToIndex(anchor.index) 跳转。
   */
  const userMessageAnchors = useMemo<ConversationAnchor[]>(() => {
    const anchors: ConversationAnchor[] = [];
    for (let i = 0; i < annotated.length; i++) {
      const entry = annotated[i];
      if (entry.kind !== "item") continue;
      if ((entry.item as { type?: string }).type !== "user_message") continue;
      const rawText = (entry.item as { text?: string }).text ?? "";
      const flat = rawText.replace(/\s+/g, " ").trim();
      const preview = flat.length > 120 ? flat.slice(0, 120) + "…" : flat;
      anchors.push({ index: i, preview, id: entry.id });
    }
    return anchors;
  }, [annotated]);

  /** 当前激活的 anchor 索引（滚动位置对应的最近 user_message） */
  const [activeAnchorIndex, setActiveAnchorIndex] = useState(-1);

  const virtualizer = useVirtualizer({
    count: annotated.length,
    getScrollElement: () => scrollRef.current,
    // 按条目类型估算高度，减少与实际高度的差距，降低测量时的滚动跳动
    estimateSize: (index) => {
      const entry = annotated[index];
      if (!entry) return 60;
      if (entry.kind === "turn") return 44;
      // response_block：头像+名字(40) + 折叠过程块(40) + 最终输出(120) ≈ 200
      if (entry.kind === "response_block") return 200;
      const type = entry.item.type;
      switch (type) {
        case "user_message":
          return 60;
        case "user_input_request":
          return 260;
        case "agent_message":
          return 120; // markdown 内容高度变化大，用较大估算
        case "error":
          return 60;
        // reasoning / command / file / mcp / search / plan 已合并到 response_block，
        // 以下分支仅作 fallback（独立输出时使用）
        case "reasoning":
          return 30;
        case "command_execution":
          return 90;
        case "file_change":
          return 70;
        case "mcp_tool_call":
          return 90;
        case "web_search":
          return 70;
        case "plan_update":
          return 90;
        default:
          return 60;
      }
    },
    overscan: 6,
    getItemKey: (index) => annotated[index].id,
    // 使用库默认的 ResizeObserver 测量（内容渲染后自动追踪尺寸变化）。
    // 不再用 getBoundingClientRect（在内容渲染前会返回 0，导致总高度计算错误、滚动跳动）。
    measureElement: undefined,
  });

  // A selected conversation starts at its latest item.
  useLayoutEffect(() => {
    const sid = state.threadId;
    if (sid !== prevSessionIdRef.current) {
      prevSessionIdRef.current = sid;
      if (sid) {
        followingRef.current = true;
      }
    }
  }, [state.threadId]);

  const followBottom = useCallback(() => {
    if (!followingRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    previousScrollTopRef.current = el.scrollTop;
  }, []);

  // Follow both new events and later virtualizer measurements or image/layout growth.
  useLayoutEffect(() => {
    followBottom();
  }, [annotated, expandedTurns, state.status, followBottom]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(followBottom);
    });
    observer.observe(content);
    if (scrollRef.current) observer.observe(scrollRef.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [hasEntries, followBottom]);

  // Content growth can fire scroll events too; only upward movement disables following.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    followingRef.current = shouldFollowScroll(
      followingRef.current,
      previousScrollTopRef.current,
      el.scrollTop,
      el.scrollHeight - el.scrollTop - el.clientHeight,
    );
    previousScrollTopRef.current = el.scrollTop;

    // 更新翻页条 active anchor：找到当前可见区域顶部对应的最近 user_message
    if (userMessageAnchors.length > 0) {
      const visible = virtualizer.getVirtualItems();
      if (visible.length > 0) {
        const firstVisibleIndex = visible[0].index;
        // 找到 <= firstVisibleIndex 的最后一个 anchor
        let idx = -1;
        for (let i = 0; i < userMessageAnchors.length; i++) {
          if (userMessageAnchors[i].index <= firstVisibleIndex) {
            idx = i;
          } else {
            break;
          }
        }
        // 若已滚过所有 anchor（在最后一条用户消息之后），active 指向最后一个
        if (idx === -1) idx = 0;
        setActiveAnchorIndex(idx);
      }
    }
  }, [virtualizer, userMessageAnchors]);

  /** 翻页条跳转：滚动到指定 user_message 位置 */
  const handleJump = useCallback(
    (index: number) => {
      followingRef.current = false;
      virtualizer.scrollToIndex(index, { align: "start" });
      // 滚动后立即更新 active（scrollToIndex 会触发 onScroll，但同步更新避免延迟）
      const anchorPos = userMessageAnchors.findIndex((a) => a.index === index);
      if (anchorPos !== -1) setActiveAnchorIndex(anchorPos);
    },
    [virtualizer, userMessageAnchors],
  );

  if (annotated.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
        <span className="font-mono">waiting for events…</span>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onWheel={(event) => {
          if (event.deltaY < 0) followingRef.current = false;
        }}
        className="h-full overflow-y-auto"
        style={{
          // layout/paint 容器化提升渲染性能；不用 size 容器化以避免干扰 scrollHeight 计算
          contain: "layout paint",
          // 防止滚动到边界时浏览器级反弹/滚动链
          overscrollBehavior: "contain",
        }}
      >
        <div
          ref={contentRef}
          className="mx-auto max-w-4xl px-4 py-4"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const entry = annotated[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className="space-y-1.5"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {entry.kind === "turn" ? (
                <TurnStatusCard entry={entry} />
              ) : entry.kind === "response_block" ? (
                  <ResponseBlockCard
                    processItems={entry.processItems}
                    finalMessage={entry.finalMessage}
                    onOpenDiff={onOpenDiff}
                    timestamp={entry.timestamp}
                    turnMeta={entry.turnMeta}
                    expanded={
                      entry.turnMeta
                        ? entry.turnMeta.status === "running"
                          ? true
                          : expandedTurns.has(entry.turnMeta.id)
                        : undefined
                    }
                    onToggleExpand={
                      entry.turnMeta && entry.turnMeta.status === "completed"
                        ? () => toggleTurn(entry.turnMeta!.id)
                        : undefined
                    }
                  />
                ) : (
                  <EventCard
                    item={entry.item}
                    onOpenDiff={onOpenDiff}
                    timestamp={entry.timestamp}
                    showHeader={entry.showHeader}
                  />
                )}
              </div>
            );
          })}

          {/* 运行中光标（非虚拟化，固定在末尾） */}
          {state.status === "running" && (
            <div
              className="flex items-center gap-2 px-2 py-1"
              style={{
                position: "absolute",
                top: `${virtualizer.getTotalSize()}px`,
                left: 0,
                width: "100%",
              }}
            >
              <span className="h-3 w-1.5 bg-[hsl(var(--primary))] cursor-blink" />
            </div>
          )}
        </div>
      </div>

      {/* 左侧对话翻页条：圆点表示用户发言，hover 显示内容，点击跳转 */}
      <ConversationNav
        anchors={userMessageAnchors}
        activeIndex={activeAnchorIndex}
        onJump={handleJump}
      />
    </div>
  );
}
