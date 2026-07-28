import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API routes use child_process / fs and force `export const runtime = 'nodejs'`.
  // Keep build lenient for local single-user tool.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Catch type errors in dev; don't block production build on minor issues.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
