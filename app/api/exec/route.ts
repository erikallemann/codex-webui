/** POST /api/exec — bridge Codex app-server JSON-RPC to the existing SSE UI. */

import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import type { ExecRequest, Usage } from "@/types/api";
import { createSseResponse } from "@/lib/server/sse";
import { validateExecRequest } from "@/lib/codex/args";
import { AppServerConnection } from "@/lib/codex/app-server";
import {
  mapAppServerItem,
  mapTokenUsage,
  mapUserInputRequest,
  type AppServerUserInputParams,
} from "@/lib/codex/app-server-events";
import {
  clearConnectionInteractions,
  registerInteraction,
} from "@/lib/codex/interactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_USAGE: Usage = {
  input_tokens: 0,
  cached_input_tokens: 0,
  cache_write_input_tokens: 0,
  output_tokens: 0,
  reasoning_output_tokens: 0,
};

export async function POST(request: NextRequest): Promise<Response> {
  let body: Partial<ExecRequest>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json body" }, { status: 400 });
  }

  const validationError = validateExecRequest(body);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });
  const req = body as ExecRequest;

  return createSseResponse(async (emit) => {
    let connection: AppServerConnection;
    try {
      connection = new AppServerConnection(req.cwd, request.signal);
      await connection.initialize();
    } catch (error) {
      emit({ type: "error", message: formatError(error, "app-server startup failed") });
      return;
    }

    let latestUsage = EMPTY_USAGE;
    try {
      const common = {
        cwd: req.cwd,
        model: req.model || null,
        approvalPolicy: req.approvalPolicy === "on-failure" ? "on-request" : req.approvalPolicy,
        // Web UI 目前只呈现结构化问题；权限审批仍交给 Codex 的自动审查器，
        // 避免 app-server 在不可见的 approval request 上挂起。
        approvalsReviewer: "auto_review",
        sandbox: req.sandbox,
      };
      const result = req.resumeSessionId
        ? await connection.request("thread/resume", {
            threadId: req.resumeSessionId,
            ...common,
            excludeTurns: true,
          })
        : await connection.request("thread/start", {
            ...common,
            ephemeral: req.ephemeral ?? false,
          });
      const threadId = readThreadId(result) ?? req.resumeSessionId;
      if (!threadId) throw new Error("app-server returned no thread id");

      emit({ type: "thread.started", thread_id: threadId });
      const activeModel = readString(result, "model") ?? req.model ?? "";
      void connection.request("turn/start", {
        threadId,
        input: [{ type: "text", text: req.prompt, text_elements: [] }],
        cwd: req.cwd,
        model: req.model || null,
        effort: req.effort || null,
        approvalPolicy: common.approvalPolicy,
        approvalsReviewer: common.approvalsReviewer,
        collaborationMode: req.collaborationMode === "plan"
          ? {
              mode: "plan",
              settings: {
                model: activeModel,
                reasoning_effort: req.effort || null,
                developer_instructions: null,
              },
            }
          : undefined,
      }).catch((error) => {
        emit({ type: "error", message: formatError(error, "turn start failed") });
        connection.kill();
      });

      for await (const message of connection.events()) {
        if (request.signal.aborted) break;
        const method = message.method;
        const params = (message.params ?? {}) as Record<string, unknown>;

        if (method === "turn/started") {
          emit({ type: "turn.started", startedAt: readTurnTime(params, "startedAt") });
        } else if (method === "item/completed") {
          const item = params.item as Record<string, unknown> | undefined;
          if (item) {
            for (const mapped of mapAppServerItem(item)) {
              emit({ type: "item.completed", item: mapped, timestamp: new Date().toISOString() });
            }
          }
        } else if (method === "thread/tokenUsage/updated") {
          const snapshot = mapTokenUsage((params.tokenUsage ?? {}) as Parameters<typeof mapTokenUsage>[0]);
          latestUsage = snapshot.lastUsage ?? latestUsage;
          emit({ type: "usage.updated", snapshot });
        } else if (method === "item/tool/requestUserInput" && message.id !== undefined) {
          const interactionId = randomUUID();
          registerInteraction(interactionId, { connection, requestId: message.id });
          emit(mapUserInputRequest(interactionId, params as unknown as AppServerUserInputParams));
        } else if (method === "turn/completed") {
          const turn = (params.turn ?? {}) as Record<string, unknown>;
          if (turn.status === "failed") {
            const error = turn.error as { message?: string } | null;
            emit({ type: "turn.failed", error: error?.message ?? "turn failed" });
          } else {
            emit({
              type: "turn.completed",
              usage: latestUsage,
              startedAt: numberOrUndefined(turn.startedAt),
              completedAt: numberOrUndefined(turn.completedAt),
              durationMs: numberOrUndefined(turn.durationMs),
            });
          }
          break;
        } else if (method === "error") {
          const error = params.error as { message?: string } | undefined;
          emit({ type: "error", message: error?.message ?? String(params.message ?? "Codex error") });
        }
      }
    } catch (error) {
      emit({
        type: "error",
        message: formatError(error, "app-server stream failed"),
        stderr: connection.stderr().trim().slice(-2000) || undefined,
      });
    } finally {
      clearConnectionInteractions(connection);
      connection.kill();
    }
  }, request.signal);
}

function readThreadId(result: unknown): string | null {
  const thread = (result as { thread?: { id?: unknown } } | null)?.thread;
  return typeof thread?.id === "string" ? thread.id : null;
}

function readString(result: unknown, key: string): string | null {
  const value = (result as Record<string, unknown> | null)?.[key];
  return typeof value === "string" ? value : null;
}

function readTurnTime(params: Record<string, unknown>, key: string): number | undefined {
  const turn = params.turn as Record<string, unknown> | undefined;
  return numberOrUndefined(turn?.[key]);
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function formatError(error: unknown, prefix: string): string {
  return `${prefix}: ${error instanceof Error ? error.message : String(error)}`;
}
