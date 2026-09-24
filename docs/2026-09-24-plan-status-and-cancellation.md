# NexID — corte del plan y cancelación comercial

Fecha de revisión: 2026-09-24. Este documento distingue producción, integración y candidato. Una cantidad de tests o el número de una release no son un porcentaje de producto terminado.

## Punto de partida contrastado

- Dashboard: PR #375 integrada en `a461a6d0`, seguida de PR #376 integrada en `b628cb3c`, rama `codex/nexid-s9-ticket-deadline-20260922`.
- La PR #376 contiene recepción guiada de manifiestos, validación de archivo, confirmación explícita e identidad de importación. No se volvió a implementar ese trabajo.
- API de continuidad: `f9512224`, rama `codex/nexid-s9-ticket-workflow-api-20260922`. API y dashboard continúan en líneas separadas; el código API contenido en la rama del panel no se toma como el backend vigente.
- Nuevos candidatos: `codex/nexid-request-cancellation-api-20260924` y `codex/nexid-request-cancellation-ui-20260924`, en worktrees independientes. Sin cambios en los worktrees anteriores ni en main.

## Producción comprobada, no inferida del código

Consulta de release.json sin escrituras de negocio:

| Superficie | Release canónica | Verificación UTC |
| --- | --- | --- |
| https://app.nexid.lat | 2026.09.23-dashboard.41 | 2026-09-24T03:56:32.615Z |
| https://api.nexid.lat | 2026.09.23-api-supplier-requests.2 | 2026-09-24T03:56:33.467Z |
| https://nexid.lat | 2026.09.21-web-support.1 | 2026-09-24T03:56:34.293Z |

La API de asignaciones .3 y el panel .42 siguen siendo un cierre de publicación pendiente. Las migraciones 0115/0116 fueron documentadas como probadas fuera de producción; este trabajo no las aplicó. La nueva 0117 tampoco se aplicó en Neon.

## Hasta dónde está hecho el plan

El corte anterior detallado está en `docs/2026-09-23-plan-status-and-roll-intake.md`. Los dos documentos originales usan numeraciones de sprint diferentes; se conserva la separación por resultado verificable.

| Bloque | Ya implementado o documentado como validado | Cierre que sigue pendiente |
| --- | --- | --- |
| TAP real, procedencia y ubicación | Lecturas reales y ubicación consentida documentadas en .29/.30; separación de eventos importados/sintéticos | Matriz física completa y recorrido de piloto real; firma de un tag no certifica por sí sola el contenido del producto |
| Sesiones, roles y aislamiento | Controles por tenant, permisos explícitos, revocación, idempotencia y pruebas de concurrencia; técnicos limitados en código .42 | Activación coordinada y validación con una cuenta real de técnico |
| DPP / Passport Studio | Borradores, revisión, publicación, versiones e historial; operación centrada en identidad y ciclo de vida | Ceremonia editorial completa con una empresa real y su contenido aprobado |
| Logística y expedientes | Operaciones atómicas, recibos, navegación por lote, tareas y expediente | Aceptación de la cadena de custodia con actores reales |
| CRM y soporte | Reporte desde pasaporte, referencia, búsqueda, estados con motivo e historial; actividad con procedencia | Recorridos reales de soporte/cliente sin presentar TAPs como ventas o personas |
| SDK e integración | Paquete, consumo externo y contratos de integración probados | Primer conector real ERP/WMS/POS y conciliación de sus registros |
| Retiros y piloto | Retiro de lote, tareas, responsables, conciliación e informe | Cierre del piloto operativo completo, no sólo su simulación |
| Campañas y fidelización | Preparación, consentimiento, aprobación y simulación gobernada | Envío autorizado, control efectivo de presupuesto, bajas y conciliación de recibos |
| Uso, costos y disponibilidad | Centro de uso/salud y clasificación de errores | Costeo monetario completo por tenant, conciliación con factura y límites efectivos de gasto |
| Solicitudes de etiquetas | Borrador/envío y aclaraciones en producción .40/.41; asignaciones y bandeja técnica integradas vía #375 | Publicación .42/API .3 y validación de operación real |
| Recepción de manifiestos | Flujo guiado, validación y confirmación integrados vía #376 | Archivo real de proveedor, conciliación con recepción y pruebas físicas/QA |
| Cancelación comercial | Nuevo candidato completo de API + UI + migración 0117 y pruebas locales de esta sesión | Revisar candidato/CI, aplicar migración con autorización y activar explícitamente después del panel compatible |
| Cotización, proveedor y entrega | No se dan por terminados | Cotización versionada, aceptación/rechazo, proveedor asignado, comprobante de envío y entrega cifrada con acuse |

