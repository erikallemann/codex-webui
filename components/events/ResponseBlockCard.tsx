"use client";

/**
 * ResponseBlockCard — 单轮 codex 回复整体块。
 *
 * 结构（对齐 codex cli 的折叠展开风格）：
 * ```
 * [avatar] codex  timestamp
 *   ▶ 已处理 2m 1s · 2 命令 · 1 文件   ← completed turn 的折叠头（默认折叠）
 *     · 中间 agent_message（第一次输出 …）
 *     · 思考文本（reasoning 合并）
 *     · 动作列表（命令 / 文件 / 搜索 / 工具 / 计划）
 *   最终 agent_message                  ← 最终输出（始终展开）
 * ```
 *
 * 折叠范围：「codex 第一次输出 → 最后一次思考过程」。
 * processItems 包含中间所有 agent_message + reasoning + 动作；
 * finalMessage 是最后一条 agent_message（最终回答），始终展开显示。
 *
 * turnMeta 控制折叠头样式：
 * - completed：显示「已处理 {duration}」，受 expanded/onToggleExpand 控制（默认折叠）
 * - running：显示「执行中」+ 旋转图标，始终展开（不可折叠）
 * - 无 turnMeta（兜底）：显示「思考过程/执行动作」，内部状态控制
 */

import { useState, useCallback } from "react";
import type { FileChangeItem, ResponseItem, Usage } from "@/types/api";
import { Brain, ChevronRight, Wrench, Copy, Check, Loader2 } from "lucide-react";
import { EventCard } from "./EventCard";
import { Markdown } from "./Markdown";
import { formatItemTime, formatDuration, formatTokens } from "@/lib/utils/format";
import { useToast } from "@/stores/toast";
// codex 官方 logo：渐变色 SVG。
// Next.js 15 静态导入 SVG 返回 StaticImageData 对象，取 .src 得到实际资源 URL。
import codexLogo from "@/logo/codex-color.svg";
const codexLogoSrc = typeof codexLogo === "string" ? codexLogo : codexLogo.src;

/** turn 元数据：控制折叠头样式与展开行为 */
export interface TurnMeta {
  /** turn id（用于关联 expandedTurns 状态） */
  id: string;
  /** turn 状态：completed 显示「已处理」，running 显示「执行中」 */
  status: "completed" | "running";
  /** turn 持续时长（毫秒，completed 时显示） */
  durationMs?: number;
  /** token 用量（completed 时在折叠头右侧弱化显示） */
  usage?: Usage;
}

interface Props {
  /** 中间过程事件（中间 agent_message + reasoning + 动作），折叠在其下 */
  processItems: ResponseItem[];
  /** 最终 agent_message（最终输出，始终展开；undefined 表示尚无输出） */
  finalMessage?: ResponseItem;
  onOpenDiff: (item: FileChangeItem) => void;
  /** 首个事件时间戳（ISO 字符串） */
  timestamp?: string;
  /** turn 元数据（completed/running turn 提供；无则用兜底内部状态） */
  turnMeta?: TurnMeta;
  /** completed turn 的展开状态（受控）；undefined 表示用内部状态 */
  expanded?: boolean;
  /** completed turn 的折叠/展开回调 */
  onToggleExpand?: () => void;
}

