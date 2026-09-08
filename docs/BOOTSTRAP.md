# SaaS Bootstrap (nexID)

## Objetivo
Inicializar de forma deterministica el primer `super_admin` y, opcionalmente, tenant demo.

## Comando
```bash
npm run bootstrap:saas --workspace=api
```

Opcional:
- `--with-demo`: crea/valida tenant demo aunque `DEMO_MODE` no este en `true`.
- `--dry-run`: valida configuracion sin escribir datos.

## Variables requeridas
- `DATABASE_URL`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

## Tenant demo opcional
Se crea unicamente cuando:
- `DEMO_MODE=true`, o
- se usa `--with-demo`.

Variables opcionales:
- `DEMO_TENANT_SLUG` (default `demobodega`)
- `DEMO_TENANT_NAME` (default `Demo Bodega`)

## Seguridad operativa
- El bootstrap es idempotente (upsert de usuario, membresias y permisos).
- No imprime valores secretos.
- El login normal no debe usarse como bootstrap implicito en produccion.

## Consumer OTP auth
- `CONSUMER_AUTH_MODE=demo|smtp|email|resend|sms|twilio|whatsapp|twilio_whatsapp|smart|production|provider`
- `demo`: simulación sólo local. Está bloqueada en producción, Vercel y Preview. `DEMO_MODE` no habilita un bypass productivo. El código nunca se expone por defecto; la depuración requiere `CONSUMER_AUTH_DEBUG_CODE_RESPONSE` y ejecución fuera de Vercel/producción.
- Modos desconocidos o credenciales incompletas fallan explícitamente; no existe un proveedor noop exitoso.
- `CONSUMER_AUTH_EMAIL_PROVIDER=smtp|resend`: selección explícita para emails, también en modo `smart`. No afecta al canal telefónico y no cae al otro proveedor si faltan credenciales. Un valor inválido falla con 503. Vacío conserva la prioridad histórica descrita debajo.
- `smtp`: sin override requiere `SMTP_USER` y `SMTP_PASSWORD`; servidor y remitente se definen con `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM_EMAIL`.
- `email`/`resend`: sin override prefieren SMTP si ambas credenciales SMTP están configuradas; en su ausencia usan Resend con `RESEND_API_KEY` y `CONSUMER_AUTH_FROM_EMAIL`. No se cambia automáticamente de proveedor después de un envío incierto.
- `sms`: envia OTP por Twilio SMS. Requiere `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `TWILIO_MESSAGING_SERVICE_SID` o `TWILIO_FROM_NUMBER`.
- `whatsapp`: envia OTP por Twilio WhatsApp. Requiere `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y un remitente dedicado `TWILIO_CONSUMER_OTP_WHATSAPP_FROM` o la configuración histórica `TWILIO_WHATSAPP_FROM`/`TWILIO_FROM_WHATSAPP` o `TWILIO_MESSAGING_SERVICE_SID` compatible.
- `TWILIO_CONSUMER_OTP_WHATSAPP_FROM`: remitente exclusivo de códigos WhatsApp del consumidor, en formato canónico `whatsapp:+` seguido de 8 a 15 dígitos, sin espacios y sin cero inicial. Si está definido, selecciona `From` directo e ignora el `TWILIO_MESSAGING_SERVICE_SID` compartido sólo en esa rama OTP. Vacío conserva exactamente los aliases y la prioridad históricos. Un valor inválido falla con `twilio_consumer_otp_whatsapp_from_invalid` (503); no cae al remitente compartido. No cambia SMS, email ni el remitente de pruebas de campañas. La configuración no acredita aprobación de la marca, disponibilidad del número ni entrega final.
- El Sandbox conocido de Twilio no es un remitente productivo: se rechaza antes del envío en producción/Preview cuando se usa directamente. Un Messaging Service necesita un pool productivo verificado; esta guarda no certifica su contenido.
- `TWILIO_WHATSAPP_AUTH_CONTENT_SID`: SID `HX…` de una plantilla de autenticación aprobada. Envía sólo variable `1` = código. Sin plantilla se conserva el texto libre, que no garantiza acceso fuera de una ventana de servicio abierta. No activar un número de otra marca ni declarar WhatsApp listo sólo por configurar un SID.
- `TWILIO_CONSUMER_OTP_STATUS_CALLBACK_URL`: URL HTTPS canónica terminada en `/twilio/consumer-otp/status`, sin query/fragmento. En `VERCEL_ENV=production` el default es `https://api.nexid.lat/twilio/consumer-otp/status`. Local y Preview requieren URL explícita para recibir callbacks. Firma Twilio y cuenta exacta obligatorias; no se permite bypass interno.
- `TWILIO_CONSUMER_OTP_INBOUND_WEBHOOK_URL`: URL HTTPS canónica terminada en `/twilio/consumer-otp/inbound`, sin query/fragmento. En `VERCEL_ENV=production` el default es `https://api.nexid.lat/twilio/consumer-otp/inbound`; local y Preview requieren URL explícita. Este webhook de mensajes entrantes es distinto del callback de estado y del inbound de campañas. Requiere `TWILIO_CONSUMER_OTP_WHATSAPP_FROM`, firma obligatoria, cuenta exacta y `To` idéntico al remitente dedicado. Rechaza formularios duplicados o mayores de 8 KiB y SIDs inválidos.
- El inbound OTP devuelve TwiML vacío: no responde mensajes, no verifica códigos por chat y no guarda ni registra texto, teléfonos ni códigos. Las repeticiones no generan mensajes ni cambios de CRM, consentimiento, challenges o sesiones; se conservan sólo los contadores técnicos de rate limit existentes. No necesita una nueva tabla de deduplicación. La indicación de ingresar el código únicamente en `https://nexid.lat/login`, nunca reenviarlo por chat, corresponde al perfil o plantilla del proveedor. No apuntar este número al inbound de promociones `/twilio/whatsapp/inbound`.
- `smart`/`production`/`provider`: enrutan email según la selección anterior y teléfonos a Twilio; `CONSUMER_PHONE_OTP_CHANNEL=sms|whatsapp` decide el canal del teléfono (SMS por defecto).
- `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS` configuran expiracion e intentos.
- El TTL por defecto es 10 minutos; la plantilla de autenticación recibe sólo el código, no una duración dinámica. Su aviso de expiración debe coincidir con el `OTP_TTL_MINUTES` efectivo. Cambiar un remitente o un SID no comprueba esta coincidencia ni la aprobación del proveedor.