## Incremento implementado en esta sesión

La empresa o NexID, con la autoridad existente para gestionar la solicitud, consulta su versión actual y la de sus aclaraciones, escribe un motivo y revisa una confirmación explícita. Sólo una solicitud enviada y todavía no preparada puede cancelarse. Los datos comerciales y los historiales se conservan; el registro terminal muestra motivo, fecha UTC, identificador del responsable y versión.

Se bloquearon edición, aclaraciones y navegación competidoras mientras está abierto el paso de cancelación. Si cambió la solicitud o llegó una aclaración, el motivo local se conserva y se exige consultar y confirmar otra vez. Un resultado incierto conserva la misma identidad de operación; una denegación posterior no lo transforma en un fallo confirmado. La salida explícita de ese estado cierra el expediente local y exige una nueva lectura, sin reintentar ni afirmar reversión.

Los operadores limitados no pueden cancelar. El backend conserva su regla de acceso sólo a solicitudes enviadas/preparadas: una solicitud cancelada deja su bandeja, sin borrar el historial de asignación. No se cancelan órdenes técnicas, compras, pagos, fabricación, stock ni tags; no se envían mensajes externos.

## Pruebas ejecutadas localmente

- Dashboard: 1.368 aprobadas, cero fallos, dos omisiones existentes. TypeScript y compilación de producción aprobados.
- API: compilación completa y suites del build aprobadas; regresión focal aislada: 297 aprobadas, cero fallos.
- PostgreSQL real aislado: 52 pruebas aprobadas, cero fallos/omisiones; incluye 13 casos nuevos de cancelación, CAS, concurrencia, revocación, rollback y recibos. Se ejecutan las migraciones y controles IAM reales usados por el harness. El núcleo de creación de órdenes técnicas conserva su fixture explícito: no certifica generación real de claves.
- Navegador con componentes reales y transporte/sesiones sintéticos:
  - browser-final: 135 comprobaciones, 12 vistas, 0 infracciones detectadas por axe.
  - requests-regression: 287 comprobaciones, 33 vistas, 0 infracciones detectadas por axe.
  - assignments-regression: 195 comprobaciones, 22 vistas, 0 infracciones detectadas por axe.
- Capturas revisadas visualmente: confirmación en 320 px claro y estado cancelado en 1.440 px oscuro. La matriz automática también cubre 390 px y ambos temas.
- Auditoría de dependencias, custodia de secretos y seguridad estática de migraciones aprobadas. Ninguna de estas pruebas equivale a una operación de cliente o certificación física NFC.

Los workflows existentes se habilitaron para las ramas candidatas, sin despliegues ni SQL remoto. El resultado de GitHub debe verificarse sobre los commits concretos; este documento no declara que un workflow configurado ya haya pasado.

## Activación y compatibilidad

`SUPPLIER_REQUEST_CANCELLATION_ENABLED` está desactivado por defecto y debe ser exactamente `true` para habilitar el endpoint. La migración por sí sola no cancela ningún registro ni activa el flujo HTTP. La API además verifica que la función exista y que su rol pueda ejecutarla.

El estado `cancelled` amplía el contrato existente: el panel .41 no lo admite. Primero deben instalarse lectores compatibles y verificarse permisos/contratos; luego, con autorización, migraciones y API; finalmente se activa el flag de escritura. No se debe habilitar la cancelación con clientes antiguos conectados. Después de generar cancelaciones, apagar el flag detiene nuevas operaciones pero se conservan lectores compatibles: restaurar un panel que desconoce ese estado no es un rollback válido.

## Siguientes puntos del plan

1. Cerrar la publicación coordinada pendiente y validar empresa + técnico con identidad real, sin fabricar cuentas ni muestras productivas para QA.
2. Cotización versionada vinculada a la solicitud, con moneda/importes explícitos y aceptación/rechazo auditable; no inferir una compra ni calcular impuestos no definidos.
3. Proveedor, comprobante de envío manual y entrega cifrada/acuse, separados de fabricación y recepción física.
4. Completar recepción real + QA + piloto, y el conector ERP/WMS/POS que lo justifique. En paralelo, cerrar costeo por tenant y límites reales antes de activar campañas de pago.
