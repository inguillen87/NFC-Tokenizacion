# S8b: ficha vigente y evidencia histórica

Candidato web `2026.09.21-web-current-editorial.1`, sobre el código productivo
`6cfd8bb451cef438786a623e336a187728a30f86` y documentación `cd27d15a`.
Requiere API `2026.09.21-api-current-editorial.1` para la proyección
`nexid.current-editorial.v1`; con API anterior muestra disponibilidad desconocida.

## Cambio visible

Debajo de la evidencia de lectura aparece una ficha editorial independiente.
Cuando hay una publicación verificable, el resumen muestra versión y fecha UTC;
el detalle plegado contiene idioma original, datos publicados y enlaces actuales
a fichas técnica y de seguridad con su dominio externo. El idioma de la interfaz
no reescribe lo declarado en otro idioma. El bloque se oculta en la demo.

Los enlaces del registro anterior se identifican como conservados en aquella
lectura. No sustituyen enlaces ausentes o eliminados de la publicación vigente.
La fecha es la publicación de la ficha, no la revisión o vigencia legal de un PDF.
La consulta no renueva la lectura ni confirma acciones de consumidor.

Sin publicación, sin versión anterior, estado no publicable del lote, integridad
no validable y fuente no disponible presentan mensajes diferenciados. El estado
interno withdrawn no afirma retiro editorial ni recall. Los datos malformados no
producen una versión vigente; se exige publicación anterior o igual a la consulta.

## Validación

Suite web completa, compilación de producción, contratos, navegación real
Next/BFF con API explícitamente sintética y control de secretos. El navegador
incluye los flujos del release anterior, tres idiomas, publicación 2/lectura
antigua, documento eliminado en versión 3, estados negativos y 12 vistas
1440/390 claro/oscuro. Las capturas y axe comprueban las superficies cambiadas;
no constituyen una certificación de accesibilidad del sitio completo.

La API se prueba por separado con PostgreSQL real aislado y 38 escenarios.
Producción todavía no tiene heads editoriales: evento 715 corresponde a lote
activo y legacy. No se han creado publicaciones de negocio para llenar la demo.
La consulta exacta SQL productiva no equivale a validar un snapshot HTTP firmado
ni una nueva lectura física. Los secretos locales productivos están redactados.

Referencia de diseño: [GS1 Digital Signatures](https://ref.gs1.org/guidelines/digital-signatures/)
distingue información del portador e información obtenida online, que también
puede desactualizarse. Aplicamos la separación como criterio de presentación;
no se afirma certificación o cumplimiento GS1 de NexID.

## Publicación y continuación

Publicar primero la API compatible desde su árbol; luego esta web. Dashboard
conserva `2026.09.21-dashboard.30`. Sin cambios de claves, NFC, TT, migraciones,
despacho de mensajes ni acciones de negocio automáticas.
Reversa web: `dpl_DiHkpj5eFdi3SYHpdhnzuLwMbGoj`.
Pendiente registrar SHAs, CI, despliegues y comprobaciones remotas finales.

S8 sigue teniendo trabajo: primera publicación de negocio revisada con contenido
real; fuentes/versiones para mantenimiento y sostenibilidad donde corresponda;
captura separada de versión editorial observada en futuras lecturas, sin inventar
ese dato para el pasado. S9 conserva la convergencia del reporte de problemas
con su persistencia por empresa/lote/evento y los requisitos de garantía/soporte.
