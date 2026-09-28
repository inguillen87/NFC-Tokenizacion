# NexID — inicio editorial del pasaporte digital

## Alcance
Continuidad del dashboard publicado por PR #384, base `ce0e3535ce3916099454561efe8587d5c605a367`. Se cambia únicamente la entrada a Passport Studio: presentación de empresa/lote/producto, revisión del inicio y recuperación del recibo. Se conserva el editor existente y sus acciones de aprobación/publicación. No cambia API, esquema, reglas de autorización, claves ni interruptores comerciales.

## Regresiones reproducidas
Antes de modificar la implementación, cuatro aserciones fallaron: una respuesta marcada demo podía abrir el editor, un recibo de inicio sin identidad válida podía confirmarse, un 403 posterior a un resultado incierto podía perder la operación pendiente y un cambio de empresa/actor conservaba la confirmación anterior. La suite nueva reproduce esos escenarios con el componente real y transporte sintético.

El nuevo transporte exige procedencia productiva, recibo completo y correspondencia exacta de operación, actor, empresa, lote, plantilla, idioma y borrador inicial. El servidor conserva la autoridad de permisos y persistencia. Un recibo repetido confirma la operación original; no se interpreta como una nueva publicación.

El plazo de 15 segundos cubre cabeceras y cuerpo incluso cuando el transporte no coopera. La respuesta se limita a 256 KiB y UTF-8 válido. No hay redirecciones externas, reintentos automáticos ni escritura de contenido o credenciales en almacenamiento del navegador.

## UX y recuperación
La entrada muestra empresa, lote y producto, con tres pasos explicativos: borrador, revisión independiente y publicación. No se presentan como pasos ya completados. Plantilla e idioma deben confirmarse antes de revisar el inicio; cambiar una opción requiere otro consentimiento.

Revisar no realiza una petición. Sólo «Confirmar e iniciar» crea la operación. La confirmación recibe foco; Escape y «Volver a las opciones» lo devuelven al control de revisión. Las acciones concurrentes y el doble clic se bloquean mediante una referencia síncrona.

El texto explica que iniciar activa gestión editorial y bloquea la edición directa del contenido de ese lote, conservando sus valores. No publica, genera etiquetas, modifica claves ni certifica contenido físico. El borrador sigue requiriendo revisión y publicación por sus permisos existentes.

Si el resultado es incierto, los errores posteriores no eliminan la misma clave/carga. «Reconciliar el mismo inicio» comprueba esa operación. Una denegación retira los datos anteriores. Cambios de empresa, actor, permisos o fuente descartan el contexto previo; A → B → A no restaura consentimientos ni respuestas tardías. Un rerender equivalente conserva las opciones. Cerrar/recargar no revierte un inicio que haya sido guardado y puede perder la referencia local; la interfaz lo comunica.

## Validación local realizada
Dashboard: 1.892 pruebas aprobadas, cero fallos y dos omisiones preexistentes; incluye 53 nuevas pruebas de contrato, transporte, plazos y recuperación. TypeScript y custodia de secretos aprobados.

Nueva aceptación de navegador: 169 comprobaciones en 21 vistas, todas aprobadas, con StrictMode, 320/390/768/1440 px, temas claro/oscuro, teclado, recibo perdido, conflicto, denegación, cambio de contexto y textos largos. Sin infracciones de axe, excepciones o red externa inesperada en las vistas evaluadas. Se revisaron visualmente confirmación móvil clara y escritorio oscuro.

Regresión existente de puesta en marcha: 156 comprobaciones en 19 vistas aprobadas. La aceptación DOM existente de Passport Studio también aprobó. El harness PostgreSQL/browser integrado actualiza los selectores y la nueva confirmación, pero no se ejecutó en este bloque; no se presenta como una aceptación física o productiva.

Las huellas anteriores de convergencia y las 483 rutas preservadas se contrastaron contra la base. Se actualizó sólo la entrada modificada y se incorporaron las dos fuentes nuevas al manifiesto completo, sin retirar pruebas. CI y publicación se registran por commit en la PR cuando terminan.
