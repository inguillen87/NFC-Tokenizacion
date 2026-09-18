# S6 — Informe de evidencia del piloto

## Alcance y versión

API: 2026.09.18-api-pilot.1, basada en 16022a80ae7d45abad58f4e12c485d2f1382f2fe.
Dashboard: 2026.09.18-dashboard.15, basado en 1793458ca3cda4da3677163f84cfc9aa472334ab.
No cambia web, SUN/SDM, Passport Studio, GS1/QR, SDK, credenciales o políticas de gasto.

Este es el cierre del informe de piloto dentro de S6, no el cierre completo de S6.
El circuito de retiro/cuarentena/aprobación/avisos/acuses/devolución todavía no está
implementado. No se trata el estado de una etiqueta como si fuera un retiro comercial.
El primer conector nativo ERP/WMS con aceptación del cliente sigue pendiente en S5;
el kit ejecutable previo permanece disponible y no se reemplaza.

## Funciones visibles

Ruta /analytics/pilot, enlazada desde Analítica y desde Lotes para las cuentas
con permiso. Elegir empresa, lote opcional y período inclusivo UTC de 1 a 93 días.
Se consultan las opciones, pero el histórico se calcula sólo al presionar Generar.
El superadministrador elige empresa explícitamente; el cliente queda en su empresa.
Cambiar filtros invalida el informe y retira los botones de exportación hasta generar
un nuevo resultado. Fallar la fuente no se convierte en ceros o datos de otro corte.

Vista con resumen, gráfico diario, atención de incidentes, indicadores detallados,
fuentes y denominadores. Tres descargas desde la MISMA respuesta validada:
HTML autónomo para compartir/abrir/imprimir, CSV de indicadores y JSON con checksum.
No vuelve a leer Neon al exportar. El HTML no tiene scripts, fuentes remotas,
trackers o imágenes externas. No envía correos ni publica un informe automáticamente.
El CSV neutraliza prefijos de fórmulas; el HTML escapa los textos de la empresa.

## Qué se mide

- Mensajes NFC verificados según la política canónica existente: TAP_VALID,
  veredicto válido, CMAC correcto, allowlist y lista cerrada de resultados.
  Un resultado nuevo VALID_* o una apertura manual no heredan autenticación.
- Visitas de identidad registradas PROVENANCE_VIEWED se separan de NFC verificado.
- Cerrado/abierto/desconocido se cuenta por mensaje verificado; no certifica el
  estado físico actual de todo el lote ni que todas las aperturas sean incidentes.
- Etiquetas distintas con lectura verificada se cuentan sólo si el evento está
  ligado a un tag registrado del mismo lote. Es cantidad de unidades, no personas.
  La cobertura de los vínculos se informa; no se adivina UID o identidad ausente.
- Etiquetas activas/inactivas/otras son inventario ACTUAL al generar. No se
  presentan como altas históricas del período o como venta.
- Incidentes creados en el período con vínculo al evento/empresa/lote real:
  resueltos, descartados y pendientes son su estado ACTUAL al generar.
  Resolver después del período puede modificar esta fotografía de la cohorte.
  Descartados no se suman a resueltos. La mediana usa sólo resueltos con fechas
  consistentes, y muestra el número de casos con duración válida.
- Uso SDK viene de sdk_usage_logs: llamadas registradas, HTTP 5xx y percentil95
  entre muestras de latencia válidas. No es factura ni disponibilidad SUN.
  En informe de un lote, estos campos quedan sin base porque no hay atribución
  fiable de ese registro al lote. No se copian números de toda la empresa.

Quedan expresamente sin medición: disponibilidad antes de persistir el evento,
altas históricas de etiquetas, ventas/ROI, audiencia consentida, uso efectivo de
documentos, factura de proveedores y resolución de retiros comerciales completos.
No se declara uptime100% o ROI por no encontrar errores en esta consulta.

## Integridad y protección

Una sentencia SQL construye el reporte con instantánea PostgreSQL y
statement_timestamp(). Todos los agregados se refieren al mismo corte.
El rango se valida antes de consultar. Topes de 100.000 filas por fuente y
10.000 lotes; si se supera, se rechaza el informe y se solicita reducir el alcance.
No se exporta silenciosamente una muestra limitada como si fuera el universo.
Se excluyen eventos cuyo source no sea real, automatismos detectados por el patrón
existente y eventos sin vínculo al lote autorizado. Se informa cada exclusión.
La atribución exige UUIDs del tenant y lote, no confiar en nombres o slugs guardados
en eventos. La respuesta no contiene UIDs, coordenadas, IPs, usuarios, cuerpos NFC,
secretos, mensajes de incidentes ni trazas individuales del SDK.

