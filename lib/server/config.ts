/**
 * 默认配置与枚举。
 *
 * 模型列表从 ~/.codex/models_cache.json 读取（codex CLI 维护的可用模型缓存）。
 * effort 列表从模型的 supported_reasoning_levels 汇总，并提供全局常用级别。
 * sandbox / approval 枚举与 types/api.ts 对齐。
 *
 * 同时读取 ~/.codex/config.toml 获取用户默认 model / model_reasoning_effort。
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type {
  ConfigResponse,
  SandboxMode,
  ApprovalPolicy,
  ModelOption,
  EffortOption,
} from "@/types/api";
import { codexHome } from "@/lib/rollout/paths";

export const SANDBOXES: readonly SandboxMode[] = [
  "read-only",
  "workspace-write",
  "danger-full-access",
] as const;

export const APPROVALS: readonly ApprovalPolicy[] = [
  "never",
  "on-failure",
  "on-request",
  "untrusted",
] as const;

/**
 * 全局 effort 级别（覆盖所有模型可能支持的级别）。
 *
 * 顺序与 codex TUI `/model` 命令一致：low → medium → high → xhigh → ultra → max。
 * `minimal` 仅在模型显式支持且用户在 [desktop].enabled-reasoning-efforts 中启用时才出现。
 */
export const EFFORTS: readonly EffortOption[] = [
  { value: "minimal", label: "minimal", description: "最快响应，最轻推理" },
  { value: "low", label: "low", description: "快速响应，轻量推理" },
  { value: "medium", label: "medium", description: "速度与推理深度平衡" },
  { value: "high", label: "high", description: "更深推理，适合复杂问题" },
  { value: "xhigh", label: "xhigh", description: "额外深度推理" },
  { value: "ultra", label: "ultra", description: "最大推理 + 自动任务委派" },
  { value: "max", label: "max", description: "最大推理深度" },
] as const;

/** models_cache.json 中单个模型条目的结构（仅提取需要的字段） */
interface CachedModel {
  slug: string;
  display_name: string;
  description?: string;
  default_reasoning_level?: string;
  supported_reasoning_levels?: Array<{ effort: string; description?: string }>;
  context_window?: number;
  visibility?: string;
  supported_in_api?: boolean;
}

interface ModelsCache {
  models?: CachedModel[];
}

/** 读取 ~/.codex/models_cache.json */
function readModelsCache(): CachedModel[] {
  const filePath = path.join(codexHome(), "models_cache.json");
  try {
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as ModelsCache;
    return data.models ?? [];
  } catch {
    return [];
  }
}

/** 从 ~/.codex/config.toml 提取默认 model / model_reasoning_effort / sandbox_mode / approval_policy / enabled-reasoning-efforts */
function readCodexConfig(): {
  model?: string;
  effort?: string;
  sandbox?: SandboxMode;
  approval?: ApprovalPolicy;
  /** [desktop].enabled-reasoning-efforts：用户启用的 effort 级别白名单 */
  enabledEfforts?: string[];
} {
  const filePath = path.join(codexHome(), "config.toml");
  const result: {
    model?: string;
    effort?: string;
    sandbox?: SandboxMode;
    approval?: ApprovalPolicy;
    enabledEfforts?: string[];
  } = {};
  try {
    if (!existsSync(filePath)) return result;
    const raw = readFileSync(filePath, "utf8");
    // 简易解析：仅提取顶层键值
    const modelMatch = raw.match(/^model\s*=\s*"([^"]+)"/m);
    if (modelMatch) result.model = modelMatch[1];
    const effortMatch = raw.match(/^model_reasoning_effort\s*=\s*"([^"]+)"/m);
    if (effortMatch) result.effort = effortMatch[1];
    const sandboxMatch = raw.match(/^sandbox_mode\s*=\s*"([^"]+)"/m);
    if (sandboxMatch && (SANDBOXES as readonly string[]).includes(sandboxMatch[1])) {
      result.sandbox = sandboxMatch[1] as SandboxMode;
    }
    const approvalMatch = raw.match(/^approval_policy\s*=\s*"([^"]+)"/m);
    if (approvalMatch && (APPROVALS as readonly string[]).includes(approvalMatch[1])) {
      result.approval = approvalMatch[1] as ApprovalPolicy;
    }

    // 解析 [desktop].enabled-reasoning-efforts = ["low", "medium", ...]
    // 定位 [desktop] 节，然后在节内查找 enabled-reasoning-efforts 数组
    const desktopSection = extractTomlSection(raw, "desktop");
    if (desktopSection) {
      const arrMatch = desktopSection.match(
        /^enabled-reasoning-efforts\s*=\s*\[([^\]]*)\]/m,
      );
      if (arrMatch) {
        const arr = arrMatch[1]
          .split(",")
          .map((s) => s.trim().replace(/^"|"$/g, ""))
          .filter(Boolean);
        if (arr.length > 0) result.enabledEfforts = arr;
      }
    }
  } catch {
    // ignore
  }
  return result;
}

