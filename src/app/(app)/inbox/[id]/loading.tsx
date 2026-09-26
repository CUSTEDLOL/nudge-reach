import { Skeleton } from "@/components/ui/skeleton";
import { ChatListSkeleton } from "../loading";

export default function ThreadLoading() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden bg-white lg:grid-cols-[clamp(300px,32%,420px)_minmax(0,1fr)]">
      <ChatListSkeleton className="hidden border-[#e9edef] lg:block lg:border-r" />
      <div className="flex min-h-0 flex-col">
        <div className="flex h-[60px] items-center gap-3 bg-[#f0f2f5] px-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex-1 space-y-3 bg-[#efeae2] px-[7%] py-4">
          <Skeleton className="h-10 w-2/5" />
          <Skeleton className="ml-auto h-10 w-2/5" />
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="ml-auto h-10 w-1/2" />
        </div>
        <div className="flex h-[60px] items-center gap-2 bg-[#f0f2f5] px-4">
          <Skeleton className="h-10 flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
