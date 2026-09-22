# S8b: publicación editorial vigente separada de la lectura

Candidato API `2026.09.21-api-current-editorial.1`, sobre código productivo
`1aef6c3827459bb2ddbc2b4907ffc6dda239b30a` y su documentación `07fffb05`.
Web asociada: `2026.09.21-web-current-editorial.1`, protocolo aditivo
`nexid.current-editorial.v1`. Compatible con la web anterior.

## Comportamiento

`src/lib/current-passport-editorial.ts` resuelve una publicación por el evento
persistido y su empresa/lote exactos. No resuelve por BID ni lee borradores.
Comprueba versión, digest del documento público, cantidad de publicaciones,
última revisión publicada y coherencia con los campos públicos de configuración.
Republicar el mismo contenido conserva la versión y fecha de esa publicación.
No se devuelven IDs internos de empresa/lote, actores, configuración NFC ni claves.

Estados: published, unpublished (Studio sin publicar, incluida su versión cero),
legacy (sin gestión editorial), withdrawn (estado del lote impide consultar),
invalid (integridad/scope no verificables) y unavailable (fuente no disponible).
Withdrawn no prueba retirada editorial ni recall. Los estados sin publicación no
incluyen documento, versión ni enlaces heredados.

La proyección se añade al leer snapshots autorizados, tanto históricos como
con permiso reciente; las respuestas JSON SUN/QR la consultan tras persistir
su evento. No se guarda como evidencia física en el diagnóstico. Los redirects
SUN normales obtienen la proyección al consultar el snapshot. La plantilla HTML
alternativa del API no incorpora una nueva tarjeta en este incremento.

No cambia TT, resultado, ubicación, autenticación, duración de capacidades,
consumo por acción, avisos de retiro, migraciones ni dashboard.

## Validación y límites

Suite focal API, build completo y regresiones SUN/editorial. CI dedicada incluye
PostgreSQL aislado con 38 escenarios y rollback: dos tenants con mismo BID,
versión 2 con borrador posterior, republicación con digest/fecha repetidos,
documentos agro, cambios de configuración, fuente ausente y estados de lote.
Los datos son sintéticos y no se publican en la base productiva.

Consulta de sólo lectura al Neon productivo el 22/09/2026: cero heads editoriales;
evento 715 de lote activo sin gestión editorial. El SQL exacto del candidato y su
proyección devolvieron legacy. Esto verifica el lector con datos existentes, no
el endpoint HTTP desplegado ni una nueva lectura física. El acceso firmado al
snapshot no se reproduce con los secretos redactados del entorno local.

La web debe distinguir fecha de publicación de la ficha de revisión/vigencia de
un PDF. Ninguna consulta certifica el producto físico. La versión editorial
observada durante el TAP no se inventa para registros históricos sin ese dato.

## Publicación

Publicar API desde este árbol únicamente, después CI verde sobre el SHA exacto.
Luego publicar la web desde su árbol productivo separado. Reversa API:
`dpl_FW7iYAcxgmcobW6DWqJCfsUEisxZ`. La web anterior ignora el nuevo campo.
Pendiente completar IDs, SHAs y resultados remotos al terminar la publicación.
