# Canales del lote: TagTamper, GS1 y QR — entrega 2026-09-18

API: 2026.09.18-api-channels.1, base 28946beed6cdd964c9249db5e8e8bfd9cc3f1fae.
Dashboard: 2026.09.18-dashboard.13, base 366dc752c5181e722c098e12b980155052555204.
No modifica la aplicación web pública, SUN/SDM, claves, contadores ni planes.

## Operación visible

Desde /batches y la ficha de producto se abre «Enlaces QR / estado NFC».
La configuración se obtiene del lote y su empresa, nunca del nombre del lote.
No se cambian perfiles ni se inscriben lotes por abrir la pantalla.

TagTamper: presenta fuente, longitud, codificación y valores TT configurados.
Distingue expresamente configuración de evidencia física: esta vista no declara
que el precinto esté cerrado. Un NFC seguro conserva su URL dinámica por lectura;
no se emite un QR estático que pretenda reemplazar CMAC, contador o anti-replay.
La reparación TTStatus existente ahora rechaza un perfil QR, GS1, NFC sin tamper
o desconocido, antes de construir o escribir configuración. Un TT registrado
mantiene su funcionamiento anterior; no se ejecutó reparación en producción.

QR básico: cuando perfil, empresa, lote y política pública están habilitados,
el servidor genera un SVG del destino de pasaporte registrado. No solicita una
URL arbitraria, no envía datos a un generador externo y no crea claves NFC.
Generar o descargar no provoca un TAP; abrir el enlace público sí es una visita
del canal estático. Una copia del QR no es evidencia de presencia física.

GS1: conecta el registro ya existente con un formulario GTIN/lote/serie.
Exige un GTIN de 14 dígitos con control válido y autorización activa del prefijo
para la empresa. Los calificadores soportados son un perfil acotado (AI10/AI21,
20 caracteres imprimibles, sin separadores de URL), no toda la sintaxis GS1.
La identidad se persiste y audita en el registro existente; la respuesta devuelve
la ficha actualizada para generar el QR inmediatamente. Repetir los mismos datos
tras una respuesta perdida recupera la misma identidad sin duplicación. Cambiar
los datos o el lote no sobrescribe otra identidad existente.

El destino GS1 se emite como /01/GTIN[/10/lote][/21/serie] en nexid.lat y utiliza
el resolver existente. No inventa GTIN ni aprobación GS1. La consulta productiva
previa mostró cero prefijos autorizados y cero identidades: el primer cliente GS1
necesita aportar su identificación y autorización de prefijo. No se otorgó esa
autorización ni se registraron identidades de prueba en producción.

## Aislamiento y fallos

Rutas por lote autorizadas con sesión y alcance de empresa. Lectura requiere
batches:read; alta admite gs1:write o batch.product.configure con denegación
explícita gs1:write respetada. No cambia roles ni impersona clientes.
Request body limitado, plazos de solicitud y respuestas no-store.
Las imágenes QR son SVG producidos por la dependencia existente del servidor,
mostrados como imágenes Blob y no HTML inyectado. Se revocan al cambiar de
resultado o desmontar el componente. Una nueva consulta retira el QR anterior.
Sin polling, almacenamiento local de formularios ni operaciones silenciosas.

## Pruebas realmente ejecutadas

Dashboard: TypeScript y build completos aprobados; 838 pruebas, 836 aprobadas,
cero fallidas y dos omitidas. Cuatro pruebas nuevas de contrato/canal.
API: build y regresiones completas aprobados, incluidas SUN/GS1; nueve pruebas
nuevas de proyección, seguridad de canales y protección de reparación TT.
Comprobaciones de secretos pasaron en ambos worktrees. Lockfile sin cambios.

Navegador con Next/React/BFF del proyecto contra registro GS1 real y PostgreSQL
17.10 efímero local. Solo autenticación/sesiones y datos eran fixtures locales.
Se probó TT sin conversión, QR básico descargable, alta GS1 persistida, respuesta
perdida tras commit, reintento único, listado actualizado automáticamente, QR del
registro y resolución al tenant/lote correcto. Viewer sin escritura y scope ajeno
rechazado. Las tres configuraciones de lote permanecieron idénticas tras la prueba.
Cuatro casos visuales 1440/390, claro/oscuro; cero incidencias axe reportadas en
la superficie evaluada. No es certificación WCAG ni un nuevo ensayo físico NFC.

## Verificación real previa y límites de esta entrega

Al iniciar se abrió /batches en el Chrome autenticado del titular: la sesión de
Balmec mostró Gran Reserva Malbec y diez activas/diez inactivas. No se cambió su
sesión. Un intento posterior adicional de conexión CDP agotó el plazo, por lo que
no se afirma una comprobación privada posterior hasta obtener nueva evidencia.

La UI consulta hasta 100 identidades GS1 del lote. No implementa impresión masiva,
importación GS1 industrial por CSV ni emisión simultánea para miles de unidades.
No activa políticas QR ni cambia hardware existente automáticamente. Se reutiliza
el pedido de fábrica existente y sus controles; esta entrega no automatiza todas
las decisiones industriales ni verifica físicamente una etiqueta o impresión.

Reversas previas: API dpl_Epgr5LQiqxUzhFKG7WpkPascdN5f;
dashboard dpl_D2R6aqXpX2dqcvDjofpb9d8uSYCa. Promover API compatible primero.
No requiere migración. El piloto TagTamper y su configuración se conservan.
