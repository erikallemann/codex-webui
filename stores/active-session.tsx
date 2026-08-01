"use client";

/**
 * 活跃会话状态机（Context + useReducer）。
 *
 * 统一处理实时 exec 事件流与回放事件流，前端 reducer 只需处理 SseEvent 联合类型。
 *
 * State：
 * - status：idle / running / completed / failed / aborted
 * - threadId / sessionMeta：会话标识（实时流用 threadId，回放用 sessionMeta）
 * - timeline：时间线条目（turn 边界 + item）
 * - usage：累计 token 用量
 * - rateLimits：codex 速率限制信息（来自 token_count.rate_limits）
 * - error：错误信息
 * - resumeSessionId：续接的会话 ID（resume 模式）
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import type {
  SseEvent,
  Usage,
  SessionMeta,
  ResponseItem,
  RateLimits,
} from "@/types/api";

// ---------------------------------------------------------------------------
// Timeline 条目类型
// ---------------------------------------------------------------------------

/** turn 边界条目 */
export interface TurnEntry {
  kind: "turn";
  id: string;
  status: "running" | "completed" | "failed";
  usage?: Usage;
  /** turn 开始时间（Unix 秒） */
  startedAt?: number;
  /** turn 完成时间（Unix 秒） */
  completedAt?: number;
  /** turn 持续时长（毫秒） */
  durationMs?: number;
}

/** item 条目 */
export interface ItemEntry {
  kind: "item";
  id: string;
  item: ResponseItem;
  /** item 时间戳（ISO 字符串，回放来自 rollout 行；实时来自 Date.now()） */
  timestamp?: string;
}

/** 时间线条目联合 */
export type TimelineEntry = TurnEntry | ItemEntry;

// ---------------------------------------------------------------------------
// State & Action
// ---------------------------------------------------------------------------

export type SessionStatus = "idle" | "running" | "completed" | "failed" | "aborted";

export interface ActiveSessionState {
  status: SessionStatus;
  threadId: string | null;
  sessionMeta: SessionMeta | null;
  timeline: TimelineEntry[];
  /** 累计 usage（所有 turn 之和） */
  totalUsage: Usage;
  /** codex 速率限制信息（来自 token_count.rate_limits） */
  rateLimits: RateLimits | null;
  /** 最近一次模型调用的输入 token，即当前上下文占用。 */
  contextTokens: number | null;
  /** rollout 中 Codex 实际报告的上下文窗口。 */
  contextWindow: number | null;
  /** 是否已收到权威 token_count 快照。 */
  hasUsageSnapshot: boolean;
  error: string | null;
  /** 是否正在回放历史会话 */
  isReplay: boolean;
  /** resume 续接的会话 ID */
  resumeSessionId: string | null;
}

type Action =
  | { type: "EVENT"; event: SseEvent }
  | { type: "ABORT" }
  | { type: "RESET" }
  | { type: "START_REPLAY" }
  | { type: "SET_RESUME"; sessionId: string | null };

const EMPTY_USAGE: Usage = {
  input_tokens: 0,
  cached_input_tokens: 0,
  cache_write_input_tokens: 0,
  output_tokens: 0,
  reasoning_output_tokens: 0,
};

const initialState: ActiveSessionState = {
  status: "idle",
  threadId: null,
  sessionMeta: null,
  timeline: [],
  totalUsage: EMPTY_USAGE,
  rateLimits: null,
  contextTokens: null,
  contextWindow: null,
  hasUsageSnapshot: false,
  error: null,
  isReplay: false,
  resumeSessionId: null,
};

let turnCounter = 0;

function reducer(state: ActiveSessionState, action: Action): ActiveSessionState {
  switch (action.type) {
    case "EVENT":
      return handleEvent(state, action.event);

    case "ABORT":
      return {
        ...state,
        status: state.status === "running" ? "aborted" : state.status,
      };

    case "RESET":
      turnCounter = 0;
      return { ...initialState };

    case "START_REPLAY":
      turnCounter = 0;
      return {
        ...initialState,
        status: "running",
        isReplay: true,
        resumeSessionId: state.resumeSessionId,
      };

    case "SET_RESUME":
      return { ...state, resumeSessionId: action.sessionId };

    default:
      return state;
  }
}

