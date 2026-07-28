import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ActiveSessionProvider } from "@/stores/active-session";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const metadata: Metadata = {
  title: "Codex Web UI",
  description: "Local web interface for OpenAI Codex CLI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning：next-themes 在 html 上注入 class，SSR/Client 必然不同
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* 系统字体回退，避免外部网络依赖 */}
      </head>
      <body className="antialiased min-h-screen">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ActiveSessionProvider>{children}</ActiveSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
