# Codex Web UI

<p align="center">
  <img src="./logo/codex-color.svg" width="120" alt="Codex logo" />
</p>

A lightweight, local graphical interface for the [OpenAI Codex CLI](https://github.com/openai/codex). It brings Codex CLI conversations, session history, configuration, and file diffs into the browser while keeping Codex CLI as the underlying engine. Everything runs on `127.0.0.1` for a single local user.

[中文文档](./README.zh-CN.md) · [Development Guide](./DEVELOPMENT.md)

Upstream project: [openai/codex](https://github.com/openai/codex)

---

## Preview

![Codex Web UI safe showcase](./docs/showcase.png)

This image is captured from `/showcase`, where the production `AppShell` and its real UI components run against an isolated synthetic data layer. The fixture includes three temporary projects and three non-project conversations; it does not read local sessions, invoke Codex CLI, access the real filesystem, or send requests to backend API routes.

## Why

The Codex CLI is powerful, but working entirely in a terminal is not always the most convenient way to follow long tasks or revisit earlier sessions. This project provides a lightweight browser-based GUI on top of Codex CLI so you can:

- Watch streaming conversations with rich rendering (Markdown, syntax-highlighted code, LaTeX, unified diffs)
- Browse and replay any past session — including 7-day-old `.jsonl.zst` archives
- Resume a finished session with a new prompt
- Tune model / reasoning effort / sandbox / approval policy visually, per session
- Navigate long sessions fast with virtualized scrolling and per-message navigation

It runs entirely locally. No server to deploy, no auth, no remote access — the dev and production servers bind to `127.0.0.1` only.

## Features

| Area | What it does |
|---|---|
| **Streaming conversation** | Connects to `codex app-server` over JSON-RPC and maps notifications to SSE in real time — agent messages, reasoning, command execution, file changes, MCP tool calls, web search, plan updates, and turn boundaries. |
| **Session replay** | Scans `~/.codex/sessions/` and `~/.codex/archived_sessions/` (including `.jsonl.zst` archives) and replays any past session through the same rendering pipeline as live streams. |
| **Resume** | Pick a historical session, type a new prompt — the next app-server turn appends to the same timeline. |
| **Diff viewer** | `file_change` items open a full-screen unified-diff dialog with add/remove/context line coloring, double line numbers, syntax highlighting, and one-click patch copy. |
| **Config panel** | Model, reasoning effort, collaboration mode (`Default` / `Plan`), sandbox, approval policy, and working directory — persisted per session in `localStorage`. |
| **Interactive questions** | In Plan mode, structured `request_user_input` questions render as option/text cards; submitting an answer resumes the same turn through `/api/exec/respond`. |
| **User attachments** | Image inputs appear as compact thumbnails above the message bubble with full-screen preview; other files use a compact filename/path card. Codex-injected file and browser metadata is hidden from the visible message. |
| **Slash commands** | 15 codex CLI commands (`/approvals`, `/architect`, `/clear`, `/compact`, `/diff`, `/goal`, `/help`, `/init`, `/mode`, `/model`, `/plan`, `/review`, `/sandbox`, `/skills`, `/status`) with an autocomplete menu triggered by `/`. |
| **Skills `@` completion** | Scan `~/.codex/skills/` and enabled plugins, insert skill references via `@`. |
| **Conversation navigation** | A vertical dot rail on the left maps to each user message; hover for a preview tooltip, click to jump. The active dot auto-highlights as you scroll. |
| **Collapsible thinking process** | Continuous intermediate events (reasoning / command / file / search / mcp / plan) merge into a single collapsible block with a summary preview and action count. |
| **Code highlighting** | Token colors match VSCode Dark+ / Light+ themes, verified for keywords, functions, strings, numbers, built-ins, and parameters. |
| **Response images** | Markdown images use bounded, theme-aware rendering. Local images under `~/.codex/visualizations/` are served through a guarded read-only endpoint; blocked or missing images show a compact fallback instead of a broken element. |
| **Virtual scrolling** | `@tanstack/react-virtual` with dynamic measurement keeps long sessions (hundreds of events) smooth. |
| **Abort** | Stop button (or closing the tab) aborts the fetch, kills the codex child process, and leaves the partial rollout on disk for resume. |
| **Light / dark theme** | Follows the system by default, with a persistent manual light/dark/system toggle. |
| **Interface language** | Follows the system by default, with Simplified Chinese and English overrides. The compact language menu applies immediately, persists in `localStorage`, and updates the document language. |

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
git clone https://github.com/<your-org>/codex-webui.git
cd codex-webui
npm install
npm run dev
# open http://127.0.0.1:3000
```

Production:

```bash
npm run build
npm start              # serves on 127.0.0.1:3000
```

Both `dev` and `start` bind to `127.0.0.1` only — there is no remote access.

## How it works

```
Browser ──POST /api/exec──▶ Next.js Route Handler
                              │
                              ├─ spawn codex app-server (stdio JSON-RPC)
                              ├─ thread/start or thread/resume + turn/start
                              ├─ notifications ──▶ SSE ──▶ useReducer timeline
                              └─ requestUserInput ◀── POST /api/exec/respond

Browser ──GET /api/sessions/:id/events──▶ replay.ts
                                              │
                                              ├─ read rollout .jsonl[.zst]
                                              ├─ map items → item.completed events
                                              └─ SSE ──▶ same reducer as live
```

The backend never stores sessions itself — it reads codex's own rollout files directly, so there is exactly one source of truth. Live streams and replays feed the same reducer, so the rendering is identical.

### Binary resolution

The app resolves the codex binary in this order:

1. `CODEX_BIN` env var (absolute path to the executable)
2. `CODEX_JS` env var (absolute path to `@openai/codex/bin/codex.js`)
3. npm global `@openai/codex/bin/codex.js` launched via `node` (platform-independent, avoids Windows `.cmd` shim / `shell:true` injection risks)
4. `codex` resolved from `PATH` (fallback)

On Windows, the Node launcher is preferred over the `.cmd` shim for security.

## Configuration

### Environment variables (`.env.local`)

| Variable | Default | Purpose |
|---|---|---|
| `CODEX_BIN` | — | Absolute path to the codex executable. On Windows, prefer the real binary (not the `.cmd` shim). |
| `CODEX_JS` | — | Absolute path to `@openai/codex/bin/codex.js` (the Node launcher). Useful when native binary resolution fails. |
| `CODEX_HOME` | `~/.codex` | Override the codex home directory (where `sessions/`, `archived_sessions/`, `auth.json`, and `skills/` live). |

### In-app preferences

Model, reasoning effort, collaboration mode, sandbox, approval policy, and the working directory are saved per session to `localStorage` under `codex-webui-prefs-v3` and shared across all UI panels via SWR. The interface language is stored independently under `codex-webui-language` as `system`, `zh-CN`, or `en`.

## Known limitations

- **Structured questions require Plan mode.** Codex exposes `request_user_input` in Plan mode; Default mode executes tasks directly. Permission approvals are routed to Codex's automatic reviewer rather than rendered as user cards.
- **Windows `.cmd` shim.** If codex is installed via npm on Windows, the app prefers launching `codex.js` through `node` to avoid `.cmd` shim / `shell:true` security issues. If that fails, set `CODEX_BIN` to the real executable.
- **Single user.** No authentication, no multi-tenant isolation. Bind is `127.0.0.1` only.
- **Rollout read-only.** The UI never writes to `~/.codex/sessions/`; codex is the sole writer. Archived `.jsonl.zst` files (>7 days) are decompressed on the fly with `fzstd`.

## Troubleshooting

**`codex executable not found`** — Set `CODEX_BIN` to the absolute path of the codex binary, or ensure `codex` is on `PATH` and `codex --version` works in the same shell you use to start the dev server.

**`Model metadata for 'gpt-5-codex' not found`** — This is a codex CLI warning (shown as an error card in the timeline), not a Web UI issue. Run `codex` in a terminal directly to confirm; switch models in the config panel if needed.

**Hydration warnings in console** — `data-trae-ref` attributes injected by browser automation tooling can cause SSR/client attribute mismatch warnings. These are dev-only artifacts and do not affect production.

**Port 3000 in use** — Another process (often a stale dev server) holds the port. Kill it or run on a different port: `npx next dev -H 127.0.0.1 -p 3001`.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · SWR · @tanstack/react-virtual · react-markdown · rehype-highlight · KaTeX · fzstd · lucide-react · next-themes

## Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for the project architecture, directory layout, conventions, and guides for extending the app (adding event types, slash commands, etc.).

## License

[MIT](./LICENSE)
