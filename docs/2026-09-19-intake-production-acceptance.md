# Registro operativo EPCIS — cierre de producción

Fecha: 19 de septiembre de 2026.

## Versiones activas verificadas

API: 2026.09.19-api-intake.1,
e5af0bb044a7e9c5a912280eeb3663679ebf8abc,
dpl_4LMMe8jTYc9x5gbQdDanhCufqXa9, api.nexid.lat.
Dashboard: 2026.09.19-dashboard.23,
d6c527349ad7868d70cd5d4f8354b6624bfe1021,
dpl_6QdU9HXBZxAFoYoJhSBDDXAwFQwq, app.nexid.lat.
Web conservada: 2026.09.19-web-consumer.1,
e94720e2519c28f0b2ce32db67bd04be0255a093,
dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg, nexid.lat.

Se promovió API y después dashboard, comprobando que los aliases previos seguían
en las revisiones esperadas. No se sobrescribieron releases concurrentes. Ambos
artefactos son READY, corresponden a los commits registrados y gitDirty=0.

## Función entregada

Desde Recorrido del lote -> Registrar movimiento, un operador autorizado puede
preparar recepción, despacho o almacenamiento con identidad GS1 registrada y
fecha explícita. El formulario genera el documento; no exige API keys ni JSON.
El modo archivo acepta el perfil EPCIS definido en el documento de implementación,
con hasta 50 eventos, 100 vínculos y 100 kB, mediante arrastre o pegado.

Validar no crea eventos. Confirmar con escritura logística y MFA usa el mismo
motor EPCIS/canónico existente, con actor humano explícito, transacción completa,
referencias estables y comprobante. Un reintento recupera la misma operación.
El comprobante sobrevive a recargas y el resultado puede consultarse desde el
recorrido o queryEpcisEvents; no se creó un ledger alternativo.

La interfaz conserva campos entre pestañas, distingue pendientes de confirmados,
impide modificar un intento incierto, informa duplicados y retira preparaciones
obsoletas cuando cambia el archivo. La revisión recibe el foco y se desplaza en
móvil. Claro/oscuro, transiciones breves y movimiento reducido están incluidos.

## Verificaciones

907 pruebas del dashboard aprobadas, cero fallidas, dos omitidas; tipos y build
completos. API: ocho pruebas específicas, build y cadena de regresiones aprobados.
16 escenarios con PostgreSQL real local y el motor verdadero de captura, no recibos
simulados. Incluyen seis solicitudes concurrentes idénticas, errores tardíos y de
proyección, outbox transaccional, revocación de membresía y compatibilidad SDK.
La migración canónica y su aplicador compacto verificado pasaron por separado la
misma suite, cada uno aplicado dos veces sobre una base local nueva.

Nueve comprobaciones de navegador integradas y cuatro variantes 1440/390 en claro
oscuro pasaron sin hallazgos axe en la superficie evaluada. No es certificación
WCAG ni una prueba física UHF/NFC. Sesiones y datos eran sintéticos locales.
Después de publicar: seis comprobaciones públicas de navegador aprobadas; salud
API 200, SUN sin parámetros 400, marker de release 200 y ruta nueva sin sesión 401.

0111 está aplicada y registrada. El primer intento del conector rechazó múltiples
comandos en un prepared statement y revirtió todo: se comprobó que no había columna
nueva ni cambio de función. Se repitió como sentencias separadas dentro de una
transacción, con límites de espera y guardas de versión. Se verificaron hashes:
capture: 268586fa4b0976bf8100c2038829bee8536256dd4e9ea3f0b356b3357c942cdf;
scope: a8d6d905a6879d6f7d1ea32052521d74ef45ef2f3268c6afc7bb726d7f28f78e.
Se comprobó el constraint de origen exclusivo y EXECUTE para neondb_owner.
También se revisaron las columnas obligatorias productivas y el trigger existente
que completa destination_version del outbox. No fue necesario modificarlo.

## Comprobación del acceso real y límites

Chrome inicialmente redirigió al login: la sesión había cerrado y ambas consultas
privadas devolvían 401. Se utilizó una sola vez el botón normal del formulario
precompletado por el navegador, sin leer, revelar o cambiar la contraseña.
La sesión de la cuenta piloto ingresó y conservó el retorno al intake, pero el
panel mostró Acceso no autorizado. No se interpreta como una prueba funcional
privada aprobada ni se cambió un rol para forzarla.

La consulta de metadatos de esa sesión confirmó tenant_admin en demobodega, sin
logistics:read ni logistics:write y con mfa_verified=false. Es el perfil previo de
la cuenta piloto, no una degradación introducida por esta entrega. Se mantuvieron
sus permisos. La operación requiere una cuenta autorizada de logística y MFA;
el flujo completo para esa autoridad sí fue probado localmente como se detalla.
No se confirmó ni importó un documento real desde la cuenta productiva.

## Preservación comprobada

Después de publicar, Neon conserva cero capturas EPCIS y cero eventos EPCIS.
Balmec mantiene diez etiquetas activas, diez inactivas y el hash
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
No se fabricaron identidades GS1 para habilitar una prueba sobre TagTamper.
La integración nfc-token-api continúa en Free/free_v3. No se cambiaron planes,
web del consumidor, claves, contadores, TTStatus, roles, Polygon, IOTA ni campañas.

La migración amplía el origen de captura de forma explícita; no eleva permisos
humanos ni sustituye los del SDK. Revertir aplicaciones sigue siendo compatible
con la rama SDK previa, sin borrar capturas ni retirar evidencia del esquema.
La configuración de un lector UHF o conector nativo de un ERP específico continúa
fuera de este cierre. Esta entrega registra declaraciones operativas guiadas o
archivos del perfil EPCIS documentado, no verificaciones físicas de hardware.
