# NexID — cotizaciones versionadas y decisión comercial

Fecha: 2026-09-24. Incremento de código, no publicación productiva.

## Continuidad exacta

- API: rama `codex/nexid-request-quotes-api-20260924`, derivada de cancelaciones `7bf84fb15af000a49c3a82ccf0777c7c36df7f56`.
- Panel: rama `codex/nexid-request-quotes-ui-20260924`, derivada de cancelaciones `ff3b31b733ba5c0958666f59b215ff1c4924688c`.
- Las ramas de cancelación se conservaron. API y dashboard mantienen fuentes separadas; no se utilizan las copias antiguas de otra superficie incluidas en cada árbol.
- Sin merge a main, sin reescritura de historia, sin cuentas o permisos nuevos, sin despliegue y sin SQL en Neon.

## Recorrido implementado

Desde la solicitud existente: **consultar cotización → preparar propuesta o decisión → revisar → confirmar → consultar recibo e historial**.

NexID puede emitir una propuesta y nuevas versiones mientras no haya sido aceptada. Puede retirarla indicando un motivo. La empresa puede aceptar o rechazar explícitamente la versión vigente; no puede alterar sus importes ni emitir una oferta por NexID. Un superadministrador no puede aceptar en nombre de la empresa. Los técnicos de solicitudes asignadas no acceden al endpoint comercial ni reciben permisos nuevos.

La propuesta contiene moneda explícita (ARS, USD o EUR), neto total para la cantidad solicitada, impuestos cotizados, envío cotizado, vencimiento y condiciones. Neto/impuestos/envío se guardan como centavos enteros; el total se calcula en PostgreSQL y se vuelve a verificar en los contratos. El formulario no precarga precio, moneda, tasa fiscal ni envío: exige ingreso explícito, incluido cero. Admite coma o punto decimal, no separadores de miles ni notación exponencial. No calcula impuestos normativos, tasas de cambio o precio por unidad.

Las versiones publicadas y las decisiones son inmutables. Preparar o revisar no escribe; antes de publicar, la edición sólo existe en memoria de la pestaña. No se promete un borrador de cotización persistido ni almacenamiento local. Los datos enviados originales de la solicitud no se reescriben.

## Integridad, permisos y fallos

- Se comparan versión de solicitud, revisión de cotización y revisión de aclaraciones. Cada operación de cotización incrementa también la revisión de la solicitud para que cancelación, asignación y conversión antiguas no ignoren cambios nuevos.
- Cada evento identifica responsable, fecha, versión comercial y aclaraciones consultadas. Una aclaración posterior a una oferta exige una nueva versión del emisor antes de aceptarla; una pregunta pendiente bloquea emisión/aceptación.
- No se acepta una oferta vencida, incluso si el intento empezó antes de vencer y esperó un bloqueo de PostgreSQL. El vencimiento es el plazo para aceptar, no una revocación automática de una aceptación ya registrada.
- Los reintentos conservan clave y cuerpo. Un recibo de una operación antigua se muestra como tal, junto con el estado actual, sin confundirlo con la última versión. Una denegación posterior no transforma un resultado incierto en cancelación o fracaso confirmado.
- El flujo oculta el contenido previo cuando se retira el acceso. Los retornos de sesión y respuestas tardías no restauran un panel cerrado. Cerrar con un resultado incierto requiere confirmación explícita y no revierte ni reenvía la operación.
- Estado de solicitud, evento de cotización y auditoría se confirman juntos. Constraints y triggers impiden modificar eventos históricos o inventar una revisión de solicitud sin evento y auditoría coincidentes.
- Una solicitud que entró al circuito de cotización no puede convertirse en pedido técnico sin aceptación de la oferta vigente. Hay prevalidación en API/panel y un control transaccional independiente en base de datos. Las solicitudes legadas sin cotización conservan su circuito anterior.
- La aceptación no crea pagos, compras, órdenes técnicas, fabricación, claves, activación de etiquetas, despachos ni notificaciones externas. La preparación técnica sigue su operación explícita y sus permisos/controles existentes.

## Contratos y despliegue gradual

Endpoint GET/POST: `/admin/supplier-requests/{requestId}/quotation?tenant={slug}`.
Protocolo: `nexid.supplier-quote.v1`. Historial paginado con `before_revision` exclusivo; hasta 50 eventos por página. Respuestas privadas y sin caché. Cliente: límite de 1 MiB y timeout de 20 segundos; ningún reintento automático.

La API obtiene actor/sesión desde la autenticación. Los campos cliente no pueden cambiar tenant, actor o autorización. El BFF comprueba origen, sesión, empresa y qué acciones corresponden al emisor o a la empresa. La base vuelve a comprobar sesión, membresía, perfil, denegaciones y acción incluso antes de recuperar un recibo guardado.

