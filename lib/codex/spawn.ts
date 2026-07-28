/**
 * codex 子进程 spawn 封装。
 *
 * 职责：spawn codex 进程，将 stdout 按行切分为 async iterable，提供 kill 与 onExit。
 * 隔离所有 child_process 细节，供 Route Handler 消费。
 *
 * Windows 关键点：
 * - shell:false 安全传参（规避 CVE-2024-27980 类注入）
 * - windowsHide:true 避免控制台弹窗
 * - env 归一化：仅保留一个 PATH（Windows 环境变量不区分大小写，PATH/Path 并存会冲突）
 * - codex.js 入口由 binary.ts 解析为 node + [codex.js]，shell:false 可直接 spawn
 */

import { spawn, type ChildProcess } from "node:child_process";
import { resolveCodexBinary } from "./binary";

/** spawn 返回的句柄 */
export interface CodexSpawnHandle {
  /** stdout 按行迭代的 async generator */
  stdout: AsyncIterable<string>;
  /** stderr 累积的字符串（close 后可用） */
  stderr: () => string;
  /** 终止子进程 */
  kill: () => void;
  /** 子进程退出码（null 表示被信号终止） */
  onExit: Promise<number | null>;
  /** 子进程 PID */
  pid: number | null;
}

/**
 * spawn codex exec 子进程。
 *
 * @param argv codex argv（不含 argvPrefix，如 ['exec','--json',...]）
 * @param cwd 工作目录
 * @param signal AbortSignal，abort 时 kill 子进程
 */
export function spawnCodex(
  argv: string[],
  cwd: string,
  signal: AbortSignal,
  prompt?: string,
): CodexSpawnHandle {
  const bin = resolveCodexBinary();

  const child = spawn(bin.command, [...bin.argvPrefix, ...argv], {
    cwd,
    env: sanitizedEnv(),
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
    windowsHide: true,
  });

  // 如果需要通过 stdin 传 prompt（长 prompt 场景）
  if (prompt && argv[argv.length - 1] === "-") {
    child.stdin?.write(prompt);
    child.stdin?.end();
  } else {
    child.stdin?.end();
  }

  let stderrBuf = "";
  const stdoutQueue: string[] = [];
  let stdoutDone = false;
  let stdoutResolve: (() => void) | null = null;
  let lineBuffer = "";

  // 按行切分 stdout，推入队列
  child.stdout.on("data", (chunk: Buffer) => {
    lineBuffer += chunk.toString("utf8");
    const lines = lineBuffer.split("\n");
    // 最后一段可能不完整，保留
    lineBuffer = lines.pop() ?? "";
    for (const line of lines) {
      stdoutQueue.push(line);
    }
    stdoutResolve?.();
  });

  child.stdout.on("end", () => {
    if (lineBuffer) stdoutQueue.push(lineBuffer);
    lineBuffer = "";
    stdoutDone = true;
    stdoutResolve?.();
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderrBuf += chunk.toString("utf8");
  });

  const onExit = new Promise<number | null>((resolve) => {
    child.on("close", (code, signal) => {
      // 确保 stdout 迭代器能结束
      stdoutDone = true;
      stdoutResolve?.();
      resolve(signal ? null : code);
    });
  });

  // abort 链路：signal 触发时 kill 子进程
  const onAbort = () => {
    if (!child.killed) {
      child.kill();
    }
  };
  signal.addEventListener("abort", onAbort, { once: true });
  onExit.then(() => signal.removeEventListener("abort", onAbort));

  // async iterable：逐行 yield
  const stdoutIterable: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<string>> {
          while (true) {
            if (stdoutQueue.length > 0) {
              return { value: stdoutQueue.shift()!, done: false };
            }
            if (stdoutDone) {
              return { value: undefined, done: true };
            }
            await new Promise<void>((r) => {
              stdoutResolve = r;
            });
            stdoutResolve = null;
          }
        },
      };
    },
  };

  return {
    stdout: stdoutIterable,
    stderr: () => stderrBuf,
    kill: () => {
      if (!child.killed) child.kill();
    },
    onExit,
    pid: child.pid ?? null,
  };
}

/**
 * 归一化环境变量。
 * Windows 上 PATH/Path 并存会导致子进程 PATH 解析异常，仅保留一个。
 * 同时移除可能干扰 codex 的变量（如 FORCE_COLOR）。
 */
function sanitizedEnv(): NodeJS.ProcessEnv {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    // 跳过 Path（仅保留 PATH），Windows 不区分大小写所以都跳过
    if (k.toLowerCase() === "path") continue;
    env[k] = v;
  }
  // 统一 PATH（优先 process.env.PATH，Windows 上也是 PATH 键）
  env.PATH = process.env.PATH ?? process.env.Path ?? "";
  // 禁用 codex 的彩色输出（干扰 JSON 解析）
  env.NO_COLOR = "1";
  env.CLICOLOR = "0";
  env.FORCE_COLOR = "0";
  return env as NodeJS.ProcessEnv;
}

export { ChildProcess };
