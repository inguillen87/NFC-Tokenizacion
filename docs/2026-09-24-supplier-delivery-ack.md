# NexID — seguimiento documental del paquete cifrado

Fecha: 2026-09-24. Estado: candidato implementado y probado localmente, no activado en producción. La configuración de CI no equivale a su aprobación; los resultados remotos se registran por commit después de terminada cada ejecución.

## Continuidad

Las cotizaciones y el vínculo proveedor/especificación ya existían al retomar el trabajo. Este incremento parte de API `835cf059` (código de vínculo `66d188bf`) y panel `3e677861` (código de vínculo `2aa5933e`). No los vuelve a implementar ni toma las copias antiguas de API/web presentes en la rama del dashboard como fuentes de despliegue.

Ramas candidatas: `codex/nexid-delivery-ack-api-20260924` y `codex/nexid-delivery-ack-ui-20260924`. Las ramas de proveedor, cotización y cancelación anteriores se conservaron. No se modificó main ni se hizo merge automático.

## Resultado de producto y límite de la evidencia

Desde el expediente de una solicitud con pedido técnico preparado, NexID consulta el envío existente y sus paquetes cifrados elegibles. Puede registrar una comunicación documental de recepción, una incidencia o retirar la última declaración mediante un nuevo evento. La empresa puede consultar; el operador limitado de solicitudes no obtiene acceso a este circuito.

Cada declaración vincula un paquete exportado, su hash de sobre cifrado, el comprobante manual de envío y la asignación de proveedor/especificación exactos. Para registrar recepción se requiere ingresar el SHA-256 informado en la comunicación; no se preselecciona el paquete ni se completa ese valor automáticamente. La comparación debe ser exacta. Un hash diferente sólo puede registrarse como incidencia. El hash requerido es el del archivo de sobre `.zip.enc`, no el del ZIP descifrado.

**Este es un registro manual de NexID, no un acuse autenticado del proveedor.** No verifica identidad externa, entrega por un servicio externo, descarga, descifrado, fabricación ni recepción de etiquetas. La respuesta fija `source=nexid_manual_record` y las cuatro afirmaciones `supplier_authenticated`, `download_verified`, `decryption_verified` y `physical_received` en false. El cliente rechaza una respuesta que las convierta en verdaderas.

No se declara todo un pedido recibido a partir de un paquete: el estado visible se llama última declaración. Retirar una declaración conserva el evento original y no retira el envío, revoca claves, cancela órdenes ni borra comprobantes. No se envían mensajes o archivos a terceros.

## Integridad, contratos y custodia

- GET/POST `/admin/supplier-requests/{id}/delivery-ack?tenant={slug}`, protocolo `nexid.supplier-delivery-ack.v1`. GET admite `before_revision` exclusivo.
- Se conserva `supplier_order.create` como autorización de gestión del expediente; escritura adicional sólo superadmin. Empresa autorizada: consulta. El BFF no confía en identidad o tenant aportados por el cuerpo y conserva la defensa de origen para las escrituras.
- `SUPPLIER_DELIVERY_ACK_ENABLED` debe ser exactamente `true` para escribir. Por defecto está apagado; las lecturas históricas siguen disponibles con el esquema y rol preparados. No se cambió ningún flag real.
- Nuevos registros sólo usan un comprobante mark_sent previamente vinculado al proveedor, con especificación y decisión de aprobación coincidentes. Una fuente o especificación obsoleta bloquea nuevos acuses.
- La selección de artefactos exige mismo tenant/pedido/recurso, tipo de exportación cifrada, estado active/ready, presencia del sobre cifrado persistido, propósito y especificación coincidentes y fecha de exportación no posterior al envío.
- Sólo se exponen ID, hash registrado al exportar y fecha. La consulta no devuelve ni descifra el payload cifrado, contraseñas, claves, enlaces privados o metadata completa. **Se compara el hash persistido por el exportador; no se recalcula aquí el hash de los bytes del archivo ni se certifica su recepción externa.**
- El orden de locks sigue autoridad, clave de operación, solicitud, pedido y artefacto. Se revalida autoridad antes de escribir o recuperar un recibo. Se comprobaron concurrencia de doble envío y revocación de artefacto/autoridad.
- Evento y auditoría se escriben juntos; fallar cualquiera revierte ambos. El trigger de historial exige auditoría coincidente y rechaza cambios/borrados y enlaces forjados. Reintentos devuelven su recibo original y el estado actual, sin volver a escribir.
- Solicitud y revisión del historial se comparan antes de guardar. Una corrección puede retirar la última declaración aunque el archivo haya sido revocado después, sin ocultar el hecho histórico.
- Historial limitado a 50 eventos por página y 52 paquetes elegibles por respuesta, con truncamiento explícito. Navegador: respuesta máxima 256 KiB, UTF-8 estricto y timeout real de 20 segundos; sin reintento automático ni polling.
- Texto libre validado y rechazado cuando contiene secretos. Las referencias son texto; el sistema no sigue enlaces ni obtiene archivos a partir de ellas.

