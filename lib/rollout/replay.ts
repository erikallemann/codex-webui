/**
 * rollout 文件回放：转换为与 exec 事件流一致的 SSE 事件。
 *
 * 映射规则（rollout 行 → exec 事件）：
 * - session_meta              → session.meta
 * - event_msg/task_started    → turn.started（携带 started_at）
 * - event_msg/task_complete   → turn.completed（usage 从缓存的 token_count 提取，携带时间戳）
 * - event_msg/token_count     → 缓存 usage + rate_limits，产出 rate_limits.updated 事件
 * - event_msg/user_message    → item.completed { item: { type: 'user_message', text } }
 * - event_msg/agent_message   → item.completed { item: { type: 'agent_message', text } }
 * - response_item/message(role=user)      → item.completed { item: { type: 'user_message', text } }
 * - response_item/message(role=assistant) → item.completed { item: { type: 'agent_message', text } }
 * - response_item/message(role=developer/system) → 跳过（系统指令）
 * - response_item/其他类型                → item.completed { item: payload }
 * - world_state / turn_context            → 跳过
 *
 * 这样前端 reducer 只需处理 session.meta / turn.started / turn.completed /
 * item.completed / rate_limits.updated / error，实时与回放完全统一。
 */

import type { ResponseItem, Usage, AgentMessageItem, UserMessageItem, ReasoningItem, SessionMeta, RateLimits } from "@/types/api";
import { readRolloutLines } from "./reader";
import type { RolloutLine, ReplayEvent, EventMsgLine, ResponseItemLine } from "./types";
import { extractReasoningSummaryText } from "@/lib/utils/format";

/**
 * 回放 rollout 文件为事件流。
 * @param filePath rollout 文件绝对路径
 * @param signal AbortSignal，abort 时停止读取
 */
export async function* replayRollout(
  filePath: string,
  signal?: AbortSignal,
): AsyncIterable<ReplayEvent> {
  // 缓存当前 turn 的 usage 与 rate_limits（token_count 先于 task_complete 到达）
  let pendingUsage: Usage | null = null;
  let pendingRateLimits: RateLimits | null = null;
  // 缓存当前 turn 的开始时间（task_started 设定，task_complete 时消费）
  let pendingStartedAt: number | undefined;
  let itemIdCounter = 0;

  // 生成稳定 id（rollout 中部分 item 无 id）
  const genId = (): string => `replay_${itemIdCounter++}`;

  // 去重：rollout 文件中 event_msg/agent_message 与 response_item/message(role=assistant)
  // 描述同一条消息，二者都会被映射为 item.completed(agent_message)。
  // 用 Set 跟踪已产出的 message key（type + normalized text），跳过重复。
  //
  // normalized text：压缩所有空白（含换行、制表符）为单空格并 trim。
  // 原因：event_msg 与 response_item 对同一消息的 text 可能有细微空白差异
  // （如尾部换行、多一个空格），精确匹配无法去重，导致同一消息显示两次。
  const seenMessageKeys = new Set<string>();
  const normalizeText = (s: string): string => s.replace(/\s+/g, " ").trim();

  // 推理文本去重：event_msg/agent_reasoning 与 response_item/reasoning 的 summary
  // 描述同一个推理。agent_reasoning 是 codex cli 显示明文思考过程的来源
  // （见 codex-rs/protocol/src/legacy_events.rs: ReasoningItem::as_legacy_events）。
  // 用 Set 跟踪已显示的推理文本，避免同一推理显示两次。
  const seenReasoningTexts = new Set<string>();

  for await (const line of readRolloutLines(filePath)) {
    if (signal?.aborted) return;

    const events = mapLineToEvents(line, genId, {
      getUsage: () => pendingUsage,
      setUsage: (u) => {
        pendingUsage = u;
      },
      getRateLimits: () => pendingRateLimits,
      setRateLimits: (rl) => {
        pendingRateLimits = rl;
      },
      getStartedAt: () => pendingStartedAt,
      setStartedAt: (ts) => {
        pendingStartedAt = ts;
      },
      clearTurn: () => {
        pendingUsage = null;
        pendingStartedAt = undefined;
        // rate_limits 不清除：它代表全局配额状态，持续到下次更新
      },
      hasReasoningText: (text) => seenReasoningTexts.has(text),
      addReasoningText: (text) => seenReasoningTexts.add(text),
    });
    if (events.length === 0) continue;

    // 对 message 类型的 item.completed 做去重
    for (const event of events) {
      if (event.type === "item.completed") {
        const item = event.item;
        if (item.type === "agent_message" || item.type === "user_message") {
          const text = item.text ?? "";
          const key = `${item.type}::${normalizeText(text)}`;
          if (seenMessageKeys.has(key)) continue;
          seenMessageKeys.add(key);
        }
      }
      yield event;
    }
  }
}

