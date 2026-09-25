# NexID — retirada de expedientes y actualización sin pérdida de borradores

Fecha local: 2026-09-24. Base integrada: `20e26247baf2cf9c80d9019ca03686fb39d32842` (código `e1045dc9`). Rama candidata: `codex/nexid-request-read-safety-20260924`.

## Fallo reproducido

Una actualización de la bandeja que recibía 403 retiraba la lista, pero mantenía el expediente abierto y sus datos comerciales visibles. Se reprodujo con el componente real y transporte sintético: el test falló antes de modificar el código, sin errores de ejecución del navegador. No se afirma que se haya realizado una lectura productiva no autorizada: el problema observado era la conservación visual de datos previamente cargados.

## Corrección

Las lecturas de la bandeja y el expediente comparten ahora una reserva síncrona. No se puede iniciar otro guardado, abrir un expediente distinto o disparar un flujo hermano durante esa lectura, incluso antes de que React actualice los controles. El arranque de un enlace directo espera a la consulta inicial: una denegación no dispara después otra lectura del expediente.

Al actualizar una bandeja con expediente abierto se verifica también ese expediente con su empresa y referencia exactas. La omisión de una lista parcial no se interpreta como revocación: una respuesta positiva conserva el borrador y el componente de aclaraciones, sin sustituirlo ni enviarlo.

Una denegación 401/403 retira el contexto visible; un 404 del endpoint de lista no se presenta como una bandeja vacía autorizada. Un 404 de un expediente retira ese registro y conserva los otros registros confirmados, incluida la advertencia de lista parcial. El formulario retirado no se recupera automáticamente por una respuesta tardía.

Un error de transporte o servidor no se confunde con pérdida de autorización. Se conservan los cambios locales y se informa qué lectura no pudo confirmarse. La reserva también impide refrescar mientras hay una operación pendiente de recibo: no se borra ni reemplaza el comando que debe recuperarse de forma idempotente.

El botón Cancelar consulta aborta la lectura, invalida sus identidades antes de aceptar otra respuesta y devuelve el foco a Actualizar bandeja. Las respuestas de un contexto A anterior no vuelven a mostrarse después de A→B→A, aun si el transporte ignora abort. La cancelación no guarda cambios ni elimina registros.

## Alcance

Cambia el workspace compartido de solicitudes y agrega una política pequeña para clasificar denegaciones de lectura. No cambia handlers de negocio, contratos de recibos, sesiones, permisos, API, SQL, paquetes, flags ni metadatos de release. Los controles de servidor siguen siendo la autoridad de cada operación; una lectura positiva no se convierte en permiso para escribir.

Los historiales de cotización, proveedor, acuse, cancelación y asignaciones conservan sus contratos. Las operaciones cuyo resultado sigue incierto no se desmontan por una nueva actualización: esa actualización se rechaza antes de comenzar. Este incremento trata denegaciones de lecturas, no sustituye el control de cada escritura.

## Validación del candidato

El navegador reprodujo primero la exposición del expediente anterior tras un 403: una aserción falló sobre el código base, sin errores de JavaScript. La misma condición y sus variantes forman parte de la nueva suite.

Validación local del código actual: 15 pruebas unitarias nuevas; 1.597 pruebas del dashboard aprobadas, cero fallos y dos omisiones existentes; TypeScript y compilación completa aprobados. La nueva suite de navegador tiene 124 comprobaciones y siete vistas, sin infracciones detectadas por axe ni errores de cliente.

Incluye denegaciones de bandeja, detalle y comparación de versiones; enlace directo inicialmente denegado; omisión de listas parciales; fallos de conexión; borradores de solicitud y aclaraciones; cancelación de consulta; clics simultáneos; respuestas A→B→A y timeout real de veinte segundos. Se conserva un guardado cuyo recibo se perdió, verificando que el intento de refrescar no lo descarte ni cambie su clave.

Las capturas se revisaron en móvil claro y oscuro, y la matriz de retirada de acceso incluye 320, 390 y 1.440 píxeles. Los componentes y contratos son reales, pero las sesiones y el transporte del navegador son sintéticos. No se conectó una cuenta productiva ni se leyeron registros de clientes en esta aceptación.

El workflow existente conserva las suites anteriores y agrega la nueva para esta rama. Los resultados remotos se verifican por SHA, no por el hecho de haber configurado el workflow. Las pruebas SQL/API anteriores no se vuelven a presentar como pruebas nuevas de este cambio de interfaz.

## Publicación

Esta corrección parte del panel integrado pendiente de publicación. No incorpora por sí sola una migración ni habilita el circuito comercial en producción. La consola productiva anterior y la API runtime-diagnostics.1 se mantienen separadas; no se promovió esta rama.

La aceptación productiva de la combinación API/panel y el delta 0117–0121 continúa requiriendo la comprobación autenticada del endpoint y el esquema reales. La corrección de lecturas avanza la integridad de la candidata sin afirmar que ese cierre se haya realizado.
