# S3/S5 — Registrar movimientos desde la operación

Base API: dc104fe2e0d37134ed8c66cf947660b7a0a3ae34 (api-trace.2).
Base dashboard: f2c1934f328258abbbc012c83b77033f7f98a1cc (dashboard.22).
Entrega prevista: 2026.09.19-api-intake.1 y 2026.09.19-dashboard.23.
Web conservada: e94720e2519c28f0b2ce32db67bd04be0255a093 (web-consumer.1).

## Cierre operativo

Desde el recorrido del lote aparece Registrar movimiento para los roles autorizados.
La ruta /batches/[bid]/intake permite una observación de recepción, despacho o
almacenamiento mediante formulario: identidad ya registrada, referencia comercial
estable y momento explícito. El operador no necesita JSON ni credenciales SDK.
La referencia determina un ID estable por empresa, no uno nuevo en cada reintento.

También admite carga por archivo o pegado de EPCISDocument 2.0: máximo 100 kB,
50 eventos y 100 vínculos/proyecciones. Es un perfil acotado: se rechazan extensiones
no admitidas, incluso en puntos de lectura y cantidades, en lugar de descartarlas.
Cada evento debe tener ID explícito, fecha válida con zona y al menos una identidad
del lote elegido. Las otras identidades de la relación deben pertenecer al mismo
tenant y estar autorizadas por el registro GS1 existente.

Preparar y validar no registran eventos. Después se presenta el documento, sus
fechas, identidades, duplicados y número acotado de integraciones configuradas.
Confirmar es una acción explícita, con permisos de escritura logística y MFA.
El documento se registra íntegro o se revierte íntegro: captura, EPCIS, proyecciones
canónicas y outbox comparten la transacción existente. No se crea un ledger paralelo.

## Identidad del emisor e integridad

La migración 0111 amplía el origen de epcis_capture_operations. Cada captura tiene
una API key existente O un actor humano, nunca ambos ni ninguno. La restricción
anterior de API key obligatoria se reemplaza por esta alternativa estricta, con
CHECK IS TRUE, referencias y contexto acotado. Los registros SDK anteriores no se
modifican y siguen exigiendo una credencial activa de su tenant.

El usuario importador queda identificado por su ID real, separado de una key.
La pertenencia actual y el estado activo del usuario/empresa se vuelven a comprobar
en PostgreSQL con bloqueo de lectura. La función conserva un único motor de captura.
Cada evento humano debe vincularse al lote seleccionado también en el límite SQL.
Una revocación no se sustituye por un permiso de interfaz.

Una operación incierta conserva el mismo ID y los mismos datos. El reintento
recupera el comprobante ya persistido sin registrar otra copia. Cambiar el contenido
o la referencia del intento genera conflicto. Un evento con ID ya registrado no
se reemplaza mediante otro archivo. Los comprobantes recientes de la cuenta pueden
recuperarse al recargar; la vista conserva hasta 15 para ese lote.

Los movimientos son declaraciones externas: no equivalen a autenticidad NFC, GPS,
prueba del lector, recepción física validada o transición de custodia. No activan
etiquetas, no cambian estado de envío, TTStatus, propiedad digital o blockchain.
Las notificaciones a webhooks existentes quedan en el outbox habitual (hasta 25
endpoints por proyección); esto se avisa antes de confirmar y no activa campañas.

La admisión conserva el presupuesto EPCIS de dos confirmaciones/minuto por tenant,
y acota lecturas/previews a 12/minuto por los ámbitos de la política existente.
Validar puede actualizar contadores de sesión/rate limit: no se afirma cero SQL,
sino ausencia de eventos de negocio. Cambiar pestañas y descargar no consulta la DB.

## UX y aceptación ejecutada

