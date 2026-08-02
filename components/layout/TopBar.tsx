"use client";

/**
 * TopBar — 顶部状态条。
 *
 * 显示当前会话信息：thread_id / cwd / model / effort / 状态 / token 用量 + 上下文窗口进度。
 * 右侧：codex 速率限制用量（plan_type / used_percent）+ Stop 按钮。
 *
 * 用量信息常驻显示（即使为 0），并基于当前模型的 context_window 计算占比进度条。
 * codex 速率限制来自实时 token_count 事件，作为跨会话的账号级状态显示；回放仅影响会话上下文。
 */

import { useActiveSession } from "@/stores/active-session";
import { useConfig } from "@/hooks/useConfig";
import { useUsageRefresh } from "@/hooks/useUsageRefresh";
import { abortActiveStream } from "@/hooks/stream-controller";
import { useToast } from "@/stores/toast";
import { Square, Circle, Loader2, Zap, Clock, RefreshCw } from "lucide-react";
import { formatTokens, shortPath } from "@/lib/utils/format";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function TopBar() {
  const { state } = useActiveSession();
  const { config, prefs } = useConfig();
  const { refresh, isRefreshing, canRefresh } = useUsageRefresh();
  const { toast } = useToast();
  const { t, locale } = useLanguage();

  const isRunningState = state.status === "running";
  const showStop = isRunningState;

  const statusLabel = {
    idle: "idle",
    running: "running",
    completed: "completed",
    failed: "failed",
    aborted: "aborted",
  }[state.status];

  const statusColor = {
    idle: "text-[hsl(var(--muted-foreground))]",
    running: "text-[hsl(var(--primary))]",
    completed: "text-[hsl(var(--primary))]",
    failed: "text-[hsl(var(--danger))]",
    aborted: "text-[hsl(var(--accent))]",
  }[state.status];

  // 当前模型的上下文窗口
  const currentModel = config?.models.find((m) => m.value === prefs?.model);
  const contextWindow = state.contextWindow ?? currentModel?.contextWindow ?? 0;

  // input_tokens 已包含缓存命中的输入；优先使用 rollout 最近一次模型调用的权威值。
  const usedTokens = state.contextTokens ?? 0;
  const ctxPct =
    contextWindow > 0 ? Math.min(100, (usedTokens / contextWindow) * 100) : 0;

  const hasUsage =
    state.totalUsage.input_tokens > 0 || state.totalUsage.output_tokens > 0;

  // codex 速率限制
  const rl = state.rateLimits;
  const rlUsedPct = rl?.primary?.usedPercent ?? 0;
  const hasRateLimits = !!rl?.primary;

  // 速率限制重置时间
  const resetLabel = (() => {
    if (!rl?.primary?.resetsAt) return null;
    try {
      const d = new Date(rl.primary.resetsAt * 1000);
      return d.toLocaleDateString(locale, { month: "short", day: "numeric" }) +
        " " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return null;
    }
  })();

  const refreshUsage = async () => {
    try {
      await refresh();
      toast({ title: t("usage.refreshed"), type: "success", duration: 1600 });
    } catch (error) {
      toast({
        title: t("usage.refreshFailed"),
        description: error instanceof Error ? error.message : String(error),
        type: "error",
      });
    }
  };

  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--surface))] px-2 sm:px-4">
      {/* 左：会话标识 */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden lg:gap-3">
        <div className="flex shrink-0 items-center gap-1.5">
          {isRunningState ? (
            <Loader2 className="h-3 w-3 animate-spin text-[hsl(var(--primary))]" />
          ) : state.status === "completed" ? (
            <Circle className="h-2 w-2 fill-[hsl(var(--primary))] text-[hsl(var(--primary))]" />
          ) : state.status === "failed" ? (
            <Circle className="h-2 w-2 fill-[hsl(var(--danger))] text-[hsl(var(--danger))]" />
          ) : (
            <Circle className="h-2 w-2 fill-[hsl(var(--muted))] text-[hsl(var(--muted))]" />
          )}
          <span className={`font-mono text-xs ${statusColor}`}>{statusLabel}</span>
        </div>

        {prefs?.cwd && (
          <span
            className="hidden max-w-48 truncate font-mono text-xs text-[hsl(var(--muted-foreground))] lg:inline"
            title={prefs.cwd}
          >
            {shortPath(prefs.cwd)}
          </span>
        )}

        {prefs?.model && (
          <span className="hidden max-w-28 truncate font-mono text-xs text-[hsl(var(--muted-foreground))] lg:inline">
            {prefs.model}
          </span>
        )}

        {prefs?.effort && (
          <span className="hidden rounded-md bg-[hsl(var(--overlay)/0.08)] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))] lg:inline">
            {prefs.effort}
          </span>
        )}

        {state.isReplay && (
          <span className="hidden rounded-md bg-[hsl(var(--accent)/0.15)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--accent))] lg:inline">
            replay
          </span>
        )}
      </div>

      {/* 右：codex 速率限制 + 上下文进度 + token 用量 + Stop */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3">
        {/* codex 速率限制用量（plan + used% + reset） */}
        {hasRateLimits && (
          <div
            className="flex shrink-0 items-center gap-1.5"
            title={[
              `codex rate limit`,
              rl?.planType ? `plan: ${rl.planType}` : null,
              rl?.limitId ? `limit: ${rl.limitId}` : null,
              `used: ${rlUsedPct.toFixed(1)}%`,
              resetLabel ? `resets at: ${resetLabel}` : null,
              rl?.credits ? `credits: ${rl.credits.hasCredits ? "yes" : "no"}${rl.credits.balance ? ` ($${rl.credits.balance})` : ""}${rl.credits.unlimited ? " · unlimited" : ""}` : null,
            ].filter(Boolean).join("\n")}
          >
            {rl?.planType && (
              <span className="rounded-md bg-[hsl(var(--info)/0.12)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--info))]">
                {rl.planType}
              </span>
            )}
            <div className="flex flex-col items-end gap-0.5">
              <span className="flex items-center gap-0.5 font-mono text-[9px] text-[hsl(var(--muted-foreground))]">
                <Zap className="h-2.5 w-2.5" />
                {rlUsedPct.toFixed(0)}%
              </span>
              <div className="h-1 w-16 overflow-hidden rounded-full bg-[hsl(var(--overlay)/0.1)]">
                <div
                  className={`h-full rounded-full transition-all ${
                    rlUsedPct > 90
                      ? "bg-[hsl(var(--danger))]"
                      : rlUsedPct > 70
                        ? "bg-[hsl(var(--accent))]"
                        : "bg-[hsl(var(--info))]"
                  }`}
                  style={{ width: `${rlUsedPct === 0 ? 0 : Math.max(2, rlUsedPct)}%` }}
                />
              </div>
            </div>
            {resetLabel && (
              <span className="hidden lg:flex items-center gap-0.5 font-mono text-[9px] text-[hsl(var(--muted-foreground))]/70">
                <Clock className="h-2.5 w-2.5" />
                {resetLabel}
              </span>
            )}
          </div>
        )}

        {/* 分隔线 */}
        {hasRateLimits && contextWindow > 0 && (
          <div className="hidden h-6 w-px bg-[hsl(var(--overlay)/0.08)] sm:block" />
        )}

        {/* 上下文窗口进度条 */}
        {contextWindow > 0 && (
          <div
            className="group relative flex shrink-0 items-center gap-1.5"
            tabIndex={0}
            aria-describedby="context-usage-tooltip"
          >
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-mono text-[9px] text-[hsl(var(--muted-foreground))]">
                ctx {ctxPct.toFixed(0)}%
              </span>
              <div className="h-1 w-20 overflow-hidden rounded-full bg-[hsl(var(--overlay)/0.1)]">
                <div
                  className={`h-full rounded-full transition-all ${
                    ctxPct > 80
                      ? "bg-[hsl(var(--danger))]"
                      : ctxPct > 50
                        ? "bg-[hsl(var(--accent))]"
                        : "bg-[hsl(var(--primary))]"
                  }`}
                  style={{ width: `${ctxPct === 0 ? 0 : Math.max(2, ctxPct)}%` }}
                />
              </div>
            </div>
            <div
              id="context-usage-tooltip"
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-md border border-[hsl(var(--overlay)/0.12)] bg-[hsl(var(--surface))] px-2.5 py-1.5 font-mono text-[10px] text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {t("usage.used")} {usedTokens.toLocaleString(locale)} / {t("usage.total")} {contextWindow.toLocaleString(locale)} tokens · {ctxPct.toFixed(1)}%
            </div>
          </div>
        )}

        {/* token 用量（常驻显示） */}
        <div className="hidden items-center gap-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))] lg:flex">
          <span title="input tokens" className={hasUsage ? "text-foreground/70" : ""}>
            ↑{formatTokens(state.totalUsage.input_tokens)}
          </span>
          <span title="output tokens" className={hasUsage ? "text-foreground/70" : ""}>
            ↓{formatTokens(state.totalUsage.output_tokens)}
          </span>
          {state.totalUsage.cached_input_tokens > 0 && (
            <span title="cached input" className="text-[hsl(var(--primary)/0.7)]">
              ⚡{formatTokens(state.totalUsage.cached_input_tokens)}
            </span>
          )}
          {state.totalUsage.reasoning_output_tokens > 0 && (
            <span title="reasoning output" className="text-[hsl(var(--accent)/0.8)]">
              🧠{formatTokens(state.totalUsage.reasoning_output_tokens)}
            </span>
          )}
        </div>

        <button
          onClick={refreshUsage}
          disabled={!canRefresh || isRefreshing}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--overlay)/0.08)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 focus-ring"
          title={canRefresh ? t("usage.refresh") : t("usage.refreshUnavailable")}
          aria-label={t("usage.refresh")}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>

        {showStop && (
          <button
            onClick={abortActiveStream}
            className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.1)] px-2 py-1 text-xs font-medium text-[hsl(var(--danger))] hover:bg-[hsl(var(--danger)/0.2)] transition-colors focus-ring"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        )}
      </div>
    </header>
  );
}
