import { NextResponse } from "next/server";
import { getPublicWidgetByKey } from "@/modules/widget";
import { recordContactEvent } from "@/modules/contacts/events";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/** Click beacon (E5): counts widget clicks per org. IP rate-limited, no body trusted. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = checkRateLimit(`widget-click:${ip}`, RATE_LIMITS.publicForm);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const widget = await getPublicWidgetByKey(key);
  if (!widget) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  recordContactEvent(widget.orgId, "widget_click");
  return NextResponse.json(
    { ok: true },
    { headers: { "access-control-allow-origin": "*" } }
  );
}
