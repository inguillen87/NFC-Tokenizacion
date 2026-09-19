# S3/S5 — Investigación paginada del recorrido del lote

Entrega: 2026.09.19-api-trace.2 / 2026.09.19-dashboard.22.
Base API: 514d3d578f8f6cd14386d6add56e2730d3b4ebf1.
Base dashboard: 757b3e71f00b6e844565e216dcc2f15b0650c5da.
Web conservada: e94720e2519c28f0b2ce32db67bd04be0255a093,
2026.09.19-web-consumer.1.

## Qué cierra del plan original

El expediente único ya estaba publicado como Recorrido del lote. Al iniciar esta
entrega se verificó esa versión directamente en Vercel y se evitó desarrollar
otro visor paralelo. El nuevo cierre permite investigar más allá de los primeros
50 movimientos y seguir una identidad declarada concreta a través del período.

Se reutilizan EPCIS, el registro GS1, custody_events y envíos existentes. No se
crea un almacén de movimientos ni un proceso que convierta TAP en declaraciones.
Las relaciones continúan siendo históricas: agrupar, observar, separar y transformar
no prueban contenido actual de un pallet, coordenadas o autenticidad de hardware.

## Operación y UX

La misma ruta /batches/[bid]/traceability dispone de anterior/siguiente, consulta
por período, fuente, GTIN, lote, serie y tipo de evento. Hasta 50 movimientos
combinados por página: EPCIS y custodia sólo cuando el actor puede leerla.
La búsqueda textual funciona únicamente sobre la página cargada y se anuncia como
tal. Los filtros de identidad y tipo consultan la base del período completo.

Seguir esta identidad usa GTIN/lote/serie exactos de una referencia autorizada del
lote. Se distinguen los campos vacíos exactos de los filtros vacíos que no limitan
una consulta. Las cantidades con unidad de medida conservan su naturaleza; 2.5 KGM
no se convierte en 2.5 etiquetas. Los filtros GS1 no se aplican falsamente a una
fila de custodia que no tenga ese identificador: esa consulta cambia a EPCIS.

Después de una búsqueda correcta los campos avanzados se pliegan, conservando
la selección visible, para acercar los resultados en celular. La cronología tiene
altura limitada, scroll propio y foco de teclado; el detalle conserva movimiento
reducido y foco al seleccionarlo. Se usan los colores y tokens del workbench actual.
No se sumó otra biblioteca visual, mapa ni pantalla comercial.

Un cambio de filtros retira resultado, selección y exportación antes de consultar.
Una página que falla no conserva resultados viejos como si fueran nuevos. Reintentar
usa la misma posición de lectura. Una revocación de permiso invalida el cursor;
una nueva consulta excluye la custodia y los envíos no autorizados. El selector
usa además el acceso confirmado por la respuesta, no sólo una capacidad de la UI.

## Contrato técnico y límites

El endpoint original /traceability y su contrato v1 quedan intactos. La vista usa
la nueva lectura /traceability/page con protocolo nexid.trace-page.v1. Es GET,
requiere sesión humana válida y batches:read; respeta la autoridad y límites de
logistics:read del flujo existente. API y BFF rechazan otra empresa antes de la
normalización de tenant. Actor, permisos y tenant_id alternativos no se aceptan.

Cada lectura de página usa un SELECT con CTEs, sin OFFSET, ensureSchema, mutación
ni consulta por cada fila. Se consideran 51 candidatos por fuente para decidir
continuación. El orden total es fecha, fuente y UUID; la posición conserva los
microsegundos de PostgreSQL. IDs iguales en EPCIS y custodia no se pisan en la UI.
Los eventos se relacionan por sus vínculos de identidad del mismo tenant/lote.
La respuesta reusa la proyección ya restringida, sin event_json libre, notas,
direcciones de personas, llaves, UID físico o valores de una URL SUN.

La primera lectura fija un corte de fecha de ingreso. Las páginas posteriores
y la vuelta a la primera lo conservan. Un evento de fecha declarada antigua pero
registrado después se consulta al reiniciar, no desplaza el recorrido existente.
Este corte NO es una transacción abierta ni un snapshot inmutable entre requests:
correcciones, eliminación o cambios de vínculos pueden afectar lecturas posteriores.
El cursor no es firmado ni es un permiso: sólo transporta posición/filtros y cada
petición se autoriza de nuevo; no confiere acceso a datos fuera del actor.

