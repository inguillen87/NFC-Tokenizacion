# Meta WhatsApp OTP: adaptador preparado, activación pendiente

Este incremento nace del API publicado `9c10e5c50912d58ee9e1177fa5b7849c2211b69b` y agrega una opción de WhatsApp Cloud API para el acceso del consumidor. Twilio sigue siendo el valor predeterminado. La implementación no cambia SMS, email, los desafíos de autenticación, los permisos NFC, el guardado de productos ni los contratos de tenant.

## Estado verificable

| Trabajo | Estado |
| --- | --- |
| Transporte Meta, selección explícita y errores HTTP | Implementado en una rama API separada |
| Pruebas | OTP 84/84 y runner completo API 1696/1696; transportes, respuestas y SQL sintéticos, sin mensajes reales |
| Build local | Build de producción explícito con Webpack aprobado, incluido typecheck completo; Turbopack predeterminado bloqueado por junction de dependencias |
| Variables nuevas del API en Production | Las seis claves no figuraban en la consulta de metadatos del 03/10/2026; no se leyeron valores |
| App, WABA, teléfono, token y plantilla Meta | Requieren comprobación y configuración específica de NexID |
| CI, Preview y publicación de este API | Pendientes; las pruebas locales no los sustituyen |
| Entrega a un teléfono y aceptación del usuario | No comprobadas |

El incidente observado de Twilio devolvió HTTP 401 y código 20003. Ese código indica autenticación o permisos; no prueba saldo insuficiente. El correo tuvo aceptación del proveedor y el guardado devolvió HTTP 200. Esas observaciones no prueban llegada al buzón ni persistencia por una comprobación independiente.

## Separación de cuentas y remitentes

La app de Meta debe ser nueva y exclusiva de NexID. No se reutilizan apps, tokens, números ni activos de ObraSaaS, MuniControl u otros proyectos. El remitente configurado por este adaptador es el de **acceso global de consumidores NexID**. No se obtiene de un tenant ni de su configuración de campañas.

Una app, una WABA y una plantilla son recursos distintos. La app no pasa a ser dueña de las plantillas por estar conectada: deben comprobarse la WABA propietaria y los permisos del token. La futura incorporación de marcas al marketplace necesita WABAs de sus respectivos dueños, onboarding autorizado, permisos y selección aislada por tenant. Este incremento no implementa ese marketplace ni una migración de números existentes. La condición Tech Provider tampoco acredita un remitente registrado, un token utilizable o una plantilla aprobada.

## Contrato del envío

`CONSUMER_WHATSAPP_PROVIDER` vacío o `twilio` conserva el transporte anterior. `meta` selecciona exclusivamente Meta para WhatsApp. Otro valor, o una configuración Meta incompleta, produce error sin llamar a Twilio. El modo local `demo` sigue siendo una simulación identificada. En `smart`, `CONSUMER_PHONE_OTP_CHANNEL=whatsapp` selecciona ese canal; el valor SMS predeterminado se conserva.

Meta requiere estas cinco claves, además del selector:

| Clave | Comprobación local |
| --- | --- |
| `META_CONSUMER_OTP_GRAPH_VERSION` | Versión explícita con formato `vN.0`, sin rutas ni host configurable; su vigencia debe comprobarse en Meta |
| `META_CONSUMER_OTP_PHONE_NUMBER_ID` | Identificador numérico del teléfono registrado, sin URLs ni caracteres de ruta |
| `META_CONSUMER_OTP_ACCESS_TOKEN` | Valor privado acotado, sin espacios ni controles; validez, caducidad y permisos se comprueban aparte |
| `META_CONSUMER_OTP_TEMPLATE_NAME` | Nombre en minúsculas, dígitos y guiones bajos, máximo 512 caracteres |
| `META_CONSUMER_OTP_TEMPLATE_LANGUAGE` | `es`, `es_AR`, `es_ES`, `es_MX`, `pt_BR`, `pt_PT`, `en`, `en_US` o `en_GB` |

