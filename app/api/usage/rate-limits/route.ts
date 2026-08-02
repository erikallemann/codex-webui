import { listSessions } from "@/lib/rollout/list";
import { findRolloutFile } from "@/lib/rollout/paths";
import { readLatestUsageSnapshot } from "@/lib/rollout/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 从最近更新的 rollout 中恢复账号级限额。
 *
 * 额度本身并不属于某一个会话；这里只在浏览器还没有缓存时提供初始显示值。
 */
export async function GET(): Promise<Response> {
  const sessions = await listSessions({ limit: 100 });

  for (const session of sessions) {
    const filePath = findRolloutFile(session.id);
    if (!filePath) continue;

    const snapshot = await readLatestUsageSnapshot(filePath);
    if (!snapshot?.rateLimits) continue;

    return Response.json(
      { rateLimits: snapshot.rateLimits, observedAt: session.updatedAt },
      { headers: { "cache-control": "no-store" } },
    );
  }

  return Response.json(
    { rateLimits: null },
    { status: 404, headers: { "cache-control": "no-store" } },
  );
}
