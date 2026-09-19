# S3 / S4 — Bandeja editorial de pasaportes

Release: dashboard 2026.09.19-dashboard.26 + API 2026.09.19-api-editorial-queue.1.
Base dashboard: 6e1575b30c897bb788cac25586b47850cc7708af (.25).
Base API: 5631b475c77fa5469191a0ce0ea5545f8bbb00ce (api-intake.2).
Web preservada: e94720e2519c28f0b2ce32db67bd04be0255a093 (web-consumer.1).

## Cierre operativo del plan original

Se agrega una consulta central del trabajo ya gestionado en Passport Studio.
No se construye otro editor, motor de aprobación ni registro de pasaportes.
La bandeja permite localizar borradores, correcciones, revisiones y publicaciones
pendientes sin abrir cada lote. Conecta con Studio para ejecutar las decisiones
existentes y conserva los controles de independencia, versión y MFA.

Entrada desde Productos y pasaportes -> Bandeja editorial y desde Lotes.
Ruta /passports/review; retorno desde el pasaporte mantiene la empresa elegida.
La consulta sólo incluye passport_editorial_heads enlazados al tenant y lote:
los productos todavía no incorporados a Studio no se convierten automáticamente.

## Trabajo por rol y evidencia visible

Los contadores distinguen todos los pasaportes del alcance de las coincidencias
filtradas y las filas de una página. Para mi rol orienta al editor hacia borradores
y correcciones, al revisor hacia revisiones independientes y al publicador hacia
revisiones aprobadas. Los creadores, últimos editores y remitentes de una revisión
no se presentan como candidatos de autoaprobación aunque tengan permisos amplios.
La cola no sustituye el chequeo definitivo de Studio ni asigna personalmente tareas.

Cada ficha muestra estado persistido, número de revisión, versión publicada de
Studio, plantilla, idioma y último cambio. La versión pública cero se identifica
como contenido inicial, no como una publicación aprobada. Si el último movimiento
es una solicitud de cambios, se muestra su comentario como texto, no HTML.
El nombre mostrado es el actor del último movimiento, no un responsable inventado.

La búsqueda consulta producto, BID o empresa dentro del alcance autorizado, con
filtros de estado y trabajo por rol. Los caracteres de LIKE se tratan literalmente.
25 filas por página, orden por cambio más antiguo y continuación por timestamp
con microsegundos e ID. El cursor se vincula a empresa, filtros y capacidades del
actor, pero no es una credencial. Los permisos se revalidan al consultar.
La bandeja es viva: cambios de estado o actualización pueden desplazar filas entre
páginas, por lo que no se presenta como un snapshot inmutable o un plazo de SLA.

El enlace de búsqueda conserva empresa y filtros, abre la primera página y requiere
sesión autorizada. No contiene cursor, tokens o credenciales. Seleccionar una fila,
leer su siguiente paso o copiar el enlace no consulta nuevamente la base.
Un fallo de fuente retira los resultados anteriores y no se confunde con cero
pasaportes. La lectura fallida puede reintentarse con su misma posición.

## Implementación y preservación de alcance

Nueva ruta de API: GET /admin/passport-editorial/queue. Requiere batches:read con
sesión humana, rol existente y denegaciones. API y BFF rechazan un tenant ajeno
antes de normalizarlo. El superadministrador puede consultar el alcance global;
una cuenta de empresa no obtiene esa capacidad por cambiar la URL.

El servicio utiliza un SELECT con proyecciones acotadas, totales y metadatos de la
revisión. El historial se consulta por lote y revisión exacta. No retorna documentos
completos, seed_config, sdm_config, claves, IDs de autores o comprobantes de escritura.
No necesita migración, nuevos índices, dependencias o servicios. La validación de
sesión mantiene las lecturas y operaciones normales del sistema existente.

Al conectar la bandeja se detectó que la página Studio recibía tenant en SSR, pero
su transporte de escritura no lo conservaba explícitamente. Con dos empresas con
el mismo BID esto podía dejar una resolución ambigua; el scope del cuerpo impedía
suplantar a la otra empresa. No se afirma que hubiera ocurrido una escritura ajena.

