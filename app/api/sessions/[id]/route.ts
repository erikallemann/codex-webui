/** GET /api/sessions/[id] — 会话元数据 */

import { NextRequest } from "next/server";
import { getSessionMeta } from "@/lib/rollout/list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  try {
    const result = await getSessionMeta(id);
    if (!result) {
      return Response.json({ error: "session not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
