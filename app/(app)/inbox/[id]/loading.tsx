import { Skeleton } from "@/components/ui/skeleton";

export default function ThreadLoading() {
  return (
    <>
      <div className="mb-6 hidden lg:block">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid h-[calc(100dvh-6.5rem)] min-h-[26rem] grid-cols-1 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft lg:h-[calc(100dvh-12.5rem)] lg:grid-cols-[minmax(280px,20rem)_1fr] xl:grid-cols-[minmax(280px,20rem)_minmax(0,1fr)_minmax(250px,18.5rem)]">
        {/* list */}
        <div className="hidden flex-col border-r border-neutral-100 lg:flex">
          <div className="border-b border-neutral-100 p-3">
            <Skeleton className="h-9 w-full" />
            <div className="mt-2.5 flex gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-14 rounded-full" />
              ))}
            </div>
          </div>
          <div className="space-y-1 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
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
        {/* thread */}
        <div className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex-1 space-y-3 bg-neutral-50/60 p-4">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="ml-auto h-12 w-1/2" />
            <Skeleton className="h-12 w-2/5" />
            <Skeleton className="ml-auto h-12 w-2/5" />
          </div>
          <div className="border-t border-neutral-100 p-3">
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
        {/* context */}
        <div className="hidden space-y-4 border-l border-neutral-100 p-4 xl:block">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </>
  );
}
