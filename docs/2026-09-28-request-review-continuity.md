# NexID — continuidad y acceso seguro en aclaraciones

## Alcance
Incremento compatible del dashboard sobre `a523252d7a1c6fbb36955cfd13ce3b6fbfa964f8`, continuación de la publicación del expediente. No cambia API, contratos de release, esquema, permisos, claves NFC ni datos de clientes.

## Correcciones reproducidas
La prueba nueva produjo 14 fallos antes de modificar la implementación: las respuestas GET 401/403/404 conservaban el expediente y el historial anterior, y el segundo montaje de efectos en StrictMode dejaba la consulta sin terminar.

Una denegación confirmada al consultar aclaraciones ahora retira el expediente completo. Los estados 401/403 retiran el alcance visible; un 404 de expediente conserva otras solicitudes autorizadas. También se retira el texto local que pertenece al alcance revocado. Un fallo de red, contrato inválido o respuesta demo no se confunde con revocación ni habilita una acción con datos antiguos.

El cliente procesa esos estados GET antes de consumir el cuerpo de error. Los POST conservan el contrato anterior de recibo, incertidumbre y clave idempotente; ninguna consulta ocasiona un envío o reintento automático.

## UX y ciclo de vida
La consulta de aclaraciones se puede cancelar sin descartar el mensaje local. Cancelar invalida la operación antes de abortar el transporte; una respuesta tardía no puede sustituir una consulta posterior ni atravesar cambios A → B → A. Hace falta una nueva consulta confirmada para volver a revisar el envío.

La confirmación recibe foco; Escape y «Volver al mensaje» devuelven el foco al texto. Un recibo confirmado recibe foco. El historial indica cuántos mensajes están cargados y si quedan páginas anteriores, sin presentarlos como un total histórico completo.

## Validación local de implementación
- Dashboard completo: 1.462 aprobadas, cero fallos y dos omisiones preexistentes. Incluye 13 pruebas nuevas del transporte.
- Nueva suite de continuidad: 181 comprobaciones y 17 vistas aprobadas, con anchos 320, 390, 768 y 1.440, temas claro/oscuro, teclado, StrictMode, cancelación, respuestas tardías, paginación y recibo perdido.
- Regresión de solicitudes existente: 287 comprobaciones y 33 vistas aprobadas.
- TypeScript aprobado. Revisión visual directa de confirmación móvil de 320 px y consulta cancelada de escritorio oscuro.
- La huella de preservación mantiene sus 438 rutas. Se verificó la huella anterior contra el commit base y se actualizó únicamente por los dos archivos de aclaraciones modificados que pertenecen a ese conjunto; el expediente ya estaba excluido por una revisión anterior. No se eliminó ni omitió la prueba.

Las pruebas de navegador usan componentes y contrato cliente reales con sesión, transporte y registros sintéticos locales. No constituyen aceptación autenticada de un cliente productivo ni validación física NFC. La integración continua conserva todas las suites existentes y agrega esta regresión para la rama del incremento.

## Continuidad de release
La candidata avanzada `bbf5f39445aacbd4086f900ed7426a3596952937` permanece intacta. Cotizaciones, cancelación, operadores, proveedor y acuse siguen sujetos al cierre coordinado de API y delta 0117–0121; este incremento no los publica ni ejecuta migraciones. El estado de publicación se documenta por separado después de verificar el candidato y el dominio.
