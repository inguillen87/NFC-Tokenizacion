# NexID — expediente profesional de solicitud

Base productiva verificada: `bf80ccc04fa73108f8d103ebcc597a8fb833d423`.
Rama: `codex/nexid-request-case-summary-20260925`. Incremento sólo de dashboard; no agrega consultas ni cambia API, SQL, permisos, flags o recibos.

## Entrega

Cada solicitud abierta incorpora un resumen de expediente con estado de gestión, responsable actual, última actividad y versión. El responsable se deriva únicamente del estado ya leído: empresa para borradores/aclaraciones pendientes, NexID para revisión/respuesta recibida, operación técnica para pedidos preparados y cerrado para cancelaciones compatibles.

El bloque muestra un siguiente paso orientativo reutilizando la misma semántica de la bandeja. No lo presenta como autorización ni como prueba de fabricación o entrega. La referencia completa queda seleccionable; si existe un pedido vinculado se ofrece un enlace tenant-bound al pedido. No se inventa ese enlace para solicitudes sin order_id.

La trazabilidad básica usa sólo fechas presentes en el expediente: creación, envío, última aclaración y cancelación cuando corresponda. No consulta eventos adicionales ni expone las notas comerciales. La metadata de cotización, cuando existe en una candidata compatible, se presenta sólo como señal informativa y remite a su módulo.

Responsive: tres métricas en escritorio y una columna en móvil. Tema claro/oscuro, foco visible, contraste corregido tras la primera prueba automática y valores largos con wrap. No usa portapapeles, almacenamiento local, navegación automática o polling.

## Validación

11 pruebas nuevas de estado, ownership, trazabilidad, vínculo de pedido y proyección sin notas. Suite completa del dashboard: 1.449 aprobadas, cero fallos y dos omisiones existentes. Typecheck, build, custodia de secretos y auditoría de dependencias aprobados.

Navegador nuevo: 44 comprobaciones en 8 vistas. Regresiones relevantes: bandeja 142/13, lectura segura 124/7, guía de borrador 171/12, solicitudes completas 287/33 y runtime/notificaciones 62/6. Total revisado localmente: 830 comprobaciones en 79 vistas. Sesiones y transporte sintéticos; no registros de clientes.

La primera matriz detectó contraste insuficiente en el tema claro para eyebrow, badge y texto secundario. Se corrigieron los colores y se repitió la matriz con cero infracciones serious/critical. No se relajó la regla de axe.

## Publicación e integración

Antes de promover: CI sobre el SHA exacto y artefacto preparado sin asignación automática del dominio. La candidata avanzada debe recibir las tres fuentes del resumen y la línea de renderizado, conservando cancelación, cotización, técnicos, proveedor, acuse y disponibilidad. No ejecutar 0117–0121 como parte de este sprint.
