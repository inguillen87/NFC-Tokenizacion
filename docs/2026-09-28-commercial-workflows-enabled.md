# NexID — cotizaciones y cancelación habilitadas

## Cambio autorizado y publicado
El usuario autorizó continuar con la habilitación de cotizaciones y cancelación comercial, manteniendo proveedor y acuse desactivados. La aceptación técnica anterior permanece documentada en PR #382; no se contabiliza como pruebas nuevas de esta publicación.

La API productiva mantiene exactamente la fuente `607fe4057458e4436982df2c08785e233b30b86f`. Nuevo deployment `dpl_AbMAX2Kui9sfa1jF6Nvet1h4bhs5`, servido por `api.nexid.lat`. Esta es una publicación de configuración, no otra versión de código o esquema.

| Interruptor productivo | Estado verificado |
| --- | --- |
| SUPPLIER_REQUEST_QUOTES_ENABLED | true |
| SUPPLIER_REQUEST_CANCELLATION_ENABLED | true |
| SUPPLIER_REQUEST_SUPPLIER_BINDINGS_ENABLED | false |
| SUPPLIER_DELIVERY_ACK_ENABLED | false |

Se modificaron únicamente los dos valores aprobados. Los otros valores, destinos y registros de configuración se contrastaron antes/después sin cambios. El dashboard conserva `8178e093` y `dpl_J98F9FA7hP6MarUt8yVa4WXDS8cw`; la web pública conserva su deployment.

## Verificación efectivamente realizada
Antes de promover, la sesión real de Super Admin confirmó la API anterior, 84 entradas de migración, ocho grupos con requisitos presentes y los cuatro interruptores cerrados. La candidata se construyó desde el mismo SHA con los valores previstos, sin mover todavía los dominios. El build de Vercel terminó READY.

Nueve controles del candidato confirmaron salud del proceso y protección del origen. Se usó autorización normal de la plataforma para alcanzar el deployment protegido; el guard de la aplicación siguió rechazando accesos directos no confiables. No se recuperó ni alteró el secreto del origen y no se desactivó protección alguna. Esos controles no se presentan como lectura autenticada del circuito candidato.

Después de promover, nueve controles en el dominio canónico aprobaron: release exacta, salud y rechazo de accesos anónimos a rutas privadas. La sesión real de Super Admin volvió a consultar el diagnóstico a través del dashboard y confirmó el nuevo deployment, los dos interruptores habilitados y los otros dos desactivados, 84 migraciones y cero funciones habilitadas sin requisitos. La pantalla real también mostró esa configuración.

La lectura autenticada de la bandeja respondió correctamente. No había solicitudes enviadas/preparadas en esa respuesta para completar una aceptación comercial real: no se crearon registros de cliente ni se cotizó o canceló una solicitud como parte de este control. La lectura global no permite inferir que no existan borradores internos.

Consulta de logs del nuevo deployment, nivel error, últimos diez minutos y límite 50: cero entradas devueltas. Es una observación acotada, no monitorización continua ni una garantía de ausencia de errores.

## Reversión preservando evidencia
El deployment anterior `dpl_AeK6btA8zGm8ktygPTSk7BXkXCwk` conserva la misma fuente con escrituras cerradas y lectores compatibles. Para revertir la habilitación, restaurar únicamente los dos valores a false y promover esa API. No volver a un dashboard antiguo, eliminar eventos, revertir migraciones ni retirar claves. El procedimiento se dejó preparado; no se ejecutó una reversión productiva de prueba.

No hubo cambios en Neon, permisos, claves NFC, SUN/SDM o TTStatus, envíos externos ni compras. Proveedor y acuse requieren un cierre operativo independiente; este cambio no los habilita. Manifiesto sanitizado: `docs/releases/2026-09-28-commercial-workflows-enabled.json`.
