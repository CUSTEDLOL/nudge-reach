import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading setup"
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4"
    >
      <div>
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-full" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
