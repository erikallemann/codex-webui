"use client";

/**
 * SkillMenu — /skills @ 触发的 skill 补全下拉菜单。
 *
 * 在 Composer 输入框上方弹出，按用户在 @ 之后输入的文本过滤 skill 列表。
 * 键盘导航：Up/Down 选择，Enter/Tab 确认，Escape 关闭。
 *
 * 与 SlashCommandMenu 样式一致，但显示 skill 名称、描述与来源标签。
 */

import { useEffect, useRef } from "react";
import type { SkillInfo } from "@/types/api";

interface SkillMenuProps {
  skills: SkillInfo[];
  selectedIndex: number;
  onSelect: (skill: SkillInfo) => void;
  onHover: (index: number) => void;
}

/** 来源标签颜色与文本 */
function sourceBadge(source: SkillInfo["source"]) {
  switch (source) {
    case "user":
      return { label: "用户", className: "bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))]" };
    case "system":
      return { label: "系统", className: "bg-[hsl(var(--overlay)/0.1)] text-[hsl(var(--muted-foreground))]" };
    case "plugin":
      return { label: "插件", className: "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" };
  }
}

export function SkillMenu({
  skills,
  selectedIndex,
  onSelect,
  onHover,
}: SkillMenuProps) {
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

  if (skills.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-hidden rounded-lg border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface))] shadow-lg">
        <div className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
          无匹配 skill
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-lg border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface))] shadow-lg animate-fade-in">
      {/* 标题栏 */}
      <div className="border-b border-[hsl(var(--overlay)/0.05)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        skills · {skills.length}
      </div>
      {/* skill 列表 */}
      <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
        {skills.map((skill, i) => {
          const badge = sourceBadge(skill.source);
          return (
            <button
              key={`${skill.source}:${skill.name}`}
              onClick={() => onSelect(skill)}
              onMouseEnter={() => onHover(i)}
              className={`flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors ${
                i === selectedIndex
                  ? "bg-[hsl(var(--overlay)/0.08)]"
                  : "hover:bg-[hsl(var(--overlay)/0.05)]"
              }`}
            >
              <span className="shrink-0 font-mono text-xs font-medium text-[hsl(var(--primary))]">
                @{skill.name}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-xs text-foreground/80">
                  {skill.description || "(无描述)"}
                </span>
                {skill.plugin && (
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                    {skill.plugin}@{skill.marketplace}
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${badge.className}`}
              >
                {badge.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
