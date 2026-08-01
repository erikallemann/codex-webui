"use client";

/**
 * CommandExecutionCard — 命令执行。
 *
 * 显示命令、退出码 badge、aggregated_output（可折叠）。
 *
 * codex exec --json 的 command_execution item 实际结构：
 * - command: 完整命令行字符串（非数组）
 * - aggregated_output: 合并的 stdout+stderr（含 ANSI 颜色码）
 * - exit_code: number | null
 * - status: "in_progress" | "completed"
 */

import { useState, useCallback } from "react";
import type { CommandExecutionItem } from "@/types/api";
import { Terminal, ChevronRight, Check, X, Copy } from "lucide-react";

interface Props {
  item: CommandExecutionItem;
}

/** 剥离 ANSI 颜色/控制码，便于在 <pre> 中纯文本展示 */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
}

export function CommandExecutionCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const exitCode = item.exit_code ?? undefined;
  const success = exitCode === 0;
  // 优先使用 aggregated_output，其次 stdout/stderr
  const rawOutput = item.aggregated_output ?? "";
  const stdout = item.stdout ?? (rawOutput ? stripAnsi(rawOutput) : "");
  const stderr = item.stderr ?? "";
  const hasOutput = !!(stdout || stderr);

  // command 是字符串，直接使用
  const commandStr = typeof item.command === "string" ? item.command : "";

  const copy = useCallback(() => {
    navigator.clipboard.writeText(commandStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [commandStr]);

  return (
    <div className="timeline-item py-1.5 px-2">
      <div className="flex items-start gap-2">
        <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />

        <div className="flex-1 min-w-0">
          {/* 命令行 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-md border border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface-2))] px-2 py-1 font-mono text-xs text-foreground/90 overflow-x-auto">
              <span className="text-[hsl(var(--muted-foreground))]">$</span>{" "}
              <span className="whitespace-pre-wrap break-all">{commandStr}</span>
            </div>

            <button
              onClick={copy}
              className="shrink-0 rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:text-foreground hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
              title="Copy command"
            >
              <Copy className="h-3 w-3" />
              {copied && <span className="sr-only">copied</span>}
            </button>
          </div>

          {/* 退出码 + 输出切换 */}
          <div className="mt-1 flex items-center gap-2">
            {exitCode !== undefined && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] ${
                  success
                    ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]"
                    : "bg-[hsl(var(--danger)/0.12)] text-[hsl(var(--danger))]"
                }`}
              >
                {success ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                {exitCode}
              </span>
            )}

            {item.status === "in_progress" && (
              <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))] animate-pulse">
                running…
              </span>
            )}

            {hasOutput && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 font-mono text-[10px] text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors focus-ring rounded-md"
              >
                <ChevronRight
                  className={`h-2.5 w-2.5 transition-transform ${expanded ? "rotate-90" : ""}`}
                />
                output
              </button>
            )}

            {item.metadata?.denial_reason && (
              <span className="font-mono text-[10px] text-[hsl(var(--accent))]">
                denied: {item.metadata.denial_reason}
              </span>
            )}
          </div>

          {/* 输出（折叠） */}
          {expanded && hasOutput && (
            <div className="mt-1.5 space-y-1">
              {stdout && (
                <pre className="overflow-x-auto rounded-md border border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface-2))] p-2 font-mono text-[11px] text-foreground/70 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {stdout}
                </pre>
              )}
              {stderr && (
                <pre className="overflow-x-auto rounded-md border border-[hsl(var(--danger)/0.2)] bg-[hsl(var(--danger)/0.05)] p-2 font-mono text-[11px] text-[hsl(var(--danger)/0.9)] whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {stderr}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
