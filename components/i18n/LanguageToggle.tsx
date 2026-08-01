"use client";

import { ChevronDown, Languages, Monitor } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import type { LanguagePreference } from "@/lib/i18n/messages";

export function LanguageToggle() {
  const { preference, setPreference, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options: Array<{
    value: LanguagePreference;
    label: string;
    marker: string | null;
  }> = [
    { value: "system", label: t("language.system"), marker: null },
    { value: "zh-CN", label: t("language.zh"), marker: "中" },
    { value: "en", label: t("language.en"), marker: "A" },
  ];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t("language.label")}
        aria-expanded={open}
        title={`${t("language.label")}: ${options.find((option) => option.value === preference)?.label}`}
        className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--overlay)/0.05)] px-1.5 py-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--overlay)/0.1)] hover:text-foreground focus-ring"
      >
        <Languages className="h-3.5 w-3.5" />
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] py-1 shadow-lg animate-fade-in">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setPreference(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors hover:bg-[hsl(var(--overlay)/0.06)] ${
                option.value === preference
                  ? "text-[hsl(var(--primary))]"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {option.marker === null ? (
                <Monitor className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[10px]">
                  {option.marker}
                </span>
              )}
              <span className="flex-1">{option.label}</span>
              {option.value === preference && <span className="text-[10px]">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
