import type { Metadata } from "next";
import { ClinicHub } from "@/components/marketing/clinics/clinic-hub";
import { JsonLd } from "@/components/marketing/seo/json-ld";
import { metadataFor, SITE_ORIGIN } from "@/modules/marketing/seo-pages";
import { breadcrumbJsonLd } from "@/modules/marketing/structured-data";

const path = "/industries/clinics";

export const metadata: Metadata = {
  ...metadataFor(path),
  alternates: { canonical: `${SITE_ORIGIN}${path}` },
};

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Clinics", path },
];

export default function ClinicsPage() {
  return (
    <>
      <JsonLd value={breadcrumbJsonLd(breadcrumbs)} />
      <ClinicHub />
    </>
  );
}
