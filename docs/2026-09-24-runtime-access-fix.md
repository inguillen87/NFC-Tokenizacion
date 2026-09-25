# NexID — acceso explicable a runtime y notificaciones globales

Base publicada: `cbeae033294da57b22eaa0603fc68cbbec3086cf`. Rama de corrección: `codex/nexid-runtime-access-fix-20260924`. Se mantiene separada de la candidata comercial avanzada y de su corrección de lecturas.

## Incidente confirmado

La captura aportada muestra /settings/runtime con sesión Tenant Admin de Bodega Balmec. En el código publicado la página llamaba notFound() cuando canReadRuntimeConsole devolvía false: la ruta existía, pero la denegación se presentaba como página inexistente. El registro adjunto muestra además dos GET /api/admin/notifications rechazados con 403.

El endpoint de notificaciones de la API publicada admite sólo super_admin y agrega información global. La cabecera montaba la campana según acceso a leads/tickets, que no equivale a ese permiso global. La campana consultaba al montar y al volver a la pestaña, aunque la sesión fuera de empresa. Los avisos de contentscript.js y de preload se mantienen separados: no fueron tomados como causa del 404 ni atribuidos a una extensión específica sin comprobarla.

## Corrección

- Una sesión autenticada sin acceso al diagnóstico recibe una pantalla explicativa en español, no un 404. La pantalla ofrece volver a Configuración o al panel, sin consultas al diagnóstico ni controles para cambiar permisos.
- La sesión global autorizada conserva la consola existente. La sesión ausente sigue requiriendo inicio de sesión; los selectores no admitidos mantienen su rechazo. La API/BFF, canReadRuntimeConsole y permisos no cambian.
- La campana sólo se monta con contexto global de superadministrador, sin tenant ni modo demo. Cambios de identidad/rol/contexto desmontan el estado previo. Ser administrador de empresa no dispara la consulta global.
- Si un usuario inicialmente autorizado recibe 401/403, se retiran los contadores y cesan los reintentos por visibilidad o eventos hasta un contexto nuevo. Respuestas tardías no restauran datos de otra sesión.
- El lector de notificaciones tiene timeout, cancelación, máximo 64 KiB, UTF-8 estricto y valida los contadores. Un error no se presenta como cero notificaciones; sólo un resultado válido puede confirmar cero. Los contactos del payload no se proyectan a la campana.

La restricción se corrige en su presentación, no eliminando el control de acceso. No se promueve una cuenta de empresa, se modifica el rol SQL ni se cambia la autenticación del backend.

## Validación local

34 pruebas nuevas y 1.324 pruebas completas del dashboard aprobadas, con dos omisiones existentes. TypeScript y build completos aprobados. La prueba de página ejecuta la rama real con sesiones sintéticas: empresa/denegación produce el componente explicativo; superadmin autorizado produce el panel; sesión ausente requiere login; selectores rechazados no habilitan acceso.

Navegador nuevo: 62 comprobaciones, seis vistas de 320/390/1.440 px claro y oscuro. Incluye cero consultas globales para empresa incluso ante visibilidad/realtime, revocación, respuestas tardías, cambio A→B→A con abort ignorado, contadores inválidos y timeout de 15 segundos. La consola previa conserva sus 100 comprobaciones y 12 vistas. Transportes y sesiones de esas pruebas son sintéticos, no una sesión productiva.

La inspección visual encontró que el estilo compartido coloreaba el enlace principal igual que su fondo. Se corrigió la clase del enlace y se agregó una comprobación explícita de contraste mínimo 4,5:1, además del análisis de axe. No se da por legible una captura únicamente porque axe no informe errores.

El test de preservación sigue fijando 439 archivos fuente de la base publicada. Se excluyeron de forma explícita únicamente los dos archivos de cabecera/campana que se revisan en este hotfix; no se eliminó el control. El código API, las dependencias, los contratos de negocio .41 y el BFF del diagnóstico permanecen intactos. Auditoría de dependencias, control de secretos y diff check aprobados.

