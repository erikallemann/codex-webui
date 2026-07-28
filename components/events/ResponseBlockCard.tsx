"use client";

/**
 * ResponseBlockCard — 单轮 codex 回复整体块。
 *
 * 结构（对齐 codex cli 的折叠展开风格）：
 * ```
 * [avatar] codex  timestamp
 *   ▶ 思考过程 …          ← 可折叠块（头像名字之下）
 *     · 中间 agent_message（第一次输出 …）
 *     · 思考文本（reasoning 合并）
 *     · 动作列表（命令 / 文件 / 搜索 / 工具 / 计划）
 *   最终 agent_message      ← 最终输出（始终展开）
 * ```
 *
 * 折叠范围：「codex 第一次输出 → 最后一次思考过程」。
 * processItems 包含中间所有 agent_message + reasoning + 动作；
 * finalMessage 是最后一条 agent_message（最终回答），始终展开显示。
 *
 * 头像+名字固定在顶部，折叠块在其之下，符合「折叠要在 codex 头像名字之下」。
 */

import { useState, useCallback } from "react";
import type { FileChangeItem, ResponseItem } from "@/types/api";
import { Brain, ChevronRight, Wrench, Copy, Check } from "lucide-react";
import { EventCard } from "./EventCard";
import { Markdown } from "./Markdown";
import { formatItemTime } from "@/lib/utils/format";
// codex 官方 logo：渐变色 SVG。
// Next.js 15 静态导入 SVG 返回 StaticImageData 对象，取 .src 得到实际资源 URL。
import codexLogo from "@/logo/codex-color.svg";
const codexLogoSrc = typeof codexLogo === "string" ? codexLogo : codexLogo.src;

interface Props {
  /** 中间过程事件（中间 agent_message + reasoning + 动作），折叠在其下 */
  processItems: ResponseItem[];
  /** 最终 agent_message（最终输出，始终展开；undefined 表示尚无输出） */
  finalMessage?: ResponseItem;
  onOpenDiff: (item: FileChangeItem) => void;
  /** 首个事件时间戳（ISO 字符串） */
  timestamp?: string;
}

export function ResponseBlockCard({ processItems, finalMessage, onOpenDiff, timestamp }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    const text =
      finalMessage && finalMessage.type === "agent_message" ? finalMessage.text : "";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [finalMessage]);

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

  // 折叠块标签：有思考→「思考过程」，仅动作→「执行动作」，仅中间输出→「中间输出」
  const label = hasReasoning ? "思考过程" : hasActions ? "执行动作" : "中间输出";
  const Icon = hasReasoning ? Brain : Wrench;

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
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left group focus-ring rounded-lg"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]/70 transition-transform ${
                  expanded ? "rotate-90" : ""
                }`}
              />
              <Icon className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]/70" />
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] group-hover:text-foreground/70 transition-colors">
                {label}
              </span>
              {/* 折叠态预览 */}
              {!expanded && (
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

            {/* 展开内容 */}
            {expanded && (
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
