"use client";

/**
 * useExecStream — POST /api/exec，解析 SSE 流，dispatch 到 active-session reducer。
 *
 * 调用方负责构造 ExecRequest，hook 内部管理 AbortController。
 * 返回 { run, abort, isRunning }。
 */

import { useCallback, useRef, useState } from "react";
import type { ExecRequest } from "@/types/api";
import { useActiveSession } from "@/stores/active-session";
import { consumeSseStream } from "./sse-client";

export function useExecStream() {
  const { dispatch, dispatchEvent } = useActiveSession();
  const abortRef = useRef<AbortController | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback(
    async (req: ExecRequest) => {
      // 中断已有流
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

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

        await consumeSseStream(response, dispatchEvent, controller.signal);
      } catch (err) {
        if (controller.signal.aborted) {
          dispatch({ type: "ABORT" });
        } else {
          dispatchEvent({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        setIsRunning(false);
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

  return { run, abort, isRunning };
}
