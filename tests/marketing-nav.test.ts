import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The marketing navbar. Decluttered on 2026-09-22: six top-level links, with
 * the two industry/content destinations tucked under a Resources menu, and
 * the primary CTA switched from the Cal.com demo modal to the free trial.
 *
 * `/industries` deliberately has no link anywhere — the directory exists but
 * has no page.tsx, so linking it would 404. Only `/industries/clinics` is real.
 */
const navbar = readFileSync("src/components/marketing/navbar.tsx", "utf8");
const contact = readFileSync("src/app/contact/page.tsx", "utf8");
const hero = readFileSync("src/components/marketing/v2/hero-v2.tsx", "utf8");
const footer = readFileSync("src/components/marketing/footer.tsx", "utf8");
const contactLinks = readFileSync("src/components/marketing/contact-links.ts", "utf8");

/** Labels in NAV_LINKS order, ignoring anything nested under `children`. */
function topLevelLabels(): string[] {
  const block = navbar.slice(
    navbar.indexOf("const NAV_LINKS"),
    navbar.indexOf("function NavLinks")
  );
  const withoutChildren = block.replace(/children: \[[\s\S]*?\],/g, "");
  return [...withoutChildren.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
}

describe("marketing navbar", () => {
  it("has exactly the six agreed top-level entries, in order", () => {
    const labels = topLevelLabels();
    expect(labels.slice(0, 6)).toEqual([
      "Features",
      "Compare",
      "Pricing",
      "FAQ",
      "Resources",
      "Contact",
    ]);
  });

  it("nests Clinics and Other under Resources", () => {
    const block = navbar.slice(navbar.indexOf("const NAV_LINKS"), navbar.indexOf("function NavLinks"));
    const resources = block.slice(block.indexOf('label: "Resources"'));
    expect(resources).toContain('label: "Clinics"');
    expect(resources).toContain("/industries/clinics");
    expect(resources).toContain('label: "Other"');
    expect(resources).toContain('href: "/resources"');
  });

  it("never links /industries, which has no page", () => {
    expect(navbar).not.toMatch(/href: "\/industries"/);
  });

  it("leads with Free Trial instead of the demo modal", () => {
    expect(navbar).toContain("Free Trial");
    expect(navbar).toContain("/free-trial");
    expect(navbar).not.toContain("Book a Demo");
    // The Cal modal button is no longer the navbar's job.
    expect(navbar).not.toContain("LaunchDemoButton");
  });

  it("keeps Sign in pointing at the login page", () => {
    expect(navbar).toContain('href="/login"');
  });
});

describe("home hero", () => {
  it("offers Free Trial and Contact Us, both as plain links", () => {
    expect(hero).toContain("Free Trial");
    expect(hero).toContain('href="/free-trial"');
    expect(hero).toContain("Contact Us");
    expect(hero).toContain('href="/contact"');
    // The demo modal and the lead-capture modal are both gone from the hero.
    expect(hero).not.toContain("Book a Demo");
    expect(hero).not.toContain("GetAccessButton");
  });
});

describe("contact page", () => {
  it("offers the demo booking and a WhatsApp button, and nothing else to fill in", () => {
    expect(contact).toContain("BookDemoButton");
    expect(contact).toContain("whatsappHref");
    // A contact page with a form to fill in is the thing we are replacing.
    expect(contact).not.toContain("<form");
  });

  it("keeps the number in one shared place, not copied per page", () => {
    expect(contactLinks).toContain("6581373154");
    expect(contact).not.toContain("6581373154");
    expect(footer).not.toContain("6581373154");
  });
});

describe("footer", () => {
  it("sends the trial link to the trial page, not the login screen", () => {
    const start = footer.slice(footer.indexOf('title: "Start"'), footer.indexOf('title: "Legal"'));
    expect(start).toContain('href: "/free-trial"');
    expect(start).not.toContain('href: "/login"');
  });

  it("points Contact at the contact page rather than a mailto", () => {
    const start = footer.slice(footer.indexOf('title: "Start"'), footer.indexOf('title: "Legal"'));
    expect(start).toContain('label: "Contact", href: "/contact"');
  });

  it("makes the WhatsApp icon actually open WhatsApp", () => {
    expect(footer).toContain("whatsappHref()");
    expect(footer).toContain("Message Nudge on WhatsApp");
  });

  it("lists Explore in the same order as the navbar", () => {
    const explore = footer.slice(footer.indexOf('title: "Explore"'), footer.indexOf('title: "Start"'));
    const labels = [...explore.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual(["Features", "Compare", "Pricing", "FAQ", "Resources", "Clinics"]);
  });
});
