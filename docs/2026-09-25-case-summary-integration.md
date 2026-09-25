# Expediente profesional — integración avanzada

Base avanzada: `beb536614714213c14d2a01f464af90b30bda6ea` (código previo `fee434d7`). Incremento compartido: `ddd72ef9114e1233b0d8713a1e5f261f7241136b`.

El merge fue automático y conserva ambos padres. Las tres fuentes del resumen de expediente son idénticas a las revisadas en el incremento productivo; el workspace sólo incorpora import y renderizado. Se actualiza el manifiesto explícitamente con sus hashes, sin relajar la comparación del árbol de fuentes.

La vista avanzada conserva disponibilidad, asignación, aclaraciones, cancelación, cotización, proveedor y acuse. El resumen no ejecuta ninguno de esos flujos y no agrega fetches. La metadata de cotización y cancelación sólo se presenta cuando el contrato avanzado ya la contiene.

Validación local avanzada: 1.766 pruebas aprobadas, cero fallos y dos omisiones existentes; typecheck y build completos aprobados. Prueba de procedencia/convergencia aprobada. Navegador del resumen: 44/8. Regresiones comerciales: disponibilidad 89/12, cotizaciones 162/18, proveedor 141/14, acuse 106/12 y cancelación 135/12, todas aprobadas.

La primera ejecución de disponibilidad falló únicamente al guardar una captura por ENOSPC. Se retiraron sólo .next y artefactos temporales QA previamente documentados; no fuentes ni evidencias versionadas. Con espacio disponible, la suite completa aprobó.

Esta rama no se promueve a producción y no aplica 0117–0121. API, paquetes, permisos, flags y contratos de release permanecen fuera de este bloque.