export function ResponseBlockCard({
  processItems,
  finalMessage,
  onOpenDiff,
  timestamp,
  turnMeta,
  expanded,
  onToggleExpand,
}: Props) {
  // 兜底内部状态（无 turnMeta 时使用，默认折叠）
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = useCallback(() => {
    const text =
      finalMessage && finalMessage.type === "agent_message" ? finalMessage.text : "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      toast({ title: "已复制", description: "内容已复制到剪贴板", type: "success", duration: 2000 });
    }).catch(() => {
      toast({ title: "复制失败", description: "请手动选择文本复制", type: "error", duration: 3000 });
    });
  }, [finalMessage, toast]);

  // 分离中间过程：中间 agent_message / reasoning / 动作
  const intermediateMessages = processItems.filter((i) => i.type === "agent_message");
  const reasoningItems = processItems.filter((i) => i.type === "reasoning");
  const actionItems = processItems.filter(
    (i) => i.type !== "reasoning" && i.type !== "agent_message",
  );

  // 拼接所有思考文本
  const reasoningText = reasoningItems
    .map((i) => (typeof i.text === "string" ? i.text.trim() : ""))
    .filter((t) => t.length > 0)
    .join("\n");
  const hasEncrypted = reasoningItems.some(
    (i) => typeof i.encrypted_content === "string" && i.encrypted_content.length > 0,
  );

  const hasProcess = processItems.length > 0;
  const hasReasoning = reasoningText.length > 0 || hasEncrypted;
  const hasActions = actionItems.length > 0;
  const hasIntermediateMessages = intermediateMessages.length > 0;
  const hasFinalMessage = !!finalMessage && finalMessage.type === "agent_message";

  // 折叠态预览：优先思考摘要首行，其次中间输出首行
  const previewText = reasoningText
    ? reasoningText.split("\n")[0].slice(0, 100)
    : intermediateMessages.length > 0
      ? (intermediateMessages[0].text ?? "").replace(/\s+/g, " ").trim().slice(0, 100)
      : "";

  const actionSummary = summarizeActions(actionItems);
  const durationStr = formatDuration(turnMeta?.durationMs);

  // ---- 折叠头标签与展开状态 ----
  const isCompletedTurn = turnMeta?.status === "completed";
  const isRunningTurn = turnMeta?.status === "running";

  // 展开状态：completed 受控 / running 始终展开 / 兜底内部状态
  const isExpanded = isCompletedTurn
    ? (expanded ?? false)
    : isRunningTurn
      ? true
      : internalExpanded;

  // 折叠头标签
  const label = isCompletedTurn
    ? "已处理"
    : isRunningTurn
      ? "执行中"
      : hasReasoning
        ? "思考过程"
        : hasActions
          ? "执行动作"
          : "中间输出";

  // 图标：completed/兜底用 Brain/Wrench，running 用 Loader2
  const Icon = isRunningTurn
    ? Loader2
    : hasReasoning || isCompletedTurn
      ? Brain
      : Wrench;

  // 可折叠：completed（受控回调）或兜底（内部状态）；running 不可折叠
  const canToggle = isCompletedTurn
    ? !!onToggleExpand
    : isRunningTurn
      ? false
      : true;

  const handleToggle = isCompletedTurn
    ? onToggleExpand
    : isRunningTurn
      ? undefined
      : () => setInternalExpanded((v) => !v);

  const finalText = hasFinalMessage && finalMessage!.type === "agent_message"
    ? finalMessage!.text
    : "";

  return (
    <div className="timeline-item group relative flex gap-3 py-2 px-2">
      {/* 头像 */}
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={codexLogoSrc} alt="codex" className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        {/* 头部：名字 + 时间戳（头像名字在最顶部） */}
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">codex</span>
          {timestamp && (
            <span
              className="text-xs text-[hsl(var(--muted-foreground))]"
              title={new Date(timestamp).toString()}
            >
              {formatItemTime(timestamp)}
            </span>
          )}
        </div>

        {/* 可折叠过程块（在头像名字之下） */}
        {hasProcess && (
          <div className="my-1 rounded-lg border border-[hsl(var(--overlay)/0.08)] bg-[hsl(var(--surface-2))]">
            {/* 折叠头部 */}
            <div className="flex items-center gap-1 px-3 py-2 rounded-lg">
              {canToggle ? (
                <button
                  onClick={handleToggle}
                  aria-expanded={isExpanded}
                  className="flex flex-1 items-center gap-2 text-left group focus-ring rounded -mx-1 px-1 py-0.5 transition-colors hover:bg-[hsl(var(--overlay)/0.04)]"
                >
                  <ChevronRight
                    className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]/70 transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]/70 ${
                      isRunningTurn ? "animate-spin" : ""
                    }`}
                  />
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] group-hover:text-foreground/70 transition-colors">
                    {label}
                  </span>
                  {isCompletedTurn && durationStr && (
                    <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]/80">
                      {durationStr}
                    </span>
                  )}
                  {/* 折叠态预览 */}
                  {!isExpanded && (
                    <>
                      {previewText && (
                        <span className="truncate text-xs italic text-[hsl(var(--muted-foreground))]/60 flex-1">
                          {previewText}
                        </span>
                      )}
                      {actionSummary && (
                        <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]/50">
                          {actionSummary}
                        </span>
                      )}
                    </>
                  )}
                </button>
              ) : (
                <div className="flex flex-1 items-center gap-2">
                  <ChevronRight
                    className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]/70 transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]/70 ${
                      isRunningTurn ? "animate-spin" : ""
                    }`}
                  />
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                    {label}
                  </span>
                  {isCompletedTurn && durationStr && (
                    <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]/80">
                      {durationStr}
                    </span>
                  )}
                  {previewText && (
                    <span className="truncate text-xs italic text-[hsl(var(--muted-foreground))]/60 flex-1">
                      {previewText}
                    </span>
                  )}
                  {actionSummary && (
                    <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]/50">
                      {actionSummary}
                    </span>
                  )}
                </div>
              )}

              {/* 右侧弱化 token 用量（completed turn） */}
              {isCompletedTurn && turnMeta?.usage && (
                <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]/50">
                  <span title="input">↑{formatTokens(turnMeta.usage.input_tokens)}</span>
                  <span title="output">↓{formatTokens(turnMeta.usage.output_tokens)}</span>
                  {turnMeta.usage.cached_input_tokens > 0 && (
                    <span title="cached" className="text-[hsl(var(--primary)/0.6)]">
                      ⚡{formatTokens(turnMeta.usage.cached_input_tokens)}
                    </span>
                  )}
                  {turnMeta.usage.reasoning_output_tokens > 0 && (
                    <span title="reasoning" className="text-[hsl(var(--info)/0.6)]">
                      ◇{formatTokens(turnMeta.usage.reasoning_output_tokens)}
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* 展开内容 */}
            {isExpanded && (
              <div className="px-3 pb-2 pt-0.5 space-y-2">
                {/* 中间 agent_message（第一次输出 …） */}
                {hasIntermediateMessages && (
                  <div className="space-y-1.5">
                    {intermediateMessages.map((item) => (
                      <Markdown key={item.id}>{item.text}</Markdown>
                    ))}
                  </div>
                )}
                {/* 思考文本（reasoning 合并） */}
                {hasReasoning && (
                  <div className="ml-1 border-l-2 border-[hsl(var(--overlay)/0.1)] pl-3 py-1 text-sm text-[hsl(var(--muted-foreground))] leading-7">
                    {reasoningText ? (
                      <Markdown className="[--tw-prose-body:theme(colors.muted-foreground)] prose-headings:text-[hsl(var(--muted-foreground))] prose-code:text-[hsl(var(--muted-foreground))] prose-p:my-1.5 prose-p:leading-7">
                        {reasoningText}
                      </Markdown>
                    ) : (
                      <p className="italic text-[hsl(var(--muted-foreground))]/60">
                        思考内容已加密，无法显示明文。
                      </p>
                    )}
                  </div>
                )}
                {/* 动作列表：复用 EventCard 分发，-mx-2 抵消卡片自带 px-2 */}
                {hasActions && (
                  <div className="space-y-0.5">
                    {actionItems.map((item) => (
                      <div key={item.id} className="-mx-2">
                        <EventCard item={item} onOpenDiff={onOpenDiff} showHeader={false} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 最终输出（始终展开） */}
        {hasFinalMessage && <Markdown>{finalText}</Markdown>}
      </div>

      {/* 复制按钮（仅在有最终输出时显示） */}
      {hasFinalMessage && (
        <button
          onClick={copy}
          className="absolute bottom-1 right-2 flex items-center gap-1 rounded p-1 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity hover:bg-[hsl(var(--overlay)/0.05)] hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 focus-ring"
          title={copied ? "已复制" : "复制"}
          aria-label={copied ? "已复制" : "复制"}
        >
          {copied ? (
            <Check className="h-3 w-3 text-[hsl(var(--primary))]" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );
}

/** 生成动作计数摘要（如 "2 命令 · 1 文件"） */
function summarizeActions(actions: ResponseItem[]): string {
  if (actions.length === 0) return "";
  const counts: Record<string, number> = {};
  for (const a of actions) {
    counts[a.type] = (counts[a.type] || 0) + 1;
  }
  const parts: string[] = [];
  if (counts.command_execution) parts.push(`${counts.command_execution} 命令`);
  if (counts.file_change) parts.push(`${counts.file_change} 文件`);
  if (counts.web_search) parts.push(`${counts.web_search} 搜索`);
  if (counts.mcp_tool_call) parts.push(`${counts.mcp_tool_call} 工具`);
  if (counts.plan_update) parts.push(`${counts.plan_update} 计划`);
  return parts.join(" · ");
}
