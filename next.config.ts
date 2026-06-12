import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Multiple lockfiles exist on this machine; pin the workspace root.
    root: __dirname,
  },
  experimental: {
    serverActions: {
      // Product photo uploads go through a server action (default cap: 1 MB).
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
