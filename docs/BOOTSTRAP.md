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
- `CONSUMER_AUTH_MODE=demo|email|sms|whatsapp|production|provider`
- `demo`: no envia mensajes y retorna `code` cuando `DEMO_MODE=true`; usar solo local/demo controlada.
- `email`: envia OTP por Resend. Requiere `RESEND_API_KEY` y `CONSUMER_AUTH_FROM_EMAIL`.
- `sms`: envia OTP por Twilio SMS. Requiere `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `TWILIO_MESSAGING_SERVICE_SID` o `TWILIO_FROM_NUMBER`.
- `whatsapp`: envia OTP por Twilio WhatsApp. Requiere `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `TWILIO_WHATSAPP_FROM` o un `TWILIO_MESSAGING_SERVICE_SID` compatible.
- `production`: enruta email a Resend y telefonos a Twilio; `CONSUMER_PHONE_OTP_CHANNEL=sms|whatsapp` decide el canal del telefono.
- `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS` configuran expiracion e intentos.

## Flujo de ownership + NFT
- Estado 1 `MINT_RESERVED`: fabrica crea pasaporte interno con UID hash, lote, origen, tenant, fotos, reglas de claim y exportacion. No hay owner transferible.
- Estado 2 tienda/gondola: el tap muestra autenticidad, origen, mapa, lote y trazabilidad. El producto queda "Disponible para reclamar despues de compra".
- Estado 3 compra: idealmente POS/retailer genera `purchase_token`; si no, consumidor sube ticket/factura; fallback LATAM: tap fresco + email/SMS/WhatsApp verificado + evidencia opcional.
- Estado 4 claim: el score combina tap fresco, chip no clonado, sello coherente, ubicacion razonable, retailer/ticket e identidad verificada.
- Estado 5 NFT/wallet: si pasa, nexID crea wallet custodial o conecta MetaMask y mintea en Polygon/Amoy/mainnet segun tenant.
- Estado 6 reventa: vendedor crea link de transferencia y comprador debe tocar fisicamente el producto para completar ownership.
