# S5 — SDK e integración: primer cierre ejecutable

Base dashboard: e1781821848548dc0cb5ac807415014a30eed582.
Entrega dashboard: 2026.09.18-dashboard.14.
API compatible sin modificación: 2026.09.18-api-channels.1,
commit 16022a80ae7d45abad58f4e12c485d2f1382f2fe.
Web público sin modificación: ac9171b2e683c5d4ae766945f96acf8e3d2bdbc0.

## Correspondencia con el plan original

S5 pide incorporar terceros sin soporte constante, un quickstart fuera del
monorepo, un receptor de webhooks, recuperación de errores y un primer conector
utilizado. Se reutiliza el SDK existente @product/nexid-server-sdk 0.2.0, no se
crea otro SDK ni se publica una dependencia homónima en npm.

Esta entrega cierra el kit distribuible, la instalación externa y un adaptador
CSV utilizable. Todavía NO cierra la aceptación con un ERP/WMS concreto de cliente:
no se eligió ni se conectó ese sistema en este trabajo. No confundir pruebas
locales de integración con una recepción real de mercadería.

## Funciones implementadas

En /sdk-vision aparece un bloque operativo al comienzo de la página. Descargar
el kit recupera un artefacto privado real, comprueba su tamaño y SHA-256 y permite
guardarlo; la plantilla CSV también se descarga. El archivo no contiene claves,
datos de tenants, fuente de la API ni el repositorio completo. La distribución
incluye SDK ESM compilado, contratos OpenAPI/AsyncAPI, adaptador, tests y manual.

El endpoint /api/integration-kit usa la sesión existente, exige api_keys.read y
las restricciones del rol. Sesiones demo y cuentas sin permiso reciben rechazo.
El artefacto queda fuera de public/; se incluye mediante outputFileTracingIncludes
para el runtime desplegado. Se verifican tamaño y hash también en servidor.
No se crean credenciales, webhooks, tenants, pedidos ni eventos al descargar.

El perfil ERP / WMS · CSV preselecciona únicamente sdk:products y sdk:events en
el formulario de credenciales existente. Abrir el perfil no crea una key. Su
quickstart consulta catálogo en lugar de pedir un TAP o sdk:verify que ese perfil
no posee. El tenant pasa por la validación existente, no por una suplantación.

## Adaptador de recepción declarada

La CLI permite doctor, plan, status y send. Plan y status son locales y no usan
red. Doctor realiza una sola lectura del producto con comprobación de tenant/BID.
El CSV acotado usa external_id, bid, occurred_at y facility: códigos comerciales,
no personas, secretos ni payloads NFC. Máximo 500 filas / 512 KiB por archivo.

Planificar persiste la cola en SQLite del servidor del cliente. El identificador
estable vincula tenant, conector e ID comercial; un cambio de payload bajo ese
ID se rechaza. No se imprime ni se guarda la API key. El envío requiere confirmar
el tenant y se limita a 10 filas por defecto, máximo 100, con plazos HTTP de 8s.
No hay daemon, polling ni reintentos automáticos ocultos.

El intento se confirma en SQLite antes del POST. Ante una respuesta incierta,
la siguiente ejecución consulta/reconcilia la misma clave, no crea otra operación.
Una cola ya confirmada no reenvía. La lease local evita dos workers concurrentes.
Si la comprobación del servidor ya venció, la tarea queda para revisión manual:
no se promete exactly-once ilimitado. El margen de reenvío es de seis días frente
a los siete días documentados por la API existente.

El evento enviado es shipment.received como declaración externa. NO modifica el
estado del módulo logístico, activa etiquetas, valida CMAC o abre/cierra precintos.
Su aceptación física y las decisiones de calidad permanecen en los flujos actuales.

## Receptor webhook

Verifica HMAC v2 con el SDK existente, key ID esperado, tiempo, versión del
sobre, event ID y tenant UUID. Rechaza v1/legacy en este receptor de referencia.
Sólo admite sdk.external_event. Inbox y proyección local se guardan juntos;
repetir una entrega devuelve acuse sin una segunda proyección. Payload modificado
bajo el mismo evento falla. El cuerpo completo y el secreto no se guardan.

Escucha en localhost, no crea túneles ni registra un endpoint remoto. Producción
requiere el HTTPS/proxy autorizado del cliente y un disco persistente protegido.
La proyección notifications es local: llevarla al ERP requiere la transacción o
outbox de ese sistema; no se presenta como una garantía sobre llamadas ajenas.
10.000 filas máximas por cola/inbox, límite de páginas de SQLite aproximado 32MiB.
No se purga evidencia automáticamente para aparentar almacenamiento ilimitado.

## Evidencia de ejecución

Se comprobó el SDK existente: 29 pruebas fuente, tipos, build, 3 pruebas de
consumidor y npm pack con seis archivos. Su runtime no cambió; el source map se
normaliza a LF en el empaquetado para distribución reproducible en Windows/Linux.

El kit exacto se extrajo a una carpeta temporal fuera del repositorio. Se ejecutó
verify-kit, npm ci --offline --ignore-scripts --no-audit --no-fund, los 16 tests y
plan/status/replan. Se verificó que import.meta.resolve encuentra el SDK dentro
de ese consumidor externo, no por el node_modules del monorepo. No hubo llamadas
remotas. scripts/test-integration-kit.py reproduce esta aceptación y elimina sólo
su carpeta temporal propia al terminar.

Los 16 tests usan SDK y SQLite reales, y un HTTP/API de prueba local que reproduce
el contrato de idempotencia. NO ejecutan las rutas productivas de NexID. Incluyen
respuesta perdida tras commit simulado, reinicio, contención de worker, conflicto
de payload, timeout/estado pendiente, límite de reenvío, rechazo de tenant ajeno,
verificación de firma y cinco entregas concurrentes del mismo webhook. El fallo
inyectado en notifications revierte también la inserción de inbox.

Navegador con Next/BFF y descarga de artefacto reales, autenticación sintética
local: hash de descarga, CSV, comandos seguros/copiar, enlace del perfil, rechazos
401/403/503 y cuatro variantes 1440/390 claro/oscuro. Cero incidencias axe en la
superficie evaluada, no una certificación WCAG. No se activó ni se invocó ninguna
mutación de negocio durante esas pruebas.

## Despliegue y límites

Sólo dashboard, ejemplos y empaquetado. No requiere migración ni nuevo servicio,
no altera Free, las claves NFC, TTStatus, GS1, Passport Studio ni /batches.
Rollback dashboard previo: dpl_4sk7sFXtjDRotpyTxs2k9iaQCrdx.
Mantener la versión API/web actual y confirmar alias antes de promover.

Queda para el siguiente cierre de S5: seleccionar ERP/WMS/POS de cliente, mapear
su identificación comercial y validar el extremo a extremo con sus datos/autorización.
El kit no da por completados S6 (retiros e informe de piloto) ni S7 (campañas).

## Validación final previa a publicar

Dashboard: 847 pruebas, 845 aprobadas, cero fallidas y dos omitidas; TypeScript
y build completos aprobados. El tracing del endpoint incluye exactamente el
artefacto TGZ comprobado. Gate de secretos aprobado. Hash del kit final:
`e0d4b327e50a635d638abd73921df460bcdc4450bb2fb7e2aa22d0818f7c679d`,
77.247 bytes. Se repitió npm ci offline y los 16 tests desde una carpeta nueva
fuera del monorepo, además de la descarga en el navegador real local.
