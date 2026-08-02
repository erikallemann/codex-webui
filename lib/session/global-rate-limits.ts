import type { RateLimits } from "@/types/api";

/** 浏览器内保存账号级额度的键；会话上下文不写入这里。 */
export const GLOBAL_RATE_LIMITS_STORAGE_KEY = "codex-webui-global-rate-limits-v1";

type RateLimitStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 从浏览器缓存恢复最近一次实时额度。 */
export function loadCachedRateLimits(storage: Pick<Storage, "getItem"> | null): RateLimits | null {
  try {
    const raw = storage?.getItem(GLOBAL_RATE_LIMITS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as RateLimits) : null;
  } catch {
    return null;
  }
}

/** 缓存账号级额度，供刷新后的页面恢复；存储不可用时静默降级。 */
export function saveCachedRateLimits(
  storage: RateLimitStorage | null,
  rateLimits: RateLimits | null,
): void {
  try {
    if (!storage) return;
    if (rateLimits) {
      storage.setItem(GLOBAL_RATE_LIMITS_STORAGE_KEY, JSON.stringify(rateLimits));
    } else {
      storage.removeItem(GLOBAL_RATE_LIMITS_STORAGE_KEY);
    }
  } catch {
    // 隐私模式或浏览器策略禁用 localStorage 时，保留内存中的实时值即可。
  }
}
