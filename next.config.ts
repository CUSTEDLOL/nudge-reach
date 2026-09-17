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
          // microphone=(self): the browser "Call your AI" test on AI Front Desk → Voice
          // needs getUserMedia on our own origin. `microphone=()` blocked it for
          // every visitor (Chrome: "Permissions policy violation"), found 2026-09-15.
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
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
