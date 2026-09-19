# S4 Passport Studio — cierre publicado el 19/09/2026

## Artefactos comprobados

Dashboard 2026.09.19-dashboard.25:
6e1575b30c897bb788cac25586b47850cc7708af,
dpl_GiA68JA9wLJwrtnKGuDEQoevLtVP en app.nexid.lat.
API conservada 2026.09.19-api-intake.2:
5631b475c77fa5469191a0ce0ea5545f8bbb00ce,
dpl_6vrnMdc1LhCbp2hRuVD5bsYDAKBy en api.nexid.lat.
Web conservada 2026.09.19-web-consumer.1:
e94720e2519c28f0b2ce32db67bd04be0255a093,
dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg en nexid.lat.

El candidato se construyó desde un commit limpio, gitDirty=0 y proyecto confirmado.
Se verificaron las versiones base antes de promover para no sobrescribir otro
release concurrente. Sólo se desplegó la aplicación dashboard. El alias productivo
se confirmó después de promover y nuevamente junto con API y web al finalizar.

## Cierre funcional

La comparación borrador/publicado ya existía. Se amplía a documentos guardados,
trabajo local y revisiones históricas cargadas, con origen explícito y filtros de
campos añadidos, modificados o retirados. Comparar y filtrar no genera escrituras
ni nuevas lecturas de datos. El trabajo en la pestaña permanece separado de lo
persistido. No se descargan los archivos referenciados por una URL.

El historial ofrece comparar sin restaurar. Restaurar presenta qué reemplazaría
el trabajo local y exige confirmar; ni ese paso ni cancelar modifican el pasaporte
público. Enviar, aprobar y publicar muestran un resumen de cambios guardados.
Se preservan las autorizaciones y aprobación independiente del servicio original.

Se conecta el botón de recarga que faltaba en el conflicto editorial. Dos pestañas
con la misma revisión demostraron conflicto real: los cambios locales se mantienen
hasta aceptar expresamente su descarte; entonces se vuelve a leer el servidor.
Escape reinicia el resultado del diálogo y no reutiliza una confirmación anterior.
El comparador también tolera indicaciones locales todavía inválidas sin ocultarlas
ni truncarlas: se deben corregir antes de las operaciones que lo exigen.

La vista de comparación aprovecha más ancho de trabajo y se apila en móvil;
filtros, foco, claro/oscuro y movimiento reducido se conservaron. El encabezado
general identifica la tarea Passport Studio, no la cabecera genérica NFC.

## Pruebas y límites

931 pruebas de dashboard: 929 aprobadas, cero fallidas y dos omitidas. TypeScript,
build local, build remoto y control de secretos aprobados. Trece casos nuevos
cubren comparación, fuentes, metadatos, listas y recuperación. Dependencias y
lockfile no se modifican.

Ocho comprobaciones integradas usaron Next/React/BFF y el servicio editorial real
sobre PostgreSQL local, con sesiones y contenido sintéticos. Se ejercitaron
comparación, historial, guardado, revisión independiente, publicación, restauración,
conflicto entre pestañas y cuentas de consulta. Cuatro variantes 1440/390 en claro
y oscuro no tuvieron hallazgos axe en la superficie evaluada. La regresión anterior
del presenter pasó cuatro pantallas y ocho escenarios con respuestas volátiles;
esos ensayos no se presentan como persistencia real ni certificación WCAG.

Seis comprobaciones públicas de navegador posteriores a la publicación pasaron.
El marcador público confirmó .25. En el candidato, la ruta privada sin sesión
redirigió al login sin renderizar Studio. No se realizó una publicación editorial
productiva con la cuenta del titular ni se da por certificado ese recorrido privado.
La aceptación funcional completa corresponde a las pruebas locales descritas.

Antes y después, la base mantuvo cero heads/historial editorial y migración 0111.
Balmec sigue con diez etiquetas activas, diez inactivas y la misma configuración:
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
La integración Neon continúa en Free/free_v3. No se modificaron planes, API, esquema,
SUN/SDM, TTStatus, claves, contadores, GS1/QR, EPCIS, Polygon/IOTA ni portal público.
No se inscribió ningún lote en Studio para fabricar una demostración.

Acceso: Lotes -> Pasaporte -> Passport Studio -> Cambios / Historial. Los lotes
que todavía no usan Studio conservan su pantalla de incorporación explícita.
Las revisiones que pueden compararse son las entregadas por el historial actual,
no una consulta ilimitada de todas las publicaciones. Idiomas paralelos, campos
avanzados de vino y validación del contenido de documentos externos quedan fuera.

Reversa base dashboard: dpl_BwWhUCFBUwrWbn25Smpr9z5aGZ9f. La reversión de interfaz
no implica eliminar datos editoriales persistidos por los usuarios.
