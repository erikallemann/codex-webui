"use client";

/**
 * ThemeProvider — next-themes 的客户端包装。
 *
 * 必须是 Client Component（next-themes 依赖 window/localStorage）。
 * 在 RootLayout 中包裹整个应用，通过 attribute="class" 在 <html> 上
 * 注入 "dark" / "light" class，与 globals.css 的 :root / .dark 对应。
 *
 * defaultTheme="system"：首次使用时跟随操作系统明暗主题。
 * enableSystem：持续响应系统主题变化，同时保留用户手动选择。
 * disableTransitionOnChange：切换瞬间禁用 CSS 过渡，避免颜色闪烁动画。
 */

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: Props) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
