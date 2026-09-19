# S4/S5 — Preparación de etiquetas QR y GS1 por archivo

Fecha: 19/09/2026. API: 2026.09.19-api-labels.1. Dashboard: 2026.09.19-dashboard.20.
Base API c27ab01f6716e312c001317618f8ac705f486817; dashboard d7025b862fb1aed77b3e56e58d79212617c1ba4c.
La web 2026.09.19-web-consumer.1 (e94720e2519c28f0b2ce32db67bd04be0255a093) permanece sin cambios.

## Relación con el plan original

El objetivo es que la empresa configure y opere sin pedir carga manual de cada
identidad al superadministrador. Se reutilizan el registro GS1, las autorizaciones
de prefijo, los canales del lote, las políticas, la auditoría y el resolver actuales.
No se crea otro registro de productos, marketplace, SDK o servicio blockchain.
Este incremento implementa el paso B de la ampliación multicarrier: carga acotada
por archivo, errores por fila y salida de impresión. No cierra certificación de
impresora/lector, fabricación de un rollo entero ni reserva de intervalos futuros.

## Recorrido de la empresa

/batches -> Enlaces QR / estado NFC -> Abrir producción QR / GS1.
Ruta operativa: /batches/[bid]/production con el tenant existente.
La entrada nueva se muestra sólo para un canal QR o GS1, conservando la configuración
individual previa. Un lote TagTamper no habilita conversión a códigos estáticos.

GS1: descargar plantilla CSV vacía, cargar o pegar gtin/lot/serial, revisar errores
locales, validar con el registro, revisar nuevos/existentes/bloqueados y confirmar
con una referencia. Son hasta 100 identidades y 64 KiB por archivo. La validación
local no escribe ni consulta Neon. Se preservan ceros iniciales; GTIN siempre es texto.
El cliente aporta un GTIN y prefijo previamente autorizado: el sistema no inventa
licencias o asignaciones GS1. Lote y serie son opcionales dentro del perfil acotado.

Si existe un error, conflicto, duplicado de archivo o falta autorización no se
registra ninguna fila nueva. Una identidad existente sólo se reutiliza si conserva
el mismo lote, tenant, estado, autorización, nombre y metadata compatibles; no se
sobrescribe ni reasigna a otra empresa. Cada alta real deja la auditoría existente.

El comprobante persistido permite recuperar las últimas diez importaciones del
lote tras recargar y preparar otra impresión sin volver a crear las identidades.
No equivale a paginación ilimitada ni a una segunda aprobación editorial.

## Consistencia real

Migración aditiva 20260919180000_0110_gs1_batch_import.sql: tabla acotada por operación,
índice de consulta y dos funciones. No actualiza filas existentes de lote o tag.
La vista previa se vincula por digest al archivo normalizado, alcance, estado,
autorizaciones, información de producto e identidades existentes.
La confirmación bloquea el alcance, autorizaciones e identidades y revalida el
plan antes de insertar. Identidades nuevas, auditoría y comprobante son una sola
transacción. Conflictos concurrentes o fallos de auditoría/comprobante revierten
el archivo completo. No se devuelve un éxito parcial como importación completa.

La clave de operación pertenece a actor/tenant/lote. Ante respuesta perdida, se
conservan los mismos parámetros e identificador para reconciliar. Una repetición
idéntica obtiene el recibo original; otra carga con el mismo ID se rechaza.
Reabrir un recibo histórico no significa que todas sus etiquetas sigan habilitadas:
la impresión consulta nuevamente el estado y las autorizaciones actuales.

No hay borrado automático de recibos ni cuota monetaria nueva. El límite de 100
es por operación, no un límite de gasto total de la cuenta. No se agregó polling.

## Paquete para imprenta

QR básico: entre 1 y 100 copias del enlace registrado del lote. Se advierte que
no son 100 unidades serializadas y no se crean registros ficticios por cada copia.
GS1: selección obtenida del comprobante y revalidada contra el registro vigente.
Identidades suspendidas/retiradas, ajenas, sin autorización o en un canal desactivado
impiden generar el paquete. No se admiten URLs arbitrarias ni payloads SUN copiados.