Ahora la incorporación y el transporte de operaciones conservan tenantSlug validado
como parámetro después del nombre de acción, y el regreso/reintento de página lo
conserva también. La validación de endpoint mismo-origen sigue rechazando destinos
externos, consultas incrustadas, traversal y tenant malformado. Los callers antiguos
sin tenant explícito mantienen su comportamiento. No se cambió el permiso de nadie.

## UX/UI

Se integró la navegación existente por tareas, sin quitar mapa, analítica u otras
secciones. Los estados tienen etiquetas además de color; las filas ofrecen acceso
directo a Studio y un detalle del siguiente paso. En móvil los filtros se pliegan
al confirmar la consulta y su resumen queda visible, acercando el trabajo a la parte
superior. Seleccionar una fila enfoca el detalle y respeta movimiento reducido.
Modo claro/oscuro, scroll acotado de la lista, controles de teclado y recuperación
tras error forman parte de la aceptación.

## Pruebas realmente ejecutadas

13 escenarios con PostgreSQL real local y el handler real de la bandeja. Se crearon
35 pasaportes de una empresa y uno de otra usando el servicio editorial existente,
no editando estados falsos directamente: borrador, solicitud de corrección, envío,
aprobación y publicación. Se comprobaron conteos, 25+10 filas sin duplicados en
un conjunto estable, roles, autoaprobación, comentario exacto, búsqueda literal,
misma BID en dos tenants, revocación/cambio de cursor, fallos de fuente y ausencia
de mutaciones por las consultas. Una prueba aplica una aprobación real del servicio
local para comprobar el cambio de bandeja; no se ejecutó esa operación en producción.

Seis pruebas de política/API y siete de contrato/interfaz verifican validación,
permisos, navegación por tareas, metadatos y construcción de rutas Studio con tenant.
La suite completa de dashboard tiene 938 tests: 936 pasaron, cero fallaron, dos
omitidos. TypeScript y builds de API/dashboard pasan, al igual que los gates de
secretos. Los scripts originales del presenter Studio pasaron cuatro pantallas
y ocho escenarios de regresión, con respuestas volátiles explícitas.

Nueve comprobaciones integradas Next/React/BFF+PostgreSQL pasaron. El navegador
consulta estados reales del fixture, navega, filtra, copia búsqueda, lee una corrección
como texto, comprueba roles, recupera errores y abre Studio como administrador global
con dos lotes del mismo BID en diferentes empresas. Se guardó expresamente un cambio
local en el tenant elegido y se comprobó el retorno correcto. El guardado y una
aprobación ejecutada por el harness fueron los únicos dos cambios del historial
durante ese ensayo. Los usuarios y contenido son sintéticos, no clientes productivos.
Cuatro variantes 1440/390 claro/oscuro sin hallazgos axe en la superficie examinada.
Las capturas se revisaron; esto no equivale a certificación WCAG completa.

## Límites y despliegue

No asigna revisores, fija vencimientos, envía recordatorios, aprueba en lote ni
publica automáticamente. Tampoco incorpora productos a Studio sin confirmación.
Para mí significa siguiente paso según capacidades actuales, no una asignación
personal. El control definitivo sigue ocurriendo al operar la revisión en Studio.

La lectura productiva inicial confirmó cero heads/historial editorial y migración
máxima 0111. Balmec conserva diez tags activos, diez inactivos y el hash de config
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
No se crearon ejemplos productivos para llenar esta bandeja. No se toca Neon ni
el plan, SUN/SDM, TTStatus, SDK, QR/GS1, logística, portal o Polygon/IOTA.

Reversas base: API dpl_6vrnMdc1LhCbp2hRuVD5bsYDAKBy y dashboard
dpl_GiA68JA9wLJwrtnKGuDEQoevLtVP. Desplegar primero la API compatible, luego dashboard.
