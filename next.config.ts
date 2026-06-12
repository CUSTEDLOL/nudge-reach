import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Multiple lockfiles exist on this machine; pin the workspace root.
    root: __dirname,
  },
};

export default nextConfig;
