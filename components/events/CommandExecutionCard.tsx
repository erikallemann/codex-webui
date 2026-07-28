"use client";

/**
 * CommandExecutionCard — 命令执行。
 *
 * 显示命令、退出码 badge、stdout/stderr（可折叠）。
 */

import { useState, useCallback } from "react";
import type { CommandExecutionItem } from "@/types/api";
import { Terminal, ChevronRight, Check, X, Copy } from "lucide-react";

interface Props {
  item: CommandExecutionItem;
}

export function CommandExecutionCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const exitCode = item.exit_code;
  const success = exitCode === 0;
  const hasOutput = !!(item.stdout || item.stderr);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(item.command.join(" "));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [item.command]);

  return (
    <div className="timeline-item py-1.5 px-2">
      <div className="flex items-start gap-2">
        <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />

        <div className="flex-1 min-w-0">
          {/* 命令行 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-md border border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface-2))] px-2 py-1 font-mono text-xs text-foreground/90 overflow-x-auto">
              <span className="text-[hsl(var(--muted-foreground))]">$</span>{" "}
              <span className="whitespace-pre">{item.command.join(" ")}</span>
            </div>

            <button
              onClick={copy}
              className="shrink-0 rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-foreground hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
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
                className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                  success
                    ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]"
                    : "bg-[hsl(var(--danger)/0.12)] text-[hsl(var(--danger))]"
                }`}
              >
                {success ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                {exitCode}
              </span>
            )}

            {hasOutput && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 font-mono text-[10px] text-[hsl(var(--muted-foreground))] hover:text-foreground transition-colors focus-ring rounded"
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
              {item.stdout && (
                <pre className="overflow-x-auto rounded border border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface-2))] p-2 font-mono text-[11px] text-foreground/70 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {item.stdout}
                </pre>
              )}
              {item.stderr && (
                <pre className="overflow-x-auto rounded border border-[hsl(var(--danger)/0.2)] bg-[hsl(var(--danger)/0.05)] p-2 font-mono text-[11px] text-[hsl(var(--danger)/0.9)] whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {item.stderr}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
