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
 * - rateLimits：账号级全局速率限制信息（仅接受实时 token_count.rate_limits，跨会话保留）
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
  UserMessageItem,
} from "@/types/api";
import { initialState, reducer } from "@/lib/session/active-session-state";

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
  /** 用户消息已在本地插入，等待 app-server 的同一条 item 确认。 */
  pendingUserMessage?: boolean;
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
  /** 账号级全局速率限制信息；历史回放不会覆盖当前实时值。 */
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

export type Action =
  | { type: "EVENT"; event: SseEvent }
  | { type: "ABORT" }
  | { type: "RESET" }
  | { type: "START_REPLAY" }
  | { type: "FINISH_REPLAY" }
  | { type: "START_EXECUTION"; resumeSessionId: string | null }
  | { type: "ADD_PENDING_USER_MESSAGE"; item: UserMessageItem; timestamp?: string }
  | { type: "SET_RESUME"; sessionId: string | null };

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