/** 回放上下文：缓存读写回调 */
interface ReplayContext {
  getUsage: () => Usage | null;
  setUsage: (u: Usage | null) => void;
  getRateLimits: () => RateLimits | null;
  setRateLimits: (rl: RateLimits | null) => void;
  getStartedAt: () => number | undefined;
  setStartedAt: (ts: number | undefined) => void;
  clearTurn: () => void;
  /** 推理文本是否已显示（用于 agent_reasoning 与 reasoning.summary 去重） */
  hasReasoningText: (text: string) => boolean;
  /** 记录已显示的推理文本 */
  addReasoningText: (text: string) => void;
}

/**
 * 将单行 rollout 映射为回放事件数组（一行可能产出多个事件，如 token_count 同时产出 rate_limits.updated）。
 */
function mapLineToEvents(
  line: RolloutLine,
  genId: () => string,
  ctx: ReplayContext,
): ReplayEvent[] {
  // rollout 行的 timestamp（ISO 字符串），传递给 item 事件
  const lineTimestamp = typeof line.timestamp === "string" ? line.timestamp : undefined;

  switch (line.type) {
    case "session_meta":
      return [{ type: "session.meta", meta: line.payload as SessionMeta }];

    case "event_msg":
      return mapEventMsg(line as EventMsgLine, genId, ctx, lineTimestamp);

    case "response_item":
      return [mapResponseItem(line as ResponseItemLine, genId, ctx, lineTimestamp)].filter(
        (e): e is ReplayEvent => e !== null,
      );

    default:
      // world_state / turn_context 等跳过
      return [];
  }
}

/** 映射 event_msg 行 */
function mapEventMsg(
  line: Extract<RolloutLine, { type: "event_msg" }>,
  genId: () => string,
  ctx: ReplayContext,
  lineTimestamp?: string,
): ReplayEvent[] {
  const p = line.payload as { type: string; [k: string]: unknown };
  const events: ReplayEvent[] = [];

  switch (p.type) {
    case "task_started": {
      const startedAt = typeof p.started_at === "number" ? p.started_at : undefined;
      ctx.setStartedAt(startedAt);
      events.push({ type: "turn.started", startedAt });
      break;
    }

    case "task_complete": {
      const startedAt = typeof p.started_at === "number" ? p.started_at : ctx.getStartedAt();
      const completedAt = typeof p.completed_at === "number" ? p.completed_at : undefined;
      const durationMs = typeof p.duration_ms === "number" ? p.duration_ms : undefined;

      events.push({
        type: "turn.completed",
        usage: ctx.getUsage() ?? emptyUsage(),
        startedAt,
        completedAt,
        durationMs,
      });
      // 清理当前 turn 缓存
      ctx.clearTurn();
      break;
    }

    case "token_count": {
      // 提取 usage（优先 info.last_token_usage）
      const u = extractUsageFromTokenCount(p);
      if (u) ctx.setUsage(u);

      // 提取 rate_limits
      const rl = extractRateLimitsFromTokenCount(p);
      if (rl) {
        ctx.setRateLimits(rl);
        events.push({ type: "rate_limits.updated", rateLimits: rl });
      }
      break;
    }

    case "user_message": {
      const text = String((p as { message?: string; text?: string }).message ||
        (p as { text?: string }).text || "");
      // 跳过系统注入的上下文（与 response_item/message(role=user) 一致）
      if (isSystemInjectedContext(text)) break;
      const item: UserMessageItem = { id: genId(), type: "user_message", text };
      events.push({ type: "item.completed", item, timestamp: lineTimestamp });
      break;
    }

    case "agent_message": {
      const text = String((p as { message?: string; text?: string }).message ||
        (p as { text?: string }).text || "");
      const item: AgentMessageItem = { id: genId(), type: "agent_message", text };
      events.push({ type: "item.completed", item, timestamp: lineTimestamp });
      break;
    }

    case "agent_reasoning": {
      // codex cli 显示明文思考过程的主要来源。
      // event_msg/agent_reasoning 由 ReasoningItem::as_legacy_events 生成
      // （见 codex-rs/protocol/src/legacy_events.rs），payload 为
      // {type:"agent_reasoning", text:"明文推理摘要"}。
      // cli TUI 通过 on_agent_reasoning_delta 渲染这些文本（见
      // codex-rs/tui/src/chatwidget/protocol.rs: ReasoningSummaryTextDelta）。
      const text = String((p as { text?: string }).text || "");
      if (!text) break;
      // 去重：同一推理文本只显示一次（response_item/reasoning 可能携带同样的 summary）
      if (ctx.hasReasoningText(text)) break;
      ctx.addReasoningText(text);
      const item: ReasoningItem = { id: genId(), type: "reasoning", text };
      events.push({ type: "item.completed", item, timestamp: lineTimestamp });
      break;
    }

    default:
      // 未知 event_msg 类型，跳过
      break;
  }

  return events;
}

