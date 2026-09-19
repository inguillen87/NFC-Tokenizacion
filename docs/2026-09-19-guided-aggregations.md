# S3/S5 — Agrupaciones guiadas en la operación EPCIS

Base API: e5af0bb044a7e9c5a912280eeb3663679ebf8abc,
2026.09.19-api-intake.1. Base dashboard:
d6c527349ad7868d70cd5d4f8354b6624bfe1021, 2026.09.19-dashboard.23.
Entrega: 2026.09.19-api-intake.2 / 2026.09.19-dashboard.24.
Web conservada: e94720e2519c28f0b2ce32db67bd04be0255a093,
2026.09.19-web-consumer.1.

## Cierre del plan original

La operación ya permitía recepción, despacho y almacenamiento guiados, además
de importar documentos EPCIS de agrupación desde un archivo. Esta entrega NO
presenta ese motor como nuevo: hace utilizable la agrupación desde el formulario,
sin que el operador tenga que construir JSON o pedir al administrador una carga.

En Registrar movimientos se agrega Unidades, cajas y pallets. Permite elegir
un contenedor registrado y entre 1 y 49 identidades serializadas, revisar la relación
y utilizar exactamente el preview, aprobación explícita y captura existentes.
Se conserva el acceso a Carga guiada y Archivo del ERP / WMS.

## Acciones y alcance

Agrupar genera AggregationEvent/ADD con paso de empaque. Separar genera DELETE con
las unidades seleccionadas y paso de desempaque. Observar genera OBSERVE sin
inventar un paso de negocio no aportado. El contenedor permanece explícito y la
lista de hijos nunca queda vacía. No se usa el caso de DELETE vacío para declarar
una separación de todo el contenido, ni se infiere que una caja quedó vacía.

Estas acciones son declaraciones registradas por un actor autorizado, no prueba
de lectura física UHF, autenticidad NFC, precinto, peso, GPS o custodia actual.
La selección de un elemento como contenedor es una decisión del operador; el
software no reconoce automáticamente el tipo físico por su nombre o número de serie.
No se modifica inventario, pertenencia vigente ni el estado de los envíos.

El perfil del asistente admite GTIN de 14 dígitos con control válido y calificadores
lote/serie del registro existente. Exige serie no vacía para padre e hijos: no
convierte una identidad de clase o cantidad en una unidad física individual.
SSCC, EPC URI de lector, cantidades de granel y transformación guiada quedan fuera.
La importación por archivo de los otros tipos soportados mantiene su recorrido.

## Selector de identidades

Una nueva lectura /admin/batches/[bid]/epcis-intake/identities reutiliza la sesión,
los permisos y el limitador de la admisión existente. El alcance se resuelve por
el usuario; un parámetro de otra empresa no concede acceso. Consulta del lote
actual o de otros lotes de esa misma empresa, estos últimos con al menos dos
caracteres de búsqueda. Consulta sólo al pulsar Buscar identidades o Más coincidencias.

Las filas provienen de identidades activas con serie, lote y tenant activos y
prefijo autorizado. Se proyectan ID, GTIN, lote, serie, BID y nombre acotado; no
se exponen claves, UID NFC, metadatos privados o URLs SUN. El buscador es literal,
no interpreta comodines introducidos en texto. Rechaza controles antes de recortar
espacios, parámetros repetidos o campos inesperados. Máximo 80 caracteres por búsqueda.

El resultado muestra hasta 50 candidatos por página con continuación por UUID.
El cursor va ligado a empresa, lote de trabajo, alcance y texto; sólo es posición,
no autorización. Hay una consulta acotada de selección además de resolver el lote
y los controles actuales de sesión/admisión. No se promete snapshot entre páginas:
identidades activadas, retiradas o modificadas pueden cambiar la siguiente búsqueda.

El máximo de 49 hijos más padre mantiene la revisión de un solo evento por debajo
del presupuesto de captura. Se rechazan padre igual a hijo, IDs repetidos, la misma
identidad por diferentes representaciones y selecciones sin ninguna identidad del
lote abierto. Los hijos se ordenan de forma canónica antes de construir el documento.

## Referencia estable, revalidación y recuperación

El generador conserva el namespace y algoritmo de identidad del formulario anterior:
SHA-256 de empresa más referencia comercial. Reordenar los mismos hijos no cambia
el documento; reutilizar la referencia para un movimiento distinto genera conflicto
en lugar de crear silenciosamente otra copia del mismo hecho comercial.

La hora local se valida contra el calendario y el reloj del dispositivo; una fecha
normalizada a otro día o una hora inexistente se rechaza. El evento conserva UTC y
el offset elegido por el entorno del operador. No se presenta como tiempo de una
antena ni como una fecha firmada por hardware.

La selección todavía no es validación. Preview vuelve a resolver las identidades
y autorizaciones en servidor. Antes de mostrar el diagrama revisado, la interfaz
comprueba tipo, acción, ID estable, instante y cada identidad devuelta contra el
documento preparado. Cualquier cambio de formulario invalida la revisión y el
consentimiento. Confirmar conserva los permisos de escritura y MFA actuales.

