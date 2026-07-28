/**
 * Skills 扫描与解析。
 *
 * codex CLI 的 skills 来自两个来源：
 * 1. 用户安装的 skills：~/.codex/skills/<name>/SKILL.md
 *    - 含 .system 子目录（系统内置 skills）
 * 2. 插件提供的 skills：~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/skills/<name>/SKILL.md
 *    - 仅 enabled = true 的插件才包含其 skills
 *
 * SKILL.md 文件使用 YAML frontmatter 描述元数据：
 * ---
 * name: skill-name
 * description: 简短描述文本（可能跨行、带引号、或使用 >- 折叠）
 * ---
 *
 * 用于 /api/skills 端点，支持 /skills @ 补全。
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { codexHome } from "@/lib/rollout/paths";
import type { SkillInfo } from "@/types/api";

/** SKILL.md 文件名 */
const SKILL_FILE = "SKILL.md";

/** 用户 skills 根目录 */
function userSkillsRoot(): string {
  return path.join(codexHome(), "skills");
}

/** 插件缓存根目录 */
function pluginCacheRoot(): string {
  return path.join(codexHome(), "plugins", "cache");
}

/**
 * 从 ~/.codex/config.toml 解析已启用的插件集合。
 *
 * 配置格式：
 * [plugins."pluginName@marketplace"]
 * enabled = true
 *
 * @returns Set<"pluginName@marketplace">，仅含 enabled = true 的插件
 */
function readEnabledPlugins(): Set<string> {
  const filePath = path.join(codexHome(), "config.toml");
  const result = new Set<string>();
  try {
    if (!existsSync(filePath)) return result;
    const raw = readFileSync(filePath, "utf8");
    // 匹配 [plugins."name@market"] 节，提取插件标识
    // 节内查找 enabled = true
    const pluginSectionRegex = /^\s*\[plugins\."([^"]+)"\]\s*$/gm;
    let match: RegExpExecArray | null;
    while ((match = pluginSectionRegex.exec(raw)) !== null) {
      const pluginId = match[1];
      const sectionStart = match.index + match[0].length;
      // 查找节内 enabled 字段（到下一个 [section] 为止）
      const nextSectionRegex = /^\s*\[[^\]]+\]\s*$/gm;
      nextSectionRegex.lastIndex = sectionStart;
      const nextMatch = nextSectionRegex.exec(raw);
      const sectionEnd = nextMatch ? nextMatch.index : raw.length;
      const sectionText = raw.slice(sectionStart, sectionEnd);
      const enabledMatch = sectionText.match(/^enabled\s*=\s*true\s*$/m);
      if (enabledMatch) {
        result.add(pluginId);
      }
    }
  } catch {
    // ignore
  }
  return result;
}

/**
 * 从 SKILL.md 文本中提取 YAML frontmatter 的 name 与 description。
 *
 * 支持的 description 格式：
 * - 单行：description: 文本
 * - 引号：description: "文本" 或 '文本'
 * - 折叠块：description: >-\n  多行文本\n  续行
 * - 字面块：description: |-\n  多行文本
 *
 * 简易解析，不依赖 yaml 库——SKILL.md 的 frontmatter 字段简单且固定。
 */
function parseSkillFrontmatter(
  content: string,
): { name?: string; description?: string } {
  // 提取 --- 之间的 frontmatter
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return {};
  const frontmatter = fmMatch[1];

  // name：单行值
  let name: string | undefined;
  const nameMatch = frontmatter.match(/^name\s*:\s*(.+?)\s*$/m);
  if (nameMatch) {
    name = stripQuotes(nameMatch[1].trim());
  }

  // description：先尝试折叠块/字面块（>- / |- / > / |），再回退到单行/引号
  let description: string | undefined;
  // 块标量：description: >- 或 | 或 >+ 等，后续行为缩进行的集合
  const blockMatch = frontmatter.match(
    /^description\s*:\s*([>|])[+-]?\s*\r?\n((?:[ \t]+.*(?:\r?\n|$))+)/m,
  );
  if (blockMatch) {
    const indicator = blockMatch[1];
    const block = blockMatch[2];
    const lines = block
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/^[ \t]+/, ""));
    // > 折叠：多行合并为单行（空格分隔）；| 字面：保留换行
    description = (indicator === ">" ? lines.join(" ") : lines.join("\n")).trim();
  } else {
    // 单行或引号格式
    const descLineMatch = frontmatter.match(
      /^description\s*:\s*(.+?)\s*$/m,
    );
    if (descLineMatch) {
      description = stripQuotes(descLineMatch[1].trim());
    }
  }

  return { name, description };
}

