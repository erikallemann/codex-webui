"use client";

/**
 * useSkills — SWR 拉取可用 skills 列表（GET /api/skills）。
 *
 * 用于 /skills @ 补全：Composer 输入 /skills @ 时弹出 skill 下拉菜单。
 * 列表相对稳定（仅在用户安装/卸载 skill 或插件后变化），使用较长 revalidate 间隔。
 */

import useSWR from "swr";
import type { SkillsResponse, SkillInfo } from "@/types/api";

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<SkillsResponse>;

export function useSkills() {
  const { data, error, isLoading } = useSWR<SkillsResponse>(
    "/api/skills",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // 1 分钟内去重
    },
  );

  return {
    skills: (data?.skills ?? []) as SkillInfo[],
    error,
    isLoading,
  };
}
