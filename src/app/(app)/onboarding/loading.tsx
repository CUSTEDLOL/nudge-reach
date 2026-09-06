import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading setup"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-2 sm:py-6"
    >
      <div>
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-[31rem] w-full rounded-2xl" />
    </div>
  );
}
