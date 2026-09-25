# NexID — resolver diferencias de un borrador sin sobrescribir a ciegas

Base productiva verificada: `5919edb8375d894df27523046fc6c83d254d4880`.
Rama: `codex/nexid-draft-reconcile-20260925`. Incremento exclusivamente de panel; API, SQL y protocolos existentes sin cambios.

## Resultado visible

Ante un conflicto de guardado, la comparación muestra campo por campo la edición local, la versión consultada del servidor y, en un detalle, el valor original del borrador. Distingue cambios locales, remotos, coincidentes y cambios distintos sobre el mismo campo.

Los cambios en campos diferentes se proponen juntos; si el mismo campo cambió de forma diferente en ambos lados, se exige elegir explícitamente. Nada se escribe al consultar, seleccionar o aplicar. «Aplicar selección al borrador» prepara una edición local sobre la revisión consultada; «Guardar borrador» es una acción posterior e independiente.

Una segunda modificación del servidor conserva el control de versión: no se sobreescribe y se puede comparar otra vez. Si el guardado posterior pierde su respuesta, el mecanismo existente recupera el mismo recibo con la misma identidad de operación.

La alternativa de cargar toda la versión del servidor conserva su confirmación de descarte. Escape o cerrar la comparación mantienen el texto local y devuelven el foco. Una solicitud ya enviada o preparada no se reabre mediante esta herramienta; sólo admite comparar y cargar para consulta.

## Integridad y UX

Se exige misma solicitud, empresa e identidad de tenant; una revisión anterior o datos distintos con la misma revisión se rechazan. La decisión está vinculada a todos los campos comparados y pierde vigencia al modificar el texto local. Esa invalidación no remonta el panel ni roba el foco al escribir.

Un error o cancelación al releer retira la comparación anterior; 401/403/404 conservan la retirada de acceso ya implementada. Las guardas síncronas impiden aplicar decisiones mientras existe una lectura o escritura, aunque se fuerce un control deshabilitado. No se cambia autoridad ni se usa la comparación como autorización.

La comparación normaliza para detectar equivalencias sólo lo que ya normaliza el guardado: espacios de nombre/notas y cantidades enteras válidas. La selección mantiene el texto local original para revisarlo; valores numéricos ambiguos no se corrigen silenciosamente. Vaciar notas opcionales es una decisión real, no un fallback al texto viejo.

Diseño responsive con valores lado a lado en escritorio y apilados en móvil, rótulos persistentes, selección por radio y textos largos accesibles con teclado. No hay copias automáticas al portapapeles, almacenamiento local, enlaces externos ni guardados automáticos.

## Verificación local

44 pruebas nuevas: combinaciones de los cinco campos, decisiones sin resolver, campos opcionales vacíos, igualdad normalizada, datos inválidos, contexto ajeno, versiones obsoletas y estados que ya no son borrador. Suite del panel: 1.438 aprobadas, cero fallos y dos omisiones existentes. Typecheck y build completos aprobados.

Navegador de comparación: 120 comprobaciones y 13 vistas; incluye móvil 320/390 px, escritorio 1.440 px, claro/oscuro, texto largo, foco continuo al escribir y controles manipulados. Regresiones de lectura, guía y solicitud completa: 124/7, 171/12 y 287/33 respectivamente. Se conservaron todos los controles previos de CI.

Las pruebas visuales usan componentes reales, sesiones/transporte sintéticos y un simulador de revisión/idempotencia; no una base de clientes ni una cuenta productiva. Los tests comprueban que el PATCH lleve la revisión leída, pero no sustituyen la aceptación SQL del backend. Las capturas de móvil claro y los textos largos se revisan como parte del cierre; cero incidencias de axe no implica certificación integral de accesibilidad.

El primer intento de generar el componente falló por un literal anidado en el script de edición, antes de escribir las fuentes; fue corregido. Se añadieron regresiones específicas para no robar el foco al invalidar decisiones y para desplazamiento por teclado de notas largas. No se omitieron pruebas ni se relajaron las guardas para conseguir una aprobación.

## Publicación e integración

La promoción debe usar exactamente el commit aprobado por CI y comprobado en un artefacto preparado sin asignación automática del dominio. Hasta registrar esa evidencia, este documento no declara producción actualizada.

La misma comparación debe incorporarse a la candidata avanzada conservando los bloqueos de cotización, cancelación, técnicos, proveedor, acuse y disponibilidad. No incluir incidentalmente esos módulos pendientes en el despliegue productivo de este incremento. API, migraciones 0117–0121, flags y permisos quedan fuera de este sprint.

## Cierre verificado

Publicado el incremento compatible `bf80ccc04fa73108f8d103ebcc597a8fb833d423`: READY en app.nexid.lat después de CI 36160686876 y seis comprobaciones HTTP. Esas pruebas verifican publicación y fronteras de acceso, no una comparación con sesión productiva. La API permanece en `c21a0a776247d5109706e52db5895e817ea42cb9`, sin cambios. No se aplicaron migraciones ni permisos/flags.

La candidata avanzada `fee434d7cc114e64381edaa0f75f4d4c40a86b90` conserva la misma comparación y también aprobó CI 36161566804. No fue promovida a producción. Las tres fuentes compartidas coinciden; se mantienen las guardas de los circuitos industriales. Los resultados locales corresponden a sesiones y transportes sintéticos.

Se revisaron visualmente comparación en escritorio oscuro y móvil claro, y las notas largas mantienen acceso por teclado. Evidencia durable: `docs/releases/2026-09-25-draft-reconciliation-validation.json`. El commit de este cierre sólo agrega documentación; no sustituye los SHA de código probados.
