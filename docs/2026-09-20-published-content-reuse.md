# S4 — Reutilización selectiva de contenido publicado

Entrega prevista: API 2026.09.20-api-library.1 / dashboard 2026.09.20-dashboard.27.
Base API: 19200f5dd466cb70420faeb72618ad2e26e236f3.
Base dashboard: fb3fec4dd00f7a31bfd17f460eff80e74b595c99.
Web conservada: e94720e2519c28f0b2ce32db67bd04be0255a093.

## Circuito implementado

Dentro de un borrador editable de Passport Studio, Reutilizar contenido busca
publicaciones de otros lotes de la misma empresa, plantilla e idioma. No se
ofrecen contenido inicial v0, borradores ni aprobaciones sin publicar. Se muestran
hasta 20 resultados; si hay más, se debe afinar la búsqueda.

Se comparan los valores antes/después y se eligen campos explícitamente, sin
preselección. No se copian valores vacíos. Se conservan los campos no elegidos y
los cambios locales que el editor ya tenía. Tras seleccionar la fuente se pliega
la búsqueda para acercar las diferencias en móvil. Se mantienen teclado, foco,
claro/oscuro y movimiento reducido.

Quedan excluidos SKU, GTIN, lote comercial, fechas, distribuidor, canal autorizado,
avisos de retiro y URL de beneficios. No se copian configuración NFC, claves,
contadores, precinto, roles, propiedad ni aprobaciones. Las URLs sólo se copian
como referencias declaradas; no se descargan ni certifican archivos externos.

Antes de aplicar, se releen la publicación elegida y la revisión del destino.
Si cambian versión, digest, permisos o alcance, no se altera el trabajo local.
Aplicar prepara campos en la pestaña; no guarda ni publica. El destino conserva
su propia revisión independiente. Un nuevo borrador de origen no sustituye su
publicación y los cambios posteriores del origen no se propagan.

El guardado existente conserva revisión, transacción, recibo e idempotencia.
Se añade una nota con la última reutilización declarada por el editor: ID de lote,
versión, digest y cantidad de campos. No es aprobación transferida, firma digital
ni una relación de sincronización entre lotes. La referencia no certifica que todo
el documento final proceda de esa única fuente si el editor hace otros cambios.

## Implementación y preservación

GET /admin/batches/[bid]/passport-library requiere sesión humana, batches:read y
batch.product.configure. API y BFF rechazan un tenant ajeno. El lote destino fija
la empresa de las fuentes incluso con administrador global. Un BID ambiguo no
elige otra empresa silenciosamente. Cada lectura es un SELECT acotado, sin polling.

Sólo se devuelve contenido editorial permitido. No se añaden rutas de escritura,
migraciones, dependencias, proveedor ni gasto automático. Continúan intactos el
motor editorial, la bandeja, SUN/SDM, QR/GS1, SDK, EPCIS, retiros y portal público.
El trabajo ayuda al paso producto-lote del plan S4; no implementa todavía una
entidad maestra con propagación automática ni reutilización masiva.

## Evidencia de pruebas

11 escenarios con PostgreSQL real local y el handler nuevo: publicaciones por
empresa/plantilla/idioma, proyección sin configuración física, versión posterior,
v0 y aprobados sin publicar excluidos, permisos, búsqueda, digest alterado, estado
inactivo y fuente caída. La configuración de destino no cambia con las lecturas.
Las publicaciones de ensayo usaron el motor editorial real y actores sintéticos.

Cinco pruebas nuevas de API y diez de interfaz. TypeScript y builds completos de
API/dashboard, con los controles de secretos aprobados. Dashboard: 948 pruebas,
946 aprobadas, cero fallidas y dos omitidas. Dependencias y lockfile sin cambios.

Siete recorridos integrados Next/React/BFF y PostgreSQL local: selección, cancelación
con trabajo previo, aplicación local, guardado con respuesta perdida y reintento
sin duplicar revisión, cambio de publicación, edición concurrente y denegaciones.
Cuatro variantes visuales 1440/390 claro/oscuro, sin hallazgos axe en el diálogo.
La regresión anterior de Studio pasó cuatro superficies y ocho escenarios con
respuestas volátiles; no se confunde con la prueba persistente ni certificación WCAG.

La comprobación productiva previa mostró cero heads/historial editorial, migración
máxima 0111 y Balmec con 10 etiquetas activas, 10 inactivas y configuración intacta.
No se publicaron fuentes ficticias: la biblioteca estará vacía hasta que la empresa
publique otro lote compatible. Validación de documentos, vigencias, traducciones,
propagación de cambios e integración de lectores siguen siendo cierres separados.
