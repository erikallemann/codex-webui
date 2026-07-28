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

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FileChangeItem } from "@/types/api";
import { useActiveSession } from "@/stores/active-session";
import { TurnStatusCard } from "@/components/events/TurnStatusCard";
import { EventCard } from "@/components/events/EventCard";
import {
  ConversationNav,
  type ConversationAnchor,
} from "./ConversationNav";

interface EventTimelineProps {
  onOpenDiff: (item: FileChangeItem) => void;
}

export function EventTimeline({ onOpenDiff }: EventTimelineProps) {
  const { state } = useActiveSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  // 用户滚动锁定：用户主动滚动后短暂禁用自动滚动，避免抢夺滚动控制权
  const userScrollLockRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const entries = useMemo(() => state.timeline, [state.timeline]);

  /**
   * 为每个条目计算 showHeader 标志：
   * - user_message / turn 边界：重置标志，自身 showHeader=false
   * - agent_message：每轮首个（user 消息或 turn 开始后的首个）showHeader=true，后续 false
   * - 其他 item（reasoning / command / file 等）：showHeader=false（子回复不显示头像）
   *
   * 这样一个对话中 codex 的回复只在「开始回复」时显示头像+名字，
   * 中间的子回复（思考、工具调用、续接消息）都不显示，直到用户下一次发消息。
   */
  const annotated = useMemo(() => {
    let agentHeaderShown = false;
    const mapped = entries.map((e) => {
      if (e.kind === "turn") {
        agentHeaderShown = false;
        return { ...e, showHeader: false };
      }
      const t = e.item.type;
      if (t === "user_message") {
        agentHeaderShown = false;
        return { ...e, showHeader: false };
      }
      if (t === "agent_message") {
        const show = !agentHeaderShown;
        agentHeaderShown = true;
        return { ...e, showHeader: show };
      }
      return { ...e, showHeader: false };
    });
    // 过滤掉会渲染为 null 的条目，避免虚拟滚动为空条目分配估算高度，
    // 导致总高度计算错误和滚动跳动/反弹：
    // - reasoning 无文本且无加密内容
    // - function_call / function_call_output：codex 原始工具调用记录，
    //   EventCard 未实现对应卡片，渲染为 null 但占据虚拟空间
    return mapped.filter((e) => {
      if (e.kind === "turn") return true;
      const rawType = (e.item as { type?: string }).type;
      if (rawType === "function_call" || rawType === "function_call_output") {
        return false;
      }
      if (rawType === "reasoning") {
        const item = e.item as { text?: string; encrypted_content?: string };
        const text = typeof item.text === "string" ? item.text.trim() : "";
        const hasEncrypted =
          typeof item.encrypted_content === "string" && item.encrypted_content.length > 0;
        return text.length > 0 || hasEncrypted;
      }
      return true;
    });
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
      const type = entry.item.type;
      switch (type) {
        case "reasoning":
          return 30; // 折叠态单行卡片
        case "user_message":
          return 60;
        case "agent_message":
          return 120; // markdown 内容高度变化大，用较大估算
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
        case "error":
          return 60;
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

  // 滚动到底部（用户在底部且未被锁定时）
  const scrollToBottom = useCallback(() => {
    if (userScrollLockRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    // 直接检查实际滚动位置，避免与 onScroll 的异步更新产生竞态
    const threshold = 100;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (!isAtBottom) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  // 事件数量变化 → 自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [annotated.length, scrollToBottom]);

  // 运行中流式追加 → 即使高度变化也跟随
  useEffect(() => {
    if (userScrollLockRef.current) return;
    if (state.status !== "running") return;
    const el = scrollRef.current;
    if (!el) return;
    // 直接检查实际位置，避免竞态
    const threshold = 100;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (!isAtBottom) return;
    // rAF 避免在布局前滚动
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [state.timeline, state.status]);

  // 用户滚动处理：更新 atBottom 标志，并设置短暂锁定防止自动滚动抢夺控制权
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 阈值加大到 100px：用户小幅滚动不会被判定为「在底部」而被自动滚回
    const threshold = 100;
    const wasAtBottom = atBottomRef.current;
    atBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    // 如果用户不在底部（主动上滚），设置短暂锁定
    if (!atBottomRef.current) {
      // 标记用户正在主动滚动，暂停自动滚动
      userScrollLockRef.current = true;
      // 清除之前的定时器
      if (userScrollTimerRef.current) {
        clearTimeout(userScrollTimerRef.current);
      }
      // 800ms 后解除锁定，恢复自动滚动（仅在仍在底部时生效）
      userScrollTimerRef.current = setTimeout(() => {
        userScrollLockRef.current = false;
      }, 800);
    } else if (!wasAtBottom) {
      // 用户滚回底部，立即解除锁定
      userScrollLockRef.current = false;
      if (userScrollTimerRef.current) {
        clearTimeout(userScrollTimerRef.current);
        userScrollTimerRef.current = null;
      }
    }

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
      // 解除用户滚动锁定，允许滚动到位
      userScrollLockRef.current = false;
      if (userScrollTimerRef.current) {
        clearTimeout(userScrollTimerRef.current);
        userScrollTimerRef.current = null;
      }
      virtualizer.scrollToIndex(index, { align: "start" });
      // 滚动后立即更新 active（scrollToIndex 会触发 onScroll，但同步更新避免延迟）
      const anchorPos = userMessageAnchors.findIndex((a) => a.index === index);
      if (anchorPos !== -1) setActiveAnchorIndex(anchorPos);
    },
    [virtualizer, userMessageAnchors],
  );

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (userScrollTimerRef.current) {
        clearTimeout(userScrollTimerRef.current);
      }
    };
  }, []);

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
        className="h-full overflow-y-auto"
        style={{
          // layout/paint 容器化提升渲染性能；不用 size 容器化以避免干扰 scrollHeight 计算
          contain: "layout paint",
          // 防止滚动到边界时浏览器级反弹/滚动链
          overscrollBehavior: "contain",
        }}
      >
        <div
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
