/** A catalog reset may run only in an explicitly opted-in local fixture. */
export function allowRuntimeDemoSeed(env: NodeJS.ProcessEnv = process.env) {
  if (env.NEXID_RUNTIME_DEMO_SEED !== "true") return false;
  if (env.VERCEL === "1") return false;
  const nodeEnvironment = String(env.NODE_ENV || "").trim().toLowerCase();
  const vercelEnvironment = String(env.VERCEL_ENV || "").trim().toLowerCase();
  return (nodeEnvironment === "development" || nodeEnvironment === "test")
    && (vercelEnvironment === "" || vercelEnvironment === "test");
}
