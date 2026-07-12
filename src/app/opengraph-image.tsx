import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Nudge — the AI Front Desk that runs your WhatsApp: answers, books, chases, collects.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Brand OG card — generated at build, no design assets required. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0a0f0d",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#06c167",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            N
          </div>
          <div style={{ fontSize: 44, fontWeight: 800 }}>Nudge</div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 84,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: -3,
          }}
        >
          <div>Your front desk sleeps.</div>
          <div style={{ color: "#35de8f" }}>This one doesn&rsquo;t.</div>
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "#ffffffb3" }}>
          Answers · Books · Chases · Collects — on WhatsApp, set up for you.
        </div>
      </div>
    ),
    size
  );
}
