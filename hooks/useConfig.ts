"use client";

/**
 * useConfig — SWR 拉取模型/策略枚举与默认值，管理每会话独立的偏好。
 *
 * 偏好（prefs）持久化到 localStorage，结构为：
 * {
 *   version: 3,
 *   default: SessionPrefs,           // 新会话默认偏好
 *   sessions: { [id]: SessionPrefs } // 各历史会话的独立偏好
 * }
 *
 * 当 resumeSessionId 存在时（回放/续接历史会话），返回该会话的独立偏好；
 * 否则返回 default。任一组件 updatePrefs 后，所有 useConfig 消费者同步重渲染。
 *
 * Why SWR 而非 useState：useConfig 被多个组件（ConfigPanel / EmptyState /
 * Composer / TopBar）独立调用，useState 是组件本地态无法跨实例同步；SWR 的
 * 全局缓存 + mutate 天然解决多实例共享问题，无需额外 Context Provider。
 */

import useSWR from "swr";
import { useEffect, useCallback, useMemo } from "react";
import type { ConfigResponse, SandboxMode, ApprovalPolicy } from "@/types/api";
import { useActiveSession } from "@/stores/active-session";

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<ConfigResponse>;

export interface SessionPrefs {
  /** 偏好结构版本号，用于在 schema 变更时强制同步 config.toml 默认值 */
  version?: number;
  model?: string;
  /** 推理努力级别（minimal/low/medium/high/xhigh/max/ultra） */
  effort?: string;
  sandbox: SandboxMode;
  approvalPolicy: ApprovalPolicy;
  cwd: string;
}

/** localStorage 键（v3：每会话独立偏好） */
const PREFS_KEY_V3 = "codex-webui-prefs-v3";
/** 旧版 localStorage 键（v2：全局单一偏好） */
const PREFS_KEY_V2 = "codex-webui-prefs";
/** SWR 缓存键（与 localStorage 同步） */
const PREFS_SWR_KEY = "local:prefs-store-v3";
/**
 * 当前偏好版本号。
 *
 * 版本演进：
 * - v1: 初始版本，sandbox/approval 首次初始化后持久化，config.toml 变更不会同步
 * - v2: sandbox/approval 在版本升级时强制用 config.toml 默认值覆盖
 * - v3: 每会话独立偏好（default + sessions map）
 */
const CURRENT_PREFS_VERSION = 3;

/** 偏好存储结构 */
interface PrefsStore {
  version: number;
  /** 新会话默认偏好 */
  default: SessionPrefs;
  /** 各历史会话的独立偏好 */
  sessions: Record<string, SessionPrefs>;
}

function readPrefsStore(): PrefsStore | null {
  if (typeof window === "undefined") return null;
  try {
    // 优先读 v3
    const raw = localStorage.getItem(PREFS_KEY_V3);
    if (raw) {
      return JSON.parse(raw) as PrefsStore;
    }
    // 迁移 v2 → v3
    const oldRaw = localStorage.getItem(PREFS_KEY_V2);
    if (oldRaw) {
      const oldPrefs = JSON.parse(oldRaw) as SessionPrefs;
      const store: PrefsStore = {
        version: CURRENT_PREFS_VERSION,
        default: { ...oldPrefs, version: CURRENT_PREFS_VERSION },
        sessions: {},
      };
      localStorage.setItem(PREFS_KEY_V3, JSON.stringify(store));
      return store;
    }
    return null;
  } catch {
    return null;
  }
}

function savePrefsStore(store: PrefsStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY_V3, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function useConfig() {
  const { state } = useActiveSession();
  const sessionId = state.resumeSessionId;
  const sessionMeta = state.sessionMeta;

  const { data: config, error, isLoading } = useSWR("/api/config", fetcher, {
    revalidateOnFocus: false,
  });

  // prefs store 用 SWR 共享：同一缓存键下所有调用方拿到同一份数据
  const { data: store, mutate: mutateStore } = useSWR<PrefsStore | null>(
    PREFS_SWR_KEY,
    readPrefsStore,
    { fallbackData: null },
  );

  // 远端 config 就绪后同步 store：
  // - 无 store：用 config 默认值初始化
  // - 版本过旧：升级 default 的 sandbox/approval 到 config.toml 默认值
  useEffect(() => {
    if (!config) return;

    if (!store) {
      const initialStore: PrefsStore = {
        version: CURRENT_PREFS_VERSION,
        default: {
          version: CURRENT_PREFS_VERSION,
          model: config.defaults.model,
          effort: config.defaults.effort,
          sandbox: config.defaults.sandbox,
          approvalPolicy: config.defaults.approvalPolicy,
          cwd: "",
        },
        sessions: {},
      };
      savePrefsStore(initialStore);
      void mutateStore(initialStore, { revalidate: false });
      return;
    }

    if (!store.version || store.version < CURRENT_PREFS_VERSION) {
      const upgraded: PrefsStore = {
        ...store,
        version: CURRENT_PREFS_VERSION,
        default: {
          ...store.default,
          version: CURRENT_PREFS_VERSION,
          sandbox: config.defaults.sandbox,
          approvalPolicy: config.defaults.approvalPolicy,
        },
      };
      savePrefsStore(upgraded);
      void mutateStore(upgraded, { revalidate: false });
    }
  }, [config, store, mutateStore]);

  // 派生当前会话的偏好
  const prefs = useMemo<SessionPrefs | null>(() => {
    if (!store) return null;

    // 有 resumeSessionId：返回该会话的独立偏好
    if (sessionId) {
      // 已有存储的会话偏好
      if (store.sessions[sessionId]) {
        return store.sessions[sessionId];
      }
      // 未存储：从 default + sessionMeta.cwd 初始化（不写入 store，等用户修改时才写入）
      if (sessionMeta) {
        return {
          ...store.default,
          cwd: sessionMeta.cwd || store.default.cwd,
        };
      }
      return store.default;
    }

    // 无 resumeSessionId：返回 default
    return store.default;
  }, [store, sessionId, sessionMeta]);

  const updatePrefs = useCallback(
    (patch: Partial<SessionPrefs>) => {
      void mutateStore(
        (prev) => {
          const baseStore: PrefsStore = prev ?? {
            version: CURRENT_PREFS_VERSION,
            default: {
              version: CURRENT_PREFS_VERSION,
              model: config?.defaults.model,
              effort: config?.defaults.effort,
              sandbox: config?.defaults.sandbox ?? "read-only",
              approvalPolicy: config?.defaults.approvalPolicy ?? "never",
              cwd: "",
            },
            sessions: {},
          };

          if (sessionId) {
            // 更新会话独立偏好
            const currentSessionPrefs: SessionPrefs =
              baseStore.sessions[sessionId] ??
              (sessionMeta
                ? { ...baseStore.default, cwd: sessionMeta.cwd || baseStore.default.cwd }
                : { ...baseStore.default });
            const updated: SessionPrefs = { ...currentSessionPrefs, ...patch };
            const nextStore: PrefsStore = {
              ...baseStore,
              sessions: { ...baseStore.sessions, [sessionId]: updated },
            };
            savePrefsStore(nextStore);
            return nextStore;
          }

          // 无 sessionId：更新 default
          const updatedDefault: SessionPrefs = { ...baseStore.default, ...patch };
          const nextStore: PrefsStore = { ...baseStore, default: updatedDefault };
          savePrefsStore(nextStore);
          return nextStore;
        },
        { revalidate: false },
      );
    },
    [mutateStore, config, sessionId, sessionMeta],
  );

  return {
    config,
    error,
    isLoading,
    prefs: prefs ?? null,
    updatePrefs,
  };
}
