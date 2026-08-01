import type {
  ConfigResponse,
  ExecRequest,
  FsListResponse,
  RateLimits,
  SessionMeta,
  SkillInfo,
  SseEvent,
  ThreadItem,
  Usage,
  UsageSnapshot,
} from "@/types/api";

export const SHOWCASE_DEFAULT_SESSION_ID = "showcase-aurora-release";

const DEMO_ROOT = "C:\\Demo";

const usage: Usage = {
  input_tokens: 12_480,
  cached_input_tokens: 8_120,
  cache_write_input_tokens: 0,
  output_tokens: 2_340,
  reasoning_output_tokens: 860,
};

const rateLimits: RateLimits = {
  limitId: "showcase",
  primary: { usedPercent: 18, windowMinutes: 300, resetsAt: 1_785_600_000 },
  secondary: null,
  credits: { hasCredits: true, unlimited: false, balance: "demo" },
  planType: "demo",
  rateLimitReachedType: null,
};

function session(
  id: string,
  preview: string,
  cwd: string,
  updatedAt: string,
  gitBranch?: string,
): ThreadItem {
  return {
    id,
    preview,
    cwd,
    createdAt: "2026-08-01T08:00:00.000Z",
    updatedAt,
    source: "showcase",
    cliVersion: "0.80.0-demo",
    modelProvider: "openai",
    gitBranch,
    path: `${DEMO_ROOT}\\Rollouts\\${id}.jsonl`,
    compressed: false,
  };
}

export const SHOWCASE_SESSIONS: ThreadItem[] = [
  session(
    SHOWCASE_DEFAULT_SESSION_ID,
    "Build a compact release dashboard with summary cards and activity history",
    `${DEMO_ROOT}\\Projects\\Aurora Notes`,
    "2026-08-01T14:42:00.000Z",
    "feature/release-dashboard",
  ),
  session(
    "showcase-aurora-keyboard",
    "Improve keyboard navigation and empty states across the dashboard",
    `${DEMO_ROOT}\\Projects\\Aurora Notes`,
    "2026-08-01T13:16:00.000Z",
    "feature/accessibility",
  ),
  session(
    "showcase-ledger-export",
    "Add CSV export and validation to the monthly expense report",
    `${DEMO_ROOT}\\Projects\\Pocket Ledger`,
    "2026-08-01T12:05:00.000Z",
    "feature/csv-export",
  ),
  session(
    "showcase-trail-offline",
    "Design an offline-ready trail summary and sync status component",
    `${DEMO_ROOT}\\Projects\\Trail Map`,
    "2026-07-31T16:20:00.000Z",
    "feature/offline-summary",
  ),
  session(
    "showcase-chat-release-notes",
    "Draft concise release notes for a small desktop application",
    "C:\\Users\\Demo\\Documents\\Codex\\2026-08-01\\release-notes",
    "2026-08-01T11:45:00.000Z",
  ),
  session(
    "showcase-chat-api-review",
    "Explain the trade-offs between REST pagination strategies",
    "C:\\Users\\Demo\\Documents\\Codex\\2026-08-01\\api-review",
    "2026-08-01T10:22:00.000Z",
  ),
  session(
    "showcase-chat-checklist",
    "Create a pre-release quality checklist for a web application",
    "C:\\Users\\Demo\\Documents\\Codex\\2026-07-31\\quality-checklist",
    "2026-07-31T15:10:00.000Z",
  ),
];

export const SHOWCASE_CONFIG: ConfigResponse = {
  models: [
    {
      value: "gpt-5.4",
      label: "gpt-5.4",
      description: "Showcase model",
      contextWindow: 128_000,
      defaultEffort: "high",
      supportedEfforts: ["low", "medium", "high", "xhigh"],
    },
    {
      value: "gpt-5.4-mini",
      label: "gpt-5.4-mini",
      description: "Fast showcase model",
      contextWindow: 64_000,
      defaultEffort: "medium",
      supportedEfforts: ["low", "medium", "high"],
    },
  ],
  efforts: [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "xhigh", label: "Extra high" },
  ],
  sandboxes: ["read-only", "workspace-write", "danger-full-access"],
  approvals: ["never", "on-failure", "on-request", "untrusted"],
  defaults: {
    model: "gpt-5.4",
    effort: "high",
    sandbox: "workspace-write",
    approvalPolicy: "on-request",
  },
};

