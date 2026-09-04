# Recuperación auditada de credenciales tenant admin

## Incidente cubierto

La cuenta `admin+demobodega@nexid.local` de `demobodega` existe, pero su
`password_credentials.password_hash` conserva el formato SHA-256 legado de 64
hexadecimales y no cumple el contrato actual de login
(`scrypt$<salt>$<digest>`). El login debe seguir rechazando ese hash legado; no
se habilita compatibilidad SHA, contraseña demo ni fallback productivo.

Esta herramienta rota o provisiona una sola cuenta `tenant_admin`, dentro de
un solo tenant, en una transacción auditable. La ejecución por defecto es un
dry-run completo que termina en `ROLLBACK`. `--apply` exige una confirmación
literal ligada a operación, tenant, email y referencia de cambio.

## Gate de habilitación productiva

La presencia de este runbook o de variables de ejecución `TENANT_ADMIN_*` no
demuestra que la cuenta sea utilizable: esas variables no reemplazan el hash
persistido y no deben usarse como sustituto de la rotación. Hasta reunir toda la
evidencia siguiente, el acceso real de Bodega Balmec se considera bloqueado:

1. El dry-run confirma el tenant, la cuenta y el estado previo esperado sin
   discrepancias.
2. La aplicación autorizada termina con `"mode":"apply"` y
   `"committed":true`, y deja ambos eventos de auditoría.
3. Un login nuevo devuelve una sesión `tenant_admin` opaca cuya resolución en
   `/auth/session` contiene el UUID tenant y `tenantSlug=demobodega`; no una
   sesión `demo.*`.
4. El overview del tenant declara `stats_source=real` y excluye eventos
   `source=demo` de scans, duplicados, tamper y riesgo.

En Producción, mantener `DASHBOARD_BODEGA_DEMO_ACCESS=false` o sin habilitación
explícita mientras se valida el acceso real. Habilitar la demo es una decisión
separada y nunca evidencia que la credencial productiva fue recuperada.

## Precondiciones operativas

1. Abrir un ticket o incidente aprobado y elegir una referencia estable, por
   ejemplo `INC-2026-0903`.
2. Confirmar un punto de restauración reciente de la base objetivo.
3. Obtener del inventario de Producción la URL **directa/unpooled**, hostname,
   database, rol y endpoint exactos. No reutilizar `DATABASE_URL` de la app.
4. Iniciar sesión como un usuario humano activo cuya única membresía sea
   `super_admin` global. La herramienta verifica en base el ID y secreto de esa
   sesión, además del email, antes de atribuirle la operación.
5. Generar y custodiar la nueva contraseña en el gestor corporativo. No pasarla
   como argumento, no pegarla en el ticket y no registrar la salida del entorno.

## Variables efímeras

En una terminal operativa autorizada, establecer únicamente para esa sesión:

```powershell
function Set-ProcessSecretFromPrompt([string]$Name, [string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    [Environment]::SetEnvironmentVariable(
      $Name,
      [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer),
      'Process'
    )
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

Set-ProcessSecretFromPrompt 'NEXID_TENANT_ADMIN_DATABASE_URL' 'URL directa/unpooled (oculta)'
Set-ProcessSecretFromPrompt 'NEXID_CREDENTIAL_OPERATOR_SESSION_TOKEN' 'Sesion superadmin activa id.secreto (oculta)'
Set-ProcessSecretFromPrompt 'NEXID_TENANT_ADMIN_PASSWORD' 'Nueva password tenant admin (oculta)'

$env:NEXID_TENANT_ADMIN_EXPECTED_HOST = '<hostname-exacto>'
$env:NEXID_TENANT_ADMIN_EXPECTED_DATABASE = '<database-exacta>'
$env:NEXID_TENANT_ADMIN_EXPECTED_DB_ROLE = '<rol-exacto>'
$env:NEXID_TENANT_ADMIN_EXPECTED_ENDPOINT_ID = '<endpoint-neon-exacto>'
$env:NEXID_CREDENTIAL_OPERATOR_EMAIL = '<email-super-admin-existente>'
```

