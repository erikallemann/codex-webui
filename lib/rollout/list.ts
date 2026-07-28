/**
 * 会话列表扫描。
 *
 * 递归扫描 ~/.codex/sessions/ 与 archived_sessions/，对每个 rollout 文件：
 * - 读取首行 session_meta 提取元数据
 * - 读取前 N 行找首条用户消息作 preview
 * - 结合文件名时间戳与 mtime 组装 ThreadItem
 *
 * 支持 cwd 过滤、关键词搜索；上限 10000 文件。
 */

import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { ThreadItem, SessionMeta } from "@/types/api";
import {
  sessionsRoot,
  archivedSessionsRoot,
  isRolloutFile,
  isCompressed,
  parseSessionIdFromFilename,
  parseTimestampFromFilename,
  fileMtime,
} from "./paths";
import { readFirstLine, readLinesUntil } from "./reader";
import type { RolloutLine } from "./types";
import { loadSessionIndex } from "./session-index";

export interface ListOptions {
  /** 按 cwd 过滤（仅返回该目录下的会话） */
  cwd?: string;
  /** 关键词搜索（匹配 preview） */
  q?: string;
  /** 返回上限 */
  limit?: number;
}

/** 列出所有会话（按更新时间降序） */
export async function listSessions(opts: ListOptions = {}): Promise<ThreadItem[]> {
  const roots = [sessionsRoot(), archivedSessionsRoot()];
  const files: string[] = [];

  for (const root of roots) {
    try {
      walkDir(root, files);
    } catch {
      // 目录不存在或无权限，跳过
    }
    if (files.length > 10000) break;
  }

  // 预加载 session_index.jsonl（session_id → thread_name）
  const indexMap = await loadSessionIndex();

  const items: ThreadItem[] = [];
  for (const file of files) {
    const item = await buildThreadItem(file, indexMap);
    if (item) items.push(item);
  }

  // 排序：updatedAt 降序
  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // 过滤
  let filtered = items;
  if (opts.cwd) {
    const cwdNorm = path.resolve(opts.cwd).toLowerCase();
    filtered = filtered.filter((it) => it.cwd.toLowerCase() === cwdNorm);
  }
  if (opts.q) {
    const q = opts.q.toLowerCase();
    filtered = filtered.filter(
      (it) => it.preview.toLowerCase().includes(q) || it.cwd.toLowerCase().includes(q),
    );
  }

  const limit = opts.limit ?? 200;
  return filtered.slice(0, limit);
}

/** 递归收集 rollout 文件 */
function walkDir(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkDir(full, out);
    } else if (isRolloutFile(entry)) {
      out.push(full);
    }
  }
}

/** 从单个 rollout 文件构建 ThreadItem */
async function buildThreadItem(
  filePath: string,
  indexMap?: Map<string, string>,
): Promise<ThreadItem | null> {
  const name = path.basename(filePath);
  const sessionId = parseSessionIdFromFilename(name);
  if (!sessionId) return null;

  // 读取首行 meta
  const firstLine = await readFirstLine(filePath);
  if (!firstLine || firstLine.type !== "session_meta") return null;

  const meta = firstLine.payload as SessionMeta;

  // 过滤子代理会话（guardian / thread_spawn 等），这些不是用户发起的正常对话
  if (isSubagentSource(meta.source)) return null;

  // 标题优先级：session_index.jsonl 的 thread_name > 首条用户消息 preview
  const threadName = indexMap?.get(sessionId);
  const preview = threadName ?? (await extractPreview(filePath)) ?? "(empty session)";

  const filenameTs = parseTimestampFromFilename(name);
  const createdAt = meta.timestamp || filenameTs || fileMtime(filePath);
  const updatedAt = fileMtime(filePath);

  return {
    id: sessionId,
    preview,
    cwd: meta.cwd || "",
    createdAt,
    updatedAt,
    source: typeof meta.source === "string" ? meta.source : undefined,
    cliVersion: meta.cli_version,
    modelProvider: meta.model_provider,
    gitBranch: meta.git_branch,
    path: filePath,
    compressed: isCompressed(name),
  };
}

