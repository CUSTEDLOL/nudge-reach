import { Skeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid h-[calc(100dvh-12.5rem)] min-h-[26rem] grid-cols-1 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft lg:grid-cols-[minmax(300px,22rem)_1fr]">
        <div className="flex flex-col border-neutral-100 lg:border-r">
          <div className="border-b border-neutral-100 p-3">
            <Skeleton className="h-9 w-full" />
            <div className="mt-2.5 flex gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>
          <div className="space-y-1 p-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex gap-3 py-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden bg-neutral-50/60 lg:block" />
      </div>
    </>
  );
}
