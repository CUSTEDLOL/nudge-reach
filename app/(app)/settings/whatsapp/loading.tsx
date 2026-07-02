import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function WhatsappSettingsLoading() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <Skeleton className="mb-2 h-5 w-44" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <Card className="p-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-36" />
        </div>
      </Card>
    </section>
  );
}
