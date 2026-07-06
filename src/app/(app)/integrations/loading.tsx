import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function IntegrationsLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="mb-2 h-6 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-4 w-48" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton className="h-9 w-56" />
          </div>
          <Skeleton className="mt-5 h-24 w-full rounded-xl" />
        </Card>
        <Card className="p-5">
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="mb-4 h-4 w-72" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="flex items-start gap-3.5 p-5">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
