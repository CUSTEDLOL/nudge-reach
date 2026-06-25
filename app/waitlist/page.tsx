import type { Metadata } from "next";
import "./waitlist.css";
import { WaitlistForm } from "./waitlist-form";

export const metadata: Metadata = {
  title: "Nudge Reach — WhatsApp marketing from one photo",
  description:
    "Snap a product photo. Get a ready-to-send, WhatsApp-compliant marketing campaign for your shop's customers — in under a minute.",
};

const WHY = [
  "No typing or design skills needed — just a photo",
  "Stays within WhatsApp's rules, every time",
  "Transparent ₹ cost estimate before you send",
  "Only messages customers who opted in",
  "Works in simulation first — try with zero risk",
  "Built for small shops, not big marketing teams",
];

export default function WaitlistPage() {
  return (
    <div className="nr-wl">
      <div className="nr-wrap">
        <header className="nr-head">
          <div className="nr-logo">
            Nudge<span> Reach</span>
          </div>
          <a className="nr-navcta" href="#join">
            Get early access →
          </a>
        </header>

        <section className="nr-hero" id="join">
          <div>
            <span className="nr-pill">For shop owners • Built for India 🇮🇳</span>
            <h1>
              One product photo. <em>A whole WhatsApp campaign.</em>
            </h1>
            <p className="nr-sub">
              Snap a photo of what you sell. Nudge writes a ready-to-send,
              WhatsApp-compliant campaign for your customers — in under a minute.
              No typing, no designer, no tech.
            </p>
            <WaitlistForm />
          </div>

          <div className="nr-phone" aria-hidden="true">
            <div className="nr-bar"></div>
            <div className="nr-chat">
              <div className="nr-photo">Banarasi Silk Dupatta</div>
              <div className="nr-bubble">
                <b>✨ New arrival, Priya!</b>
                Handwoven Banarasi silk dupattas just in — festive-ready in 6
                colours. Visit us this week for 10% off. 🛍️
                <div className="nr-btns">View collection&nbsp;&nbsp;•&nbsp;&nbsp;Get directions</div>
                <div className="nr-opt">Reply STOP to opt out</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="nr-how">
        <div className="nr-wrap">
          <h2>How it works</h2>
          <div className="nr-steps">
            <div className="nr-step">
              <div className="nr-n">1</div>
              <h3>Snap a photo</h3>
              <p>Take a picture of any product in your shop. That&apos;s the only input we need.</p>
            </div>
            <div className="nr-step">
              <div className="nr-n">2</div>
              <h3>Get your campaign</h3>
              <p>
                Nudge writes the message, headline, offer and buttons —
                personalised with each customer&apos;s name, and kept
                WhatsApp-compliant automatically.
              </p>
            </div>
            <div className="nr-step">
              <div className="nr-n">3</div>
              <h3>Send &amp; see results</h3>
              <p>
                Send to your opted-in customers. See who got it, read it and
                clicked — with the cost shown up front in ₹.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="nr-why">
        <div className="nr-wrap">
          <ul>
            {WHY.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="nr-foot">
        <div className="nr-wrap">
          Nudge Reach — the first product of the Nudge AI studio for Asian SME
          retail. © 2026
        </div>
      </footer>
    </div>
  );
}
