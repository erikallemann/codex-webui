"use client";

/**
 * ThemeToggle — 三态主题切换（亮色 / 暗色 / 跟随系统）。
 *
 * 使用 next-themes 的 useTheme：
 * - theme: 当前用户选择（"light" | "dark" | "system"）
 * - setTheme: 切换选择
 * - resolvedTheme: 实际生效的主题（system 时解析为 light/dark）
 *
 * UI：紧凑的下拉菜单按钮，显示当前模式图标 + 展开三个选项。
 * 挂载前 resolvedTheme 为 undefined，用占位避免 hydration mismatch。
 */

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, ChevronDown } from "lucide-react";

type ThemeOption = "light" | "dark" | "system";

const OPTIONS: { value: ThemeOption; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  // mounted：避免 SSR 时渲染与主题相关的图标（防止 hydration mismatch）
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // 当前生效图标：system 时按 resolvedTheme 显示，未挂载时用 Moon 占位
  const currentIcon = !mounted
    ? Moon
    : (theme === "system" ? resolvedTheme : theme) === "light"
      ? Sun
      : Moon;

  const CurrentIcon = currentIcon;

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDoc = () => setOpen(false);
    window.addEventListener("click", onDoc);
    return () => window.removeEventListener("click", onDoc);
  }, [open]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--overlay)/0.05)] px-1.5 py-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--overlay)/0.1)] hover:text-foreground transition-colors focus-ring"
        title="Theme"
        aria-label="Toggle theme"
      >
        <CurrentIcon className="h-3.5 w-3.5" />
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-32 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] py-1 shadow-lg animate-fade-in">
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = mounted && theme === value;
            return (
              <button
                key={value}
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors hover:bg-[hsl(var(--overlay)/0.06)] ${
                  active
                    ? "text-[hsl(var(--primary))]"
                    : "text-[hsl(var(--muted-foreground))]"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{label}</span>
                {active && <span className="text-[10px]">●</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
