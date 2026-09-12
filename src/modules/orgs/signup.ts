/**
 * Open signup switch.
 *
 * Nudge sells on a demo call: the founder creates the workspace on the plan the
 * client paid for and invites their email as OWNER, so self-serve signup is
 * closed by DEFAULT. Set `SIGNUP_OPEN="1"` to reopen it.
 *
 * Closing signup does not block invited people. An invite is resolved before
 * any workspace is created (`modules/orgs/org.ts` step 3), so an invited owner
 * or teammate still signs up normally and chooses their own password. What is
 * refused is an authenticated stranger silently getting a fresh workspace —
 * which is also why this is enforced at org creation and not only in the UI:
 * Supabase may hold an auth user we never invited (an old signup, or a social
 * login), and no workspace should follow from that.
 */
export function isSignupOpen(): boolean {
  return process.env.SIGNUP_OPEN === "1";
}
