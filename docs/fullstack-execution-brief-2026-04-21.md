# Fullstack execution brief · Enterprise SaaS hardening (2026-04-21)

## Scope cerrado para el siguiente release

1. **Realtime sin polling como camino principal**
   - Canal distribuido con `Postgres LISTEN/NOTIFY` (`REALTIME_MODE=postgres`) para propagar eventos SUN/admin entre instancias.
   - SSE sigue siendo transporte cliente, pero ahora consume eventos push y no bucles de polling.

2. **Tenant real demo y batch canónico**
   - Tenant único: `demobodega`.
   - Batch canónico: `DEMO-2026-02`.
   - Manifiesto canónico: 10 UIDs físicos (`apps/api/prisma/demo/demobodega_manifest.csv`).

3. **Bootstrap automatizado para operación comercial**
   - Script `bootstrap:tenant` para crear/actualizar tenant + admin tenant + super admin + batch + tags activos desde manifest `.csv` o `.txt`.
   - Listo para preparar corridas masivas (ej: siguientes lotes de 50k tags) sin pasos manuales repetitivos.

4. **Credenciales de acceso y seguridad básica**
   - Presets de auth priorizan variables server-side (`SUPER_ADMIN_*`, `TENANT_ADMIN_*`) para evitar fuga por `NEXT_PUBLIC_*`.
   - Passwords almacenadas con hash `scrypt` en `password_credentials`.

## Operación recomendada

```bash
# Seed/actualización enterprise mínima
npm run --workspace=api bootstrap:tenant -- \
  --tenant=demobodega \
  --tenant-name="Demo Bodega" \
  --tenant-admin-email=demobodega@nexid.lat \
  --tenant-admin-password='DemoBodega2026' \
  --super-admin-email=inguillen@nexid.lat \
  --super-admin-password='Marcelog2026' \
  --batch-bid=DEMO-2026-02 \
  --manifest=apps/api/prisma/demo/demobodega_manifest.csv
```

## No-regresiones explícitas

- No crear nuevos demos tipo `wine-2026` o variantes que fragmenten narrativa.
- Mantener un único corpus demo canónico y reutilizarlo en login, seed, SUN y panel.
- Evitar rutas/servicios con polling continuo para live operations.
