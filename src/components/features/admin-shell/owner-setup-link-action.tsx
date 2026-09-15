"use client";

import { useState } from "react";
import type { OwnerSetupLink } from "@/modules/orgs/owner-setup";
import { ActionForm, type ActionFn } from "./action-form";
import { SetupLinkPanel } from "./setup-link-panel";

export function OwnerSetupLinkAction({
  action,
  orgId,
  inviteId,
}: {
  action: ActionFn;
  orgId: string;
  inviteId: string;
}) {
  const [setupLink, setSetupLink] = useState<OwnerSetupLink | null>(null);

  return (
    <div className={setupLink ? "w-full basis-full pt-2" : ""}>
      <ActionForm
        action={action}
        hidden={{ orgId, inviteId }}
        submitLabel="Generate new setup link"
        variant="ghost"
        confirm={{
          title: "Replace this owner setup link?",
          description:
            "The previous link will stop working immediately. The new link lasts 7 days.",
        }}
        onSuccess={(result) => {
          if (result.setupLink) setSetupLink(result.setupLink);
        }}
      />
      {setupLink ? (
        <div className="mt-3">
          <SetupLinkPanel setupLink={setupLink} />
        </div>
      ) : null}
    </div>
  );
}

