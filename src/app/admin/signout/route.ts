import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin-server";

export async function POST(request: Request) {
  const supabase = await createAdminClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/admin", request.url), { status: 302 });
}
