"use client";

/**
 * ConfigPanel — 配置面板（model/sandbox/approval/cwd）。
 *
 * 折叠式，偏好持久化到 localStorage（通过 useConfig）。
 */

import { useState } from "react";
import { useConfig } from "@/hooks/useConfig";
import { DirectoryPicker } from "@/components/fs/DirectoryPicker";
import { Select } from "@/components/ui/Select";
import { Settings, ChevronRight, FolderOpen } from "lucide-react";
import type { SandboxMode, ApprovalPolicy } from "@/types/api";

export function ConfigPanel() {
  const { config, prefs, updatePrefs } = useConfig();
  // 主区域放在对话框下方，默认收起以节省空间；点击 header 展开
  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!config || !prefs) {
    return (
      <div className="px-3 py-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
        loading config…
      </div>
    );
  }

  // 折叠态摘要：model · sandbox · approval，方便一眼看到当前会话配置
  const summaryModel = prefs.model || "default";
  const summaryEffort = prefs.effort || "";
  const summarySandbox = prefs.sandbox;

  return (
    <div className="text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[hsl(var(--overlay)/0.03)] transition-colors focus-ring"
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
        <Settings className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          config
        </span>
        {/* 右侧摘要：折叠时也能看到当前会话的关键配置 */}
        <span className="ml-auto flex min-w-0 items-center gap-1.5 truncate font-mono text-[10px] text-[hsl(var(--muted-foreground))]/80">
          <span className="truncate max-w-[180px]" title={summaryModel}>
            {summaryModel}
          </span>
          {summaryEffort && (
            <>
              <span className="opacity-40">·</span>
              <span>{summaryEffort}</span>
            </>
          )}
          <span className="opacity-40">·</span>
          <span>{summarySandbox}</span>
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 px-3 pb-3">
          {/* cwd */}
          <Field label="cwd">
            <button
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center gap-1.5 rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface-2))] px-2 py-1 text-left hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
            >
              <FolderOpen className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span
                className="flex-1 truncate font-mono text-[11px] text-foreground/80"
                title={prefs.cwd}
              >
                {prefs.cwd || "not set"}
              </span>
            </button>
          </Field>

          {/* model */}
          <Field label="model">
            <Select
              value={prefs.model}
              options={config.models}
              onChange={(v) => {
                // 切换模型时，若当前 effort 不被新模型支持，则回退到模型默认
                const m = config.models.find((x) => x.value === v);
                if (m?.supportedEfforts && m.supportedEfforts.length > 0) {
                  if (!m.supportedEfforts.includes(prefs.effort ?? "")) {
                    updatePrefs({ model: v, effort: m.defaultEffort ?? m.supportedEfforts[0] });
                    return;
                  }
                }
                updatePrefs({ model: v });
              }}
              placement="top"
              aria-label="Model"
            />
            {(() => {
              const m = config.models.find((x) => x.value === prefs.model);
              if (!m?.contextWindow) return null;
              return (
                <div className="mt-1 font-mono text-[9px] text-[hsl(var(--muted-foreground))]">
                  ctx: {(m.contextWindow / 1000).toFixed(0)}k
                  {m.defaultEffort ? ` · default: ${m.defaultEffort}` : ""}
                </div>
              );
            })()}
          </Field>

          {/* effort */}
          <Field label="effort">
            <Select
              value={prefs.effort}
              options={(() => {
                const m = config.models.find((x) => x.value === prefs.model);
                // 若模型有 supportedEfforts，仅展示该模型支持的级别；否则展示全部
                if (m?.supportedEfforts && m.supportedEfforts.length > 0) {
                  return config.efforts.filter((e) => m.supportedEfforts!.includes(e.value));
                }
                return config.efforts;
              })()}
              onChange={(v) => updatePrefs({ effort: v })}
              placement="top"
              aria-label="Reasoning effort"
            />
          </Field>

          {/* sandbox */}
          <Field label="sandbox">
            <Select
              value={prefs.sandbox}
              options={config.sandboxes.map((s) => ({ value: s, label: s }))}
              onChange={(v) => updatePrefs({ sandbox: v as SandboxMode })}
              placement="top"
              aria-label="Sandbox"
            />
          </Field>

          {/* approval */}
          <Field label="approval">
            <Select
              value={prefs.approvalPolicy}
              options={config.approvals.map((a) => ({ value: a, label: a }))}
              onChange={(v) =>
                updatePrefs({ approvalPolicy: v as ApprovalPolicy })
              }
              placement="top"
              aria-label="Approval"
            />
          </Field>
        </div>
      )}

      {pickerOpen && (
        <DirectoryPicker
          current={prefs.cwd}
          onSelect={(p) => {
            updatePrefs({ cwd: p });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-0.5 block font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </label>
      {children}
    </div>
  );
}
