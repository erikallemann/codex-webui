/**
 * SSE (Server-Sent Events) 响应封装。
 *
 * 由于 exec 路由是 POST（需携带 prompt body），不能用 EventSource（仅 GET）。
 * 采用 fetch + ReadableStream 手动解析 SSE 帧，因此服务端输出标准 SSE 帧格式：
 *   data: <json>\n\n
 *
 * abort 链路：
 * - 客户端断开 → request.signal 触发 abort
 * - createSseResponse 监听 signal，调用 producer 的清理函数（kill child / close reader）
 * - controller.close() 正常结束流
 */

import type { SseEvent } from "@/types/api";

/** SSE 响应头 */
export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
  Connection: "keep-alive",
};

/**
 * 创建 SSE Response。
 *
 * @param producer 产出事件的 async generator，在 signal abort 时应自行清理
 * @param requestSignal Next.js Request 的 AbortSignal
 */
export function createSseResponse(
  producer: (emit: (event: SseEvent) => void) => Promise<void>,
  requestSignal: AbortSignal,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const emit = (event: SseEvent) => {
        if (closed) return;
        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // controller 可能已关闭
        }
      };

      const onAbort = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* 已关闭 */
          }
        }
      };
      requestSignal.addEventListener("abort", onAbort, { once: true });

      try {
        await producer(emit);
      } catch (err) {
        if (!closed) {
          const message = err instanceof Error ? err.message : String(err);
          emit({ type: "error", message });
        }
      } finally {
        requestSignal.removeEventListener("abort", onAbort);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* 已关闭 */
          }
        }
      }
    },
    cancel() {
      // 客户端主动取消（等同 abort）
      // requestSignal 的 abort 事件会在 start 中处理
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
