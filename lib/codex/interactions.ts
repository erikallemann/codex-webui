import type { AppServerConnection } from "./app-server";

interface PendingInteraction {
  connection: AppServerConnection;
  requestId: number | string;
}

const globalKey = Symbol.for("codex-webui.pending-interactions");
const scope = globalThis as typeof globalThis & {
  [globalKey]?: Map<string, PendingInteraction>;
};
const pending = scope[globalKey] ?? new Map<string, PendingInteraction>();
scope[globalKey] = pending;

export function registerInteraction(
  interactionId: string,
  interaction: PendingInteraction,
): void {
  pending.set(interactionId, interaction);
}

export function takeInteraction(interactionId: string): PendingInteraction | null {
  const interaction = pending.get(interactionId) ?? null;
  if (interaction) pending.delete(interactionId);
  return interaction;
}

export function clearConnectionInteractions(connection: AppServerConnection): void {
  for (const [id, interaction] of pending) {
    if (interaction.connection === connection) pending.delete(id);
  }
}
