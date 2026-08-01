import type { UsageSnapshot } from "@/types/api";
import { extractUsageSnapshotFromTokenCount } from "@/lib/codex/usage-snapshot";
import { readRolloutLines } from "./reader";

/** 扫描 rollout，返回最后一个 token_count 快照。 */
export async function readLatestUsageSnapshot(
  filePath: string,
): Promise<UsageSnapshot | null> {
  let latest: UsageSnapshot | null = null;
  for await (const line of readRolloutLines(filePath)) {
    if (line.type !== "event_msg") continue;
    const payload = line.payload as { type?: string; [key: string]: unknown };
    if (payload.type !== "token_count") continue;
    latest = extractUsageSnapshotFromTokenCount(payload, line.timestamp) ?? latest;
  }
  return latest;
}
