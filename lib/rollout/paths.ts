/**
 * codex home 与 sessions 路径解析。
 *
 * codex 默认 home：~/.codex（Windows: %USERPROFILE%\.codex）。
 * 可通过 CODEX_HOME 环境变量覆盖。
 *
 * sessions 目录布局：~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl
 * 归档目录：~/.codex/archived_sessions/（同样按日期嵌套）
 * 压缩文件：.jsonl.zst（7 天以上自动压缩）
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

/** 解析 codex home 目录 */
export function codexHome(): string {
  // Reflect.get 保持这是运行时路径，避免 Next/@vercel-nft 在构建阶段
  // 静态展开并递归扫描整个 ~/.codex（其中可能包含不可读的安全目录）。
  const env = runtimeEnv("CODEX_HOME");
  if (env && env.trim()) return path.resolve(env);
  const userHome = runtimeEnv(process.platform === "win32" ? "USERPROFILE" : "HOME");
  return path.join(userHome || homedir(), ".codex");
}

function runtimeEnv(name: string): string | undefined {
  const value = Reflect.get(process.env, name) as unknown;
  return typeof value === "string" ? value : undefined;
}

/** sessions 根目录 */
export function sessionsRoot(): string {
  return path.join(codexHome(), "sessions");
}

/** archived sessions 根目录 */
export function archivedSessionsRoot(): string {
  return path.join(codexHome(), "archived_sessions");
}

/** 判断文件是否为 rollout 文件（.jsonl 或 .jsonl.zst） */
export function isRolloutFile(name: string): boolean {
  return name.endsWith(".jsonl") || name.endsWith(".jsonl.zst");
}

/** 是否为压缩文件 */
export function isCompressed(name: string): boolean {
  return name.endsWith(".jsonl.zst");
}

/**
 * 从文件名解析 session_id（UUID）。
 * 文件名格式：rollout-<RFC3339 时间戳，冒号替换为短横>-<UUID>.jsonl[.zst]
 * 例：rollout-2026-07-27T10-50-02-019fa17a-b87f-7583-a2df-6b60431f2ebf.jsonl
 */
export function parseSessionIdFromFilename(name: string): string | null {
  // 移除扩展名
  const base = name.replace(/\.jsonl(\.zst)?$/, "");
  // 最后一段 UUID（36 字符：8-4-4-4-12）
  const match = base.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  return match ? match[1] : null;
}

/**
 * 从文件名解析时间戳（ISO 字符串）。
 * 文件名中的时间戳格式：2026-07-27T10-50-02（冒号替换为短横）
 */
export function parseTimestampFromFilename(name: string): string | null {
  const base = name.replace(/\.jsonl(\.zst)?$/, "");
  // 匹配 rollout-YYYY-MM-DDTHH-MM-SS 部分
  const match = base.match(/rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
  if (!match) return null;
  // 还原冒号
  const ts = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3");
  return ts;
}

/**
 * 根据 session_id 查找 rollout 文件路径。
 * 递归搜索 sessions 与 archived_sessions，优先 .jsonl（未压缩）。
 */
export function findRolloutFile(sessionId: string): string | null {
  const roots = [sessionsRoot(), archivedSessionsRoot()];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const found = findFileBySessionId(root, sessionId);
    if (found) return found;
  }
  return null;
}

/** 递归查找包含指定 session_id 的文件，优先 plain */
function findFileBySessionId(dir: string, sessionId: string): string | null {
  let plain: string | null = null;
  let compressed: string | null = null;

  const walk = (d: string) => {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(d, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
      } else if (isRolloutFile(entry)) {
        const id = parseSessionIdFromFilename(entry);
        if (id === sessionId) {
          if (isCompressed(entry)) {
            compressed ??= full;
          } else {
            plain ??= full;
          }
        }
      }
    }
  };

  walk(dir);
  return plain ?? compressed;
}

/** 获取文件 mtime（ISO 字符串） */
export function fileMtime(filePath: string): string {
  try {
    return statSync(filePath).mtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}
