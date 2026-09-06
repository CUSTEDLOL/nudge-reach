import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AttentionQueueSection } from "@/components/features/dashboard/attention-queue";
import { BusinessPulse } from "@/components/features/dashboard/business-pulse";
import { FrontDeskSummary } from "@/components/features/dashboard/front-desk-summary";
import { OperationsSummary } from "@/components/features/dashboard/operations-summary";
import { RecentActivity } from "@/components/features/dashboard/recent-activity";
import { SetupProgress } from "@/components/features/dashboard/setup-progress";

describe("Today dashboard UI", () => {
  it("always gives an all-clear attention state a useful next action", () => {
    const html = renderToStaticMarkup(
      h(AttentionQueueSection, {
        queue: {
          items: [],
          totalCount: 0,
          hiddenCount: 0,
          allClear: true,
        },
      })
    );
    expect(html).toContain("Needs your attention");
    expect(html).toContain("You&#x27;re caught up");
    expect(html).toContain('href="/inbox/try"');
  });

  it("supports the concise view selected during onboarding", () => {
    const attention = renderToStaticMarkup(
      h(AttentionQueueSection, {
        showDescription: false,
        queue: {
          items: [],
          totalCount: 0,
          hiddenCount: 0,
          allClear: true,
        },
      })
    );
    const operations = renderToStaticMarkup(
      h(OperationsSummary, {
        showDescription: false,
        currency: "INR",
        items: [],
      })
    );

    expect(attention).not.toContain(
      "The few things where a person can make the difference."
    );
    expect(operations).not.toContain(
      "A quick read on the work moving through your front desk."
    );
  });

  it("labels urgent work and progressively reveals overflow rows", () => {
    const handoff = {
      kind: "handoff" as const,
      title: "Customer handoffs",
      description: "2 conversations are waiting for a person.",
      href: "/inbox?filter=handoff",
      count: 2,
      urgent: true,
    };
    const hidden = {
      kind: "setup" as const,
      title: "Finish workspace setup",
      description: "2 setup steps remain.",
      href: "/onboarding?customize=1",
      count: 2,
      urgent: false,
    };
    const html = renderToStaticMarkup(
      h(AttentionQueueSection, {
        queue: {
          items: [handoff],
          totalCount: 2,
          hiddenCount: 1,
          hiddenItems: [hidden],
          allClear: false,
        },
      })
    );
    expect(html).toContain("Urgent");
    expect(html).toContain("Customer handoffs");
    expect(html).toContain("View 1 more");
    expect(html).toContain("Finish workspace setup");
  });

  it("renders operations as one readable strip with honest currency context", () => {
    const html = renderToStaticMarkup(
      h(OperationsSummary, {
        currency: "INR",
        items: [
          {
            key: "bookings",
            label: "Appointments today",
            value: 3,
            detailCount: 2,
            detailLabel: "requests to confirm",
            href: "/inbox",
          },
          {
            key: "payments",
            label: "Payments awaiting",
            value: 4,
            amountMinor: 152_500,
            href: "/inbox",
          },
        ],
      })
    );
    expect(html).toContain("Today&#x27;s operations");
    expect(html).toContain("Appointments today");
    expect(html).toContain("2 requests to confirm");
    expect(html).toMatch(/1,525/);
  });

  it("describes Front Desk work in plain language, not chart labels", () => {
    const html = renderToStaticMarkup(
      h(FrontDeskSummary, {
        openConversations: 7,
        bookingsThisMonth: 5,
        followUpsThisMonth: 9,
        handoffCount: 1,
        followupsEnabled: true,
        simulationMode: true,
      })
    );
    expect(html).toContain("AI Front Desk activity");
    expect(html).toContain("monitoring 7 open conversations");
    expect(html).toContain("captured 5 bookings");
    expect(html).toContain("Test mode");
  });

  it("keeps Business pulse to four outcome metrics", () => {
    const html = renderToStaticMarkup(
      h(BusinessPulse, {
        bookingsThisMonth: 5,
        leadsChasedThisMonth: 9,
        revenueInfluenced: 149_900,
        wonContacts: 10,
        optedInContacts: 40,
        totalContacts: 50,
        currency: "INR",
      })
    );
    expect(html).toContain("Business pulse");
    expect(html.match(/data-pulse-metric=/g)).toHaveLength(4);
    expect(html).toContain("Estimated influence");
  });

  it("makes incomplete setup and empty recent activity actionable", () => {
    const setup = renderToStaticMarkup(
      h(SetupProgress, {
        orgName: "Nudge Clinic",
        checklist: {
          completed: 1,
          total: 2,
          allDone: false,
          items: [
            {
              key: "knowledge",
              title: "Teach your AI the business",
              description: "Add business facts.",
              href: "/agent/questionnaire",
              done: true,
            },
            {
              key: "tryit",
              title: "Try your AI",
              description: "Watch it reply.",
              href: "/inbox/try",
              done: false,
            },
          ],
        },
      })
    );
    const recent = renderToStaticMarkup(
      h(RecentActivity, { conversations: [], campaigns: [] })
    );
    expect(setup).toContain("Finish setting up Nudge Clinic");
    expect(setup).toContain('href="/inbox/try"');
    expect(recent).toContain("No conversations yet");
    expect(recent).toContain("No campaigns yet");
  });

  it("does not advertise campaign controls in the agent activity view", () => {
    const html = renderToStaticMarkup(
      h(RecentActivity, {
        conversations: [],
        campaigns: [],
        showCampaigns: false,
      })
    );
    expect(html).toContain("No conversations yet");
    expect(html).not.toContain("Campaigns");
    expect(html).not.toContain("Create a campaign");
  });
});
