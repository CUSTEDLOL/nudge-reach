import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/cn";

export type WhatsAppButton = { label: string; kind?: "link" | "reply" };

/**
 * Premium, brand-neutral WhatsApp-style message card. Used across the hero,
 * dashboard showcase and photo→campaign sections. Deliberately not Meta's
 * exact branding — same visual language the in-app preview uses.
 */
export function WhatsAppCard({
  shopName = "Meera Sarees",
  subtitle = "Business account",
  time = "10:30",
  tileGradient = "linear-gradient(135deg,#c8a24a,#9c1f3a)",
  tileLabel = "Banarasi Silk Dupatta",
  header = "✨ New arrival, Priya!",
  body = "Handwoven Banarasi silk dupattas just in — festive-ready in 6 colours. Visit this week for 10% off. 🛍️",
  footer = "Reply STOP to opt out",
  buttons = [
    { label: "View collection", kind: "link" },
    { label: "Get directions", kind: "reply" },
  ],
  className,
}: {
  shopName?: string;
  subtitle?: string;
  time?: string;
  tileGradient?: string;
  tileLabel?: string;
  header?: string;
  body?: string;
  footer?: string;
  buttons?: WhatsAppButton[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-[320px] overflow-hidden rounded-[1.75rem] border border-black/5 bg-white shadow-lift",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2.5 bg-brand-900 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">
          {shopName[0]}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{shopName}</p>
          <p className="text-[11px] text-brand-200/80">{subtitle}</p>
        </div>
        <span className="ml-auto inline-flex h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_0_3px_rgba(55,206,134,0.25)]" />
      </div>

      {/* Chat area */}
      <div className="bg-dotgrid bg-brand-50/40 px-3 py-4">
        <div className="max-w-[262px] overflow-hidden rounded-2xl rounded-tl-md bg-white shadow-soft">
          <div
            className="flex h-32 items-end p-2.5 text-[11px] font-semibold text-white"
            style={{ backgroundImage: tileGradient }}
          >
            <span className="rounded-md bg-black/25 px-1.5 py-0.5 backdrop-blur-sm">
              {tileLabel}
            </span>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-[13px] font-bold text-ink">{header}</p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-snug text-ink/80">
              {body}
            </p>
            <p className="mt-2 text-[10.5px] text-ink/40">{footer}</p>
            <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-ink/40">
              {time}
              <CheckCheck className="h-3 w-3 text-brand-500" />
            </p>
          </div>
          {buttons.length > 0 && (
            <div className="divide-y divide-black/5 border-t border-black/5">
              {buttons.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-brand-600"
                >
                  {b.kind === "reply" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <span aria-hidden>🔗</span>
                  )}
                  {b.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
