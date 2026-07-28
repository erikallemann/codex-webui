/**
 * POST /api/exec
 *
 * spawn codex exec --json，将 stdout JSONL 事件流转为 SSE 帧转发到前端。
 * request.signal abort 时 kill 子进程。
 */

import { NextRequest } from "next/server";
import type { ExecRequest, SseEvent } from "@/types/api";
import { createSseResponse } from "@/lib/server/sse";
import { buildExecArgv, validateExecRequest, needsStdin } from "@/lib/codex/args";
import { spawnCodex } from "@/lib/codex/spawn";
import { parseEventLine } from "@/lib/codex/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  let body: Partial<ExecRequest>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json body" }, { status: 400 });
  }

  const validationError = validateExecRequest(body);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const req = body as ExecRequest;
  let argv: string[];
  try {
    argv = buildExecArgv(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }

  const useStdin = needsStdin(req);

  return createSseResponse(async (emit) => {
    // spawn codex（binary.ts 解析失败会抛 CODEX_NOT_FOUND）
    let handle;
    try {
      handle = spawnCodex(argv, req.cwd, request.signal, useStdin ? req.prompt : undefined);
    } catch (err) {
      const e = err as Error & { code?: string };
      emit({
        type: "error",
        message: e.code === "CODEX_NOT_FOUND" ? e.message : `spawn failed: ${e.message}`,
      });
      return;
    }

    let eventCount = 0;
    let lastEventWasTurn = false;

    // 消费 stdout 事件流
    for await (const line of handle.stdout) {
      if (request.signal.aborted) break;
      const event = parseEventLine(line);
      if (event) {
        emit(event as SseEvent);
        eventCount++;
        lastEventWasTurn = event.type === "turn.completed" || event.type === "turn.failed";
      }
    }

    const exitCode = await handle.onExit;

    // 子进程非 0 退出且无 turn 事件 → 透传 stderr 作为 error
    if (exitCode !== 0 && exitCode !== null && !lastEventWasTurn) {
      const stderr = handle.stderr().trim();
      if (stderr) {
        emit({
          type: "error",
          message: `codex exited with code ${exitCode}`,
          stderr: stderr.slice(-2000),
        });
      } else {
        emit({
          type: "error",
          message: `codex exited with code ${exitCode}`,
        });
      }
    }

    // 无任何事件且无 stderr → 通用错误
    if (eventCount === 0 && exitCode === 0) {
      emit({
        type: "error",
        message: "codex produced no output",
        stderr: handle.stderr().trim().slice(-2000) || undefined,
      });
    }
  }, request.signal);
}
