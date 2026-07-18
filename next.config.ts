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
  async redirects() {
    return [
      // /waitlist was the old "Book a demo" landing — retired for the Cal.com
      // booking modal. Send any old/indexed links home (301).
      { source: "/waitlist", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
