"use client";

/**
 * SessionList — 历史会话列表。
 *
 * SWR 拉取，点击加载回放。按 cwd（项目）分组展示，组标题显示项目名。
 *
 * 项目文件夹交互：
 * - 点击项目：将 cwd 切换为该项目；若当前会话不属于该项目则开启新会话
 * - 悬停时右侧显示「+」新建对话按钮：设置 cwd 并 RESET 会话
 * - 点击历史会话：先把该会话的 cwd 写入其独立偏好，再开始回放
 * - 右键弹出上下文菜单：新建对话
 */

import { useSessionList } from "@/hooks/useSessionList";
import { useReplayStream } from "@/hooks/useReplayStream";
import { useConfig } from "@/hooks/useConfig";
import { useActiveSession } from "@/stores/active-session";
import { SessionListItem } from "./SessionListItem";
import { MessageSquare, RefreshCw, Search, Folder, Plus, Loader2 } from "lucide-react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { ThreadItem } from "@/types/api";
import {
  isStandaloneConversationCwd,
  projectName,
  normalizeCwd,
} from "@/lib/utils/format";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { abortActiveStream } from "@/hooks/stream-controller";
import { resolveProjectSelection } from "@/lib/session/project-selection";

export function SessionList() {
  const { t } = useLanguage();
  const { updatePrefs } = useConfig();
  const [q, setQ] = useState("");
  const [section, setSection] = useState<"projects" | "standalone">("projects");
  const { sessions, isLoading, mutate } = useSessionList(undefined, q || undefined);
  const { replay, isReplaying } = useReplayStream();
  const { state, dispatch } = useActiveSession();
  const activeSessionId = state.resumeSessionId || state.threadId;
  // 同一浏览器只允许一个活跃流；回放加载和真实任务运行分开呈现。
  const runningSessionId = state.status === "running" && !state.isReplay ? activeSessionId : null;

  // 在指定项目下新建对话：设置 cwd + 重置会话状态
  const newSessionForCwd = useCallback(
    (cwd: string) => {
      abortActiveStream();
      // 明确写入 default，不能依赖 RESET 后的 React 重渲染时序。
      updatePrefs({ cwd }, null);
      dispatch({ type: "RESET" });
      dispatch({ type: "SET_RESUME", sessionId: null });
    },
    [updatePrefs, dispatch],
  );

  // 点击项目本身：如果当前会话属于该项目，只修正该会话的 cwd；
  // 否则切换到项目默认 cwd 并清空旧会话，避免把旧项目会话续接到新项目。
  const selectProject = useCallback(
    (cwd: string, items: ThreadItem[]) => {
      const selection = resolveProjectSelection(
        activeSessionId,
        items.map((item) => item.id),
      );
      if (selection.resetSession) {
        abortActiveStream();
        dispatch({ type: "RESET" });
        dispatch({ type: "SET_RESUME", sessionId: null });
      }
      updatePrefs({ cwd }, selection.targetSessionId);
    },
    [activeSessionId, dispatch, updatePrefs],
  );

  // 点击历史会话时立即同步 cwd；回放事件稍后到达，不能让旧项目配置短暂保留。
  const pickSession = useCallback(
    (session: ThreadItem) => {
      updatePrefs({ cwd: session.cwd }, session.id);
      replay(session.id);
    },
    [replay, updatePrefs],
  );

  // 按 cwd 分组（保持组内按 updatedAt 降序，组间按组内最新会话时间降序）
  //
  // Windows 路径不区分大小写，`d:\Projects\foo` 与 `D:\Projects\foo` 是同一项目。
  // 分组 key 用 normalizeCwd(cwd).toLowerCase() 做大小写无关比较，
  // 显示路径用 normalizeCwd 统一首字母大写，避免出现两个同名条目。
  const { projectGroups, standaloneSessions } = useMemo(() => {
    const map = new Map<string, { displayCwd: string; items: ThreadItem[] }>();
    const standalone: ThreadItem[] = [];
    for (const s of sessions) {
      const rawCwd = s.cwd || "(no project)";
      if (isStandaloneConversationCwd(rawCwd)) {
        standalone.push(s);
        continue;
      }
      const key = normalizeCwd(rawCwd).toLowerCase();
      if (!map.has(key)) map.set(key, { displayCwd: normalizeCwd(rawCwd), items: [] });
      map.get(key)!.items.push(s);
    }
    // 每组内部已由 API 返回降序，无需再排
    // 组间按组内最新 updatedAt 降序
    const projects = Array.from(map.values())
      .map(({ displayCwd, items }) => [displayCwd, items] as [string, ThreadItem[]])
      .sort((a, b) => {
        const ta = a[1][0]?.updatedAt || "";
        const tb = b[1][0]?.updatedAt || "";
        return tb.localeCompare(ta);
      });
    return { projectGroups: projects, standaloneSessions: standalone };
  }, [sessions]);

  return (
    <div className="flex h-full flex-col">
      {/* 搜索框 */}
      <div className="px-3 py-2 border-b border-[hsl(var(--overlay)/0.05)]">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface-2))] px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("sessions.search")}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-[hsl(var(--muted-foreground))] outline-none"
            />
          </div>
          <button
            onClick={() => mutate()}
            className="rounded-md border border-[hsl(var(--overlay)/0.1)] p-1.5 text-[hsl(var(--muted-foreground))] hover:text-foreground hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
            title={t("common.refresh")}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 项目 / 非项目对话：两个独立的顶层视图 */}
      <div
        className="grid grid-cols-2 gap-1 border-b border-[hsl(var(--overlay)/0.06)] bg-[hsl(var(--surface))] px-3 py-2"
        role="tablist"
        aria-label={t("sessions.categories")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={section === "projects"}
          onClick={() => setSection("projects")}
          className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors focus-ring ${
            section === "projects"
              ? "bg-[hsl(var(--overlay)/0.08)] text-foreground shadow-sm"
              : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--overlay)/0.04)] hover:text-foreground"
          }`}
        >
          <Folder className="h-3.5 w-3.5" />
          {t("sessions.projects")}
          <span className="font-mono text-[10px] opacity-60">{projectGroups.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "standalone"}
          onClick={() => setSection("standalone")}
          className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors focus-ring ${
            section === "standalone"
              ? "bg-[hsl(var(--overlay)/0.08)] text-foreground shadow-sm"
              : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--overlay)/0.04)] hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {t("sessions.chats")}
          <span className="font-mono text-[10px] opacity-60">{standaloneSessions.length}</span>
        </button>
      </div>

      {/* 列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading && sessions.length === 0 ? (
          <div className="px-3 py-4 text-center font-mono text-xs text-[hsl(var(--muted-foreground))]">
            loading…
          </div>
        ) : section === "projects" && projectGroups.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <Folder className="mx-auto mb-2 h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {q ? t("sessions.noProjectMatches") : t("sessions.noProjects")}
            </p>
          </div>
        ) : section === "standalone" && standaloneSessions.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <MessageSquare className="mx-auto mb-2 h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {q ? t("sessions.noChatMatches") : t("sessions.noChats")}
            </p>
          </div>
        ) : section === "projects" ? (
          <div className="py-1">
            {projectGroups.map(([cwd, items]) => (
              <SessionGroup
                key={cwd}
                cwd={cwd}
                items={items}
                activeId={activeSessionId}
                replayingId={isReplaying ? state.threadId : null}
                runningSessionId={runningSessionId}
                onPick={pickSession}
                onNewSession={newSessionForCwd}
                onSelectProject={selectProject}
              />
            ))}
          </div>
        ) : (
          <ul className="py-1">
            {standaloneSessions.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                active={(state.resumeSessionId || state.threadId) === session.id}
                loading={isReplaying && state.threadId === session.id}
                running={runningSessionId === session.id}
                onClick={() => pickSession(session)}
                indented={false}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface SessionGroupProps {
  cwd: string;
  items: ThreadItem[];
  activeId: string | null;
  replayingId: string | null;
  runningSessionId: string | null;
  onPick: (session: ThreadItem) => void;
  onNewSession: (cwd: string) => void;
  onSelectProject: (cwd: string, items: ThreadItem[]) => void;
}

function SessionGroup({
  cwd,
  items,
  activeId,
  replayingId,
  runningSessionId,
  onPick,
  onNewSession,
  onSelectProject,
}: SessionGroupProps) {
  const { t } = useLanguage();
  // 默认折叠（用户要求：项目菜单默认不展开）
  const [collapsed, setCollapsed] = useState(true);
  const name = projectName(cwd);
  const hasRunningSession = items.some((item) => item.id === runningSessionId);

  // 右键上下文菜单状态
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  // 右键菜单：新建对话
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setCtxMenu({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  // 点击外部关闭右键菜单
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [ctxMenu]);

  // 新建对话（停止事件冒泡，避免触发展开/折叠）
  const handleNewSession = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setCtxMenu(null);
      onNewSession(cwd);
    },
    [onNewSession, cwd],
  );

  return (
    <div className="mb-0.5" ref={groupRef}>
      <button
        onClick={() => {
          onSelectProject(cwd, items);
          setCollapsed((v) => !v);
        }}
        onContextMenu={handleContextMenu}
        className="sticky top-0 z-10 group flex w-full items-start gap-1.5 bg-[hsl(var(--surface))] px-3 py-1.5 text-left hover:bg-[hsl(var(--overlay)/0.03)] transition-colors focus-ring border-b border-[hsl(var(--overlay)/0.05)]"
        title={cwd}
      >
        <Folder className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
        <div className="flex-1 min-w-0">
          {/* 项目标题：微软雅黑（跟随 --font-sans），移除 font-mono/uppercase/tracking */}
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-[hsl(var(--muted-foreground))]">
              {name}
            </span>
            <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]/60">
              {items.length}
            </span>
            {hasRunningSession && (
              <Loader2
                className="h-3 w-3 shrink-0 animate-spin text-[hsl(var(--primary))]"
                aria-label="Running task"
              />
            )}
          </div>
          {/* 文件夹路径：标题下方显示完整 cwd，小字号淡色，超长截断 */}
          <div
            className="mt-0.5 truncate text-[10px] leading-tight text-[hsl(var(--muted-foreground))]/50"
            title={cwd}
          >
            {cwd}
          </div>
        </div>
        {/* 悬停显示的新建对话按钮 */}
        <span
          role="button"
          tabIndex={0}
          onClick={handleNewSession}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleNewSession(e as unknown as React.MouseEvent);
            }
          }}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 hover:bg-[hsl(var(--overlay)/0.1)] hover:text-foreground transition-all focus-ring"
          title={t("sessions.newChat")}
        >
          <Plus className="h-3.5 w-3.5" />
        </span>
        <span
          className={`mt-0.5 shrink-0 text-xs text-[hsl(var(--muted-foreground))] transition-transform ${
            collapsed ? "" : "rotate-90"
          } group-hover:opacity-0`}
        >
          ›
        </span>
      </button>
      {!collapsed && (
        <ul>
          {items.map((s) => (
            <SessionListItem
              key={s.id}
              session={s}
              active={activeId === s.id}
              loading={replayingId === s.id}
              running={runningSessionId === s.id}
              onClick={() => onPick(s)}
            />
          ))}
        </ul>
      )}

      {/* 右键上下文菜单 */}
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface))] py-1 shadow-lg animate-fade-in"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleNewSession}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("sessions.newChat")}
          </button>
        </div>
      )}
    </div>
  );
}
