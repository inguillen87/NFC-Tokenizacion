const REQUIRED_ENV_VARS = ["NEXT_PUBLIC_API_BASE_URL", "ADMIN_API_KEY"] as const;

function missingVars() {
  return REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
}

export function MisconfigurationBanner() {
  if (process.env.VERCEL_ENV !== "production") return null;
  const missing = missingVars();
  if (!missing.length) return null;

  return (
    <div className="border-b border-rose-400/40 bg-rose-950/80 px-4 py-3 text-xs text-rose-100">
      <p className="font-semibold">Production misconfiguration detected.</p>
      <p>
        Missing env vars: <span className="font-mono">{missing.join(", ")}</span>. Set them in Vercel → Project Settings →
        Environment Variables and redeploy.
      </p>
    </div>
  );
}
