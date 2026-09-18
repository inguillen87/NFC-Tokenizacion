# SUN móvil: ubicación voluntaria visible — web.6

Base Git: 869ecdf00c05979d8d101f6a3ad1c400668cf0c0.
La metadata del despliegue anterior informa gitDirty=1. El nuevo incremento no declara haber certificado los bytes históricos de aquel artefacto; se construye desde esta revisión con cambios explícitos, pruebas y referencia de reversa.

## Entrega

- Tarjeta de ubicación antes de los detalles técnicos, después del producto y resultado NFC.
- Compartir ubicación y Ahora no son acciones explícitas. Reabrir la tarjeta no pide permiso por sí solo.
- Usa el controlador único del TAP existente: sin geolocalización automática al cargar, sin observador de ubicación continua, sin repetir permisos o POST ante doble toque.
- Mensajes de solicitud, guardado, denegación, timeout, navegador no compatible y resultado incierto.
- Confirma el guardado únicamente con un comprobante válido para el mismo evento, lote, unidad y contador.
- Aceptar actualiza el evento existente; no crea un nuevo TAP. La IP no se corrige retroactivamente usando otras lecturas.
- Respeta aproximación, redondeo y frescura existentes. No promete ubicación exacta ni menor tiempo de respuesta del GPS.
- Jerarquía móvil compacta, foco sin salto de scroll, contraste, objetivos táctiles y movimiento reducido.
- Pasaporte accesible sin conceder ubicación. No se bloquea el producto ni se introduce consentimiento comercial.

## Pruebas

560 pruebas unitarias/contratos aprobadas antes de publicar, sin fallos ni omisiones.
Build Next.js local aprobado. Chromium con componentes reales y permiso/API simulados únicamente en loopback: éxito, denegación, timeout, entrega incierta, upstream desconocido, reintento autorizado y acción deshabilitada. Se verifica cero permisos al montar, rechazar o reabrir; una sola solicitud y un solo envío tras aceptar; recarga sin nuevo permiso; aislamiento del siguiente TAP. Capturas claro/oscuro y acción visible a 390px.

No se usaron URLs SUN reales para las pruebas y no se certifica un nuevo TAP físico. Sin cambios de backend, claves, esquema, proveedores ni contratación. No se modifican límites gratuitos.
Referencia de reversa del web previo: dpl_6G2bPMnoATxY9ySf5ZQufKNWbNp6.
