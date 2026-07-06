import { Skeleton } from "@/components/ui/skeleton";

export default function NewAutomationLoading() {
  return (
    <div aria-busy="true" aria-label="Loading builder">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-52" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
    </div>
  );
}
