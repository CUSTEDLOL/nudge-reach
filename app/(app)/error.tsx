"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-base font-semibold text-neutral-900">
            Something went wrong
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            That didn&apos;t work — it&apos;s on us, not you. Try again, or head
            back to your dashboard.
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-xs text-neutral-400">
              Ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "secondary" })}
          >
            Go to dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}
