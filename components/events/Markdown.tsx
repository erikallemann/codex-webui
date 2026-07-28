"use client";

/**
 * Markdown — 统一的 Markdown 渲染组件。
 *
 * 支持：
 * - GitHub Flavored Markdown（表格、删除线、任务列表）
 * - LaTeX 数学公式（$...$ 行内、$$...$$ 块级），通过 remark-math + rehype-katex
 * - 代码语法高亮，通过 rehype-highlight + highlight.js
 *
 * LaTeX 分隔符预处理：
 * - codex/GPT 输出的 LaTeX 常用 \[...\]（display）和 \(...\)（inline）
 * - remark-math 仅支持 $...$ 和 $$...$$，故在渲染前做转换
 * - 同时处理 \begin{...}...\end{...} 环境（包裹为 $$...$$）
 *
 * 主题适配：
 * - 代码块使用 surface-2 背景，适配 light/dark
 * - 行内 code 使用 overlay 半透明背景
 * - katex 与 hljs 样式在 globals.css 中导入
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { memo, useMemo } from "react";

interface MarkdownProps {
  /** 允许 undefined/null/空字符串，组件内部做容错（exec 流可能透传缺失 text 的 item） */
  children?: string | null;
  className?: string;
}

/**
 * 将 LaTeX 通用分隔符转换为 remark-math 支持的 $ / $$ 分隔符。
 *
 * 转换规则：
 * 1. \[...\] → $$...$$（display math，非贪婪，跨行）
 * 2. \(...\) → $...$（inline math，非贪婪，同行）
 * 3. 独立的 \begin{env}...\end{env} → 包裹为 $$...$$
 *
 * 注意：不处理代码块内的内容（``` 或 ~~~ 之间的内容）。
 */
function preprocessLatex(text: string | null | undefined): string {
  // 容错：exec 流或 rollout 可能传入 undefined/null
  if (!text || typeof text !== "string") return "";

  // 先按代码块分割，只处理非代码部分
  const codeBlockRegex = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g;
  const parts = text.split(codeBlockRegex);

  return parts
    .map((part, idx) => {
      // 偶数索引为非代码部分，奇数索引为代码块
      if (idx % 2 === 1) return part;

      let result = part;

      // \[...\] → $$...$$（display math，跨行）
      result = result.replace(
        /\\\[([\s\S]*?)\\\]/g,
        (_, content) => `$$${content}$$`,
      );

      // \(...\) → $...$（inline math）
      result = result.replace(
        /\\\(([\s\S]*?)\\\)/g,
        (_, content) => `$${content}$`,
      );

      // 独立的 \begin{...}...\end{...} → 包裹为 $$...$$
      // 仅匹配未被 $$ 包裹的 \begin/\end
      result = result.replace(
        /(?<!\$)\\begin\{(\w+)\}([\s\S]*?)\\end\{\1\}(?!\$)/g,
        (_, env, content) => `$$\\begin{${env}}${content}\\end{${env}}$$`,
      );

      return result;
    })
    .join("");
}

function MarkdownImpl({ children, className }: MarkdownProps) {
  // 预处理 LaTeX 分隔符（memoized，避免每次渲染都做正则替换）
  // 注意：useMemo 必须在条件返回之前调用（Rules of Hooks）
  const processed = useMemo(() => preprocessLatex(children), [children]);

  // 容错：空内容直接返回 null，避免渲染空 prose 容器
  if (!processed) return null;
  return (
    <div
      className={`prose prose-base max-w-none text-foreground/90
        prose-p:my-2 prose-p:leading-7
        prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground prose-headings:my-3
        prose-code:font-mono prose-code:text-[0.9em] prose-code:text-[hsl(var(--primary))] prose-code:bg-[hsl(var(--overlay)/0.06)] prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-[hsl(var(--surface-2))] prose-pre:border prose-pre:border-[hsl(var(--overlay)/0.08)] prose-pre:rounded-md prose-pre:overflow-x-auto prose-pre:text-[0.875em] prose-pre:my-3
        prose-a:text-[hsl(var(--info))] prose-a:no-underline hover:prose-a:underline
        prose-strong:text-foreground prose-strong:font-semibold
        prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
        prose-blockquote:border-[hsl(var(--primary)/0.4)] prose-blockquote:text-[hsl(var(--muted-foreground))]
        prose-table:text-sm prose-th:border-[hsl(var(--overlay)/0.1)] prose-td:border-[hsl(var(--overlay)/0.1)]
        ${className ?? ""}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }], rehypeKatex]}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);
