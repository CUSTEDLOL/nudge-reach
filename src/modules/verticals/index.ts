import { studyAbroadPack } from "@/modules/verticals/packs/study-abroad";
import type { VerticalPack } from "@/modules/verticals/types";

/**
 * Pack registry. Adding a vertical = one pack file + one line here + a
 * VERTICALS entry (dashboard/verticals.ts). tests/verticals-pack.test.ts
 * enforces every pack's shape.
 */
export const PACKS: Record<string, VerticalPack> = {
  [studyAbroadPack.id]: studyAbroadPack,
};

export const PACK_IDS = Object.keys(PACKS);

export function getPack(id: string | null | undefined): VerticalPack | undefined {
  return id ? PACKS[id] : undefined;
}

/** Precedence: AgentProfile.vertical (what the agent runs on) then Org.vertical. */
export function packForOrg(o: {
  profileVertical?: string | null;
  orgVertical?: string | null;
}): VerticalPack | undefined {
  return getPack(o.profileVertical) ?? getPack(o.orgVertical);
}