Migración: `20260924150000_0120_supplier_delivery_ack.sql`, dependiente del esquema anterior incluida 0119. SHA-256 de bytes LF: `08df6a1380a12782bd1551d1cc67253a969bff0b978dacc46abb5148155f061b`.

Política pura idéntica en API y panel, SHA-256 LF: `118c4262145fbdec348cfea1ef59fa02cd52977282d4e8bb7f0cf913f977fe38`.

La migración es forward-only y usa SECURITY INVOKER con search_path fijo y sin ejecución PUBLIC. El runner mantiene transacción/ledger. Espera DDL limitada a 5 s y ejecución a 60 s. No se aplicó a Neon ni se concedieron permisos productivos.

## UX y recuperación

Consulta → selección explícita de paquete → referencia/motivo/hash informado → revisión → confirmación. El formulario indica por separado envío, paquetes elegibles y última declaración. No promete persistencia del borrador al cerrar el navegador.

Un conflicto conserva el texto para revisar otra vez; un resultado incierto conserva exactamente el mismo comando y bloquea otra escritura. Una denegación posterior no se transforma en rollback: se ocultan los datos del expediente/proveedor/paquete, y permanece la salida explícita sin reenvío. Sólo una nueva respuesta válida y acotada puede restaurar el contexto. Las respuestas tardías de un contexto A anterior no reaparecen al volver A→B→A.

Las ediciones competidoras se suspenden. La confirmación recibe el foco del teclado y cerrar lo devuelve al control de apertura. Móvil/escritorio y claro/oscuro usan el sistema visual existente; no se agregaron dependencias, proveedores ni otra librería de componentes.

## Validación local efectivamente realizada

| Prueba | Resultado |
| --- | --- |
| Contratos/política API nuevos | 42 aprobadas |
| Regresión focal API aislada | 424 aprobadas, cero fallos |
| Build API | Completo aprobado, incluidas las suites del build |
| PostgreSQL real aislado | 101 aprobadas, cero fallos/omisiones; 15 casos nuevos de acuse |
| Dashboard | 1.501 aprobadas, cero fallos y dos omisiones existentes |
| Typecheck/build dashboard | Aprobados |
| Navegador browser-final | 106 comprobaciones, 12 vistas, 0 infracciones detectadas por axe |
| Navegador supplier-request-binding | 141 comprobaciones, 14 vistas, 0 infracciones detectadas por axe |
| Navegador supplier-request-quotes | 162 comprobaciones, 18 vistas, 0 infracciones detectadas por axe |
| Navegador supplier-request-cancellation | 135 comprobaciones, 12 vistas, 0 infracciones detectadas por axe |
| Navegador supplier-requests | 287 comprobaciones, 33 vistas, 0 infracciones detectadas por axe |
| Navegador supplier-request-assignments | 195 comprobaciones, 22 vistas, 0 infracciones detectadas por axe |

