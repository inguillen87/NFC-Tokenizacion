# NexID — proveedor, especificación y vínculo con el comprobante de envío

Fecha: 2026-09-24. Incremento candidato; no publicación productiva.

## Continuidad comprobada

Las cotizaciones ya estaban implementadas cuando se reanudó el trabajo. Se recuperaron API `169e74e03b01251b6ed24bb9559b589fe55399e6` y dashboard `90b44a6b4c6371972911ceaf37d04d3e2659e63d`, con los runs `35959602371` y `35959605203` aprobados respectivamente. No se volvió a desarrollar ese circuito.

Este incremento continúa en `codex/nexid-supplier-binding-api-20260924` y `codex/nexid-supplier-binding-ui-20260924`, en worktrees independientes. Se preservaron las ramas anteriores, main, los otros worktrees y la separación de fuentes API/panel. Las copias antiguas de otra aplicación contenidas en cada árbol no son candidatas de despliegue.

## Recorrido implementado

Desde una solicitud con pedido técnico preparado: **consultar proveedor/especificación → completar referencias → revisar → confirmar → consultar historial**. El panel muestra por separado el estado del pedido, la aprobación de especificación y el vínculo de proveedor.

NexID puede registrar una referencia de proveedor, nombre, referencia de confirmación y motivo. Estos campos son una declaración del operador, no una comprobación automática del fabricante ni un archivo adjunto. La empresa puede consultar; no editar el proveedor. El operador limitado de solicitudes no obtiene acceso a este circuito.

La asignación vincula la versión de especificación, su hash y el identificador de la decisión de aprobación existente. Esos datos se consultan en el backend, no se escriben a mano ni se deducen del nombre del archivo. La fuente exige coincidencia entre pedido y decisión inmutable: tenant, versión, hash, snapshot, evidencias, validación, portador, responsable y fecha. Una etiqueta textual approved sin su recibo coincidente o con validación fallida no habilita la operación.

Antes del envío se permite retirar el vínculo indicando un motivo y registrar otro. El historial conserva cada evento; no se actualizan retroactivamente nombres, referencias o especificaciones anteriores. Una especificación cambiada vuelve obsoleto el vínculo y exige revisar y vincular nuevamente.

## Reutilización del envío existente

Se conserva el circuito de lifecycle 0086 y sus permisos, MFA, comprobantes de exportación, propósito del lote y controles de QA/activación. Este incremento no agrega otro botón que envíe documentos ni otro sistema de entrega.

La migración agrega un enlace auditable `supplier_binding_event_id` al comprobante manual de envío existente. Para un pedido que ya entró al circuito de proveedor, registrar mark_sent exige un vínculo activo, la misma especificación aprobada y la referencia exacta del destinatario. Un vínculo retirado, una especificación obsoleta o un destinatario diferente bloquean ese registro. El panel informa esas causas en español.

Después de existir un comprobante de envío, el vínculo ya no puede cambiarse. El panel muestra referencia y fecha del comprobante y aclara que es un registro manual: no es un acuse de recepción, confirmación de fabricación o prueba física. Los pedidos legados sin eventos de proveedor conservan sus controles anteriores, sin completar proveedores ficticios.

El enlace nuevo es una relación de base de datos y auditoría. No se modificó el hash criptográfico del evento histórico de lifecycle 0086 para hacerle afirmar que cubre ese campo nuevo. No debe presentarse como una firma adicional del proveedor ni como prueba criptográfica nueva de la entrega.

## Integridad y seguridad

- Sólo se opera sobre la solicitud preparada, su empresa y el pedido vinculado, sin cambiar revisiones de cotización ni datos comerciales.
- Se comparan revisión de solicitud, revisión del vínculo, pedido y versión/recibo de especificación. La transacción vuelve a comprobar autoridad, sesión, membresía y denegaciones antes de guardar o recuperar un recibo.
- La identidad de operación vincula actor, tenant, solicitud, proveedor, especificación y motivo. Un reintento devuelve su recibo original junto con el estado actual; no inventa otro proveedor.
- Evento y auditoría se confirman juntos. Fallar la auditoría o el evento revierte ambos. Los triggers rechazan cambios/borrados del historial, eventos directos sin auditoría coincidente y comprobantes cruzados entre empresas.
- Asignación, cambio de especificación y comprobante de envío se coordinan con el bloqueo del pedido. Se probaron ambas carreras: retiro antes de envío y envío antes de reasignación.
- No se guardan ni transmiten llaves, contraseñas o credenciales en las referencias. Los contratos rechazan campos desconocidos, identidades cliente y texto inseguro. No se visitan enlaces ni se obtienen archivos externos a partir de una referencia.
- API, BFF y navegador conservan lectura privada, sin caché. El cliente limita cada respuesta a 256 KiB, usa decodificación estricta y un timeout real de 20 segundos; no reintenta automáticamente.

## UX y estados de fallo

La edición es local hasta la confirmación; no se promete un borrador persistido al cerrar la pestaña. Una consulta de proveedor se hace a demanda, sin polling ni selección ficticia.

Un conflicto conserva los campos y exige consultar/revisar nuevamente. Un resultado de guardado incierto conserva la misma operación y bloquea otra escritura. Una denegación posterior no se interpreta como rollback: se oculta la información de solicitud/proveedor/especificación y se mantiene una salida explícita sin reenvío. Las respuestas tardías y el retorno A→B→A no restauran otro contexto.

Controles y texto funcionan en 320/390/1440 px y claro/oscuro. La confirmación recibe el foco del teclado, cerrar lo devuelve al botón original, las acciones competidoras quedan bloqueadas y el historial anterior se carga mediante cursor exclusivo. No se añadieron dependencias ni otro sistema visual.

## Contratos y migración