Cursor hasta 2048 caracteres, ventana de uso de cuatro horas y validación estricta
de empresa/lote/fechas/filtros/permiso/posición. Rango de 1 a 93 días UTC. Posiciones
de página limitadas a 10000; recorridos excepcionalmente grandes necesitan acotar
el período y no se presentan como historial ilimitado. Respuesta <=1 MiB; máximo
100 referencias por evento, con omisiones explícitas. No se incorpora paginación
de envíos: esa sección conserva hasta 20 actualizados recientemente, se refiere
al lote completo y se etiqueta como estado actual, no a la identidad filtrada.

## Evidencia exportada

HTML autónomo y JSON de la página recibida, con número de página, filtros, corte,
fecha de consulta y advertencia de alcance. No se exportan tokens de navegación.
El SHA-256 corresponde al objeto data del JSON; no es una firma digital o evidencia
blockchain. Todo contenido comercial se escapa. HTML sin scripts, imágenes o red.
Buscar texto o seleccionar una fila no cambia qué se exporta: se descarga la página
completa cargada dentro de sus límites. Descargar no genera una consulta adicional.

## Pruebas ejecutadas

15 escenarios con PostgreSQL real local y el handler real de lectura. Cinco páginas
con más de 200 eventos sintéticos, microsegundos, fechas y UUID iguales entre fuentes;
ningún ID omitido o duplicado en ese conjunto estable. Volver a páginas, corte de
registro, evento anterior ingresado después, filtros de identidad fuera de la primera
página, calificadores exactos vacíos, relaciones/correcciones, restricción logística,
revocación, tenant ajeno, cursor malformado/expirado, errores de fuente y conservación
del estado de lotes y tags. Las identidades se registraron con los servicios GS1
existentes; las sesiones y eventos del ensayo son fixtures. No es una captura UHF
real, ni se afirma haber probado físicamente un nuevo rollo o lector.

Seis nuevas pruebas de política/API y ocho nuevas de contrato/interfaz verifican
validación, autorización, límites, proyección, posición microsegundo y exportación.
TypeScript y suite completa de dashboard: 903 pruebas, 901 aprobadas, cero fallidas
y dos omitidas. Los resultados de build se verifican antes de la publicación.

Ocho comprobaciones integradas Next/React/BFF+PostgreSQL local: buscar/seleccionar
sin red, páginas, filtro de identidad, seguir referencia, HTML/JSON con digest,
recuperación de fuente, cambio de permisos y ausencia de mutaciones de negocio.
Se capturó la respuesta real del BFF antes de entregarla al navegador para no perder
su cuerpo por la carrera del protocolo de depuración; no se sustituyeron respuestas
por fixtures. Cuatro variantes 1440/390 y claro/oscuro, sin incidencias axe en la
superficie evaluada. Esto no equivale a certificación WCAG completa.

## Producción y pendientes

No necesita migración, plan de pago, servicio nuevo o cambios de SDK. Se conserva
la web del consumidor, etiquetas QR/GS1, SUN/SDM/TTStatus, Polygon/IOTA, campañas y
el circuito de retiros. No se tocaron permisos de usuarios productivos.
La consulta inicial confirmó cero eventos EPCIS y de custodia en producción;
Balmec mantuvo diez tags activos, diez inactivos y el hash de configuración
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
No se cargan movimientos supuestos para llenar esta vista.

Quedan independientes los cierres de lector/gateway UHF físico, SSCC/EPC fuera
del perfil GS1 soportado, topología actual reconciliada, exportación multipágina
y pruebas de carga a volúmenes de clientes. Este sprint cierra navegación y búsqueda
de la evidencia ya registrada, no esas integraciones de hardware.
Rollback base API dpl_D46RvBTcasFiRDfeLCB6PaRfaFMm;
dashboard dpl_Hn95zucM6jputH6R2vzL37Qy3hgM. Promover API compatible primero.

Cierre de gates previo al commit: ambos builds completos y los gates de secretos
pasaron. El build de API incluye todas sus suites previas más trace-page.
Dependencias y package-lock sin cambios; no se modificó la aplicación pública.
