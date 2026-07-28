"use client";

/**
 * ErrorCard — 顶层错误 / item 错误。
 */

import type { ErrorItem } from "@/types/api";
import { AlertTriangle } from "lucide-react";

interface Props {
  item: ErrorItem;
}

export function ErrorCard({ item }: Props) {
  return (
    <div className="timeline-item flex gap-3 py-2 px-2">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.08)]">
        <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--danger))]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--danger))]">
          error
        </div>
        <div className="text-sm text-foreground/90 whitespace-pre-wrap">
          {item.message}
        </div>
      </div>
    </div>
  );
}
