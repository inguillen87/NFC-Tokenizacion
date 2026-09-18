# Recepción de fábrica — dashboard.11

Base: 604f05b911998faf742a58ddb87498f718742922.
Ruta existente /batches/supplier; nueva API requerida 2026.09.18-api-reception.1.

## Resultado

Una entrada ordenada: identidad y alcance de la sesión, empresa seleccionada,
recepción/seguimiento, roles/permisos y consola de operación existente.
Se distingue inventario activo de registros inactivos y lote histórico de pedido
industrial. Los filtros y la comparación de perfiles no modifican la sesión ni
conceden permisos. La respuesta se valida por origen, empresa, rol, conteos y límites.

El dashboard ahora refleja la autoridad del superadministrador después de validar
su sesión opaca con la API. No hay excepción por email ni elevación de cuentas de
empresa o tokens demo. El comodín efectivo del rol global sigue sujeto a denies y
restricciones por capacidad; no habilita una aprobación de plan a nombre del cliente.
Las rutas por tarea ya no requieren batches:* para abrir recepción.

La consola conserva importador, QA, aceptación de producción, actividad y sus
controles del servidor. Se fija la empresa seleccionada y se precarga el pedido
sin consultar Vault ni claves. La consulta del plan QA se solicita explícitamente.
Cambiar pestañas conserva el formulario; cambiar pedido/consulta requiere aceptar
el descarte de los campos locales. Las cantidades nuevas dejan de prellenarse
con 5000/1000. El inicio de una acción nunca certifica su resultado.

Las fichas enlazan al expediente solamente si el rol puede abrirlo. Un operador
con manifest.import no adquiere acceso a la ficha completa o a la administración.
No se crearon usuarios de prueba ni se cambiaron roles/passwords productivos.

## Verificación

TypeScript y build correctos. Suite del dashboard: 828 pruebas, 826 aprobadas,
0 fallidas y 2 omitidas. Catorce pruebas nuevas: 6 de sesión/acceso y 8 de contrato.
Navegador Next/BFF contra consulta real y PostgreSQL local: cuatro combinaciones
1440/390 px y claro/oscuro, cuatro perfiles de cliente y superadministración,
comparación sin suplantación, fuente caída, alcance ajeno rechazado, formularios
conservados y ninguna mutación de negocio. Sin overflow y sin incidencias axe
serias/críticas en la nueva superficie evaluada. No equivale a certificación WCAG.
Las sesiones son fixtures autorizados localmente; no se afirma haber realizado
login real ni importación/QA/activación con un rollo de cliente en estos casos.

Contexto de prueba física documentado en operations/physical-pilot-and-role-boundaries.md.
Marcelo ya tenía membresía global super_admin. Balmec conservaba10activas y10
inactivas históricas. No se modificaron contadores, claves, etiquetas o planes.

Reversa dashboard: dpl_99XFTVuVgZGbM2N8RMDj1NzWu6zS. Publicar API compatible
antes de promover la UI. Confirmar dominio, versión, protección privada y Free.
