# nexID · Kit de integración 1.0.0

SDK server-side existente + importador CSV de recepciones declaradas + receptor
webhook firmado. Se ejecuta fuera del monorepo. Requiere Node.js 24.14 o superior;
verificado con Node.js 24.15.0. Usa SQLite local de Node: no requiere Neon adicional,
un broker, otro ORM, otro SDK, Docker ni una cuenta npm privada.

El paquete SDK incluido es @product/nexid-server-sdk 0.2.0. Permanece privado;
esta distribución descargable no lo publica en npm. El SDK es exclusivo de backend.
No cargar sus credenciales en un frontend, app móvil, captura o chat.

## 1. Probar sin acceso al repositorio ni cuenta de producción

Extraer el archivo en una carpeta de trabajo nueva. En esa carpeta:

```sh
node verify-kit.mjs
npm install --offline --ignore-scripts --no-audit --no-fund
npm test
```

La instalación usa el paquete local vendor, no descarga otro SDK. Las pruebas
usan datos sintéticos, HTTP loopback y SQLite locales. No requieren API key, no
llaman a Neon y no realizan TAPs. El resumen debe indicar todos los casos aprobados.
SHA-256 comprueba integridad respecto del manifiesto: no es una firma digital.

## 2. Conectar sólo lectura

En el dashboard de nexID, crear una credencial para la empresa y el servicio con
scope `sdk:products`. No otorgar `*` ni scopes de autenticación NFC si no se usan.
Cargar NEXID_API_KEY en el entorno del proceso, nunca como argumento de la CLI.
No pegar la credencial en el CSV ni en archivos del kit.

```sh
node src/cli.mjs doctor --tenant mi-empresa --bid MI-LOTE
```

Hace una consulta de producto y comprueba empresa + BID. No demuestra acceso de
escritura, firma de webhook ni calidad física. No crea cuentas, lotes o etiquetas.
Los errores se imprimen resumidos, sin volcar cuerpos ni credenciales.

## 3. Importar recepciones desde un ERP/WMS por CSV

Este es un adaptador de intercambio CSV, no un conector nativo certificado para
un ERP específico. El ERP/WMS conserva su autoridad y debe emitir un identificador
estable para cada recepción. No se genera un ID nuevo al reintentar.

Formato UTF-8, cabecera exacta, fechas ISO con zona horaria:

```csv
external_id,bid,occurred_at,facility
RECEPCION-00042,MI-LOTE,2026-09-18T12:30:00-03:00,DEPOSITO-01
```

`external_id`: ID de recepción del sistema origen. `bid`: lote registrado en NexID.
`facility`: código de instalación, no dirección personal ni coordenadas.
No incluir UID, URL SUN, picc_data, enc, CMAC, secretos, personas o datos libres.
La CLI admite 500 filas y 512 KiB por archivo; valida todo antes de persistir.

```sh
node src/cli.mjs plan --tenant mi-empresa --connector erp-main --file recepciones.csv
node src/cli.mjs status --tenant mi-empresa --connector erp-main
```

Planificar valida y guarda una cola local. No realiza llamadas de red. Cambiar
los datos bajo el mismo ID comercial falla; no pisa una recepción anterior.
No cambiar el nombre del conector ni borrar su estado para reintentar lo mismo.

Para enviar, usar una credencial con `sdk:events` y confirmación explícita:

```sh
node src/cli.mjs send --tenant mi-empresa --connector erp-main --confirm-tenant mi-empresa --limit 10
```

Por defecto procesa hasta 10 pendientes; admite hasta 100 por ejecución.
No hay daemon ni polling automático. Al ejecutarlo de nuevo omite los confirmados.
La cantidad real de requests queda en el resultado; cada HTTP tiene deadline de
8 segundos y el SDK no realiza reintentos ocultos desde este adaptador.