export const SHOWCASE_SKILLS: SkillInfo[] = [
  {
    name: "frontend-design",
    description: "Build polished production interfaces",
    source: "system",
    dirName: "frontend-design",
  },
  {
    name: "code-review",
    description: "Review code changes for correctness",
    source: "system",
    dirName: "code-review",
  },
];

interface ConversationCopy {
  user: string;
  reasoning: string;
  command: string;
  output: string;
  file: string;
  summary: string;
  details: string;
}

const conversationCopy: Record<string, ConversationCopy> = {
  [SHOWCASE_DEFAULT_SESSION_ID]: {
    user: "Create a compact release dashboard for Aurora Notes. Add summary cards, recent activity, and accessible empty states.",
    reasoning: "I’ll inspect the current dashboard structure, reuse the existing card primitives, and keep the new layout responsive without changing the data model.",
    command: "npm run build",
    output: "✓ Compiled successfully\n✓ Type checks passed\n✓ Generated 8 routes",
    file: "app/dashboard/page.tsx",
    summary: "Implemented the release dashboard and verified the production build.",
    details: "Added responsive summary cards, a recent activity panel, and keyboard-friendly empty states. The existing visual tokens and component boundaries remain unchanged.",
  },
  "showcase-aurora-keyboard": {
    user: "Improve keyboard navigation and empty states across the Aurora Notes dashboard.",
    reasoning: "I’ll audit focus order and visible focus styles, then consolidate the empty-state copy into the existing component.",
    command: "npm run lint",
    output: "✓ No accessibility warnings\n✓ Focus order verified",
    file: "components/dashboard/EmptyState.tsx",
    summary: "Improved focus navigation and dashboard empty states.",
    details: "Added semantic labels, predictable tab order, and clearer recovery actions for empty dashboard sections.",
  },
  "showcase-ledger-export": {
    user: "Add CSV export and validation to the monthly expense report.",
    reasoning: "I’ll keep formatting separate from the report query and validate spreadsheet-safe output at the export boundary.",
    command: "npm test -- export",
    output: "✓ 12 export cases passed\n✓ Formula injection cases escaped",
    file: "lib/reports/export-csv.ts",
    summary: "Added safe CSV export for monthly reports.",
    details: "The exporter now validates columns, escapes spreadsheet formulas, and produces deterministic filenames.",
  },
  "showcase-trail-offline": {
    user: "Design an offline-ready trail summary and sync status component.",
    reasoning: "I’ll derive display state from the existing sync model and avoid introducing another network state machine.",
    command: "npm run typecheck",
    output: "✓ Types valid\n✓ Offline fixtures rendered",
    file: "components/trails/OfflineSummary.tsx",
    summary: "Created an offline trail summary using the existing sync state.",
    details: "The component distinguishes cached, pending, and synced data while remaining readable without a connection.",
  },
  "showcase-chat-release-notes": {
    user: "Draft concise release notes for a small desktop application.",
    reasoning: "I’ll organize the notes around user-visible outcomes and keep implementation details in a short technical section.",
    command: "review release-notes.md",
    output: "✓ Tone consistent\n✓ No internal identifiers found",
    file: "release-notes.md",
    summary: "Drafted release notes with clear user-facing sections.",
    details: "The notes cover highlights, fixes, upgrade guidance, and known limitations in a concise format.",
  },
  "showcase-chat-api-review": {
    user: "Explain the trade-offs between REST pagination strategies.",
    reasoning: "I’ll compare offset, cursor, and keyset pagination by consistency, implementation cost, and client ergonomics.",
    command: "compare pagination options",
    output: "✓ Offset\n✓ Cursor\n✓ Keyset",
    file: "notes/pagination.md",
    summary: "Compared REST pagination strategies and recommended cursor pagination.",
    details: "Cursor pagination offers the best balance for frequently changing datasets; offset remains appropriate for small administrative views.",
  },
  "showcase-chat-checklist": {
    user: "Create a pre-release quality checklist for a web application.",
    reasoning: "I’ll group checks by release risk so the list stays actionable during a short release window.",
    command: "validate checklist sections",
    output: "✓ Product\n✓ Accessibility\n✓ Reliability\n✓ Rollback",
    file: "quality-checklist.md",
    summary: "Created a focused pre-release quality checklist.",
    details: "The checklist includes functional smoke tests, accessibility, monitoring, security, and rollback readiness.",
  },
};

