/**
 * codex exec --json 事件流解析。
 *
 * codex exec --json 的 stdout 是 JSONL，每行一个 JSON 对象（事件）。
 * 已确认的事件 type：
 * - thread.started  { thread_id }
 * - turn.started    {}
 * - item.completed  { item: ResponseItem }  （注意：实测无 item.started）
 * - turn.completed  { usage }
 * - turn.failed     { error? | message? }
 * - error           { message, stderr? }
 *
 * item.type 包括：agent_message / reasoning / command_execution / file_change /
 * mcp_tool_call / web_search / plan_update / error。
 */

import type {
  CodexEvent,
  ResponseItem,
  ItemCompletedEvent,
  Usage,
} from "@/types/api";
import { extractReasoningSummaryText } from "@/lib/utils/format";
import { inferSeverity } from "./severity";

/** 已知的顶层事件 type */
const KNOWN_EVENT_TYPES = new Set<string>([
  "thread.started",
  "turn.started",
  "item.completed",
  "turn.completed",
  "turn.failed",
  "error",
]);

/** 已知的 item.type */
const KNOWN_ITEM_TYPES = new Set<string>([
  "agent_message",
  "reasoning",
  "command_execution",
  "file_change",
  "mcp_tool_call",
  "web_search",
  "plan_update",
  "user_message",
  "error",
]);

/**
 * 解析一行 JSONL 为 codex 事件。
 * 解析失败或类型未知时返回 null（跳过，不中断流）。
 */
export function parseEventLine(line: string): CodexEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const type = o.type;

  if (typeof type !== "string" || !KNOWN_EVENT_TYPES.has(type)) {
    return null;
  }

  switch (type) {
    case "thread.started":
      if (typeof o.thread_id === "string") {
        return { type: "thread.started", thread_id: o.thread_id };
      }
      return null;

    case "turn.started":
      return { type: "turn.started", startedAt: Math.floor(Date.now() / 1000) };

    case "item.completed":
      return parseItemCompleted(o);

    case "turn.completed":
      return parseTurnCompleted(o);

    case "turn.failed":
      return {
        type: "turn.failed",
        error: typeof o.error === "string" ? o.error : undefined,
        message: typeof o.message === "string" ? o.message : undefined,
      };

    case "error": {
      const message = typeof o.message === "string" ? o.message : "unknown error";
      return {
        type: "error",
        message,
        stderr: typeof o.stderr === "string" ? o.stderr : undefined,
        severity: inferSeverity(message),
      };
    }

    default:
      return null;
  }
}

/** 解析 item.completed 事件，校验 item 结构 */
function parseItemCompleted(o: Record<string, unknown>): ItemCompletedEvent | null {
  const item = o.item;
  if (typeof item !== "object" || item === null) return null;
  const it = item as Record<string, unknown>;
  if (typeof it.type !== "string" || !KNOWN_ITEM_TYPES.has(it.type)) return null;
  if (typeof it.id !== "string") return null;

  // 容错：agent_message / user_message 的 text 可能在 content 数组或 message 字段中，
  // 需归一化为顶层 text 字符串，避免 Markdown 组件收到 undefined。
  if (it.type === "agent_message" || it.type === "user_message") {
    if (typeof it.text !== "string" || it.text === "") {
      const content = Array.isArray(it.content) ? it.content : [];
      const extracted =
        content
          .filter(
            (c): c is { type: string; text: string } =>
              typeof c === "object" &&
              c !== null &&
              typeof (c as Record<string, unknown>).text === "string" &&
              ["input_text", "text", "output_text"].includes(
                (c as Record<string, unknown>).type as string,
              ),
          )
          .map((c) => c.text)
          .join("\n") ||
        (typeof it.message === "string" ? it.message : "") ||
        (typeof it.text === "string" ? it.text : "");
      it.text = extracted;
    }
  }

  // reasoning 项归一化：summary 是对象数组 [{type:"summary_text", text:"..."}]，
  // encrypted_content 是加密内容。将 summary 中所有 summary_text 项的 text 拼接为顶层 text。
  // 这就是 CLI 能显示明文思考过程的原因——明文存在 summary[].text 里。
  if (it.type === "reasoning") {
    if (typeof it.text !== "string" || it.text === "") {
      (it as Record<string, unknown>).text = extractReasoningSummaryText(
        (it as { summary?: unknown }).summary,
      );
    }
  }

  // command_execution 项归一化：
  // codex exec --json 实际输出 command 为字符串（完整命令行），但旧版或回放可能为数组。
  // 统一归一化为字符串，避免前端 item.command.join() 报错。
  if (it.type === "command_execution") {
    const cmd = (it as { command?: unknown }).command;
    if (Array.isArray(cmd)) {
      (it as Record<string, unknown>).command = cmd.join(" ");
    } else if (typeof cmd !== "string") {
      (it as Record<string, unknown>).command = "";
    }
    // aggregated_output 优先于 stdout/stderr（codex 实际输出此字段）
    // 不删除 stdout/stderr，保留兼容性
  }

  // error 项：推断 severity，区分致命错误与非致命警告
  if (it.type === "error") {
    const msg = (it as { message?: unknown }).message;
    const messageStr = typeof msg === "string" ? msg : "";
    (it as Record<string, unknown>).severity = inferSeverity(messageStr);
  }

  return {
    type: "item.completed",
    item: it as unknown as ResponseItem,
    timestamp: new Date().toISOString(),
  };
}

/** 解析 turn.completed 的 usage */
function parseTurnCompleted(o: Record<string, unknown>): CodexEvent | null {
  const usage = o.usage;
  if (typeof usage !== "object" || usage === null) return null;
  const u = usage as Record<string, unknown>;
  const completedAt = Math.floor(Date.now() / 1000);
  return {
    type: "turn.completed",
    usage: {
      input_tokens: num(u.input_tokens),
      cached_input_tokens: num(u.cached_input_tokens),
      cache_write_input_tokens: num(u.cache_write_input_tokens),
      output_tokens: num(u.output_tokens),
      reasoning_output_tokens: num(u.reasoning_output_tokens),
    } satisfies Usage,
    completedAt,
  };
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// ---------------------------------------------------------------------------
// 纯函数工具（供 reducer / 卡片组件复用）
// ---------------------------------------------------------------------------

/** 是否为 item.completed 事件 */
export function isItemCompleted(e: CodexEvent): e is ItemCompletedEvent {
  return e.type === "item.completed";
}

/** 提取 item.completed 中的 item */
export function extractItem(e: CodexEvent): ResponseItem | null {
  return isItemCompleted(e) ? e.item : null;
}

/** 提取 turn.completed 的 usage */
export function extractUsage(e: CodexEvent): Usage | null {
  return e.type === "turn.completed" ? e.usage : null;
}

/** item.type 类型守卫 */
export function isItemOfType<T extends ResponseItem["type"]>(
  item: ResponseItem,
  type: T,
): item is Extract<ResponseItem, { type: T }> {
  return item.type === type;
}
