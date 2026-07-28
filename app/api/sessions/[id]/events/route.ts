/** GET /api/sessions/[id]/events — 回放会话事件流（SSE） */

import { NextRequest } from "next/server";
import type { SseEvent } from "@/types/api";
import { createSseResponse } from "@/lib/server/sse";
import { findRolloutFile } from "@/lib/rollout/paths";
import { replayRollout } from "@/lib/rollout/replay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const filePath = findRolloutFile(id);
  if (!filePath) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }

  return createSseResponse(async (emit) => {
    try {
      for await (const event of replayRollout(filePath, request.signal)) {
        if (request.signal.aborted) break;
        emit(event as SseEvent);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit({ type: "error", message });
    }
  }, request.signal);
}
