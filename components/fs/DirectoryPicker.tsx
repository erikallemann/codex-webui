"use client";

/**
 * DirectoryPicker — 目录浏览器弹窗。
 *
 * 调用 GET /api/fs/list?path=<dir> 浏览目录，选择 cwd。
 */

import { useState, useEffect, useCallback } from "react";
import type { FsListResponse } from "@/types/api";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { X, Folder, ArrowLeft, Check } from "lucide-react";

interface Props {
  current?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function DirectoryPicker({ current, onSelect, onClose }: Props) {
  const { t } = useLanguage();
  const [path, setPath] = useState(current || "");
  const [data, setData] = useState<FsListResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const url = `/api/fs/list${p ? `?path=${encodeURIComponent(p)}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = (await res.json()) as FsListResponse;
        setData(json);
        setPath(json.path);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(current || "");
  }, [current, load]);

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex h-[70vh] w-[80vw] max-w-2xl flex-col rounded-lg border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface))] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--overlay)/0.05)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-[hsl(var(--accent))]" />
            <span className="font-mono text-sm">{t("directory.title")}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:text-foreground hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 路径栏 */}
        <div className="flex items-center gap-2 border-b border-[hsl(var(--overlay)/0.05)] px-3 py-2">
          <button
            onClick={() => data?.parent && load(data.parent)}
            disabled={!data?.parent}
            className="rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:text-foreground hover:bg-[hsl(var(--overlay)/0.05)] disabled:opacity-30 transition-colors focus-ring"
            title={t("directory.parent")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load(path);
            }}
            className="flex-1 rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface-2))] px-2 py-1 font-mono text-xs text-foreground/80 outline-none focus:border-[hsl(var(--primary)/0.4)]"
            placeholder={t("directory.path")}
          />
          <button
            onClick={() => load(path)}
            className="rounded-md border border-[hsl(var(--overlay)/0.1)] px-2 py-1 font-mono text-[10px] text-foreground/70 hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
          >
            {t("directory.go")}
          </button>
        </div>

        {/* 目录列表 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-6 text-center font-mono text-xs text-[hsl(var(--muted-foreground))]">
              {t("directory.loading")}
            </div>
          ) : data?.entries.length === 0 ? (
            <div className="px-4 py-6 text-center font-mono text-xs text-[hsl(var(--muted-foreground))]">
              {t("directory.empty")}
            </div>
          ) : (
            <ul className="py-1">
              {data?.entries
                .filter((e) => e.isDir)
                .map((e) => (
                  <li key={e.name}>
                    <button
                      onClick={() => load(`${data.path}\\${e.name}`.replace(/\//g, "\\"))}
                      className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
                    >
                      <Folder className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--accent)/0.7)]" />
                      <span className="font-mono text-xs text-foreground/80 truncate">
                        {e.name}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>

        {/* 底部：选择当前目录 */}
        <div className="flex items-center justify-between border-t border-[hsl(var(--overlay)/0.05)] px-4 py-3">
          <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))] truncate">
            {path || "(none)"}
          </span>
          <button
            onClick={() => onSelect(path)}
            disabled={!path}
            className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.1)] px-3 py-1.5 font-mono text-xs text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)] disabled:opacity-30 transition-colors focus-ring"
          >
            <Check className="h-3 w-3" />
            {t("directory.select")}
          </button>
        </div>
      </div>
    </div>
  );
}
