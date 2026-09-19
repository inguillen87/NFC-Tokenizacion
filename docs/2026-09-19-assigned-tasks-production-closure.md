# S6 — Tareas asignadas: cierre publicado el 19 de septiembre de 2026

## Combinación productiva confirmada

- API: 2026.09.18-api-tasks.1, c27ab01f6716e312c001317618f8ac705f486817,
  dpl_EF7fbwNt2JVZuPXFpGLrUjL1Jcw3, api.nexid.lat.
- Dashboard: 2026.09.18-dashboard.19, d7025b862fb1aed77b3e56e58d79212617c1ba4c,
  dpl_CvrjWucm6Qop7PTe6WbR9KpkRMbs, app.nexid.lat.
- Web: 2026.09.18-web-notices.1, 97200947244ceed362a3eafe5662c2d0a7031dd8,
  dpl_85svivuUFUyQRPUT7n4jmNxp7Q99, nexid.lat. No se redeployó ni modificó.

El circuito de tareas estaba preparado en ramas y artefactos READY, pero los
aliases seguían en dashboard.18/api-notices.1. No se construyó un segundo módulo.
Se recuperaron las revisiones exactas en worktrees aislados, se repitieron sus
pruebas y builds y se promovieron los mismos artefactos. Sin nuevos previews o
builds remotos para repetir el trabajo ya empaquetado.

## Resultado operativo

En Operación aparece Mis tareas de retiro (/tasks/recalls). La cuenta autorizada
ve los destinos que le asignaron dentro de retiros publicados: instrucciones
vigentes, cantidades propias, acuse, historial y constancia descargable.
La gestión puede compartir el enlace del destino desde el retiro existente.
El enlace no concede autoridad ni acceso a terceros: requiere sesión, permiso,
asignación actual y membresía activa. No hay acceso anónimo por token.

El responsable confirma el acuse e informa totales devueltos/inmovilizados con
motivo y referencia. Los movimientos quedan en el mismo expediente de gestión,
identificados como respuesta de la cuenta asignada, sin crear otro registro de
caso. No se exponen el motivo interno ni otros distribuidores. Las cantidades son
declaraciones autenticadas, no certificación de devolución física.

Las respuestas no publican, cierran o levantan avisos y no alteran inventario,
claves, contadores, TTStatus, autenticidad ni perfiles QR/GS1. Los controles de
aprobación independiente y MFA de la gestión continúan sin modificación.
Un viewer no puede responder aunque esté asignado. Los permisos limitados
recall_tasks:read/recall_tasks:respond deben estar autorizados; asignar a una
persona no concede por sí solo esos permisos y no creamos cuentas u overrides.

## Pruebas repetidas para este cierre

API: build completo, regresiones y siete pruebas específicas de tareas aprobados.
Dashboard: TypeScript y build correctos; 879 pruebas, 877 aprobadas, cero fallidas
y dos omitidas. Gates de secretos aprobados en ambos worktrees.

PostgreSQL real local 17.10: 17 escenarios aprobados con handlers reales y el motor
existente de retiros. Alcance propio, rechazo de cuentas no asignadas, revocación
de membresía, seis acuses simultáneos, conflicto de payload/revisión, cantidades
acumuladas, historial compartido, cierre independiente y rollback ante fallo de
auditoría. La configuración de lotes y etiquetas quedó idéntica en los ensayos.

Se repitió el recorrido integrado con Next/React/BFF del proyecto contra SQL real
local: abrir destino, acuse, pérdida de respuesta tras commit, reconciliación,
recargar, declarar 7 devueltas y 3 inmovilizadas, reflejo en gestión, constancia,
consulta de viewer, cierre y fuente caída. Cuatro casos visuales 1440/390,
claro/oscuro; sin errores JavaScript ni hallazgos axe en la superficie evaluada.
No es una certificación WCAG. Autenticación y datos del ensayo eran sintéticos;
no se realizó un acuse ni devolución sobre casos productivos.

Los harnesses originales tenían otros procesos activos en sus puertos. Se copiaron
sólo los scripts de prueba a Temp cambiando sus puertos a 4275/3175/15635 y usando
el fixture de la revisión exacta. No se modificó código de aplicación para probar
ni se detuvieron los servicios de otros trabajos.

## Esquema y verificaciones posteriores

La migración 20260919000000_0109_recall_assignee_tasks.sql ya estaba registrada.
Se comprobó su índice y el SHA-256 de la función instalada:
803132e215441f11687ef13704b942cb2886435d17186144d067e8377498199b.
Coincide con la función que pasó los tests. No se reaplicó ni creó otra migración.

Se confirmaron alias y versiones después de promover API y luego dashboard.
API health 200; SUN sin argumentos 400; tasks sin sesión 401. La URL de tarea
sin sesión redirige al login, conserva case/destination en el retorno y no
expone la interfaz privada. Seis pruebas públicas de navegador pasaron.

El intento de abrir la bandeja en el Chrome autenticado existente agotó 15 segundos
de conexión CDP antes de abrir una página. Por tanto la lectura privada con la
sesión real de Marcelo NO está confirmada en este cierre. El recorrido completo
sí está probado en local como se detalla arriba. No se cambiaron sesiones,
contraseñas, navegadores ni permisos para sortearlo.

La base productiva conservó cero retiros y cero respuestas de tarea. Balmec sigue
con diez tags activos, diez registros inactivos y el hash de configuración
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
Vercel sigue informando Neon Free/free_v3. No se cambió plan, se contrató servicio
ni se activó envío de mensajes o polling adicional.

## Pendientes explícitos

Acceso externo sin cuenta, invitaciones y notificaciones autorizadas, archivos
de evidencia gestionados y aceptación física del distribuidor siguen fuera.
Este cierre permite responder a cuentas asignadas y autorizadas del tenant.
Balmec no muestra tareas de ejemplo porque no tiene retiros registrados.

Rollback previo: API dpl_EwpHrn1ewGMzVbePFefm7Ab6335v y dashboard
 dpl_7ABCQfAd77ZFo6ZKbxBuvs1xYRq8. El historial de respuestas permanece en el
motor original de retiros; una reversión no debe borrar datos ni la migración.
