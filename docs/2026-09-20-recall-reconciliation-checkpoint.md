# S6 — Conciliación de destinos: checkpoint, NO publicación

Fecha de trabajo: 20/09/2026. Estado: implementación local, comprobaciones parciales aprobadas; release pendiente. Esta rama remota conserva este documento de continuidad, NO el código nuevo del worktree local. No se ha publicado ni se declara completado el sprint.

## Base productiva consultada al comenzar

- Dashboard: 2026.09.20-dashboard.27, SHA 14d62ca9a67e07f20eb939e79af32cc5f7d106c2, deployment dpl_5TuNRtFqgjytpDXGUh1vceCE9Vfi.
- API: 2026.09.20-api-consumer-history.1, SHA a3e51ffdc324631640734b4b246f23c1ac1f5842, deployment dpl_9drfo3eYYH76sirXbQShxbXpENrQ.
- Web: 2026.09.20-web-history.1, SHA b6c054bcc59c4eb10ff01f1ff38aa2ad05c4df19, deployment dpl_AKi4ugeindS2DL2sqUx6pcKN8qNX.

No se promovió ningún artefacto durante este trabajo. Antes de publicar se deben volver a resolver las tres revisiones en vivo para no sobrescribir cambios concurrentes.

## Código implementado en la PC autorizada

Worktree: `C:\Users\guill\.codex\worktrees\nexid-recall-reconciliation-ui-20260920`.
Rama local: `codex/nexid-recall-reconciliation-ui-20260920`.
Base: la revisión dashboard .27 indicada arriba. Los cambios de implementación permanecen sin commit ni push al detenerse el canal de ejecución. Esta rama documental no debe confundirse con la rama local de implementación.

Archivos nuevos:
- `apps/dashboard/src/lib/recall-reconciliation.ts`
- `apps/dashboard/src/components/recall-reconciliation.tsx`
- `apps/dashboard/src/components/recall-reconciliation.module.css`
- `apps/dashboard/tests/recall-reconciliation.test.mjs`
- `apps/dashboard/tests/browser/recall-reconciliation-api.fixture.mjs`
- `apps/dashboard/tests/recall-reconciliation.browser.mjs`

Archivos modificados:
- `apps/dashboard/src/components/recall-workspace.tsx`
- `apps/dashboard/src/lib/recall-workspace.ts`
- `apps/dashboard/src/components/recall-workspace.module.css`

No se añadieron migraciones, rutas API, servicios, dependencias, permisos, OTP o mensajes pagos. No se cambió la configuración de Neon, SUN/SDM, TTStatus, claves, contadores, SDK, QR/GS1 o Polygon/IOTA. No se crearon retiros ni avisos ficticios en producción.

## Funcionalidad desarrollada

Se reemplaza la lista no filtrable de destinos dentro de Acuses y cantidades por una conciliación accionable del mismo caso. El responsable puede filtrar acuses pendientes, cantidades pendientes tras el acuse y destinos completos; buscar por destino, responsable o referencia y abrir los movimientos del destino en el historial existente. Los filtros son locales y no cambian el objetivo total ni consultan la base.

El encabezado explica qué impide solicitar cierre: acuses faltantes y cantidades todavía no conciliadas. Las cantidades inmovilizadas permanecen diferenciadas de las devueltas; completar la suma no certifica que todas hayan vuelto físicamente.

El diálogo de cantidades muestra el resultado acumulado, saldo pendiente y variación respecto de los valores registrados. Rechaza campos vacíos, decimales, signos, exponentes o sumas mayores al objetivo. Una reducción muestra que es una corrección declarada y sigue requiriendo motivo y referencia. Cancelar no registra nada.

Solicitar o aprobar el cierre vuelve a leer el detalle y los permisos vigentes antes de mostrar la confirmación. Si la revisión cambió, el usuario recibe el caso actualizado y debe volver a revisarlo; no se cierra desde una pantalla obsoleta. Se mantienen la revisión independiente, la autorización final y la transacción del motor existente.

Cerrar seguimiento sigue sin levantar el aviso, liberar producto, modificar stock ni alterar etiquetas. Los documentos referenciados continúan siendo referencias declaradas, no archivos verificados automáticamente.

## Corrección concreta de recuperación

