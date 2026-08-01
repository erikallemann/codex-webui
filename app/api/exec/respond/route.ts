import { NextRequest } from "next/server";
import type { UserInputResponseRequest } from "@/types/api";
import { normalizeUserInputAnswers } from "@/lib/codex/app-server-events";
import { takeInteraction } from "@/lib/codex/interactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  let body: UserInputResponseRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json body" }, { status: 400 });
  }
  if (!body.interactionId || !body.answers || typeof body.answers !== "object") {
    return Response.json({ error: "interactionId and answers are required" }, { status: 400 });
  }

  const interaction = takeInteraction(body.interactionId);
  if (!interaction) {
    return Response.json({ error: "interaction expired or already answered" }, { status: 404 });
  }

  try {
    interaction.connection.respond(
      interaction.requestId,
      normalizeUserInputAnswers(body.answers),
    );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 409 },
    );
  }
}
