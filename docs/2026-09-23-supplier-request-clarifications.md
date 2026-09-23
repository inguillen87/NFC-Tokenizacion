# Solicitudes: aclaraciones e historial

## Objetivo

Resolver las dudas entre la empresa y NexID dentro de la solicitud, antes de
preparar una orden técnica. La solicitud comercial conserva sus cinco campos y
sus estados anteriores. El intercambio tiene su propia revisión y su historial.

La bandeja identifica quién debe actuar, permite buscar y filtrar los registros
cargados y distingue una consulta fallida de una lista confirmada vacía. Los
conteos describen sólo los registros cargados, no métricas de toda la empresa.

## Circuito

| Situación | Próxima acción | Preparación técnica |
| --- | --- | --- |
| Enviada, sin consultas | NexID revisa la solicitud | Disponible con los permisos existentes |
| NexID pide una aclaración | La empresa responde | Bloqueada mientras falte la respuesta |
| La empresa responde | NexID revisa la respuesta o pide otra aclaración | Disponible; no implica aprobación |
| Pedido técnico preparado | Consultar solicitud e historial | No admite más mensajes en este circuito |

NexID formula la consulta con una cuenta superadmin. La respuesta requiere una
cuenta autorizada de la empresa y su alcance exacto; superadmin no responde en
nombre del cliente. No se conceden permisos nuevos a usuarios existentes.

Responder no modifica producto, construcción, cantidad, destino ni notas
originales, y no confirma cotización, compra, envío a fábrica o fabricación.
El mensaje admite hasta 2.000 caracteres; se rechaza material secreto.

## Integridad

- Protocolo independiente `nexid.supplier-request-review.v1` y migración aditiva
  `20260923150000_0114_supplier_request_reviews.sql`.
- Revisión de solicitud y revisión de intercambio comprobadas antes de escribir.
- Recibo idempotente ligado al actor, la solicitud y el contenido. Una respuesta
  incierta conserva la misma operación para comprobar el resultado.
- Mensaje, resumen, recibo y auditoría se confirman dentro de una transacción.
- Preguntas, respuestas y conversión toman el mismo bloqueo de solicitud. Una
  carrera no permite preparar un pedido con una consulta pendiente.
- El bloqueo de preparación se aplica en PostgreSQL, también ante un cliente
  antiguo. Se conserva el contrato comercial `nexid.supplier-request.v1`.
- El historial se consulta en páginas con un cursor de revisión; la interfaz
  indica cuando existen mensajes anteriores por cargar.

## Decisiones de UX

Se usan estados de trabajo y próximas acciones explícitas. Como referencia de
producto, Shopify permite [vistas y filtros de órdenes de compra](https://help.shopify.com/en/manual/products/inventory/purchase-orders/viewing-purchase-orders)
y separa [borrador y pedido confirmado por el proveedor](https://help.shopify.com/en/manual/products/inventory/purchase-orders/creating-purchase-orders).
En NexID, recibir una respuesta es sólo evidencia de que la empresa respondió.
No se presenta como una aprobación comercial o técnica.

El editor comercial y la conversación permanecen separados dentro del mismo
expediente. Se muestra una acción principal según quién tenga que actuar. Los
mensajes pendientes, conflictos y reintentos conservan el texto escrito.

## Publicación y alcance de evidencia

Candidatos: Dashboard `2026.09.23-dashboard.41` y API
`2026.09.23-api-supplier-requests.2`. La publicación, identidades y resultados de
validación se registran en sus archivos de candidato una vez comprobados.

Las pruebas locales y de CI usan datos sintéticos. No equivalen a intercambios
comerciales reales, provisión de claves ni validación física de etiquetas.

### Publicación confirmada

Dashboard .41 (`71b3248d`) y API supplier-requests.2 (`fca60584`) están publicados
en sus dominios canónicos. Los identificadores de despliegue, CI y hashes de los
marcadores están registrados en los archivos de candidato. La migración 0114
se aplicó primero en una rama sin datos de clientes y luego en la base principal;
en ambos casos, migración y registro de versión se confirmaron juntos.

CI aprobó las 1.233 pruebas de Dashboard (dos omisiones existentes), las 254
regresiones focales de API y 59 casos PostgreSQL. Las dos suites de proveedores
completaron 1.092 comprobaciones sobre 74 vistas de componentes reales con
transporte sintético, sin incidencias de accesibilidad, desbordamientos ni
errores de cliente. La regresión incluye foco al abrir una solicitud y recuperar
correctamente una página de historial tras un fallo transitorio.

La sesión real de Balmec confirmó .41, su alcance de empresa, la consulta de la
bandeja vacía y los filtros nuevos. No se crearon solicitudes, conversaciones,
pedidos ni claves en Producción. La ida y vuelta con registros comerciales reales
queda fuera de esta comprobación de lectura.

## Continuidad del plan

El rol técnico interno de NexID queda como un incremento de identidad separado.
El perfil actual de responsable de operaciones pertenece a una empresa y no
debe reutilizarse como operador global. Quedan pendientes la delegación con
alcance explícito, asignación de responsable, cotización/cancelación, proveedor
asignado y comprobante de envío manual. La entrega cifrada y cualquier aviso
autorizado por WhatsApp corresponden a etapas posteriores.

Rollback operativo: restaurar los despliegues anteriores conservando el esquema
y los mensajes. Una consulta pendiente seguirá bloqueando la preparación en la
base; para responderla se necesita una interfaz compatible con este protocolo.
No se borran intercambios ni se desactiva el bloqueo como parte del rollback.
