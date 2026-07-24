# Gates de staging enterprise

Este checklist convierte el sprint en evidencia operativa, no en una afirmación comercial.

## PostgreSQL

1. Levantar una base efímera PostgreSQL 15+ con `DATABASE_URL` aislada.
2. Aplicar migraciones `0051`–`0054` en orden y ejecutar `npm run test:proof --workspace=api`.
3. Ejecutar dos instancias del executor con el mismo `DATABASE_URL`; enviar el mismo `proof_id` simultáneamente. Una debe publicar y la otra responder `iota_publish_in_progress`; un reintento posterior debe devolver la respuesta persistida.
4. Interrumpir el executor entre reserva y broadcast, esperar cinco minutos o simular la antigüedad, y verificar recuperación/reconciliación.

## KMS/HSM

El executor acepta `IOTA_EXECUTOR_SIGNER_MODE=kms` únicamente con `IOTA_KMS_SIGNER_URL`, `IOTA_KMS_KEY_ID` e `IOTA_KMS_PUBLISHER_ADDRESS`. El endpoint remoto debe devolver `signed_transaction` y `signer_address`; se valida HTTPS, timeout, dirección recuperada y coincidencia con el publisher autorizado. En producción, ausencia de configuración o mismatch bloquea la publicación.

## WAF y rate limits fleet-wide

- Aplicar límites por IP, tenant, identidad y endpoint en el gateway/WAF; no depender de memoria de una instancia.
- Permitir sólo `POST /anchor-evidence` desde la red del API, con body máximo 128 KiB, timeout y cuota por tenant.
- Propagar `request_id`, `Retry-After` y métricas de 401/409/429/5xx.
- Verificar que el rate limit de login y el outbox de webhooks siguen siendo PostgreSQL-backed bajo dos instancias.

## RPC IOTA live

Con credenciales de staging, ejecutar el smoke test contra RPC IOTA testnet: chain id esperado, bytecode V2, `SCHEMA_VERSION=2`, publisher autorizado, `anchorEvidence`, receipt, evento `EvidenceAnchored`, `evidenceRecord`, confirmaciones y reconciliación. Nunca usar una respuesta RPC no verificada como evidencia confirmada.

Estos gates requieren secretos, una base y un RPC reales; no se simulan en CI local ni se ejecutan contra producción desde este worktree.

El executor expone `GET /ready`, que devuelve `503` si falta RPC, contrato V2, store durable o signer configurado. Usar `/ready` como readiness probe; `/health` es sólo diagnóstico y no debe habilitar tráfico por sí solo.

El manifiesto Kubernetes añade PDB y NetworkPolicy. El egress RPC público requiere además una allowlist FQDN en el CNI/cloud firewall; una NetworkPolicy estándar no debe pretender resolver FQDN de forma segura.

Si PostgreSQL es gestionado fuera del cluster (como Neon en el staging actual), el overlay debe reemplazar el selector de namespace por los CIDR/identidad de egress del proveedor. No desplegar este manifiesto base sin ese overlay y nunca sustituirlo por `0.0.0.0/0`.

Comandos reproducibles:

```bash
npm run gate:postgres:staging
npm run gate:migrations:preflight
npm run gate:iota:readonly
npm run gate:enterprise
```

Los comandos devuelven JSON y código de salida no-cero si falta configuración, la base no contiene las tablas V2 o el RPC/contrato no cumple chain, bytecode y `SCHEMA_VERSION=2`.
