const BOOTSTRAP_SUPER_ADMIN_EMAIL = "guillen.marce@gmail.com";
const PLACEHOLDER_DOMAINS = new Set(["example.com", "example.org", "example.net"]);

function splitEmailList(raw: string) {
  return raw
    .split(/[\s,;]+/g)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeAllowlistEmail(raw: string) {
  const email = String(raw || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return "";
  const domain = email.split("@").pop() || "";
  if (PLACEHOLDER_DOMAINS.has(domain)) return "";
  return email;
}

export function getClerkSuperAdminEmailAllowlist(env: NodeJS.ProcessEnv = process.env) {
  const explicit = [
    env.DASHBOARD_CLERK_SUPERADMIN_EMAIL_ALLOWLIST,
    env.CLERK_SUPERADMIN_EMAIL_ALLOWLIST,
    env.SUPER_ADMIN_EMAILS,
    env.SUPER_ADMIN_EMAIL,
    env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(",");

  const emails = splitEmailList(explicit)
    .map(normalizeAllowlistEmail)
    .filter(Boolean);

  if (emails.length === 0) emails.push(BOOTSTRAP_SUPER_ADMIN_EMAIL);
  return Array.from(new Set(emails));
}

export function isClerkSuperAdminEmailAllowed(email: string, env: NodeJS.ProcessEnv = process.env) {
  const normalized = normalizeAllowlistEmail(email);
  if (!normalized) return false;
  return getClerkSuperAdminEmailAllowlist(env).includes(normalized);
}

export function redactAllowlistForLogs(env: NodeJS.ProcessEnv = process.env) {
  return getClerkSuperAdminEmailAllowlist(env).map((email) => {
    const [local, domain] = email.split("@");
    const prefix = local.length <= 3 ? local : `${local.slice(0, 3)}...`;
    return `${prefix}@${domain}`;
  });
}
