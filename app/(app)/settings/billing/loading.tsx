import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function BillingSettingsLoading() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <Skeleton className="mb-2 h-5 w-20" />
        <Skeleton className="mb-4 h-4 w-72" />
        <Card className="p-6">
          <Skeleton className="mb-2 h-4 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="mb-3 h-3 w-32" />
            <Skeleton className="h-7 w-24" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="mb-3 h-4 w-20" />
            <Skeleton className="mb-4 h-7 w-28" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
