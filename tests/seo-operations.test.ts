import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const operations = readFileSync("docs/SEO_OPERATIONS.md", "utf8");
const deployment = readFileSync("docs/DEPLOYMENT.md", "utf8");

function compact(text: string) {
  return text.replace(/\s+/g, " ");
}

function ordered(text: string, markers: string[]) {
  const positions = markers.map((marker) => text.indexOf(marker));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
}

describe("SEO production operations", () => {
  it("closes the database exposure window before code or webhook activation", () => {
    const releaseGates = compact(
      operations.slice(
        operations.indexOf("## Production release and activation gates"),
        operations.indexOf("## Search Console domain property and sitemap"),
      ),
    );

    ordered(releaseGates, [
      "maintenance/no-ingestion window",
      "npm run db:push",
      "npm run db:rls",
      "Verify `DemoBooking`",
      "Deploy the reviewed application code",
      "Enable the Cal.com webhook",
    ]);
    expect(operations).toContain("pg_policies");
    expect(releaseGates).toContain("separate, non-atomic commands");
    expect(releaseGates).toContain("policy query must return zero rows");
  });

  it("keeps attribution off pending consent and validates GA4 semantics", () => {
    const compactOperations = compact(operations);

    expect(compactOperations).toContain(
      "First-touch attribution and the new GA4 conversion measurement stay inactive until the consent, retention, deletion, access, and configuration review is approved",
    );
    expect(operations).toContain("NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED");
    expect(compactOperations).toContain(
      "the root GTM loader and aggregate CTA/form `dataLayer` events are a separate control surface",
    );
    expect(operations).toContain(
      "https://www.google-analytics.com/debug/mp/collect",
    );
    expect(operations).toContain(
      "An HTTP 2xx from `/mp/collect` confirms transport only",
    );
    expect(compactOperations).toContain(
      "Separately validate the restricted synthetic payload at `/debug/mp/collect`",
    );
    expect(compactOperations).toContain(
      "credentials for a dedicated non-production GA4 property",
    );
  });

  it("fixes the reporting clock while preserving unresolved activation debt", () => {
    expect(operations).toContain("`Asia/Kolkata`");
    expect(operations).toContain("operator's IANA timezone");
    expect(operations).toContain("ten-attendee ingress cap remains an activation debt");
    expect(operations).toContain("interactive/database conversion E2Es remain pending");
    expect(operations).toContain("legal-entity identity and qualified legal review remain pending");
  });

  it("carries the same schema-first release gate into the deployment runbook", () => {
    expect(deployment).toContain("2026-09-15 SEO measurement foundation");
    const seoChange = compact(
      deployment.slice(
        deployment.indexOf("2026-09-15 SEO measurement foundation"),
        deployment.indexOf("2026-09-07 admin panel v2"),
      ),
    );

    ordered(seoChange, [
      "maintenance/no-ingestion window",
      "npm run db:push",
      "npm run db:rls",
      "deploy application code",
      "activate the Cal.com webhook",
    ]);
    expect(deployment).toContain("`CAL_WEBHOOK_SECRET`");
    expect(deployment).toContain("`CAL_EVENT_TYPE_SLUG`");
    expect(deployment).toContain("`GA4_MEASUREMENT_ID` / `GA4_API_SECRET`");
    expect(deployment).toContain(
      "`NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED=\"false\"`",
    );
    expect(deployment).toContain("`FOUNDER_TIME_ZONE`");
    expect(deployment).toContain("`\"Asia/Kolkata\"`");
  });
});
