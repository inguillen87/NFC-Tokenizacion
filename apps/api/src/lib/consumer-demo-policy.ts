export type ConsumerDemoRequest = {
  demoConsumer?: unknown;
  consumerMode?: unknown;
};

export type ConsumerDemoEnvironment = {
  DEMO_MODE?: string;
  CONSUMER_AUTH_MODE?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
};

const DEMO_FLAGS = new Set(["1", "true", "yes", "demo"]);

export function canUseConsumerDemoBypass(
  payload?: ConsumerDemoRequest | null,
  environment: ConsumerDemoEnvironment = process.env,
) {
  const explicitRequest = payload?.demoConsumer === true
    || String(payload?.consumerMode || "").toLowerCase() === "demo";
  if (!explicitRequest) return false;

  // Keep demo behavior explicit and fail closed in every production runtime.
  const flag = String(environment.DEMO_MODE || environment.CONSUMER_AUTH_MODE || "").toLowerCase();
  const nodeEnvironment = String(environment.NODE_ENV || "").toLowerCase();
  const vercelEnvironment = String(environment.VERCEL_ENV || "").toLowerCase();
  return DEMO_FLAGS.has(flag)
    && nodeEnvironment !== "production"
    && vercelEnvironment !== "production";
}
