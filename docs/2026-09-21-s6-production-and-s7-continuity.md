# NexID: conciliacion S6 publicada y siguiente incremento S7

## Continuidad comprobada el 21/09/2026

La carpeta principal seguia en `80e4ab82`, con cambios propios sin commit. El
worktree anterior de conciliacion seguia en `14d62ca9`, tambien con cambios sin
commit. Ambos se preservaron. La fuente recuperada para publicar fue el commit
remoto `37697b45ae5de9ee157e23cd736f7bf1db47baec`; no se reinicio S6 ni se
desplegaron las versiones antiguas de API/web incluidas en su rama.

GitHub Actions ya habia resuelto los fallos que motivaron el traspaso:

- `e039d0e5`: espera de la lectura terminada antes de comprobar acciones.
- `6318ac0d`: bloqueantes de cierre visibles en el primer viewport movil.
- `c60b2339`: fecha UTC determinista, evitando diferencias de hidratacion entre
  Node y Chromium por el espacio no separable de `a. m.`.

La ejecucion [35614380035](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35614380035)
valido el candidato exacto: 967 pruebas aprobadas, cero fallidas y dos omitidas,
TypeScript, build, QA estatica, secretos, PostgreSQL 18.4 efimero y siete
recorridos de navegador con datos/sesiones sinteticos. Las cuatro superficies
1440/390 claro/oscuro reportaron cero incidencias axe en el espacio de retiros.
El navegador del workflow usa Next dev; el build de produccion es otro paso.

## Publicacion del incremento de conciliacion

- Aplicacion: dashboard, release `2026.09.21-dashboard.28`.
- Fuente: `37697b45ae5de9ee157e23cd736f7bf1db47baec`, arbol limpio.
- Deployment: `dpl_2h1T7z3Z9HYsfwkAoDLKw1W6CmpK`.
- URL inmutable: `https://nexid-dashboard-fpjk7yv2q-marcelos-projects-c26aa499.vercel.app`.
- Alias canonico confirmado despues de promover: `https://app.nexid.lat`.
- Rollback conocido: `dpl_5TuNRtFqgjytpDXGUh1vceCE9Vfi`, dashboard `.27`.
- API conservada: `a3e51ffdc324631640734b4b246f23c1ac1f5842`,
  `dpl_9drfo3eYYH76sirXbQShxbXpENrQ`, `2026.09.20-api-consumer-history.1`.
- Web conservada: `b6c054bcc59c4eb10ff01f1ff38aa2ad05c4df19`,
  `dpl_AKi4ugeindS2DL2sqUx6pcKN8qNX`, `2026.09.20-web-history.1`.

El CLI local tiene acceso al equipo existente; el conector de ChatGPT sigue
devolviendo 403. No fue necesario cambiar permisos del equipo ni del proyecto.
Para el navegador del deployment protegido se uso el acceso de automatizacion
ya configurado. El token OIDC de desarrollo no admite ese target production.

Se repitieron localmente TypeScript y las 967 pruebas del dashboard. QA estatica
y el control de secretos aprobaron. `vercel build` fallo en Windows con
`spawn cmd.exe ENOENT`; el build directo de Next con el entorno productivo
descargado aprobo, y Vercel construyo nuevamente la misma fuente limpia. No se
desplego una salida local de Windows fingiendo que era un prebuilt de Linux.

Antes de promover se comprobaron release.json, notas en escritorio/movil,
ausencia de overflow a 390 px, login, redireccion de ruta privada y rechazo 401
de la sesion anonima. Se revisaron las capturas de conciliacion conservadas del
CI. El dominio canonico devolvio `.28` despues de promover. El escaneo inicial
de errores de runtime del deployment no devolvio errores.

La prueba de navegador posterior en `app.nexid.lat` aprobo las seis combinaciones
de notas publicas (1440/390, claro/oscuro, ES/EN/PT), sin errores JavaScript,
overflow horizontal ni incidencias axe. Evidencia local:
`artifacts/s6-production-browser/report.json`. No ejecuto el recorrido privado
de conciliacion con una cuenta real ni una lectura NFC fisica.

Advertencia operativa comprobada: `--skip-domain` dejo el alias canonico
`app.nexid.lat` en `.27`, pero el alias generado `nexid-dashboard-<team>.vercel.app`
ya resolvia al candidato `.28`. El control previo a promocion debe consultar
`/v4/aliases/app.nexid.lat` y `targets.production`; el alias generado no prueba
que el dominio canonico haya cambiado ni que exista trabajo concurrente.

El manifiesto `.28.candidate.json` se conserva como evidencia historica de la
preparacion. Este registro posterior documenta la publicacion; no se modifica
retroactivamente la evidencia del candidato.

## S7a: coherencia del origen en el centro en vivo

El lector durable del API admite `source=real`. La proyeccion de tiempo real
del dashboard admitia tambien `eventSource=imported` y `production`, y convertia
ambos en filas `source=real` / `physical_real`. Eso podia agregar filas y aumentar
contadores que la consulta durable habia excluido.

El incremento exige `eventSource=real` tanto en snapshots como en deltas; conserva
`source=production` como categoria del transporte. Importaciones, origen ausente
o ambiguo y tenant ajeno quedan fuera. Una importacion tampoco puede actualizar
la ubicacion de una lectura real ya confirmada. Se mantienen visibles lecturas
reales invalidas y sospechas de replay, sin inventar evidencia TT ni convertir
la procedencia declarada en certificacion de presencia fisica.

Las nuevas pruebas reprodujeron dos fallos antes de corregir el codigo.
Validacion focal posterior: 50/50, incluyendo seis comprobaciones de navegador
local con claro/oscuro, filtros y conservacion de evidencia; TypeScript correcto.
La suite completa posterior aprueba 971 pruebas, cero fallidas y dos omitidas;
el browser fisico opcional omitido en esa suite se ejecuto separadamente y paso.
Build de produccion, QA estatica y gate de secretos tambien aprobaron. Se
corrigio ademas el enlace "Abrir lotes" de las novedades, que llevaba por error
a la bandeja editorial: ahora abre `/batches`.

## Pendientes reales y orden de continuacion

1. S6: aceptacion autenticada del flujo con una cuenta de empresa y evidencia del
   piloto real. CI sintetico, despliegue y login no equivalen a esa aceptacion.
2. S7: unificar la clasificacion operacional/legacy del API con CRM; conciliar
   analytics con la observacion aproximada consentida post-TAP; validar un TAP
   fisico nuevo hasta tenant, producto, pasaporte, evento y consumidores.
3. S8/S9: continuar sobre el DPP, Studio e historial del consumidor existentes;
   revisar documentos, garantia, ownership e incidentes con contratos reales.
4. S10-S16: CRM/engagement, centro en vivo, respuesta a incidentes, RBAC,
   observabilidad y release reproducible, sin repetir modulos ya entregados.

Se sigue el orden del traspaso del usuario; algunos documentos anteriores usan
S7 para campanas. Esa etiqueta no autoriza envios ni sustituye la prioridad
actual TAP real a tenant. No se enviaron mensajes ni se ejecutaron campanas.

No hubo migraciones ni escrituras de datos productivos. No se modificaron
claves, contadores, TTStatus ni la configuracion del lote `DEMO-2026-02`.
Tampoco se certifica su configuracion actual mediante una consulta nueva de DB.
