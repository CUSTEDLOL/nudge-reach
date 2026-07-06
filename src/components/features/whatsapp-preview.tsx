import type { CampaignContent } from "@/modules/campaign/schema";

/**
 * Generic chat-style preview of the campaign message (deliberately not
 * WhatsApp's exact branding/logo). Renders the {{1}} variable substituted
 * with the sample name, like the recipient would see it.
 */
export function WhatsappPreview({
  content,
  photoUrl,
}: {
  content: CampaignContent;
  photoUrl?: string | null;
}) {
  const body = content.body.replaceAll("{{1}}", content.sampleName || "Priya");

  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[2rem] border-8 border-neutral-900 bg-[#e5ddd5] shadow-xl">
      {/* chat top bar */}
      <div className="flex items-center gap-2 bg-[#075e54] px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
          {(content.productName || "S")[0].toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Your Shop</p>
          <p className="text-[10px] text-white/70">Business account</p>
        </div>
      </div>

      {/* chat area */}
      <div
        className="min-h-[320px] px-3 py-4"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)",
          backgroundSize: "16px 16px",
        }}
      >
        <div className="max-w-[260px] overflow-hidden rounded-lg rounded-tl-none bg-white shadow-sm">
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={content.productName}
              className="h-36 w-full object-cover"
            />
          )}
          <div className="px-3 py-2">
            <p className="text-[13px] font-bold text-neutral-900">
              {content.header}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-snug text-neutral-800">
              {body}
            </p>
            <p className="mt-2 text-[11px] text-neutral-400">{content.footer}</p>
            <p className="mt-1 text-right text-[10px] text-neutral-400">
              {new Intl.DateTimeFormat("en-IN", {
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(2026, 0, 1, 10, 30))}
            </p>
          </div>
          {content.buttons.length > 0 && (
            <div className="divide-y divide-neutral-100 border-t border-neutral-100">
              {content.buttons.map((button, i) => (
                <div
                  key={i}
                  className="px-3 py-2 text-center text-[13px] font-medium text-[#00a5f4]"
                >
                  {button.type === "URL" ? "🔗 " : "↩️ "}
                  {button.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
