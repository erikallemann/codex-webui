"use client";

/**
 * SlashCommandMenu — slash 命令自动补全下拉菜单。
 *
 * 在 Composer 输入框上方弹出，按用户输入的前缀过滤命令列表。
 * 键盘导航：Up/Down 选择，Enter/Tab 确认，Escape 关闭。
 */

import { useEffect, useRef } from "react";
import type { SlashCommand } from "@/lib/codex/slash-commands";

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onHover: (index: number) => void;
}

export function SlashCommandMenu({
  commands,
  selectedIndex,
  onSelect,
  onHover,
}: SlashCommandMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // 选中项滚动到可见区域
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (commands.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-hidden rounded-lg border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface))] shadow-lg">
        <div className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
          无匹配命令
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-lg border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface))] shadow-lg animate-fade-in">
      {/* 标题栏 */}
      <div className="border-b border-[hsl(var(--overlay)/0.05)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        slash commands
      </div>
      {/* 命令列表 */}
      <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
        {commands.map((cmd, i) => (
          <button
            key={cmd.name}
            onClick={() => onSelect(cmd)}
            onMouseEnter={() => onHover(i)}
            className={`flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors ${
              i === selectedIndex
                ? "bg-[hsl(var(--overlay)/0.08)]"
                : "hover:bg-[hsl(var(--overlay)/0.05)]"
            }`}
          >
            <span className="shrink-0 font-mono text-xs font-medium text-[hsl(var(--primary))]">
              {cmd.name}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block truncate text-xs text-foreground/80">
                {cmd.description}
              </span>
              {cmd.usage && (
                <span className="mt-0.5 block truncate font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                  {cmd.usage}
                </span>
              )}
            </span>
            {cmd.execute === "local" && (
              <span className="shrink-0 rounded bg-[hsl(var(--accent)/0.1)] px-1.5 py-0.5 text-[10px] text-[hsl(var(--accent))]">
                本地
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
