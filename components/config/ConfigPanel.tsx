"use client";

/**
 * ConfigPanel — 配置面板（cwd/model/effort/sandbox/approval）。
 *
 * 横排展示在发送框下方，始终展开，偏好持久化到 localStorage（通过 useConfig）。
 * 窄屏自动换行：cwd 弹性占满剩余空间，其余 Select 固定宽度。
 */

import { useState } from "react";
import { useConfig } from "@/hooks/useConfig";
import { DirectoryPicker } from "@/components/fs/DirectoryPicker";
import { Select } from "@/components/ui/Select";
import { FolderOpen } from "lucide-react";
import type { SandboxMode, ApprovalPolicy } from "@/types/api";

export function ConfigPanel() {
  const { config, prefs, updatePrefs } = useConfig();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!config || !prefs) {
    return (
      <div className="px-4 py-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
        loading config…
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-xs">
      {/* cwd — 弹性占满剩余空间，窄屏时保证最小宽度 */}
      <div className="flex min-w-[200px] flex-1 items-center gap-1.5">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          cwd
        </span>
        <button
          onClick={() => setPickerOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface-2))] px-2 py-1 text-left hover:bg-[hsl(var(--overlay)/0.05)] transition-colors focus-ring"
          title={prefs.cwd || "not set"}
        >
          <FolderOpen className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
          <span className="truncate font-mono text-[11px] text-foreground/80">
            {prefs.cwd || "not set"}
          </span>
        </button>
      </div>

      {/* model */}
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          model
        </span>
        <div className="w-44" title={prefs.model ?? ""}>
          <Select
            value={prefs.model ?? ""}
            options={config.models}
            onChange={(v) => {
              // 切换模型时，若当前 effort 不被新模型支持，则回退到模型默认
              const m = config.models.find((x) => x.value === v);
              if (m?.supportedEfforts && m.supportedEfforts.length > 0) {
                if (!m.supportedEfforts.includes(prefs.effort ?? "")) {
                  updatePrefs({
                    model: v,
                    effort: m.defaultEffort ?? m.supportedEfforts[0],
                  });
                  return;
                }
              }
              updatePrefs({ model: v });
            }}
            placement="top"
            aria-label="Model"
          />
        </div>
      </div>

      {/* effort */}
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          effort
        </span>
        <div className="w-28">
          <Select
            value={prefs.effort ?? ""}
            options={(() => {
              const m = config.models.find((x) => x.value === prefs.model);
              // 若模型有 supportedEfforts，仅展示该模型支持的级别；否则展示全部
              if (m?.supportedEfforts && m.supportedEfforts.length > 0) {
                return config.efforts.filter((e) =>
                  m.supportedEfforts!.includes(e.value),
                );
              }
              return config.efforts;
            })()}
            onChange={(v) => updatePrefs({ effort: v })}
            placement="top"
            aria-label="Reasoning effort"
          />
        </div>
      </div>

      {/* sandbox */}
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          sandbox
        </span>
        <div className="w-40">
          <Select
            value={prefs.sandbox}
            options={config.sandboxes.map((s) => ({ value: s, label: s }))}
            onChange={(v) => updatePrefs({ sandbox: v as SandboxMode })}
            placement="top"
            aria-label="Sandbox"
          />
        </div>
      </div>

      {/* approval */}
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          approval
        </span>
        <div className="w-36">
          <Select
            value={prefs.approvalPolicy}
            options={config.approvals.map((a) => ({ value: a, label: a }))}
            onChange={(v) =>
              updatePrefs({ approvalPolicy: v as ApprovalPolicy })
            }
            placement="top"
            aria-label="Approval"
          />
        </div>
      </div>

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
