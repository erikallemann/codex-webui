let activeController: AbortController | null = null;

/** 注册唯一活动流；新流开始时终止旧流。 */
export function claimActiveStream(controller: AbortController): void {
  if (activeController && activeController !== controller) {
    activeController.abort();
  }
  activeController = controller;
}

export function isActiveStream(controller: AbortController): boolean {
  return activeController === controller;
}

export function releaseActiveStream(controller: AbortController): void {
  if (activeController === controller) activeController = null;
}

/** 任意组件都可以停止当前 exec 或 replay 流。 */
export function abortActiveStream(): void {
  activeController?.abort();
}
