/**
 * Go-live preflight: every check the runbook needs, as data. The CLI wrapper
 * (scripts/preflight-live.ts) prints the table; this module stays pure so the
 * evaluator is unit-testable with a fake env + fetch.
 *
 * Grading: FAIL only for things that break a live deployment. Simulation with
 * zero keys must never FAIL (invariant 4). Optional integrations WARN.
 */

export type PreflightEnv = Partial<Record<string, string>>;

export interface PreflightCheck {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  detail: string;
}

const GRAPH = "https://graph.facebook.com/v23.0";
const FORBIDDEN_MODEL = /opus|fable|mythos/i;

function present(env: PreflightEnv, key: string): boolean {
  return Boolean(env[key]?.trim());
}

/** Live-required var: FAIL when live, WARN when simulating. */
function liveVar(
  env: PreflightEnv,
  live: boolean,
  key: string,
  name: string
): PreflightCheck {
  if (present(env, key)) return { name, status: "PASS", detail: "set" };
  return live
    ? { name, status: "FAIL", detail: `${key} is required for SEND_MODE=live` }
    : { name, status: "WARN", detail: `${key} unset (fine in simulation)` };
}

async function graphGet(
  fetchFn: typeof fetch,
  path: string,
  token: string
): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetchFn(`${GRAPH}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return { ok: true, detail: "reachable" };
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return {
      ok: false,
      detail: body?.error?.message ?? `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "network error",
    };
  }
}