function metaFor(thread: ThreadItem): SessionMeta {
  return {
    session_id: thread.id,
    id: thread.id,
    timestamp: thread.createdAt,
    cwd: thread.cwd,
    originator: "codex-webui-showcase",
    cli_version: thread.cliVersion,
    source: "showcase",
    thread_source: "showcase",
    model_provider: "openai",
    git_branch: thread.gitBranch,
    git_sha: "0000000000000000000000000000000000000000",
    git_origin_url: "https://example.invalid/showcase/repository.git",
  };
}

function eventsFor(thread: ThreadItem): SseEvent[] {
  const copy = conversationCopy[thread.id];
  const timestamp = thread.updatedAt;
  const startedAt = Math.floor(new Date(thread.updatedAt).getTime() / 1000) - 38;
  return [
    { type: "session.meta", meta: metaFor(thread) },
    { type: "rate_limits.updated", rateLimits },
    { type: "turn.started", startedAt },
    {
      type: "item.completed",
      timestamp,
      item: { id: `${thread.id}-user`, type: "user_message", text: copy.user },
    },
    {
      type: "item.completed",
      timestamp,
      item: { id: `${thread.id}-reasoning`, type: "reasoning", text: copy.reasoning },
    },
    {
      type: "item.completed",
      timestamp,
      item: {
        id: `${thread.id}-command`,
        type: "command_execution",
        command: copy.command,
        cwd: thread.cwd,
        aggregated_output: copy.output,
        exit_code: 0,
        status: "completed",
      },
    },
    {
      type: "item.completed",
      timestamp,
      item: {
        id: `${thread.id}-file`,
        type: "file_change",
        change: "edit",
        path: `${thread.cwd}\\${copy.file}`,
        patch: `--- a/${copy.file}\n+++ b/${copy.file}\n@@ -1,3 +1,5 @@\n export function feature() {\n+  const status = "ready";\n+  return status;\n }`,
      },
    },
    {
      type: "item.completed",
      timestamp,
      item: {
        id: `${thread.id}-agent`,
        type: "agent_message",
        text: `### ${copy.summary}\n\n${copy.details}\n\n- Production components reused\n- Validation completed\n- No external data accessed`,
      },
    },
    {
      type: "turn.completed",
      usage,
      startedAt,
      completedAt: startedAt + 38,
      durationMs: 38_000,
    },
    {
      type: "usage.updated",
      snapshot: usageSnapshot(thread.updatedAt),
    },
  ];
}

export const SHOWCASE_EVENTS = Object.fromEntries(
  SHOWCASE_SESSIONS.map((thread) => [thread.id, eventsFor(thread)]),
) as Record<string, SseEvent[]>;

