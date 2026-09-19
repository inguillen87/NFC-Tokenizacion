# S6: revisión de rectificaciones y levantamiento de avisos

## Estado real de esta entrega

Preparación de código en rama aislada; **no desplegada y no integrada todavía a
las rutas de producción**. Base revisada: API
`ef6cbcdc8261824ba75371c944719cabeb6a9f45` (campañas S7 y retiros S6 existentes).
No se cambian la release, el schema, las rutas, los permisos, los avisos ni los
servicios en producción. No modifica el dashboard ni la web del consumidor.

Se añadió una política de decisión ejecutable y sus tests. No es una migración,
no tiene acceso a la base y no ofrece un botón que aparente publicar un cambio.
La integración completa requiere repositorio transaccional, endpoints, interfaz
y aceptación contra la combinación real API/web/dashboard.

## Brecha del módulo existente que se atiende

La API revisada permite preparar, publicar, seguir y cerrar un retiro. El aviso
público deriva del documento publicado incluso después de cerrar el seguimiento.
No se encontró un circuito de rectificación o levantamiento en esas funciones.
El plan general separa el problema comercial del producto de la autenticidad de
la etiqueta: cerrar un expediente no puede convertir automáticamente el lote en
apto ni alterar su precinto.

## Código implementado

`apps/api/src/lib/recall-notice-review.mjs` expone validación de comandos y
`planNoticeReview`, una transición pura. Usa solamente Node.js y no requiere una
dependencia, servicio, licencia o proveedor nuevo.

- Propuesta de rectificación: título, mensaje público, instrucciones y contacto.
  No permite alterar el tipo de retiro, destinos, unidades, claves o estados NFC.
- Propuesta de levantamiento: exige seguimiento cerrado, justificación, referencia
  de evidencia y mensaje de resolución. Mantiene el aviso anterior como historial;
  levantar ese aviso no libera existencias ni borra otros avisos del lote.
- Borrador, revisión, devolución, aprobación y cancelación con versiones.
- El autor, todos los editores y el presentador quedan excluidos de aprobar esa
  misma propuesta. Cambiar el último editor no permite eludir la independencia.
- La aprobación exige autoridad administrativa, permiso efectivo y MFA. El
  superadministrador conserva acceso global pero no un bypass de autoaprobación.
- Cambios en el expediente, la versión del aviso o el texto público invalidan la
  propuesta pendiente. No se vuelve a basar automáticamente sobre nuevos datos.
- Un borrador obsoleto puede cancelarse sin modificar el aviso efectivo.
- Comandos desconocidos, campos de autoridad inyectados, versiones inválidas,
  contenido fuera de límites y propuestas terminales se rechazan.

La función devuelve `requiresAtomicPersistence: true` y `persisted: false` en
TODOS los casos. Una aprobación produce un plan de efecto, no una publicación ni
un comprobante durable. Incluye alcance, versiones esperadas, huella del comando
y datos de auditoría para el repositorio que falta conectar.

## Pruebas ejecutadas

Entorno de trabajo aislado de esta conversación, Node.js **22.16.0**.
No se usó la computadora del titular, PostgreSQL ni Neon para estas pruebas.

```sh
node --check apps/api/src/lib/recall-notice-review.mjs
node --test apps/api/tests/recall-notice-review.test.mjs
```

Resultado: **46 pruebas aprobadas, 0 fallidas, 0 omitidas**. Incluyen los dos
recorridos completos de decisión, autoaprobación, contribuyentes anteriores,
tenant ajeno, denegaciones, MFA, versiones obsoletas, contenido alterado,
levantamiento antes del cierre, transiciones terminales, timestamps, ausencia de
cambios sobre las entradas y separación de estados comerciales/NFC.

No se ejecutaron el build completo de la plataforma, integración PostgreSQL,
pruebas de concurrencia real, navegador autenticado ni despliegue. Un test del
reductor no prueba atomicidad o idempotencia de la base. No se alteraron workflows
para simular un gate aprobado.

## Condiciones de integración y aceptación pendientes

1. Resolver actor, permisos efectivos y pertenencia al tenant desde la sesión.
   `actor`, `current` y `review` son argumentos confiables del servidor; nunca
   deben tomarse del JSON enviado por el navegador. Sólo `body` es el comando.
2. Obtener la versión actual bajo bloqueo en la misma transacción que guarda el
   cambio. Serializar con el cierre y demás acciones existentes del retiro.
3. Consultar primero un recibo durable por tenant/lote/actor/operationId. Comparar
   la huella del comando: repetición exacta devuelve el recibo; contenido diferente
   da conflicto. Nunca regenerar el operationId por una respuesta perdida.
4. Guardar propuesta, historial y efecto público juntos. Controlar una propuesta
   pendiente por caso, verificar compare-and-swap y revertir todo si falla el
   historial. No usar este reductor como sustituto de esos controles.
5. Mantener el aviso vigente mientras se edita/revisa y mostrar comparación antes/
   después. Conservarlo en errores de actualización. El levantamiento exige texto
   visible de resolución, no una desaparición silenciosa ni un estado verde de NFC.
6. Versionar el contrato público para distinguir activo/rectificado/levantado y
   actualizar coordinadamente API y pasaporte. No cambiar retroactivamente las
   respuestas v1 que consumen clientes existentes sin pruebas de compatibilidad.
7. Probar PostgreSQL real: dos aprobaciones concurrentes, reintento después del
   commit, conflicto con cierre, fallo del historial y aislamiento por tenant.
   Probar UI móvil/escritorio, foco, contraste y movimiento reducido.

## Disponibilidad de herramientas observada

GitHub permitió leer código y crear la rama. Desktop Commander informó que no
hay dispositivos disponibles para la cuenta conectada. El conector Vercel
respondió 403 y pidió reautenticación para `marcelos-projects-c26aa499`.
No se intentó sortear esas restricciones ni acceder a secretos. El cambio queda
sin conexión a producción hasta poder completar y verificar su integración.