El endpoint está fijado en `https://graph.facebook.com/{version}/{phone-number-id}/messages`. Se envía una plantilla **AUTHENTICATION con botón COPY_CODE**, con el mismo código de seis dígitos ASCII en el parámetro del cuerpo y en el botón `sub_type: "url"`, `index: "0"`. No se envían enlaces mágicos, capacidades NFC, ubicación ni información del tenant. El receptor debe llegar ya normalizado con prefijo internacional `+` y entre 8 y 15 dígitos; el adaptador no elimina caracteres ni intenta adivinar un país.

Hay un solo intento, sin redirecciones ni reintentos automáticos. El plazo de 10 segundos cubre la conexión, los headers y la lectura de la respuesta. La respuesta se limita a 16 KiB de bytes reales antes de decodificar JSON. Un timeout no prueba que el proveedor haya descartado el mensaje; no se lo presenta como entrega ni se intenta otro proveedor automáticamente.

Sólo un HTTP 2xx con `messaging_product: "whatsapp"` y exactamente un identificador `wamid.` válido produce `status: "accepted"`. Si `message_status` existe debe ser `accepted`; estados contradictorios o desconocidos se rechazan. Los campos `contacts.input` y `wa_id` pueden diferir según Meta y no se exige igualdad. El recibo bruto, el número, el OTP, el token y los textos de errores del proveedor no se registran. La auditoría conserva únicamente una huella del recibo y enums/números saneados. **Aceptado no significa entregado o leído**; este incremento no agrega webhooks de entrega Meta.

La API responde 503 por selección/configuración inválida o autenticación del proveedor (HTTP 401/403 o código OAuth 190, incluso con HTTP 400), 504 por timeout y 502 por fallo de transporte o recibo inválido. No se amplían los permisos ni se crea otro factor de autenticación.

## Puertas de activación

1. Revisar el diff y cerrar los checks de la rama API exacta. Mantener separadas las publicaciones WEB, API y dashboard. La excepción de dependencias propuesta para WEB continúa pendiente de autorización y no se aplica aquí.
2. Comprobar la nueva app NexID, su Business Portfolio y la WABA del remitente global. No migrar ni desregistrar un número existente como efecto de este cambio.
3. Verificar que el Phone Number ID pertenece a esa WABA y que el teléfono está registrado y habilitado para Cloud API.
4. Generar y custodiar un token de servidor con permiso `whatsapp_business_messaging` y acceso al activo correcto. Las operaciones de administración/onboarding tienen requisitos adicionales; no se infieren desde la aceptación de un envío. Nunca introducir este token en WEB, dashboard, `NEXT_PUBLIC_*`, Git, capturas o logs.
5. Verificar en la WABA una plantilla aprobada, categoría AUTHENTICATION, idioma exacto y botón COPY_CODE. Confirmar que el texto de caducidad coincide con el TTL del desafío. El nombre por sí solo no permite al código certificar la categoría o aprobación.
6. Configurar las claves privadas únicamente en el API y validar una Preview antes de cualquier cambio de Production. Un deploy del código con el selector vacío conserva Twilio; una activación Meta se realiza después de estas verificaciones.
7. Verificar la integración de los nuevos códigos `meta_*` con el UX de WEB. La rama WEB incorpora mensajes específicos y recuperación por email; su comprobación en navegador y su publicación siguen siendo requisitos antes de activar Meta.
8. Con destinatario de prueba autorizado, realizar una aceptación física controlada del código y del regreso al flujo cliente. Registrar aceptación del proveedor, entrega y verificación como estados distintos. Conservar rate limits y no usar clientes reales como pruebas.

No hay valores de credenciales en este documento ni en `.env.example`. Si una puerta falta, el adaptador permanece sin activar. La animación del portal continúa sin reproducirse y este código no la declara resuelta.

## Continuidad del producto por email

