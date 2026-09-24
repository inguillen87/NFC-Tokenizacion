# NexID — aceptación integral de la cadena de proveedor

Fecha: 2026-09-24. Candidato API, no publicación productiva.

## Continuidad y alcance

Se verificaron completos y aprobados los candidatos anteriores de acuses: API `dd8b043c` (run 36019171637) y dashboard `c9d0b132` (run 36019176907). El nuevo trabajo continúa desde esa API en `codex/nexid-supplier-chain-acceptance-api-20260924`, reutilizando su worktree limpio para no duplicar dependencias en el disco casi lleno. El panel, las ramas anteriores y main no se modificaron.

Este incremento no agrega otra pantalla: cierra una brecha de integración. Los acuses anteriores habían sido probados con tablas simplificadas de packaging, lifecycle y artefactos. La nueva aceptación reconstruye el esquema completo y ejecuta los handlers productivos por HTTP local, con sesiones reales persistidas en una base desechable.

## Problemas encontrados y corregidos

1. **Migraciones con diferencias de fin de línea.** La instalación desde un checkout CRLF de Windows fallaba en los fragmentos exactos de 0097. El runner ahora interpreta el SQL canónico LF antes de ejecutarlo; mantiene sin cambios las secuencias escapadas, espacios y comprobaciones de coincidencia. No se relajan los guards ni se reescribe el SQL de 0097.
2. **Prerrequisito de logística no registrado como migración.** 0103 utiliza tipos y tablas que antes sólo creaba `ensureSecureDeliverySchema`. Para el bootstrap vacío local autorizado se registró una copia exacta de esas doce sentencias existentes en `db/bootstrap/secure-delivery-v1.sql`. La prueba exige igualdad con el código real y rechaza relaciones preexistentes; no usa tablas simuladas. El runner ejecuta ese prerrequisito dentro de la transacción correspondiente, sólo después de verificar el destino vacío local. No lo aplica automáticamente a una base existente o remota.
3. **Tickets con enum en lugar de texto.** El esquema original define `tickets.status` como `ticket_status`; 0112 asumía una columna de texto. Se explicitan conversiones de lectura/comparación y se asigna el estado mediante el tipo real de la fila. No se convierte la columna ni se alteran datos, estados admitidos, revisiones o auditoría.

## Compatibilidad de la corrección de tickets

La fuente de 0112 se corrigió para nuevas instalaciones. **No debe repetirse esa migración sobre una base donde ya figura aplicada.** Para bases existentes se agregó `20260924163000_0121_support_ticket_status_type_compatibility.sql`, que reemplaza sólo tres funciones y conserva permisos restringidos.

La suite se ejecuta tanto con el enum canónico de tres valores como con la columna texto histórica. Los estados arbitrarios de texto siguen bloqueados, no se incorporan al enum para facilitar la prueba. Se verificó que aplicar 0121 conserva filas, recibos, revisiones, secuencias, tipo de columna y reintentos anteriores. La migración requiere la verificación/autorización normal antes de llegar a producción.

## Recorrido integral ejecutado

Solicitud borrador → envío → aclaración de NexID → respuesta de la empresa → cotización → aceptación del comprador → conversión atómica en orden → borrador/revisión/aprobación de especificación por otra identidad → proveedor vinculado → exportación cifrada → comprobante manual de envío → acuse documental.

La exportación usa el generador real, material efímero de prueba y el cifrado existente. Se verifican los bytes del sobre, su hash, el descifrado en memoria y el hash del ZIP resultante. Las contraseñas y claves no se imprimen ni se guardan en los reportes; las copias Buffer del ZIP/sobre se vacían después de comprobarlas. Esto no es entrega a un proveedor ni validación de custodia KMS/HSM.

También se comprueba que la conversión falla antes de aceptar la cotización, que no hay envío sin exportación, que una empresa no puede exportar material de fábrica, que no se exporta dos veces, que el destinatario equivocado bloquea el envío y que un reintento del acuse no crea otro evento. Se prueba el ticket enum por sus rutas reales, incluido su historial y la recuperación del mismo recibo.

La evidencia durable final de ese recorrido contiene una orden, un comprobante de envío, un acuse, dos eventos de cotización y dos aclaraciones, con una única exportación de claves. Las afirmaciones de proveedor autenticado, descarga externa, descifrado por el proveedor y recepción física permanecen en false. La comprobación de descifrado en memoria no cambia esas afirmaciones.

## Validación local confirmada

| Verificación | Resultado |
| --- | --- |
| Bootstrap completo | 132/132 migraciones y prerrequisito real de logística identificado por hash |
| Recorrido nuevo, HTTP real y SQL completo | 52 comprobaciones aprobadas |
| Matriz de tickets texto/enum y reparación 0121 | 35 pruebas aprobadas, sin omisiones |
| Regresión PostgreSQL soporte/solicitudes | 154 pruebas aprobadas, sin omisiones |
| Regresión focal API | 434 pruebas aprobadas |
| Seguridad del harness, normalización y prerrequisitos | 26 pruebas aprobadas |
| Build API | Completo y aprobado con sus suites de regresión |
| Secretos, dependencias y seguridad estática de migraciones | Aprobados |

PostgreSQL local: 17.10 Windows, declarado y comprobado por su número exacto 170010. Se mantienen los motores CI fijados 16.4 y 18.4, sin permitir versiones arbitrarias ni destinos externos. Las condiciones de entorno test, usuario dedicado, base vacía, loopback, rechazo de overrides URL y ausencia de endpoint Neon permanecen vigentes.

El cluster local terminó detenido y su directorio de datos fue retirado por el harness. La base y los datos eran efímeros; no se utilizaron credenciales de aplicación ni datos de clientes.

La configuración de CI habilita esta rama en el gate API y en la matriz E2E existente. La aprobación remota debe verificarse sobre el commit exacto; este documento no convierte un workflow configurado en una ejecución aprobada. La evidencia local se conserva en `docs/releases/2026-09-24-supplier-chain-local-validation.json`, con hashes del prerrequisito, 0112 y 0121.

## Producción y límites pendientes

Consulta canónica del 24/09/2026 a las 16:16 UTC: dashboard `2026.09.23-dashboard.41`, API `2026.09.23-api-supplier-requests.2` y web `2026.09.21-web-support.1`. No se desplegó producción, aplicó SQL en Neon, activaron flags reales, enviaron paquetes/mensajes ni se crearon usuarios o proveedores externos.

Esta aceptación usa sesiones y funciones reales sobre el esquema completo, pero el rol SQL sigue siendo el dueño de una base local desechable. Falta certificar el rol de base de datos restringido que se usará en el despliegue, verificar migraciones/ACL reales y aceptar el despliegue coordinado con autorización. No se probaron aquí TLS, middleware de Next, proveedor autenticado ni etiquetas NFC físicas.

La entrega externa controlada, acceso/acuse autenticado del proveedor, primer conector ERP/WMS, costo monetario por empresa y cierre físico del piloto siguen pendientes. El nuevo resultado permite preparar esa publicación con una prueba de integración más sólida; no sustituye esas puertas por métricas de tests.
