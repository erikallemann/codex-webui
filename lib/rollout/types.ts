/**
 * rollout 文件类型定义。
 *
 * rollout 文件每行结构：{ timestamp, type, payload }
 * - type=session_meta：首行，payload 为 SessionMeta
 * - type=event_msg：payload.type 为 task_started / user_message / agent_message / token_count / task_complete 等
 * - type=response_item：payload 为 ResponseItem（message / command_execution / file_change 等）
 * - type=world_state / turn_context：内部状态，回放时跳过
 *
 * 回放时将 rollout 行映射为 exec 事件格式（item.completed / turn.started / turn.completed），
 * 与实时 exec 流共用前端 reducer。
 */

import type { ResponseItem, SessionMeta, Usage } from "@/types/api";

/** rollout 文件首行 */
export interface SessionMetaLine {
  timestamp: string;
  type: "session_meta";
  payload: SessionMeta;
}

/** event_msg 行（payload.type 区分子类型） */
export interface EventMsgLine {
  timestamp: string;
  type: "event_msg";
  payload: {
    type: string;
    [key: string]: unknown;
  };
}

/** response_item 行（payload 是 ResponseItem） */
export interface ResponseItemLine {
  timestamp: string;
  type: "response_item";
  payload: ResponseItem;
}

/** world_state / turn_context 等内部状态行（回放跳过） */
export interface InternalLine {
  timestamp: string;
  type: "world_state" | "turn_context" | string;
  payload: unknown;
}

/** rollout 文件任意行的联合类型 */
export type RolloutLine = SessionMetaLine | EventMsgLine | ResponseItemLine | InternalLine;

// ---------------------------------------------------------------------------
// event_msg payload 子类型（已确认的）
// ---------------------------------------------------------------------------

export interface TaskStartedPayload {
  type: "task_started";
  turn_id: string;
  started_at: number;
  model_context_window?: number;
  collaboration_mode_kind?: string;
}

export interface TaskCompletePayload {
  type: "task_complete";
  turn_id: string;
  reason?: string;
  /** turn 开始时间（Unix 秒） */
  started_at?: number;
  /** turn 完成时间（Unix 秒） */
  completed_at?: number;
  /** 持续时长（毫秒） */
  duration_ms?: number;
  /** 首 token 延迟（毫秒） */
  time_to_first_token_ms?: number;
  /** 最后一条 agent 消息 */
  last_agent_message?: string;
}

export interface UserMessagePayload {
  type: "user_message";
  message?: string;
  text?: string;
}

export interface AgentMessagePayload {
  type: "agent_message";
  message?: string;
  text?: string;
}

export interface TokenCountPayload {
  type: "token_count";
  /** 实际格式：{ info: { total_token_usage, last_token_usage, model_context_window }, rate_limits: {...} } */
  info?: {
    total_token_usage?: Partial<Usage> & { total_tokens?: number };
    last_token_usage?: Partial<Usage> & { total_tokens?: number };
    model_context_window?: number;
  };
  rate_limits?: {
    limit_id?: string;
    limit_name?: string | null;
    primary?: {
      used_percent?: number;
      window_minutes?: number;
      resets_at?: number;
    } | null;
    secondary?: {
      used_percent?: number;
      window_minutes?: number;
      resets_at?: number;
    } | null;
    credits?: {
      has_credits?: boolean;
      unlimited?: boolean;
      balance?: string;
    };
    individual_limit?: unknown;
    spend_control_reached?: unknown;
    plan_type?: string;
    rate_limit_reached_type?: string | null;
  };
  /** 兼容旧格式：usage 直接在顶层 */
  usage?: Partial<Usage>;
  /** 兼容其他字段名 */
  input_tokens?: number;
  cached_input_tokens?: number;
  cache_write_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
}

// ---------------------------------------------------------------------------
// 回放产出的统一事件（与 exec 事件流对齐）
// ---------------------------------------------------------------------------

/** 回放产出的 session.meta 事件 */
export interface ReplaySessionMetaEvent {
  type: "session.meta";
  meta: SessionMeta;
}

/** 回放产出的 turn.started 事件 */
export interface ReplayTurnStartedEvent {
  type: "turn.started";
  startedAt?: number;
}

/** 回放产出的 item.completed 事件 */
export interface ReplayItemEvent {
  type: "item.completed";
  item: ResponseItem;
  /** item 时间戳（ISO 字符串，来自 rollout 行的 timestamp） */
  timestamp?: string;
}

/** 回放产出的 turn.completed 事件（usage 来自 token_count） */
export interface ReplayTurnCompletedEvent {
  type: "turn.completed";
  usage: Usage;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

/** 回放产出的 rate_limits.updated 事件（来自 token_count.rate_limits） */
export interface ReplayRateLimitsEvent {
  type: "rate_limits.updated";
  rateLimits: import("@/types/api").RateLimits;
}

/** 回放产出的事件联合 */
export type ReplayEvent =
  | ReplaySessionMetaEvent
  | ReplayTurnStartedEvent
  | ReplayItemEvent
  | ReplayTurnCompletedEvent
  | ReplayRateLimitsEvent;
