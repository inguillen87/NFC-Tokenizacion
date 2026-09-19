# S6 — Rectificación y levantamiento de avisos: integración operativa

Continúa PR #372 (db656903), sin duplicar el sistema de retiros existente.
Base API: ef6cbcdc8261824ba75371c944719cabeb6a9f45 (campaigns.1).
Base dashboard: 903d72628c89481a42a232c81b72957eef723b00 (.17).
Base pasaporte: 7a5c8b0dce589cbfb889a263bb158117e4650bf3 (web-recalls.2).
Entrega prevista: api-notices.1, dashboard.18 y web-notices.1.

## Circuito conectado

Desde un retiro publicado, «Revisar aviso publicado» abre su revisión, no otro
editor de cantidades. Crear rectificación permite cambiar título, mensaje,
instrucciones y contacto públicos. Solicitar levantamiento exige el seguimiento
cerrado, justificación interna, referencia de evidencia y resolución pública.
Los campos de destinatarios, inventario, unidades, autenticidad y precintos quedan
fuera de estos comandos. El aviso vigente no cambia durante edición o revisión.

Guardar -> enviar a revisión -> devolver con observaciones o aprobar -> aplicar
con comprobante. Los creadores, editores y presentadores quedan excluidos de la
aprobación; una persona que contribuyó antes no puede autoaprobar por cambiar de
último editor. Permiso de publicación y MFA son obligatorios para revisión final.
La autoridad se obtiene de la sesión autenticada, nunca de campos del navegador.
La administración global no suprime las reglas de independencia ni las denies.

Una propuesta obsoleta no se rebasa silenciosamente sobre otro aviso. Si cambia
la revisión del caso, la del aviso o su texto, se rechaza la aplicación. Puede
cancelarse con motivo y prepararse otra desde la fuente actual. Reabrir un aviso
ya levantado no está habilitado: una nueva medida se gestiona como otro caso.

## Persistencia y concurrencia

Migración aditiva 0108: propuesta, versión pública efectiva y operaciones con
comprobantes. La función SECURITY INVOKER serializa con el mismo advisory lock
que el flujo de retiros y bloquea filas de expediente/propuesta/aviso. Comprueba
versiones y el snapshot anterior, luego guarda efecto público, propuesta, ambos
historiales y recibo en una transacción. La aprobación aumenta también la revisión
del expediente para que no se pierdan cambios frente al cierre u otras acciones.
No altera el documento original del retiro ni su progreso declarado.

El mismo tenant/lote/actor/operationId y comando devuelve el comprobante anterior;
otro cuerpo es conflicto. La API consulta el recibo antes de exigir que la fuente
siga en el estado anterior. El cliente conserva el intento tras resultado incierto.
Los errores de guardado no se anuncian como éxito ni provocan nuevas claves de
operación. PUBLIC no puede ejecutar la función de escritura.

## Pasaporte y compatibilidad

La API pública v1 conserva su forma y semántica conservadora: refleja las últimas
correcciones textuales aprobadas, pero no oculta el aviso por un levantamiento que
su contrato no sabe representar. No añade un estado desconocido a clientes v1.
La nueva API/BFF v2 distingue noticeState y noticeVersion, resolución y fecha.
El pasaporte usa v2 y muestra «AVISO LEVANTADO», la resolución de la empresa y el
aviso anterior desplegable. No lo transforma en producto apto, stock liberado,
verificación NFC, precinto cerrado o certificado de inocuidad.

Avisos activos tienen prioridad sobre antecedentes levantados. Cuando todos los
avisos devueltos están levantados, la presentación es informativa neutra, no una
señal verde de seguridad. Si falla una actualización, conserva el aviso o resolución
ya recibido e indica incertidumbre. El aviso no desaparece por un fallo de red.
No cambia SUN/SDM, perfiles de tags, GS1, el SDK ni las reglas de autenticidad.

## Experiencia de trabajo

Comparación antes/después por campo con diferencias destacadas, estados de
propuesta, comentarios, historial y confirmaciones nativas con foco. Claro/oscuro,
celular/escritorio y transiciones breves respetan movimiento reducido. Cambiar
pestaña conserva campos sin consultar de nuevo; salir/recargar advierte sobre
campos no guardados o un resultado pendiente. Las acciones no se ejecutan al abrir.
El informe HTML de revisión utiliza datos confirmados y textos escapados; muestra
aviso vigente, resolución, propuestas, evidencias internas y límites de historial.
El informe de seguimiento existente conserva el aviso original y agrega el aviso
efectivo cuando existe. Ninguno equivale a firma digital o prueba física automática.

## Evidencia ejecutada antes del despliegue

La política del PR mantiene 46 pruebas. El repositorio añadió pruebas de integración
con handlers reales y PostgreSQL 17.10 local desechable: creación, repetición,
concurrencia de guardados/aprobaciones, autoaprobación, MFA, denies, separación de
empresas, cambio de seguimiento que invalida propuesta, devolución/cancelación,
levantamiento sólo después del cierre, conservación de v1 y resolución v2.

Se inyectó un fallo en el último historial después de modificar la versión pública:
la transacción revirtió propuesta, aviso, revisión de expediente y ambos registros.
Se verificó que documento original, SDM, estado del lote, etiquetas, TTStatus y
contadores quedaron idénticos. No se usaron registros ni usuarios productivos.
La suite anterior de retiros se vuelve a ejecutar con el esquema aditivo.

Navegador: Next/React/BFF del proyecto + handlers/SQL reales, identidades sintéticas
locales. Recorrido completo de rectificación, respuesta perdida, comparación,
revisión independiente, cierre del seguimiento previo, propuesta de levantamiento,
resolución pública visible, recuperación ante fallo y descarga de evidencia.
Cuatro casos de revisión 1440/390 y claro/oscuro, más pasaporte móvil. Sin errores
no capturados ni incidencias axe serias/críticas en la superficie evaluada. No es
una certificación WCAG ni un TAP físico nuevo.

## Publicación y límites

La migración no crea propuestas ni avisos por sí sola. No se rectificará ni levantará
un caso real para probar el despliegue. El chequeo previo de Balmec dio cero casos,
10 etiquetas activas, 10 inactivas y hash de configuración
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
No se modifican planes, tamaños de cómputo, proveedores, claves o permisos de cuenta.

Orden: esquema aditivo verificado -> API compatible -> pasaporte v2 -> dashboard.
Conservar API actual de campañas y artefacto SDK al tomar la base. Un rollback a
una versión que desconoce rectificaciones puede volver a mostrar el aviso original:
preferir roll-forward; nunca borrar propuestas, desactivar advertencias o modificar
etiquetas como forma de reversión. No se promete historial inmutable ante un DBA.

Falta para otros cierres: acuses directos del distribuidor, notificaciones
explícitamente autorizadas y documentos de evidencia gestionados como archivos
con su control de vigencia. Esta entrega registra referencias aportadas por
responsables; no verifica automáticamente su autenticidad ni la devolución física.
