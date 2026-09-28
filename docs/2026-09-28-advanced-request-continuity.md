# NexID — integración y continuidad del circuito avanzado

## Alcance y origen
Candidata de dashboard sobre `bbf5f39445aacbd4086f900ed7426a3596952937`, rama `codex/nexid-case-summary-integrated-20260925`. Integra las correcciones publicadas de la PR #378, origen `46db77b5c5793ea31ee8807b83925151150b5dbc`, sin reemplazar cotización, cancelación, asignaciones, proveedor, acuse ni disponibilidad de servicios.

La integración preserva las rutas específicas del operador, su autoridad de lectura/escritura, el estado cancelado, la cotización aceptada como condición de preparación y todos los controles de operaciones con resultado incierto. No se usa la copia de API/web contenida en esta rama para desplegar esos servicios.

## Corrección adicional reproducida
Al integrar se reprodujo una carrera: una consulta de aclaraciones o responsables podía seguir pendiente mientras se abría cotización, cancelación, proveedor o acuse. La denegación tardía de la consulta podía competir con el cambio de estado del otro módulo.

Las consultas de aclaraciones y asignación ahora participan del bloqueo compartido del expediente desde el mismo ciclo de eventos. Un control forzado tampoco puede abrir una operación competidora. Las primeras consultas que coinciden al montar los paneles se coordinan: sólo se reanuda una primera lectura diferida; no hay polling ni reintento automático de un error o escritura.

Se corrigió además el ciclo de lectura de asignaciones: limpieza compatible con StrictMode, identidad de consulta, descarte de resultados tardíos y propagación de 401/403/404 al expediente. Un 404 de registro conserva otras solicitudes; una denegación de sesión retira el alcance. Fallos de red o catálogo no se presentan como revocación de toda la solicitud.

## Experiencia de uso
La consulta de responsables puede cancelarse conservando la selección local y devolviendo el foco al botón de consulta. Hasta obtener otra lectura confirmada, no se puede revisar ese cambio para guardarlo. Las aclaraciones conservan la cancelación y navegación por teclado de #378.

Una lectura cancelada no cancela una escritura. Los recibos inciertos de mensajes o asignaciones conservan su clave y carga originales; la nueva recuperación de consultas no habilita reenvíos automáticos ni borra esos comandos.

## Evidencia local confirmada
- Dashboard: 1.791 pruebas aprobadas, cero fallos, dos omisiones preexistentes. Se incorporan 13 pruebas de #378 y 12 nuevas de denegación del transporte de asignaciones.
- TypeScript aprobado; custodia de secretos aprobada.
- Continuidad de aclaraciones integrada: 189 comprobaciones y 17 vistas aprobadas. La regresión entre módulos falló en ocho aserciones antes del bloqueo compartido.
- Nueva continuidad de asignaciones: 88 comprobaciones y ocho vistas aprobadas, incluidos cancelación, respuesta tardía, error transitorio, StrictMode y recibo perdido. Los escenarios de acceso y concurrencia fallaron antes de la corrección.
- Regresión existente de asignaciones: 195 comprobaciones y 22 vistas aprobadas.
- Se conservan las huellas de todas las fuentes: baseline runtime de 483 rutas y manifiesto completo de convergencia, contrastados con el commit base. Sólo se actualizaron las fuentes efectivamente revisadas, con huellas anteriores/posteriores. No se retiraron controles ni se ignoraron pruebas.

Los navegadores usan componentes y contratos reales con sesiones y transporte sintéticos. No constituyen un circuito productivo autenticado, aceptación del proveedor ni prueba física NFC. Las demás regresiones, CI y estado de la candidata se registran en la PR al terminar, sin anticipar resultados.

## Puerta productiva pendiente
Esta entrega no cambia producción, API, esquema, variables, permisos, claves, cantidades, compradores ni registros de clientes. La activación coordinada sigue requiriendo API compatible, verificación/autorización del delta 0117–0121 y aceptación de sus lectores/escritores. Un acuse manual no se transforma en recepción autenticada externa. No se ejecutan migraciones ni se habilitan flags por este documento.
