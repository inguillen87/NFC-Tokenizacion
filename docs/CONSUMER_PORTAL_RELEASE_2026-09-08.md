# Portal consumidor y acceso — 2026-09-08

## Publicación verificada

- Web: `ce3faf9b`, `2026.09.08-web.1`, deployment `dpl_E8c1DHjZpVC47Q5tbaQS6QAMmRJM`.
- API inicial: `d96640af`, `2026.09.08-api-otp.1`, deployment `dpl_6p9WSCSgSDwboWwgkJsWvQ4fvftG`.
- Ambos builds READY y promovidos por separado. `/release.json` coincide en nexid.lat y nexid.com.ar; API verificada en api.nexid.lat.

## Alcance

Inicio y productos guardados con datos reportados, cuatro destinos principales y menú Más accesible; claro/oscuro, textos simples y enlaces de lectura/experiencia/catálogo existentes. Se retiraron del inicio simuladores de comercio y valores/imágenes de relleno. No se implementaron pagos, transferencias, campañas ni nuevas funciones de rewards en este sprint.

Login con reenvío explícito, cambio de canal que limpia el código anterior, etiquetas accesibles y mensajes de aceptación del proveedor sin declarar entrega al destinatario. Autenticación y sesión siguen siendo obligatorias.

## QA

- 487/487 pruebas web; TypeScript y revisión de diff aprobados.
- API: 335 pruebas focales de OTP, seguridad, límites y consumer; build de producción ejecutó además las suites de regresión configuradas.
- Navegador local aislado: home con datos sintéticos, navegación a productos, estados vacío y sin respuesta, modo claro/oscuro, menú móvil Más, Escape y devolución del foco al botón. El servicio local está limitado a 127.0.0.1 y requiere `--local-qa`; no es una ruta desplegada.
- Viewport móvil del navegador de QA: ancho CSS 453, documento 436, sin desborde horizontal. La captura del IAB presenta recorte por escala; no se usa como certificación de un teléfono físico de 390 px.
- Producción: nexid.com.ar/me conserva el dominio y redirige al login consumidor sin sesión; controles nuevos visibles.

## Primer intento: entrega no certificada (histórico)

Pedido autorizado realizado desde el login público a las 15:01:48 UTC. SMTP reportó accepted=1/rejected=0 y Twilio WhatsApp respondió 201/queued. El usuario confirmó que no recibió ninguno. Esa evidencia NO permite afirmar que ambos canales funcionan de punta a punta. Sigue pendiente identificar rechazo/retención posterior en los proveedores y validar el ingreso real con un código recibido por el usuario.

No se leyeron códigos ni se fabricó una sesión productiva. En ese primer intento, la prueba del portal con datos reales autenticados seguía pendiente del acceso. Este resultado queda reemplazado por la evidencia posterior de cada canal indicada abajo.

## Fase 2: email entregado e ingreso confirmado

- Web: `9cd037a127cd1d2a5290c965e6e420953237cec4`, release `2026.09.08-web.2`, deployment `dpl_Cinsb5Qr9CESZYFWsDYuiXZjj6mW`.
- API: `5a545657b5372ae1068a44a4331e993220135e52`, release `2026.09.08-api-otp.2`, deployment `dpl_DDWwgHXHHuUA6K1VGQLveNh9sThE`.
- Builds READY y promovidos. La web orienta hacia email cuando WhatsApp no está disponible; 13 pruebas focales nuevas aprobadas.
- Resend configurado explícitamente para autenticación, dominio de envío `auth.nexid.lat` verificado y remitente `nexID <acceso@auth.nexid.lat>`. No se modificaron los MX de Private Email del dominio raíz.
- Pedido único de QA desde el navegador de producción aproximadamente a las 13:19 ART. Resend mostró **Delivered**, recibo `2e4de7ab-e2a7-4362-bafb-f7b57b903532`.
- El usuario recibió el email, ingresó personalmente el código y confirmó que accedió al portal. **Email: entrega e ingreso de punta a punta confirmados.** No se leyó el cuerpo del email ni su código.

## Fase 3: WhatsApp NexID dedicado y entrega real

- API: `afa7c5b5346e046cdac1fc0e2d53e7080e28ee38`, release `2026.09.08-api-otp.3`.
- Deployment `dpl_5BNA3q4uWh6WuoLgCzP1jgTtqi27`, URL inmutable `https://nexid-iirhl0med-marcelos-projects-c26aa499.vercel.app`.
- Publicado primero sin mover el dominio, inspeccionado READY y promovido después. `https://api.nexid.lat/release.json` confirmó la versión `.3`.
- Causa del fallo previo: el envío del mediodía utilizaba el Sandbox. Twilio terminó en **Failed / 63015**, aunque inicialmente había aceptado la solicitud. No se considera `queued` como entrega.
- Por decisión explícita del usuario se reutilizó el número existente `+18564858589`; se canceló la compra de otro. `TWILIO_CONSUMER_OTP_WHATSAPP_FROM` aísla el remitente de autenticación de las configuraciones compartidas de campañas/SMS.
- Plantilla propia `nexid_login_code_es`, categoría Authentication, idioma español, botón de copiar código y expiración de 10 minutos. Content SID `HX904a9c24e9b213e70b07b8d284743360`: **Approved** en Twilio.
- Perfil guardado con logo oficial del repositorio, sitios `nexid.lat` y `nexid.com.ar`, contacto público `info@nexid.lat` y descripción NexID. Se desvincularon de este número el servicio de mensajes compartido y la aplicación de voz Chatboc; el otro número no fue modificado.
- Entrada privada en `/twilio/consumer-otp/inbound`: valida firma/cuenta/destinatario y responde TwiML vacío. No interpreta respuestas como consentimiento, no registra cuerpos ni crea contactos, campañas o recompensas.
- Callback `/twilio/consumer-otp/status`: firma obligatoria y auditoría acotada a recibo, estado y código de error, sin OTP ni destinatario.
- QA: 66/66 pruebas de OTP/callback/inbound, TypeScript y diff aprobados; suites focales adicionales de autenticación, límites y consumidor aprobadas. Build de producción completado.
- QA negativo real: ambos endpoints rechazaron formularios sin firma con 403 y cuerpo vacío, `no-store`, sin bloqueo previo del origen. No se enviaron datos personales en esas sondas.
- Pedido único de código desde el login de producción a las **13:43:32 ART**. Twilio mostró **Delivered** desde el número elegido al teléfono autorizado del usuario; recibo `MM53c7d25c4fc50ef66617b996ffb37daf`. No se abrió el contenido del mensaje.
- **WhatsApp: entrega confirmada por el proveedor.** Falta la confirmación del usuario de ingreso con ese código; no se atribuye la prueba exitosa por email al canal WhatsApp.

## Pendiente externo: nombre visible del remitente

Solicitud oficial de cambio de `chatboc.ar` a `nexID` presentada a Twilio: [ticket #29439677](https://help.twilio.com/tickets/29439677), acuse recibido el 2026-09-08 a las 13:24 ART. El acuse no es aprobación de Meta. Mientras se revisa, el nombre anterior puede seguir apareciendo aunque el logo, perfil y plantilla ya estén configurados.

No se activaron envíos promocionales, consentimientos automáticos, membresías premium ni beneficios por el solo hecho de iniciar sesión. Este cierre corresponde al acceso del consumidor, no a una certificación completa de todos los módulos de la plataforma.
