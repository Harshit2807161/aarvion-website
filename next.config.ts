import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` would otherwise insert its own agent-rules block into AGENTS.md; this repo keeps
  // its own. (Setting it false also removes the block on the next `next dev`.)
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  images: { formats: ["image/avif", "image/webp"], qualities: [70, 75, 85] },
};

export default nextConfig;
