import { Skeleton } from "@/components/ui/skeleton";

export default function TemplateDetailLoading() {
  return (
    <div aria-busy="true" aria-label="Loading template">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <Skeleton className="mt-6 h-14 w-full rounded-2xl" />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-[34rem] w-full rounded-2xl" />
        <Skeleton className="mx-auto h-[26rem] w-full max-w-[340px] rounded-[2rem]" />
      </div>
    </div>
  );
}