function handleEvent(state: ActiveSessionState, event: SseEvent): ActiveSessionState {
  switch (event.type) {
    case "session.meta":
      return {
        ...state,
        sessionMeta: event.meta,
        threadId: event.meta.session_id,
      };

    case "thread.started":
      return {
        ...state,
        threadId: event.thread_id,
        status: "running",
      };

    case "turn.started":
      return {
        ...state,
        status: "running",
        timeline: [
          ...state.timeline,
          {
            kind: "turn",
            id: `turn_${turnCounter++}`,
            status: "running",
            startedAt: event.startedAt,
          },
        ],
      };

    case "item.completed":
      return {
        ...state,
        timeline: [
          ...state.timeline,
          {
            kind: "item",
            id: event.item.id,
            item: event.item,
            timestamp: event.timestamp,
          },
        ],
      };

    case "turn.completed": {
      const timeline = [...state.timeline];
      // 更新最后一个 turn 条目
      for (let i = timeline.length - 1; i >= 0; i--) {
        const entry = timeline[i];
        if (entry.kind === "turn") {
          timeline[i] = {
            ...entry,
            status: "completed",
            usage: event.usage,
            startedAt: event.startedAt ?? entry.startedAt,
            completedAt: event.completedAt,
            durationMs: event.durationMs,
          };
          break;
        }
      }
      return {
        ...state,
        timeline,
        totalUsage: state.hasUsageSnapshot
          ? state.totalUsage
          : addUsage(state.totalUsage, event.usage),
        contextTokens: state.hasUsageSnapshot
          ? state.contextTokens
          : event.usage.input_tokens,
        status: "completed",
      };
    }

    case "turn.failed": {
      const timeline = [...state.timeline];
      for (let i = timeline.length - 1; i >= 0; i--) {
        const entry = timeline[i];
        if (entry.kind === "turn") {
          timeline[i] = {
            ...entry,
            status: "failed",
            completedAt: Math.floor(Date.now() / 1000),
          };
          break;
        }
      }
      const msg = event.error || event.message || "turn failed";
      return {
        ...state,
        timeline,
        error: msg,
        status: "failed",
      };
    }

    case "rate_limits.updated":
      return {
        ...state,
        rateLimits: event.rateLimits,
      };

    case "usage.updated":
      return {
        ...state,
        totalUsage: event.snapshot.totalUsage ?? state.totalUsage,
        contextTokens:
          event.snapshot.contextTokens ??
          event.snapshot.lastUsage?.input_tokens ??
          state.contextTokens,
        contextWindow: event.snapshot.contextWindow ?? state.contextWindow,
        rateLimits: event.snapshot.rateLimits ?? state.rateLimits,
        hasUsageSnapshot: true,
      };

    case "error":
      return {
        ...state,
        error: event.message,
        // 非致命警告（如 skills context budget 截断）不将 session 状态置为 failed
        status: event.severity === "warning" ? state.status : "failed",
      };

    default:
      return state;
  }
}

function addUsage(a: Usage, b: Usage): Usage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    cached_input_tokens: a.cached_input_tokens + b.cached_input_tokens,
    cache_write_input_tokens: a.cache_write_input_tokens + b.cache_write_input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    reasoning_output_tokens: a.reasoning_output_tokens + b.reasoning_output_tokens,
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ActiveSessionContextValue {
  state: ActiveSessionState;
  dispatch: (action: Action) => void;
  /** 发送事件（reducer 内部使用，暴露供 hooks 调用） */
  dispatchEvent: (event: SseEvent) => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextValue | null>(null);

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const dispatchEvent = useCallback(
    (event: SseEvent) => dispatch({ type: "EVENT", event }),
    [],
  );

  return (
    <ActiveSessionContext.Provider value={{ state, dispatch, dispatchEvent }}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession(): ActiveSessionContextValue {
  const ctx = useContext(ActiveSessionContext);
  if (!ctx) {
    throw new Error("useActiveSession must be used within ActiveSessionProvider");
  }
  return ctx;
}
