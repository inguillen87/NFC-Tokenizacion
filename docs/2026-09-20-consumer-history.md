# S3 — Historial personal de lecturas: navegación y recuperación

API base: 551fd24cc5cdd744d73c9a11f0b30a16071f82fa / api-library.1.
Web base: e94720e2519c28f0b2ce32db67bd04be0255a093 / web-consumer.1.
Entrega: 2026.09.20-api-consumer-history.1 y 2026.09.20-web-history.1.
Dashboard .27 conservado, sin cambios editoriales o administrativos.

## Circuito cerrado

La página existente /me/taps permite navegar por el historial asociado a la cuenta
más allá de la selección fija anterior de 200 registros. Devuelve 25 por página,
con anterior/siguiente y continuación al final. Filtros de empresa, referencia
exacta y fechas consultan los registros del consumidor autenticado, nunca todas
las lecturas de una empresa. El ID bigint conserva sus dígitos como texto.

La búsqueda textual funciona sólo en la página cargada y se anuncia como tal.
Cambiar la presentación entre UTC y hora del dispositivo o copiar la referencia
no consulta la base. Abrir el registro usa el detalle privado existente, no vuelve
a enviar la URL SUN ni ejecuta otra validación física del chip.

El tiempo del historial es consumer_tap_history.created_at: momento en que se
asoció la lectura a la cuenta. Puede ser posterior al TAP. La nueva pantalla lo
rotula como Guardada; no lo declara como instante exacto de lectura NFC. Los nombres
del producto provienen sólo de la colección de ese consumidor y de una referencia
first/latest inequívoca al evento y tenant. Si existen dos asociaciones candidatas,
no se elige un producto arbitrario. Se oculta el nombre legacy basado en UID.

## UX/UI

En celular se evita duplicar el encabezado y el formulario se pliega después de
una consulta correcta. El resultado queda arriba y el resumen de filtros continúa
visible. Se conservan los accesos al inicio, colección y detalle de cada lectura.
Se distinguen enlace informativo, lectura reportada y resultado no confirmado;
la señal de riesgo guardada no se recalcula como una evaluación nueva.

Claro/oscuro, etiquetas además de color, foco de teclado al cambiar página,
transiciones con movimiento reducido y recuperación manual tras error. Una
respuesta fallida retira filas anteriores; reintentar conserva la posición. Una
sesión vencida retira las filas y las empresas y ofrece el login de consumidor.
No se modifica sesión, contraseña, consentimiento ni permiso de contacto.

## Implementación y límites

Se conserva GET /consumer/taps para los clientes previos. Nuevo GET
/consumer/taps/history con sesión de consumidor original, validación de cuenta
activa y un SELECT acotado de datos. No hay inicialización de schema adicional en
el nuevo lector; el servicio de autenticación conserva su comportamiento normal.
No se usan credenciales administrativas para autorizar la colección personal.

La ruta web dedicada preserva explícitamente los filtros al reenviar la petición,
con timeout, cuerpo acotado y private/no-store. El proxy genérico anterior no
enviaba los query parameters; no se cambió su conducta para otros módulos.
Campos actorId, consumerId, parámetros repetidos y desconocidos se rechazan.

El cursor tiene cuenta, filtros, corte de creación y posición (fecha en
microsegundos + ID del registro). No es un token de autoridad: cada lectura
vuelve a autenticar y acota por consumer_id. Cuatro horas de vigencia y 10000
páginas máximas; ventanas fechadas de hasta 366 días, o ambas fechas vacías para
navegar el historial disponible. La lista de empresas se limita a 50, con aviso.
No se prometen totales ni retención infinita.

El corte evita desplazar la navegación por nuevos registros guardados después.
No es un snapshot inmutable: correcciones o eliminaciones pueden afectar páginas
posteriores. Cada respuesta está acotada a 128 KiB y no expone emails, teléfonos,
UID, notas internas, parámetros SUN ni datos de otras personas. Los estados de
sesión ya implementados y su mantenimiento no se sustituyen.

## Pruebas

13 escenarios con PostgreSQL real local y el handler de lectura real: 237 registros
en diez páginas, microsegundos y empates, consulta exacta fuera de los primeros
200, retorno a página previa, corte, tenant, cuenta ajena, datos privados, nombres
ambiguos, validación, cuenta eliminada y fuente caída. El adaptador de autenticación
es sintético y explícito en estos ensayos, no una cuenta productiva.

Tres pruebas nuevas de API. Se mantienen los tests originales del modelo de
lecturas y se actualizan las pruebas de página que antes exigían una muestra
fija de 200. Doce pruebas nuevas cubren el contrato paginado y la interfaz real:
autenticación antes de lectura, errores, enlaces privados, precisión, tiempo,
clasificación conservada, HTML escapado, proxy y estados. Suite web: 588 pruebas,
cero fallidas y cero omitidas. Los builds API/web y gates de secretos pasaron.

Ocho comprobaciones integradas Next/React/BFF con PostgreSQL real, incluyendo
fecha de guardado, paginación, búsqueda exacta, copia, hora local, fuente caída,
reintento, sesión vencida y cuenta vacía. Cuatro casos visuales 1440/390 claro/oscuro
sin hallazgos axe en la superficie. Se corrigió contraste de enlaces durante
cambios de tema y se verificaron las capturas finales. No es certificación WCAG.
La prueba horaria usa el identificador resuelto por el navegador, que puede
normalizar America/Argentina/Mendoza a America/Mendoza.

## Preservación

Sin migraciones, nuevas dependencias ni servicios pagos. Permanecen intactos
SUN/SDM, TTStatus, lotes, roles, SDK, EPCIS, editor, pasaportes públicos, avisos,
Polygon/IOTA y dashboard. No se generan TAP de prueba en producción ni se envían
mensajes, OTP o transacciones. No se cargan fixtures en la base productiva.

La lectura inicial productiva registró 35 asociaciones de lectura y 34 productos,
migración máxima 0111 y Balmec con 10 tags activos, 10 inactivos y hash
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
Estos son conteos globales de preservación, no estadísticas de una persona.
Prueba privada productiva y TAP físico no se dan por confirmados por estos ensayos.

Reversa API: dpl_GSaR5WmYab6AHfQbTQiYcYkVV8Xh.
Reversa web: dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg.
Se publica API compatible primero y web después. El dashboard queda en .27.
