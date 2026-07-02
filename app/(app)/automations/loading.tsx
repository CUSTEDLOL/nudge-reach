import { Skeleton } from "@/components/ui/skeleton";

export default function AutomationsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading automations">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-44" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
        <Skeleton className="h-4 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="mt-4 h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
