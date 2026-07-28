"use client";

/**
 * useSessionList — SWR 拉取历史会话列表。
 */

import useSWR from "swr";
import type { ThreadItem } from "@/types/api";

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<{
  items: ThreadItem[];
}>;

export function useSessionList(cwd?: string, q?: string) {
  const params = new URLSearchParams();
  if (cwd) params.set("cwd", cwd);
  if (q) params.set("q", q);
  params.set("limit", "100");
  const key = `/api/sessions?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3000,
  });

  return {
    sessions: data?.items ?? [],
    error,
    isLoading,
    mutate,
  };
}
