# Codex Web UI

A local web interface for the [OpenAI Codex CLI](https://github.com/openai/codex). Streams `codex exec --json` output into a browser timeline, replays historical sessions from `~/.codex/sessions/`, and renders file diffs — all on `127.0.0.1` for a single local user.

## Prerequisites

- **Node.js 18.18+** (Next.js 15 requirement)
- **Codex CLI** installed and authenticated:
  ```bash
  npm install -g @openai/codex
  codex login          # ChatGPT sign-in (recommended)
  # — or —
  $env:CODEX_API_KEY = "sk-..."   # API key (exec-only)
  ```
  Verify: `codex --version` prints a version.

## Quick start

```bash
npm install
npm run dev
# open http://127.0.0.1:3000
```

Production:

```bash
npm run build
npm start              # serves on 127.0.0.1:3000
```

Both `dev` and `start` bind to `127.0.0.1` only (no remote access).

## Features

| Area | What it does |
|---|---|
| **Streaming conversation** | Spawns `codex exec --json` and renders the JSONL event stream in real time (agent messages, reasoning, command execution, file changes, MCP tool calls, web search, plan updates, turn boundaries). |
| **Session replay** | Scans `~/.codex/sessions/` (including `.jsonl.zst` archives) and replays any past session with the same rendering pipeline as live streams. |
| **Resume** | Pick a historical session, type a new prompt — the next turn appends to the same timeline via `codex exec resume <id>`. |
| **Diff viewer** | `file_change` items open a full-screen unified-diff dialog with add/remove/context line coloring and line numbers. |
| **Config panel** | Model, sandbox mode (`read-only` / `workspace-write` / `danger-full-access`), approval policy (`never` / `on-failure` / `on-request` / `untrusted`), and working directory — persisted to `localStorage`. |
| **Virtual scrolling** | `@tanstack/react-virtual` with dynamic measurement keeps long sessions (hundreds of events) smooth. |
| **Abort** | Stop button (or closing the tab) aborts the fetch, kills the codex child process, and leaves the partial rollout on disk for resume. |

## How it works

```
Browser ──POST /api/exec──▶ Next.js Route Handler
                              │
                              ├─ resolve codex binary (binary.ts)
                              ├─ build argv (args.ts)
                              ├─ spawn codex exec --json (spawn.ts)
                              └─ stdout JSONL ──▶ SSE frames ──▶ Browser
                                                    │
                                                    └─ useReducer timeline

Browser ──GET /api/sessions/:id/events──▶ replay.ts
                                              │
                                              ├─ read rollout .jsonl[.zst]
                                              ├─ map items → item.completed events
                                              └─ SSE ──▶ same reducer as live
```

The backend never stores sessions itself — it reads codex's own rollout files directly, so there is exactly one source of truth.

## Configuration

### Environment variables (`.env.local`)

| Variable | Default | Purpose |
|---|---|---|
| `CODEX_BIN` | — | Absolute path to the codex executable. On Windows, prefer the real binary (not the `.cmd` shim). If unset, the app resolves `codex` from `PATH` and the npm global `node_modules`. |
| `CODEX_JS` | — | Absolute path to `@openai/codex/bin/codex.js` (the Node launcher). Useful when the native binary resolution fails. |
| `CODEX_HOME` | `~/.codex` | Override the codex home directory (where `sessions/` and `auth.json` live). |

### In-app preferences

Model, sandbox, approval policy, and the last working directory are saved to `localStorage` under `codex-webui-prefs` and shared across all UI panels via SWR.

## Architecture

```
app/
  api/
    exec/route.ts              POST → spawn codex, SSE stream
    sessions/route.ts          GET → list sessions
    sessions/[id]/route.ts     GET → session metadata
    sessions/[id]/events/route.ts  GET → replay SSE stream
    config/route.ts            GET → model/sandbox/approval enums
    fs/list/route.ts           GET → directory listing (cwd picker)
lib/
  codex/    binary · args · spawn · events
  rollout/  paths · reader (zstd) · list · replay · types
  server/   sse · config
  utils/    diff · format · cn
components/
  layout/   AppShell · Sidebar · TopBar
  session/  SessionView · EventTimeline (virtualized) · Composer · EmptyState
  events/   EventCard dispatcher + 10 typed cards
  diff/     DiffViewerDialog
  sessions/ SessionList · SessionListItem
  config/   ConfigPanel
  fs/       DirectoryPicker
hooks/      useExecStream · useReplayStream · useSessionList · useConfig
stores/     active-session.tsx (Context + useReducer state machine)
```

## Known limitations

- **No mid-turn approval.** `codex exec` runs autonomously with a pre-set sandbox/approval policy. The UI is view-only during a turn; set `approval-policy: on-request` if you want codex itself to pause (the UI will show the resulting turn failure, not an interactive prompt).
- **Windows `.cmd` shim.** If codex is installed via npm on Windows, the app prefers launching `codex.js` through `node` (platform-independent launcher) to avoid `.cmd` shim / `shell:true` security issues. If that fails, set `CODEX_BIN` to the real executable.
- **Single user.** No authentication, no multi-tenant isolation. Bind is `127.0.0.1` only.
- **Rollout read-only.** The UI never writes to `~/.codex/sessions/`; codex is the sole writer. Archived `.jsonl.zst` files (>7 days) are decompressed on the fly with `fzstd`.

## Troubleshooting

**`codex executable not found`** — Set `CODEX_BIN` to the absolute path of the codex binary, or ensure `codex` is on `PATH` and `codex --version` works in the same shell you use to start the dev server.

**`Model metadata for 'gpt-5-codex' not found`** — This is a codex CLI warning (shown as an error card in the timeline), not a Web UI issue. Run `codex` in a terminal directly to confirm; switch models in the config panel if needed.

**Hydration warnings in console** — `data-trae-ref` attributes injected by browser automation tooling can cause SSR/client attribute mismatch warnings. These are dev-only artifacts and do not affect production.

**Port 3000 in use** — Another process (often a stale dev server) holds the port. Kill it or run on a different port: `npx next dev -H 127.0.0.1 -p 3001`.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · SWR · @tanstack/react-virtual · react-markdown · fzstd · lucide-react
