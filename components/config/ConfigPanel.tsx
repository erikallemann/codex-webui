"use client";

/**
 * ConfigPanel — 配置面板（cwd/model/effort/sandbox/approval）。
 *
 * 紧凑工具栏展示在发送框下方，偏好持久化到 localStorage（通过 useConfig）。
 * 每个控件使用一致的标签层级和弹性基宽，窄屏时按字段自然换行。
 */

import { useState } from "react";
import { useConfig } from "@/hooks/useConfig";
import { DirectoryPicker } from "@/components/fs/DirectoryPicker";
import { Select } from "@/components/ui/Select";
import { FolderOpen } from "lucide-react";
import type { SandboxMode, ApprovalPolicy } from "@/types/api";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function ConfigPanel() {
  const { config, prefs, updatePrefs } = useConfig();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { t } = useLanguage();

  if (!config || !prefs) {
    return (
      <div className="px-4 py-2 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
        loading config…
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-end gap-2 px-4 py-2.5 text-xs"
      data-config-panel="true"
      aria-label={t("config.label")}
    >
      {/* cwd — 优先占据剩余空间 */}
      <div className="min-w-[220px] flex-[1.6_1_280px]">
        <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]/75">
          cwd
        </span>
        <button
          onClick={() => setPickerOpen(true)}
          className="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg border border-[hsl(var(--overlay)/0.1)] bg-[hsl(var(--surface-2))] px-2.5 text-left transition-colors hover:border-[hsl(var(--primary)/0.25)] hover:bg-[hsl(var(--overlay)/0.05)] focus-ring"
          title={prefs.cwd || "not set"}
        >
          <FolderOpen className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
          <span className="truncate font-mono text-[11px] text-foreground/80">
            {prefs.cwd || "not set"}
          </span>
        </button>
      </div>

      {/* model */}
      <div className="min-w-[150px] flex-[1_1_170px]">
        <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]/75">
          model
        </span>
        <div title={prefs.model ?? ""}>
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
            className="h-8 rounded-lg px-2.5"
          />
        </div>
      </div>

      {/* effort */}
      <div className="w-28 shrink-0">
        <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]/75">
          effort
        </span>
        <div>
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
            className="h-8 rounded-lg px-2.5"
          />
        </div>
      </div>

      {/* collaboration mode */}
      <div className="w-28 shrink-0">
        <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]/75">
          mode
        </span>
        <Select
          value={prefs.collaborationMode ?? "default"}
          options={[
            { value: "default", label: "Default", description: t("config.modeDefault") },
            { value: "plan", label: "Plan", description: t("config.modePlan") },
          ]}
          onChange={(value) => updatePrefs({ collaborationMode: value as "default" | "plan" })}
          placement="top"
          aria-label="Collaboration mode"
          className="h-8 rounded-lg px-2.5"
        />
      </div>

      {/* sandbox */}
      <div className="min-w-[140px] flex-[0.9_1_160px]">
        <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]/75">
          sandbox
        </span>
        <div>
          <Select
            value={prefs.sandbox}
            options={config.sandboxes.map((s) => ({ value: s, label: s }))}
            onChange={(v) => updatePrefs({ sandbox: v as SandboxMode })}
            placement="top"
            aria-label="Sandbox"
            className="h-8 rounded-lg px-2.5"
          />
        </div>
      </div>

      {/* approval */}
      <div className="min-w-[130px] flex-[0.8_1_145px]">
        <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]/75">
          approval
        </span>
        <div>
          <Select
            value={prefs.approvalPolicy}
            options={config.approvals.map((a) => ({ value: a, label: a }))}
            onChange={(v) =>
              updatePrefs({ approvalPolicy: v as ApprovalPolicy })
            }
            placement="top"
            aria-label="Approval"
            className="h-8 rounded-lg px-2.5"
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
