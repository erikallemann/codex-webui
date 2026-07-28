/**
 * codex CLI 错误/警告分类。
 *
 * codex exec --json 的 error 事件与 item.type="error" 既包含真正的致命错误
 * （如 spawn 失败、子进程非 0 退出），也包含非致命警告（如 skills 上下文预算
 * 超限截断提示）。前者应将 session 状态置为 failed，后者仅以黄色卡片提示。
 *
 * 由于 codex CLI 未在事件结构中区分 severity，这里用消息文本匹配已知警告模式。
 */

/**
 * 已知的 codex CLI 非致命警告消息模式。
 *
 * 匹配规则：消息包含任一模式子串即判定为 warning。
 * 这些消息来自 codex CLI 源码，是给用户的提示性信息，不代表执行失败。
 */
const WARNING_PATTERNS: readonly string[] = [
  // codex CLI 的 skills 上下文预算截断提示
  "skills context budget",
  "Skill descriptions were shortened",
  // codex CLI 的 skills 预算超限提示（另一种措辞）
  "skills budget",
];

/** 判断消息是否为非致命警告 */
export function isWarningMessage(message: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return WARNING_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/** 推断 severity：匹配警告模式返回 "warning"，否则 "error" */
export function inferSeverity(message: string): "error" | "warning" {
  return isWarningMessage(message) ? "warning" : "error";
}
