"use client";

/**
 * Composer — 输入框 + 发送/停止按钮。
 *
 * - Enter 发送，Shift+Enter 换行
 * - 运行中按钮变为 Stop
 * - 有 resumeSessionId 时走 resume 分支
 * - 无 cwd 时禁用
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useExecStream } from "@/hooks/useExecStream";
import { useConfig } from "@/hooks/useConfig";
import { useActiveSession } from "@/stores/active-session";
import { ArrowUp, Square, CornerDownLeft } from "lucide-react";

export function Composer() {
  const { prefs } = useConfig();
  const { run, abort, isRunning } = useExecStream();
  const { state } = useActiveSession();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const running = isRunning || state.status === "running";
  const disabled = !prefs?.cwd;
  const resumeId = state.resumeSessionId;

  // 自适应高度
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const send = useCallback(() => {
    const prompt = value.trim();
    if (!prompt || running || disabled || !prefs?.cwd) return;

    run({
      prompt,
      cwd: prefs.cwd,
      model: prefs.model,
      effort: prefs.effort,
      sandbox: prefs.sandbox,
      approvalPolicy: prefs.approvalPolicy,
      skipGitRepoCheck: true,
      resumeSessionId: resumeId ?? undefined,
    });
    setValue("");
  }, [value, running, disabled, prefs, run, resumeId]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  return (
    <div className="border-t border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface))] px-4 py-3">
      <div className="mx-auto max-w-4xl">
        <div
          className={`flex items-end gap-2 rounded-lg border bg-[hsl(var(--surface-2))] px-3 py-2 transition-colors ${
            disabled
              ? "border-[hsl(var(--overlay)/0.05)] opacity-50"
              : "border-[hsl(var(--overlay)/0.1)] focus-within:border-[hsl(var(--primary)/0.4)]"
          }`}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            rows={1}
            placeholder={
              disabled
                ? "Set a working directory to begin…"
                : resumeId
                  ? "Continue the session…"
                  : "Ask codex anything…"
            }
            className="flex-1 resize-none bg-transparent text-base text-foreground placeholder:text-[hsl(var(--muted-foreground))] outline-none disabled:cursor-not-allowed"
            style={{ minHeight: "28px", maxHeight: "200px" }}
          />

          {running ? (
            <button
              onClick={abort}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.1)] text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.2)] transition-colors focus-ring"
              title="Stop"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!value.trim() || disabled}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-ring"
              title="Send (Enter)"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
            {resumeId ? `resume · ${resumeId.slice(0, 8)}` : "new session"}
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
            <CornerDownLeft className="h-3 w-3" />
            send
            <span className="ml-2">⇧↵ newline</span>
          </span>
        </div>
      </div>
    </div>
  );
}
