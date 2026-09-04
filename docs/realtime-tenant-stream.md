# Stream realtime multi-tenant

## Estado y límite actual

La ruta `GET /admin/events/stream` implementa entrega **event-driven por SSE**: realiza un snapshot durable al abrir o reconstruir la conexión y después recibe publicaciones del transporte. No consulta la base periódicamente para buscar taps.

El transporte objetivo para Producción horizontal es `REALTIME_MODE=upstash`. En Producción la variable es obligatoria: `memory` falla cerrado y `postgres` sólo se acepta con la habilitación deliberada `REALTIME_POSTGRES_PILOT_ENABLED=true`. El código y las variables existen, pero al 2026-09-04 el recurso y las credenciales Upstash **no están configurados en Producción**. Hasta completar ese gate externo no se debe afirmar que el stream está habilitado ni probado para miles de empresas. PostgreSQL `LISTEN/NOTIFY` queda limitado a piloto; `memory` queda limitado a desarrollo y tests.

## Flujo implementado

1. La mutación persiste el evento y sus relaciones en PostgreSQL.
2. Después del commit, la API construye una proyección tenant-scoped del tap y publica el evento. El broker no reemplaza a la base: PostgreSQL sigue siendo la fuente durable.
3. La ruta SSE autentica y autoriza la solicitud, resuelve el tenant efectivo y se suscribe al canal **antes** de consultar el snapshot.
4. Mientras se obtiene el snapshot, los eventos entrantes se almacenan en un buffer acotado. El snapshot se recuerda primero y después se vacía el buffer.
5. El deduplicador usa el ID durable más una huella de la proyección. Suprime duplicados exactos, pero permite volver a emitir el mismo ID cuando cambian actor, consentimiento u otra parte de su proyección.
6. El navegador recibe `connected`, un único `snapshot` y luego `event`; `warning` señala degradación y `heartbeat` sólo demuestra vida del transporte.

Límites actuales del ciclo SSE:

- snapshot: máximo 200 filas según tenant, ventana, origen, veredicto y riesgo;
- buffer de arranque: 500 eventos; si desborda, el stream avisa y cierra;
- cola de salida post-arranque: máximo 256 frames o 1 MiB, además de un `highWaterMark` de 64 KiB; si el consumidor no drena y desborda, se descartan los deltas pendientes, se limpia `Last-Event-ID`, se envía `output_backpressure_overflow` con recuperación `snapshot_reset` y se cierra;
- deduplicación por conexión: hasta 10.000 IDs/proyecciones;
- heartbeat: 15 segundos;
- vida de cada conexión: alrededor de 4 minutos, con jitter simétrico de 10 % (216–264 s);
- sugerencia de reconexión SSE: alrededor de 3 segundos, con jitter simétrico de 15 % por conexión.

La reconexión nativa de `EventSource` reenvía `Last-Event-ID`. En Upstash ese ID es el cursor acotado del Redis Stream; si sigue dentro de la ventana disponible, el transporte reproduce el tramo pendiente y además obtiene un snapshot durable nuevo. Si el cursor expiró, la conexión falla cerrada y EventSource vuelve a intentar desde un snapshot; no inicia polling. Ese snapshot recupera taps persistidos. Las notificaciones no incluidas en ese snapshot —por ejemplo, algunos eventos operativos— deben recuperarse desde su endpoint durable específico; no se debe prometer replay completo de todos los dominios con el contrato actual.

## Canales y aislamiento

Con un prefijo obligatorio y aislado por entorno, por ejemplo `nexid:rt:v1:production`:

- tenant: `nexid:rt:v1:production:tenant:<tenant-slug-normalizado>`;
- agregado global: `nexid:rt:v1:production:global`.

Un evento con tenant se publica en su canal aislado y en el agregado global. Una publicación global sin tenant exige `{ global: true }`; la ausencia de tenant nunca eleva implícitamente un evento a global. Slugs inválidos, contradicciones entre scope y payload, o credenciales/configuración incompletas fallan cerrados.

El canal global es exclusivamente para una sesión autorizada sin tenant forzado —el caso de Super Admin—. Tenant Admin y reseller conservan el tenant impuesto por servidor aunque intenten enviar otro en la URL. El filtro de tenant vuelve a ejecutarse antes de emitir cada payload.

## Modos de transporte

| Modo | Uso permitido | Propagación | Límite operativo |
| --- | --- | --- | --- |
| `memory` | desarrollo y tests; prohibido en Producción | sólo el proceso actual | no cruza instancias ni sobrevive reinicios |
| `postgres` | piloto explícito; en Producción exige `REALTIME_POSTGRES_PILOT_ENABLED=true` | `pg_notify` + conexión session-affine `LISTEN` | canal compartido y una conexión larga por instancia; no es la arquitectura para 5.000 empresas |
| `upstash` | objetivo administrado para Producción | Redis Streams + Pub/Sub sobre HTTP/SSE, con canales tenant/global | requiere recurso, credenciales, prueba de carga y observabilidad activados |

