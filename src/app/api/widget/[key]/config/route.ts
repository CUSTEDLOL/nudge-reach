import { NextResponse } from "next/server";
import { getPublicWidgetByKey } from "@/modules/widget";

/**
 * Public widget config (E5). Exposes only what the button needs — no org id,
 * no business data. 404 for unknown/disabled keys. Cached briefly so a busy
 * site doesn't hammer us.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const widget = await getPublicWidgetByKey(key);
  if (!widget) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      phone: widget.phoneE164.replace(/^\+/, ""),
      prefill: widget.prefill,
      position: widget.position,
      color: widget.color,
    },
    {
      headers: {
        "cache-control": "public, max-age=300",
        "access-control-allow-origin": "*",
      },
    }
  );
}
