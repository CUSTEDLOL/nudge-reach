import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Train AI" };

export default function TrialSetupPage() {
  redirect("/agent");
}
