/**
 * Decide which preference scope a project selection should update.
 *
 * A project may contain the currently active session. In that case changing
 * the project's cwd should correct that session's preference without
 * discarding its replay. Otherwise the selection starts a fresh session and
 * writes the cwd to the new-session default scope.
 */

export interface ProjectSelection {
  targetSessionId: string | null;
  resetSession: boolean;
}
export function resolveProjectSelection(
  activeSessionId: string | null,
  projectSessionIds: readonly string[],
): ProjectSelection {
  if (activeSessionId && projectSessionIds.includes(activeSessionId)) {
    return { targetSessionId: activeSessionId, resetSession: false };
  }
  return { targetSessionId: null, resetSession: true };
}
