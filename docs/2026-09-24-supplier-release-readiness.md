# NexID — observación de esquema y conciliación previa a publicación

Fecha: 2026-09-24. Base: `c8b25d55e26fef19d53bf9b38db9f56be30b4113`. Rama: `codex/nexid-release-readiness-20260924`.

## Resultado concreto

Se agregó un inspector reproducible del esquema de proveedor. Usa la sesión existente de Neon CLI para tres GET explícitos: identidad de rama, esquema JSON y esquema SQL. No obtiene contraseñas de base de datos, no solicita secretos de Vercel, no ejecuta el SQL obtenido y no consulta filas de clientes. No contiene un paso de promoción ni migración.

La primera conexión Neon del chat sigue fallando por configuración de project_id; el conector Vercel devolvió 403. Se verificó la metadata mediante las CLI ya autenticadas, sin cambiar conexiones/permisos. La lectura del esquema se realizó mediante la API de control de Neon, no recuperando DATABASE_URL de Vercel. Las credenciales de base de datos y la vinculación efectiva de esa variable al despliegue siguen sin verificarse.

## Hallazgo en la rama principal de NexID seleccionada

Observación iniciada: 2026-09-24T23:30:02.722Z. Identidad de proyecto/rama verificada en el control de Neon; los IDs se conservan en el informe local, no en este commit. No debe confundirse esa identidad de rama con una comprobación de la conexión que usa una función Vercel en ejecución.

| Bloque | Estructura observada | Comparación con el candidato |
| --- | --- | --- |
| Asignaciones de técnicos | Tablas/columnas requeridas y funciones presentes | Cuerpos de las dos funciones observadas coinciden |
| Cancelación comercial | Faltan las tres columnas de cancelación y su función | No compatible con el bloque nuevo |
| Cotizaciones | Faltan tabla y funciones requeridas | No compatible con el bloque nuevo |
| Proveedor vinculado | Faltan tabla y funciones requeridas | No compatible con el bloque nuevo |
| Acuse documental | Faltan tabla y funciones requeridas | No compatible con el bloque nuevo |
| Compatibilidad de tickets | Tablas/funciones presentes; status es text | Las tres definiciones difieren del candidato 0121 |

**Esto corrige una incertidumbre del corte anterior:** ya hay estructura de asignaciones. No corresponde repetir 0115/0116 sólo porque el panel productivo todavía muestre .41. La existencia del esquema no demuestra que esas migraciones estén registradas en el ledger ni autoriza reejecutarlas. Es necesario conciliar primero ese registro.

La diferencia de funciones de tickets tampoco demuestra por sí sola un fallo productivo: el esquema observado usa text, mientras el candidato 0121 también atiende instalaciones enum. Se conserva como diferencia a revisar, no como incidente inventado.

## Despliegues contrastados por separado

Se consultó el alias canónico, su despliegue Vercel y release.json, sin leer variables secretas.

| Superficie | Release canónica | Commit servido |
| --- | --- | --- |
| api.nexid.lat | 2026.09.23-api-supplier-requests.2 | fca60584bbbcc8ab18e1f06e578f0286723204ef |
| app.nexid.lat | 2026.09.23-dashboard.41 | 71b3248dcd3d6d40d8eb6668c30ee5442b64195b |

Estos datos no prueban qué rama de Neon utiliza DATABASE_URL. El informe marca esa relación como no verificada y no permite dar por terminada la preparación productiva.

## Protección y límites del inspector

El lexer interpreta el dump como datos: ignora CREATE/AS ficticios dentro de comentarios, cadenas, parámetros y cuerpos dollar-quoted. Compara huellas del cuerpo de las funciones con las definiciones de las migraciones locales 0112–0121, sin ejecutar ninguna de ellas. No sustituye un parser SQL completo ni una comparación de firmas, atributos de seguridad, constraints y tipos.

Se rechazan objetivos ambiguos, parámetros adicionales, rutas manipuladas, exports inconsistentes, columnas/tablas duplicadas y sobrecargas ambiguas de las funciones requeridas. Respuestas limitadas a 8 MiB con UTF-8 estricto; cada CLI a 60 segundos y colección a 120. Una observación de más de una hora o con fecha futura no se presenta como vigente. Los exports JSON/SQL se obtienen secuencialmente y no se anuncian como snapshot transaccional.

El proceso CLI se ejecuta sin shell, con rutas GET fijas y argumentos validados. Stderr sólo se cuenta para el límite y no se devuelve. El informe proyecta únicamente identificadores/estados/huellas permitidos, no cuerpos SQL ni metadata arbitraria. La salida exige una ruta nueva; no sobrescribe informes. El código 2 indica observación sin autorización de publicar, aun cuando todos los objetos nombrados existan; 1 indica error de recolección/validación.

Uso: `npm run check:supplier:schema --workspace=api -- --project <ID> --branch <br-ID> --database <DB> --cli-module <ruta-absoluta-a-neonctl/bin/cli.js> --output <informe-nuevo.json>`.

## Validación y alcance de este incremento

33 pruebas nuevas aprobadas: lexer, declaraciones engañosas, fuente/tiempo, aislamiento de reporte, identidad, límites, colección GET y protección de archivos. Incluidas en las 503 pruebas focales API y las 95 pruebas de seguridad del harness, todas aprobadas. Build API completo aprobado. El inspector final se ejecutó contra la rama seleccionada y produjo el diagnóstico anterior.

No se cambiaron rutas ni código de negocio en apps/api/src, migraciones, permisos de roles, datos, flags, release.json ni dependencias. Se conserva la implementación anterior de runtime restringido. CI se habilitó para esta rama usando el control existente; se debe verificar el SHA remoto, no inferir aprobación a partir de la configuración.

Evidencia sanitizada: `docs/releases/2026-09-24-supplier-schema-observation.json`. No se versionan los exports brutos ni IDs de la infraestructura observada.

## Orden de cierre antes de producción

1. Confirmar la vinculación del despliegue y su usuario SQL con la rama prevista, mediante una verificación de lectura autorizada.
2. Conciliar el ledger y el esquema: no repetir 0115/0116 por suposición; determinar qué parte de 0117–0121 falta realmente.
3. Validar el delta y las ACL efectivas sobre una copia aislada autorizada. No conceder dueño ni ejecutar grants amplios para ocultar fallos.
4. Aplicar únicamente el delta autorizado mediante el runner con registro y comprobaciones. Publicar API/BFF/panel compatibles con escrituras nuevas desactivadas hasta aceptación.

La integración anterior sigue aprobada; este incremento no anuncia una release productiva nueva ni convierte un acuse manual en recepción autenticada del proveedor. La autorización específica para cambios productivos sigue siendo una puerta independiente.