En modo PostgreSQL, el listener requiere `DATABASE_URL_UNPOOLED` o `POSTGRES_URL_NON_POOLING`; el publisher puede usar `DATABASE_URL`. Un URL pooler no sirve para `LISTEN`. En modo Upstash, la historia y el replay del transporte están acotados por longitud, TTL, cantidad y ventana temporal; la base durable sigue siendo la autoridad.

## Variables server-only

Configurar únicamente en el proyecto de API; ninguna debe usar prefijo `NEXT_PUBLIC_` ni llegar al navegador:

```text
REALTIME_MODE=upstash
REALTIME_POSTGRES_PILOT_ENABLED=false
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
REALTIME_UPSTASH_ENVIRONMENT=production
REALTIME_UPSTASH_CHANNEL_PREFIX=nexid:rt:v1:production
REALTIME_UPSTASH_HISTORY_MAX_LENGTH=500
REALTIME_UPSTASH_HISTORY_TTL_SECONDS=900
REALTIME_UPSTASH_REPLAY_LIMIT=200
REALTIME_UPSTASH_REPLAY_WINDOW_SECONDS=300
REALTIME_UPSTASH_HISTORY_READ_TIMEOUT_MS=5000
```

El último segmento de `REALTIME_UPSTASH_CHANNEL_PREFIX` debe coincidir con el entorno efectivo. En Vercel se valida contra `VERCEL_ENV`; fuera de Vercel se usa `REALTIME_UPSTASH_ENVIRONMENT` y, como último fallback local, `NODE_ENV`. Esto evita que Preview y Producción compartan historial o Pub/Sub por accidente.

Para un rollback piloto PostgreSQL:

```text
REALTIME_MODE=postgres
REALTIME_POSTGRES_PILOT_ENABLED=true
REALTIME_PG_CHANNEL=nexid_events
DATABASE_URL_UNPOOLED=postgresql://...
```

Fuera de Producción el código conserva `postgres` como valor por defecto para compatibilidad local. En Producción, `REALTIME_MODE` ausente, inválido o igual a `memory` deja el transporte indisponible; `postgres` sin la bandera exacta también falla cerrado. Si `VERCEL_ENV` existe, es la autoridad para distinguir Producción de Preview; fuera de Vercel se usa `NODE_ENV`.

Los reintentos de publicación y la reconexión del listener PostgreSQL usan backoff/jitter simétrico acotado de 20 %. Esto reduce estampidas entre instancias; no cambia la cantidad máxima de tres intentos de publicación ni constituye garantía durable.

## Seguridad y RBAC

- La ruta SSE exige `events.read_sensitive`.
- Los eventos de incidentes exigen además `incidents:read`.
- `getAdminTenantScope` impone el tenant a Tenant Admin, Tenant Operator y reseller, y rechaza un tenant de URL diferente.
- El dashboard BFF resuelve de nuevo la sesión y el scope antes de reenviar la solicitud a la API.
- La API vuelve a validar tenant, source, ventana, riesgo y veredicto para snapshot y eventos.
- Sólo una proyección persistida completa (`tenantId`, `tenantSlug`, `batchId`) puede cruzar el stream de taps; una notificación incompleta no reemplaza la verdad durable.
- Antes de tocar cualquier transporte, una proyección cerrada elimina teléfonos, emails, contactos, UID crudo, títulos o texto libre de incidentes, metadata arbitraria, trace IDs y etiquetas de dispositivo. Conserva IDs operativos, estado, datos agregables, ubicación reportada necesaria para el mapa y la proyección de tap minimizada.
- Cada proyección segura recibe un `realtime_delivery_id` determinístico. Sirve para suprimir copias exactas dentro de una conexión; no incorpora contacto ni consumer ID, pero sigue siendo metadata operativa protegida y no convierte la entrega en exactly-once.
- Los secretos Upstash son server-only. No registrarlos, devolverlos, incorporarlos al bundle ni exponer nombres `NEXT_PUBLIC_*`.
- Aislamiento cross-tenant y acceso global indebido tienen tolerancia cero: cualquier caso es incidente P0 y bloquea promoción.

## Observabilidad y SLO propuestos

El código ya emite `stream_request_id`, transporte, warnings de snapshot/transporte y `stream_latency_ms` para taps. Centralizar esas señales sin UID, contacto, token ni payload sensible.

Instrumentar antes de declarar readiness global:

- intentos, conexiones `ready`, cierres y reconexiones por modo/tenant;
- éxito/fallo y latencia de publish por canal, sin registrar el token;
- tiempo hasta snapshot, tamaño de snapshot, buffer de arranque y profundidad/bytes de la cola de salida;
- p50/p95/p99 de `stream_latency_ms` para eventos persistidos;
- `realtime.transport_reset`, `snapshot_unavailable`, `startup_buffer_overflow` y `output_backpressure_overflow`;
- conexiones concurrentes, bytes y operaciones Upstash para capacidad/costo;
- prueba sintética por tenant y otra global con correlación por `realtime_delivery_id`, sin publicar el trace ID de la solicitud.

SLO candidatos —no vigentes hasta medirlos con carga representativa—:

- 99,9 % de aperturas autorizadas alcanzan snapshot `ready` en menos de 5 s por ventana móvil de 30 días;
- 99,95 % de proyecciones aceptadas se publican correctamente al broker;
- latencia persistencia-a-SSE p95 menor a 2 s y p99 menor a 5 s;
- cero eventos de otro tenant y cero accesos globales sin autorización;
- cero desbordes del buffer de arranque en operación normal.

Alertar inmediatamente por aislamiento/RBAC; alertar por error budget, publish failures sostenidos, tres resets consecutivos, p99 fuera de objetivo o cualquier overflow. Estos objetivos requieren una prueba de carga multi-tenant y no constituyen evidencia de capacidad por sí mismos.

## Activación de Upstash

1. Crear y aprobar el recurso Upstash para el entorno de Producción. Obtener el REST URL y token por el canal de secretos autorizado.
2. Cargar las variables server-only en el proyecto de API, fijar `REALTIME_MODE=upstash`, conservar `REALTIME_POSTGRES_PILOT_ENABLED=false` y usar un prefijo terminado en `:production` que coincida con `VERCEL_ENV`.
3. Ejecutar tests de transporte, ciclo SSE, scope tenant/global y proyecciones; luego typecheck y build del API. Con el recurso real aprobado, habilitar `REALTIME_UPSTASH_CANARY=1` sólo para ejecutar `npm run --workspace=api canary:realtime-upstash`; usa un prefijo efímero y limpia únicamente sus tres claves de prueba.
4. Desplegar un commit exacto del API. No mezclar el cambio de broker con una migración destructiva.
5. Abrir un stream como Tenant Admin de Bodega Balmec y otro tenant de prueba; confirmar que cada uno sólo recibe su canal.
6. Abrir el agregado global con una sesión Super Admin autorizada y confirmar que ve ambos tenants sin alterar el scope de sus sesiones.
7. Generar taps reales controlados: cada evento debe aparecer una vez, conservar su tenant/origen y sobrevivir una reconexión mediante el nuevo snapshot.
8. Cortar la conexión del broker y confirmar `warning`, cierre fail-closed, reconexión de `EventSource` y conservación del último snapshot confirmado, sin mostrar ceros inventados.
9. Ejecutar carga multi-tenant, registrar SLO/costo y recién entonces ampliar tráfico o comunicar capacidad global.

## Garantía de entrega y outbox

La fila persistida en PostgreSQL es la fuente durable. La publicación realtime ocurre **después del commit**, con reintentos acotados y resultado observable. Un retry HTTP que reutiliza la misma clave idempotente puede volver a proyectar el mismo evento durable; el `realtime_delivery_id` y el deduplicador de la conexión permiten descartar esa copia exacta.

Esto mejora la recuperación a nivel solicitud, pero no constituye un outbox realtime durable: si el proceso muere entre el commit y el publish, y el cliente nunca reintenta, hoy no existe un worker que encuentre automáticamente esa publicación pendiente. Además, el fanout tenant + global son dos escrituras no transaccionales; puede existir éxito parcial y el reintento puede repetir el canal que sí había aceptado el evento.

Para ofrecer **at-least-once durable** hace falta una migración nueva `realtime_outbox` escrita en la misma transacción que el evento, con identidad inmutable de entrega, destino/canal, estado, lease con expiración, cantidad y fecha del próximo intento, confirmación y dead letter. También hace falta un worker o scheduler externo idempotente, métricas de lag/fallos y un procedimiento de replay. Ese recurso operativo no existe en la implementación actual y es un gate separado; no corresponde reutilizar `webhook_deliveries`, porque ese outbox tiene destinos y semántica de webhooks de clientes, no del broker interno.

## Rollback

El broker no es la fuente de verdad: no borrar eventos ni alterar PostgreSQL durante el rollback.

1. Ante fuga cross-tenant, credenciales expuestas o payload no autorizado, revocar el token Upstash y retirar el stream afectado de inmediato.
2. Revertir al último despliegue API verificado o cambiar `REALTIME_MODE` y volver a desplegar. Un cambio de variable sin redeploy no prueba que todas las instancias hayan rotado.
3. `postgres` sólo puede usarse como continuidad de **piloto** con `REALTIME_POSTGRES_PILOT_ENABLED=true`, URL unpooled y capacidad aceptada; no presentarlo como rollback enterprise. `memory` nunca es rollback de Producción.
4. Verificar que el dashboard muestre degradación/último snapshot y que una reconexión recupere los taps durables.
5. Reparar el transporte, rotar credenciales si corresponde, repetir aislamiento y carga, y documentar la ventana sin push. Los eventos operativos no cubiertos por el snapshot deben reconciliarse desde sus fuentes durables.

## Gate de Producción pendiente

No activar ni anunciar el modo administrado hasta tener evidencia conjunta de: recurso Upstash contratado/conectado, variables presentes en Producción, despliegue exacto, prueba tenant/global, desconexión/reconexión, carga multi-tenant, métricas y alertas. Hoy ese gate externo sigue abierto porque faltan el recurso y las credenciales Upstash de Producción.
