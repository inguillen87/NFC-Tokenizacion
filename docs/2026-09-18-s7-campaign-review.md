# S7 — Revisión, consentimiento y simulación de campañas

Entregas: dashboard.17 / api-campaigns.1, sobre API 33c0a6cd2d766bbed658724caacf5227ed221ab3 y dashboard afbb2b1cd46d0d813d2adbe515320219fd8d91b6.
No hay cambios en la web pública, el verificador SUN, TTStatus, GS1/QR, retiros, SDK o informe del piloto.

## Cierre de esta fase del plan

El plan original pide consentimiento, revisión y presupuesto antes de enviar y comenzar en simulación. Se reutilizan campaign_drafts y su editor. Cada borrador guardado tiene acceso «Revisar y simular» hacia /campaigns/review. El texto no se duplica en otro editor: se conserva una instantánea explícita de la revisión evaluada.

La empresa configura moneda (ARS/USD/EUR), costo de referencia por mensaje, presupuesto y máximo de destinatarios. Son estimaciones ingresadas por el operador, no precios consultados al proveedor ni límites a la factura de Neon o mensajería. Los importes son enteros en unidades menores y el costo unitario debe ser positivo; presupuesto cero produce cero candidatos.

Guardar límites crea una revisión del plan. Solicitar revisión bloquea esa configuración. Una cuenta administrativa autorizada, con MFA y distinta del autor/editor/preparador/presentador, aprueba la simulación. Una devolución deja registro del motivo. Cambiar el texto desde el editor anterior o cambiar los límites invalida la aprobación para ensayos nuevos, sin impedir las funciones anteriores de guardar, archivar o restaurar borradores.

El estado «Aprobada para simular» no es una aprobación del proveedor ni autorización de gasto. No se implementó endpoint de envío, cola de entrega, programación, reserva de fondos, webhook de resultados o exportación de destinatarios. Las acciones nuevas no llaman a proveedores, IA, email, SMS ni WhatsApp. La prueba WhatsApp existente es una función distinta, no se ejecuta ni se modifica desde aquí.

## Audiencia y presupuestos

La simulación consulta en el servidor los miembros de la empresa, estado de membresía, consentimiento específico del canal y contacto. No recibe una lista de contactos ni un número de consentidos proporcionado por el navegador. Excluye membresías inactivas, consentimientos ausentes/retirados/fechados a futuro y contactos ausentes o de sintaxis no admitida. Ante varias filas equivalentes de consentimiento, cualquier revocación o condición no válida impide usar ese miembro.

La sintaxis de contacto es conservadora: email con estructura básica y teléfono E.164 sin separadores. No demuestra titularidad ni entregabilidad. Se deduplican destinos normalizados; no se identifica cada lectura NFC como una persona. Se muestran bases y exclusiones disjuntas, y se aplican primero el máximo de destinatarios y después el presupuesto de referencia. No hay segmentación geográfica, selección por última actividad o supresión global del proveedor en esta fase.

Sólo se persiste un agregado: ningún correo, teléfono, nombre de consumidor ni lista de envío se conserva en la simulación. El resultado registra momento, revisión del texto, versión del plan, datos observados, candidatos, exclusiones y estimación. En cada ensayo nuevo se reconsulta consentimiento. Repetir el MISMO intento devuelve la instantánea original, con su fecha; no se finge una nueva medición. Una revocación posterior exige reconsulta antes de cualquier envío futuro.

## Persistencia y permisos

Migración aditiva 0107: campaign_launch_plans, campaign_launch_operations, índices y funciones. No reescribe campaign_drafts, consentimientos ni hardware. No inscribe campañas automáticamente. El draft se bloquea durante el comando, se comprueban las revisiones y se confirma plan + movimiento + comprobante en una transacción. Clave de repetición por tenant/draft/actor/operationId y huella del comando. Una colisión de contenido es conflicto, y un fallo de historial revierte la modificación.

La lectura usa campaigns:read, la escritura campaigns:write y límites del rol existentes. La aprobación de simulación requiere admin/owner/superadmin con MFA y respeta denegación explícita campaigns:approve. No concede permisos, no modifica membresías ni sustituye la cuenta del cliente. Exportar el informe requiere reports.export. El BFF conserva alcance, y la API rechaza seleccionar otra empresa desde una cuenta tenant.

Límites: 50 borradores por consulta, 30 movimientos visibles, audiencia hasta 100.000 miembros (no toma una muestra como total), máximo 10.000 candidatos, request 8 KiB y response 256 KiB. Lecturas sólo al consultar/operar; sin polling o tareas programadas. La simulación utiliza la base existente y genera uso normal de base/funciones; «cero cargos de mensajería» no significa tráfico/almacenamiento gratuitos a cualquier volumen.

## UX y evidencia

Vista actual del texto junto a límites, roles claros, confirmaciones, campos conservados al cambiar pestañas, conflictos sin sobrescritura, reintento con el mismo identificador, resultados e historial. Al cambiar de empresa se descarta el contexto anterior antes de habilitar trabajo. Claro/oscuro, foco visible, layout móvil y transiciones breves con movimiento reducido respetado. Exportación HTML autónoma imprimible con fecha, fuente y denominadores; no un PDF firmado ni informe de ventas.

17 escenarios con handlers reales y PostgreSQL 17.10 local desechable: aislamiento, sólo lectura, límites, comandos desconocidos, concurrencia, repetición, MFA/denegación, aprobación independiente, consentimiento y duplicados, presupuesto, revocación entre ensayos, edición de borrador, archivado, fallo de historial y conservación de hardware. Las sesiones y los datos de esos tests son sintéticos; no se generaron campañas o simulaciones en producción.

Navegador del proyecto con la API real local: límites con respuesta perdida, repetición sin otra operación, revisión por otro usuario, simulación y exportación con fuentes, recarga y cuenta de consulta. Cuatro variantes escritorio/celular y claro/oscuro, sin incidencias axe serias/críticas en la superficie evaluada. Eso no es certificación WCAG. El resultado descargado no contiene contactos.

## Pendiente para S7 completo

Proveedor y plantilla aprobados, supresiones/opt-out, revalidación de consentimiento al despachar, reserva/límite real del gasto, idempotencia de entrega y reconciliación de estados/cargos, cancelación y resultados observados. No se habilita envío real ni se declaran ventas/ROI por una simulación. No se utiliza el presupuesto de referencia como si fuese un bloqueo real de facturación.

Esta es la fase de aprobación y ensayo, no el cierre de la entrega comercial. S6 sigue publicado sin cambios. El expediente de retiros mantiene los pendientes de rectificación/levantamiento y acuse directo del distribuidor; el avance a S7 no los da por terminados.
