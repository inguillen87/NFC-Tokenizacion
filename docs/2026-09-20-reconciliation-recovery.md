# S6 conciliación: recuperación de código y aceptación aislada

Esta rama continúa el incremento detenido en el checkpoint `13fcff80a327d929be39c6c8b99f0cab0edec45c`. El código se recuperó del registro de implementación sobre la base dashboard `14d62ca9a67e07f20eb939e79af32cc5f7d106c2`. No se pudo cotejar byte a byte con el worktree Windows cuyo acceso permanece pausado por cuota; esta recuperación se verifica de nuevo de manera independiente.

La misma rama remota `codex/nexid-recall-reconciliation-ui-20260920` conserva ahora archivos de implementación y pruebas, no sólo notas. No se reemplazó ni descartó el trabajo de la PC. Antes de retomarla, reconciliar esta rama con sus cambios locales; no aplicar un reset destructivo.

## Alcance

Conciliación de destinos, filtros locales, acuses y cantidades pendientes, vista previa de cantidades acumuladas y correcciones, historial por destinatario y consulta de la revisión/autoridad antes de pedir o aprobar cierre. El backend conserva sus transacciones e independencia de aprobación. Cerrar no levanta avisos ni acredita devolución física.

La actualización, el cambio de caso y la exportación no descartan comandos cuyo resultado esté pendiente. Además, la exportación fresca actualiza la revisión visible y el permiso de lectura se considera al habilitar cierre. Las comprobaciones estrictas nuevas y estilos de revisión viven en módulos propios para no cambiar los consumidores del parser y CSS previos.

## Verificación reproducible

El manifiesto `scripts/qa/recall-source-hashes.json` fija los bytes del código y los ensayos. El trabajo de GitHub Actions usa sólo permiso de lectura, Node 24.15.0, API fijada en `a3e51ffdc324631640734b4b246f23c1ac1f5842` y un contenedor PostgreSQL 18.4 efímero. No usa credenciales, endpoints ni datos de producción. La adaptación a PostgreSQL de CI conserva los handlers y migraciones de retiro originales; usuarios y casos son sintéticos.

La aceptación incluye TypeScript, la suite de dashboard, build completo, control de secretos y recorrido Next/React/BFF con PostgreSQL. Las imágenes y logs se guardan como evidencia del SHA ensayado. Las 14 pruebas aisladas ya se ejecutaron en el entorno de recuperación; el resultado de CI y la revisión visual deben consultarse, no darse por aprobados por este documento.

No se cambian API productiva, SUN, TTStatus, permisos, plantillas, migraciones, dependencias, plan Neon ni conectividad NFC. No se habilita el despliegue automático de Git. Este commit es candidato de desarrollo y no cambia la versión productiva .27. Publicar exige autorización efectiva de Vercel, reconfirmar la combinación API/web/dashboard, fijar manifiesto de release y realizar staging/smoke. No se simula una publicación por haber subido código.
