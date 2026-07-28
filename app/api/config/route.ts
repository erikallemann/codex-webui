/** GET /api/config — 模型/策略枚举与默认值 */

import { getConfigResponse } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(getConfigResponse());
}
