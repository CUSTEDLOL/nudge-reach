"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { updateMemberNumbersAction } from "./actions";

/**
 * E4b: per-member number access chips. Shown only for AGENT rows in orgs with
 * more than one number. Empty selection = sees all numbers.
 */
export function MemberNumbersSelect({
  membershipId,
  numbers,
  selected,
  disabled,
}: {
  membershipId: string;
  numbers: { id: string; displayName: string }[];
  selected: string[];
  disabled: boolean;
}) {
  const { toast } = useToast();
  const [ids, setIds] = useState<string[]>(selected);
  const [busy, setBusy] = useState(false);
  const dirty =
    ids.length !== selected.length || ids.some((id) => !selected.includes(id));

  function toggle(id: string) {
    setIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function save() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("membershipId", membershipId);
      ids.forEach((id) => fd.append("accountIds", id));
      const res = await updateMemberNumbersAction(fd);
      toast({ tone: res.ok ? "success" : "error", description: res.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {numbers.map((n) => {
        const on = ids.includes(n.id);
        return (
          <button
            key={n.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(n.id)}
            className={
              "rounded-full border px-2.5 py-0.5 text-xs transition " +
              (on
                ? "border-brand-300 bg-brand-50 text-brand-700"
                : "border-neutral-200 text-neutral-500 hover:border-neutral-300")
            }
          >
            {n.displayName}
          </button>
        );
      })}
      {ids.length === 0 && (
        <span className="text-xs text-neutral-400">all numbers</span>
      )}
      {dirty && !disabled && (
        <Button size="sm" variant="secondary" onClick={save} loading={busy}>
          Save
        </Button>
      )}
    </div>
  );
}
