"use client";

/**
 * ReasoningCard — 思考过程（默认折叠）。
 *
 * 作为「思考过程」与「最终输出」（AgentMessageCard）分离的可折叠块：
 * - 折叠态：显示「思考过程」标签 + 时间戳 + 摘要预览（若有），点击展开
 * - 展开态：完整渲染推理文本（若有），或显示「内容已加密」占位
 *
 * codex 的 reasoning 项实际结构（见 codex-rs/protocol/src/legacy_events.rs）：
 * - summary: 对象数组 [{type:"summary_text", text:"..."}]，非空时为明文推理摘要，
 *   这就是 CLI 显示明文思考过程的来源
 * - encrypted_content: 加密内容（无法本地解密）
 * - text: 由 replay.ts/events.ts 归一化，从 summary 数组拼接而来
 *
 * 明文来源优先级（对齐 CLI）：
 * 1. event_msg/agent_reasoning —— CLI TUI 显示明文思考过程的主要来源
 * 2. response_item/reasoning.summary —— 同一推理的另一种 rollout 表示
 * replay.ts 已对二者去重，同一推理文本只显示一次。
 * 仅当无明文摘要、仅有 encrypted_content 时才显示「加密内容」占位。
 */

import { useState } from "react";
import type { ReasoningItem } from "@/types/api";
import { Brain, ChevronRight, Lock } from "lucide-react";
import { Markdown } from "./Markdown";
import { formatItemTime } from "@/lib/utils/format";

interface Props {
  item: ReasoningItem;
  /** item 时间戳（ISO 字符串） */
  timestamp?: string;
}

export function ReasoningCard({ item, timestamp }: Props) {
  const [expanded, setExpanded] = useState(false);

  // text 已由 replay.ts/events.ts 归一化：从 summary[{type:"summary_text",text:"..."}] 拼接而来
  const text = typeof item.text === "string" ? item.text.trim() : "";
  const hasEncrypted = typeof item.encrypted_content === "string" && item.encrypted_content.length > 0;

  // 既无明文摘要也无加密内容 → 不渲染
  if (!text && !hasEncrypted) return null;

  // 折叠态预览：取 text 第一行（或前 80 字符），截断显示
  const previewText = text ? text.split("\n")[0].slice(0, 80) : "";

  return (
    <div className="timeline-item py-1 px-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left group focus-ring rounded"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
        <Brain className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--info)/0.7)]" />
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] group-hover:text-foreground/70 transition-colors">
          思考过程
        </span>
        {/* 时间戳 */}
        {timestamp && (
          <span
            className="text-xs text-[hsl(var(--muted-foreground))]/60"
            title={new Date(timestamp).toString()}
          >
            {formatItemTime(timestamp)}
          </span>
        )}
        {/* 加密标识 */}
        {hasEncrypted && !text && (
          <Lock className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]/50" />
        )}
        {/* 摘要预览（折叠态，有明文摘要时显示第一行） */}
        {previewText && !expanded && (
          <span className="truncate text-xs italic text-[hsl(var(--muted-foreground))]/70">
            {previewText}
          </span>
        )}
        {/* 加密占位预览（折叠态，无明文时显示） */}
        {!previewText && !expanded && hasEncrypted && (
          <span className="truncate text-xs italic text-[hsl(var(--muted-foreground))]/50">
            加密内容
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 ml-5 border-l-2 border-[hsl(var(--overlay)/0.08)] pl-3 text-sm text-[hsl(var(--muted-foreground))] leading-7">
          {text ? (
            <Markdown className="[--tw-prose-body:theme(colors.muted-foreground)] prose-headings:text-[hsl(var(--muted-foreground))] prose-code:text-[hsl(var(--muted-foreground))] prose-p:my-1.5 prose-p:leading-7">
              {text}
            </Markdown>
          ) : (
            <p className="italic text-[hsl(var(--muted-foreground))]/60">
              思考内容已加密，无法显示明文。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
