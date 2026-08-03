import { checkAdminPermission, getAdminPrincipal } from "../../../lib/auth";
import { roleMayUseEnterpriseCapability } from "../../../lib/enterprise-capability-policy";
import { permissionDenied } from "../../../lib/permission-matcher.js";

export type WebhookAdminPermission = "read" | "write";

export function checkWebhookPermission(req: Request, permission: WebhookAdminPermission): Response | null {
  let principal: ReturnType<typeof getAdminPrincipal>;
  try {
    principal = getAdminPrincipal(req);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!roleMayUseEnterpriseCapability(principal.role, "webhooks.manage")) {
    return new Response("Forbidden", { status: 403 });
  }
  const dedicated = checkAdminPermission(req, `webhooks:${permission}`);
  if (!dedicated) return null;
  if (permissionDenied(principal.deniedPermissions, `webhooks:${permission}`)) {
    return dedicated;
  }

  // Preserve the existing tenant-admin contract while allowing dedicated
  // least-privilege webhook operator grants.
  return checkAdminPermission(req, `tenant:${permission}`);
}
