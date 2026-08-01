import {
  Bot,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Code2,
  FileCode2,
  FolderGit2,
  GitBranch,
  Languages,
  Moon,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

export const metadata = {
  title: "Codex Web UI — Safe Showcase",
  description: "A synthetic-data showcase for Codex Web UI screenshots.",
};

const sessions = [
  {
    title: "Build release dashboard",
    preview: "Implemented the overview cards and activity feed…",
    time: "now",
    active: true,
  },
  {
    title: "Refine empty states",
    preview: "Updated copy and keyboard navigation…",
    time: "12m",
  },
  {
    title: "Review API boundaries",
    preview: "Found two places to simplify the data flow…",
    time: "1h",
  },
  {
    title: "Add export command",
    preview: "Added JSON and Markdown export options…",
    time: "Tue",
  },
];

function SessionRow({
  title,
  preview,
  time,
  active,
}: {
  title: string;
  preview: string;
  time: string;
  active?: boolean;
}) {
  return (
    <div
      className={`group relative mx-2 rounded-lg px-3 py-2.5 ${
        active
          ? "bg-[hsl(var(--overlay)/0.08)] text-foreground"
          : "text-[hsl(var(--muted-foreground))]"
      }`}
    >
      {active && (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[hsl(var(--primary))]" />
      )}
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{title}</span>
        <span className="font-mono text-[9px] text-[hsl(var(--muted-foreground))]/60">
          {time}
        </span>
      </div>
      <p className="mt-1 truncate text-[10px] leading-4 text-[hsl(var(--muted-foreground))]/70">
        {preview}
      </p>
    </div>
  );
}

function TopMetric({ label, value, width, color = "primary" }: { label: string; value: string; width: string; color?: "primary" | "info" }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-end gap-1">
        <span className="font-mono text-[9px] text-[hsl(var(--muted-foreground))]">{label} {value}</span>
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[hsl(var(--overlay)/0.1)]">
          <div
            className={`h-full rounded-full ${color === "info" ? "bg-[hsl(var(--info))]" : "bg-[hsl(var(--primary))]"}`}
            style={{ width }}
          />
        </div>
      </div>
    </div>
  );
}

function CodeLine({ number, children, tone = "neutral" }: { number: number; children: React.ReactNode; tone?: "neutral" | "add" }) {
  return (
    <div className={`flex min-h-6 ${tone === "add" ? "bg-[hsl(var(--primary)/0.08)]" : ""}`}>
      <span className="w-9 shrink-0 select-none border-r border-[hsl(var(--overlay)/0.06)] pr-2 text-right text-[10px] text-[hsl(var(--muted-foreground))]/45">
        {number}
      </span>
      <span className={`w-6 shrink-0 text-center text-xs ${tone === "add" ? "text-[hsl(var(--primary))]" : "text-transparent"}`}>
        +
      </span>
      <code className="text-[11px] leading-6 text-foreground/75">{children}</code>
    </div>
  );
}

