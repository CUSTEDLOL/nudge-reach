import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamSettingsLoading() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <Skeleton className="mb-2 h-5 w-24" />
        <Skeleton className="mb-4 h-4 w-72" />
        <Card className="p-5">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="mb-1.5 h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-9 w-32" />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div>
        <Skeleton className="mb-2 h-5 w-36" />
        <Skeleton className="mb-4 h-4 w-64" />
        <Card className="p-6">
          <div className="flex gap-4">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
          </div>
        </Card>
      </div>
    </section>
  );
}
