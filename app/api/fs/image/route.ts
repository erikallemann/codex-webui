import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { codexHome } from "@/lib/rollout/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(request: NextRequest): Promise<Response> {
  const requestedPath = request.nextUrl.searchParams.get("path");
  if (!requestedPath) {
    return Response.json({ error: "missing image path" }, { status: 400 });
  }

  try {
    const root = await realpath(path.join(codexHome(), "visualizations"));
    const target = await realpath(path.resolve(requestedPath));
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return Response.json({ error: "image path is outside Codex visualizations" }, { status: 403 });
    }

    const contentType = IMAGE_TYPES[path.extname(target).toLowerCase()];
    const info = await stat(target);
    if (!contentType || !info.isFile()) {
      return Response.json({ error: "unsupported image" }, { status: 415 });
    }

    const data = await readFile(target);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(data.byteLength),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "image not found" }, { status: 404 });
  }
}
