import type { Request } from "express";

export function hubAdminTokenConfigured(): boolean {
  return Boolean(process.env.HUB_ADMIN_TOKEN?.trim());
}

export function assertHubAdmin(req: Request): void {
  const expected = process.env.HUB_ADMIN_TOKEN?.trim();
  if (!expected) {
    throw new Error("HUB_ADMIN_TOKEN is not configured on the server.");
  }
  const header = req.header("x-hub-admin-token")?.trim();
  if (!header || header !== expected) {
    throw new Error("Unauthorized");
  }
}
