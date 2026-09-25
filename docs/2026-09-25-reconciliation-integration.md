# Comparación de borradores — continuidad avanzada

Base: `771afd39d47d5d5514cbbdec88bd74e3bed9e032` (código integrado `3d58dec5`). Incremento incorporado: `bf80ccc04fa73108f8d103ebcc597a8fb833d423`, desde la base productiva `5919edb8`.
Rama: `codex/nexid-reconcile-integrated-20260925`. El merge conserva ambas ascendencias.

La resolución mantiene las guardas avanzadas de lectura, retirada de acceso, cotización, cancelación, asignación, proveedor, acuse y disponibilidad. Sólo añade la validación/comparación y el paso de preparación local del borrador; no reemplaza el workspace completo por la versión productiva más antigua.

El helper, componente y estilos coinciden con los del incremento revisado. El manifiesto mantiene las huellas previas salvo el workspace y registra las tres fuentes nuevas. Una prueba adicional comprueba los bloqueos de las siete operaciones asociadas y la procedencia del incremento; todas las suites previas permanecen en el workflow.

Validación local: 1.754 pruebas aprobadas, cero fallos y dos omisiones existentes. Este total incluye las mismas 44 pruebas de comparación compartidas, más una de integración; no se presentan como un segundo desarrollo. Typecheck y build completos aprobados. Navegador de comparación: 120 comprobaciones en 13 vistas con sesiones/transporte sintéticos.

La revisión terminal puede mostrar un registro cancelado para consulta, pero no volverlo a abrir ni guardarlo como borrador. El backend continúa comprobando tenant, rol, estado, revisión y recibo. La comparación no concede permisos ni representa una aceptación del esquema productivo.

La publicación del incremento compatible se realiza desde su rama productiva separada. Esta candidata avanzada no se promueve ni aplica el delta 0117–0121. API, dependencias, flags, claves, permisos y contratos de release no se modifican. El cierre remoto se registra sólo después de verificar CI por commit y la publicación canónica correspondiente.
