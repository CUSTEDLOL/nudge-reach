import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AgentSettingsLoading() {
  return (
    <section>
      <Skeleton className="mb-2 h-5 w-24" />
      <Skeleton className="mb-4 h-4 w-96 max-w-full" />
      <Card className="p-6">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-32" />
        </div>
      </Card>
    </section>
  );
}
