import { Skeleton } from "@/components/ui/skeleton";

export default function ContactProfileLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-44" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-[28rem] w-full rounded-2xl lg:col-span-2" />
      </div>
    </div>
  );
}
