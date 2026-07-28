/**
 * ExecRequest → codex argv 构造。
 *
 * 纯函数，输入输出可单测。构造的 argv 直接传给 spawn(command, [...argvPrefix, ...argv], ...)。
 *
 * 两种分支：
 * - 新建会话：codex exec --json [策略] [模型] [cwd] "<prompt>"
 * - 续接会话：codex exec resume <SESSION_ID> --json [策略] "<prompt>"
 *
 * 审批策略通过 -c approval_policy=<value> 传递（codex 无独立 --approval-policy flag）。
 */

import type { ExecRequest, SandboxMode, ApprovalPolicy } from "@/types/api";

/** argv 项类型 */
export type Argv = string[];

/** 构造策略相关 argv（sandbox + approval + 可选 model + effort + cwd + skip-git + ephemeral） */
function buildPolicyArgs(req: ExecRequest): Argv {
  const args: Argv = [
    "--sandbox",
    req.sandbox,
    "-c",
    `approval_policy=${req.approvalPolicy}`,
  ];

  if (req.model) {
    args.push("-m", req.model);
  }
  // 推理努力级别：通过 -c model_reasoning_effort=<value> 传递（codex 无独立 flag）
  if (req.effort) {
    args.push("-c", `model_reasoning_effort=${req.effort}`);
  }
  if (req.cwd) {
    args.push("-C", req.cwd);
  }
  if (req.skipGitRepoCheck ?? true) {
    // 默认跳过 git 检查（web-ui 场景 cwd 可能非 git 仓库）
    args.push("--skip-git-repo-check");
  }
  if (req.ephemeral) {
    args.push("--ephemeral");
  }
  return args;
}

/**
 * 构造完整 codex argv（不含 argvPrefix，调用方需 prepend）。
 *
 * @returns argv 数组，元素均为字符串，已做长度安全处理
 * @throws Error 当 prompt 为空或过长
 */
export function buildExecArgv(req: ExecRequest): Argv {
  const prompt = req.prompt?.trim();
  if (!prompt) {
    throw new Error("prompt is required");
  }

  const args: Argv = ["exec"];

  if (req.resumeSessionId) {
    args.push("resume", req.resumeSessionId);
  }

  args.push("--json");

  // 策略参数（resume 与新建都支持叠加）
  args.push(...buildPolicyArgs(req));

  // prompt 作为最后一个位置参数
  // Windows argv 单项有 32KB 限制；超长 prompt 走 stdin（传 "-" 并用 child.stdin.write）
  if (prompt.length > 30000) {
    args.push("-");
  } else {
    args.push(prompt);
  }

  return args;
}

/** 是否需要通过 stdin 传 prompt（长 prompt 场景） */
export function needsStdin(req: ExecRequest): boolean {
  return (req.prompt?.trim().length ?? 0) > 30000;
}

/** 合法的 sandbox 值（运行时校验） */
export const VALID_SANDBOXES: readonly SandboxMode[] = [
  "read-only",
  "workspace-write",
  "danger-full-access",
] as const;

/** 合法的 approval 值（运行时校验） */
export const VALID_APPROVALS: readonly ApprovalPolicy[] = [
  "never",
  "on-failure",
  "on-request",
  "untrusted",
] as const;

/** 校验 ExecRequest 字段合法性，返回错误消息或 null */
export function validateExecRequest(req: Partial<ExecRequest>): string | null {
  if (!req.prompt || !req.prompt.trim()) return "prompt is required";
  if (!req.cwd) return "cwd is required";
  if (!req.sandbox || !VALID_SANDBOXES.includes(req.sandbox)) {
    return `invalid sandbox: ${req.sandbox}`;
  }
  if (!req.approvalPolicy || !VALID_APPROVALS.includes(req.approvalPolicy)) {
    return `invalid approvalPolicy: ${req.approvalPolicy}`;
  }
  return null;
}
