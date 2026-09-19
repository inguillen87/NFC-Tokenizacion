# Investigación del historial — cierre publicado el 19/09/2026

## Artefactos promovidos y confirmados

API: 2026.09.19-api-trace.2, dc104fe2e0d37134ed8c66cf947660b7a0a3ae34,
dpl_4wGmKWNqtUTE8dc3LGVS71hkgqST en api.nexid.lat.
Dashboard: 2026.09.19-dashboard.22, f2c1934f328258abbbc012c83b77033f7f98a1cc,
dpl_5YG9u2Jn2NcyuwFp55361tutJBx1 en app.nexid.lat.
Web sin modificación: 2026.09.19-web-consumer.1,
e94720e2519c28f0b2ce32db67bd04be0255a093,
dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg en nexid.lat.

Los builds remotos terminaron READY desde fuentes limpias y coinciden en proyecto,
SHA y gitDirty=0. Se promovió primero API y después dashboard, comprobando que
ninguna ejecución concurrente hubiera cambiado los aliases base. Se verificaron
los tres dominios al finalizar. No hay migración ni nuevo servicio en esta entrega.

## Funcionalidad cerrada

El recorrido existente permite anterior/siguiente en páginas de 50 movimientos,
filtros de GTIN/lote/serie/tipo de evento contra el período completo y seguimiento
de una identidad exacta desde su referencia. No se creó una nueva pantalla paralela.

La búsqueda de texto es local a la página y lo indica. Exportar HTML/JSON conserva
los filtros, número de página, corte y datos recibidos, no consulta otra vez ni se
presenta como exportación del historial completo. Los permisos se revalidan en cada
lectura; el corte por fecha de ingreso no es una transacción repetible ni certifica
que las relaciones sigan vigentes. No equivale a captura de un lector UHF físico.

El estado de carga, error, resultado e identidad seleccionada no se mezcla con una
consulta anterior. Los filtros avanzados se pliegan al obtener resultados para
reducir desplazamiento en celular. El detalle mantiene navegación de teclado,
colores por fuente, claro/oscuro y respeto de movimiento reducido.

## Validación local

API: seis pruebas nuevas más toda la cadena de regresiones y build aprobado.
Dashboard: TypeScript, build y 903 pruebas, 901 aprobadas, cero fallidas y dos omitidas.
Gates de secretos aprobados y archivos de dependencias/lockfile sin cambios.

15 escenarios con PostgreSQL real y los handlers reales comprobaron cinco páginas
con más de 200 registros locales, sin pérdidas o repeticiones en ese conjunto.
Se probaron microsegundos, mismo UUID entre fuentes, regreso con el mismo corte,
registros tardíos, identidad fuera de la primera página, tipos, calificadores exactos,
revocación, tenant ajeno, entradas inválidas y fallos de fuente. No se modificó
la configuración de lotes o etiquetas de esos fixtures.

Ocho comprobaciones integradas Next/React/BFF+PostgreSQL y cuatro variantes visuales
1440/390 claro/oscuro pasaron. Se verificaron descargar HTML/JSON, hash, render de
informe sin recursos externos, búsqueda local sin solicitudes, consultas reales,
reintento de una página caída y cambio de permisos. No hubo mutaciones de negocio.
Sin hallazgos axe en la superficie analizada; no es una certificación WCAG.

## Verificación productiva

API /health respondió 200; /sun sin parámetros respondió el 400 esperado;
/release.json coincidió con la versión publicada. La nueva consulta sin sesión
respondió 401. En staging, la página privada redirigió al login y no renderizó
el contenido de trazabilidad sin autenticación. Seis pruebas públicas de navegador
pasaron después de publicar y el marcador de dashboard confirmó .22.

Se conectó al Chrome existente del titular sin cambiar la sesión ni credenciales.
El enlace privado redirigió a /login conservando el destino completo. La consulta
/api/session/current respondió 401 y authenticated:false. Por eso no se confirmó
una lectura privada productiva: faltaba una sesión activa en ese navegador.
El primer intento sólo había informado timeout de espera del título; se repitió
un diagnóstico de lectura para distinguirlo de un fallo de la página. Se registró
además un error JavaScript de propiedad ethereum; no se atribuye aquí su causa ni
se deshabilitó ninguna extensión o configuración del navegador.

La consulta posterior de la base confirmó cero eventos EPCIS y de custodia,
la misma migración máxima 0110 y el piloto Balmec intacto: 10 activas, 10 inactivas,
hash f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
No se agregaron movimientos ficticios para llenar el historial. Los TAP físicos
continúan en su vista original; no se convierten en declaraciones EPCIS supuestas.
Vercel sigue informando Neon Free/free_v3. No se cambió plan, claves, TTStatus,
contadores, Polygon/IOTA, mensajería, SDK ni pasaporte público.

Reversas base: API dpl_D46RvBTcasFiRDfeLCB6PaRfaFMm y dashboard
 dpl_Hn95zucM6jputH6R2vzL37Qy3hgM. No hay cambios de datos que revertir.