export async function runPreflight(
  env: PreflightEnv,
  fetchFn: typeof fetch
): Promise<PreflightCheck[]> {
  const checks: PreflightCheck[] = [];
  const mode = env.SEND_MODE ?? "simulation";
  const live = mode === "live";

  // --- mode + model -------------------------------------------------------
  checks.push(
    mode === "live" || mode === "simulation"
      ? { name: "Send mode", status: "PASS", detail: mode }
      : { name: "Send mode", status: "FAIL", detail: `unknown SEND_MODE "${mode}"` }
  );

  const model = env.RUNTIME_MODEL ?? "";
  if (FORBIDDEN_MODEL.test(model)) {
    checks.push({
      name: "Runtime model",
      status: "FAIL",
      detail: `${model} is blocked by the model guard (invariant 3)`,
    });
  } else if (model.includes("sonnet")) {
    checks.push({ name: "Runtime model", status: "PASS", detail: model });
  } else {
    checks.push({
      name: "Runtime model",
      status: "WARN",
      detail: `${model || "unset"} — production choice is claude-sonnet-5`,
    });
  }

  // --- secrets ------------------------------------------------------------
  checks.push(liveVar(env, live, "TOKEN_ENCRYPTION_KEY", "Token encryption key"));
  checks.push(liveVar(env, live, "META_APP_SECRET", "Meta app secret"));
  checks.push(
    liveVar(env, live, "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "Webhook verify token")
  );
  checks.push(
    present(env, "CRON_SECRET")
      ? { name: "Cron secret", status: "PASS", detail: "set" }
      : {
          name: "Cron secret",
          status: "WARN",
          detail:
            "CRON_SECRET unset — /api/cron/* is unauthenticated; also set the GitHub repo secret",
        }
  );

  // --- Meta Cloud API -----------------------------------------------------
  const token = env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) {
    checks.push(
      live
        ? {
            name: "WhatsApp access token",
            status: "FAIL",
            detail: "WHATSAPP_ACCESS_TOKEN is required for SEND_MODE=live",
          }
        : {
            name: "WhatsApp access token",
            status: "WARN",
            detail: "unset — Meta checks skipped (fine in simulation)",
          }
    );
  } else {
    const me = await graphGet(fetchFn, "me", token);
    checks.push({
      name: "WhatsApp access token",
      status: me.ok ? "PASS" : "FAIL",
      detail: me.ok
        ? "valid (use a System User token so it never expires)"
        : me.detail,
    });

    if (env.WABA_ID) {
      const waba = await graphGet(fetchFn, `${env.WABA_ID}?fields=id,name`, token);
      checks.push({
        name: "WABA reachable",
        status: waba.ok ? "PASS" : "FAIL",
        detail: waba.ok ? `WABA ${env.WABA_ID}` : waba.detail,
      });
      const subs = await graphGet(fetchFn, `${env.WABA_ID}/subscribed_apps`, token);
      checks.push({
        name: "Webhook subscription",
        status: subs.ok ? "PASS" : "FAIL",
        detail: subs.ok ? "app subscribed to WABA webhooks" : subs.detail,
      });
    } else {
      checks.push({
        name: "WABA reachable",
        status: live ? "FAIL" : "WARN",
        detail: "WABA_ID unset",
      });
    }

    if (env.PHONE_NUMBER_ID) {
      const phone = await graphGet(
        fetchFn,
        `${env.PHONE_NUMBER_ID}?fields=id,display_phone_number`,
        token
      );
      checks.push({
        name: "Phone number reachable",
        status: phone.ok ? "PASS" : "FAIL",
        detail: phone.ok ? `phone ${env.PHONE_NUMBER_ID}` : phone.detail,
      });
    } else {
      checks.push({
        name: "Phone number reachable",
        status: live ? "FAIL" : "WARN",
        detail: "PHONE_NUMBER_ID unset",
      });
    }
  }

  // --- Supabase -----------------------------------------------------------
  checks.push(
    present(env, "NEXT_PUBLIC_SUPABASE_URL")
      ? { name: "Supabase URL", status: "PASS", detail: "set" }
      : { name: "Supabase URL", status: "FAIL", detail: "NEXT_PUBLIC_SUPABASE_URL unset" }
  );
  if (present(env, "SUPABASE_ACCESS_TOKEN") && present(env, "NEXT_PUBLIC_SUPABASE_URL")) {
    const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
    try {
      const res = await fetchFn(
        `https://api.supabase.com/v1/projects/${ref}/config/auth`,
        { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } }
      );
      const cfg = (await res.json().catch(() => null)) as {
        site_url?: string;
      } | null;
      const site = cfg?.site_url ?? "";
      checks.push(
        res.ok && site.includes("nudgeagent.app")
          ? { name: "Supabase site URL", status: "PASS", detail: site }
          : {
              name: "Supabase site URL",
              status: live ? "FAIL" : "WARN",
              detail: res.ok
                ? `site_url is "${site}" — expected nudgeagent.app`
                : `management API HTTP ${res.status}`,
            }
      );
    } catch {
      checks.push({
        name: "Supabase site URL",
        status: "WARN",
        detail: "management API unreachable — verify manually in the dashboard",
      });
    }
  } else {
    checks.push({
      name: "Supabase site URL",
      status: "WARN",
      detail:
        "SUPABASE_ACCESS_TOKEN unset — verify Site URL + redirect allowlist manually (Dashboard → Auth → URL configuration)",
    });
  }

  // --- optional integrations (never FAIL) ---------------------------------
  checks.push(
    present(env, "RAZORPAY_KEY_ID") && present(env, "RAZORPAY_KEY_SECRET")
      ? { name: "Razorpay keys", status: "PASS", detail: "set" }
      : { name: "Razorpay keys", status: "WARN", detail: "absent — INR billing runs in free mode" }
  );
  checks.push(
    present(env, "STRIPE_SECRET_KEY")
      ? { name: "Stripe keys", status: "PASS", detail: "set" }
      : { name: "Stripe keys", status: "WARN", detail: "absent — non-INR billing runs in free mode" }
  );
  checks.push(
    present(env, "GOOGLE_CLIENT_ID") && present(env, "GOOGLE_CLIENT_SECRET")
      ? { name: "Google OAuth keys", status: "PASS", detail: "set" }
      : { name: "Google OAuth keys", status: "WARN", detail: "absent — calendar connect stays simulated" }
  );
  checks.push(
    present(env, "NEXT_PUBLIC_APP_URL")
      ? { name: "App URL", status: "PASS", detail: env.NEXT_PUBLIC_APP_URL! }
      : { name: "App URL", status: "WARN", detail: "NEXT_PUBLIC_APP_URL unset — pay/email links fall back to deploy URL" }
  );

  return checks;
}
