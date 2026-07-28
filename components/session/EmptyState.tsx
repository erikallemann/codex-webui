"use client";

/**
 * EmptyState — 空状态欢迎页。
 *
 * 显示简介 + 快捷示例 prompt。
 */

import { Terminal, ArrowRight } from "lucide-react";
import { useConfig } from "@/hooks/useConfig";
import { useExecStream } from "@/hooks/useExecStream";

const EXAMPLES = [
  "Explain what this project does",
  "List files in the current directory",
  "Find all TODO comments in the codebase",
  "Write a unit test for the main module",
];

export function EmptyState() {
  const { prefs } = useConfig();
  const { run } = useExecStream();

  const sendExample = (prompt: string) => {
    if (!prefs?.cwd) return;
    run({
      prompt,
      cwd: prefs.cwd,
      model: prefs.model,
      sandbox: prefs.sandbox,
      approvalPolicy: prefs.approvalPolicy,
      skipGitRepoCheck: true,
    });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--overlay)/0.05)]">
        <Terminal className="h-6 w-6 text-[hsl(var(--primary))]" />
      </div>

      <h1 className="mb-2 text-xl font-semibold tracking-tight">
        Codex Web UI
      </h1>
      <p className="mb-1 text-base text-[hsl(var(--muted-foreground))]">
        A local interface for the Codex CLI agent.
      </p>
      <p className="mb-8 font-mono text-sm text-[hsl(var(--muted-foreground))]">
        Streaming · Session replay · File diffs · Config panel
      </p>

      {!prefs?.cwd ? (
        <div className="rounded-md border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.05)] px-4 py-3 text-sm text-[hsl(var(--accent))]">
          Set a working directory in the config panel below to begin.
        </div>
      ) : (
        <div className="w-full max-w-md space-y-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => sendExample(ex)}
              className="group flex w-full items-center justify-between rounded-md border border-[hsl(var(--overlay)/0.05)] bg-[hsl(var(--overlay)/0.02)] px-3 py-2 text-left text-sm text-foreground/70 hover:bg-[hsl(var(--overlay)/0.05)] hover:text-foreground transition-colors focus-ring"
            >
              <span className="truncate">{ex}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[hsl(var(--primary))]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
