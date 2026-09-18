# S2.1 — Transacciones e idempotencia de logística

Base API: 29c4f6231bb6f4a47756905d9c533b02bce50c4d.
Release: 2026.09.18-api-logistics.1. Protocolo: nexid.logistics.v1.

## Alcance

Crear envío con sus partidas y aplicar/traspasar/verificar precinto pasan por
una función PostgreSQL invocada mediante una sola sentencia parametrizada.
Cada operación guarda mutaciones de dominio y comprobante en la misma transacción.
La verificación del receptor y la revisión aplicable se incluyen; ya no ocurren
como escrituras independientes después de actualizar el precinto.
La proyección de auditoría y el registro de uso SDK siguen siendo auxiliares:
no se afirma que esos logs externos sean exactamente una vez.

Idempotencia: enviar `Idempotency-Key` o `operation_key` en el cuerpo (8–120
caracteres alfanuméricos, punto, guion, guion bajo o dos puntos). Se vincula a
empresa, actor autenticado y payload normalizado. Una repetición con la misma
identidad devuelve el comprobante original; datos diferentes generan conflicto.
Los clientes antiguos sin identificador mantienen compatibilidad y reciben
`idempotencyProvided:false`; no tienen deduplicación entre solicitudes distintas.

Se bloquea el precinto y luego el envío antes de modificar estado. La asignación
a otro envío, incluso dentro de la misma empresa, se rechaza. Un dato TT ausente
permanece desconocido y requiere revisión: nunca se convierte por defecto a 4343.
Los estados terminales no retroceden; el estado agregado del envío considera
todos sus precintos y conserva las señales de apertura/revisión.

La consulta de envíos usa subconsultas independientes para contar partidas,
precintos y eventos: la cantidad de unidades no se multiplica por los joins.
Las rutas administrativas mantienen su restricción de rol y verifican permisos
logistics:read/write. Las rutas SDK siguen exigiendo sdk:logistics.

## Migración y seguridad

`20260918050000_0103_logistics_atomic_operations.sql` agrega la tabla de recibos
y la función SECURITY INVOKER. No borra ni reescribe datos existentes y no amplía
el watermark global de SUN: una falta de esta migración afecta solo logística.
PUBLIC no recibe permiso sobre tabla o función. El usuario DB autorizado del
backend debe tener permisos; no se habilitan roles anónimos.
No se modifica la verificación SUN/SDM, las claves, la URL de las etiquetas,
los planes, los tamaños de cómputo ni ninguna integración de cobro.

## Evidencia local

21 comprobaciones aprobadas sobre PostgreSQL real 17.10 en Windows, en clúster
efímero enlazado solo a 127.0.0.1, máximo 12 conexiones y datos exclusivamente
sintéticos. Se inyectaron fallos después de crear el envío y después de modificar
el precinto: los cambios y el recibo se revirtieron por completo.
Ocho solicitudes concurrentes con la misma identidad crearon un envío; ocho
escaneos repetidos crearon un evento de custodia. Se probaron empresas distintas,
asignaciones concurrentes, verificaciones repetidas, alertas y múltiples precintos.
También se ejecutó la consulta real de listado para comprobar que dos partidas
con cantidades 2 y 3 siguen sumando 5 aunque existan varios eventos y precintos.
El harness está en `apps/api/scripts/validate-logistics-atomic-postgres.mjs`.

Build API y su cadena de pruebas aprobados, incluidas pruebas de SUN, autenticación,
recompensas, webhooks y proveedores; se agregó test:logistics al mismo build.
La suite específica tiene ocho pruebas nuevas de contratos y cuatro de política.
No se ejecutaron operaciones sobre envíos o etiquetas reales para certificarlas.

## Límites y reversa

El estado TT de estos endpoints es declarado por un operador; esta operación no
realiza una nueva verificación criptográfica NFC ni demuestra contenido o custodia.
La recepción manual de reclamos por otras rutas no se transforma en un seguimiento
logístico universal. El alcance de esta entrega son CREATE/APPLY/HANDOFF/VERIFY.
Los recibos crecen con el uso; no existe un tope monetario por tenant en esta entrega.
Rollback de aplicación: dpl_76TRRjoH8xggAaq37aAJF8Cbs5eA. El esquema aditivo puede
permanecer, pero volver a la versión anterior vuelve a las garantías anteriores.
