import { Skeleton } from "@/components/ui/skeleton";

/**
 * Training's shape, held while the page's reads resolve.
 *
 * It was called `LoadingKnowledge` and painted one full-width column of three
 * stacked cards — the page it stood in for before House Rules made it two
 * columns with a 340px rail, so the whole layout jumped sideways on first
 * paint. This mirrors `page.tsx`: the same grid and rail width, and the rail
 * FIRST in the DOM with `lg:order-last`, so a phone gets the same stack the
 * real page gives it.
 */
export default function LoadingTraining() {
  return (
    <section aria-busy="true" aria-label="Loading Training">
      {/* `PageHeader`: the title, and the auto-reply switch beside Try it in chat. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <Skeleton className="h-7 w-40 max-w-full" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* The rail: "Your business", then where facts come from. */}
        <div className="flex flex-col gap-4 lg:order-last">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>

        {/* The body: House rules, then What it knows. */}
        <div className="flex min-w-0 flex-col gap-8">
          <div>
            <Skeleton className="mb-3 h-6 w-36" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
          <div>
            <Skeleton className="mb-3 h-6 w-44" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
