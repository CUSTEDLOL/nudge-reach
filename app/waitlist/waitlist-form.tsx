"use client";

import { useState } from "react";

const VERTICALS = [
  "Apparel / textiles",
  "Jewellery / accessories",
  "Home décor / gifting",
  "Bakery / food",
  "Other",
];

export function WaitlistForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const form = e.currentTarget;
    const payload = {
      shopName: (form.elements.namedItem("shopName") as HTMLInputElement).value,
      city: (form.elements.namedItem("city") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
      vertical: (form.elements.namedItem("vertical") as HTMLSelectElement).value,
      source: "landing",
    };

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      setError("Network error. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="nr-success">
        🎉 You&apos;re on the list! We&apos;ll WhatsApp you shortly to set up your
        first campaign — free.
      </div>
    );
  }

  return (
    <form className="nr-form" onSubmit={onSubmit}>
      <div className="nr-row">
        <div>
          <label htmlFor="shopName">Shop name</label>
          <input id="shopName" name="shopName" required placeholder="e.g. Meera Sarees" />
        </div>
        <div>
          <label htmlFor="city">City</label>
          <input id="city" name="city" required placeholder="e.g. Jaipur" />
        </div>
      </div>
      <div className="nr-row">
        <div>
          <label htmlFor="phone">WhatsApp number</label>
          <input id="phone" name="phone" type="tel" required placeholder="+91 98xxxxxxxx" />
        </div>
        <div>
          <label htmlFor="vertical">What do you sell?</label>
          <select id="vertical" name="vertical" required defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            {VERTICALS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Joining…" : "Join the waitlist — first campaign free"}
      </button>
      {error ? (
        <p className="nr-err">{error}</p>
      ) : (
        <p className="nr-note">
          We onboard shops one by one. We&apos;ll WhatsApp you to set up your first
          campaign, free.
        </p>
      )}
    </form>
  );
}
