import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="mt-6 h-72 w-full" />
    </div>
  );
}
