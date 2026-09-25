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