export default function ShowcasePage() {
  return (
    <main className="relative h-screen min-h-[720px] w-screen min-w-[1120px] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,hsl(var(--primary)/0.045),transparent_34%)]" />

      <div className="relative flex h-full">
        <aside className="flex h-full w-[278px] shrink-0 flex-col border-r border-[hsl(var(--overlay)/0.06)] bg-[hsl(var(--surface))]">
          <div className="flex h-12 items-center justify-between border-b border-[hsl(var(--overlay)/0.06)] px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.08)]">
                <Terminal className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
              </div>
              <span className="font-mono text-[13px] font-semibold tracking-tight">
                codex<span className="text-[hsl(var(--muted-foreground))]">-webui</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))]">
                <Moon className="h-3.5 w-3.5" />
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))]">
                <Languages className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>

          <div className="p-3">
            <button className="flex w-full items-center justify-center gap-2 rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--overlay)/0.05)] px-3 py-2 text-xs font-medium text-foreground/85">
              <Plus className="h-3.5 w-3.5" />
              New session
            </button>
          </div>

          <div className="px-3 pb-2">
            <div className="flex h-8 items-center gap-2 rounded-md border border-[hsl(var(--overlay)/0.07)] bg-background/40 px-2.5 text-[hsl(var(--muted-foreground))]">
              <Search className="h-3.5 w-3.5" />
              <span className="text-[10px]">Search conversations</span>
              <span className="ml-auto rounded border border-[hsl(var(--overlay)/0.08)] px-1 font-mono text-[8px]">⌘K</span>
            </div>
          </div>

          <div className="flex items-center justify-between px-4 pb-1.5 pt-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]/65">Recent</span>
            <MoreHorizontal className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]/55" />
          </div>
          <div className="space-y-0.5">
            {sessions.map((session) => (
              <SessionRow key={session.title} {...session} />
            ))}
          </div>

          <div className="mt-auto border-t border-[hsl(var(--overlay)/0.06)] p-3">
            <div className="rounded-lg border border-[hsl(var(--primary)/0.18)] bg-[hsl(var(--primary)/0.045)] p-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-[hsl(var(--primary))]">
                <ShieldCheck className="h-3.5 w-3.5" />
                SAFE SHOWCASE
              </div>
              <p className="mt-1.5 text-[9px] leading-4 text-[hsl(var(--muted-foreground))]">
                Fictional sessions, paths, commands, and code. No local Codex data is loaded.
              </p>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-[hsl(var(--overlay)/0.06)] bg-[hsl(var(--surface))] px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Circle className="h-2 w-2 fill-[hsl(var(--primary))] text-[hsl(var(--primary))]" />
                <span className="font-mono text-[10px] text-[hsl(var(--primary))]">completed</span>
              </div>
              <span className="h-4 w-px bg-[hsl(var(--overlay)/0.08)]" />
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                <FolderGit2 className="h-3 w-3" />
                ~/demo/aurora-notes
              </div>
              <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">gpt-5.4</span>
              <span className="rounded bg-[hsl(var(--overlay)/0.07)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">high</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 rounded-md bg-[hsl(var(--info)/0.1)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-[hsl(var(--info))]">
                <Zap className="h-2.5 w-2.5" /> demo plan
              </div>
              <TopMetric label="rate" value="18%" width="18%" color="info" />
              <TopMetric label="ctx" value="24%" width="24%" />
              <div className="flex items-center gap-2 font-mono text-[9px] text-[hsl(var(--muted-foreground))]">
                <span>↑12.4k</span>
                <span>↓2.1k</span>
              </div>
            </div>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="mx-auto flex h-full max-w-[920px] flex-col px-10 pb-4 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                    <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">feature/release-dashboard</span>
                  </div>
                  <h1 className="mt-1 text-[15px] font-semibold tracking-tight">Build release dashboard</h1>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.06)] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--primary))]">
                  <ShieldCheck className="h-3 w-3" /> synthetic data
                </div>
              </div>

              <div className="flex justify-end">
                <div className="max-w-[690px] rounded-xl rounded-br-sm bg-[hsl(var(--overlay)/0.08)] px-4 py-3 text-[12px] leading-5 text-foreground/90">
                  Create a compact release dashboard for Aurora Notes. Add summary cards, a recent activity panel, and clear empty states. Keep the layout keyboard-friendly and responsive.
                  <div className="mt-2 flex items-center justify-end gap-1.5 font-mono text-[8px] text-[hsl(var(--muted-foreground))]/65">
                    <Clock3 className="h-2.5 w-2.5" /> 10:42
                  </div>
                </div>
              </div>

              <div className="my-3 rounded-lg border border-[hsl(var(--overlay)/0.08)] bg-[hsl(var(--surface-2))]">
                <div className="flex items-center gap-2 px-3 py-2">
                  <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]/70" />
                  <Brain className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]/70" />
                  <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Thinking process</span>
                  <span className="truncate text-[10px] italic text-[hsl(var(--muted-foreground))]/55">Inspecting the existing layout and identifying reusable primitives…</span>
                  <span className="ml-auto shrink-0 text-[9px] text-[hsl(var(--muted-foreground))]/55">2 commands · 3 files</span>
                </div>
              </div>

              <div className="grid grid-cols-[0.88fr_1.12fr] gap-3">
                <div className="overflow-hidden rounded-lg border border-[hsl(var(--overlay)/0.08)] bg-[hsl(var(--surface))]">
                  <div className="flex h-8 items-center gap-2 border-b border-[hsl(var(--overlay)/0.06)] px-3">
                    <Terminal className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                    <span className="text-[10px] font-medium">Command</span>
                    <span className="ml-auto flex items-center gap-1 text-[9px] text-[hsl(var(--primary))]">
                      <Check className="h-3 w-3" /> exit 0
                    </span>
                  </div>
                  <div className="space-y-2 px-3 py-3 font-mono text-[10px]">
                    <div className="flex items-center gap-2 text-foreground/80">
                      <span className="text-[hsl(var(--primary))]">$</span>
                      npm run build
                    </div>
                    <div className="space-y-1 text-[hsl(var(--muted-foreground))]">
                      <p>✓ Compiled successfully</p>
                      <p>✓ Type checks passed</p>
                      <p>✓ Generated 8 routes</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-[hsl(var(--overlay)/0.08)] bg-[hsl(var(--surface))]">
                  <div className="flex h-8 items-center gap-2 border-b border-[hsl(var(--overlay)/0.06)] px-3">
                    <FileCode2 className="h-3.5 w-3.5 text-[hsl(var(--info))]" />
                    <span className="font-mono text-[10px]">app/dashboard/page.tsx</span>
                    <span className="ml-auto font-mono text-[9px] text-[hsl(var(--primary))]">+18</span>
                    <span className="font-mono text-[9px] text-[hsl(var(--danger))]">−2</span>
                  </div>
                  <div className="py-1 font-mono">
                    <CodeLine number={18}><span className="text-[#569cd6]">export default function</span> <span className="text-[#dcdcaa]">Dashboard</span>() {'{'}</CodeLine>
                    <CodeLine number={19} tone="add"><span className="text-[#c586c0]">return</span> &lt;<span className="text-[#4ec9b0]">ReleaseOverview</span></CodeLine>
                    <CodeLine number={20} tone="add">  project=<span className="text-[#ce9178]">&quot;Aurora Notes&quot;</span></CodeLine>
                    <CodeLine number={21} tone="add">  status=<span className="text-[#ce9178]">&quot;ready&quot;</span> /&gt;;</CodeLine>
                    <CodeLine number={22}>{'}'}</CodeLine>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-[hsl(var(--primary)/0.13)] bg-[hsl(var(--primary)/0.025)] px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[hsl(var(--primary)/0.1)]">
                    <Bot className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                  </div>
                  Done — the release dashboard is ready.
                  <span className="ml-auto flex items-center gap-1 font-mono text-[8px] font-normal text-[hsl(var(--muted-foreground))]">
                    <CheckCircle2 className="h-3 w-3 text-[hsl(var(--primary))]" /> 4 files changed
                  </span>
                </div>
                <div className="mt-2 pl-8 text-[11px] leading-5 text-foreground/75">
                  <p>Added responsive summary cards, recent activity, and accessible empty states.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Responsive layout', 'Keyboard navigation', 'Production build'].map((item) => (
                      <span key={item} className="rounded-md border border-[hsl(var(--overlay)/0.07)] bg-[hsl(var(--overlay)/0.035)] px-2 py-0.5 text-[9px] text-[hsl(var(--muted-foreground))]">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 px-6 pb-3">
            <div className="mx-auto max-w-[920px] rounded-xl border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface))] p-2 shadow-[0_14px_45px_hsl(var(--background)/0.45)]">
              <div className="flex min-h-11 items-center gap-2 px-2">
                <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                <span className="flex-1 text-[11px] text-[hsl(var(--muted-foreground))]">Ask Codex to make another change…</span>
                <button className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))]">
                  <Paperclip className="h-3.5 w-3.5" />
                </button>
                <button className="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 border-t border-[hsl(var(--overlay)/0.05)] px-2 pt-1.5 font-mono text-[8px] text-[hsl(var(--muted-foreground))]/70">
                <span>gpt-5.4</span><span>·</span><span>high</span><span>·</span><span>workspace-write</span>
                <ChevronDown className="h-2.5 w-2.5" />
                <span className="ml-auto flex items-center gap-1"><Code2 className="h-2.5 w-2.5" /> ~/demo/aurora-notes</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
