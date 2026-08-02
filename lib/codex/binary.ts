/**
 * codex 可执行文件路径解析。
 *
 * Windows 上 codex 通常通过 npm 全局安装（@openai/codex），存在三种垫片：
 * - codex（sh，Unix）
 * - codex.cmd（Windows cmd）
 * - codex.ps1（PowerShell）
 *
 * Node.js `spawn('codex', ...)` 在 Windows 上 `shell:false` 时不按 PATHEXT 解析，
 * 直接 spawn 会 ENOENT。而 `.cmd`/`.ps1` 垫片需要命令解释器，既容易触发安全软件
 * 的 Web 服务器防护，也会引入额外的命令解析风险。
 *
 * 解决方案：绕过垫片，直接用 `node` 运行 `@openai/codex/bin/codex.js`。
 * 这个 JS 入口是平台无关的 launcher，内部根据 process.platform/arch 加载对应的
 * Rust 原生二进制（@openai/codex-win32-x64 等）。
 *
 * 解析优先级：
 * 1. CODEX_BIN 环境变量（用户显式指定，可以是 .exe 或 codex.js 路径）
 * 2. CODEX_JS 环境变量（直接指向 codex.js）
 * 3. npm 全局 node_modules 中的 @openai/codex/bin/codex.js
 * 4. 退化：从 PATH 使用可直接启动的 codex 路径（不经过 shell）
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";

/** 解析结果 */
export interface CodexBinary {
  /** spawn 的目标：node 可执行路径（走 JS 入口）或 codex 二进制 */
  command: string;
  /** argv 前缀：JS 入口时为 [codex.js 路径]，原生二进制时为 [] */
  argvPrefix: string[];
  /** 解析方式，用于调试与错误提示 */
  source: "CODEX_BIN" | "CODEX_JS" | "npm-global" | "fallback";
}

let cached: CodexBinary | null = null;

/**
 * 解析 npm 全局 prefix（npm root -g）。
 * Windows 上通常为 %APPDATA%\npm\node_modules；Unix 上通常为 /usr/local/lib/node_modules。
 */
function npmGlobalRoot(): string | null {
  // Windows 的 npm 入口通常是 npm.cmd。不要为了查询 prefix 而启动
  // cmd.exe；已知的 npm 全局目录足以定位 codex.js。
  if (process.platform === "win32") {
    const prefixes = [
      process.env.npm_config_prefix,
      process.env.NPM_CONFIG_PREFIX,
      process.env.APPDATA ? path.join(process.env.APPDATA, "npm") : null,
    ];
    for (const prefix of prefixes) {
      if (!prefix) continue;
      const guess = path.join(prefix, "node_modules");
      if (existsSync(guess)) return guess;
    }
    return null;
  }

  try {
    const result = spawnSyncSafe("npm", ["root", "-g"]);
    if (result) return result.trim();
  } catch {
    /* ignore */
  }
  return null;
}

/** 同步 spawn 并返回 stdout（用于一次性命令如 npm root -g） */
function spawnSyncSafe(cmd: string, args: string[]): string | null {
  try {
    const result = spawnSync(cmd, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
      shell: false,
    });
    if (result.error || result.status !== 0) return null;
    return result.stdout;
  } catch {
    return null;
  }
}

/** 检测 node 可执行路径（始终用 process.execPath） */
function nodeExecutable(): string {
  return process.execPath;
}

/**
 * 解析 codex 二进制/入口路径并缓存。
 * 抛出 Error 时附带 code 字段供 Route Handler 转换为 HTTP 状态码。
 */
export function resolveCodexBinary(): CodexBinary {
  if (cached) return cached;

  // 1. CODEX_BIN 显式指定（可以是 .exe 或 codex.js）
  const codexBin = process.env.CODEX_BIN;
  if (codexBin && existsSync(codexBin) && !isWindowsCommandShim(codexBin)) {
    if (/\.js$/i.test(codexBin)) {
      cached = {
        command: nodeExecutable(),
        argvPrefix: [codexBin],
        source: "CODEX_BIN",
      };
    } else {
      cached = { command: codexBin, argvPrefix: [], source: "CODEX_BIN" };
    }
    return cached;
  }

  // 2. CODEX_JS 直接指向 codex.js
  const codexJs = process.env.CODEX_JS;
  if (codexJs && existsSync(codexJs)) {
    cached = {
      command: nodeExecutable(),
      argvPrefix: [codexJs],
      source: "CODEX_JS",
    };
    return cached;
  }

  // 3. npm 全局 node_modules/@openai/codex/bin/codex.js
  //    优先检查已知路径（避免 npm root -g 返回非预期路径，如 TRAE 内部 node）
  const globalRoot = npmGlobalRoot();
  const candidates = [
    // Windows: %APPDATA%\npm\node_modules
    ...(process.platform === "win32" && process.env.APPDATA
      ? [path.join(process.env.APPDATA, "npm", "node_modules")]
      : []),
    // Unix: 常见全局 node_modules 路径
    ...(process.platform !== "win32"
      ? ["/usr/local/lib/node_modules", "/usr/lib/node_modules"]
      : []),
    // npm root -g 结果（可能不可靠，放最后）
    ...(globalRoot ? [globalRoot] : []),
  ];

  for (const root of candidates) {
    const jsEntry = path.join(root, "@openai", "codex", "bin", "codex.js");
    if (existsSync(jsEntry)) {
      cached = {
        command: nodeExecutable(),
        argvPrefix: [jsEntry],
        source: "npm-global",
      };
      return cached;
    }
  }

  // 4. 退化：只接受 PATH 中可以直接启动的路径，不执行 .cmd/.ps1 垫片。
  const whichResult = spawnSyncSafe(
    process.platform === "win32" ? "where.exe" : "which",
    ["codex"],
  );
  const directCommand = whichResult
    ?.split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry && !isWindowsCommandShim(entry));
  if (directCommand) {
    cached = {
      command: directCommand,
      argvPrefix: [],
      source: "fallback",
    };
    return cached;
  }

  const err = new Error(
    "codex executable not found. Install @openai/codex globally or set CODEX_BIN/CODEX_JS env var.",
  ) as Error & { code?: string };
  err.code = "CODEX_NOT_FOUND";
  throw err;
}

/** 供测试用：清除缓存 */
export function _clearCache(): void {
  cached = null;
}

function isWindowsCommandShim(target: string): boolean {
  return process.platform === "win32" && /\.(?:cmd|bat|ps1)$/i.test(target);
}

export { homedir };
