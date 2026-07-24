# Cloudflare production evidence — 2026-07-24

Zone: `nexid.lat`  
Plan: Free  
Registrar: Namecheap  
Authoritative nameservers: `byron.ns.cloudflare.com`, `gemma.ns.cloudflare.com`

## Enforced controls

- DNSSEC active. Registrar DS: key tag `2371`, algorithm `13` (ECDSA/SHA-256), digest type `2` (SHA-256).
- SSL/TLS mode: Full (strict).
- Always Use HTTPS: enabled.
- Minimum visitor TLS: 1.2.
- TLS 1.3: enabled.
- Universal and backup certificates: active.
- Custom rule `Nexid - block secret and SCM probes`: active, block action.
- Rate rule `Nexid - auth abuse guard`: active, 10 requests per 10 seconds per source IP, block for 10 seconds.
- Bot Fight Mode remains disabled because the Free-plan control cannot be skipped for SDK, API, or webhook machine clients.

## Live verification

```text
403 https://nexid.lat/.env
403 https://app.nexid.lat/.git/config
403 https://api.nexid.lat/server-status

POST /auth/login burst:
400,400,400,400,400,400,400,400,400,400,429,429
```

The login smoke used an empty JSON object, which the application rejects before credential lookup or login-attempt persistence. The 11th and 12th responses demonstrate Cloudflare edge enforcement.

## Explicit non-claims

- Cloudflare Secrets Store is secret storage, not a KMS/HSM or blockchain signer.
- The Free-plan rate rule is a coarse IP control; Neon-backed tenant/subject rate limits remain authoritative.
- This evidence does not yet prove origin authentication for the direct Vercel origin.
- HSTS is currently emitted by the application (`max-age=63072000`); Cloudflare HSTS preload and `includeSubDomains` were not enabled without a complete subdomain inventory.