No hay un nuevo endpoint de escritura ni una segunda función de captura. Sigue
usándose la transacción de captura/proyecciones/outbox de la migración 0111.
Se retiene el mismo intento ante una respuesta perdida, se bloquea la edición
mientras está incierto y se recupera el comprobante original. El historial anterior
no se borra al separar; el nuevo evento aparece mediante queryEpcisEvents existente.
Los webhooks configurados conservan su aviso previo a confirmar y el outbox habitual.

Preparar otro movimiento sólo limpia campos locales después de un comprobante
confirmado, mantiene el historial y vuelve el foco a la referencia. No borra registros.
Las selecciones son de la sesión de página; no se persisten borradores en localStorage.

## UX/UI y recursos

El formulario muestra las tres acciones como decisiones distintas. Un esquema
contenedor/unidades permite revisar series, lote de origen y selección; la separación
invierte la dirección de la flecha y presenta una advertencia contextual. La misma
composición aparece en la revisión sólo después de validarse el contenido del servidor.

La fecha está junto a la referencia. Tras validar, la búsqueda se pliega para que
no empuje la revisión fuera de la vista móvil; las unidades elegidas permanecen
visibles y se puede volver a abrir la búsqueda. Pestañas conservan los campos sin
consultar de nuevo. Resultados de búsqueda fallidos desaparecen como opciones, sin
borrar candidatos ya elegidos ni fingir que fueron validados.

Se reutilizan React, CSS Modules, iconos y tokens del dashboard. Claro/oscuro,
foco visible, soporte de teclado y movimiento reducido. No se incorpora un framework
visual, un servicio, una base ni una dependencia nueva.

## Validación ejecutada

12 escenarios con PostgreSQL real local, el generador real de la UI y el motor
actual: selección paginada 50+5, búsqueda de otro lote, cursor y alcance, estados
suspendidos/inactivos, prefijo revocado, preview sin captura, seis confirmaciones
concurrentes, referencia repetida, separación sin borrar historia, observación,
revocación posterior a la selección, lectura sin MFA y recuperación mediante la
consulta EPCIS existente. Los datos y sesiones son sintéticos locales, no clientes
ni hardware reales. Se repitieron los 16 escenarios previos de admisión para
comprobar rollback, outbox, conflicto y compatibilidad del contrato SDK anterior.

La prueba integrada usa Next/React/BFF con esa misma base y servicios, no receipts
inventados. Nueve comprobaciones: no consultas al teclear, selección multi-lote,
revisión antes de registrar, tabs sin pérdida, respuesta perdida después de SQL,
comprobante descargable, separación y observación, recarga de recibos, continuación
de selección, fallo de fuente y rechazo sin MFA. Incluye preparar otro movimiento
sin borrar la captura. Cuatro variantes 1440/390 claro/oscuro no tuvieron hallazgos
axe en la superficie evaluada. No equivale a certificación WCAG.

Pruebas nuevas de unidad: cinco de selector API y nueve del generador/contrato.
La validación detectó y corrigió el recorte prematuro de un control en el texto de
búsqueda. Dashboard completo: 918 pruebas, 916 aprobadas, cero fallidas y dos omitidas.
Los builds y gates de secretos deben estar aprobados antes de promover.

## Preservación y siguientes límites

No se modifica el motor EPCIS, verificador SUN, claves, contadores, TTStatus, perfiles
QR/GS1, transacciones de propiedad, Polygon/IOTA ni el portal del consumidor. No
requiere migración: 0111 permanece como la versión instalada. El selector hereda
12 solicitudes/minuto de observabilidad; la confirmación sigue en dos documentos
por minuto y empresa. No se activa polling ni mensajería de campañas.

La primera consulta productiva mantiene cero eventos EPCIS y capturas; Balmec
conserva 10 activas, 10 inactivas y la configuración
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
Por ser TagTamper sin identidades GS1 registradas, no se convierte Balmec para
rellenar el selector. El primer uso requiere identidades autorizadas de la empresa.

No se cierra aquí una topología actual reconciliada entre todas las declaraciones,
un gateway UHF, invitaciones a terceros, impresión SSCC ni una certificación GS1.
Sí queda resuelto el paso humano de declarar una relación serializada sin archivo
manual, con evidencia y controles del motor de producción ya existente.

Rollback previo API: dpl_4LMMe8jTYc9x5gbQdDanhCufqXa9.
Rollback previo dashboard: dpl_6QdU9HXBZxAFoYoJhSBDDXAwFQwq.
Publicar API compatible antes de promover la interfaz, sin revertir evidencia.

Gates finales: builds completos y controles de secretos aprobados en ambas apps.
Se repitieron los 12 casos nuevos y los 16 previos sobre PostgreSQL local después
de corregir la búsqueda. Dependencias, lockfile y motor de captura sin cambios.