La publicación requiere verificar CI del commit exacto, preparar ese mismo código con configuración de producción y comprobar el artefacto antes de promover. No se incluyen las ramas comerciales ni migraciones pendientes. El cierre de publicación y cualquier prueba con sesión real se registrarán aparte; este documento no afirma todavía ese resultado.

## Cierre: corrección publicada y comprobada

Código publicado: `cb2a845d8220d32716faa2a925ab7a03fe37908f`, árbol `ce35c4cc517096348bf02ced4791b7c0d592402d`. El workflow `36088657673` terminó aprobado sobre ese commit, incluidas todas sus pruebas de navegador y compilación. Se verificó además localmente que el árbol revisado no cambiara durante unitarias, tipos, build y ambos navegadores.

El dominio `app.nexid.lat` ya resuelve al despliegue READY `dpl_9T1NYietjqJRFZFPt266SJReEzB8`, con ese mismo código y entorno de producción. Se construyó sin asignación automática de dominios y se comprobó el artefacto antes de publicar. Un intento concurrente de promoción recibió 409 porque ya había una promoción en curso; no se forzó ni se sustituyó otro despliegue. La comprobación posterior confirmó el destino exacto esperado.

Ocho comprobaciones públicas posteriores pasaron: contratos de negocio preservados, inicio de sesión requerido, rechazo de identidades aportadas por el llamador, rechazo de selectores, ausencia de métodos de escritura y protección de la pantalla de solicitudes. La API, su autorización, los permisos de cuentas y las migraciones no cambiaron.

La corrección no da acceso global a la sesión de Balmec. Una sesión de empresa recibe el aviso explicativo y deja de montar la campana global; una sesión global autorizada conserva el diagnóstico. Los escenarios de empresa y superadministrador fueron probados con sesiones sintéticas; no se extrajo una cookie ni se realizó una consulta positiva con la sesión real del usuario.

Evidencia de revisión independiente: `docs/releases/2026-09-25-runtime-access-hotfix-review.json`. Los avisos de extensiones/preload no se declaran resueltos por este cambio. Antes de una futura publicación del circuito comercial avanzado deberá integrarse esta corrección y repetirse su aceptación, sin reintroducir el comportamiento de la base anterior.

## Cierre publicado — 25/09/2026

Código `cb2a845d8220d32716faa2a925ab7a03fe37908f`. GitHub Actions `36088657673` aprobó todos los controles del dashboard y las suites de navegador sobre ese mismo SHA. El artefacto se construyó con configuración de producción, inicialmente sin asignar dominios, y superó siete comprobaciones HTTP previas.

El dominio canónico app.nexid.lat fue verificado con despliegue `dpl_9T1NYietjqJRFZFPt266SJReEzB8`, estado READY, target production y el SHA corregido. Ocho comprobaciones HTTP posteriores aprobaron la preservación del contrato .41, login requerido, rechazo de identidades falsas, rechazo de selectores, ausencia de métodos de escritura y protección de solicitudes. La publicación se certifica por la identidad canónica y los sondeos HTTP, no por un código de salida supuesto de la CLI de promoción.

Las pruebas de Tenant Admin y de la campana usaron identidades sintéticas. No se extrajeron cookies ni se cambió la cuenta del usuario para validar un acceso positivo; tampoco se declara validada la lectura global del diagnóstico con su sesión real. Al recargar, una sesión de empresa debe recibir el aviso de acceso restringido y no iniciar consultas de notificaciones globales. Una cuenta global autorizada conserva el diagnóstico.

No se alteraron API, permisos, base de datos ni flags. La candidata avanzada se mantuvo intacta: esta corrección debe conservarse al integrar la siguiente publicación comercial, sin sustituirla por el baseline .41.

Evidencia: `docs/releases/2026-09-25-runtime-access-hotfix.json`. El commit posterior de documentación no cambia el código publicado.
