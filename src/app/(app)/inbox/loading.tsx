import { Skeleton } from "@/components/ui/skeleton";

export function ChatListSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="px-4 pb-2 pt-3">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="mt-3 h-10 w-full rounded-full" />
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-full" />
          ))}
        </div>
      </div>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex h-[72px] items-center gap-3 px-3">
          <Skeleton className="h-[49px] w-[49px] rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3.5 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InboxLoading() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden bg-white lg:grid-cols-[clamp(300px,32%,420px)_minmax(0,1fr)]">
      <ChatListSkeleton className="border-[#e9edef] lg:border-r" />
      <div className="hidden bg-[#f0f2f5] lg:block" />
    </div>
  );
}
