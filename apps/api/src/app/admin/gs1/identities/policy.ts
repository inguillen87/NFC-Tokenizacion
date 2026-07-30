import { checkAdminPermission } from "../../../../lib/auth";

export type Gs1RegistryPermission = "read" | "write";

export function checkGs1RegistryPermission(req: Request, permission: Gs1RegistryPermission) {
  const dedicated = checkAdminPermission(req, `gs1:${permission}`);
  if (!dedicated) return null;
  if (permission === "write") return dedicated;
  return checkAdminPermission(req, "tags:read");
}
