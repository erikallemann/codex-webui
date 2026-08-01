"use client";

/**
 * useExecStream — POST /api/exec，解析 SSE 流，dispatch 到 active-session reducer。
 *
 * 调用方负责构造 ExecRequest，hook 内部管理 AbortController。
 * 返回 { run, abort, isRunning }。
 */

import { useCallback, useState } from "react";
import type { ExecRequest } from "@/types/api";
import { useActiveSession } from "@/stores/active-session";
import { consumeSseStream } from "./sse-client";
import {
  abortActiveStream,
  claimActiveStream,
  isActiveStream,
  releaseActiveStream,
} from "./stream-controller";
import { fetchUsageSnapshot } from "./useUsageRefresh";

export function useExecStream() {
  const { dispatch, dispatchEvent } = useActiveSession();
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback(
    async (req: ExecRequest) => {
      const controller = new AbortController();
      claimActiveStream(controller);
      let streamedSessionId = req.resumeSessionId;

      // 重置状态（保留 resumeSessionId）
      dispatch({ type: "RESET" });
      dispatch({ type: "SET_RESUME", sessionId: req.resumeSessionId ?? null });

      setIsRunning(true);

      try {
        const response = await fetch("/api/exec", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(req),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "request failed" }));
          dispatchEvent({
            type: "error",
            message: err.error || `HTTP ${response.status}`,
          });
          return;
        }

        await consumeSseStream(
          response,
          (event) => {
            if (event.type === "thread.started") streamedSessionId = event.thread_id;
            dispatchEvent(event);
          },
          controller.signal,
        );

        // exec 的公开 JSON 流不含底层 token_count；结束后从 rollout 补齐权威快照。
        if (streamedSessionId && !controller.signal.aborted) {
          try {
            const snapshot = await fetchUsageSnapshot(streamedSessionId, controller.signal);
            dispatchEvent({ type: "usage.updated", snapshot });
          } catch {
            // rollout 可能仍在落盘；顶部刷新按钮可稍后重试。
          }
        }
      } catch (err) {
        if (controller.signal.aborted) {
          if (isActiveStream(controller)) dispatch({ type: "ABORT" });
        } else {
          dispatchEvent({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        setIsRunning(false);
        releaseActiveStream(controller);
      }
    },
    [dispatch, dispatchEvent],
  );

  const abort = useCallback(() => {
    abortActiveStream();
  }, []);

  return { run, abort, isRunning };
}
