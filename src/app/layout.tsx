import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://nudgeagent.app"),
  title: {
    default: "Nudge: the AI Front Desk that runs your WhatsApp",
    template: "%s · Nudge",
  },
  description:
    "Meta's free AI answers your WhatsApp. Nudge's AI Front Desk runs it: books into your real calendar, chases every lead that goes quiet, collects payments, and we set it up for you. It's not software. It's your best employee.",
  keywords: [
    "AI front desk",
    "WhatsApp AI agent",
    "AI receptionist",
    "WhatsApp appointment booking",
    "lead follow-up automation",
    "WhatsApp Business API",
    "done-for-you WhatsApp",
  ],
  openGraph: {
    title: "Nudge: your AI Front Desk on WhatsApp",
    description:
      "It books real appointments into your calendar, chases quiet leads, and collects payments on WhatsApp, set up for you. A third of a front-desk salary, and it never sleeps.",
    siteName: "Nudge",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nudge: your AI Front Desk on WhatsApp",
    description:
      "Books appointments, chases quiet leads, collects payments: done-for-you. Not another WhatsApp tool; an AI employee.",
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WTMGT6DJ');",
          }}
        />
        {/* End Google Tag Manager */}
        <meta
          name="facebook-domain-verification"
          content="uh9j91b9gh8qxdt3bxezjqlpa82fil"
        />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's
          cz-shortcut-listen) inject attributes onto <body> before React
          hydrates. suppressHydrationWarning only covers one level, so the
          <html> tag's own flag doesn't reach here. */}
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WTMGT6DJ"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {/* Motion gate: adds `jsm` to <html> ONLY when JS runs AND the
            visitor doesn't prefer reduced motion. Inline in the LAYOUT so it
            executes during HTML parse (before first paint) and, because the
            layout persists across client-side navigations, React never
            client-renders it (which would log an error and not execute). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('jsm')}}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
