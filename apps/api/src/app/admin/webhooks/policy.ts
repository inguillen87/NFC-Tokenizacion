import { checkAdminPermission } from "../../../lib/auth";

export type WebhookAdminPermission = "read" | "write";

export function checkWebhookPermission(req: Request, permission: WebhookAdminPermission): Response | null {
  const dedicated = checkAdminPermission(req, `webhooks:${permission}`);
  if (!dedicated) return null;

  // Preserve the existing tenant-admin contract while allowing dedicated
  // least-privilege webhook operator grants.
  return checkAdminPermission(req, `tenant:${permission}`);
}
