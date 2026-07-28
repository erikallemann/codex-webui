"use client";

/**
 * useReplayStream — GET /api/sessions/:id/events，回放历史会话事件流。
 *
 * 加载历史会话后，用户可输入新 prompt 走 /api/exec（resumeSessionId=<id>）续接。
 */

import { useCallback, useRef, useState } from "react";
import { useActiveSession } from "@/stores/active-session";
import { consumeSseStream } from "./sse-client";

export function useReplayStream() {
  const { dispatch, dispatchEvent } = useActiveSession();
  const abortRef = useRef<AbortController | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);

  const replay = useCallback(
    async (sessionId: string) => {
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      // 进入回放模式（RESET + START_REPLAY）
      dispatch({ type: "RESET" });
      dispatch({ type: "SET_RESUME", sessionId });
      dispatch({ type: "START_REPLAY" });

      setIsReplaying(true);

      try {
        const response = await fetch(`/api/sessions/${sessionId}/events`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "replay failed" }));
          dispatchEvent({
            type: "error",
            message: err.error || `HTTP ${response.status}`,
          });
          return;
        }

        await consumeSseStream(response, dispatchEvent, controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) {
          dispatchEvent({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        setIsReplaying(false);
        // 回放结束后状态置为 completed（除非出错）
        dispatch({ type: "ABORT" }); // 若 running 则转 aborted，否则不变
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [dispatch, dispatchEvent],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { replay, abort, isReplaying };
}
