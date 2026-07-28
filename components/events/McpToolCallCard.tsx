"use client";

/**
 * McpToolCallCard — MCP 工具调用（可折叠显示参数与结果）。
 */

import { useState } from "react";
import type { McpToolCallItem } from "@/types/api";
import { Wrench, ChevronRight, AlertCircle } from "lucide-react";

interface Props {
  item: McpToolCallItem;
}

export function McpToolCallCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasError = !!item.error;

  return (
    <div className="timeline-item py-1.5 px-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left focus-ring rounded"
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
        <Wrench
          className={`h-3.5 w-3.5 shrink-0 ${
            hasError
              ? "text-[hsl(var(--danger))]"
              : "text-[hsl(var(--info)/0.8)]"
          }`}
        />
        <span className="font-mono text-xs text-foreground/90">
          {item.server}.{item.tool}
        </span>
        {hasError && (
          <AlertCircle className="h-3 w-3 text-[hsl(var(--danger))]" />
        )}
      </button>

      {expanded && (
        <div className="mt-1.5 ml-5 space-y-1">
          {item.arguments && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                args
              </div>
              <pre className="mt-0.5 overflow-x-auto rounded border border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface-2))] p-2 font-mono text-[11px] text-foreground/70 max-h-40 overflow-y-auto">
                {formatJson(item.arguments)}
              </pre>
            </div>
          )}
          {item.output && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                output
              </div>
              <pre className="mt-0.5 overflow-x-auto rounded border border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface-2))] p-2 font-mono text-[11px] text-foreground/70 max-h-40 overflow-y-auto">
                {formatJson(item.output)}
              </pre>
            </div>
          )}
          {item.error && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--danger))]">
                error
              </div>
              <pre className="mt-0.5 overflow-x-auto rounded border border-[hsl(var(--danger)/0.2)] bg-[hsl(var(--danger)/0.05)] p-2 font-mono text-[11px] text-[hsl(var(--danger)/0.9)] max-h-40 overflow-y-auto">
                {item.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
