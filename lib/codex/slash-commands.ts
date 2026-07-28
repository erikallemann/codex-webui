/**
 * Codex CLI slash 命令注册表。
 *
 * codex CLI TUI 支持斜杠命令（如 /goal、/plan、/skills），但 `codex exec --json`
 * 是非交互模式，不会处理 slash 命令——它们会被当作普通 prompt 发给模型。
 *
 * 这里的注册表用于 Web UI 的输入框自动补全：
 * - 用户输入 "/" 时弹出命令列表
 * - 选中命令后插入到输入框，用户可追加参数后发送
 * - 少数命令（如 /clear）在 Web UI 侧直接执行，不发给 codex
 *
 * 命令列表基于 codex CLI 0.145.0（2026-07）。codex 更新较快，
 * 新命令可能随时加入——如需扩展，在此数组追加即可。
 */

export interface SlashCommand {
  /** 命令名（含前导 /），如 "/goal" */
  name: string;
  /** 简短描述（中文） */
  description: string;
  /** 用法示例，如 "/goal <objective>" */
  usage?: string;
  /**
   * 执行方式：
   * - "local"：Web UI 侧直接执行（如 /clear 清空会话），不发送到 codex
   * - "prompt"：作为 prompt 发送到 codex exec（模型会理解 slash 命令语义）
   */
  execute: "local" | "prompt";
}

/**
 * 已知的 codex CLI slash 命令。
 *
 * 排序：按名称字母序。UI 侧按用户输入前缀过滤后保持此顺序。
 */
export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    name: "/approvals",
    description: "设置命令审批策略（untrusted / on-failure / on-request / never）",
    usage: "/approvals <policy>",
    execute: "prompt",
  },
  {
    name: "/architect",
    description: "切换到 Architect 模式（只规划不执行）",
    execute: "prompt",
  },
  {
    name: "/clear",
    description: "清空当前会话历史，开始新对话",
    execute: "local",
  },
  {
    name: "/compact",
    description: "压缩对话历史，释放上下文空间",
    execute: "prompt",
  },
  {
    name: "/diff",
    description: "查看当前工作区与上次提交的 git diff",
    execute: "prompt",
  },
  {
    name: "/goal",
    description: "设置或管理长期目标（需开启 features.goals）",
    usage: "/goal <objective> | /goal pause | /goal resume | /goal clear",
    execute: "prompt",
  },
  {
    name: "/help",
    description: "显示可用命令与帮助信息",
    execute: "prompt",
  },
  {
    name: "/init",
    description: "在当前项目初始化 AGENTS.md 配置文件",
    execute: "prompt",
  },
  {
    name: "/mode",
    description: "切换协作模式（independent / collaborative）",
    usage: "/mode <mode>",
    execute: "prompt",
  },
  {
    name: "/model",
    description: "切换模型（如 gpt-5.6-sol、o4-mini 等）",
    usage: "/model <name>",
    execute: "prompt",
  },
  {
    name: "/plan",
    description: "切换到 Plan 模式（只规划不执行，用于复杂任务）",
    execute: "prompt",
  },
  {
    name: "/review",
    description: "对当前仓库执行代码审查",
    execute: "prompt",
  },
  {
    name: "/sandbox",
    description: "设置沙箱模式（read-only / workspace-write / danger-full-access）",
    usage: "/sandbox <mode>",
    execute: "prompt",
  },
  {
    name: "/skills",
    description: "列出当前可用的 Skills 及其描述",
    execute: "prompt",
  },
  {
    name: "/status",
    description: "显示当前会话状态、模型、用量等信息",
    execute: "prompt",
  },
] as const;

/**
 * 按前缀过滤 slash 命令。
 *
 * @param prefix 用户已输入的前缀（如 "/go"），为空或仅 "/" 时返回全部
 * @returns 匹配的命令列表（保持原始顺序）
 */
export function filterSlashCommands(prefix: string): SlashCommand[] {
  if (!prefix || prefix === "/") return [...SLASH_COMMANDS];
  const lower = prefix.toLowerCase();
  return SLASH_COMMANDS.filter((cmd) =>
    cmd.name.toLowerCase().startsWith(lower),
  );
}