### Qué confirma el resultado

`delivery.status=accepted` confirma sólo aceptación inicial del proveedor: destinatario aceptado por SMTP, recibo Resend válido o SID/estado saliente aceptado por Twilio. No certifica llegada a inbox/teléfono. Los contactos vinculados pueden recibir el mismo código: es entrega redundante, no autenticación de dos factores. `secondaryDelivery.status=failed` no invalida una primaria aceptada ni declara éxito multicanal.

Los registros `consumer_otp_provider_result` guardan proveedor, canal, estado/código seguro y hash del recibo. No contienen el código, enlaces de acceso, teléfono, correo completo, credenciales ni respuestas crudas. Para fallos posteriores a la aceptación se necesita el estado final del proveedor; no se debe volver a enviar repetidamente ni cambiar límites de seguridad para ocultar una falla.

El callback Twilio registra `consumer_otp_twilio_status` con el mismo hash de recibo, estado y código de error. No modifica sesiones, desafíos ni CRM, ni reenvía mensajes. Los eventos repetidos o fuera de orden quedan como evidencia de diagnóstico, no como una proyección de último estado.

Configuración de correo nexID preparada el 2026-09-08: `auth.nexid.lat` verificado en Resend, remitente `nexID <acceso@auth.nexid.lat>` y clave server-side restringida al envío desde ese dominio. SMTP/Private Email se conserva. Verificar el despliegue efectivo y el evento de entrega de Resend antes de certificar el flujo. OTP no inscribe por sí mismo en campañas ni concede premios o beneficios.

Pruebas: `npm run test:consumer-otp --workspace=api` (también incluidas en el build de producción).

## Flujo de ownership + NFT

> Estado operativo 2026-07-26: esta secuencia describe el modelo objetivo, no
> un flujo completo disponible hoy. El piloto desplegado puede confirmar mints
> en Polygon Amoy cuando existe recibo y verificacion on-chain. La transferencia
> ERC-721 generica, la reventa/P2P, el settlement de pagos y mainnet no estan
> implementados; esas acciones permanecen como solicitudes o roadmap hasta
> contar con executor dedicado, consentimiento, recibo, finality y `ownerOf`
> verificados.

- Estado 1 `MINT_RESERVED`: fabrica crea pasaporte interno con UID hash, lote, origen, tenant, fotos, reglas de claim y exportacion. No hay owner transferible.
- Estado 2 tienda/gondola: el tap muestra el resultado de la evidencia NFC/QR, origen declarado, ubicacion reportada de la lectura, lote y trazabilidad registrada. El producto queda "Disponible para reclamar despues de compra".
- Estado 3 compra: idealmente POS/retailer genera `purchase_token`; si no, consumidor sube ticket/factura; fallback LATAM: tap fresco + email/SMS/WhatsApp verificado + evidencia opcional.
- Estado 4 claim: el score combina mensaje NFC fresco, controles anti-replay, estado TT reportado cuando aplica, ubicacion reportada, retailer/ticket e identidad verificada. Ninguna señal aislada certifica el producto fisico.
- Estado 5 solicitud NFT/wallet: si pasa la policy, nexID puede crear una solicitud y, en el piloto Amoy, confirmar un mint solo despues de verificar recibo y estado on-chain. Mainnet requiere una promocion separada y no se presenta como operativo.
- Estado 6 reventa/transferencia (roadmap): el vendedor puede iniciar una solicitud, pero hoy nexID no ejecuta ni confirma transferencia ERC-721, compra o settlement P2P. Un tap fisico futuro sera una condicion adicional de policy, no prueba suficiente de ownership ni una transferencia por si mismo.
