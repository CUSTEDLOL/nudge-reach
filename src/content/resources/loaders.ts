import type { ComponentType } from "react";
import type {
  PublishedResource,
  ResourceRecord,
} from "@/content/resources/manifest";

type ResourceModule = {
  default: ComponentType<{ resource: ResourceRecord }>;
};
type ResourceLoader = () => Promise<ResourceModule>;

export const RESOURCE_LOADERS = {
  "how-to-build-whatsapp-ai-automation": () =>
    import("@/content/resources/how-to-build-whatsapp-ai-automation"),
  "how-to-stop-losing-leads-on-whatsapp": () =>
    import("@/content/resources/how-to-stop-losing-leads-on-whatsapp"),
  "whatsapp-appointment-booking-for-clinics": () =>
    import("@/content/resources/whatsapp-appointment-booking-for-clinics"),
} as const satisfies Record<PublishedResource["slug"], ResourceLoader>;
