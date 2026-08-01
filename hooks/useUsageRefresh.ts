"use client";

import { useCallback, useState } from "react";
import type { UsageSnapshot, UsageSnapshotResponse } from "@/types/api";
import { useActiveSession } from "@/stores/active-session";

export async function fetchUsageSnapshot(
  sessionId: string,
  signal?: AbortSignal,
): Promise<UsageSnapshot> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/usage`, {
    cache: "no-store",
    signal,
  });
  const body = (await response.json().catch(() => ({}))) as Partial<UsageSnapshotResponse> & {
    error?: string;
  };
  if (!response.ok || !body.snapshot) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body.snapshot;
}

export function useUsageRefresh() {
  const { state, dispatchEvent } = useActiveSession();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!state.threadId) throw new Error("session id is not available yet");
    setIsRefreshing(true);
    try {
      const snapshot = await fetchUsageSnapshot(state.threadId);
      dispatchEvent({ type: "usage.updated", snapshot });
      return snapshot;
    } finally {
      setIsRefreshing(false);
    }
  }, [state.threadId, dispatchEvent]);

  return { refresh, isRefreshing, canRefresh: Boolean(state.threadId) };
}
