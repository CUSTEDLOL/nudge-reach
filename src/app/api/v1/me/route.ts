import { NextResponse } from "next/server";
import { resolveApiKeyOrg } from "@/modules/integrations/api-auth";

/** Identify the key's workspace — the "is my key wired up?" endpoint. */
export async function GET(request: Request) {
  const auth = await resolveApiKeyOrg(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    org: { id: auth.org.id, name: auth.org.name, plan: auth.org.plan },
    // v1 keys grant full workspace access; scoped keys are planned.
    scopes: ["*"],
    docs: "https://github.com/CUSTEDLOL/nudge-reach/blob/main/docs/API.md",
  });
}
