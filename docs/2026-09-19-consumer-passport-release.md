# S3 + S6 — Portal de consumidor y pasaporte móvil

Entrega: 2026.09.19-web-consumer.1. Base web 97200947244ceed362a3eafe5662c2d0a7031dd8.
Compatibilidad comprobada contra API c27ab01f6716e312c001317618f8ac705f486817
(api-tasks.1) y dashboard d7025b862fb1aed77b3e56e58d79212617c1ba4c (.19).
No cambia API, dashboard, SQL, SDK, executor ni aplicación de otro proyecto.

## Correspondencia con el plan inicial

Cierra la mejora S3 que separa en el primer TAP etiqueta, precinto y producto,
y conecta el circuito S6 de avisos vigentes con el portal de productos guardados.
No reinicia el plan S0–S7 ni introduce otra wallet, marketplace o API paralela.

## Portal de usuario: operación real

/me/products conserva su autenticación previa y la consulta existente a productos.
Agrega búsqueda por producto/marca/lote, filtro por empresa y ordenación. Muestra
hasta doce fichas por paso; esa paginación es de la lista ya cargada, no un conteo
del histórico entero. Filtrar/ordenar/mostrar más no genera consultas de negocio.

Cada ficha conserva lectura, catálogo de la marca, experiencia y datos del registro.
«Abrir ficha y avisos» abre un diálogo con imagen, marca, lote y lectura histórica.
En ese momento consulta los avisos públicos actuales del lote usando el mismo
servicio del pasaporte. No consulta un aviso por cada tarjeta mientras se navega.

Una lectura histórica con precinto cerrado puede aparecer junto a un retiro que
se publicó después. Se conserva el estado registrado, pero no se lo confunde con
la condición actual. Un fallo de actualización mantiene el aviso anterior visible
con incertidumbre explícita. Cambiar producto/tenant descarta el estado ajeno.
La selección está vinculada a la respuesta exacta de la cuenta: un refresh no
puede mostrar silenciosamente el producto que pasó a ocupar la misma posición.

El inicio /me enlaza a esa ficha sin perder el acceso directo a la lectura. El
parámetro focus sólo selecciona un eventId presente una única vez en la lista de
la cuenta; no autoriza ni consulta una lectura ajena. El detalle privado de una
lectura incorpora también la consulta manual de avisos actuales.

El diálogo usa foco nativo, cierre Escape y retorno al control que lo abrió.
Hay galería en escritorio, hoja de detalle móvil, claro/oscuro y movimiento
reducido. Etiquetas QR y eventos logísticos conocidos se muestran en lenguaje
comprensible; un estado futuro desconocido no se transforma en verificación.

## TAP móvil: tres señales y una fuente de avisos

Primera sección: etiqueta, precinto, producto. La señal comercial se alimenta de
la misma petición que el aviso principal. No se suma un segundo polling o fetch
para iluminar otro indicador. El aviso conserva su prioridad antes del producto.

NFC seguro y TagTamper mantienen el resultado que ya entregaba el backend.
QR, GS1 Digital Link y NFC básico se presentan como canales informativos; UHF se
etiqueta como fuente logística, no como autenticación SUN del teléfono. Esto es
presentación de capacidades, no una nueva certificación o driver de hardware.

Un resultado histórico sigue marcado como tal. La demo local no consulta avisos
productivos ni se etiqueta como un tap físico. El selector español/inglés/portugués
cambia los rótulos sin releer la etiqueta y sin traducir las declaraciones de la
empresa como si fueran evidencia técnica distinta.

«Mis productos y avisos» lleva al portal conservando el contexto seguro existente.
No agrega freshToken, CMAC o enc a la URL de cuenta; no otorga propiedad, garantía,
consentimiento o beneficios por navegar. GPS sigue siendo opcional y solicitado
por el control existente, nunca automáticamente al abrir la página.

## Seguridad y rendimiento

Se reutiliza ProductNotices v2, sus límites de cuerpo y el BFF no-store existente.
La consulta compartida tiene timeout, abort al desmontar y descarte de otra empresa.
No usa localStorage, almacenamiento de secretos, llamadas blockchain ni servicios
pagos nuevos. No modifica el verificador SUN/SDM ni las reglas de anti-replay.
No agrega dependencias; React, CSS Modules, iconos y diálogo nativo ya son suficientes.

## Verificación

Ensayo integrado con Next/React/BFF real y PostgreSQL local efímero. El registro y
la publicación/levantamiento de retiros usan handlers y SQL reales de la API actual.
La sesión de consumidor, su colección y los resultados SUN son fixtures explícitos:
no equivalen a login, lectura NFC física o escritura de un caso productivo.

Recorrido: buscar y paginar sin queries; abrir ficha; aviso publicado después de
la lectura; fallo de actualización; cambiar a otra empresa; foco por referencia;
consulta desde historial; tres señales SUN; actualización compartida; tres idiomas;
QR/GS1 informativos; lectura histórica; demo sin consultas; resolución revisada;
cuenta vacía vs fuente caída; rechazo de cuenta anónima.

Se evaluaron galería y detalle a 1440/390 px, claro/oscuro, y señales SUN móviles:
diez superficies con axe sin incidencias graves/críticas. La prueba de teclado
comprobó Escape y recuperación de foco. No constituye certificación WCAG completa.
La fixture verifica que sus lotes, configuraciones TT y filas de tags no cambian.

Prueba física nueva, carga mundial, reader UHF, transacciones IOTA/Polygon y
flujos comerciales de todos los demos no forman parte de esta aceptación.

## Despliegue

Promover únicamente la web desde una fuente limpia y tras comprobar el alias
anterior dpl_85svivuUFUyQRPUT7n4jmNxp7Q99. Es la reversa prevista. No hay migración.
No crear productos, avisos o usuarios demo para mostrar la galería en producción:
una cuenta sin productos debe ver su estado vacío real.

## Cierre de pruebas previo al despliegue

585 pruebas web aprobadas, cero fallidas y cero omitidas. TypeScript y build de
producción aprobados. Gate de secretos: 2.215 archivos inspeccionados, sin
formatos prohibidos. Dieciséis comprobaciones del recorrido integrado y diez
variantes visuales pasaron en el último ensayo.

Durante la revisión se corrigieron foco al cerrar el diálogo, selección vinculada
al payload de la cuenta y transición de color heredada en cambio de tema. Los
estados QR/logística conocidos tienen texto comprensible; los desconocidos se
conservan, sin inferir autenticación. No se cambió una dependencia ni el lockfile.