Las seis suites suman 1026 comprobaciones en 111 vistas, sin errores de cliente ni solicitudes inesperadas. Se inspeccionaron visualmente confirmación 320 px claro y estado registrado 1.440 px oscuro. También se ejercita 390 px. Esto no constituye una certificación integral de accesibilidad.

El navegador usa componentes y contratos reales con sesiones/transporte sintéticos y navegación de Next sustituida. PostgreSQL: PostgreSQL 17.10 on x86_64-windows, compiled by msvc-19.44.35226, 64-bit. Se aplican migraciones y controles de solicitudes, cotización, cancelación, proveedor, IAM y acuse reales. **Aprobaciones de packaging, base de lifecycle y artefactos cifrados son fixtures estrechos explícitos**: esta prueba no ejecuta el exportador real de claves, toda la cadena industrial ni el esquema productivo completo. Cluster detenido, sin esquemas de prueba restantes ni datos productivos.

Seguridad estática de migraciones, auditoría de dependencias, escaneo de secretos y git diff --check aprobados. La primera ejecución local de PostgreSQL reveló una ambigüedad UUID/text en el fixture, corregida con casts explícitos; el primer navegador detectó que el escenario de transporte demorado debía cerrarse antes de la siguiente acción. No se deshabilitaron controles ni se atribuyeron esos fallos del harness a producción.

## Incidencia local de almacenamiento

El disco C: tenía cero bytes libres y bloqueó un intento de crear worktree. Se comprobó que cuatro salidas .next de NexID eran regenerables, no estaban versionadas y no tenían procesos Node asociados por su ruta; se retiraron sólo esas compilaciones. Quedaron 1.158.049.792 bytes libres inmediatamente después. No se borraron código, node_modules, credenciales, datos, documentos, reportes ni capturas. Se reutilizaron worktrees limpios con ramas candidatas nuevas en lugar de duplicar dependencias. Los builds posteriores consumen parte de ese espacio: el equipo sigue necesitando una solución de capacidad independiente.

## Producción y siguientes puertas

| Superficie | Release observada | Comprobación UTC |
| --- | --- | --- |
| https://app.nexid.lat | 2026.09.23-dashboard.41 | 2026-09-24T15:17:16.125Z |
| https://api.nexid.lat | 2026.09.23-api-supplier-requests.2 | 2026-09-24T15:17:17.125Z |
| https://nexid.lat | 2026.09.21-web-support.1 | 2026-09-24T15:17:18.285Z |

No se promovió producción, aplicaron migraciones en Neon, crearon proveedores/cuentas, alteraron claves/TTStatus ni se enviaron mensajes. Las migraciones previas 0115–0119 y la nueva 0120 necesitan verificar su estado y autorización específica. Que un candidato de panel exista no significa que el backend productivo lo soporte.

Antes de activar: revisar candidatos y CI exacto; probar esquema completo/rol real en un entorno aislado autorizado; actualizar API/BFF/panel compatibles, migrar mediante runner autorizado y dejar escrituras apagadas hasta aceptar la combinación. No convertir este registro manual en un supuesto acuse firmado por el proveedor.

Rollback: apagar nuevas escrituras y conservar esquema aditivo, recibos e historial con lectores compatibles. No borrar eventos ni retirar los controles de proveedor/especificación que protegen envíos ya registrados.

**Próximo bloque no cerrado:** entrega externa controlada de paquetes y acceso/acuse del proveedor autenticado, respetando exportación y custodia existentes. Requiere identidad y canal aprobados y pruebas del circuito real; este incremento no simula ese resultado. También siguen pendientes el esquema industrial completo, primer ERP/WMS real, costeo monetario por empresa y aceptación del piloto físico.