Salida: plancha HTML autónoma con SVG, CSV de datos y manifiesto JSON ordenado.
El HTML no ejecuta scripts ni carga recursos externos; producto y códigos se escapan.
La UI verifica su SHA-256 antes de ofrecer la descarga. El SVG se genera con qrcode,
dependencia existente, margen de cuatro módulos y corrección M. No se añadieron
librerías. La plancha incluye referencia de empresa/lote, fecha y número de fila.
CSV neutraliza celdas que comienzan con operadores de fórmulas; el manifiesto JSON
conserva los identificadores originales para intercambio exacto. El GTIN se debe
importar como texto en programas que convierten automáticamente números.

La descarga no escanea el producto, activa etiquetas, concede propiedad o aprueba
QA. El operador debe imprimir una muestra y verificar lector, tamaño, contraste,
material y colocación. El formato A4 de referencia no es plantilla de toda impresora
industrial ni conformidad GS1 para punto de venta. No se afirma lectura física.
La referencia pública GS1 distingue URI Syntax, resolver y compresión EPC; se
conserva esa separación: https://ref.gs1.org/standards/digital-link/

## Interfaz y controles

Tres etapas: preparar, registrar e imprimir. Carga por archivo, arrastre o pegado;
tabla por fila, confirmación explícita, bloqueos comprensibles, recuperación del
intento, historial y vista previa de la primera etiqueta. Modo claro/oscuro,
adaptación móvil, foco visible y movimiento reducido. La tabla mantiene scroll
propio; no fuerza desbordamiento de toda la página.
Un fallo al generar otra plancha retira la anterior: no se la ofrece como estado
actual. El paquete descargado es una instantánea, no un permiso perpetuo de impresión.

El BFF exige batches:read para consulta y preparación, y batch.product.configure
para confirmar. La API reutiliza la autoridad del canal y sus denegaciones GS1.
Las credenciales, actor y empresa no se aceptan desde el archivo. No se modificaron
roles o usuarios. Un usuario lector puede revisar o imprimir lo autorizado, no importar.

## Evidencia local

20 escenarios sobre PostgreSQL real local usando los handlers de la aplicación:
validación de 100 filas; rechazo de entradas y roles; seis confirmaciones simultáneas;
reintento, conflicto de payload, nuevos/existentes, cambios de ficha y revocación de
prefijo; fallos inyectados a mitad de auditoría y al escribir comprobante; historial;
impresión GS1/QR; TagTamper protegido; selección inválida; dos archivos solapados;
registro e impresión de 100 identidades; escape de contenido comercial; configuración
original conservada. Los datos y la resolución de sesiones fueron fixtures locales.

Diez comprobaciones integradas con Next/React/BFF real y PostgreSQL local pasaron:
CSV inválido, preview sin escrituras, respuesta perdida después del commit,
recuperación, plancha/CSV/manifiesto, recarga e historial, fuente caída, QR de lote,
consulta sin escritura y resolución de todas las URIs impresas al lote previsto.
Cuatro variantes visuales (1440/390, claro/oscuro) no reportaron incidencias axe en
la superficie evaluada. No es certificación WCAG ni una nueva prueba NFC física.
Se renderizó la plancha descargada y se comprobaron tres códigos sin solicitudes
externas; no se utilizó una impresora física o un escáner de fábrica.

Dashboard: 886 pruebas, 884 aprobadas, cero fallidas y dos omitidas; TypeScript y
build aprobados. API: seis pruebas nuevas más toda su cadena de regresiones y build.
Gates de secretos aprobados. Dependencias y lockfile sin cambios.

## Despliegue y reversa

Aplicar la migración aditiva probada, verificar hashes de funciones, promover API
compatible y después dashboard. Conservar la web y el verificador de TAP actual.
Reversa API previa: dpl_EF7fbwNt2JVZuPXFpGLrUjL1Jcw3.
Reversa dashboard previa: dpl_CvrjWucm6Qop7PTe6WbR9KpkRMbs.
Una reversa no debe borrar identidades, comprobantes, auditoría ni la migración.
Los registros creados son compatibles con las rutas GS1 previas.
