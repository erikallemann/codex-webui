/**
 * Pure active-session state transitions.
 *
 * Keeping the reducer outside the React provider gives live execution and
 * replay one testable state-machine seam. The provider remains responsible
 * only for wiring React Context and dispatch.
 */

import type { ActiveSessionState, Action } from "@/stores/active-session";
import type { SseEvent, Usage } from "@/types/api";

const EMPTY_USAGE: Usage = {
  input_tokens: 0,
  cached_input_tokens: 0,
  cache_write_input_tokens: 0,
  output_tokens: 0,
  reasoning_output_tokens: 0,
};

export const initialState: ActiveSessionState = {
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

export function reducer(state: ActiveSessionState, action: Action): ActiveSessionState {
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

    case "START_EXECUTION": {
      if (action.resumeSessionId) {
        return {
          ...state,
          status: "running",
          error: null,
          isReplay: false,
          resumeSessionId: action.resumeSessionId,
        };
      }

      turnCounter = 0;
      return {
        ...initialState,
        status: "running",
        isReplay: false,
      };
    }

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
