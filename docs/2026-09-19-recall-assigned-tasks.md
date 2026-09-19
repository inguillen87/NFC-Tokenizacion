# S6 — Respuesta del responsable asignado

API prevista: 2026.09.18-api-tasks.1. Base 0388be2505809e45f9261d2ebdb94ea9b166ba13.
Dashboard previsto: 2026.09.18-dashboard.19. Base 8cc69dd856547982cabbafa2709daf572e68e8f9.
La web de consumidores permanece en web-notices.1, sin modificaciones.

## Operación entregada

Publicar un retiro con destinos y responsables, compartir un enlace autenticado,
abrir la tarea asignada, registrar acuse y cantidades acumuladas, consultar los
mismos movimientos desde gestión y descargar la constancia del destino.
No se crea otro expediente ni una copia de los destinos como tareas separadas.

Cada cuenta ve sólo sus destinos publicados y el aviso vigente. No se devuelven
el motivo interno del retiro ni otros destinatarios. El enlace no concede acceso:
se verifican sesión, membresía activa, asignación y permisos en lectura y escritura.
El origen assigned_task distingue una respuesta de la cuenta asignada de un registro
administrativo. Devueltas e inmovilizadas son totales acumulados, no incrementos.
No superan el objetivo del destino ni certifican devolución física o autenticidad NFC.

## Autoridad y alcance

recall_tasks:read permite consulta; recall_tasks:respond permite respuestas acotadas.
La autoridad existente de gestión también permite responder tareas propias.
Las denegaciones prevalecen. Un viewer autorizado sólo consulta; la cuenta global
no suplanta al asignado ni enumera todas las tareas desde esta bandeja personal.

No se crean cuentas, se envían invitaciones ni se conceden permisos automáticamente.
Un operador restringido necesita autorización explícita mediante el mecanismo
existente de overrides; esta entrega no agrega un editor visual de delegación.
Publicación, cierre y levantamiento permanecen en las vistas de gestión existentes.

## Persistencia

Migración aditiva 0109: índice de asignaciones y adaptador SECURITY INVOKER.
Usa el mismo lock y función de mutación del retiro, con membresía bajo bloqueo,
asignación vigente y revisión de caso/aviso verificadas. No añade otro motor.
Reintentar conserva el identificador y recupera el comprobante, incluso si después
avanzó el caso, siempre que se mantenga la autorización. Cambiar el cuerpo del
intento produce conflicto. Una caída de auditoría revierte progreso y revisión.
La función no es ejecutable por PUBLIC. No altera avisos, lotes o etiquetas.

## UX y pruebas

Bandeja y respuesta en escritorio; en celular la tarea abierta muestra el aviso y
la respuesta sin repetir la lista y cabecera completa. Volver a otras tareas no
hace consultas ni descarta el formulario. Comparación de estados, colores de aviso,
modo claro/oscuro, confirmación con foco y movimiento reducido. La constancia HTML
escapa contenido y exporta sólo el destino desde la consulta confirmada.

17 escenarios con handlers reales y PostgreSQL 17.10 local pasaron: aislamiento,
revocación de membresía, seis acuses concurrentes, cantidades acumuladas,
reconciliación, conflicto de versiones y rollback tras fallo de auditoría.
Siete pruebas específicas de API y build completo aprobados. El navegador utilizó
Next/BFF y SQL reales con identidades sintéticas locales: acuse, respuesta perdida,
recarga, 7 devueltas/3 inmovilizadas, reflejo en gestión, cierre independiente,
exportación del destino y fuente caída. Cuatro variantes 1440/390 claro/oscuro sin
incidencias axe en la superficie evaluada; no es certificación WCAG ni un TAP nuevo.

## Publicación y límites

Orden: esquema aditivo, API y dashboard. La web pública no se modifica.
Se conservan avisos v1/v2, rectificaciones, Passport Studio, SDK, campañas y SUN.
No requiere proveedores adicionales, polling, mensajes pagos ni cambiar Neon Free.

Antes del despliegue Balmec tenía cero retiros, diez tags activos, diez inactivos y
hash de configuración f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
No se crean casos reales para probar. La función SQL probada tiene hash
803132e215441f11687ef13704b942cb2886435d17186144d067e8377498199b.

Este cierre corresponde a la respuesta de una cuenta asignada. Quedan fuera las
invitaciones externas, acceso sin cuenta del tenant, notificaciones autorizadas,
archivos de comprobantes gestionados y verificación de devolución física.

Versiones previas registradas: API dpl_EwpHrn1ewGMzVbePFefm7Ab6335v;
dashboard dpl_7ABCQfAd77ZFo6ZKbxBuvs1xYRq8. Una reversión no debe borrar respuestas:
los movimientos quedan en el historial original y requieren una versión compatible.