- GET/POST: `/admin/supplier-requests/{id}/supplier-binding?tenant={slug}`; GET admite `before_revision` exclusivo.
- Protocolo: `nexid.supplier-binding.v1`. Máximo 50 eventos por página; el estado actual permanece independiente de las páginas históricas.
- Permiso existente: `supplier_order.create`. Escritura adicional restringida a superadmin, sin conceder permisos nuevos a nadie. Empresa autorizada: sólo lectura.
- Escrituras: `SUPPLIER_REQUEST_SUPPLIER_BINDINGS_ENABLED` debe ser exactamente `true`. Por defecto está desactivado. Las lecturas históricas siguen disponibles con el flag apagado si el esquema y el rol de conexión están preparados.
- Migración: `20260924110000_0119_supplier_request_binding.sql`, dependiente del esquema y las migraciones anteriores, incluida 0118.
- SHA256 de la migración, bytes LF: `acc00b268f6c2c110e62ce82dc234de9b0a0bd456fd00c4795606869ba37edc2`.
- Política pura idéntica entre API/panel, SHA256 LF: `20d7ba9bfdf7a977a76d5fb084a108559e20db4bae5c91b8b5cc9929a8d53388`.
- Funciones SECURITY INVOKER con search_path fijo y sin ejecución PUBLIC. El runner existente conserva transacción y ledger. DDL con lock_timeout de 5 segundos y statement_timeout de 60 segundos.

## Validación local realizada

| Verificación | Resultado |
| --- | --- |
| API, políticas y contratos nuevos | 60 pruebas aprobadas |
| Regresión focal de API | 382 pruebas aprobadas, cero fallos |
| Compilación API | Completa y aprobada, incluidas sus suites de build |
| PostgreSQL real aislado | 86 pruebas aprobadas, cero fallos/omisiones; 18 casos nuevos del vínculo |
| Dashboard | 1.463 aprobadas, cero fallos, dos omisiones existentes |
| Typecheck y compilación dashboard | Aprobados |
| Navegador: supplier-request-binding | 141 comprobaciones, 14 vistas; 0 infracciones detectadas por axe |
| Navegador: supplier-request-quotes | 162 comprobaciones, 18 vistas; 0 infracciones detectadas por axe |
| Navegador: supplier-request-cancellation | 135 comprobaciones, 12 vistas; 0 infracciones detectadas por axe |
| Navegador: supplier-requests | 287 comprobaciones, 33 vistas; 0 infracciones detectadas por axe |
| Navegador: supplier-request-assignments | 195 comprobaciones, 22 vistas; 0 infracciones detectadas por axe |

Las cinco suites de navegador suman **920 comprobaciones en 99 vistas**, con cero errores de cliente y cero peticiones inesperadas. Las capturas finales de confirmación en 320 px claro y comprobante vinculado en 1.440 px oscuro se revisaron visualmente. El navegador monta componentes y contratos reales con identidades/transporte sintéticos y navegación de Next sustituida; no es una operación de cliente autenticado ni certificación integral de accesibilidad.

El PostgreSQL local es PostgreSQL 17.10 on x86_64-windows, compiled by msvc-19.44.35226, 64-bit. Su cluster terminó detenido, sin esquemas de prueba restantes. El harness ejecuta migraciones de solicitudes, cotizaciones, cancelación, IAM y el nuevo 0119 reales. **Las tablas/snapshots de aprobación de packaging y la base del recibo de lifecycle son fixtures estrechos y explícitos** que representan los contratos de 0063/0086. Esta prueba no equivale a generar claves, aprobar muestras físicas, ejecutar el exportador lifecycle completo ni instalar el esquema completo con el rol real de producción. Esos cierres siguen separados.

Auditoría de dependencias, escaneo de secretos y git diff --check aprobados. El gate estático de migraciones existente también pasó; sus comprobaciones históricas no sustituyen las nuevas pruebas SQL de 0119. Los workflows de cada aplicación se habilitaron para estas ramas y la nueva suite; el CI debe comprobarse sobre los commits exactos antes de declararlo aprobado.

## Producción, activación y continuidad

Lectura canónica de release.json durante esta sesión:

| Superficie | Release | Fecha UTC |
| --- | --- | --- |
| https://app.nexid.lat | 2026.09.23-dashboard.41 | 2026-09-24T14:02:03.4477687Z |
| https://api.nexid.lat | 2026.09.23-api-supplier-requests.2 | 2026-09-24T14:02:04.8009253Z |
| https://nexid.lat | 2026.09.21-web-support.1 | 2026-09-24T14:02:06.4677010Z |

No se desplegó producción, no se aplicó SQL en Neon y no se activaron los flags. Las migraciones 0115–0119 permanecen sujetas a verificación y autorización específica. No se emitieron cotizaciones reales, no se crearon cuentas/grants, ni se contactaron proveedores.

Antes de activar: revisar candidatos y CI; validar esquema completo y permisos reales en un entorno aislado autorizado; coordinar lectores API/BFF/panel; verificar/aplicar migraciones por el runner con autorización y mantener escrituras apagadas hasta aceptar la combinación. No activar un componente suponiendo que una preview equivale al backend productivo.

Reversión operativa: apagar nuevas escrituras, conservar historial y lectores compatibles. Si existen vínculos, no retirar los controles que impiden registrar envíos con proveedor o especificación incorrectos; no borrar eventos ni completar acuses inexistentes.

El siguiente bloque es la entrega cifrada controlada y el acuse del proveedor, apoyados en la exportación existente, manteniendo separados aviso, acceso al paquete, recepción declarada y QA física. El primer conector ERP/WMS y el costo monetario por empresa continúan pendientes independientes del plan. No se da por cerrado el piloto industrial por aprobar pruebas sintéticas.
