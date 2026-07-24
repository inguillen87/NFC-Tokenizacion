# Idempotencia durable del executor IOTA

El endpoint `/anchor-evidence` persiste la reserva por `proof_id` en `iota_executor_publications` antes de emitir RPC. Los reintentos de una publicación ya enviada devuelven exactamente la respuesta persistida; una segunda instancia concurrente recibe `iota_publish_in_progress`. Una reserva `processing` abandonada puede recuperarse después de cinco minutos. El contrato V2 sigue siendo la autoridad final y rechaza duplicados por `proofId`.

Requisitos de producción:

- Aplicar `20260723213000_0054_iota_executor_publications.sql` antes de activar el endpoint.
- Configurar `DATABASE_URL` o `POSTGRES_URL`; en `NODE_ENV=production` la ausencia de conexión bloquea el executor.
- Mantener `request_id` como correlación solamente: no forma parte del `proofId` ni del payload semántico.
- Monitorizar filas `processing` con más de cinco minutos y reconciliar sus hashes de transacción.

Esto elimina la dependencia exclusiva de la cola en memoria para reinicios y despliegues multi-instancia. La ventana entre broadcast y persistencia posterior sigue requiriendo reconciliación contra el contrato, por lo que no se afirma exactamente-una-vez a nivel de red.
