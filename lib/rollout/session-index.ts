/**
 * 读取 ~/.codex/session_index.jsonl，构建 session_id → thread_name 映射。
 *
 * session_index.jsonl 每行格式：
 * {"id":"<uuid>","thread_name":"<标题>","updated_at":"<ISO>"}
 *
 * 该文件由 codex CLI 维护，包含所有会话的显示标题（首条用户消息或用户重命名）。
 * 文件可能很大（数千行），按行流式解析，仅保留 id → thread_name。
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { codexHome } from "./paths";
import path from "node:path";

/** session_index.jsonl 文件路径 */
export function sessionIndexPath(): string {
  return path.join(codexHome(), "session_index.jsonl");
}

interface IndexEntry {
  id: string;
  thread_name: string;
  updated_at?: string;
}

/**
 * 读取 session_index.jsonl，返回 session_id → thread_name 映射。
 *
 * 同一 session_id 可能出现多次（历史记录），后者覆盖前者。
 * 若文件不存在或解析失败，返回空 Map。
 */
export async function loadSessionIndex(): Promise<Map<string, string>> {
  const filePath = sessionIndexPath();
  const map = new Map<string, string>();

  let rl: ReturnType<typeof createInterface>;
  try {
    rl = createInterface({
      input: createReadStream(filePath, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });
  } catch {
    return map;
  }

  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed) as IndexEntry;
        if (entry.id && entry.thread_name) {
          map.set(entry.id, entry.thread_name);
        }
      } catch {
        // 跳过损坏行
      }
    }
  } catch {
    // 读取中途出错，返回已读部分
  }

  return map;
}

/**
 * 读取 session_index.jsonl，返回 session_id → IndexEntry 映射（含 updated_at）。
 * 用于补充更精确的 updatedAt 时间。
 */
export async function loadSessionIndexFull(): Promise<Map<string, IndexEntry>> {
  const filePath = sessionIndexPath();
  const map = new Map<string, IndexEntry>();

  let rl: ReturnType<typeof createInterface>;
  try {
    rl = createInterface({
      input: createReadStream(filePath, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });
  } catch {
    return map;
  }

  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed) as IndexEntry;
        if (entry.id && entry.thread_name) {
          map.set(entry.id, entry);
        }
      } catch {
        // 跳过损坏行
      }
    }
  } catch {
    // 读取中途出错，返回已读部分
  }

  return map;
}
