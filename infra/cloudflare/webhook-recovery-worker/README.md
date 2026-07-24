# Nexid webhook recovery scheduler

This Worker invokes the API's private webhook outbox endpoint once per minute.
It is designed for the Cloudflare Free plan (Cron Trigger) and keeps the
worker secret at Cloudflare, outside the browser and repository.

## Provisioning (operator action)

```powershell
npx wrangler login
npx wrangler secret put INTERNAL_WEBHOOK_WORKER_KEY --config wrangler.jsonc
npx wrangler deploy --config wrangler.jsonc
```

The secret must exactly match the API's `INTERNAL_WEBHOOK_WORKER_KEY`. Do not
put it in `wrangler.jsonc`, source control, Vercel client variables, or logs.
Before deployment, verify the API origin is the intended production hostname
and that the endpoint returns `401` when the secret is absent.

The repository does not deploy this worker automatically: deployment requires
an explicit Cloudflare account action and secret provisioning.
