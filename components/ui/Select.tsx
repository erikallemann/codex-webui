"use client";

/**
 * Select — 自定义下拉选择组件。
 *
 * 取代原生 <select>，原因：
 * 1) 原生下拉在 Sidebar 底部会被截断，且无法可靠滚动；
 * 2) 暗色主题下原生 option 样式不一致；
 * 3) 支持向上/向下展开方向，适配 ConfigPanel 底部场景。
 *
 * 弹层最大高度 240px，内部 overflow-y-auto，支持滚动。
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** 弹层展开方向：top=向上（用于底部场景），bottom=向下（默认） */
  placement?: "top" | "bottom";
  className?: string;
  "aria-label"?: string;
}

export function Select({
  value,
  options,
  onChange,
  placement = "bottom",
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-1.5 rounded border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface-2))] px-2 py-1 text-left font-mono text-[11px] text-foreground/80 hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring ${
          className ?? ""
        }`}
      >
        <span className="flex-1 truncate">{current?.label ?? value}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-50 left-0 right-0 ${
            placement === "top" ? "bottom-full mb-1" : "top-full mt-1"
          } max-h-60 overflow-y-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] py-1 shadow-lg animate-fade-in`}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                title={opt.description}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors hover:bg-[hsl(var(--overlay)/0.06)] ${
                  active ? "text-[hsl(var(--primary))]" : "text-foreground/80"
                }`}
              >
                <span className="flex-1 truncate">{opt.label}</span>
                {active && <Check className="h-3 w-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
