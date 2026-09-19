# S3/S5 — Recorrido del lote: consulta operativa unificada

Entrega: 2026.09.19-api-trace.1 / 2026.09.19-dashboard.21.
Base API a39eaf32bc861ad4a0d073c5e1115b1c6efab80b.
Base dashboard 210964916f3877666cb22b2e8b69c021f612964c.
Web conservada 2026.09.19-web-consumer.1, e94720e2519c28f0b2ce32db67bd04be0255a093.

## Relación con el plan original

Este cierre implementa la consulta práctica de EPCIS y el expediente único que
el plan describe en «Unidad -> caja -> pallet -> envío -> recepción -> eventual
transformación». Reutiliza epcis_events, epcis_event_identifiers, el registro GS1,
shipments, package_seals, seal_inventory y custody_events. No crea otro almacén
de eventos, otro SDK o una nueva plataforma logística.

La ruta /batches/[bid]/traceability se abre desde la lista y el expediente.
Tres vistas: Recorrido, Relaciones por evento y Envíos vinculados. Seleccionar
un evento presenta sus referencias y fechas sin otra llamada a la API. Los datos
llegan a través de un único SELECT con CTEs y una sola instantánea de PostgreSQL.
Resolver la sesión sigue utilizando los mecanismos existentes de autenticación.

## Función y verdad del dato

El historial filtra por fecha declarada del evento EPCIS, manteniendo aparte la
fecha de registro de NexID. La custodia se filtra por fecha de registro porque
ese flujo no informa otra fecha de ocurrencia. Intervalos de 1 a 93 días completos
UTC, extremos visibles e inclusión correcta del último día.

Se distinguen ObjectEvent, AggregationEvent, AssociationEvent, TransactionEvent
y TransformationEvent. ADD, OBSERVE y DELETE se conservan. Las referencias padre,
hijos, entradas y salidas se resuelven sólo contra identidades del mismo tenant
que están vinculadas al evento. No se deriva que un contenedor sea una caja o un
pallet a partir de su nombre: se presenta como agrupador declarado. El sistema
origen y el registro deben identificar correctamente esos elementos.

Un DELETE no borra el historial ni se interpreta como asociación vigente. Una
declaración de corrección/error se marca expresamente; este visor no calcula la
validez definitiva ni una topología actual de todas las correcciones. Relaciones
históricas no equivalen a contenido físico, posesión, custodia actual o GPS.
Cantidades con UOM permanecen declaradas; un peso de 2,5 KGM no se cuenta como
2,5 identidades. Los contadores describen registros visibles, no todo el historial.

La consulta de envíos muestra estado ACTUAL del flujo vinculado al lote a través
de sus precintos. No afirma que el estado ocurriera dentro del período EPCIS o
que todos los artículos del envío correspondan a ese lote. Conserva el acceso al
expediente logístico existente; no agrega botones de liberación o mutación.

## Seguridad y límites

Sesión y batches:read obligatorios. API, BFF y página rechazan un tenant ajeno
explícitamente antes de la normalización heredada de alcance. La respuesta no
acepta actor, permisos o IDs de empresa alternativos desde el cliente.

La lectura de logística respeta el permiso logistics:read y el límite de scopes
que ya utiliza su ruta original. Sin acceso, envíos/custodia y sus indicadores de
truncamiento no se incluyen. La lectura de producto no concede otro permiso.
No se alteraron membresías, roles o sesiones productivas.

Datos proyectados: identificadores GS1 y BID del tenant, referencias de eventos,
fechas, tipo/acción y vocabulario acotado. No se entregan event_json libre, notas,
operadores, direcciones personales, credenciales de transportista, UID físicos o
payloads SUN. URIs de localización con query, fragmento o credenciales se omiten;
las restantes se muestran como referencias textuales, no se navegan ni geocodifican.
Una referencia sin vínculo autorizado se cuenta como omitida sin exponer su valor.

