# NexID — corte del plan y recepción guiada de manifiestos

Fecha: 2026-09-23. Base de continuidad: `a461a6d0b0b2b751ddbd96ac37b8be775c23c088` (PR #375 integrada).
Rama del incremento: `codex/nexid-roll-intake-20260923`.

## Estado real del plan

Los planes de septiembre usan numeraciones distintas. Esta matriz se organiza por resultados, sin sumar pantallas o pruebas para inventar un porcentaje de avance.
«Implementado» describe el código y la evidencia documental revisada; no equivale a una nueva aceptación productiva de todos los módulos en esta sesión.

| Bloque | Hasta dónde está implementado | Cierre que todavía falta |
| --- | --- | --- |
| Release, controles y permisos | PR #375 integrada; CI completo, E2E aislado y preview .42 comprobados. Roles, permisos limitados y retiro seguro de acceso. | Publicar conjuntamente API .3 y dashboard con las migraciones 0115/0116 verificadas/autorizadas. No desplegar copias antiguas de API/web incluidas en ramas del dashboard. |
| TAP → empresa → producto → DPP → evento | .29/.30 unificaron procedencia; lecturas 713/714 abiertas y lectura 715 con ubicación consentida de precisión declarada 150 m documentadas. | Matriz física completa y recorrido privado con usuario real sobre la combinación final de versiones. Esas tres lecturas no certifican toda la flota ni autenticidad del contenido. |
| Uso y disponibilidad | Centro /service-levels con fuentes, métricas observadas y consumo SDK bajo demanda. | Facturas, costo monetario por empresa, almacenamiento/CU y cuotas duras. S1 no está completo. |
| Logística y expediente | Operaciones con confirmación, comprobantes, idempotencia y concurrencia; expediente del lote y navegación por tareas. | Aceptación completa con la cadena logística y actores reales del cliente. |
| Passport Studio | Edición, revisión independiente, publicación, comparación e historial; separación entre contenido comercial y prueba del chip. | Ceremonia editorial con empresa real y aceptación integral entre superficies, no sólo componentes y PostgreSQL de prueba. |
| SDK e integración | Kit instalable fuera del monorepo, receptor firmado y adaptador CSV. | Elegir e integrar el primer ERP/WMS/POS de cliente. Un ejemplo ejecutable no equivale a ese conector aceptado. |
| Retiro de lotes y piloto | Flujo de retiros, tareas y conciliación; publicación .28 documentada. | Recorrido autenticado completo y evidencia operacional del piloto; no se dan por resueltos todos los casos externos por aprobar CI. |
| Campañas | Revisión, presupuesto de referencia, consentimiento y simulación. | Despacho real, opt-out, límites efectivos del gasto, recibos del proveedor y reconciliación. No hay autorización de envíos por esta matriz. |
| CRM y soporte | Reporte desde DPP, referencia recuperable, estados con motivo/historial, vistas por fuente e historial del miembro. Publicación de soporte y migración 0112 documentadas. | Validar operaciones con casos reales, no sólo bandejas vacías o registros sintéticos. No inferir ventas o personas a partir de TAPs. |
| Solicitud de etiquetas y equipo | Borradores .40 y aclaraciones .41 publicados; asignaciones y bandeja del operador .42 integradas y validadas en preview. | Publicación .42; luego cotización/cancelación, proveedor/especificación, comprobante manual y entrega cifrada controlada. |
| Recepción del manifiesto | Este incremento cierra selección, revisión, validación y confirmación segura sobre el importador existente. | Importación y QA con un manifiesto real del proveedor en un entorno autorizado. No se importan unidades productivas para probar la interfaz. |

## Comprobación canónica de esta sesión

`app.nexid.lat/release.json`: `2026.09.23-dashboard.41`.
`api.nexid.lat/release.json`: `2026.09.23-api-supplier-requests.2`.
`nexid.lat/release.json`: `2026.09.21-web-support.1`.
Son lecturas de versión, no una revisión completa de la base de datos. No se aplicaron migraciones ni se promovió producción en este incremento.

## Incremento ejecutado: recepción del archivo del proveedor

Se amplía `RollManifestIntake` en el expediente existente del lote, sección Unidades. No se crea otro importador ni se cambia el contrato de la API.

- Recorrido visible: seleccionar → validar en NexID → revisar/confirmar → continuar con calidad.
- Selector de archivo en español, resumen de nombre/tamaño/BID y huella SHA-256 del texto enviado. La huella no se presenta como firma del proveedor.
- Filas y unidades nuevas previstas proceden del resultado del servidor; no se calculan dividiendo el archivo por saltos de línea.
- Confirmación explícita y nueva validación al cambiar archivo o vencer los cinco minutos. Ninguna petición activa etiquetas ni autoriza excepciones de cantidad.
- La selección y el hash son locales; sólo la acción de validar transmite el manifiesto a NexID. No hay almacenamiento persistente en el navegador ni llamadas a terceros.
- Respuestas limitadas a 256 KiB, cancelación a 45 segundos, sin reintento automático. Un resultado incierto de importación bloquea otra escritura hasta consultar el estado por el circuito existente.
- Se rechazan comprobantes de otro BID, modo demo, reactivaciones, filas ignoradas, cantidades incoherentes o excepciones. El formato legado sin `supplier_gate` sigue siendo compatible y no se convierte en certificación industrial.
- Un hash no reversible de identidad/sesión, permisos y empresa reinicia el asistente ante cambios de alcance. No se transmite el identificador de sesión en claro como propiedad del importador.
- Respuestas antiguas, selecciones lentas y el retorno A→B→A no restauran archivos ni validaciones de otro contexto.

La prueba de navegador reprodujo un fallo del componente previo: seleccionar A lentamente, seleccionar B y finalizar A reemplazaba el archivo nuevo por el viejo. La regresión pasó después de introducir identidad de selección y descarte de resultados tardíos.

## Validación local

Dashboard completo: **1.340 pruebas aprobadas**, cero fallos y dos omisiones opcionales existentes. Incluye **54 nuevas pruebas** de recibos, transporte, límites y codificación. Typecheck y build de dashboard aprobados; auditoría de dependencias, control de secretos y diff de whitespace aprobados.

Navegador: **108 comprobaciones en ocho vistas** (320/390/768/1440 px, claro/oscuro). Cero infracciones de axe en la superficie evaluada, cero errores de cliente, cero peticiones inesperadas y sin desbordamiento horizontal. Componentes y contratos reales con transporte/sesión sintéticos; no es una importación contra la base real ni una certificación WCAG.

El workflow de aceptación existente incluye ahora esta suite y la rama del incremento. Sus resultados deben leerse para el commit exacto; esta configuración no declara el CI aprobado por sí sola. La PR conserva la evidencia posterior de CI, preview e integración sin reescribir evidencias históricas.

## Próximos cierres, en orden

1. Publicación coordinada pendiente de .42/API .3: verificar y autorizar las migraciones 0115/0116; no confundir el merge con activación productiva.
2. Completar cotización y cancelación con revisiones, motivo e historial. No registrar una compra ni comprometer dinero por cambiar un estado visual.
3. Vincular proveedor y versión de especificación; registrar comprobante explícito de envío manual. No afirmar recepción de fábrica sin acuse.
4. Entrega cifrada controlada y confirmación del proveedor; separar claves del aviso y evitar exposición de secretos en navegador/logs.
5. Aceptar un manifiesto real, QA física y primer conector ERP/WMS con la empresa elegida.
6. Cerrar medición de costo por empresa y ceremonia integral: publicación de DPP, TAP físico, CRM/caso, retiro o excepción, reporte y consumo.

Este incremento no modifica SUN, TTStatus, claves, cantidades productivas, roles de usuarios reales, facturación, planes de proveedores, API o web. Las migraciones productivas siguen pendientes de autorización específica. No se envían correos ni mensajes WhatsApp.

## Evidencia consultada para la matriz

- Plan de auditoría de producto del 17/09 y `NEXID_CODEX_DPP_ENTERPRISE_GOAL.md` proporcionados en Library: objetivos y criterios, no autorización productiva.
- `2026-09-18-usage-health-center.md`; `2026-09-18-logistics-operations.md`; `2026-09-18-passport-studio-dashboard.md`.
- `2026-09-18-s5-integration-kit.md`; `2026-09-18-s7-campaign-review.md`.
- `2026-09-21-s6-production-and-s7-continuity.md`; `2026-09-21-s7-live-provenance.md`.
- `2026-09-22-crm-activity-plan-continuity.md`; `2026-09-22-crm-inbox-assistant-continuity.md`; `releases/2026-09-23-support-production.json`.
- `2026-09-23-guided-supplier-orders.md`; `2026-09-23-supplier-requests.md`; `2026-09-23-supplier-request-assignments.md`; PR #375.

Las referencias anteriores son relativas a `docs/`. Los nombres históricos de los documentos no certifican su estado actual por sí solos; se distinguen expresamente de las lecturas de versión y de los ensayos de este incremento.
