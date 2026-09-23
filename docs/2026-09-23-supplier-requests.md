# Solicitudes de etiquetas: empresa → NexID → proveedor

## Decisión de producto

La empresa solicita etiquetas con datos de negocio. NexID recibe la solicitud,
revisa la construcción y prepara la orden técnica. La transmisión al proveedor
permanece manual. No se envían mensajes, claves ni órdenes por WhatsApp en este
incremento.

La solicitud contiene producto/proyecto, construcción, cantidad, destino de
prueba o producción y notas. Puede guardarse incompleta si tiene un nombre.
Los chips, identificadores de lote y claves pertenecen a la preparación técnica.
Cada construcción utiliza una solicitud independiente en esta versión.

## Estados y responsabilidades

| Estado | Empresa | NexID | Significado |
| --- | --- | --- | --- |
| Borrador | Guardar, retomar y editar | Consultar con alcance explícito | Todavía no enviado a NexID |
| Enviada a NexID | Consultar seguimiento | Revisar y preparar pedido | No confirma cotización, compra ni fabricación |
| Pedido técnico preparado | Consultar pedido vinculado | Continuar especificación, muestras y recepción | No acredita envío a fábrica, QA ni activación |

La bandeja global muestra sólo solicitudes enviadas y preparadas. La empresa ve
exclusivamente su alcance. `supplier_order.create` permite solicitar sin exigir
generación de claves, MFA técnico ni un perfil SUN operativo. La conversión de
solicitud a orden requiere actualmente superadmin, además de los controles
técnicos existentes. No se crean ni amplían permisos de usuarios reales.

La creación técnica anterior sin solicitud conserva sus autorizaciones.
La delegación a un empleado técnico de NexID requiere un rol operativo específico
y queda pendiente; no se simula mediante permisos globales de un tenant.

## Integridad y recuperación

- Protocolo `nexid.supplier-request.v1`, con identificadores y alcance confirmados
  por el servidor antes de mostrar un guardado exitoso.
- Cada guardado/envío lleva una clave de operación estable. Reintentar el mismo
  comando recupera su recibo; cambiar contenido o actor con esa clave produce
  conflicto.
- La revisión esperada evita sobrescribir cambios de otra persona. Un conflicto
  conserva la entrada local para comparar con el servidor.
- Auditoría, solicitud y recibo se guardan en la misma transacción. Guardar o
  enviar la solicitud no crea lotes, claves, manifiestos ni exportaciones.
- La preparación técnica bloquea la solicitud y valida empresa, revisión,
  cantidad, destino y construcción. Crear la orden y vincularla son una única
  transacción; dos operadores no pueden crear dos órdenes para la misma solicitud.
- Una respuesta incierta conserva el comando para comprobarlo sin inventar una
  confirmación. El navegador no presenta almacenamiento local como guardado durable.

## Publicación y evidencia

Candidatos: Dashboard `2026.09.23-dashboard.40` y API
`2026.09.23-api-supplier-requests.1`, con migración aditiva
`20260923120000_0113_supplier_requests.sql`.

El estado de publicación se registra después de las validaciones en los archivos
de candidato. Este documento de implementación no prueba una promoción ni una
solicitud comercial real. Las pruebas usan datos sintéticos y bases aisladas.

La migración debe ejecutarse en una sola transacción con su entrada en
`schema_migrations`, tras validar el esquema y funciones en una rama de Neon.
No reejecutar migraciones históricas. Rollback operativo: restaurar los despliegues
anteriores y conservar las tablas aditivas y sus registros; no borrar solicitudes.

## Próximas etapas

El incremento siguiente desarrolla primero el circuito de aclaraciones de la
etapa 2, según [su contrato y alcance](2026-09-23-supplier-request-clarifications.md).
La auditoría del modelo de identidad confirmó que el perfil de operaciones de
una empresa no puede representar a un técnico global de NexID. Esa delegación
necesita un incremento propio; no se amplían permisos por conveniencia de UX.

1. Rol técnico de NexID con alcance explícito y asignación de responsable.
2. Cotización/revisión, pedido de aclaraciones y cancelación con historial.
3. Proveedor asignado, versión de especificación y comprobante de envío manual.
4. Paquete cifrado con entrega controlada y confirmación del proveedor.
5. Aviso por WhatsApp autorizado con enlace de acceso temporal. Sin claves
   maestras ni material secreto en el texto del mensaje.

Las partes restantes no se presentan como implementadas. El envío automático exige
proveedor/canal configurados, autorización del envío, control de reintentos y
recibos verificables. Un mensaje enviado nunca equivale a fabricación aceptada.

## Publicación confirmada

Dashboard .40 (`eca50e87`) y API supplier-requests.1 (`5adf44c7`) quedaron
publicados en sus dominios canónicos. La migración 0113 se validó primero sobre
una rama de Neon con esquema y sin datos de clientes, y después se aplicó en
Producción con su registro de migración dentro de la misma transacción.

GitHub confirmó 1.224 pruebas de Dashboard aprobadas y dos omisiones existentes;
245 regresiones focales de API y 49 pruebas entre las cuatro suites PostgreSQL.
Las dos suites de navegador de proveedores completaron 969 comprobaciones en
60 vistas con componentes reales y transporte sintético. El wrapper de
conversión se probó con un core de pedidos controlado; no certifica generación
real de claves ni aprovisionamiento físico.

La comprobación autenticada en Producción confirmó la versión visible, la
empresa de la sesión, la consulta real de su bandeja vacía y el formulario.
No creó solicitudes ni pedidos comerciales. La bandeja global y la conversión
real en Producción no se presentan como aceptadas por este chequeo de lectura.
Identidades de despliegue y límites completos en
`releases/2026-09-23-dashboard.40.candidate.json`.