El asistente conserva el formulario al cambiar de pestaña, muestra tres etapas,
permite arrastre de archivo y marca cada evento antes del registro. Un archivo
malformado o demasiado grande invalida la preparación previa. Tras validar, el
foco pasa a la revisión; en celular también se desplaza a ella, con movimiento
reducido respetado. Confirmar muestra el comprobante y un enlace al recorrido.
Se corrigieron el encabezado contextual, la lectura de fechas, la presentación de
recepción/despacho y el ajuste del texto de consentimiento en pantallas pequeñas.

API: ocho pruebas específicas y build/regresiones completas aprobados.
Dashboard: 909 pruebas, 907 aprobadas, cero fallidas y dos omitidas; tipos y build
completos aprobados. Ambos controles de secretos pasaron.

16 escenarios de PostgreSQL real local ejecutan el parser, resolver GS1, handlers
y motor SQL: preview sin captura, registro humano, seis confirmaciones concurrentes,
respuesta perdida/reintento, contenido cambiado, ID de evento repetido, permisos,
MFA, alcance ajeno, registro faltante, campos inesperados, preview obsoleto,
revocación de membresía, fallo tardío de un evento, fallo de proyección, outbox,
compatibilidad SDK, historial y configuración intacta. Las capturas y credenciales
de esos escenarios son sintéticas locales, no acciones de clientes productivos.

El navegador usó Next/React/BFF del proyecto con la misma base PostgreSQL y motor
real: nueve comprobaciones integradas, incluidas recepción guiada, archivo de
agrupación, recuperación del intento, comprobante, recarga, ID repetido, cuenta
sin MFA, JSON inválido y separación de empresa. Cuatro variantes 1440/390 en claro
y oscuro no tuvieron hallazgos axe en la superficie. No es certificación WCAG.

El nuevo evento se recuperó a través de queryEpcisEvents existente. No se simularon
receipts para pasar esa prueba ni se sembró otro ledger. Las sesiones y límites de
admisión se adaptaron sólo en el fixture local; las rutas productivas usan el
resolver y rate limit real. El test de política comprueba 2/min y 12/min.

## Esquema, preservación y límites pendientes

0111 verifica primero el hash normalizado del motor y del trigger previos. Aborta
si otro cambio los modificó. La distribución incluye la migración completa y un
aplicador equivalente, apply-0111-verified-delta.sql, que aplica sólo diferencias
sobre ese texto conocido, verifica el hash final y conserva la definición/ACL.
Ambas variantes se aplicaron dos veces en bases locales nuevas y pasaron los
mismos 16 escenarios. No son dos migraciones diferentes.
Hash del cuerpo final de nexid_capture_epcis_document_v1:
268586fa4b0976bf8100c2038829bee8536256dd4e9ea3f0b356b3357c942cdf.

No se despliega otra API, SDK o base. No se activa mensajería de campañas, no se
crean credenciales, identidades de prueba, lecturas NFC ni transacciones blockchain.
No se modifica el frontend consumidor ni el recorrido paginado ya publicado.
El primer uso requiere identidades GS1 reales registradas y autorizadas de la
empresa; los tags TagTamper existentes no se convierten para poblar el formulario.

Pendientes: conector nativo de un ERP/WMS específico, adaptación de un gateway UHF,
aceptación del hardware en campo y más perfiles EPCIS. No se afirma una certificación
GS1/EPCIS completa ni una lectura industrial física por haber registrado un JSON.
Los formularios en memoria se recuperan mientras permanece la página; los registros
confirmados permanecen en el servidor. No se guardan borradores privados en storage
local ni se pretende exactly-once fuera del identificador comercial del evento.

Reversa previa API: dpl_4wGmKWNqtUTE8dc3LGVS71hkgqST.
Reversa previa dashboard: dpl_5YG9u2Jn2NcyuwFp55361tutJBx1.
Web preservada: dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg.
Una reversión de aplicaciones no debe eliminar la evidencia capturada ni retirar
la ampliación de esquema. La función nueva sigue admitiendo el contrato SDK previo.
