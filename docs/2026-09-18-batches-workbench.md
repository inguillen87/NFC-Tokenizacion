# /batches — reparación operativa

Base ef99bc97245d2c4fa84533cce9dd12e439b30403.
API requerida: 2026.09.18-api-batches.1. Dashboard .12.

El usuario reportó una ruta inaccesible. La reproducción con su navegador mostró
un retorno al CRM en vez de la lista. No bastaba probar /novedades ni un superadmin
con permisos comodín. La corrección API resuelve la lectura necesaria para las
tareas del administrador de empresa; no convierte la cuenta piloto en superadmin.

La ruta existente muestra lotes confirmados, búsqueda por producto/BID/SKU,
filtros y paginación local. Cada producto enlaza directamente a la ficha existente
o a Passport Studio si ya está gestionado; un lote vacío puede abrir el receptor
de archivos. La lista requiere una fuente, no product-assets ni score comercial.
Las cifras conservan activas/inactivas/revocadas sin llamarlas aceptación de QA.

Pedido a fábrica transporta intent=new y la empresa a la recepción existente;
solo abre el formulario si la consulta y el permiso lo permiten. No genera llaves
ni crea un pedido por visitar una URL. Los demás recorridos de recepción quedan
como estaban. El mapa, el centro en vivo y la experiencia SUN no se modificaron.

Los casos de navegador locales usan la política real de permisos de la API,
Next y BFF reales, pero datos/persistencia de fixture. Se comprobó el recorrido
lista-editor-guardado-relectura sin alterar datos de clientes. La certificación
física NFC y el pedido industrial real quedan fuera de esta corrección.
