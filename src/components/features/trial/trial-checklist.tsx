import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import type { TrialChecklistItem } from "@/modules/trial/checklist";

export function TrialChecklist({ items }: { items: TrialChecklistItem[] }) {
  return (
    <ol className="divide-y divide-neutral-100">
      {items.map((item, index) => (
        <li key={item.key}>
          <Link
            href={item.href}
            className="group flex min-h-16 items-center gap-3 rounded-lg px-2 py-3 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-400/60"
          >
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${item.done ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-500"}`}
              aria-label={item.done ? "Complete" : "Not complete"}
            >
              {item.done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-semibold ${item.done ? "text-neutral-500" : "text-neutral-900"}`}>
                {item.label}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
                {item.description}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden />
          </Link>
        </li>
      ))}
    </ol>
  );
}
