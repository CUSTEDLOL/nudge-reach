import { Skeleton } from "@/components/ui/skeleton";

export default function CampaignDetailLoading() {
  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 max-w-[340px] rounded-[2rem]" />
      </div>
    </div>
  );
}
