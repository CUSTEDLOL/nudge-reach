/**
 * Point Supabase Auth at production so signup / password-reset emails land on
 * nudgeagent.app instead of localhost, and switch both templates to the
 * token_hash form (works when the email is opened on another device).
 *
 * Needs a Supabase personal access token (dashboard → Account → Access Tokens)
 * in SUPABASE_ACCESS_TOKEN. Never commit it. Run:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/supabase-auth-config.mjs
 */
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "lgojsxrljjmkwxawocdk";
const SITE_URL = process.env.SITE_URL ?? "https://nudgeagent.app";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Set SUPABASE_ACCESS_TOKEN (Supabase → Account → Access Tokens).");
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const desired = {
  site_url: SITE_URL,
  uri_allow_list: [`${SITE_URL}/**`, "http://localhost:3000/**"].join(","),
  mailer_templates_confirmation_content: `<h2>Confirm your email</h2>
<p>Tap the link below to finish setting up your Nudge workspace.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard">Confirm my email</a></p>`,
  mailer_templates_recovery_content: `<h2>Reset your password</h2>
<p>Tap the link below to choose a new password. If you didn't ask for this, ignore this email.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset">Choose a new password</a></p>`,
};

const before = await fetch(API, { headers }).then((r) => r.json());
console.log("before:", { site_url: before.site_url, uri_allow_list: before.uri_allow_list });

const res = await fetch(API, { method: "PATCH", headers, body: JSON.stringify(desired) });
if (!res.ok) {
  console.error("PATCH failed:", res.status, await res.text());
  process.exit(1);
}
const after = await res.json();
console.log("after: ", { site_url: after.site_url, uri_allow_list: after.uri_allow_list });
console.log("Done — signup and reset emails now land on", SITE_URL);
