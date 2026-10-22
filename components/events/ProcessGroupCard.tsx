"use client";

/**
 * ProcessGroupCard — 合并折叠块（思考过程 + 执行动作）。
 *
 * 将一轮中连续的中间过程事件（reasoning + command/file/search/mcp/plan）
 * 合并为单个灰色可折叠块，弱化中间过程、突出最终输出（agent_message）：
 * - 折叠态：灰色背景，显示思考摘要预览 + 动作计数
 * - 展开态：显示完整思考文本 + 动作列表（复用各 EventCard）
 *
 * 分组逻辑在 EventTimeline 的 annotated useMemo 中完成：
 * user_message / agent_message / turn / error 作为边界 flush 当前组，
 * 中间过程事件累积到同一组。
 */

import { useState } from "react";
import type { FileChangeItem, ResponseItem } from "@/types/api";
import { Brain, ChevronRight, Wrench } from "lucide-react";
import { EventCard } from "./EventCard";
import { Markdown } from "./Markdown";
import { formatItemTime } from "@/lib/utils/format";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface Props {
  items: ResponseItem[];
  onOpenDiff: (item: FileChangeItem) => void;
  /** 组首项时间戳（ISO 字符串） */
  timestamp?: string;
}

export function ProcessGroupCard({ items, onOpenDiff, timestamp }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();

  // 分离 reasoning 与动作
  const reasoningItems = items.filter((i) => i.type === "reasoning");
  const actionItems = items.filter((i) => i.type !== "reasoning");

  // 拼接所有思考文本
  const reasoningText = reasoningItems
    .map((i) => (typeof i.text === "string" ? i.text.trim() : ""))
    .filter((t) => t.length > 0)
    .join("\n");
  const hasEncrypted = reasoningItems.some(
    (i) => typeof i.encrypted_content === "string" && i.encrypted_content.length > 0,
  );

  // 折叠态预览：思考摘要第一行
  const previewText = reasoningText ? reasoningText.split("\n")[0].slice(0, 100) : "";

  // 动作计数摘要
  const actionSummary = summarizeActions(actionItems, t);

  const hasReasoning = reasoningText.length > 0 || hasEncrypted;
  const hasActions = actionItems.length > 0;

  // 不应发生：既无思考也无动作
  if (!hasReasoning && !hasActions) return null;

  // 有思考文本时标题为「思考过程」，仅有动作时为「执行动作」
  const label = hasReasoning ? t("process.thinking") : t("process.actions");
  const Icon = hasReasoning ? Brain : Wrench;

  return (
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
        {/* 时间戳 */}
        {timestamp && (
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]/50">
            {formatItemTime(timestamp)}
          </span>
        )}
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
        <div className="px-3 pb-2 pt-0.5 space-y-1">
          {/* 思考文本 */}
          {hasReasoning && (
            <div className="ml-1 border-l-2 border-[hsl(var(--overlay)/0.1)] pl-3 py-1 text-sm text-[hsl(var(--muted-foreground))] leading-7">
              {reasoningText ? (
                <Markdown className="[--tw-prose-body:hsl(var(--muted-foreground))] prose-headings:text-[hsl(var(--muted-foreground))] prose-code:text-[hsl(var(--muted-foreground))] prose-p:my-1.5 prose-p:leading-7">
                  {reasoningText}
                </Markdown>
              ) : (
                <p className="italic text-[hsl(var(--muted-foreground))]/60">
                  {t("process.encrypted")}
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
  );
}

/** 生成动作计数摘要（如 "2 命令 · 1 文件"） */
function summarizeActions(actions: ResponseItem[], t: ReturnType<typeof useLanguage>["t"]): string {
  if (actions.length === 0) return "";
  const counts: Record<string, number> = {};
  for (const a of actions) {
    counts[a.type] = (counts[a.type] || 0) + 1;
  }
  const parts: string[] = [];
  if (counts.command_execution) parts.push(`${counts.command_execution} ${t("process.command")}`);
  if (counts.file_change) parts.push(`${counts.file_change} ${t("process.file")}`);
  if (counts.web_search) parts.push(`${counts.web_search} ${t("process.search")}`);
  if (counts.mcp_tool_call) parts.push(`${counts.mcp_tool_call} ${t("process.tool")}`);
  if (counts.plan_update) parts.push(`${counts.plan_update} ${t("process.plan")}`);
  return parts.join(" · ");
}
