# nexID Demo Flagship (demobodega)

Este documento define el corpus demo canónico y el flujo rápido de validación comercial para nexID.

## Corpus canónico

- Tenant: `demobodega`
- Batch: `DEMO-2026-02`
- Tags: 10 UIDs (manifest canónico)
- Geos demo: Mendoza, Buenos Aires, São Paulo, New York, Madrid

## Scripts disponibles

Desde la raíz del monorepo:

```bash
npm run demo:seed
npm run demo:emit-taps -- --count=10
npm run demo:reset
```

También podés correrlos en `apps/api`:

```bash
npm run demo:seed
npm run demo:emit-taps -- --count=10
npm run demo:reset
```

## Recorrido smoke (menos de 20 minutos)

1. Verificar health:
   - `GET /health` → `ok: true`
2. Sembrar demo:
   - `npm run demo:seed`
3. Emitir taps demo:
   - `npm run demo:emit-taps -- --count=10`
4. Validar contrato SUN:
   - `GET /sun?...&view=json`
5. Validar HTML passport:
   - `GET /sun?...&view=html`
6. Verificar stream admin:
   - `GET /admin/events/stream` y confirmar llegada de eventos tras `demo:emit-taps`
7. Verificar portal consumidor:
   - `/me` y `/me/marketplace` con contexto de tenant del producto

## Demo vs producción

- El fallback demo debe estar explícitamente habilitado por variables de entorno.
- Toda respuesta simulada debe estar rotulada con header `x-nexid-demo-data: DEMO DATA`.
- No usar credenciales reales ni secretos en scripts, docs o seeds.

## Nota operativa

Si querés reiniciar por completo el corpus canónico:

1. `npm run demo:reset`
2. `npm run demo:seed`
3. `npm run demo:emit-taps -- --count=10`
