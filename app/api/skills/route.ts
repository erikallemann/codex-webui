/** GET /api/skills — 扫描可用 Skills 列表（用于 /skills @ 补全） */

import { scanSkills } from "@/lib/server/skills";
import type { SkillsResponse } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  const skills = scanSkills();
  const body: SkillsResponse = { skills };
  return Response.json(body);
}
