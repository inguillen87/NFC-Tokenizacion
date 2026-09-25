# NexID — candidato integrado y disponibilidad comercial

Fecha local: 2026-09-24. No publicado en producción.
API: `codex/nexid-integrated-services-api-20260924`, desde `1204ac5a` (aceptación del upgrade 0117–0121).
Panel: `codex/nexid-integrated-services-ui-20260924`, unión de `c9d0b132` (circuito avanzado) y `62eaad94` (consola operativa publicada).

## Qué se integra

La candidata de panel conserva cancelación, cotización/aceptación, asignación de técnicos, proveedor/especificación, recepción, acuse documental y la consola operativa. No se sustituye una rama avanzada por la copia antigua que contiene la publicación .41. El merge conserva ambas ascendencias y todas las suites de navegador de las dos ramas; el único conflicto fue la lista de ramas del workflow.

La nueva sección Disponibilidad del circuito se consulta explícitamente dentro del expediente. Separa preparación pendiente, desactivado, consulta sin nuevas escrituras y flujo técnicamente habilitado con acceso por confirmar. Una consulta exitosa oculta los módulos cuya consulta se confirmó no disponible, conserva los historiales consultables y permite volver a comprobar la disponibilidad.

Sin una observación válida, se informa que la disponibilidad es desconocida; los controles existentes siguen siendo consultas que verifican su propio contrato y acceso. Un 404 de una API antigua no se interpreta como una empresa vacía o como todos los módulos activos. No se ejecutan nuevas funciones por consultar disponibilidad.

## Fronteras de autorización

`GET /admin/supplier-requests/service-status?tenant={slug}` usa la autorización existente `supplier_order.create` y el contexto de una empresa. No admite selectores de SQL, URL, rol ni métodos de escritura. Empresas autorizadas y superadministradores pueden consultar; operadores limitados, sesiones sin permiso y denegaciones explícitas no acceden. Una sesión global debe seleccionar una empresa.

Después de resolver ese alcance, una consulta SQL comprueba únicamente IDs de migraciones y presencia/EXECUTE de las funciones de entrada nombradas. Devuelve cuatro estados reducidos y los flags observados, sin nombres de base, roles SQL, firmas, secretos ni registros de pedidos o clientes. No ejecuta funciones de negocio ni concede permisos.

La observación es sobre la disponibilidad técnica de esa API, NO la autorización de una acción o el acceso a un expediente. `metadataOnly=true`, `recordAccessVerified=false` y `operationAuthorized=false` son obligatorios. No verifica todo el esquema, el contenido de cada función ni permisos internos de todas las tablas; cada operación mantiene sus verificaciones reales.

La cancelación desactivada no habilita su consulta específica. Cotizaciones, proveedor y acuse conservan consulta de historial cuando sus escrituras están apagadas, siguiendo sus handlers actuales. Un flag ausente no equivale a habilitado. No se modifican variables de entorno.

## Ediciones, errores y recuperación

La consulta se impide mientras existe una edición bloqueante o una operación incierta. Mientras se consulta, se suspenden los flujos hermanos. Se probaron clics forzados además de botones deshabilitados: no se descartó la revisión de un proveedor ni el recibo pendiente de una escritura ya persistida. El reintento de esa escritura conservó su identidad original.

Los errores 401/403 retiran el contexto anterior del expediente cuando la consulta se inició sin escrituras pendientes. Cancelación, cambio A→B→A y respuestas tardías invalidan la lectura anterior. Los demás errores no inventan estados vacíos ni habilitados. Cancelar devuelve el foco al botón de consulta.

La respuesta se valida con la misma política pura en API/panel; el cliente exige empresa exacta, JSON, procedencia y estados consistentes. Máximo 16 KiB, UTF-8 estricto, timeout real de 15 segundos y sin reintentos automáticos. Se rechazan observaciones viejas al recibirlas. Tras 60 segundos la observación visible se etiqueta como anterior, sin desmontar una operación en curso; no es un monitor continuo ni una autorización cacheada.

## Evidencia local al construir el candidato

- 35 pruebas nuevas API (incluida la política compartida), dentro de 603 regresiones focales aprobadas.
- 24 pruebas nuevas de panel/cliente/BFF (incluida esa misma política), dentro de 1.582 aprobadas, cero fallos y dos omisiones existentes.
- TypeScript y compilaciones completas de API y dashboard aprobados.
- Nuevo navegador integrado: 89 comprobaciones y 12 vistas; cubre permisos, módulos apagados, recuperación, ediciones y resultado incierto.
- Esquema real aislado: 132 migraciones, 69 comprobaciones del circuito con dueño y 70 con login restringido; 40 operaciones prohibidas rechazadas.
- La consulta de disponibilidad se ejercita en ese circuito real con sesiones autenticadas, flags de prueba y PostgreSQL; no sólo mediante un transporte simulado.

Las pruebas locales no usaron la base productiva. El proveedor y la recepción siguen siendo declaraciones de prueba: no hubo envío externo ni lectura física nueva. El login restringido temporal fue eliminado y el cluster local se detuvo. Las nuevas pruebas compartidas no se deben sumar dos veces como escenarios únicos.

El test de preservación se recalculó deliberadamente contra la rama avanzada: fija 471 archivos fuente preexistentes, excluyendo sólo Configuración, el workspace y su BFF, que se revisan por sus cambios concretos. No se eliminó el control para forzar un merge. El primer test nuevo de HEAD falló por construir un Request con cuerpo en el fixture; se corrigió el fixture sin relajar el rechazo HTTP.

## Despliegue

Esto es una pareja de candidatas, no una publicación productiva. La consola ya publicada y los protocolos actuales permanecen sin cambios en el dominio real. No se aplicó 0117–0121 en Neon ni se habilitaron flags. La API avanzada todavía requiere conciliar y aplicar el delta autorizado; que compile no demuestra que el esquema vivo sea compatible.

Orden pendiente: confirmar conexión API→endpoint con sesión real; aceptar el delta sobre ese baseline; publicar API y panel compatibles con escrituras desactivadas; validar cada flujo y habilitarlo de forma explícita. No ejecutar las 48 diferencias históricas ni tratar disponibilidad técnica como permiso. CI se debe comprobar por SHA antes de certificar las candidatas.