/** 去除字符串两端的引号（单引号或双引号） */
function stripQuotes(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * 递归扫描目录下所有 SKILL.md 文件。
 *
 * @param rootDir 扫描根目录
 * @param source 来源类型（user / system / plugin）
 * @param pluginInfo 插件信息（仅 source === "plugin" 时提供）
 * @returns SkillInfo 数组
 */
function scanSkillFiles(
  rootDir: string,
  source: "user" | "system" | "plugin",
  pluginInfo?: { plugin: string; marketplace: string },
): SkillInfo[] {
  const skills: SkillInfo[] = [];
  if (!existsSync(rootDir)) return skills;

  /**
   * 递归查找 SKILL.md 文件。
   * SKILL.md 通常位于 <root>/<skill-name>/SKILL.md，
   * 但也可能嵌套更深（如插件 skills 目录下有子目录分组）。
   */
  const findSkillFiles = (dir: string, found: string[]) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        findSkillFiles(full, found);
      } else if (entry === SKILL_FILE) {
        found.push(full);
      }
    }
  };

  const files: string[] = [];
  findSkillFiles(rootDir, files);

  for (const file of files) {
    try {
      const content = readFileSync(file, "utf8");
      const { name, description } = parseSkillFrontmatter(content);
      if (!name) continue; // 无 name 字段的 SKILL.md 跳过

      // 从文件路径推断 skill 目录名（SKILL.md 的父目录名）
      const dirName = path.basename(path.dirname(file));

      skills.push({
        name,
        description: description ?? "",
        source,
        ...(pluginInfo
          ? { plugin: pluginInfo.plugin, marketplace: pluginInfo.marketplace }
          : {}),
        // 目录名作为显示标签（name 可能含连字符，dirName 是文件系统名）
        dirName,
      });
    } catch {
      // 读取失败跳过
    }
  }

  return skills;
}

/**
 * 扫描所有可用 skills：
 * 1. 用户 skills（~/.codex/skills/，不含 .system）
 * 2. 系统 skills（~/.codex/skills/.system/）
 * 3. 已启用插件的 skills（~/.codex/plugins/cache/<market>/<plugin>/<version>/skills/）
 *
 * @returns 去重后的 skills 列表（按 name 排序）
 */
export function scanSkills(): SkillInfo[] {
  const all: SkillInfo[] = [];

  // 1. 用户安装的 skills（跳过 .system 子目录，单独处理）
  const userRoot = userSkillsRoot();
  if (existsSync(userRoot)) {
    let entries: string[];
    try {
      entries = readdirSync(userRoot);
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (entry === ".system") continue;
      const full = path.join(userRoot, entry);
      try {
        const st = statSync(full);
        if (!st.isDirectory()) continue;
      } catch {
        continue;
      }
      // 扫描该 skill 目录（用户 skills 通常只有一层，但兼容嵌套）
      all.push(...scanSkillFiles(full, "user"));
    }
  }

  // 2. 系统内置 skills（.system 子目录）
  const systemRoot = path.join(userSkillsRoot(), ".system");
  all.push(...scanSkillFiles(systemRoot, "system"));

  // 3. 已启用插件的 skills
  const enabledPlugins = readEnabledPlugins();
  const cacheRoot = pluginCacheRoot();
  if (existsSync(cacheRoot) && enabledPlugins.size > 0) {
    let marketplaces: string[];
    try {
      marketplaces = readdirSync(cacheRoot).filter((e) => {
        try {
          return statSync(path.join(cacheRoot, e)).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      marketplaces = [];
    }

    for (const marketplace of marketplaces) {
      const marketPath = path.join(cacheRoot, marketplace);
      let plugins: string[];
      try {
        plugins = readdirSync(marketPath).filter((e) => {
          try {
            return statSync(path.join(marketPath, e)).isDirectory();
          } catch {
            return false;
          }
        });
      } catch {
        continue;
      }

      for (const plugin of plugins) {
        const pluginId = `${plugin}@${marketplace}`;
        if (!enabledPlugins.has(pluginId)) continue;

        const pluginPath = path.join(marketPath, plugin);
        // 一个插件可能有多个版本目录，取最新（按名称排序取最后一个）
        let versions: string[];
        try {
          versions = readdirSync(pluginPath)
            .filter((e) => {
              try {
                return statSync(path.join(pluginPath, e)).isDirectory();
              } catch {
                return false;
              }
            })
            .sort();
        } catch {
          continue;
        }
        if (versions.length === 0) continue;

        // 取最新版本目录下的 skills/
        const latestVersion = versions[versions.length - 1];
        const skillsDir = path.join(pluginPath, latestVersion, "skills");
        if (!existsSync(skillsDir)) continue;

        all.push(
          ...scanSkillFiles(skillsDir, "plugin", {
            plugin,
            marketplace,
          }),
        );
      }
    }
  }

  // 去重：按 name 去重，优先保留 user > system > plugin
  const priority = { user: 0, system: 1, plugin: 2 } as const;
  const deduped = new Map<string, SkillInfo>();
  for (const skill of all) {
    const existing = deduped.get(skill.name);
    if (!existing || priority[skill.source] < priority[existing.source]) {
      deduped.set(skill.name, skill);
    }
  }

  // 按 name 字母序排序
  return Array.from(deduped.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
