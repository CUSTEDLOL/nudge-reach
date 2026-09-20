import type { Metadata } from "next";
import { requireOrgContext } from "@/modules/orgs/auth";
import { requireAcquisitionTrial } from "@/modules/trial/workspace";
import {
  LockedFeatureCard,
  TRIAL_LOCKED_FEATURES,
  lockedFeatureForSegment,
} from "@/components/features/trial/locked-feature-card";
import { MarkExploreViewed } from "./mark-viewed";

export const metadata: Metadata = { title: "Explore the full AI Front Desk" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>;
}) {
  const [ctx, params] = await Promise.all([requireOrgContext(), searchParams]);
  await requireAcquisitionTrial(ctx.org.id);
  const selected = lockedFeatureForSegment(params.feature ?? "");

  return (
    <section>
      <MarkExploreViewed />
      <header className="max-w-3xl">
        <p className="text-sm font-semibold text-brand-700">Explore the full Front Desk</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">See what Nudge can run after your trial</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-500">These are honest product previews. They stay locked until your clinic chooses a paid plan and we connect the real systems with you.</p>
      </header>
      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TRIAL_LOCKED_FEATURES.map((feature) => (
          <LockedFeatureCard key={feature.key} feature={feature} initiallyOpen={selected === feature.key} />
        ))}
      </div>
    </section>
  );
}