/** 映射 response_item 行 */
function mapResponseItem(
  line: Extract<RolloutLine, { type: "response_item" }>,
  genId: () => string,
  ctx: ReplayContext,
  lineTimestamp?: string,
): ReplayEvent | null {
  const item = line.payload as ResponseItem & {
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
  };

  // message 类型按 role 分发
  if ((item as { type?: string }).type === "message") {
    const role = item.role;
    const text = (item.content || [])
      .filter((c) => c.type === "input_text" || c.type === "text" || c.type === "output_text")
      .map((c) => c.text || "")
      .join("\n");

    if (role === "user") {
      // codex 会以 role:user 注入大量环境上下文（<recommended_plugins>、
      // <environment_context>、# AGENTS.md 指令等），这些不是用户实际输入。
      // CLI 不显示它们，web-ui 同样跳过，以对齐 CLI 的聊天记录显示。
      if (isSystemInjectedContext(text)) {
        return null;
      }
      return {
        type: "item.completed",
        item: { id: item.id || genId(), type: "user_message", text },
        timestamp: lineTimestamp,
      };
    }
    if (role === "assistant") {
      return {
        type: "item.completed",
        item: { id: item.id || genId(), type: "agent_message", text },
        timestamp: lineTimestamp,
      };
    }
    // developer / system 跳过
    return null;
  }

  // 非 message 类型：确保有 id 后透传
  if (!item.id) item.id = genId();

  // 容错：部分 rollout 中 response_item 的 type 直接是 agent_message / user_message，
  // 但 text 可能在 content 数组或 message 字段中，需归一化为顶层 text 字段。
  const rawType = (item as { type?: string }).type;
  if (rawType === "agent_message" || rawType === "user_message") {
    const it = item as ResponseItem & {
      text?: string;
      message?: string;
      content?: Array<{ type?: string; text?: string }>;
    };
    // 若已有非空 text，直接用；否则从 content / message 提取
    if (typeof it.text !== "string" || it.text === "") {
      const extracted =
        (it.content || [])
          .filter((c) => c.type === "input_text" || c.type === "text" || c.type === "output_text")
          .map((c) => c.text || "")
          .join("\n") ||
        it.message ||
        "";
      it.text = extracted;
    }
  }

  // reasoning 项归一化与去重：
  // codex rollout 中 reasoning.summary 是对象数组 [{type:"summary_text", text:"..."}]，
  // encrypted_content 是加密内容（无法解密）。
  // event_msg/agent_reasoning 已先于 response_item/reasoning 到达，且携带同样的明文摘要
  // （均由 ReasoningItem::as_legacy_events 生成）。这里对 summary 做去重：
  // 若文本已被 agent_reasoning 显示则跳过，避免同一推理出现两次。
  // 若 summary 为空（仅有 encrypted_content），不显示——对齐 cli 行为（cli 不显示加密推理）。
  if (rawType === "reasoning") {
    const it = item as ResponseItem & {
      text?: string;
      summary?: unknown;
      encrypted_content?: string;
    };
    if (typeof it.text !== "string" || it.text === "") {
      it.text = extractReasoningSummaryText(it.summary);
    }
    // 无明文摘要 → 跳过（对齐 cli：不显示加密推理）
    if (!it.text) return null;
    // 已被 agent_reasoning 显示 → 跳过
    if (ctx.hasReasoningText(it.text)) return null;
    ctx.addReasoningText(it.text);
  }

  return { type: "item.completed", item, timestamp: lineTimestamp };
}