La política pura de importes y eventos se mantiene idéntica entre API y dashboard para este par de candidatos:
SHA256 LF: `7ab226ed40c220b7454d86eec0471a98b3f57235a2899b794fa95f6c67e8c7fa`.

Migración: `20260924050000_0118_supplier_request_quotes.sql`.
SHA256 LF: `c04a7794f7b12bf07f232b63b42c53d7f3192684b0e9cc16b3ac96f00c9e17f7`.
Requiere la secuencia previa, incluida 0117. La migración no emite ofertas ni cambia permisos de usuarios. Su transacción y ledger quedan a cargo del runner existente; DDL con espera de locks de 5 segundos y límite de ejecución de 60 segundos. Funciones SECURITY INVOKER, search_path fijo y sin ejecución PUBLIC.

`SUPPLIER_REQUEST_QUOTES_ENABLED` debe ser exactamente `true` para escribir. Está desactivado por defecto y no fue activado aquí. Las lecturas históricas permanecen disponibles cuando se desactivan nuevas operaciones, siempre que el esquema y los permisos del rol de conexión estén preparados.

## Validación local verificada

- API: compilación completa y suites del build aprobadas. Regresión focal: **322 pruebas aprobadas**, cero fallos.
- PostgreSQL real y aislado: **68 pruebas aprobadas**, cero fallos/omisiones, incluidas **16 nuevas pruebas** del circuito de cotización. Se usan las migraciones y los controles de autorización reales del harness. El núcleo de crear órdenes técnicas conserva su fixture explícito: esta prueba no certifica generación de llaves reales.
- Dashboard: **1.398 pruebas aprobadas**, cero fallos, dos omisiones opcionales preexistentes. Typecheck y build de producción comprobados en la validación del candidato.
- Navegador con componentes reales, sesiones/HTTP sintéticos y navegación de Next sustituida:
  - supplier-request-quotes: 162 comprobaciones, 18 vistas, 0 infracciones detectadas por axe.
  - supplier-request-cancellation: 135 comprobaciones, 12 vistas, 0 infracciones detectadas por axe.
  - supplier-requests: 287 comprobaciones, 33 vistas, 0 infracciones detectadas por axe.
  - supplier-request-assignments: 195 comprobaciones, 22 vistas, 0 infracciones detectadas por axe.
- Total de esas cuatro suites: **779 comprobaciones en 85 vistas**. No se suma nuevamente a los tests unitarios.
- Se revisaron capturas reales del harness: confirmación del emisor en 320 px claro y aceptación/historial en 1.440 px oscuro. La matriz de cotizaciones cubre 320/390/1440 px y ambos temas.

Las pruebas no corresponden a una empresa real autenticada, una operación financiera, una muestra física NFC ni una certificación integral de accesibilidad. El workflow de cada aplicación se habilitó para su rama candidata; el estado de CI debe consultarse en el commit exacto, no inferirse de este documento.

## Producción leída durante esta sesión

- https://app.nexid.lat: `2026.09.23-dashboard.41`, lectura UTC 2026-09-24T05:17:59.722Z.
- https://api.nexid.lat: `2026.09.23-api-supplier-requests.2`, lectura UTC 2026-09-24T05:18:00.615Z.
- https://nexid.lat: `2026.09.21-web-support.1`, lectura UTC 2026-09-24T05:18:01.446Z.

Se conserva el cierre pendiente anterior de operadores/cancelación. No se aplicaron 0115, 0116, 0117 ni 0118 en producción desde esta sesión. Tampoco se actualizó la metadata pública de release para anunciar una versión inexistente.

## Activación y reversión

1. Revisar los dos candidatos y aprobar sus CI. Validar compatibilidad del par y el esquema completo con el rol real en un entorno aislado autorizado.
2. Confirmar las migraciones previas y obtener autorización específica antes de aplicar 0118 en producción con el runner/ledger. No adivinar ni ampliar permisos del rol de conexión como atajo.
3. Publicar primero lectores API/BFF/panel compatibles, manteniendo las nuevas escrituras apagadas. Verificar tenant, actores y fuentes reales sin emitir ofertas de prueba a clientes.
4. Activar las escrituras sólo después de la validación y una autorización de operación. Emisión/aceptación reales requieren las acciones explícitas de sus usuarios correspondientes.
5. Si hay que detener el circuito, apagar nuevas escrituras y conservar datos, historial y lectores compatibles. No borrar eventos, reabrir aceptaciones ni eliminar el control transaccional de cotización para simular rollback.

## Próximo bloque

Vincular el proveedor confirmado y la versión de especificación, registrar comprobante explícito de envío manual y luego entrega cifrada/acuse. Esos pasos siguen separados de compra, fabricación, recepción y QA física. El primer conector ERP/WMS y el costo monetario por tenant continúan como cierres independientes del plan.
