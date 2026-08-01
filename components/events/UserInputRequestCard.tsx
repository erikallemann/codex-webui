"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Loader2, MessageCircleQuestion } from "lucide-react";
import type { UserInputRequestItem } from "@/types/api";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function UserInputRequestCard({ item }: { item: UserInputRequestItem }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(item.autoResolutionMs);

  useEffect(() => {
    if (item.autoResolutionMs == null) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setRemainingMs(Math.max(0, item.autoResolutionMs! - (Date.now() - startedAt)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [item.autoResolutionMs]);

  const isComplete = useMemo(
    () => item.questions.every((question) => {
      if (selected[question.id] === "__other__") return Boolean(custom[question.id]?.trim());
      if (question.options?.length) return Boolean(selected[question.id]);
      return Boolean(custom[question.id]?.trim());
    }),
    [custom, item.questions, selected],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isComplete || isSubmitting || submitted) return;
    const answers = Object.fromEntries(item.questions.map((question) => {
      const value = selected[question.id] === "__other__" || !question.options?.length
        ? custom[question.id].trim()
        : selected[question.id];
      return [question.id, [value]];
    }));

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/exec/respond", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interactionId: item.interactionId, answers }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="my-3 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/60 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/25">
      <div className="flex items-center justify-between gap-3 border-b border-blue-200/80 px-4 py-3 dark:border-blue-900/60">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-white">
            <MessageCircleQuestion className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("question.title")}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("question.subtitle")}</p>
          </div>
        </div>
        {remainingMs != null && !submitted && (
          <span className="shrink-0 rounded-full bg-white/80 px-2 py-1 font-mono text-[11px] text-slate-500 dark:bg-slate-900/60">
            {remainingMs > 0 ? `${Math.ceil(remainingMs / 1000)}s` : t("question.waiting")}
          </span>
        )}
      </div>

      <form onSubmit={submit} className="space-y-5 p-4">
        {item.questions.map((question) => (
          <fieldset key={question.id} disabled={submitted || isSubmitting} className="min-w-0">
            <legend className="mb-2 block w-full">
              <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{question.header}</span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{question.question}</span>
            </legend>

            {question.options?.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {question.options.map((option) => {
                  const active = selected[question.id] === option.label;
                  return (
                    <label key={option.label} className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border bg-white px-3 py-2.5 transition-colors dark:bg-slate-950/60",
                      active
                        ? "border-blue-500 ring-1 ring-blue-500/30"
                        : "border-slate-200 hover:border-blue-300 dark:border-slate-800 dark:hover:border-blue-800",
                    )}>
                      <input
                        type="radio"
                        className="sr-only"
                        name={question.id}
                        checked={active}
                        onChange={() => setSelected((value) => ({ ...value, [question.id]: option.label }))}
                      />
                      <span className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                        active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 dark:border-slate-600",
                      )}>
                        {active && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{option.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
                {question.isOther && (
                  <label className={cn(
                    "rounded-lg border bg-white px-3 py-2.5 sm:col-span-2 dark:bg-slate-950/60",
                    selected[question.id] === "__other__" ? "border-blue-500 ring-1 ring-blue-500/30" : "border-slate-200 dark:border-slate-800",
                  )}>
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                      <input
                        type="radio"
                        name={question.id}
                        checked={selected[question.id] === "__other__"}
                        onChange={() => setSelected((value) => ({ ...value, [question.id]: "__other__" }))}
                      />
                      {t("question.other")}
                    </span>
                    {selected[question.id] === "__other__" && (
                      <input
                        autoFocus
                        type={question.isSecret ? "password" : "text"}
                        value={custom[question.id] ?? ""}
                        onChange={(event) => setCustom((value) => ({ ...value, [question.id]: event.target.value }))}
                        className="mt-2 w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700"
                        placeholder={t("question.placeholder")}
                      />
                    )}
                  </label>
                )}
              </div>
            ) : (
              <textarea
                rows={3}
                value={custom[question.id] ?? ""}
                onChange={(event) => setCustom((value) => ({ ...value, [question.id]: event.target.value }))}
                className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 dark:border-slate-800 dark:bg-slate-950/60"
                placeholder={t("question.placeholder")}
              />
            )}
          </fieldset>
        ))}

        <div className="flex items-center justify-between gap-3 border-t border-blue-200/70 pt-3 dark:border-blue-900/60">
          <p className="min-w-0 text-xs text-red-600 dark:text-red-400">{error}</p>
          <button
            type="submit"
            disabled={!isComplete || isSubmitting || submitted}
            className="ml-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {submitted && <Check className="size-4" />}
            {submitted ? t("question.submitting") : t("question.submit")}
          </button>
        </div>
      </form>
    </section>
  );
}
