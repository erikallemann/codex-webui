"use client";

/**
 * Composer — 输入框 + 发送/停止按钮 + slash 命令自动补全。
 *
 * - 输入 "/" 作为首字符时弹出 slash 命令补全菜单
 * - Up/Down 选择，Enter/Tab 确认，Escape 关闭
 * - /clear 等本地命令直接执行，其余作为 prompt 发送给 codex
 * - Enter 发送，Shift+Enter 换行
 * - 运行中按钮变为 Stop
 * - 有 resumeSessionId 时走 resume 分支
 * - 无 cwd 时禁用
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useExecStream } from "@/hooks/useExecStream";
import { useConfig } from "@/hooks/useConfig";
import { useActiveSession } from "@/stores/active-session";
import { ArrowUp, Square, CornerDownLeft } from "lucide-react";
import { SlashCommandMenu } from "./SlashCommandMenu";
import {
  filterSlashCommands,
  type SlashCommand,
} from "@/lib/codex/slash-commands";

export function Composer() {
  const { prefs } = useConfig();
  const { run, abort, isRunning } = useExecStream();
  const { state, dispatch } = useActiveSession();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // slash 命令菜单状态
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);

  const running = isRunning || state.status === "running";
  const disabled = !prefs?.cwd;
  const resumeId = state.resumeSessionId;

  // 从输入值中提取 slash 前缀（仅在首字符为 / 且未含空格时触发）
  const slashPrefix = useMemo(() => {
    if (!value.startsWith("/")) return null;
    // 遇到空格说明已进入参数输入阶段，关闭菜单
    const spaceIdx = value.indexOf(" ");
    if (spaceIdx !== -1) return null;
    return value;
  }, [value]);

  const filteredCommands = useMemo(
    () => (slashPrefix ? filterSlashCommands(slashPrefix) : []),
    [slashPrefix],
  );

  // 菜单开关跟随 prefix 与过滤结果
  useEffect(() => {
    if (slashPrefix && filteredCommands.length > 0) {
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
    }
    // 前缀变化时重置选中项
    setSlashIndex(0);
  }, [slashPrefix, filteredCommands.length]);

  // 自适应高度
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  /** 选中某个 slash 命令后的处理 */
  const handleSlashSelect = useCallback(
    (cmd: SlashCommand) => {
      setSlashOpen(false);

      // 本地执行命令
      if (cmd.execute === "local") {
        if (cmd.name === "/clear") {
          dispatch({ type: "RESET" });
          dispatch({ type: "SET_RESUME", sessionId: null });
        }
        setValue("");
        textareaRef.current?.focus();
        return;
      }

      // prompt 命令：插入命令名 + 空格，光标定位到末尾，用户可追加参数
      setValue(`${cmd.name} `);
      textareaRef.current?.focus();
      // 将光标移到末尾
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    },
    [dispatch],
  );

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
      // slash 菜单打开时优先处理导航键
      if (slashOpen && filteredCommands.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashIndex((i) => (i + 1) % filteredCommands.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashIndex(
            (i) => (i - 1 + filteredCommands.length) % filteredCommands.length,
          );
          return;
        }
        if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
          e.preventDefault();
          handleSlashSelect(filteredCommands[slashIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashOpen(false);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [slashOpen, filteredCommands, slashIndex, handleSlashSelect, send],
  );

  return (
    <div className="border-t border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface))] px-4 py-3">
      <div className="mx-auto max-w-4xl">
        <div className="relative">
          {/* slash 命令补全菜单 */}
          {slashOpen && filteredCommands.length > 0 && (
            <SlashCommandMenu
              commands={filteredCommands}
              selectedIndex={slashIndex}
              onSelect={handleSlashSelect}
              onHover={setSlashIndex}
            />
          )}

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
                    : "Ask codex anything…  (输入 / 查看命令)"
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
        </div>

        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
            {resumeId ? `resume · ${resumeId.slice(0, 8)}` : "new session"}
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px] text-[hsl(var(--muted-foreground))]">
            <CornerDownLeft className="h-3 w-3" />
            send
            <span className="ml-2">⇧↵ newline</span>
            {slashOpen && <span className="ml-2">↑↓ 选 / Tab 确认</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