Máximos por consulta: 50 eventos EPCIS, 50 movimientos de custodia, 20 envíos y
100 referencias por evento, con indicadores de truncamiento. Respuesta <=1 MiB.
Los límites no equivalen a una garantía de costo ni a historial ilimitado. Aún
no hay paginación por cursor: un período muy denso puede requerir un siguiente
cierre de navegación. No se presenta una selección truncada como un recorrido total.
El servicio no ejecuta ensureSchema, crea índices o escribe contadores al consultar.

## Interfaz y exportación

Búsqueda por GTIN, serie, lote o envío y filtros locales de fuente/relaciones.
Cambiar fechas invalida los datos y las exportaciones anteriores. Un error de
origen no aparece como cero movimientos. No hay polling ni persistencia de datos
privados en localStorage. La selección de evento no vuelve a leer la base.

La vista desktop permite comparar lista y relación. En celular, indicadores
compactos con denominador explícito y desplazamiento al detalle al seleccionarlo.
Estilos claro/oscuro, colores de acción, foco visible y movimiento reducido.
El encabezado de esta página identifica la tarea en lugar de repetir NFC genérico.
Los vínculos a lecturas NFC existentes permanecen disponibles desde el expediente.

HTML autónomo y JSON se generan de la misma consulta cargada. HTML sin scripts,
imágenes ni recursos externos; campos escapados. El SHA-256 corresponde al objeto
JSON y no es firma digital ni una prueba blockchain. Exportar no llama a la API.
Los filtros de texto son visuales: el informe descarga la consulta completa visible
en sus límites, no sólo la fila seleccionada. Fechas y límites acompañan al archivo.

## Pruebas efectuadas

15 escenarios con PostgreSQL real local y el handler de consulta real: alcance,
deduplicación de enlaces, roles de referencia, correcciones, tiempos distintos,
UOM, permisos, rol operador, tenant ajeno, dato ausente frente a fuente caída,
proyección sin secretos, referencias sin vínculo, ubicaciones sensibles, límites
por ventana, orden determinista y conservación de tablas y estado del lote.

Los eventos EPCIS/logística del ensayo se sembraron como filas sintéticas con el
esquema utilizado por la consulta. Las identidades se registraron con el servicio
GS1 existente y sus autorizaciones locales. Esto prueba lectura y proyección,
NO una nueva captura de lector físico, ni todo el endpoint de ingesta EPCIS.
Sesiones del ensayo resueltas por un adaptador local explícito.

Siete comprobaciones integradas Next/React/BFF + PostgreSQL real pasaron: relaciones,
transformación, búsqueda sin red, envíos autorizados, informes con digest, cambio
de período, fuente caída y rechazo de empresa ajena sin exponer logística.
Cuatro variantes 1440/390 claro/oscuro sin hallazgos axe en la superficie evaluada.
No equivale a certificación WCAG. El HTML se renderizó sin solicitudes externas.

API: siete tests específicos y toda su cadena de regresiones/build aprobados.
Dashboard: 895 pruebas, 893 aprobadas, cero fallidas y dos omitidas; TypeScript
y build completos. Gates de secretos aprobados. Dependencias/lockfile sin cambios.

## Despliegue y pendientes

No requiere migración. Mantener la web, los verificadores SUN/SDM/TTStatus,
Polygon/IOTA, campañas y todas las operaciones mutantes actuales sin cambios.
Promover API y luego dashboard; contrastar la misma combinación con los dominios.
Reversa API dpl_9LEp6zxrXfMpP6TB2g7rFSqYAzqb; dashboard dpl_5PWgoZPTDFqtsy4CAcuvVXjjykFX.

En la comprobación inicial productiva había cero eventos EPCIS y un envío global;
no se crearon ejemplos en producción ni se forzó un vínculo de envío a Balmec.
El piloto conserva diez etiquetas activas y diez inactivas. Las lecturas NFC
existentes son evidencia separada; no se convierten a EPCIS por abrir este visor.

Pendiente: prueba con lector/gateway UHF concreto, enlaces interoperables SSCC/EPC
fuera del perfil GS1 acotado vigente, topología actual reconciliada y paginación
profunda. No anunciar compatibilidad física completa por disponer de este visor.
Referencia conceptual pública GS1: https://ref.gs1.org/epcis/ (modelo de eventos).
