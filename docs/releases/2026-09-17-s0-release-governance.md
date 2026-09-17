# S0.1 — Inventario reproducible y controles de release

Fecha: 2026-09-17. Repositorio: `inguillen87/NFC-Tokenizacion`.
Rama de trabajo: `codex/nexid-s0-release-governance-2026-09-17`.
Base: `7b6a9889fa73b5a668f11f503a108cd72b89b7fc` (main remoto observado).

## Alcance entregado

Este incremento implementa herramientas ejecutables, no solo un documento:

- `scripts/nexid-release.mjs`: inventario, validacion, comparacion y preflight.
- `scripts/lib/release-manifest.mjs`: contrato de inventario, integridad y bloqueos.
- `scripts/lib/release-git.mjs`: huellas calculadas desde objetos Git inmutables.
- `scripts/tests/release-governance.test.mjs`: pruebas locales sinteticas.
- `observed-2026-09-17.s0.json`: inventario productivo obtenido por consultas GET.
- El workflow de seguridad existente ejecuta las pruebas nuevas, sin un workflow
  adicional, sin instalar dependencias para este control y sin auto-deploy.

No cambia aplicaciones, base de datos, claves, etiquetas NFC, dominios, planes,
recursos de pago, politica de permisos ni worktrees de otros agentes.

## Comandos

Desde la raiz del repositorio; en Windows usar `npm.cmd`.

```powershell
npm.cmd run build:release
npm.cmd run test:release
npm.cmd run release:collect -- --scope marcelos-projects-c26aa499 --repo . --out RUTA_NUEVA.json
npm.cmd run release:check -- --manifest RUTA_NUEVA.json --verify-source --repo .
npm.cmd run release:check -- --manifest RUTA_NUEVA.json --strict
npm.cmd run release:diff -- --before ANTERIOR.json --after NUEVA.json
npm.cmd run release:preflight -- --app api --expected-sha SHA_COMPLETO --repo .
```

`collect` necesita Git local y la sesion Vercel CLI autorizada. Hace nueve GET:
tres proyectos, tres deployments y una nueva comprobacion de los tres punteros.
No usa endpoints de secretos/env, no consulta PostgreSQL y no ejecuta builds,
TAPs, migraciones, pagos, promociones, rollbacks ni cambios de configuracion.
No persiste las respuestas crudas del proveedor: aplica una proyeccion cerrada.
Las salidas se crean exclusivamente con `wx`: no sobreescribe evidencia previa.
Si cambia un deployment mientras se observa el conjunto, la coleccion falla.
No equivale a un bloqueo atomico del proveedor contra cambios posteriores.

`check` sin `--strict` distingue un inventario valido de una release certificada.
`--verify-source` recalcula las huellas desde el commit exacto, no desde HEAD.
`--strict` devuelve codigo 2 para la release historica no certificada.
`preflight` exige HEAD exacto y worktree sin cambios versionados o no rastreados;
verifica ademas que el auto-deploy por Git siga deshabilitado. No altera archivos.
Los archivos ignorados y las variables de build NO quedan atestados por ese
preflight: su procedencia debe incorporarse al artefacto firmado de build.

Codigos: 0 = comprobacion solicitada correcta; 1 = entrada/error operativo;
2 = preflight o certificacion bloqueados. Un 0 de inventario no autoriza deploy.

## Evidencia y semantica

El manifiesto incluye deployment ID, proyecto, revision, estado de gitDirty,
huella del arbol completo, arbol de la app, arbol de paquetes compartidos,
SHA-256 del lockfile, contratos OpenAPI/AsyncAPI y migraciones requeridas.
Las migraciones se extraen de db.ts y del marcador release.json del commit API;
se registran sus hashes. No se afirma que esten aplicadas en una base real.
SHA-256 detecta alteraciones de contenido, pero NO es firma, autenticacion del
emisor, prueba de compatibilidad ni hash del artefacto publicado en Vercel.
El deployment ID identifica el artefacto del proveedor; su SHA-256 queda null
hasta obtener una atestacion valida de los bytes exactos del build.

La ausencia de `gitDirty` se representa como `unknown`; no como clean.
`gitDirty=0` se registra como informacion declarada por el proveedor, no prueba
independiente del origen de todos los inputs del build.
Se admiten SHAs independientes por app. Diferencias en paquetes compartidos o
lockfile exigen revision: ni su diferencia implica necesariamente rotura, ni su
igualdad demuestra compatibilidad. No se inventa una version unica del producto.

## Resultado real del primer inventario

- API: 29c4f6231bb6f4a47756905d9c533b02bce50c4d; gitDirty no informado.
- Web: 869ecdf00c05979d8d101f6a3ad1c400668cf0c0; gitDirty=1.
- Dashboard: 76af8ac57406d4154aa60868df2d39c810cf79ff; gitDirty no informado.
- Las huellas de esos commits se verificaron desde objetos Git locales.
- El inventario es valido y su evaluacion de certificacion permanece bloqueada.
- No se reconstruyo, reemplazo ni publico el deployment web historico sucio.

Los IDs guardados son referencias del conjunto que estaba sirviendo al observar.
NO son un rollback ensayado, ni garantizan que el proveedor conserve los builds.
Una reversa de aplicaciones tampoco revierte una migracion de base de datos.

## Pruebas ejecutadas en esta entrega

- 33 pruebas nuevas en Linux / Node 22.16.0: 33 correctas, cero fallos/omisiones.
- 33 pruebas nuevas en Windows / Node 24.15.0: 33 correctas, cero fallos/omisiones.
- 8 regresiones existentes de workflow y auto-deploy: 8 correctas.
- `build:release`: validacion sintactica Node de las herramientas, correcta.
- Inventario real de produccion y recomputacion de huellas: correctos.
- Gate estricto del inventario historico: rechazo esperado, codigo 2.
- Politica de secretos: 2.077 archivos revisados; control aprobado.
- Plan Neon verificado nuevamente: Free (free_v3), sin cambios.
- La huella de las 48 migraciones requeridas se registro sin consultar la DB.

Estos resultados pertenecen a las herramientas S0.1. No son un build completo
Next.js ni pruebas funcionales de las tres aplicaciones publicadas.

## Integracion y siguiente entrega S0.2

Este commit agrega exclusivamente tooling/documentacion y un paso del workflow
existente. No mergear automaticamente main ni cherry-pickear cambios de otros
worktrees. Integrar por revision una vez coordinado el responsable de releases.
El preflight es un comando explicito; NO intercepta una llamada directa a Vercel
ni cambia reglas de proteccion remotas. El paso CI verifica el tooling, no da
por certificada esta combinacion de aplicaciones.

Para cerrar S0 completo falta:
1. Recuperar y reconciliar los inputs exactos de la web desplegada con gitDirty=1.
2. Producir artefactos desde revisiones limpias, con atestacion de build vinculada
   a revision, lockfile, configuracion no secreta y huella del artefacto.
3. Reusar las pruebas API/SDK y probar la combinacion API/web/dashboard en un
   entorno local/efimero, sin duplicar bases pagas ni consumir Neon productivo.
4. Adjuntar evidencia de migraciones y ensayo de rollback del conjunto; la base
   y las aplicaciones tienen procedimientos de recuperacion diferentes.
5. Coordinar e integrar el gate en el unico camino de promocion autorizado.

No habilitar recursos pagos para completar estos pasos. Una carencia de evidencia
se registra como pendiente; nunca se rellena con datos supuestos ni un booleano.

Referencias operativas oficiales consultadas:
- https://vercel.com/docs/deployments/promoting-a-deployment
- https://vercel.com/docs/instant-rollback