/**
 * 从 TOML 文本中提取指定节的内容。
 *
 * 例如 extractTomlSection(raw, "desktop") 返回 [desktop] 与下一个 [section] 之间的文本。
 * 支持节名带引号、点号路径（如 [desktop.open-in-target] 视为子节，不匹配顶层 [desktop]）。
 * 若节不存在返回 null。
 */
function extractTomlSection(raw: string, section: string): string | null {
  // 匹配 [section]（行首，允许前后空白），不匹配 [section.subsection]
  const sectionRegex = new RegExp(
    `^\\s*\\[${section.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\]\\s*$`,
    "m",
  );
  const match = sectionRegex.exec(raw);
  if (!match) return null;
  const start = match.index + match[0].length;
  // 找下一个顶层节（[xxx]）
  const nextSectionRegex = /^\s*\[[^\]]+\]\s*$/gm;
  nextSectionRegex.lastIndex = start;
  const nextMatch = nextSectionRegex.exec(raw);
  const end = nextMatch ? nextMatch.index : raw.length;
  return raw.slice(start, end);
}

/**
 * 从模型列表汇总所有出现过的 effort 级别（保持 EFFORTS 顺序）。
 *
 * 过滤规则：
 * 1. 若用户在 [desktop].enabled-reasoning-efforts 中配置了白名单，仅保留白名单内的级别
 * 2. 否则返回所有模型支持的级别
 */
function collectEfforts(
  models: CachedModel[],
  enabledEfforts?: string[],
): EffortOption[] {
  const seen = new Set<string>();
  for (const m of models) {
    if (m.supported_reasoning_levels) {
      for (const lvl of m.supported_reasoning_levels) {
        if (lvl.effort) seen.add(lvl.effort);
      }
    }
  }

  // 若用户配置了 enabled-reasoning-efforts，仅保留白名单内且模型支持的级别
  const allowSet = enabledEfforts && enabledEfforts.length > 0
    ? new Set(enabledEfforts)
    : null;

  // 优先返回全局 EFFORTS 中（模型支持 ∩ 用户白名单）的级别，再追加未列出的
  const ordered = EFFORTS.filter((e) => {
    if (!seen.has(e.value)) return false;
    if (allowSet && !allowSet.has(e.value)) return false;
    return true;
  });
  for (const v of seen) {
    if (allowSet && !allowSet.has(v)) continue;
    if (!ordered.find((e) => e.value === v)) {
      ordered.push({ value: v, label: v });
    }
  }
  // 若无模型数据，返回用户白名单（若无白名单则返回全部全局 effort）
  if (ordered.length === 0) {
    if (allowSet) {
      return EFFORTS.filter((e) => allowSet.has(e.value));
    }
    return [...EFFORTS];
  }
  return ordered;
}

/** 构建模型选项列表（仅 visibility=list 的模型） */
function buildModelOptions(
  models: CachedModel[],
  enabledEfforts?: string[],
): ModelOption[] {
  const allowSet = enabledEfforts && enabledEfforts.length > 0
    ? new Set(enabledEfforts)
    : null;

  const visible = models.filter(
    (m) => m.visibility !== "hide" && m.supported_in_api !== false,
  );
  if (visible.length === 0) {
    // 回退到硬编码默认
    return [
      { value: "gpt-5-codex", label: "gpt-5-codex", description: "Codex 默认模型" },
    ];
  }
  return visible.map((m) => {
    const supported = m.supported_reasoning_levels?.map((l) => l.effort) ?? [];
    // 过滤模型支持的 effort：若用户有白名单，仅保留白名单内的
    const filteredEfforts = allowSet
      ? supported.filter((e) => allowSet.has(e))
      : supported;
    return {
      value: m.slug,
      label: m.display_name || m.slug,
      description: m.description,
      contextWindow: m.context_window,
      defaultEffort: m.default_reasoning_level,
      supportedEfforts: filteredEfforts,
    };
  });
}

export function getConfigResponse(): ConfigResponse {
  const cached = readModelsCache();
  const userConfig = readCodexConfig();
  const models = buildModelOptions(cached, userConfig.enabledEfforts);
  const efforts = collectEfforts(cached, userConfig.enabledEfforts);

  // 默认 model：config.toml 的 model > 第一个可用模型 > undefined
  const defaultModel = userConfig.model ?? models[0]?.value;
  // 默认 effort：config.toml 的 model_reasoning_effort > 第一个模型的 default_effort > "medium"
  const defaultEffort =
    userConfig.effort ??
    models.find((m) => m.value === defaultModel)?.defaultEffort ??
    "medium";

  return {
    models,
    efforts,
    sandboxes: [...SANDBOXES],
    approvals: [...APPROVALS],
    defaults: {
      model: defaultModel,
      effort: defaultEffort,
      sandbox: userConfig.sandbox ?? "read-only",
      approvalPolicy: userConfig.approval ?? "never",
    },
  };
}
