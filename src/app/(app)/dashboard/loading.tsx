import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading Today workspace"
      className="flex min-w-0 flex-col gap-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-4 w-44 max-w-full" />
          <Skeleton className="mt-2 h-8 w-64 max-w-full" />
          <Skeleton className="mt-2 h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-40 max-w-full" />
      </div>

      <section>
        <Skeleton className="mb-3 h-6 w-52" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </section>

      <section>
        <Skeleton className="mb-3 h-6 w-48" />
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-neutral-200 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-none bg-white" />
          ))}
        </div>
      </section>

      <Skeleton className="h-44 w-full rounded-2xl" />

      <section>
        <Skeleton className="mb-3 h-6 w-40" />
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-neutral-200 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-none bg-white" />
          ))}
        </div>
      </section>

      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-80 w-full rounded-2xl" />
    </div>
  );
}
