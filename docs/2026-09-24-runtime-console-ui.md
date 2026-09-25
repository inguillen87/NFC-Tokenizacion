# NexID — estado operativo desde el panel

Fecha local: 2026-09-24. Rama: `codex/nexid-runtime-console-ui-20260924`.
Base: dashboard publicado `71b3248dcd3d6d40d8eb6668c30ee5442b64195b` (.41).
API compatible observada: `2026.09.24-api-runtime-diagnostics.1` (`c21a0a77`).
Este documento describe un candidato de interfaz, no una promoción productiva.

## Resultado

Nueva ruta `/settings/runtime`, accesible desde Configuración → Estado operativo sólo para una sesión global de superadministrador sin denegación de auditoría. La consulta es explícita: abrir la página, filtrar, abrir detalles y copiar el resumen no hacen consultas adicionales.

La interfaz distingue ocho bloques: soporte, solicitudes, asignaciones, cancelación, cotizaciones, proveedor, acuse documental y compatibilidad de tickets. Separa esquema/registro pendiente, permiso SQL pendiente y requisitos nombrados presentes. Presenta el siguiente paso sin ofrecer controles para ejecutar migraciones, ampliar permisos o habilitar funciones.

Los interruptores distinguen habilitado, desactivado y no configurado. Una función habilitada sin requisitos aparece como alerta. Requisitos presentes no significa funcionalidad publicada o piloto certificado. Los identificadores proceden de la API; los ausentes se muestran como no informados. La correspondencia con la rama del proveedor sigue siendo una comprobación separada.

## Acceso y custodia

La página, el BFF dedicado y el componente comparten la misma restricción de superadministrador global. Empresas, operadores limitados, demos y denegaciones de auditoría quedan excluidos. El BFF consulta un GET fijo usando la credencial de sesión del servidor; no reenvía cookies ni identidad aportada por el llamador.

Se valida y proyecta el contrato publicado. Requisitos, estados, registro e interruptores deben concordar. Una respuesta parcial, contradictoria, demo, vencida o no JSON no se presenta como éxito. No se conservan campos arbitrarios del upstream.

Transporte sin caché ni redirecciones; UTF-8 estricto, 128 KiB máximos, cancelación y plazo de 15 segundos. No hay reintentos ni sondeos automáticos. Una nueva consulta, fallo, revocación o cambio de sesión retira la observación anterior. Se probó A→B→A incluso con transporte sintético que ignora abort.

La información vence como máximo 60 segundos después de recibida y se oculta al abandonar la página/cambiar de pestaña. No se almacena en localStorage ni sessionStorage. El resumen compartible excluye base, usuarios SQL, endpoint, despliegue y commit; se puede revisar y sólo se copia por una acción explícita. No se lee el portapapeles.

No se modifican la autenticación de la API, roles, cuentas, claves ni base de datos. La recuperación y rotación de sesión conservan su mecanismo existente.

## Validación local terminada

- 57 pruebas nuevas de contratos, autorización, transporte, BFF y preservación del código.
- Suite completa del dashboard: 1.290 aprobadas, cero fallos y dos omisiones existentes.
- TypeScript y compilación completa aprobados.
- Navegador: 100 comprobaciones, 12 vistas, cero infracciones detectadas por axe; 320, 390 y 1.440 px, claro y oscuro.
- Expiración, cancelación, revocación, contexto A→B→A y timeout real de 15 segundos comprobados.

Capturas revisadas visualmente en móvil claro y escritorio oscuro. No equivale a una certificación integral de accesibilidad. Se corrigió el retorno de foco después de cancelar y se hizo explícito el formato UTC de 24 horas, incluido el caso de medianoche.

El fixture fue proyectado por el código de la API publicada con entradas sintéticas. Sus nombres y cifras no son los de producción. La prueba visual usa React y HTTP local, no una sesión real de Next. Las fronteras de página/BFF se prueban por separado; la aceptación positiva autenticada sigue pendiente.

Un test fija el contenido normalizado de 441 archivos fuente previos. El único archivo fuente existente modificado es Configuración, para agregar el acceso condicionado. Los ocho archivos fuente nuevos contienen rutas, política, transporte, BFF, panel y estilos. No se alteraron API, dependencias, contratos de release .41 ni módulos de negocio; la rama avanzada de proveedor/acuse permanece intacta.

El workflow de aceptación existente incorpora esta rama y el navegador nuevo. Su resultado remoto debe verificarse por commit, no inferirse de la configuración.

## Publicación y siguiente cierre

