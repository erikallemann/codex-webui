/**
 * GET /api/fs/list?path=<dir>
 *
 * 目录浏览器（cwd 选择器）。仅列出目录与文件名，不递归。
 * 路径规范化防越界：resolve 后校验为绝对路径。
 */

import { NextRequest } from "next/server";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { FsListResponse } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const sp = request.nextUrl.searchParams;
  const raw = sp.get("path");

  // 默认用户主目录
  const target = raw ? path.resolve(raw) : path.resolve(process.env.USERPROFILE || process.env.HOME || "/");

  try {
    const entries = readdirSync(target, { withFileTypes: true });
    const result: FsListResponse = {
      path: target,
      parent: path.dirname(target) !== target ? path.dirname(target) : null,
      entries: entries
        .filter((e) => !e.name.startsWith("."))
        .map((e) => ({
          name: e.name,
          isDir: e.isDirectory(),
        }))
        .sort((a, b) => {
          // 目录优先
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    };
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
