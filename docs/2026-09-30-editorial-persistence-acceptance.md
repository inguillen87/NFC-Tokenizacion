# NexID — aceptación persistente del circuito editorial

## Objetivo y alcance
Continuación de PR #387 sobre `9fe727869a9f82d6b81710f9f2ff18a3f1512d6a`. Se agrega una comprobación reproducible del servicio editorial de la API publicada `607fe4057458e4436982df2c08785e233b30b86f` contra los validadores de recibos e inicio del dashboard candidato.

No se reemplaza el código de API contenido en la rama de dashboard. El workflow obtiene otra copia de la revisión de API explícitamente fijada, verifica su SHA y rechaza modificaciones. Las dependencias se instalan desde el lockfile del candidato; no se cambia ninguna dependencia o paquete productivo.

## Qué verifica
- Inicio editorial y confirmación por el contrato del dashboard, sin cambiar el contenido público.
- Reintento persistido del mismo inicio y rechazo de otra carga con el mismo identificador.
- Guardado, solicitud de revisión, correcciones con comentario, nueva revisión y aprobación independiente.
- Rechazo de autoaprobación, publicación sin permiso y reutilización de la aprobación después de reabrir.
- Publicación confirmada y recuperación del recibo de una publicación anterior sin restaurar un estado antiguo.
- Conflicto real entre dos guardados concurrentes; sólo uno puede consolidar la revisión.
- Aislamiento entre empresas con el mismo BID, rechazo de cambios directos a un lote editorial y preservación de campos técnicos y de vino ajenos al contenido.
- Igualdad entre revisiones persistidas y recibos, sin duplicar historial ante reintentos.

Los casos recorren plantillas general y agro. El servicio y PostgreSQL son reales. Las identidades y capacidades se suministran como fixtures: no constituye una prueba de autenticación de Next/BFF, cookies, browser, HTTPS, un proveedor externo ni NFC físico. El informe declara explícitamente esas exclusiones.

## Base efímera y protección
Sólo se admite `127.0.0.1`, usuario `nexid_e2e`, base `nexid_e2e_editorial`, entorno `test`, confirmación explícita y motor exacto PostgreSQL 16.4 o 18.4. Se rechazan configuraciones de base productiva, parámetros de conexión que puedan sustituir el host, otro usuario/base o una API con SHA distinto.

Antes de cualquier DDL se usa el comprobador existente de identidad, versión, ausencia de endpoint Neon y base vacía. Se crean únicamente dos tablas base mínimas del fixture y se aplican las migraciones editoriales originales 0104/0105, normalizando sólo saltos CRLF. Las huellas se registran. No es una migración del esquema completo ni un ensayo sobre los datos actuales de Neon.

No se ejecuta DROP para limpiar una base existente. El pool se cierra y los servicios efímeros pertenecen al job aislado de GitHub Actions. El workflow usa permisos de repositorio de sólo lectura y no recibe secretos productivos ni contiene pasos de despliegue.

## Estado de verificación
Las 24 pruebas del guard de ejecución aprobaron localmente con Node.js 22.16.0; la sintaxis del runner también se comprobó. Los resultados de PostgreSQL y CI se registrarán en esta PR una vez ejecutados sobre el SHA final, sin anticipar aprobación.

La PC Desktop Commander estaba offline y el conector Vercel devolvió 403 para el equipo. Esta entrega se prepara y verifica directamente por GitHub; no se declara una nueva publicación en `app.nexid.lat`.