El incremento posterior al candidato `fa594d70be0806d3f6f3aac7ea0285ba1e56cbdb` admite `next` opcional en el inicio del acceso. Lo valida dentro de la API y nuevamente al construir el enlace SMTP/Resend. Sólo conserva rutas existentes de `/me`, referencias canónicas de lecturas/productos/tenant y una selección de acción conocida. Duplicados o valores permitidos inválidos vuelven a `/me`; parámetros desconocidos y fragmentos se eliminan. El destino no se persiste en el desafío ni se incluye en la respuesta pública o auditoría.

Los enlaces no incluyen firmas NFC, identificadores del chip, capacidades de TAP, ubicación precisa u otros parámetros del teléfono. La selección no concede autorización ni guarda un producto automáticamente: la sesión y la acción explícita siguen siendo requisitos de las rutas existentes. Abrir el correo en otro navegador no transfiere el cookie de TAP ni extiende su caducidad. Los mensajes SMS/WhatsApp y enlaces habituales sin `next` conservan su contenido anterior. Esta continuidad necesita la publicación de los candidatos WEB y API; todavía no funciona en la API publicada.

Las comprobaciones del incremento se registran en recibos nuevos, vinculados a su fuente exacta. Las cifras de validación siguientes corresponden al candidato anterior y no certifican este cambio posterior.

## Validación reproducible y fuentes

- `npm run test:consumer-otp --workspace api`: suites OTP nuevas y existentes, usando transportes controlados.
- TypeScript estricto del módulo Meta y del provider, sin ejecución de rutas ni conexión a servicios.
- Runner API completo con entorno test filtrado: 35 resúmenes de suites, 1696 pruebas aprobadas y cero fallos/skips. Gate de custodia de secretos y `git diff --check` aprobados.
- Revisión independiente de timeout completo, lectura acotada, recibos contradictorios, diagnóstico saneado y selección sin fallback.

La compilación local intentó primero el compiler predeterminado: Turbopack rechazó el junction de `node_modules` hacia el checkout base. Un segundo intento explícito con `--webpack` compiló la fuente y se detuvo en el typecheck por un Prisma Client sin generar. Se preparó ese prerrequisito dentro de `apps/api/node_modules` ignorado, mediante copias mínimas de los vendors ya instalados y engines oficiales de Prisma 5.22.0, versión exacta del lockfile. Los dos SHA256 de engines se verificaron contra los checksums de la CLI y el engine del cliente generado coincide. La primera preparación había bloqueado la descarga; su registro y ambos builds fallidos se conservaron. Un recibo posterior corrigió únicamente el nombre de archivo esperado por el verificador de engines (`schema-engine-windows.exe`).

Con el prerrequisito local completo, el nuevo build `next build --webpack` aprobó compilación, TypeScript y generación de páginas. No se cambió la configuración del compiler, no se ignoraron errores de tipos, no se tocaron dependencias del checkout base y no se configuró/conectó una base externa. Esta prueba con compiler alternativo no acredita el build Turbopack predeterminado ni CI. CI, API Preview y validación del proveedor siguen siendo puertas reales antes de publicar; no se despliega una Preview con credenciales reales automáticamente desde este trabajo.

La forma de COPY_CODE y el recibo se verificaron en la [documentación oficial Meta de autenticación](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/copy-code-button-authentication-templates), también disponible en la [colección propiedad de Meta](https://www.postman.com/meta/whatsapp-business-platform/request/6vkv46u/create-authentication-template-w-otp-copy-code-button). El [pacing de plantillas](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pacing) describe `held_for_quality_assessment` para marketing/utilidad y no justifica aceptar ese estado como OTP AUTHENTICATION. El [SDK oficial de Meta](https://github.com/facebook/facebook-android-sdk/blob/main/facebook-core/src/test/kotlin/com/facebook/FacebookRequestErrorTest.kt) trata HTTP 400 con código 190 y `OAuthException` como fallo recuperable de login. La [definición oficial de Twilio 20003](https://www.twilio.com/docs/api/errors/20003) sustenta el diagnóstico acotado del incidente.