export function usageSnapshot(updatedAt = "2026-08-01T14:42:00.000Z"): UsageSnapshot {
  return {
    totalUsage: usage,
    lastUsage: usage,
    contextTokens: usage.input_tokens,
    contextWindow: 128_000,
    rateLimits,
    updatedAt,
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function sse(events: SseEvent[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}

function fsResponse(pathname: string): FsListResponse {
  const normalized = pathname || DEMO_ROOT;
  if (normalized === DEMO_ROOT) {
    return {
      path: DEMO_ROOT,
      parent: null,
      entries: [
        { name: "Projects", isDir: true },
        { name: "Scratch", isDir: true },
      ],
    };
  }
  if (normalized.toLowerCase().endsWith("projects")) {
    return {
      path: `${DEMO_ROOT}\\Projects`,
      parent: DEMO_ROOT,
      entries: [
        { name: "Aurora Notes", isDir: true },
        { name: "Pocket Ledger", isDir: true },
        { name: "Trail Map", isDir: true },
      ],
    };
  }
  return {
    path: normalized,
    parent: normalized === DEMO_ROOT ? null : `${DEMO_ROOT}\\Projects`,
    entries: [],
  };
}

function execEvents(request: ExecRequest): SseEvent[] {
  const id = request.resumeSessionId || "showcase-live-session";
  const timestamp = new Date().toISOString();
  const startedAt = Math.floor(Date.now() / 1000);
  const meta: SessionMeta = {
    session_id: id,
    id,
    timestamp,
    cwd: request.cwd,
    source: "showcase",
    originator: "codex-webui-showcase",
    model_provider: "openai",
  };
  return [
    { type: "session.meta", meta },
    { type: "thread.started", thread_id: id },
    { type: "turn.started", startedAt },
    {
      type: "item.completed",
      timestamp,
      item: { id: `${id}-live-user`, type: "user_message", text: request.prompt },
    },
    {
      type: "item.completed",
      timestamp,
      item: {
        id: `${id}-live-reasoning`,
        type: "reasoning",
        text: "This is an isolated showcase turn. I’ll demonstrate the production timeline without contacting Codex CLI or the filesystem.",
      },
    },
    {
      type: "item.completed",
      timestamp,
      item: {
        id: `${id}-live-agent`,
        type: "agent_message",
        text: "Showcase response completed. The prompt stayed entirely inside the synthetic demo environment.",
      },
    },
    {
      type: "turn.completed",
      usage: { ...usage, input_tokens: 820, output_tokens: 96 },
      startedAt,
      completedAt: startedAt + 1,
      durationMs: 1_000,
    },
  ];
}

export function createShowcaseFetch(originalFetch: typeof fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = new URL(rawUrl, window.location.origin);

    if (url.origin !== window.location.origin) {
      return json({ error: "external requests are disabled in showcase mode" }, 403);
    }
    if (!url.pathname.startsWith("/api/")) {
      return originalFetch(input, init);
    }

    if (url.pathname === "/api/config") return json(SHOWCASE_CONFIG);
    if (url.pathname === "/api/skills") return json({ skills: SHOWCASE_SKILLS });
    if (url.pathname === "/api/sessions") {
      const cwd = url.searchParams.get("cwd")?.toLowerCase();
      const query = url.searchParams.get("q")?.toLowerCase();
      const items = SHOWCASE_SESSIONS.filter((thread) => {
        if (cwd && thread.cwd.toLowerCase() !== cwd) return false;
        if (query && !`${thread.preview} ${thread.cwd}`.toLowerCase().includes(query)) return false;
        return true;
      });
      return json({ items });
    }
    if (url.pathname === "/api/fs/list") {
      return json(fsResponse(url.searchParams.get("path") || DEMO_ROOT));
    }
    if (url.pathname === "/api/exec/respond") return json({ ok: true });
    if (url.pathname === "/api/exec") {
      const request = JSON.parse(String(init?.body || "{}")) as ExecRequest;
      return sse(execEvents(request));
    }

    const eventMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/events$/);
    if (eventMatch) {
      const sessionId = decodeURIComponent(eventMatch[1]);
      const events = SHOWCASE_EVENTS[sessionId];
      return events ? sse(events) : json({ error: "showcase session not found" }, 404);
    }
    const usageMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/usage$/);
    if (usageMatch) {
      const sessionId = decodeURIComponent(usageMatch[1]);
      return json({ sessionId, snapshot: usageSnapshot() });
    }

    return json({ error: "API route is disabled in showcase mode" }, 404);
  };
}
