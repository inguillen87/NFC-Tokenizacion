# Dashboard 2026.09.17-dashboard.4 — navegación por tareas

## Alcance

Base exacta de producción: `76af8ac57406d4154aa60868df2d39c810cf79ff`.
Proyecto Vercel existente: `nexid-dashboard`, dominio `app.nexid.lat`.
Solo cambia la interfaz del dashboard; no cambia API, web pública, base de datos,
criptografía SUN, permisos, claves, planes, proveedores ni recursos contratados.

- Navegación agrupada por trabajo, preservando los destinos ya autorizados.
- Demos y recursos comerciales en su propio grupo.
- Menú móvil modal: foco dentro, Escape, restauración del foco y del scroll.
- Sin precarga automática de los enlaces del shell; sin polling nuevo.
- Novedades públicas en `/novedades`, sin datos privados ni consultas a la API/DB.
- Acceso a novedades desde login, sidebar y menú de perfil del CRM inmersivo.
- Versión visible coherente con el marcador público `release.json`.

La portada CRM inmersiva conserva su comportamiento y no recibe una segunda
barra de navegación. Desde el perfil se accede a Configuración del workspace
(`/settings`), donde aparece la navegación por tareas. No cambia el login real.
La página pública de novedades NO es un monitor ni certificado de disponibilidad.

## Validaciones previas a publicar

TypeScript y `npm run build:dashboard` completados correctamente.
Suite dashboard: 716 pruebas, 714 aprobadas, cero fallos, dos omitidas.
Diez pruebas nuevas para navegación, permisos, versión y límites del componente.
Dos tests existentes normalizan CRLF/LF al leer su entrada; sus aserciones no
se debilitaron. Dependencias y lockfile del producto conservados.

Navegador Chrome / Playwright, local y con tráfico externo bloqueado:
seis casos de novedades (escritorio/móvil, claro/oscuro, español/inglés/portugués),
sin overflow horizontal, sin errores JS no capturados, sin violaciones axe de
impacto serio/crítico en la superficie de novedades. No equivale a certificación WCAG.
Navegación privada probada solo con fixture DEMO local explícito, sin credenciales
reales: 45 pasos Tab, foco contenido, Escape, foco devuelto, scroll restituido,
menú completamente visible y navegación a novedades. La API productiva no se
utilizó para estas pruebas; no se modificó autenticación en producción.
El harness se encuentra en `apps/dashboard/tests/task-navigation.browser.mjs`.

## Publicación y reversa

La publicación requiere commit limpio, pruebas aprobadas y build Vercel listo.
Usar despliegue production `--skip-domain` y verificar el artefacto antes de
promover al dominio existente. Releer el puntero activo antes de promover para
no sustituir cambios concurrentes sin revisión.
Referencia anterior: `dpl_ECUCqweEA2Z37GsQK9tTVEVh83au`.
No ejecutar migraciones; un rollback de interfaz no afecta la base.
Después de promover: GET `/novedades`, `/release.json`, `/login` y pruebas públicas
de navegador en `https://app.nexid.lat`. Ningún login sintético contra producción.
La evidencia final debe registrar ID, revisión y respuestas reales del despliegue.

S0.1 sigue siendo un incremento de tooling independiente. Esta entrega visible
no certifica la reconstrucción histórica de la web pública marcada gitDirty ni
completa por sí sola las pruebas combinadas de toda la plataforma.
