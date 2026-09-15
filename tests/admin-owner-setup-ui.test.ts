import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const actionForm = read("src/components/features/admin-shell/action-form.tsx");
const newWorkspace = read("src/components/features/admin-shell/new-workspace.tsx");
const linkPanel = read("src/components/features/admin-shell/setup-link-panel.tsx");

describe("founder owner setup-link UI", () => {
  it("keeps structured action results out of the toast and exposes a success callback", () => {
    expect(actionForm).toContain("onSuccess");
    expect(actionForm).toContain("onSuccess?.(res)");
    expect(actionForm).toContain("description: res.message");
    expect(actionForm).not.toContain("description: res.setupLink");
  });

  it("replaces the create form with a durable setup-link success state", () => {
    expect(newWorkspace).toContain("SetupLinkPanel");
    expect(newWorkspace).toContain("setSetupLink");
    expect(newWorkspace).toContain("Workspace created");
    expect(newWorkspace).toMatch(/Create another workspace/i);
  });

  it("offers explicit copy and safely-open controls with owner and expiry context", () => {
    expect(linkPanel).toContain("navigator.clipboard.writeText");
    expect(linkPanel).toMatch(/Copy setup link/i);
    expect(linkPanel).toMatch(/Open link/i);
    expect(linkPanel).toContain('target="_blank"');
    expect(linkPanel).toContain('rel="noreferrer noopener"');
    expect(linkPanel).toContain("setupLink.email");
    expect(linkPanel).toContain("setupLink.expiresAt");
  });
});
