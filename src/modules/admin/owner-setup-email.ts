function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function ownerSetupEmail(
  orgName: string,
  email: string,
  setupUrl: string
) {
  return {
    to: email,
    subject: `Set up your Nudge workspace, ${orgName}`,
    text: [
      `Your Nudge workspace for ${orgName} is ready.`,
      "",
      `Choose your password within 7 days: ${setupUrl}`,
      `This private, single-use link is reserved for ${email}.`,
      "",
      "Nudge is your AI Front Desk: it answers customers on WhatsApp, captures leads and, on your plan, books appointments and chases the ones who go quiet.",
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0b3d2e;margin:0 0 12px">Your workspace is ready</h2>
        <p style="color:#374151;line-height:1.6;margin:0 0 20px">
          We've set up <strong>${escapeHtml(orgName)}</strong> on Nudge. Choose a
          password within 7 days and you'll land straight in your workspace.
        </p>
        <a href="${escapeHtml(setupUrl)}" style="display:inline-block;background:#02a258;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">
          Set up your account
        </a>
        <p style="color:#9ca3af;font-size:12px;margin:20px 0 0">
          This private, single-use link is reserved for ${escapeHtml(email)}.
          We never send passwords — you choose your own.
        </p>
      </div>`,
  };
}

