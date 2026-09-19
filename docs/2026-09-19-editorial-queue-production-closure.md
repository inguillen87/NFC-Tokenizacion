# S3 / S4 — Bandeja editorial: cierre publicado el 19/09/2026

## Combinación productiva verificada

API 2026.09.19-api-editorial-queue.1:
19200f5dd466cb70420faeb72618ad2e26e236f3,
dpl_2r74bN5mjPumPkotVV94Qenc21mw en api.nexid.lat.
Dashboard 2026.09.19-dashboard.26:
fb3fec4dd00f7a31bfd17f460eff80e74b595c99,
dpl_Ek7mJ8ByPukG9buB4dfrGqJYTP7A en app.nexid.lat.
Web preservada 2026.09.19-web-consumer.1:
e94720e2519c28f0b2ce32db67bd04be0255a093,
dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg en nexid.lat.

Los builds remotos terminaron READY desde los commits limpios, con proyecto,
SHA y gitDirty=0 verificados. Se promovió API primero y dashboard después,
comprobando los aliases base para no reemplazar una publicación concurrente.
Se confirmaron los tres dominios al finalizar. La primera ejecución de la CLI
API se cerró tras subir archivos sin crear un despliegue: se comprobó la lista
remota antes de repetirla. No se creó un build remoto duplicado para ese fallo.

## Trabajo disponible

La Bandeja editorial reúne sólo pasaportes incorporados a Studio. Se puede buscar
por producto, lote o empresa, filtrar por estado y consultar el siguiente paso
para el rol actual. Contadores del alcance, coincidencias y filas de una página
se muestran separados. La navegación presenta 25 pasaportes por página y ordena
por cambio más antiguo; esto no representa una fecha límite o incumplimiento.

El detalle reúne el estado, revisión, versión pública de Studio, plantilla, idioma,
último movimiento y comentario de corrección de la revisión actual. Ofrece abrir
Studio para editar, revisar o publicar, pero la bandeja no ejecuta esas operaciones.
Un autor de la revisión no aparece como candidato de autoaprobación. Para mi rol
es una orientación por capacidades, no una asignación personal ni autorización
permanente. Studio revalida independencia, versión y MFA al operar.

La búsqueda reutilizable copia filtros y alcance, no credenciales ni cursor.
Seleccionar una fila y leer el detalle no consulta la base. Los filtros móviles
se pliegan después de consultar y el resumen permanece visible. La lista tiene
scroll acotado; el detalle recibe foco y se adapta a móvil. Claro/oscuro, etiquetas
además de color y movimiento reducido forman parte de la aceptación.

Se corrigió la continuación de empresa en el editor existente: la página Studio
recibía tenant, pero el transporte de mutaciones no lo incluía explícitamente.
Ahora incorporación, guardado y navegación conservan el tenant validado; el
endpoint sigue siendo del mismo origen y no admite consultas incrustadas o rutas
arbitrarias. Se probó un administrador global con el mismo BID en dos empresas.
El cuerpo de la operación ya comprobaba scope, por lo que no se afirma que hubiera
ocurrido antes una escritura en otra empresa.

## Pruebas completadas

13 escenarios con PostgreSQL real local y handler real, usando estados creados
mediante el servicio editorial existente. Se probaron 35 pasaportes de una empresa,
uno de otra, un lote no inscrito, paginación, roles, participación del autor,
correcciones, publicación inicial, búsqueda literal, filtros/cursor, cambio real
de estado, fuente caída y proyección sin documentos completos o datos técnicos.

Seis pruebas nuevas de API/política y siete de UI/contratos. Dashboard completo:
938 tests, 936 aprobados, cero fallidos y dos omitidos. TypeScript, builds locales
y remotos y gates de secretos aprobados. No cambia el lockfile ni dependencias.
El presenter original de Studio también pasó cuatro pantallas y ocho escenarios
de regresión de respuestas volátiles, separados de la prueba real de persistencia.

Nueve comprobaciones integradas Next/React/BFF+PostgreSQL, cuatro variantes
1440/390 claro/oscuro y revisión visual. Sin hallazgos axe en la superficie probada;
no equivale a certificación WCAG. Los comentarios con etiquetas HTML se mostraron
como texto. El guardado explícito en Studio para la empresa elegida y una aprobación
local realizada por el harness fueron las únicas mutaciones del historial del
ensayo; las interacciones de la bandeja no crearon revisiones. Datos y sesiones
sintéticos locales, no contenidos publicados de clientes reales.

## Verificación posterior y límites

API /health 200; /sun sin parámetros 400 esperado; markers correctos. La consulta
nueva sin sesión fue rechazada (403 en candidato, 401 en el dominio público).
La página privada del candidato redirigió al login sin renderizar su contenido.
Seis comprobaciones públicas de navegador pasaron después de promover y el marcador
del dashboard confirmó .26.

El intento de abrir la bandeja en Chrome con la sesión existente no llegó a crear
una página: el canal CDP rechazó su conexión WebSocket con 403. No fue una respuesta
de la app NexID ni demuestra que el usuario carezca de permiso. No se cambió sesión,
contraseña, extensión o configuración del navegador para eludir ese rechazo.
La lectura privada de producción queda sin confirmar. La aceptación funcional
completa sí está comprobada localmente como se describe arriba.

La consulta productiva posterior mantiene cero heads/historial editorial y la
misma migración máxima 0111. Balmec conserva diez etiquetas activas, diez inactivas
y el hash de configuración
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
Por eso la bandeja del piloto está vacía hasta incorporar pasaportes mediante el
circuito explícito existente. No se inscribió el lote ni se publicaron ejemplos.

Neon permanece Free/free_v3. Sin migración, servicio nuevo, costo automático o
alteraciones de SUN/SDM, claves, contadores, TTStatus, QR/GS1, EPCIS, portal del
consumidor o Polygon/IOTA. No se asignan revisores, plazos o notificaciones ni
se aprueban publicaciones en lote desde esta pantalla.

Reversas previas: API dpl_6vrnMdc1LhCbp2hRuVD5bsYDAKBy y dashboard
dpl_GiA68JA9wLJwrtnKGuDEQoevLtVP. No hay una migración nueva que revertir.