La interfaz se puede revisar en una vista previa sin cambiar producción. No necesita migraciones y no aplica 0117–0121. La base continúa identificada como dashboard .41; el candidato se distingue por SHA, no anuncia una .42 industrial.

Antes de promover: revisar el artefacto y la sesión real, y contar con autorización de publicación. No integrar incidentalmente las funciones pendientes de migraciones. Al trasladar este panel a la rama avanzada, actualizar deliberadamente el test de preservación para esa base y repetir sus pruebas.

Siguiente cierre del plan: comprobar API→endpoint desde una sesión real; validar el delta 0117–0121 contra el baseline observado en un entorno aislado autorizado; publicar API/panel compatibles y activar escrituras sólo después de aceptar sus controles. Este panel no convierte un acuse manual en recepción autenticada del proveedor.

## Cierre de este candidato: CI y vista previa verificados

Código: `cbeae033294da57b22eaa0603fc68cbbec3086cf`. GitHub Actions `36080116184` terminó aprobado sobre ese SHA: chequeos completos del dashboard, compilación, secretos y todas las suites de navegador del workflow, incluida la consola nueva.

La vista previa de Vercel está READY y usa el mismo commit. No es un despliegue de producción y no se asignaron dominios productivos. Acceso de revisión: https://nexid-dashboard-ef0yoo4on-marcelos-projects-c26aa499.vercel.app/settings/runtime . Mantiene la protección de la plataforma y el inicio de sesión de la aplicación; no se generó una URL pública que omita esos controles.

Siete comprobaciones HTTP en la vista previa aprobaron: contratos de release preservados, página protegida por inicio de sesión, tres rechazos de acceso al BFF sin sesión válida/con identidad aportada por el llamador, rechazo de selectores y ausencia de POST. Next devuelve la redirección de la página como respuesta transmitida HTTP 200 con NEXT_REDIRECT hacia login y retorno a /settings/runtime, sin el contenido protegido. La comprobación verifica ese destino, no trata cualquier HTTP 200 como acceso correcto.

La autorización usada para esas comprobaciones fue la sesión existente de Vercel CLI. **No es una sesión de NexID y no demuestra aceptación positiva del diagnóstico autenticado.** Esa comprobación sigue pendiente; no se leyeron cookies, contraseñas o perfiles del navegador ni se crearon cuentas.

Producción se volvió a comprobar al 25/09/2026 01:10 UTC: API `2026.09.24-api-runtime-diagnostics.1` y dashboard `2026.09.23-dashboard.41`, con sus commits anteriores y estado READY. No hubo promoción, migración, cambio de permisos o de flags en esta sesión.

Evidencia durable: `docs/releases/2026-09-24-runtime-console-validation.json`. El commit posterior de documentación no modifica ni sustituye el código probado/desplegado en la vista previa.

## Actualización: consola publicada en el dominio canónico

El 24/09/2026 a las 22:25 de Argentina se promovió el código `cbeae033294da57b22eaa0603fc68cbbec3086cf` tras compilarlo con la configuración productiva, inicialmente sin asignar dominios. El alias anterior se verificó antes de promover y quedó registrado para reversión. No se promovió el artefacto de preview con variables de otro entorno.

La consola ya está en `https://app.nexid.lat/settings/runtime`, mediante Configuración → Estado operativo. El contrato de negocio continúa identificado como `.41`; esta publicación no incorpora las ramas comerciales posteriores ni anuncia una `.42` completa.

Se confirmaron ID, commit y estado READY del despliegue canónico. Pasaron siete verificaciones HTTP sobre el artefacto previo y ocho sobre el dominio canónico: contrato previo preservado, inicio de sesión requerido, tres rechazos de identidades no válidas, rechazo de selectores, ausencia de métodos de escritura y protección de la pantalla existente de solicitudes.

El primer sondeo de staging se interrumpió por una salida anormal de la CLI local de Vercel. El sondeo posterior terminó completo; no se relajaron las aserciones ni las protecciones para publicarlo.

La aceptación positiva con una sesión real de superadministrador y la correspondencia API→rama de Neon siguen pendientes. Las verificaciones no extrajeron cookies, contraseñas ni datos privados y no crearon cuentas. El código de API continúa en runtime-diagnostics.1, sin cambios de esquema, roles ni flags.

Evidencia: `docs/releases/2026-09-24-runtime-console-production.json`. Las pruebas anteriores y el CI corresponden exactamente al código promovido; este agregado de documentación no cambia el artefacto.