La función de recarga anterior borraba `pending.current` y desactivaba la incertidumbre después de una lectura correcta. Eso permitía abandonar un comando que todavía no tenía resultado confirmado.

Ahora recarga, cambio de caso, acciones nuevas y exportación no descartan el intento pendiente. Se conserva el identificador/cuerpo original para reconciliar la respuesta. Tras una respuesta incierta, una denegación al reintentar no se interpreta automáticamente como prueba de que nunca se guardó. La recuperación no omite controles del backend.

Las respuestas de detalle exigen permisos booleanos y el mismo actor. Los valores y fechas de progreso se validan antes de usarlos para declarar listo un destino. Una falla de lectura deja la vista marcada como no confirmada y bloquea escritura/exportación. Los controles se actualizan desde la autoridad de la nueva lectura.

## Comprobaciones ejecutadas y límites

1. TypeScript de dashboard: `npm run typecheck --workspace dashboard`, sin errores. Log local `nexid-reconciliation-typecheck.log`.
2. Doce pruebas nuevas, todas aprobadas: estados, reglas de cierre, independencia, filtros, cantidades acumuladas, correcciones, formatos inválidos, progresos y autoridad, conservación del intento y ausencia de consultas automáticas. Log `nexid-reconciliation-unit.log`.
3. Prueba integrada `recall-reconciliation.browser.mjs`: proceso terminado con exit code 0, confirmado por la herramienta. Se usaron Next/React/BFF, los handlers de retiro/acuse asignado originales y PostgreSQL efímero; sesiones, usuarios, destinos y documentos eran sintéticos.

El recorrido integrado verifica filtros sin consultas; preview/cancelación; respuesta perdida después de guardar un acuse y reintento sin duplicar; respuesta real del responsable asignado reflejada en gestión; historial por destino; corrección concurrente que bloquea cierre obsoleto; lectura previa caída; cierre por otra cuenta conservando el aviso público; exportación y conservación de configuración local de lote/tags.

El script incluye cuatro variantes de escritorio/celular y claro/oscuro con asserts de desbordamiento e incidencias axe graves. Terminó correctamente, pero el intento posterior de abrir las capturas fue bloqueado por el cupo: NO se afirma revisión visual manual ni certificación WCAG.

Pendientes antes de release: revisar diff final y capturas, ejecutar toda la suite, build completo, control de secretos, comprobar preflight, fijar versión y artefacto, commit/push de implementación, staging, smoke, promoción y validación canónica. No se ejecutaron esos gates finales después del checkpoint.

## Bloqueo de herramientas observado

Desktop Commander respondió que se agotó el cupo mensual y pausó las llamadas. Indicó que el dispositivo seguía conectado/emparejado y que no correspondía reconectar o reintentar. No se cambió el plan ni se intentó eludir el cupo.

Se probó la vía independiente Vercel: `deploy_to_vercel` respondió herramienta inexistente (-32602), y `get_deployment` rechazó el equipo `marcelos-projects-c26aa499` con 403 de autorización. Es un problema de acceso del conector, no un incidente demostrado en NexID. GitHub sí permitió leer la base y registrar este checkpoint.

## Reanudación, sin reconstruir ni duplicar trabajo

Usar el worktree de implementación arriba, no iniciar otro módulo o sobrescribirlo desde esta rama documental. Inspeccionar sus cambios, la fuente API vigente y los resultados locales antes de avanzar. No dar por publicados los archivos del worktree ni por remoto el código nuevo.

Los servicios de QA iniciados por esta ejecución pueden seguir activos porque el límite impidió cerrarlos: API de loopback puerto 4681, PostgreSQL efímero 16481 y Next local 3481. Una vez restablecida una vía autorizada de ejecución, identificar su proceso/comando antes de detenerlos. El fixture tiene POST `http://127.0.0.1:4681/qa-stop` para cerrar su propio servidor/base. No detener servidores de otros repositorios.

Resultados esperados en `C:\Users\guill\AppData\Local\Temp\nexid-reconciliation-browser`: `report.json`, cuatro imágenes `reconciliation-<ancho>-<tema>.png` y `case-evidence.html`. La aceptación parcial no autoriza omitir el build ni promover una versión no verificada. La publicación debe continuar como dashboard-only salvo que una prueba justifique otro alcance.