/**
 * 判断 source 是否为子代理会话。
 *
 * 正常会话 source 为字符串："exec" / "cli" / "vscode" 等。
 * 子代理会话 source 为对象：{"subagent":{"other":"guardian"}} 或 {"subagent":{"thread_spawn":{...}}}。
 */
function isSubagentSource(source: unknown): boolean {
  if (!source) return false;
  if (typeof source === "string") return false;
  if (typeof source === "object" && source !== null) {
    return "subagent" in source;
  }
  return false;
}

/** 系统注入消息前缀：这些内容不是用户真实输入，跳过 */
const SYSTEM_INJECTION_PREFIXES = [
  "<recommended_plugins>",
  "# AGENTS.md",
  "# agents.md",
  "<INSTRUCTIONS>",
  "<!-- fastctx",
  "<environment_context>",
  "<user_environment>",
  "The following is the Codex agent history",
  "You are an automated reviewer",
  "<agent_history>",
];

/** 判断文本是否为系统注入（AGENTS.md / recommended_plugins / environment 等） */
function isSystemInjection(text: string): boolean {
  const t = text.trimStart();
  if (!t) return true;
  return SYSTEM_INJECTION_PREFIXES.some((p) => t.startsWith(p));
}

/**
 * 从系统注入文本中提取可读标题。
 *
 * - "# AGENTS.md instructions for <path>" → 项目名
 * - "The following is the Codex agent history..." → "代码审查"
 * - "<recommended_plugins>..." → null（跳过）
 * - 其他 → null
 */
function extractTitleFromInjection(text: string): string | null {
  const t = text.trimStart();

  // AGENTS.md 注入：提取项目路径最后一段作为标题
  const agentsMatch = t.match(/^#\s+AGENTS\.md\s+instructions\s+for\s+(.+)/i);
  if (agentsMatch) {
    const rawPath = agentsMatch[1].split(/\s+<|$/)[0].trim();
    const parts = rawPath.split(/[\\/]/);
    const projectName = parts[parts.length - 1] || parts[parts.length - 2];
    return projectName ? `${projectName}` : null;
  }

  // 审查/reviewer 会话
  if (t.startsWith("The following is the Codex agent history")) {
    return "代码审查";
  }
  if (t.startsWith("You are an automated reviewer")) {
    return "自动审查";
  }

  return null;
}

/** 提取首条真实用户消息作为预览文本（跳过 AGENTS.md / recommended_plugins 等系统注入） */
async function extractPreview(filePath: string): Promise<string | null> {
  // 收集前 N 行中的所有用户消息，再从中筛选第一条非系统注入的
  const lines = await readLinesUntil(filePath, () => false, 150);

  const userTexts: string[] = [];
  for (const line of lines) {
    if (line.type === "event_msg") {
      const p = line.payload as { type?: string; message?: string; text?: string };
      if (p.type === "user_message") {
        const text = p.message || p.text || "";
        if (text) userTexts.push(text);
      }
    }
    if (line.type === "response_item") {
      const p = line.payload as {
        type?: string;
        role?: string;
        content?: Array<{ type?: string; text?: string }>;
      };
      if (p.type === "message" && p.role === "user") {
        const text = p.content
          ?.filter((c) => c.type === "input_text" || c.type === "text")
          .map((c) => c.text || "")
          .join("\n");
        if (text) userTexts.push(text);
      }
    }
  }

  // 优先返回第一条非系统注入的用户消息
  for (const text of userTexts) {
    if (!isSystemInjection(text)) {
      return truncate(text);
    }
  }

  // 全部都是系统注入：尝试从注入文本中提取可读标题
  for (const text of userTexts) {
    const title = extractTitleFromInjection(text);
    if (title) return title;
  }

  // 无法提取任何有用信息
  return null;
}

function truncate(s: string, max = 120): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > max ? t.slice(0, max) + "…" : t;
}

/** 获取会话元数据（不含 preview） */
export async function getSessionMeta(sessionId: string): Promise<{
  meta: SessionMeta;
  path: string;
} | null> {
  const { findRolloutFile } = await import("./paths");
  const filePath = findRolloutFile(sessionId);
  if (!filePath) return null;

  const firstLine = await readFirstLine(filePath);
  if (!firstLine || firstLine.type !== "session_meta") return null;

  return { meta: firstLine.payload as SessionMeta, path: filePath };
}

export type { RolloutLine };
