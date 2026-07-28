/**
 * SSE 客户端解析工具。
 *
 * fetch + ReadableStream 手动解析 SSE 帧（`data: <json>\n\n`）。
 * EventSource 仅支持 GET，exec 路由是 POST，必须用 fetch。
 */

import type { SseEvent } from "@/types/api";

/**
 * 从 fetch Response 读取 SSE 事件流。
 * @param response fetch 返回的 Response（body 为 ReadableStream）
 * @param onEvent 每个解析出的事件回调
 * @param signal AbortSignal，abort 时停止读取
 */
export async function consumeSseStream(
  response: Response,
  onEvent: (event: SseEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  if (!response.body) throw new Error("response has no body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按双换行切分帧
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const event = parseSseFrame(frame);
        if (event) onEvent(event);
      }
    }
    // 处理尾部残余
    if (buffer.trim()) {
      const event = parseSseFrame(buffer);
      if (event) onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }
}

/** 解析单个 SSE 帧（可能多行 data:） */
function parseSseFrame(frame: string): SseEvent | null {
  const lines = frame.split("\n");
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) return null;
  const jsonStr = dataLines.join("\n");
  try {
    return JSON.parse(jsonStr) as SseEvent;
  } catch {
    return null;
  }
}
