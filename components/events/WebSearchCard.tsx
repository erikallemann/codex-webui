"use client";

/**
 * WebSearchCard — web 搜索结果（可折叠）。
 */

import { useState } from "react";
import type { WebSearchItem } from "@/types/api";
import { Globe, ChevronRight, ExternalLink } from "lucide-react";

interface Props {
  item: WebSearchItem;
}

export function WebSearchCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false);
  const results = item.results ?? [];

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
        <Globe className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--info)/0.8)]" />
        <span className="font-mono text-xs text-foreground/90 truncate">
          {item.query || "web search"}
        </span>
        {results.length > 0 && (
          <span className="shrink-0 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
            {results.length} results
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-1.5 ml-5 space-y-1.5">
          {item.summary && (
            <p className="text-xs text-foreground/70">{item.summary}</p>
          )}
          {results.map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded border border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface-2))] px-2 py-1.5 hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-[hsl(var(--info))] truncate">
                  {r.title}
                </span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
              </div>
              {r.snippet && (
                <div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))] line-clamp-2">
                  {r.snippet}
                </div>
              )}
              <div className="mt-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                {r.url}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
