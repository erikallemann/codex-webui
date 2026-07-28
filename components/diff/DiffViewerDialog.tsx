"use client";

/**
 * DiffViewerDialog — 全屏 unified diff 查看器。
 *
 * 渲染解析后的 DiffFile，增/删/上下文行着色，左 gutter 行号。
 */

import { useMemo, useState, useEffect } from "react";
import type { FileChangeItem } from "@/types/api";
import { parseDiff } from "@/lib/utils/diff";
import { X, FileEdit, Copy, Check } from "lucide-react";

interface Props {
  item: FileChangeItem;
  onClose: () => void;
}

export function DiffViewerDialog({ item, onClose }: Props) {
  const diff = useMemo(
    () => (item.patch ? parseDiff(item.patch, item.path) : null),
    [item.patch, item.path],
  );
  const [copied, setCopied] = useState(false);

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copyPatch = () => {
    if (!item.patch) return;
    navigator.clipboard.writeText(item.patch);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-[90vw] max-w-5xl flex-col rounded-lg border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface))] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--overlay)/0.05)] px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileEdit className="h-4 w-4 shrink-0 text-[hsl(var(--info))]" />
            <span className="font-mono text-sm text-foreground truncate">
              {item.path}
            </span>
            {diff && (
              <span className="shrink-0 font-mono text-xs flex items-center gap-2">
                <span className="text-[hsl(var(--primary))]">+{diff.added}</span>
                <span className="text-[hsl(var(--danger))]">-{diff.removed}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {item.patch && (
              <button
                onClick={copyPatch}
                className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:text-foreground hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
                title="Copy patch"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:text-foreground hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* diff 内容 */}
        <div className="flex-1 min-h-0 overflow-auto">
          {diff ? (
            <div className="font-mono text-xs">
              {diff.lines.map((line, i) => (
                <DiffRow key={i} line={line} />
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
              No patch content
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffRow({ line }: { line: import("@/lib/utils/diff").DiffLine }) {
  if (line.type === "meta") {
    return (
      <div className="px-3 py-0.5 text-[hsl(var(--muted-foreground))] bg-[hsl(var(--overlay)/0.02)]">
        {line.content}
      </div>
    );
  }

  if (line.type === "hunk") {
    return (
      <div className="px-3 py-1 text-[hsl(var(--diff-hunk))] bg-[hsl(var(--diff-hunk)/0.08)] border-y border-[hsl(var(--diff-hunk)/0.15)]">
        {line.content}
      </div>
    );
  }

  const bg =
    line.type === "add"
      ? "bg-[hsl(var(--diff-add-bg)/0.1)]"
      : line.type === "del"
        ? "bg-[hsl(var(--diff-del-bg)/0.1)]"
        : "";
  const fg =
    line.type === "add"
      ? "text-[hsl(var(--diff-add-fg))]"
      : line.type === "del"
        ? "text-[hsl(var(--diff-del-fg))]"
        : "text-foreground/80";
  const prefix = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";

  return (
    <div className={`flex ${bg}`}>
      <span className="w-12 shrink-0 select-none px-2 text-right text-[hsl(var(--muted-foreground))] bg-[hsl(var(--overlay)/0.02)]">
        {line.oldLine ?? ""}
      </span>
      <span className="w-12 shrink-0 select-none px-2 text-right text-[hsl(var(--muted-foreground))] bg-[hsl(var(--overlay)/0.02)] border-l border-[hsl(var(--overlay)/0.05)]">
        {line.newLine ?? ""}
      </span>
      <span className={`shrink-0 w-5 select-none text-center ${fg}`}>{prefix}</span>
      <span className={`flex-1 px-2 whitespace-pre-wrap break-all ${fg}`}>
        {line.content || " "}
      </span>
    </div>
  );
}
