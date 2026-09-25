# NexID — cierre de bandeja de solicitudes y lectura segura

Base publicada verificada: `ca437bfb477b5dfb0dacd07ddedbe8eddd342daf`.
Rama: `codex/nexid-request-inbox-ux-20260925`.
Este documento describe el candidato; la promoción se registra aparte después de CI y comprobación canónica.

## Entrega visible

La bandeja incorpora contadores accionables sobre la respuesta cargada: todas, borradores, empresa debe responder y NexID debe revisar. Los grupos describen borradores/aclaraciones, no todas las tareas comerciales ni totales históricos.

Búsqueda por varias palabras combinando título, empresa, referencia e identificador de construcción, sin distinguir tildes/mayúsculas. No indexa notas, motivos privados ni datos no cargados. Mantiene el orden de la consulta por defecto y añade orden cronológico reciente/antiguo y prioridad de revisión según empresa o NexID. Los estados sin confirmar no se asumen aprobados.

Cada fila indica próximo paso, fecha UTC y referencia completa. El expediente abierto se destaca. Al excluirlo con filtros se conserva la edición y aparece un enlace al editor dentro de la misma página. Limpiar búsqueda y filtros restaura el foco al buscador sin reconsultar la API. Un listado fallido no se presenta como cero solicitudes.

Los filtros y ordenación son locales, sin autosave ni almacenamiento del contexto en el navegador. Abrir una fila conserva la referencia y empresa del registro validado y llama al mecanismo existente de lectura; no envía una orden ni concede autoridad.

## Cierre de lectura segura en la base productiva

Se trasladan desde `37675a98` los controles de lectura ya probados en la candidata avanzada, excluyendo sus módulos no publicados. No se anuncian como un segundo desarrollo de esos controles. Las lecturas se secuencian, admiten cancelación y descartan respuestas tardías; la apertura inicial de un enlace espera a que termine la consulta de la bandeja.

Actualizar una bandeja con expediente abierto hace una revalidación adicional de ese expediente por su referencia y empresa. La ausencia en una respuesta parcial no demuestra revocación. Si sigue autorizado, conserva borrador y aclaraciones; una revisión diferente informa el cambio sin sobrescribir la edición. Si la fuente deniega acceso, retira el expediente y sus controles. Un fallo transitorio no se confunde con revocación.

Las lecturas no compiten con un guardado pendiente o incierto; los reintentos mantienen la misma clave y contenido. La API, los permisos, las revisiones y los recibos permanecen intactos. El panel productivo no incorpora estados o módulos que requieran 0117–0121.

## Validación local final

- Suite completa: 1.394 aprobadas, cero fallos y dos omisiones existentes. Incluye 21 pruebas nuevas de bandeja y 15 de política de lectura trasladadas, no creadas nuevamente.
- TypeScript y compilación completos aprobados.
- Nueva bandeja: 142 comprobaciones y 13 vistas. Lecturas: 124/7; guía de formulario: 171/12; solicitudes completas: 287/33; runtime/notificaciones: 62/6. Total local: 786 comprobaciones y 71 vistas.
- Se inspeccionó visualmente móvil claro de 320 px; la matriz también cubre 390/1.440 px, claro/oscuro. Los reportes no detectaron infracciones de axe; no es una certificación integral de accesibilidad.

Navegador con componentes reales, HTTP local y sesiones/transporte sintéticos. No se crearon solicitudes de clientes ni se certificó un recorrido con cuenta productiva. La primera prueba de búsqueda detectó un escape incorrecto al generar el código; se corrigió. La prueba de apertura se hizo esperar al contenido de la respuesta, no sólo a un input que ya existía. No se omitieron aserciones.

Sólo se retiró .next del checkout anterior después de verificar que no estaba versionado ni asociado a un proceso Node de esa ruta. Fuentes, dependencias, evidencias, configuraciones y Descargas se conservaron.

El manifiesto de runtime continúa comprobando las mismas fuentes inalteradas. El workspace ya estaba excluido de ese conjunto porque había sido revisado en el sprint de formulario; se cubre aquí con su diff y pruebas funcionales. Se mantienen los módulos productivos de runtime/notificaciones y las API existentes sin modificaciones.

## Publicación e integración

El workflow incorpora la nueva bandeja y los controles de lectura, manteniendo las suites anteriores. Antes de promover se debe comprobar el CI del commit exacto y el artefacto con configuración productiva, sin asignar dominios automáticamente.

La candidata comercial avanzada debe recibir esta misma bandeja sin reemplazar sus controles de cancelación, cotización, proveedor, acuse o disponibilidad. El cierre de integración y su CI quedan consignados por separado. Esta publicación no ejecuta migraciones, modifica permisos ni habilita flags.

## Cierre verificado

Publicado el bloque compatible de bandeja: `5919edb8375d894df27523046fc6c83d254d4880`, READY en el dominio canónico después de CI 36142093667 y seis comprobaciones HTTP. La API sigue en `c21a0a776247d5109706e52db5895e817ea42cb9`, sin modificaciones. El contrato de negocio .41 permanece intacto.

La candidata avanzada integrada `3d58dec553ba6513967b2cbac1cb42023a68e87d` también terminó con CI 36142936439 aprobado, sin promoverla. Las tres fuentes de la bandeja coinciden entre ambas líneas. Las pruebas locales integradas suman 266 comprobaciones en 20 vistas; las productivas, 786 en 71. La validación con cuenta real permanece separada: las sesiones y transportes del navegador fueron sintéticos.

Evidencia por SHA: docs/releases/2026-09-25-request-inbox-validation.json. No se aplicaron migraciones ni cambiaron permisos o flags. El siguiente commit registra sólo este cierre, no modifica el código probado o desplegado.
