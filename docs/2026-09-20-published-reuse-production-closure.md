# S4 — Reutilización de contenido: cierre publicado el 20/09/2026

## Artefactos productivos confirmados

API 2026.09.20-api-library.1:
551fd24cc5cdd744d73c9a11f0b30a16071f82fa,
dpl_GSaR5WmYab6AHfQbTQiYcYkVV8Xh en api.nexid.lat.
Dashboard 2026.09.20-dashboard.27:
14d62ca9a67e07f20eb939e79af32cc5f7d106c2,
dpl_5TuNRtFqgjytpDXGUh1vceCE9Vfi en app.nexid.lat.
Web conservada 2026.09.19-web-consumer.1:
e94720e2519c28f0b2ce32db67bd04be0255a093,
dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg en nexid.lat.

Se construyeron API y dashboard desde commits limpios, proyectos correctos y
metadata gitDirty=0. Ambos builds remotos terminaron READY. Se comparó el alias
previo antes de cada promoción para no sobreescribir otras publicaciones.
Se promovió API primero y luego dashboard. Los tres dominios se verificaron al
finalizar, con la web pública sin modificaciones.

## Operación visible

Passport Studio -> Reutilizar contenido, dentro de un borrador editable.
La biblioteca busca publicaciones de otros lotes de la misma empresa, plantilla
e idioma. Seleccionar muestra valores antes/después y no marca campos por defecto.
Al cambiar de fuente o cancelar se conservan los cambios locales del destino.

Antes de aplicar, vuelve a consultar la versión publicada y la revisión destino.
Si esa comprobación detecta cambios o pérdida de autorización, no modifica el
borrador. Aplicar prepara sólo campos locales seleccionados. Guardar utiliza el
circuito durable anterior y añade la referencia declarada por el editor a la
última reutilización. La aprobación del origen no se transfiere al nuevo lote.
El origen tampoco queda sincronizado automáticamente con el destino.

Se excluyen SKU, GTIN, lote comercial, producción/vencimiento, distribuidor,
canal, avisos de retiro y URL de beneficios. No se alteran chip, claves, contador,
precinto ni configuración SUN. Los enlaces de documentos son referencias, no
archivos descargados, validados o certificados. No se implementó un maestro con
propagación automática ni una reutilización masiva de lotes.

La UX tiene selección explícita, comparación por campo, claro/oscuro y diseño
móvil apilado. Después de elegir la publicación, la búsqueda se pliega para dar
prioridad al antes/después. El pie conserva cantidad elegida, cancelar y aplicar.
Escape devuelve el foco sin guardar. No se consulta al escribir ni marcar campos.

## Pruebas ejecutadas

11 escenarios sobre PostgreSQL real local, cinco pruebas nuevas de API y diez
de interfaz. Los builds completos, TypeScript y controles de secretos pasaron.
Suite completa dashboard: 948 pruebas, 946 aprobadas, cero fallidas y dos omitidas.
Las migraciones y los archivos de dependencias/lockfile no cambian.

Siete recorridos integrados Next/React/BFF con el handler y PostgreSQL reales
locales verificaron selección, cancelación, preparación, guardado con respuesta
perdida, publicación nueva, edición concurrente y denegaciones. El reintento del
guardado confirmó una sola revisión. Los datos y las sesiones fueron sintéticos;
no se publicaron pasaportes ni se reutilizó contenido de clientes en producción.
Cuatro variantes visuales 1440/390 claro/oscuro pasaron sin hallazgos axe en el
diálogo evaluado. La regresión original de Studio pasó cuatro pantallas y ocho
escenarios con respuestas volátiles. No constituye una certificación WCAG completa.

## Comprobaciones posteriores

El API por el dominio productivo respondió health 200, SUN sin parámetros 400 y
release.json 200 con la versión nueva. La biblioteca sin sesión respondió 401.
El marcador del dashboard confirmó .27 y seis pruebas públicas de navegador pasaron.
En staging, la UI privada redirigió al login sin renderizar contenido del editor.

La API directa de staging respondió health 200 pero su origin guard negó otras
rutas con 403 origin_not_allowed. Es la protección previa del proyecto; no se
cambió ni se eludió. Su marcador se verificó por el dominio productivo después
de promover, donde el recorrido normal autorizado por la infraestructura funcionó.

La prueba de lectura privada en el Chrome del titular quedó sin confirmar: el
canal de depuración rechazó la conexión con 403 antes de abrir la página. No es
un rechazo de NexID ni una publicación productiva probada con esa cuenta. No se
alteró la sesión, no se inscribió el piloto y no se modificó el navegador.

Antes y después la base conservó cero heads e historial editorial, migración máxima
20260919200000_0111_epcis_operator_intake.sql y Balmec con diez etiquetas activas,
diez inactivas y el mismo hash de configuración:
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
La integración de Vercel informó Neon Free/free_v3 al finalizar.

Para probar la biblioteca funcional se necesita publicar un origen compatible en
otro lote e iniciar un borrador destino con la autoridad correspondiente. Balmec
no se inscribió automáticamente ni recibió publicaciones ficticias. La aplicación
muestra el estado vacío real mientras no existan esas fuentes.

Sin migración ni servicios nuevos. Se conservan el motor editorial, bandeja,
portal, SUN, TTStatus, QR/GS1, EPCIS, SDK, retiros y Polygon/IOTA. No se activaron
mensajes, transacciones blockchain, procesos periódicos ni cargos automáticos.

Reversa previa API: dpl_2r74bN5mjPumPkotVV94Qenc21mw.
Reversa previa dashboard: dpl_Ek7mJ8ByPukG9buB4dfrGqJYTP7A.
El documento identifica las revisiones de runtime; su registro posterior en GitHub
no requiere reconstruir ni volver a desplegar las aplicaciones.
