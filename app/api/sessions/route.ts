/** GET /api/sessions — 列出历史会话 */

import { NextRequest } from "next/server";
import { listSessions } from "@/lib/rollout/list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const sp = request.nextUrl.searchParams;
  const cwd = sp.get("cwd") || undefined;
  const q = sp.get("q") || undefined;
  const limit = sp.get("limit") ? Number(sp.get("limit")) : undefined;

  try {
    const items = await listSessions({ cwd, q, limit });
    return Response.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
