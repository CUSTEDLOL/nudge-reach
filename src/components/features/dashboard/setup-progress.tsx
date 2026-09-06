import Link from "next/link";
import { ArrowRight, Check, CircleDot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Checklist } from "@/modules/dashboard/stats";

export function SetupProgress({
  checklist,
  orgName,
}: {
  checklist: Checklist;
  orgName: string;
}) {
  if (checklist.allDone) return null;
  const pending = checklist.items.filter((item) => !item.done);

  return (
    <section aria-labelledby="setup-heading">
      <Card className="overflow-hidden shadow-none">
        <div className="flex flex-col gap-4 border-b border-neutral-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2
              id="setup-heading"
              className="text-lg font-semibold tracking-tight text-neutral-950"
            >
              Finish setting up {orgName}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {checklist.completed} of {checklist.total} steps complete. These
              choices never switch on live messages automatically.
            </p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-52">
            <Progress
              value={checklist.completed}
              max={checklist.total}
              label="Workspace setup progress"
            />
            <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-700">
              {checklist.completed}/{checklist.total}
            </span>
          </div>
        </div>
        <ol className="divide-y divide-neutral-100">
          {pending.map((item, index) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="group flex min-h-16 items-center gap-3 px-4 py-3 outline-none transition-colors duration-150 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/60 sm:px-6"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-neutral-950">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-sm leading-5 text-neutral-600">
                    {item.description}
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand-700"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ol>
        {checklist.completed > 0 && (
          <div className="flex items-center gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-3 text-xs text-neutral-600 sm:px-6">
            <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
            {checklist.completed} completed
            <CircleDot className="ml-auto h-3.5 w-3.5 text-brand-600" aria-hidden />
            {pending.length} remaining
          </div>
        )}
      </Card>
    </section>
  );
}
