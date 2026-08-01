import { NextRequest } from "next/server";
import type { UsageSnapshotResponse } from "@/types/api";
import { findRolloutFile } from "@/lib/rollout/paths";
import { readLatestUsageSnapshot } from "@/lib/rollout/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!SESSION_ID_RE.test(id)) {
    return Response.json({ error: "invalid session id" }, { status: 400 });
  }

  const filePath = findRolloutFile(id);
  if (!filePath) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }

  const snapshot = await readLatestUsageSnapshot(filePath);
  if (!snapshot) {
    return Response.json({ error: "usage data not available yet" }, { status: 404 });
  }

  const body: UsageSnapshotResponse = { sessionId: id, snapshot };
  return Response.json(body, {
    headers: { "cache-control": "no-store" },
  });
}