/**
 * 从 token_count payload 提取 usage。
 *
 * 实际格式：{ info: { last_token_usage: { input_tokens, ... }, total_token_usage: {...} } }
 * 兼容旧格式：{ usage: { input_tokens, ... } } 或顶层 { input_tokens, ... }
 *
 * 优先使用 last_token_usage（单 turn 增量），用于累加 totalUsage。
 */
function extractUsageFromTokenCount(p: Record<string, unknown>): Usage | null {
  const tryExtract = (u: Record<string, unknown> | undefined): Usage | null => {
    if (!u || typeof u !== "object") return null;
    const has = (k: string) => typeof u[k] === "number";
    if (!has("input_tokens") && !has("output_tokens")) return null;
    return {
      input_tokens: num(u.input_tokens),
      cached_input_tokens: num(u.cached_input_tokens),
      cache_write_input_tokens: num(u.cache_write_input_tokens),
      output_tokens: num(u.output_tokens),
      reasoning_output_tokens: num(u.reasoning_output_tokens),
    };
  };

  // 1. info.last_token_usage（实际 codex 格式，优先）
  const info = p.info as Record<string, unknown> | undefined;
  if (info) {
    const lastUsage = tryExtract(info.last_token_usage as Record<string, unknown>);
    if (lastUsage) return lastUsage;
    // 退而求其次：total_token_usage（但这是累计值，仅在无 last 时用）
    // 注意：使用 total 会导致累加错误，但比空值好（前端可后续覆盖）
    // 此处不使用 total，保持 null 让 turn.completed 用 emptyUsage
  }

  // 2. p.usage（旧格式兼容）
  const directUsage = tryExtract(p.usage as Record<string, unknown>);
  if (directUsage) return directUsage;

  // 3. 顶层字段（其他兼容）
  return tryExtract(p);
}

/** 从 token_count payload 提取 rate_limits */
function extractRateLimitsFromTokenCount(p: Record<string, unknown>): RateLimits | null {
  const rl = p.rate_limits as Record<string, unknown> | undefined;
  if (!rl || typeof rl !== "object") return null;

  const primary = rl.primary as Record<string, unknown> | null | undefined;
  const secondary = rl.secondary as Record<string, unknown> | null | undefined;
  const credits = rl.credits as Record<string, unknown> | undefined;

  const result: RateLimits = {};

  if (typeof rl.limit_id === "string") result.limitId = rl.limit_id;

  if (primary && typeof primary === "object") {
    result.primary = {
      usedPercent: num(primary.used_percent),
      ...(typeof primary.window_minutes === "number" ? { windowMinutes: primary.window_minutes } : {}),
      ...(typeof primary.resets_at === "number" ? { resetsAt: primary.resets_at } : {}),
    };
  }

  if (secondary && typeof secondary === "object") {
    result.secondary = {
      usedPercent: num(secondary.used_percent),
      ...(typeof secondary.window_minutes === "number" ? { windowMinutes: secondary.window_minutes } : {}),
      ...(typeof secondary.resets_at === "number" ? { resetsAt: secondary.resets_at } : {}),
    };
  }

  if (credits && typeof credits === "object") {
    result.credits = {
      hasCredits: Boolean(credits.has_credits),
      unlimited: Boolean(credits.unlimited),
      ...(typeof credits.balance === "string" ? { balance: credits.balance } : {}),
    };
  }

  if (typeof rl.plan_type === "string") result.planType = rl.plan_type;
  if (rl.rate_limit_reached_type === null || typeof rl.rate_limit_reached_type === "string") {
    result.rateLimitReachedType = rl.rate_limit_reached_type as string | null;
  }

  // 至少要有 primary 或 planType 才返回
  if (!result.primary && !result.planType) return null;

  return result;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function emptyUsage(): Usage {
  return {
    input_tokens: 0,
    cached_input_tokens: 0,
    cache_write_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
  };
}

/**
 * 判断 message 内容是否为 codex 系统注入的上下文（非用户实际输入）。
 *
 * codex 在向模型发送请求前，会注入大量环境上下文作为 role:user 的 message，
 * 如 <recommended_plugins>、<environment_context>、<permissions instructions>、
 * <skills_instructions>、# AGENTS.md 指令等。这些不是用户输入，CLI 不显示，
 * web-ui 也不应显示，以对齐 CLI 的聊天记录呈现。
 *
 * 判断依据：内容以 XML 标签 < 开头，或以 # AGENTS.md 开头。
 * 真正的用户输入不会以这些前缀开头。
 */
function isSystemInjectedContext(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<")) return true;
  if (trimmed.startsWith("# AGENTS.md")) return true;
  return false;
}
