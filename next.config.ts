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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Browsers must not sniff a response into a different type.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Nothing here is meant to be framed by another site (clickjacking).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
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
