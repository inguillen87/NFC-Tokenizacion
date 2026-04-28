# nexID Demo Flagship (deterministic corpus)

Este runbook define el corpus **canónico** para demostrar fin-a-fin nexID sin mezclar datos productivos.

## Canonical demo scope

- Tenant slug: `demobodega`
- Tenant display name: `Demo Bodega`
- Batch: `DEMO-2026-02`
- Tags: 10 tags determinísticos (manifest canónico)
- Geos demo: Mendoza, Buenos Aires, São Paulo, New York, Madrid
- Casos de riesgo: `valid`, `replay_suspect`, `tampered`, `revoked`, `invalid`

## Precondiciones (seguridad)

Para evitar contaminación accidental de producción, los scripts demo **no corren** salvo que:

- `DEMO_MODE=true`
- y en `NODE_ENV=production`, además: `DEMO_ALLOW_PROD_DATA_WRITE=true`

> Nunca usar credenciales reales ni secretos reales para demo.

## Scripts requeridos

Desde la raíz del monorepo:

```bash
npm run demo:reset
npm run demo:seed
npm run demo:emit-taps -- --count=10
```

O desde `apps/api`:

```bash
npm run demo:reset
npm run demo:seed
npm run demo:emit-taps -- --count=10
```

## Smoke path (under 20 minutes)

1. API health
   - `GET /health` debe devolver OK.
2. Contrato SUN JSON
   - `GET /sun?...&view=json` debe responder contrato estable (sin 5xx).
3. Passport HTML
   - `GET /sun?...&view=html` debe incluir estado de confianza/autenticación.
4. Emitir taps demo
   - `npm run demo:emit-taps -- --count=10`.
5. Realtime admin stream
   - `GET /admin/events/stream` y confirmar evento luego de `demo:emit-taps`.
6. Consumer ownership (si Tasks 09-10 están habilitadas)
   - claim válido crea ownership.
7. Consumer portal
   - `/me` muestra producto reclamado.
8. Marketplace contextual
   - `/me/marketplace?tenant=demobodega` abre contexto demobodega.

Para una corrida rápida automática:

```bash
npm run demo:smoke
```

Opcional: para checks autenticados de consumidor en `demo:smoke`, exportar `DEMO_CONSUMER_COOKIE`.

## Demo login rules

Las cuentas de demo son determinísticas y rotuladas como demo (dominio `.local`).

- `superadmin+demo@nexid.local`
- `admin+demobodega@nexid.local`
- `reseller+demo@nexid.local`
- `viewer+demo@nexid.local`

Los scripts imprimen passwords demo solamente fuera de producción.

## Demo vs production data

- Todo dato demo debe viajar con metadata identificable (`source='demo'` o metadata demo).
- No mezclar marcas reales ni credenciales reales.
- Demo fallback debe estar explícitamente habilitado por env y visible en UI.
