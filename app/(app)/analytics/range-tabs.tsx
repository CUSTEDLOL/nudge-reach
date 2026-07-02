"use client";

import { useRouter } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

const ITEMS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

/** Range picker — writes `?range=` so the server page recomputes. */
export function RangeTabs({ value }: { value: string }) {
  const router = useRouter();
  return (
    <Tabs
      aria-label="Date range"
      items={ITEMS}
      value={value}
      onValueChange={(next) =>
        router.push(`/analytics?range=${next}`, { scroll: false })
      }
    />
  );
}
