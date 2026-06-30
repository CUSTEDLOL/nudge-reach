"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  simulateInboundAction,
  type SimResult,
} from "@/app/conversations/actions";

export function SimTester({ defaultPhone }: { defaultPhone: string }) {
  const router = useRouter();
  const [result, action, pending] = useActionState(
    async (_p: SimResult | null, fd: FormData) => {
      const r = await simulateInboundAction(fd);
      router.refresh();
      return r;
    },
    null
  );

  return (
    <div className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/50 p-5">
      <h2 className="text-sm font-semibold text-blue-900">
        🧪 Test your assistant
      </h2>
      <p className="mt-1 text-xs text-blue-800">
        Pretend a customer messages you. The assistant replies exactly as it
        would on real WhatsApp.
      </p>
      <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          name="phone"
          defaultValue={defaultPhone}
          className="w-40 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          placeholder="+91…"
        />
        <input
          name="text"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          placeholder="e.g. Are you open on Sunday? Any veg starters?"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </form>
      {result && (
        <p className="mt-2 text-xs font-medium text-blue-900">{result.message}</p>
      )}
    </div>
  );
}
