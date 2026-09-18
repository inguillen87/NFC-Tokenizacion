# Expediente del lote — dashboard.8

Base de producción: 13522969352638b1c698702b2e0291b9673bbfda.
Ruta existente reorganizada: `/batches/[bid]`; entrada desde `/batches`.
Incremento de UX del expediente previsto en S3. No cierra los pendientes de
instrumentación de S1 ni la atomicidad e idempotencia de logística de S2.

## Qué cambia

Resumen, Producto, Unidades y recepción, Lecturas, Operación y calidad en un
solo expediente. Las secciones conservan sus instancias: cambiar de pestaña no
borra campos sin guardar ni vuelve a consultar el resumen del lote.
Esto no es un borrador persistido: recargar o salir sigue requiriendo guardar.
La navegación admite teclado, nombres accesibles y fragmentos conocidos.

Se preservan los formularios comunes y específicos de vino, el importador con
validación previa y confirmación, los controles de ciclo de vida y el verificador
SUN autorizado. No cambia el backend ni se amplían permisos. La vista informa
permisos faltantes en lugar de presentar acciones de edición a un viewer.

El resumen distingue conteos informados, desconocidos e inconsistentes; no
calcula pendientes si activos supera registrados. El estado activo no certifica QA.
Se muestran hasta 12 unidades con UID enmascarado, referencias logísticas
explícitas y hasta cinco registros recientes de importación. No se infiere
custodia, recorrido, inventario completo ni sensores conectados por tener metadata.
La proyección de UI descarta el SDM crudo y campos arbitrarios de manifiestos.

Las lecturas se cargan solo al solicitarlo: GET existente, máximo 20 registros,
ventana 24h/7d/30d, límite de respuesta 256 KiB y timeout HTTP de 12 segundos.
Se comprueba empresa, BID, ventana, fuente, estructura y conteos. El permiso
`events.read_sensitive` se comprueba antes de habilitar la acción y el BFF mantiene
su autorización. No hay suscripción, polling ni carga al cambiar de pestaña.

## Verificación previa

TypeScript y build Next.js aprobados. Suite dashboard: 767 pruebas, 765 aprobadas,
cero fallos y dos omitidas. Diecisiete pruebas nuevas cubren proyección, alcance,
contadores desconocidos, límites, enmascarado, navegación y lectura acotada.
El control de secretos aprobó la revisión de 2.258 archivos.

Chromium local con API sintética en loopback: cuatro combinaciones de escritorio,
móvil y tema claro/oscuro. Se verificó teclado, un panel visible, cero nuevas
consultas al alternar pestañas, edición retenida y ausencia de overflow horizontal.
La superficie del expediente evaluada no presentó incidencias axe serias/críticas;
no equivale a certificación WCAG ni prueba humana completa de accesibilidad.
Guardado probado con un solo campo modificado y confirmación; lecturas manuales,
rechazo de empresa ajena, fuente caída, muestra vacía y viewer sin lectura/edición.
Las pruebas no usaron etiquetas, credenciales ni información de clientes reales.

## Límites y publicación

No es Passport Studio con publicación/versiones editoriales ni un inventario
logístico completo. Se reutilizan las operaciones existentes sin cambios de DB.
Mapa, Modo sala, SUN móvil y Uso y estado conservan su funcionamiento y rutas.
No se agregan servicios contratados, IA automática ni recursos de pago.

Publicar un único build de dashboard con --prod --skip-domain; comprobar versión,
estado READY y alias previo antes de promover. API y web deben conservar sus IDs.
Reversa de interfaz: dpl_6z66yJsLARxy8HwUVhNcFRigV1Wt. No hay migraciones.
Después de promover: marcador público, novedades, login, protección de ruta privada
y pruebas públicas de navegador; no ejecutar importaciones de clientes reales.

Referencias de implementación consultadas: W3C APG Tabs Pattern (teclado y estados
ARIA) y documentación oficial de Next.js Link (prefetch deshabilitado en enlaces).
