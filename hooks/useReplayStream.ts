"use client";

/**
 * useReplayStream — GET /api/sessions/:id/events，回放历史会话事件流。
 *
 * 加载历史会话后，用户可输入新 prompt 走 /api/exec（resumeSessionId=<id>）续接。
 */

import { useCallback, useState } from "react";
import { useActiveSession } from "@/stores/active-session";
import { consumeSseStream } from "./sse-client";
import {
  abortActiveStream,
  claimActiveStream,
  isActiveStream,
  releaseActiveStream,
} from "./stream-controller";

export function useReplayStream() {
  const { dispatch, dispatchEvent } = useActiveSession();
  const [isReplaying, setIsReplaying] = useState(false);

  const replay = useCallback(
    async (sessionId: string) => {
      const controller = new AbortController();
      claimActiveStream(controller);
      let replayFinished = false;

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
        replayFinished = true;
      } catch (err) {
        if (!controller.signal.aborted) {
          dispatchEvent({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        setIsReplaying(false);
        // 旧流被新流替换时，不能把新流状态误置为 aborted。
        if (isActiveStream(controller)) {
          if (replayFinished) dispatch({ type: "FINISH_REPLAY" });
          dispatch({ type: "ABORT" });
          releaseActiveStream(controller);
        }
      }
    },
    [dispatch, dispatchEvent],
  );

  const abort = useCallback(() => {
    abortActiveStream();
  }, []);

  return { replay, abort, isReplaying };
}
