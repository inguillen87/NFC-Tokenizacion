# Batches: reparación del acceso de la cuenta piloto

Incidente reproducido en el Chrome del usuario: GET /batches devolvía la página
con HTTP 200, pero la navegación terminaba en / (CRM). La sesión activa era
piloto.balmec@nexid.lat, tenant_admin de demobodega, no la cuenta global de Marcelo.
El catálogo otorgaba tareas de lote (incluido batch.product.configure) sin
batches:read; requireDashboardSession enviaba silenciosamente al inicio.

Corrección: al resolver la sesión vigente, las tareas permitidas de las funciones
administrativas que ya podían consultar lotes incluyen su dependencia de lectura.
No se cambian membresías ni se concede un comodín. La denegación de lectura o
de la tarea mantiene precedencia. Los roles especializados de recepción no
obtienen acceso nuevo al expediente administrativo completo. Lista y resumen
conservan el límite de roles original y añaden el control explícito de lectura.

No hay cambio de base de datos, planes, claves, SUN/SDM, activaciones ni usuarios.
La resolución vuelve a leer la autoridad vigente; no requiere fabricar otra sesión.

El dashboard sustituye el contenido promocional de /batches por el inventario,
búsqueda local y acciones al editor existente. Solo consulta la lista de lotes,
no requiere product-assets ni tokenización. Los enlaces llevan el alcance de empresa.
El usuario sin permiso queda en una respuesta explicada de acceso denegado,
no en una redirección silenciosa al CRM. Un fallo no se representa como cero.
Pedido a fábrica abre el formulario existente con empresa validada; no envía el pedido.

Pruebas previas: 8 controles de permisos API y 6 de contrato/listado, además de
las suites existentes. Navegador con el Next/BFF real y datos locales sintéticos:
perfiles sin wildcard, lista y filtros, editor existente/guardado/relectura en
fixture, pedido preseleccionado sin escritura, denegación, fallo de fuente,
cuatro casos claro/oscuro y móvil/escritorio. No se afirma que el fixture sea
PostgreSQL real. La comprobación productiva final debe usar la sesión abierta del
usuario y no escribir sobre sus etiquetas o producto.

Reversa API: dpl_CCsZ8AVDv871nWEQqTC4zPKD8tSn. Reversa dashboard:
dpl_4jUFsAmEVXjUtY77UZun1FEXUuUt. Promover API compatible antes de dashboard.
