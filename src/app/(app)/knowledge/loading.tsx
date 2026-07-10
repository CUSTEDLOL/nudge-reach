import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingKnowledge() {
  return (
    <section>
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-8 h-4 w-72" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </section>
  );
}
