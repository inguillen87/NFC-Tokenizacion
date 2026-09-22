# S8b: publicación editorial vigente separada de la lectura

API publicada `2026.09.21-api-current-editorial.1`, sobre código productivo
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

Publicación verificada el 22/09/2026, 01:01 UTC (21/09 en Argentina):

- SHA ejecutado: `df6b0f14b70c5237bb94e2d31b5ec175f7ad0e26`, `gitDirty=0`.
- CI [35673529062](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35673529062):
  184 pruebas focales, build/regresiones completas, control de secretos y
  PostgreSQL real aislado. Sus dos pruebas incluyen los 38 escenarios;
  ninguna prueba PostgreSQL fue omitida.
- Despliegue `dpl_9izrWMLF7AHeHTFdyeDyjAgJnDD4`, READY; URL inmutable
  https://nexid-ro8oznvix-marcelos-projects-c26aa499.vercel.app.
- Alias https://api.nexid.lat coincide con ese despliegue. Marcador de release
  y protocolo correctos, salud 200/ok y snapshot sin acceso firmado 404/no-store.
- Directamente en Vercel: salud 200 y protección de origen 403, según diseño
  existente. La ruta pública pasa por Cloudflare. No se cambió esa protección.
- Web asociada publicada en `dpl_8oEj6dWFyfoarbU5ENxMPK3NDyAG`,
  SHA `28adbe3db5ff1d56662f8dfc777afa1f3d19cebb`.
- Nueva consulta Neon posterior: evento 715 sigue VALID_OPENED, lote activo
  sin gestión editorial, cero heads. Sin publicaciones de negocio ni escrituras
  de prueba en producción. La consulta HTTP de una publicación autorizada y la
  primera publicación real siguen fuera de esta evidencia de aceptación.

Artefactos locales ignorados: `artifacts/s8-api-ci-35673529062/`,
`artifacts/current-editorial-production-sql.json`,
`artifacts/s8-api-staged-http.json`, `artifacts/s8-api-production-http.json`.
Los commits documentales posteriores no cambian el SHA ejecutado arriba.
