import type { ComponentType } from "react";
import type { PublishedResource } from "@/content/resources/manifest";

type ResourceModule = { default: ComponentType };
type ResourceLoader = () => Promise<ResourceModule>;

export const RESOURCE_LOADERS = {
  "whatsapp-appointment-booking-for-clinics": () =>
    import("@/content/resources/whatsapp-appointment-booking-for-clinics"),
} as const satisfies Record<PublishedResource["slug"], ResourceLoader>;
