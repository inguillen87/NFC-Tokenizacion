# S1.1 — Uso y estado operativo | dashboard.7

Base: f99bddc48a6a4e9a06c92bca2598e9f3ec029e0b.
Ruta existente mejorada: `/service-levels`. Acceso desde perfil y navegación.
No cambia el mapa, Modo sala, SUN móvil, logística ni la configuración de rollos.

## Funcionalidad entregada

- Lecturas SUN persistidas, fuentes que respondieron, servicios para revisar y uso mensual SDK opcional.
- Conserva seis servicios, indicadores, señales, objetivos y guías de respuesta. No presenta porcentaje de completitud como uptime del sistema.
- Filtros locales por revisión o muestra insuficiente; desplegar detalles no consulta de nuevo las fuentes.
- Guías y enlaces de acción según los permisos efectivos de la sesión.
- Copia y descarga JSON de evidencia para soporte con permiso reports.export. Se proyectan solo métricas y metadatos aprobados: sin UIDs, eventos, nombres de claves ni información personal.
- Consulta SDK solo al solicitarla, si api_keys.read lo permite. El agregado del mes no se suma con las lecturas SUN ni se interpreta como uso total de toda la API.
- Consulta manual con feedback y pausa local entre actualizaciones. No agrega polling ni una conexión de realtime.
- Presentación responsive, claro/oscuro, acordeones y estados de carga, error, falta de permiso y muestra vacía diferenciados.

## Fuentes y aislamiento

Reutiliza GET observability/service-levels y, opcionalmente, GET sdk/api-keys del backend existente. No se agregó una integración ni una migración.
El servidor establece tenant y permisos antes de leer. Valida esquema, procedencia productiva, ventana, alcance, seis servicios, identificadores conocidos, contadores, porcentajes y consistencia básica. El lector limita respuesta a 256 KiB y pide cancelación a los 12 segundos. El timeout HTTP no garantiza cancelar una consulta ya iniciada en otro servicio.
La proyección SDK descarta las filas de credenciales; solo transmite conteo mensual y latencia promedio registrada. Sin solicitudes, la latencia es desconocida, no 0 ms.
Los resultados parciales del proveedor se conservan como fuentes no disponibles. Un error de contrato no se rellena con ceros ni fixtures.

## Límites expresos

Esto es la primera entrega de S1, no el cierre completo del sprint. Aún no conecta facturas, GB almacenados, CU-horas, presupuesto monetario ni cuotas duras por empresa. No modifica planes del proveedor. Se distingue uso medido, costo no medido y facturación no conectada.
Los agregados no miden todas las solicitudes que fallaron antes de la persistencia. Las advertencias de lectura del módulo se escriben sin identificadores de tenant ni payloads; no equivalen a monitoreo completo de /sun.
Los candidatos de alerta no crean tickets ni envían notificaciones. El margen de error del objetivo no es dinero. Los runbooks existentes se conservaron; no se activan transacciones de blockchain.

## Evidencia previa a publicación

TypeScript y build Next.js: aprobados. Suite dashboard: 750 pruebas; 748 aprobadas, cero fallos y dos omitidas. Se agregaron 14 pruebas funcionales de contratos, scope, proyección, errores, límites y consultas opcionales.
Chromium local, datos sintéticos y tráfico de servicios limitado a loopback: cuatro combinaciones de escritorio/móvil y claro/oscuro, filtros sin nuevas lecturas, SDK bajo demanda, exportación y ausencia de campos de credenciales. Cuatro escenarios adicionales: respuesta inválida, fuente caída, permiso rechazado y muestra vacía confirmada. Sin overflow horizontal ni errores JS no capturados; cero incidencias axe serias/críticas en la superficie nueva evaluada. No equivale a certificación WCAG.
Los tests estructurales del módulo anterior ahora inspeccionan sus responsabilidades extraídas y mantienen los requisitos de procedencia, permiso, guías y mensajes de falta de datos. No se sustituyeron fallos por aserciones vacías.

## Publicación

Un commit, un build de dashboard con --prod --skip-domain y promoción después de verificar estado y versión. Comparar el alias activo antes de promover para no sobrescribir otra release concurrente.
Referencia anterior: dpl_Ax7rM7qQec6Uz9Xb4nmfp1M1c5ZA. API y web pública deben conservar sus deployments; no hay migraciones ni recursos nuevos.
Las pruebas funcionales privadas son locales y sintéticas. Después de publicar se comprueban versión, páginas públicas y redirección de rutas privadas sin sesión; no se ejecutan acciones con clientes reales.
