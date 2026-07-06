import { Skeleton } from "@/components/ui/skeleton";

export default function TemplatesLoading() {
  return (
    <div aria-busy="true" aria-label="Loading templates">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="mb-4 h-9 w-96 max-w-full" />
      <Skeleton className="mb-3 h-9 w-72 max-w-full" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}
