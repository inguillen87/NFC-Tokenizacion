# NexID — puesta en marcha centrada en el pasaporte digital

## Alcance
Incremento del dashboard sobre `e905333d93fef3152439446d1f5b7644325e529e`. Reemplaza exclusivamente la puesta en marcha agregada por una guía de trabajo sobre una empresa y un lote explícitos. No modifica API, esquema, claves, permisos, cotizaciones ni los interruptores productivos.

## Problema retirado
La página anterior consultaba cinco fuentes y deducía etapas completas a partir de existencia de pedidos, imágenes, cantidades de unidades y estados de evidencia/titularidad. Mostraba un porcentaje de piloto listo sin verificar que esos registros pertenecieran al mismo lote o acreditaran la ceremonia del piloto. También hacía depender la navegación de esas heurísticas y de fuentes opcionales de blockchain.

La nueva entrada no marca etapas completas ni inventa un denominador. Prioriza el pasaporte digital y permite abrir identidad/expediente, etiquetas/códigos, trazabilidad y excepciones. Los enlaces reutilizan la política de navegación del lote y conservan su empresa y BID exactos. Los módulos restringidos explican su indisponibilidad sin enlace activo.

## Datos y UX
La empresa global debe elegirse explícitamente. Una cuenta vinculada por slug o ID no puede cambiarla mediante URL. Las consultas con selectores duplicados, permisos insuficientes o sesión demo no buscan lotes. Los resultados de otra empresa, duplicados, datos demo, cantidades inválidas y respuestas incompletas se rechazan enteros.

Se realiza una sola consulta GET de lotes cuando el alcance está resuelto, en lugar de cinco fuentes. No hay consultas de activos, pedidos, anclajes ni tokenización. La respuesta exige procedencia productiva y JSON válido, hasta 256 KiB y 300 filas; un único plazo de 12 segundos cubre cabeceras y cuerpo incluso si el transporte no coopera. Vacío confirmado, error, indisponibilidad, denegación y timeout permanecen distintos.

La búsqueda local admite tildes y SKU; no introduce llamadas. El lote no se preselecciona. La selección lleva el foco al detalle; cambiar fuente, empresa o permisos descarta el contexto anterior, incluido A→B→A. Filtrar no cambia silenciosamente el lote elegido. Los enlaces no hacen prefetch y la navegación no realiza escrituras.

Los únicos contadores visibles son filas cargadas y cantidades registradas del lote seleccionado. No se interpretan como QA, publicación del pasaporte, recepción física ni aceptación del piloto. La configuración inicial del tenant conserva el wizard y sus límites de autorización anteriores. Informe y consumo permanecen como herramientas de empresa, sin fingir que un informe global está acotado automáticamente al lote.

## Validación local terminada
Dashboard: 1.839 pruebas aprobadas, cero fallos, dos omisiones preexistentes. TypeScript y custodia de secretos aprobados. Se agregaron pruebas del modelo, transporte y página real con dependencias sustituidas, incluyendo que la página no consulte fuentes cuando el alcance no lo permite.

Navegador: 156 comprobaciones y 19 vistas aprobadas; anchos 320/375/430/768/1024/1440, claro/oscuro, teclado, datos largos, estados vacíos/degradados, cambios de empresa y permisos. Sin infracciones detectadas por axe ni desbordamiento horizontal en las vistas comprobadas. Los datos/sesiones son sintéticos y Link está sustituido; no es aceptación autenticada productiva ni certificación integral de accesibilidad.

Se conservaron los controles históricos de otros módulos. Las huellas de convergencia y de las 483 rutas preservadas se contrastaron contra la base y se actualizaron sólo para las tres fuentes cambiadas y dos nuevas. Se sustituyeron expectativas antiguas de progreso/score por prohibiciones de esas heurísticas, sin retirar pruebas de configuración o seguridad.

El CI y el despliegue se documentan por commit al terminar. Esta entrega no habilita proveedor ni acuse y no crea datos de clientes.
