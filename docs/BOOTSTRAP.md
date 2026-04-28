# SaaS Bootstrap (nexID)

## Objetivo
Inicializar de forma determinística el primer `super_admin` y, opcionalmente, tenant demo.

## Comando
```bash
npm run bootstrap:saas --workspace=api
```

Opcional:
- `--with-demo`: crea/valida tenant demo aunque `DEMO_MODE` no esté en `true`.
- `--dry-run`: valida configuración sin escribir datos.

## Variables requeridas
- `DATABASE_URL`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

## Tenant demo (opcional)
Se crea únicamente cuando:
- `DEMO_MODE=true`, o
- se usa `--with-demo`.

Variables opcionales:
- `DEMO_TENANT_SLUG` (default `demobodega`)
- `DEMO_TENANT_NAME` (default `Demo Bodega`)

## Seguridad operativa
- El bootstrap es idempotente (upsert de usuario/membresías/permisos).
- No imprime valores secretos.
- El login normal no debe usarse como bootstrap implícito en producción.
