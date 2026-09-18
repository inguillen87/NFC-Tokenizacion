# Logística operativa — dashboard.9

Base: 4428c0e8493e99b02c0d0590b19096ee709d84d8. Ruta existente `/logistics`.
API requerida: 2026.09.18-api-logistics.1, protocolo nexid.logistics.v1.

## Cambios de UX

Listado, filtros y operaciones separados sin desmontar los formularios al alternar.
Se reemplaza el resultado JSON por un comprobante entendible y un enlace al envío.
Crear, aplicar, traspasar y verificar exigen confirmación y permiso logistics:write.
No se presupone un precinto cerrado: el campo inicia sin evidencia y la declaración
lo conserva. La vista distingue estado del envío, estado del precinto y prueba física.
Las etiquetas no transmiten posiciones continuamente y no se dibujan rutas inventadas.

Cada intento usa operation_key generado al confirmar. Después de un resultado
incierto se bloquean los campos y solo se ofrece repetir el mismo cuerpo/clave.
Un comprobante repetido no se presenta como una operación nueva. No hay retry
silencioso ni persistencia de formularios en localStorage. Al recargar o salir,
revisar el registro antes de crear otro intento: no se promete deduplicación de
identidades nuevas o de un actor distinto.

La fuente exige procedencia productiva, empresa correcta, contadores coherentes
y protocolo disponible antes de habilitar escrituras. El BFF aplica permisos
logistics:read/write. Usuarios de consulta no ven botones de confirmación.
Se conserva el mapa, Centro en Vivo, expediente del lote y los demás módulos.

## Pruebas

Suite dashboard: 775 pruebas, 773 aprobadas, cero fallos y dos omitidas antes de
publicar. Ocho pruebas nuevas de protocolo, alcance, recibos, contadores y permisos.
Build y TypeScript aprobados. Chrome local: cuatro combinaciones escritorio/móvil,
claro/oscuro; confirmación obligatoria, respuesta perdida, retry con la misma clave,
un solo envío, ausencia de TT conservada, filtros sin nueva consulta y rol de lectura.
Cero errores JS no capturados ni incidencias axe serias/críticas en la superficie
analizada. Las mutaciones fueron simuladas solo en loopback, no en clientes reales.
Las garantías transaccionales se probaron además en PostgreSQL real local (21 casos)
y se documentan en la release de API; no se infieren de la simulación del navegador.
