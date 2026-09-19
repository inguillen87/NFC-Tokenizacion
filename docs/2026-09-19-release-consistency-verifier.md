# Verificación coordinada de publicaciones: API, pasaporte y dashboard

## Estado de esta entrega

Implementación aislada de operación, no una nueva publicación del producto.
Base de trabajo: `1e36831202387a73d8b8bf7c59eaf9930bb05bad`, rama
`codex/nexid-notice-review-api-20260918`. No usar el `main` antiguo como
sustituto de las tres revisiones productivas.

Verificado en esta entrega con Node **22.16.0**: **114 pruebas aprobadas,
0 fallidas, 0 omitidas**, sintaxis de ambos módulos y comprobación JS de la
biblioteca con TypeScript. No se ejecutó el build completo de NexID ni pruebas
con PostgreSQL, sesión autenticada, navegador o TAP físico.

El conector de Vercel devolvió **403** para el equipo de NexID y el dispositivo
Marcelo apareció desconectado. No se buscaron credenciales alternativas ni se
intentó sortear ese permiso. No se verificó nuevamente la combinación productiva
ni se promovió ningún deployment. El acuse móvil tiene trabajo local previo que
no se pudo recuperar: esta entrega no lo reemplaza ni lo declara integrado.

## Qué comprueba

Un manifiesto debe contener exactamente `api`, `web` y `dashboard`, con sus
dominios fijos de NexID, proyecto, deployment inmutable y SHA Git completo.
Cada componente necesita un proyecto y deployment distintos; todos se consultan
bajo el `teamId` explícito. No se infieren IDs de proyecto a partir de nombres.

La secuencia es:

1. Leer los tres alias desde Vercel y fijar su identidad y revisión observada.
2. Leer los tres deployments: ID, proyecto, estado `READY`, SHA y `gitDirty=0`.
3. Leer exclusivamente `https://api.nexid.lat/health` sin token de Vercel.
4. Releer los tres alias y comparar deployment, proyecto, UID y `updatedAt`.

Los campos Git disponibles (`gitSource.sha`, `meta.githubCommitSha`,
`meta.gitCommitSha`) deben coincidir todos con el SHA esperado. Un campo
contradictorio no se tapa con otro que coincida. Una respuesta pública reducida
sin identidad suficiente tampoco pasa. `gitDirty=0` es una declaración del
publicador, no una atestación criptográfica de compilación.

No se admite un alias redirigido, borrado, de otro proyecto ni una configuración
de microfrontends. La revisión `updatedAt` es opcional en la API de Vercel, pero
este verificador exige que esté disponible; si no existe, informa bloqueo en vez
de inventar evidencia de estabilidad. No se usa `target` ni la lista histórica
de alias del deployment como sustituto del alias consultado.

El endpoint `/health` acredita solamente **vida del proceso**, con una fecha a
menos de 60 segundos del reloj del verificador. No acredita base de datos,
permisos, compatibilidad entre contratos, UI, saldo, autenticidad NFC ni la
finalización de un piloto.

## Límites y seguridad

Todas las peticiones son GET. Solo se permiten dos familias de consulta en
`https://api.vercel.com` y el endpoint de salud fijo de NexID. No hay comandos de
promoción, rollback, migración, envío de mensajes ni cambios de negocio.

No se siguen redirecciones ni se envía el token a la aplicación pública. Cada
consulta tiene un límite de 8 segundos y 512 KiB de JSON UTF-8, incluidos los
bytes recibidos por streaming. No hay reintentos; 401/403 detienen las consultas
restantes. La observación completa debe terminar dentro de 120 segundos.
Los cuerpos del proveedor, excepciones de red, información de usuarios y
configuraciones de bypass no se incluyen en el informe.

La doble lectura **no es una transacción ni un bloqueo del publicador**. Permite
detectar cambios observables, pero no garantiza atomicidad ni impide cambios
posteriores. Un informe viejo no debe autorizar una promoción. Este programa
verifica una combinación ya asignada a los dominios; no decide por sí solo si
una release puede publicarse. Los checks de migraciones, contratos, seguridad,
E2E y aceptación funcional siguen siendo necesarios.

## Ejecución

Desde la raíz del repositorio, sin instalar dependencias:

```sh
node --test scripts/tests/release-consistency.test.mjs
node scripts/verify-release-consistency.mjs --manifest /ruta/manifiesto.json --validate-only
node scripts/verify-release-consistency.mjs --manifest /ruta/manifiesto.json --out /ruta/informe-nuevo.json
```

La última orden requiere `VERCEL_TOKEN` ya provisionado en el entorno autorizado.
No poner ese token en el manifiesto, en parámetros de la consola, en el repositorio
ni en el chat. La validación de manifiesto es offline y usa
`evidenceSource=configuration_only`; nunca declara producción verificada.

Esquema del manifiesto: objeto con `protocol` (`nexid.release-consistency.v1`),
`releaseId`, `teamId` y `components`. Cada componente tiene exactamente `name`,
`domain`, `projectId`, `deploymentId` y `gitSha`. Las pruebas contienen ejemplos
sintéticos explícitos; **no son configuración productiva**.

La combinación histórica del 18 de septiembre está en
`docs/2026-09-18-notice-review-production-closure.md`. No se entrega un manifiesto
productivo con IDs de proyecto inventados. Con el acceso restablecido, obtener
los IDs reales y contrastar alias y revisiones actuales antes de construirlo.
No asumir que los alias todavía apuntan a la combinación histórica.

Salida JSON con SHA-256 del manifiesto normalizado, intervalo de observación,
componentes esperados y checks individuales. El informe es evidencia operativa
sin firma, no una certificación. `--out` crea un archivo nuevo con modo 0600;
no sobrescribe informes existentes.

Códigos de salida: `0` para consistencia observada o manifiesto válido en el modo
explícito de validación; `1` para inconsistencia; `2` para bloqueo de acceso,
configuración, transporte o escritura del informe. Siempre comprobar el código
y el modo; `manifest_valid` no equivale a `consistent`.

## Pendientes para integración

No se modifican workflows ni protecciones de ramas en esta entrega. El script
no es un check obligatorio de CI hasta que se lo integre explícitamente al
procedimiento de publicación. Primero hacen falta un manifiesto real aprobado,
una ejecución autorizada contra Vercel y revisar su contrato con la respuesta
real del proveedor. La publicación funcional del acuse móvil y sus pruebas
propias continúan pendientes por separado.

Sin modificaciones a Neon, planes, claves, contadores, TTStatus, productos,
etiquetas, SDK, UI, usuarios ni campañas. Tampoco se modifica la función de salud.

## Referencias del contrato del proveedor

- Vercel: https://vercel.com/docs/rest-api/aliases/get-an-alias
- Vercel: https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url

El esquema remoto puede evolucionar; un campo requerido ausente bloquea el
resultado hasta revisarlo, en lugar de degradar silenciosamente la validación.
