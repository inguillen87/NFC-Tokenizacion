# S4 — Passport Studio: comparación editorial y recuperación segura

Entrega de interfaz: 2026.09.19-dashboard.25.
Base dashboard: 375d5d2e15135dc62c95d0493dfbd7042b809072 (dashboard.24).
API conservada: 5631b475c77fa5469191a0ce0ea5545f8bbb00ce,
2026.09.19-api-intake.2, dpl_6vrnMdc1LhCbp2hRuVD5bsYDAKBy.
Web conservada: e94720e2519c28f0b2ce32db67bd04be0255a093,
2026.09.19-web-consumer.1, dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg.

## Correspondencia con el plan original

El tramo S4 ya tenía guardado, revisión independiente, publicación, restauración
local de contenido e historial persistido. También tenía una comparación del
trabajo actual con lo publicado. No se anuncia ese circuito como recién construido.
Este cierre amplía su utilidad para revisar fuentes históricas y entender el efecto
de una recuperación sin modificar inmediatamente el borrador.

La sección Cambios permite elegir contenido público recibido, documento guardado
en servidor, trabajo local o una de las revisiones históricas entregadas. No se
consulta otro repositorio ni se afirma disponer del historial completo: la API
actual entrega hasta diez movimientos recientes; el DTO admite como máximo veinte.
Las revisiones rN no se presentan como versiones publicadas vN. El contenido inicial
v0 mantiene su etiqueta sin revisión. Una ausencia de versión no se rellena con datos.

## Comparación y decisiones

Se distinguen campos añadidos, modificados y retirados. Los filtros por sección,
tipo y texto operan sobre la comparación ya cargada y no consultan Neon. Se pueden
intercambiar los dos documentos manteniendo la dirección de los cambios explícita.
La edición local se conserva al cambiar de fuente o sección.

Se comparan campos del contrato editorial, plantilla e idioma. Las copias agro de
identidad no duplican el conteo cuando están sincronizadas; una inconsistencia se
muestra por separado. Las listas conservan orden y saltos de línea. Una URL nueva
sólo prueba que cambió el enlace declarado, no el contenido, vigencia o seguridad
del recurso. El comparador no descarga documentos ni imágenes.

El documento recibido del servidor mantiene su validación estricta. El formulario
local puede contener indicaciones todavía inválidas: se comparan sus campos ya
controlados sin truncarlos ni colapsar la UI. La validación y los permisos de guardar,
aprobar y publicar siguen siendo los originales. No se admiten nuevos campos en API.

Cada movimiento de Historial tiene Comparar con el trabajo actual, sin restaurar
ni guardar. Usar contenido en el borrador abre primero un resumen de lo que se
reemplazaría respecto al trabajo local. Cancelar conserva el formulario. Confirmar
sólo modifica la preparación local; guardar y la nueva revisión siguen separados.
No se restaura contenido de otra plantilla o idioma en el borrador actual.

Enviar a revisión, aprobar y publicar muestran un resumen del documento guardado
respecto al contenido público. Ese resumen no sustituye revisión independiente,
expectedRevision, digest de contenido ni comprobante durable de la operación.

## Correcciones del flujo existente

Se encontró un botón Releer versión guardada mostrado en conflicto sin una rama
que procesara su clic. Ahora abre confirmación: cancelar conserva el trabajo local;
confirmar lo descarta deliberadamente y recarga la versión del servidor. No aplica
un merge automático, no fuerza guardar y no sobrescribe otra revisión.

Se reinicia returnValue al abrir las confirmaciones y al cancelar con Escape.
Esto impide que una confirmación anterior se interprete como respuesta afirmativa
al cerrar otro diálogo. La prueba abre Enviar a revisión después de guardar,
pulsa Escape y comprueba que no se ejecuta ninguna mutación adicional.

## UX/UI

La comparación ocupa el espacio de trabajo sin competir con la previsualización
móvil. Los selectores conservan el foco al cambiar documentos, las diferencias tienen
etiquetas además de color, y las columnas pasan a una lectura vertical en móvil.
Se conserva el acceso a la vista previa original. Los filtros no recrean el campo
de búsqueda al escribir, y el mensaje vacío distingue sin diferencias de sin
coincidencias del filtro. Claro/oscuro, movimiento reducido, contraste y foco se
incluyen en las pruebas. El encabezado del dashboard identifica Passport Studio
en lugar de mostrar la cabecera genérica de verificación NFC.

## Pruebas

Trece pruebas nuevas del comparador: tipos de cambio, metadatos, aliases, listas,
fuentes, ausencia de publicación, historia duplicada, filtros, inmutabilidad de
entradas, campos técnicos inesperados, diálogo y formulario local incompleto.

Ocho comprobaciones integradas con Next/React/BFF y el servicio editorial real,
sobre PostgreSQL efímero local: comparación sin escritura, corrección de datos
locales, Escape, revisión independiente, publicación, historial, restauración y
conflicto real entre pestañas. La prueba produjo ocho movimientos editoriales
locales y comprobó que comparación/restauración local no alteraran lo publicado.
Los campos técnicos sintéticos se conservaron. Las sesiones eran un adaptador
local explícito, no cuentas o contenido de clientes productivos.

La instalación local de las migraciones originales 0104/0105 normaliza CRLF a LF
antes de ejecutarlas; sus guardas de hash no se alteraron. El primer arranque del
fixture rechazó correctamente un cuerpo con otra representación de saltos de línea.
No se modificaron las migraciones ni se aplicaron a producción.

Cuatro superficies integradas 1440/390 claro/oscuro no tuvieron hallazgos axe. La
regresión original del presenter también pasó cuatro pantallas y ocho escenarios
con respuestas volátiles: esos casos no se confunden con la prueba persistente.
La revisión visual se hizo sobre las pantallas renderizadas. No equivale a una
certificación WCAG completa ni a una prueba física NFC.

## Preservación

Sólo cambia el dashboard y sus pruebas/documentación. No cambia API, BFF, sesiones,
permisos, schema editorial, SUN/SDM, TTStatus, claves, contadores, NFC/QR/GS1,
Polygon/IOTA, campaña, motor EPCIS, portal del consumidor ni proveedor.
No se agrega dependencia, polling o trabajo de backend para alimentar el comparador.
La entrada del lote a Studio sigue siendo opt-in; no se inscribe Balmec al desplegar.

La comprobación productiva inicial mostró cero heads/historial editorial,
migración 0111 y Balmec intacto: diez activas, diez inactivas, configuración
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
Esto no afirma que un cliente haya publicado una revisión con la nueva pantalla.

Reversa base dashboard: dpl_BwWhUCFBUwrWbn25Smpr9z5aGZ9f.
Una reversión de interfaz no debe borrar revisiones editoriales ya persistidas.
Pendientes independientes: editor avanzado de vino, idiomas paralelos del producto,
repositorio privado de documentos, vigencias verificadas y políticas de aprobación
configurables. No se completan mediante esta comparación de fuentes ya existentes.

Gates finales: TypeScript, build y control de secretos aprobados. Suite completa
de dashboard: 931 pruebas, 929 aprobadas, cero fallidas y dos omitidas.
Dependencias y lockfile no cambian. Se desplegará únicamente esta interfaz.
