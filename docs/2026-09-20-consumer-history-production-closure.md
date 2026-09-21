# S3 — Historial personal de lecturas: cierre publicado el 20/09/2026

## Combinación productiva confirmada

API: 2026.09.20-api-consumer-history.1,
a3e51ffdc324631640734b4b246f23c1ac1f5842,
dpl_9drfo3eYYH76sirXbQShxbXpENrQ en api.nexid.lat.
Web: 2026.09.20-web-history.1,
b6c054bcc59c4eb10ff01f1ff38aa2ad05c4df19,
dpl_AKi4ugeindS2DL2sqUx6pcKN8qNX en nexid.lat.
Dashboard conservado: 2026.09.20-dashboard.27,
14d62ca9a67e07f20eb939e79af32cc5f7d106c2,
dpl_5TuNRtFqgjytpDXGUh1vceCE9Vfi en app.nexid.lat.

Ambas aplicaciones se construyeron desde commits limpios, proyectos verificados
y gitDirty=0. Pasaron los preflights del repositorio y los builds remotos READY.
Se verificó el alias base antes de cada despliegue y promoción. Se promovió API
antes que web y se comprobaron los tres dominios al cerrar. No se desplegó dashboard.

## Funciones utilizables

El Historial de lecturas existente en /me/taps ahora permite avanzar o retroceder
por páginas de 25 registros asociados a la cuenta. La consulta por empresa, fechas
y referencia exacta recorre la selección en la base, no sólo las últimas 200.
Los identificadores bigint se conservan como texto sin redondear dígitos.

Buscar texto dentro de una página, alternar UTC/hora del dispositivo o copiar una
referencia no genera consultas. Abrir lectura conserva el enlace privado existente;
no reenvía la prueba SUN, no repite el TAP y no revalida el chip. Los resultados
informativos QR se distinguen de autenticación NFC. Se mantienen los estados
guardados del precinto y la indicación de registro histórico.

La fecha del historial corresponde al guardado/asociación en la cuenta, que puede
ser posterior al TAP. Se muestra como Guardada. No se inventa una hora física de
lectura ni se presenta el resultado histórico como estado actual del producto.
Los nombres provienen sólo de una referencia inequívoca en la colección propia;
no se elige metadata de otra persona o de un producto ambiguo.

En móvil, el formulario se pliega tras consultar y no se repite el encabezado
comercial. Los resultados quedan más arriba. Controles de página arriba y al final,
foco tras consultar, comparación clara de vacío/error/sesión vencida, claro/oscuro,
contraste y movimiento reducido. Cancelar una solicitud anterior impide que su
respuesta reemplace filtros nuevos. Una página caída se puede reintentar desde
la misma posición; al vencer la sesión se retiran filas y empresas y se ofrece login.

## Aislamiento y límites

La autorización es la sesión original de consumidor, no la de administrador.
Cada lectura verifica cuenta activa y consumer_id. Un filtro de empresa nunca
permite leer todos los TAP de esa empresa. Se rechazan parámetros actorId o
consumerId y filtros repetidos. No se otorgan permisos ni se crean cuentas al abrir.
La API antigua /consumer/taps permanece intacta; la nueva está en /consumer/taps/history.

Una consulta de datos por página, sin nueva dependencia, migración, polling o
servicio. El BFF dedicado preserva explícitamente filtros, timeout, lectura acotada
y private/no-store, sin modificar el proxy genérico de otros módulos. La autenticación
conserva su mantenimiento de sesión anterior, no se afirma que toda ella sea sin
escrituras. Consultar esta vista no crea eventos de negocio.

Cursores de cuatro horas y máximo 10000 páginas, 128 KiB por respuesta y hasta 50
empresas de la cuenta. Fechas vacías recorren el historial disponible; con fechas,
hasta 366 días inclusivos UTC. El corte de creación evita desplazar páginas por
nuevos guardados, pero no es un snapshot inmutable frente a correcciones o bajas.
No se afirman totales de vida, retención infinita ni una ubicación GPS vigente.

## Pruebas locales y límites de aceptación

13 escenarios con PostgreSQL real y el handler real: 237 lecturas en diez páginas,
empates en microsegundos, ausencia de duplicados, retorno, referencia fuera del
viejo límite de 200, aislamiento, búsqueda, fechas, registros nuevos, cuenta
eliminada y fallo de fuente. Autenticación y datos del ensayo fueron sintéticos.

Tres pruebas nuevas de API; los tests originales de proyección de lecturas siguen
presentes y se reemplazaron las expectativas obsoletas de la página fija por doce
pruebas del contrato y de la nueva interfaz. Suite web: 588 aprobadas, cero fallidas
y cero omitidas. Los builds completos API/web y los controles de secretos pasaron.

Ocho comprobaciones integradas Next/React/BFF con PostgreSQL real verificaron
páginas, filtros, consulta exacta, hora local, copiar, fechas, continuación inferior,
fuente caída, reintento, sesión vencida, cuenta vacía y login anónimo. Cuatro
variantes visuales 1440/390 claro/oscuro sin hallazgos axe en la superficie evaluada.
Las capturas finales se revisaron, incluyendo la reducción del espacio superior.
No equivale a certificación WCAG completa ni a un nuevo ensayo NFC físico.

## Verificación posterior al despliegue

API health 200, SUN sin payload 400 y marcador canónico con la release nueva.
Historial canónico sin sesión respondió 401. El preview directo de la API mantiene
la protección origin_not_allowed para rutas privadas (403); no se deshabilitó.
El candidato web confirmó su marcador y redirigió /me/taps al login sin contenido
privado. Después de publicar pasaron seis comprobaciones públicas de navegador:
marcador, denegación privada sin cache, rechazo de consumerId, continuación del
login y demo SUN existente en español/inglés. No hubo errores JavaScript allí.

Se conectó al Chrome existente del titular sólo para lectura. /me/taps mostró
el login de consumidor, sin sesión personal activa. No se inició sesión por él,
no se reutilizó la autoridad de administrador y no hubo escrituras de negocio.
Por tanto el historial privado de una cuenta productiva queda sin confirmar; la
aceptación funcional con datos corresponde a los ensayos locales descritos.

## Preservación

La comprobación previa/posterior conservó 35 lecturas asociadas y 34 productos
(globales, no estadísticas del titular), migración 0111 y Balmec con diez etiquetas
activas, diez inactivas y configuración:
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
Vercel confirmó Neon Free/free_v3. No se agregaron fixtures productivos, gastos,
OTP, mensajes, transacciones blockchain ni nuevas bases. SUN/SDM/TTStatus, claves,
contadores, Studio, GS1/QR, SDK, EPCIS, retiros y dashboard permanecen intactos.

Reversas anteriores: API dpl_GSaR5WmYab6AHfQbTQiYcYkVV8Xh;
web dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg. No hay migración o datos nuevos que revertir.
