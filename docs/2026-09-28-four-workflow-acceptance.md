# NexID — aceptación operativa de los cuatro circuitos

## Alcance
Base `69c8bfad6d5a3f2417b9f98a6e39d4b39b02bed7`, integración de la API publicada `607fe405`. Esta entrega amplía la aceptación reproducible; no cambia handlers productivos, migraciones, dependencias, dashboard, variables remotas ni permisos de usuarios.

Se reutiliza el recorrido HTTP de los handlers reales, el esquema completo de 132 migraciones y las identidades de prueba persistidas. El recorrido se ejecuta como dueño de la base local y de nuevo desde un proceso con un login SQL restringido e independiente. No hay registros ni credenciales de clientes.

## Operaciones verificadas
- Cancelación: envío previo, rechazo de otra empresa y versión obsoleta, cancelación válida, recibo idempotente, rechazo de otra cancelación y lectura histórica después de apagar el interruptor.
- Cotizaciones: publicar, rechazar, publicar otra versión, retirar, publicar la tercera y aceptar; versiones antiguas no pueden reemplazar la actual. Se conserva el bloqueo de conversión técnica hasta aceptar.
- Proveedor: asignar contra la especificación aprobada, retirar antes del envío y reasignar; se conservan los eventos, el control de revisión y el vínculo del comprobante con la asignación vigente.
- Acuse: declaración manual, incidencia por hash diferente, retiro y corrección mediante otro evento. Reintentos recuperan el recibo original. Ninguna versión declara identidad autenticada del proveedor, descarga, descifrado externo o recepción física.

El exportador cifrado y el descifrado en memoria siguen siendo reales; no se escriben ni publican claves o contraseñas. Las cantidades, proveedores, importes, evidencia declarada y comunicaciones son sintéticos y locales.

## Interruptores y persistencia
Se apagan los cuatro interruptores sólo en el proceso de pruebas. Las nuevas escrituras devuelven el motivo específico de desactivación, no un éxito ni un error de contrato confundido. La autorización anónima se rechaza primero; las lecturas históricas compatibles permanecen disponibles. La cancelación desactivada no inicia su flujo.

También se habilita cada interruptor por separado y se confirma que los otros tres permanecen cerrados. Antes y después se compara el registro de la solicitud y las cantidades de sus operaciones/eventos persistidos; las comprobaciones de disponibilidad no los alteran. Los valores originales del proceso se restauran incluso ante errores.

## Rol de pruebas y motor
El perfil anterior no concedía EXECUTE a la función de cancelación y falló al intentar cubrir este cuarto circuito. El perfil QA v2 agrega exclusivamente `nexid_cancel_supplier_request_v1`: mantiene 37 tablas, los mismos permisos de columnas y 44 funciones explícitas. No hay concesión automática ante errores y el rol productivo no se modifica.

Se incorporó PostgreSQL 17.11 al pin exacto del worker, ya admitido por el harness principal. Versiones distintas y destinos remotos siguen rechazados. La primera ejecución reveló esa divergencia del harness; no se presentó como un fallo de producción.

## Verificación local terminada
174 comprobaciones con el dueño efímero y 175 con login restringido; 144 pruebas de seguridad aprobadas, sin fallos. Se verificaron 37 tablas, 595 columnas y 44 funciones sin privilegios inesperados. Los controles de denegación SQL y la invariancia de catálogos continúan activos. Conexiones cerradas, rol temporal eliminado, servidor local detenido y datos efímeros retirados.

Los resultados de CI se registran por commit en la PR cuando terminan. Esta aceptación no cubre DNS/TLS/middleware de Next, recepción externa ni un TAP físico. La verificación productiva de esta entrega sólo lee deployments y los cuatro valores de configuración, que siguen desactivados. La habilitación productiva es una acción independiente.
