# Contexto operativo confirmado: Marcelo y Balmec

Confirmado con el titular y contrastado con los registros el 18 de septiembre de 2026.

Marcelo Guillén administra NexID como super_admin global, sin tenant asociado.
Su cuenta NO debe convertirse en el tenant-admin de Balmec para probar la operación.
Seleccionar una empresa en una consola de superadministración filtra el trabajo;
no cambia actor, identidad, permisos ni se registra como aprobación del cliente.

Bodega Balmec (slug demobodega) es una empresa piloto de vinos. Sus 10 etiquetas
activas corresponden al conjunto utilizado por Marcelo en pruebas físicas NFC.
La base consultada conserva además 10 etiquetas inactivas anteriores: 20 registros
totales, no 20 etiquetas del kit activo. Se preservan estado e historial. El nombre
DEMO-2026-02 del lote y el slug no convierten una lectura persistida en simulación.
No codificar estos nombres, cantidades o UIDs como excepciones de autorización.
No reactivar, borrar, reimportar ni recodificar etiquetas para acomodar un contador.

Este lote histórico no tenía un pedido industrial vinculado en la consulta.
Probar un TAP físico no equivale a haber aprobado recepción de un pedido de fábrica.
Un pedido nuevo debe identificar empresa, propósito, rollos, cantidad y evidencia.
El propósito trial_integration no habilita liberación comercial. El plan QA de
producción requiere aprobación del cliente y sus condiciones de doble control.

Superadministración: crear empresas y pedidos, ejecutar QA y solicitar activación
según sus controles. La cuenta global no firma el plan de calidad en nombre del
cliente. Recepción: importar manifiestos según permiso. Calidad/operaciones:
registrar evidencia y controles. El proveedor no recibe autoridad global ni
secretos fuera del intercambio de fabricación autorizado.

Las pruebas de roles deben usar cuentas independientes y permisos efectivos.
Una comparación de perfiles es informativa; no se inventan usuarios, aprobaciones
ni membresías. Ningún cambio de esta entrega dio permisos o cambió contraseñas.