Se registra `shipment.received` como evento externo DECLARADO. **No activa tags,
no modifica el precinto y no cambia el estado de un envío del módulo logístico.**
Una recepción declarada por ERP no se convierte en autenticidad física NFC.

El estado persiste en `.nexid-integration/empresa/conector/outbox.sqlite`.
Conservarlo y respaldarlo junto al sistema origen, en disco local protegido y
persistente, no un filesystem efímero/serverless ni una carpeta de red compartida.
No subirlo al repositorio. No contiene credenciales, pero sí referencias comerciales.
La cola está vinculada a empresa/conector/destino; no puede reutilizarse entre tenants.

### Respuesta perdida y recuperación

Antes del POST se registra la intención en SQLite con commit síncrono. Si la
respuesta se pierde, queda `uncertain`, no `committed`. El siguiente envío consulta
el estado de la MISMA clave. Una operación confirmada se reconcilia sin crear otra.
Si aún está procesando, se detiene; si el estado es incierto solicita reconciliación.
Los conflictos o rechazos permanentes quedan `blocked` para revisión.

La API documenta siete días de retención de idempotencia. El kit corta el reenvío
si faltan comprobantes tras seis días desde el primer intento. Queda `manual_review`:
no inventa otra clave ni presume que un 404 tardío significa que nunca se guardó.
No es una garantía de exactly-once ilimitada. Conservar referencias del ERP y de
NexID para reconciliar casos vencidos. Una instancia local puede tener un worker;
si cae, su lease expira en 120 segundos. No borrar el lock/DB para forzar un envío.

## 4. Recibir un webhook firmado sin duplicar la proyección local

Configurar en NexID un endpoint dedicado con evento `sdk.external_event`, firma
v2 y secreto propio. Copiar su key ID no secreto a NEXID_WEBHOOK_KEY_ID y su secreto
a NEXID_WEBHOOK_SECRET en el entorno seguro del receptor. Indicar el UUID del tenant:

```sh
node src/cli.mjs webhook --tenant mi-empresa --connector erp-main --tenant-id UUID-DE-LA-EMPRESA --port 8788
```

Escucha exclusivamente en 127.0.0.1. No crea un túnel, webhook público ni endpoint
productivo. Para recibir desde NexID debe montarse detrás del HTTPS/reverse proxy
autorizado del cliente, con límite de cuerpo 256 KiB, timeouts y su control de acceso.
No cambiar a 0.0.0.0 sin esa infraestructura. El secreto nunca viaja al dashboard.

El receptor valida firma v2, key ID esperado, ventana temporal, esquema, event ID
y tenant ID. Acepta sólo el tipo externo previsto. Firma v1 o esquema legacy se
rechazan en este receptor de referencia. Guardar y proyectar en SQLite ocurre en
una misma transacción; duplicados devuelven 200 sin añadir otra notificación.

Se guardan digest/ID/tipo y referencias de lote/evento en inbox.sqlite; no se
almacenan el cuerpo completo, firma, secretos ni raw NFC. La tabla notifications
es la proyección local de referencia. Llevar esa proyección al ERP debe hacerse
mediante el outbox/transaction del ERP; este kit no puede garantizar exactly-once
para una llamada arbitraria a otro sistema. Hay límite de 10.000 filas por cola
e inbox y un máximo local aproximado de 32 MiB; no se purga evidencia automáticamente.

## Contratos y alcance

`contracts/openapi.json` y `contracts/asyncapi.json` son snapshots versionados de
los contratos del repo, con hashes en manifest.json. OpenAPI puede importarse en
un cliente API. Para ejecutar en vivo hace falta una empresa, lote y credencial
correctos; no se incluye un sandbox remoto ni credenciales de muestra válidas.

No se ha elegido ni instalado un ERP específico de un cliente desde este kit.
Se cierra distribución, ejecución local y adaptador de intercambio; el S5 completo
requiere el primer sistema cliente y su aceptación de extremo a extremo.
