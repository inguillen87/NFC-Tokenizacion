# NexID: recuperación de consultas y experiencia del cliente

Base publicada revisada: web `2026.10.01-web-sun-mobile.2`, fuente `45ce24ebee11bd590f315771bc00af2f4e70d52e`, integrada en `5976b476cd61e7e9ab0f436fc1e0bbdfa4be02cd`. Incremento exclusivo del frontend web; ningún cambio de runtime API/dashboard, migración ni dependencia.

## Problemas comprobados

- El snapshot inaccesible se convertía en un fallback sin identidad confirmada, y su presentación reutilizaba mensajes rojos de riesgo/repetición. No era evidencia de un TAP físico fallido.
- El fallback declaraba soporte TagTamper sin datos suficientes. Las referencias incompletas y `/sun` podían convertirse en muestra sin una elección explícita.
- `/register` ofrecía campos y un botón sin envío implementado.
- El formulario de experiencias aceptaba un HTTP 200 con cuerpo vacío como guardado y borraba el borrador. La respuesta actual de API contiene un registro persistido con identificador, referencia, privacidad y estado de moderación.
- Las tarjetas de productos reunían acciones secundarias junto a la principal; la ficha, la URL y el botón Atrás no conservaban un mismo estado.
- Al abandonar una verificación automática, el acceso podía conservar el bloqueo de espera aunque la respuesta ya no correspondiera a la pantalla.
- Experiencias tenía texto oscuro sobre superficies oscuras en modo claro; además, afirmaba ausencia de reservas y visitas sin consultar esos datos.

## Cambio concreto

SUN separa disponibilidad de consulta y resultado NFC. Una consulta inaccesible explica que no se pudo abrir el registro; una interrupción del servicio no se presenta como rechazo NFC. Las entradas incompletas no llaman al endpoint que consume una lectura. La muestra requiere una elección explícita. Los GET de evidencia tienen un límite de ocho segundos que incluye la lectura del cuerpo, no reintentan y no siguen redirecciones.

El acceso presenta dos pasos, etiquetas visibles, foco en el código, mensajes asociados al campo y borradores conservados. Cada solicitud tiene un límite de doce segundos; una respuesta perdida no implica que el mensaje no haya salido. Ninguna solicitud se repite automáticamente. El ingreso sigue exigiendo el acuse de verificación y una sesión autenticada. La salida sólo navega cuando se confirma la revocación. Registro ofrece los accesos reales al Pasaporte y al contacto comercial.

La colección usa una acción principal por tarjeta y mantiene los secundarios dentro de la ficha. «Más» agrupa los destinos existentes por intención. La ficha sincroniza una referencia única perteneciente a la cuenta con la URL y el historial del navegador. Los avisos desconocidos tienen un estado visible y orientación para iniciar el reporte desde una lectura habilitada, sin trasladar credenciales.

Experiencias conserva comentario y foto ante un acuse inválido, bloquea envíos simultáneos y distingue preparación de foto y envío. La calificación funciona con teclado; OTP y reporte mejoran foco y feedback. Los permisos, la validación de compra, los contratos y los controles anti-replay conservan su autoridad en API.

La página completa de experiencias usa superficies y contrastes propios para ambos temas. Reservas y visitas se muestran como información no disponible en esa pantalla. Al salir de la verificación automática se liberan los controles; una respuesta tardía no cambia el estado ni inicia otra solicitud.

## Criterio de diseño

El trabajo sigue las recomendaciones de [W3C para feedback de formularios](https://www.w3.org/WAI/tutorials/forms/notifications/) y [GOV.UK para recuperación de errores](https://design-system.service.gov.uk/components/error-summary/): mensajes claros, asociación con campos, foco y recuperación. La [documentación de cuentas de cliente de Shopify](https://shopify.dev/docs/apps/build/customer-accounts) sirve como referencia para concentrar historial y acciones. No se midió rendimiento de competidores ni se afirma superioridad universal.

## Validación y publicación

La revisión local usa componentes reales y páginas de Next con respuestas y contactos sintéticos, en 320/390/768/1440 y temas claro/oscuro. Estas pruebas no certifican una sesión real, entrega de OTP, un TAP físico nuevo ni GPS en un teléfono. Las operaciones del navegador se interceptan localmente. No se usan enlaces NFC reales para repetir lecturas ni se escriben datos de clientes.

La versión propuesta es `2026.10.01-web-client-experience.1`. Este documento describe el cambio preparado; la publicación sólo se confirma en la PR y en el informe de entrega cuando coincidan SHA, CI, preview, producción preparada y aliases públicos. Las aplicaciones API y dashboard se verifican por separado. El informe de entrega registra el resultado exacto de estas puertas y las mediciones que efectivamente se hayan realizado.
