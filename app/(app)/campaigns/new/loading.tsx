import { Skeleton } from "@/components/ui/skeleton";

export default function NewBroadcastLoading() {
  return (
    <div className="max-w-5xl">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-6 flex items-center gap-3">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Skeleton className="mt-6 h-8 w-72" />
      <Skeleton className="mt-5 h-64 w-full max-w-2xl rounded-2xl" />
    </div>
  );
}