No pegar URL, bearer ni contraseña como asignaciones literales en una consola
con historial habilitado.

La URL exige exactamente un `sslmode=require|verify-full` y exactamente un
`channel_binding=require`; rechaza parámetros duplicados o desconocidos. En
Neon se rechaza cualquier host `-pooler` para que
la comprobación de endpoint corresponda a la conexión real.

## 1. Dry-run obligatorio para Bodega Balmec

Desde la raíz del repositorio:

```powershell
npm.cmd run tenant-admin:credentials -- --operation=rotate --tenant=demobodega --email=admin+demobodega@nexid.local --expected-current=legacy-sha256 --change-ref=INC-2026-0903
```

Aceptar solo un resultado JSON con `"ok":true`, `"mode":"dry_run"`,
`"previousCredentialState":"legacy-sha256"`, tenant/email/base/rol/endpoint esperados
y conteos plausibles de sesiones y tokens. Cualquier discrepancia bloquea la
rotación; no cambiar `--expected-current` para forzarla.

## 2. Aplicación con confirmación literal

```powershell
$env:NEXID_TENANT_ADMIN_CONFIRMATION = 'APPLY TENANT_ADMIN ROTATE demobodega admin+demobodega@nexid.local EXPECT legacy-sha256 INC-2026-0903'
npm.cmd run tenant-admin:credentials -- --operation=rotate --tenant=demobodega --email=admin+demobodega@nexid.local --expected-current=legacy-sha256 --change-ref=INC-2026-0903 --apply
```

El resultado correcto debe indicar `"mode":"apply"` y `"committed":true`.
La misma transacción cambia el hash a scrypt, revoca todas las sesiones,
consume tokens de recuperación pendientes y agrega eventos a
`user_auth_events` y `audit_logs`. No se audita la contraseña ni su hash.

## 3. Verificación y cierre

1. Iniciar sesión con el email completo
   `admin+demobodega@nexid.local` y la nueva contraseña.
2. Verificar que la sesión emitida tenga rol `tenant_admin` y tenant
   `demobodega`, sin autoridad global ni de otro tenant.
3. Confirmar que una sesión anterior quedó revocada.
4. Confirmar ambos registros de auditoría con acción
   `tenant_admin.credential_rotated` y `request_id = INC-2026-0903`.
5. Adjuntar al ticket solo el resultado no secreto y la evidencia de login/RBAC.
6. Cerrar/revocar la sesión superadmin usada para autorizar la operación.
7. Eliminar las variables efímeras:

```powershell
Remove-Item Env:NEXID_TENANT_ADMIN_DATABASE_URL,Env:NEXID_TENANT_ADMIN_EXPECTED_HOST,Env:NEXID_TENANT_ADMIN_EXPECTED_DATABASE,Env:NEXID_TENANT_ADMIN_EXPECTED_DB_ROLE,Env:NEXID_TENANT_ADMIN_EXPECTED_ENDPOINT_ID,Env:NEXID_CREDENTIAL_OPERATOR_EMAIL,Env:NEXID_CREDENTIAL_OPERATOR_SESSION_TOKEN,Env:NEXID_TENANT_ADMIN_PASSWORD,Env:NEXID_TENANT_ADMIN_CONFIRMATION -ErrorAction SilentlyContinue
```

## Fallo o rollback

La herramienta hace `ROLLBACK` ante scope ambiguo, cuenta inactiva, esquema
incompleto, tenant inactivo, estado de hash inesperado, factor MFA legado, concurrencia o fallo
de auditoría. Si el
commit fue correcto pero la validación posterior falla, conservar la evidencia
y ejecutar otra rotación auditada; nunca restaurar el hash legado ni reactivar
credenciales determinísticas con `demo:seed`.

Para una cuenta nueva se usa `--operation=provision`,
`--expected-current=missing` y `--full-name=<nombre>`. El provisionamiento
también falla si ya existe cualquier usuario con ese email.
