"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/modules/orgs/auth";
import { activateTrialAgentIfGrounded } from "@/modules/trial/activation";

export interface CompleteTrialSetupResult {
  ok: false;
  message: string;
}

export async function completeTrialSetupAction(): Promise<CompleteTrialSetupResult> {
  const ctx = await requireOrgContext();

  try {
    const activation = await activateTrialAgentIfGrounded(ctx);
    if (activation.status === "no_knowledge") {
      return {
        ok: false,
        message: "Approve at least one business fact before opening your trial.",
      };
    }
    if (activation.status === "not_restricted") {
      return {
        ok: false,
        message: "This free-trial setup is no longer available.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Couldn't finish your trial setup. Please try again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/agent");
  redirect("/dashboard");
}
