# S3/S5 — Expediente de trazabilidad del lote

API prevista: 2026.09.19-api-trace.1, base a39eaf32bc861ad4a0d073c5e1115b1c6efab80b.
Dashboard previsto: 2026.09.19-dashboard.21, base 210964916f3877666cb22b2e8b69c021f612964c.
Web conservada: 2026.09.19-web-consumer.1, e94720e2519c28f0b2ce32db67bd04be0255a093.

## Correspondencia con el plan original

Se cierra un tramo del expediente único: consultar eventos EPCIS ya registrados,
interpretar sus vínculos y seguir el lote relacionado sin duplicar productos,
SDK, ingesta EPCIS ni datos de custodia. El perfil de integración existente sigue
siendo el medio de captura; esta entrega es de consulta y exportación.

Entrada desde Lotes -> Trazabilidad o desde Operación y calidad del expediente.
Ruta /batches/[bid]/traceability. La vista distingue cronología y relaciones de
los envíos que utilizaron precintos del lote. No infiere contenido por nombre,
SKU, proximidad ni un identificador no registrado.

## Qué representa cada resultado

El período es de 1 a 93 días con inicio incluido y fin excluido, ambos UTC.
Se filtra tipo de evento e identidad registrada de este lote. La cronología
ordena por momento declarado y mantiene separada la fecha de registro en NexID.
Se muestran hasta 50 eventos, 100 identidades y 10 envíos, con señales explícitas
de truncamiento. Los indicadores son cantidades visibles, no totales históricos.

Al abrir un evento, padres/hijos y entradas/salidas se obtienen de sus campos y
los identificadores GS1 vinculados dentro del mismo tenant. Seguir el padre abre
el lote al que realmente pertenece y su propia historia. Una unidad en una caja
no se presenta automáticamente como miembro de un pallet que aparezca después.
Las cantidades conservan su unidad de medida y no se convierten en unidades
físicas serializadas. Los identificadores no interpretables se cuentan como
referencias no asociadas; no se muestran valores arbitrarios del JSON original.

ADD, OBSERVE y DELETE permanecen como declaraciones históricas. DELETE no borra
registros. Una transformación tiene entradas y salidas, no una relación de
contenedor. Los eventos con errorDeclaration muestran una advertencia explícita.
La vista no reconstruye composición actual, ubicación GPS, custodia actual ni
autenticidad NFC. Tampoco prueba la lectura física de un equipo UHF.

Los envíos se enlazan por package_seals -> seal_inventory.batch_id y tenant.
El estado mostrado es el del módulo logístico al consultar, fuera del filtro
histórico EPCIS. Un vínculo con un precinto NO identifica el contenido del envío.
Las acciones abren el expediente logístico existente, sin crear otro envío.

HTML autónomo, CSV y JSON se generan del resultado cargado. Abrir o descargar
no agrega lecturas. Un detalle tiene su propio JSON de evidencia con alcance,
roles y referencias; su timestamp se conserva separado de la consulta general.
HTML escapa los valores, no carga recursos externos ni ejecuta scripts. CSV
neutraliza celdas con inicio de fórmula. No se afirma firma digital o inmutabilidad.

## Control de acceso, UX y consultas

La API admite GET y exige batches:read y logistics:read con el rol existente,
resolución de sesión persistida y denegaciones explícitas. Una consulta directa
a otro tenant se rechaza. El BFF conserva su conducta anterior: fija la empresa
de una cuenta de cliente, sin conceder acceso a la empresa solicitada en la URL.
La UI valida tenant, lote, filtros, referencia de evento y límites al recibir datos.
No se cambian permisos o membresías y no se crea una credencial nueva.

El detalle proyecta sólo campos operativos acotados. No exporta event_json entero,
UID, claves, metadata privada del registro, extensiones de sensores ni credenciales.
Cada consulta de lista ejecuta dos SELECT: resolución de alcance y una consulta
agrupada con eventos, identidades y envíos. Abrir un detalle ejecuta su resolución
y lectura; cambiar de pestaña y descargar no consultan la base. Sin polling,
precalentamiento de Neon, almacenamiento local persistente ni nueva dependencia.

La vista usa claro/oscuro, filtros, cronología, estados de selección y panel de
relaciones. Los vocabularios reconocidos tienen etiquetas comunes; los originales
permanecen disponibles en los datos. Al abrir un evento se enfoca el detalle; en
celular también se desplaza a ese panel, respetando movimiento reducido.
Editar filtros deshabilita la exportación de la consulta hasta actualizarla.
Una nueva consulta retira resultado y detalle previos; un fallo no se representa
como cero eventos. Los estados vacíos no contienen recorridos o cifras ficticias.

## Evidencia de aceptación

15 escenarios sobre PostgreSQL 17 local con los handlers reales de lectura:
alcance, relaciones, paso de caja a pallet, DELETE, transformación, cantidades,
error de origen, permisos, fechas UTC, filtros ajenos, proyección segura, historial
con identidad suspendida, resultados limitados, fallo de fuente y conservación
original de la configuración. La preparación usó datos sintéticos insertados en
las tablas EPCIS con sus DDL y relaciones; no fue una prueba del gateway de captura
ni de un lector industrial físico.

11 comprobaciones de navegador con Next/React/BFF y las mismas consultas reales:
lista, envíos, relaciones, evidencia individual, exportaciones, navegación entre
lotes, distinción de acciones, advertencia de error, filtros modificados, fuente
caída y límites de autorización. Cuatro variantes 1440/390 y claro/oscuro pasaron
sin incidencias axe en la superficie evaluada. No constituye certificación WCAG.

Dashboard: 895 pruebas, 893 aprobadas, cero fallidas y dos omitidas; TypeScript
y build completos. API: siete pruebas específicas más build y regresiones completas.
Se corrigió durante la aceptación el uso incorrecto de un evaluador sólo para
permisos de alto impacto, que rechazaba lectura logística válida. La página ahora
usa el evaluador de lectura existente; una prueba específica evita la regresión.
Los selectores del navegador esperan contenido visible, no copias ocultas de SSR.

## Despliegue y siguientes límites

No requiere migración ni escrituras de negocio, y no modifica SUN, TTStatus,
Polygon/IOTA, frontend público, campañas, importación de etiquetas ni SDK.
La consulta productiva inicial mostró cero eventos EPCIS y cero identidades GS1:
la UI no simula una cronología para llenar ese vacío. El cliente debe incorporar
sus eventos por el contrato existente para ver su recorrido real.

Quedan fuera el cálculo de composición vigente, captura visual de nuevos eventos,
importador específico de lector UHF, sensores, reconciliación de documentos del ERP
y relaciones no registradas en el perfil GS1 actual. El cierre de este sprint es
consulta trazable y accionable sobre la evidencia que ya existe.

Reversa previa API: dpl_9LEp6zxrXfMpP6TB2g7rFSqYAzqb.
Reversa previa dashboard: dpl_5PWgoZPTDFqtsy4CAcuvVXjjykFX.
Web preservada: dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg.