El backend verifica reports.export y analytics:read con los límites existentes
del rol. El frontend usa un evaluador específico coherente con el catálogo: no
confunde reports.export con la lista distinta de capacidades high-impact.
El BFF rechaza el tenant ajeno explícito en estas dos nuevas rutas ANTES de su
normalización legacy. El resto de los recursos conserva su comportamiento.
El guard existente de /analytics sigue excluyendo cuentas sin acceso a analítica.
No se otorgaron permisos a cuentas de clientes ni se convirtió al global en un
aprobador de la empresa. Demo no sirve como fuente de este reporte.

La UI valida contrato exacto, alcance, particiones de conteo, tendencias, muestras,
fechas y SHA-256 antes de renderizar o exportar. Un checksum detecta modificaciones
respecto de ese objeto report; no es firma digital ni prueba contra alguien capaz
de modificar el contenido y recalcularlo. El informe se descarga; no se guarda una
copia automáticamente en producción ni se crea un repositorio documental oculto.

## Pruebas ejecutadas antes de publicar

Diez comprobaciones del servicio real contra PostgreSQL17.10 local y desechable:
instantánea coherente, política de autenticación cerrada, exclusiones por fuente,
relaciones cruzadas de tenant/lote, vínculos de unidad, incidentes y tiempos,
uso SDK, filtros por lote, períodos vacíos, integridad y ausencia de datos privados.
Se insertaron más de100.000 filas SÓLO en esa base vacía local para probar el corte;
el reporte rechazó la muestra incompleta. Se renombró temporalmente una tabla
SÓLO en esa base para verificar que una fuente caída no pasa a cero. Nunca en Neon.

Seis pruebas nuevas de API para fechas/alcance/resultados/autorización/SQL de lectura.
Pruebas de frontend sobre contrato e integridad, exportación consistente, valores
sin base, inyección CSV/HTML, políticas de acceso y rechazo de tenant ajeno.

Chromium con el Next/BFF real del proyecto y servicio real sobre PostgreSQL local.
La autenticación se sustituye por identidades de prueba locales, no clientes.
Generación = una sentencia de datos. Descargar los tres formatos = cero consultas
adicionales. Filtros/fallo de fuente retiran datos viejos. Reload no regenera el
histórico. Viewer queda fuera por el guard de analítica, BFF403; otro tenant se
rechaza con403. Superadministrador selecciona una empresa antes de generar.
Cuatro variantes visuales (1440/390, claro/oscuro), sin overflow ni incidencias axe
en la superficie evaluada; no es certificación WCAG. Se inspeccionó el HTML
exportado y su layout imprimible. Ninguna mutación de negocio en las pruebas HTTP.

## Operación y reversa

No requiere migración, nuevos proveedores, IA, broker, colas ni computación Neon
always-on. Fechas y volúmenes limitados, generación explícita y exportes locales.
El dato existente sigue consumiendo consultas normales: no se promete tráfico o
almacenamiento ilimitado ni se llama hard cap monetario a este control de volumen.

Reversa API: dpl_FLgEm67JVgdP29FBFipm8ktg34du.
Reversa dashboard: dpl_FUfPG5GVyTkZBN2SHn7CUkpUKv31.
Promover API compatible antes que dashboard y comprobar el par completo.
Balmec mantiene sus10 etiquetas activas y10 inactivas históricas; no se alteran
claves, contadores o TTStatus. Siguiente cierre S6: retiro comercial gobernado,
independiente de la autenticidad del tag y con aviso visible en el pasaporte.

## Resultado final de aceptación local

Dashboard: 859 pruebas, 857 aprobadas, cero fallidas y dos omitidas.
API: seis pruebas específicas de reporte y build completo con regresiones aprobados.
Servicio: diez escenarios sobre PostgreSQL real local aprobados.
Navegador: generación, tres exportes, rechazo de scope ajeno, fallos de fuente
y cuatro casos claro/oscuro/escritorio/celular aprobados. Las sesiones son locales
sintéticas; la descarga productiva se valida separadamente después del despliegue.
