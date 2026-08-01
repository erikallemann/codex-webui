/** Map safe Markdown image sources to something the browser can request. */
export function mapMarkdownImageSource(source: unknown): string | null {
  if (typeof source !== "string" || !source) return null;
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(source)) return source;
  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith("/api/fs/image?")) return source;

  const normalized = source.replace(/\\/g, "/");
  if (/\.codex\/visualizations\//i.test(normalized)) {
    return `/api/fs/image?path=${encodeURIComponent(source)}`;
  }
  return null;
}
