import type { RateLimits, Usage, UsageSnapshot } from "@/types/api";

const USAGE_KEYS: ReadonlyArray<keyof Usage> = [
  "input_tokens",
  "cached_input_tokens",
  "cache_write_input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
];

export function emptyUsage(): Usage {
  return {
    input_tokens: 0,
    cached_input_tokens: 0,
    cache_write_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
  };
}

export function subtractUsage(current: Usage, previous: Usage): Usage {
  const result = emptyUsage();
  for (const key of USAGE_KEYS) {
    result[key] = Math.max(0, current[key] - previous[key]);
  }
  return result;
}

function extractUsage(value: unknown): Usage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  if (typeof source.input_tokens !== "number" && typeof source.output_tokens !== "number") {
    return undefined;
  }
  return {
    input_tokens: numberValue(source.input_tokens),
    cached_input_tokens: numberValue(source.cached_input_tokens),
    cache_write_input_tokens: numberValue(source.cache_write_input_tokens),
    output_tokens: numberValue(source.output_tokens),
    reasoning_output_tokens: numberValue(source.reasoning_output_tokens),
  };
}

/** 将原始 token_count payload 转为前后端共用的权威快照。 */
export function extractUsageSnapshotFromTokenCount(
  payload: Record<string, unknown>,
  updatedAt?: string,
): UsageSnapshot | null {
  const info = isRecord(payload.info) ? payload.info : undefined;
  const totalUsage = extractUsage(info?.total_token_usage);
  const lastUsage =
    extractUsage(info?.last_token_usage) ??
    extractUsage(payload.usage) ??
    extractUsage(payload);
  const contextWindow = numberOrUndefined(info?.model_context_window);
  const rateLimits = extractRateLimits(payload.rate_limits);

  if (!totalUsage && !lastUsage && !contextWindow && !rateLimits) return null;

  return {
    ...(totalUsage ? { totalUsage } : {}),
    ...(lastUsage ? { lastUsage, contextTokens: lastUsage.input_tokens } : {}),
    ...(contextWindow ? { contextWindow } : {}),
    ...(rateLimits ? { rateLimits } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function extractRateLimits(value: unknown): RateLimits | undefined {
  if (!isRecord(value)) return undefined;
  const primary = isRecord(value.primary) ? value.primary : undefined;
  const secondary = isRecord(value.secondary) ? value.secondary : undefined;
  const credits = isRecord(value.credits) ? value.credits : undefined;
  const result: RateLimits = {};

  if (typeof value.limit_id === "string") result.limitId = value.limit_id;
  if (primary) {
    result.primary = {
      usedPercent: numberValue(primary.used_percent),
      ...(numberOrUndefined(primary.window_minutes) !== undefined
        ? { windowMinutes: numberOrUndefined(primary.window_minutes) }
        : {}),
      ...(numberOrUndefined(primary.resets_at) !== undefined
        ? { resetsAt: numberOrUndefined(primary.resets_at) }
        : {}),
    };
  }
  if (secondary) {
    result.secondary = {
      usedPercent: numberValue(secondary.used_percent),
      ...(numberOrUndefined(secondary.window_minutes) !== undefined
        ? { windowMinutes: numberOrUndefined(secondary.window_minutes) }
        : {}),
      ...(numberOrUndefined(secondary.resets_at) !== undefined
        ? { resetsAt: numberOrUndefined(secondary.resets_at) }
        : {}),
    };
  } else if (value.secondary === null) {
    result.secondary = null;
  }
  if (credits) {
    result.credits = {
      hasCredits: Boolean(credits.has_credits),
      unlimited: Boolean(credits.unlimited),
      ...(typeof credits.balance === "string" ? { balance: credits.balance } : {}),
    };
  }
  if (typeof value.plan_type === "string") result.planType = value.plan_type;
  if (
    value.rate_limit_reached_type === null ||
    typeof value.rate_limit_reached_type === "string"
  ) {
    result.rateLimitReachedType = value.rate_limit_reached_type as string | null;
  }

  return result.primary || result.planType ? result : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
