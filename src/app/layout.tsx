import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import "@/lib/env"; // validate environment at boot

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nudge-reach.vercel.app"),
  title: {
    default: "Nudge — WhatsApp CRM for modern retail & D2C teams",
    template: "%s · Nudge",
  },
  description:
    "The WhatsApp CRM your whole team runs on. Shared inbox, AI replies, automated follow-ups, broadcasts and revenue analytics — Meta-compliant by default.",
  keywords: [
    "WhatsApp CRM",
    "WhatsApp Business",
    "shared team inbox",
    "WhatsApp marketing",
    "WhatsApp automation",
    "retail CRM",
    "D2C",
  ],
  openGraph: {
    title: "Nudge — The WhatsApp CRM your whole team runs on",
    description:
      "One shared inbox for every WhatsApp conversation, lead and campaign. AI replies, automations and revenue analytics, compliant by default.",
    siteName: "Nudge",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nudge — The WhatsApp CRM your whole team runs on",
    description:
      "Shared inbox, AI replies, automations and analytics for WhatsApp — compliant by default.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
