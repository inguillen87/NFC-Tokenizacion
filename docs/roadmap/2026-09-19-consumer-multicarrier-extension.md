# Ampliación del plan original — experiencia y múltiples tecnologías

Fecha de revisión: 19/09/2026. Este documento complementa S0–S7; no reemplaza el
relevamiento inicial ni declara cerrado un circuito sólo porque tiene una pantalla.
La petición nueva prioriza portal, SUN móvil, QR/GS1/UHF, presentación comercial,
marketplace y claridad de Polygon/IOTA, conservando los controles y el costo actual.

## 1. Base del plan original, conservada

El plan aportado por Marcelo prioriza autonomía de la empresa y cierre operativo.
S3 exige tres dimensiones separadas en el TAP: etiqueta, precinto y producto/lote.
S4 conserva la gobernanza editorial. S5 reutiliza SDK y EPCIS. S6 conecta avisos,
responsables y evidencia. S7 mantiene consentimiento y aprobación antes del envío.
No se reconstruye el CRM, la wallet ni el SDK desde cero y no se agrega un broker
para justificar un mapa animado. No se cambia Neon ni el verificador SUN.

## 2. Cierre implementado en web-consumer.1

Portal: galería consultable, filtros y orden sobre datos de la cuenta, detalle
móvil con foco, lectura histórica separada de avisos actuales, catálogo y vínculo
con la marca. SUN: tres señales, actualización compartida del aviso, español/
inglés/portugués y acceso al portal sin exponer el payload dinámico del chip.
Los detalles técnicos permanecen disponibles, pero no son el primer trabajo que
se le pide entender al consumidor. Ver el informe de release para pruebas reales.

## 3. Referencias públicas consultadas: no confundir marketing con certificación

Qliktag describe un editor visual de interacciones, codificación/activación NFC,
propiedad digital y pasaportes. Su página de socio Inriver describe sincronización
PIM, GS1 Digital Link y varios portadores (QR/RFID/NFC). Esto respalda priorizar
contenido maestro y un conector utilizado, no diez conectores nominales. No se
hizo una prueba de su panel privado, latencia, aislamiento o seguridad.
Fuentes: https://qliktag.com/ y https://www.inriver.com/partner/qliktag/

Authena describe la combinación NFC, IoT y blockchain para vino/bebidas, historia
del producto y protección frente a manipulación. La referencia abierta es una
publicación del propio proveedor, no una auditoría de su producto ni prueba de
superioridad comparativa. Mantener distinción entre señal de etiqueta y producto
físico es un requisito de NexID, no una promesa que deba copiarse literalmente.
Fuente: https://authena.io/using-blockchain-to-verify-the-authenticity-of-wines-and-spirits-in-the-web3-world/

## 4. Próximo cierre S4/S5: identidad multicanal sin conversión peligrosa

Una unidad mantiene una identidad interna; sus portadores y eventos se relacionan
con ella. NFC seguro no se convierte en QR, ni una lectura EPC en un CMAC válido.

NFC / TagTamper: mantener SUN/SDM, anti-replay, contador y mapeo TT existentes.
Añadir matriz de aceptación por modelo/proveedor y evidencia del encoding real;
no inferir el tipo de hardware del nombre de un producto ni de la apariencia UI.

QR básico: contenido y destino registrados. GS1 Digital Link: identidad comercial,
prefijo autorizado, GTIN y calificadores. Próximo cierre: importación masiva con
vista previa y errores por fila, reconciliación idempotente, rango/serie reservado,
exportación de etiquetas y muestra física de impresión antes de la liberación.
Crear veinte mil URLs no demuestra que veinte mil etiquetas estén bien fabricadas.

UHF / RFID: el perfil uhf_rfid y las API EPCIS ya existen. Pendiente específico:
adaptador para UN lector/gateway elegido, credencial por instalación, normalización
EPC con trazabilidad de la fuente, deduplicación por ventana y eventID durable,
reintento sin duplicación y asociación unidad/caja/pallet. Conservar readPoint,
bizLocation, instante observado, recepción y configuración del lector. Una lectura
sin identificación de origen no pasa como custodia confirmada. Cierre requerido:
lectura física → gateway → EPCIS → expediente → analítica; evidencia de reconexión,
lecturas repetidas y aislamiento entre empresas. No existe esa certificación de
hardware dentro de web-consumer.1.

GS1 mantiene separados URI Syntax, resolver y compresión EPC. El documento Gen2
consultado se identifica como 3.0.1, febrero 2026; debe fijarse la versión y región
soportadas al elegir lector. No adoptar cualquier protocolo porque el catálogo
dice RFID. EPCIS 2.0 define intercambio de eventos JSON/JSON-LD y REST: se debe
probar el subconjunto que implementa NexID, no anunciar conformidad universal.
Fuentes: https://ref.gs1.org/standards/digital-link/
https://ref.gs1.org/standards/gen2/
https://ref.gs1.org/standards/epcis/

## 5. Portal, marketplace y experiencia B2B2C

Prioridad siguiente al cierre actual: seguimiento de garantías/soporte con estado,
responsable y próximas acciones; documentos vigentes del pasaporte; permisos de
contacto por marca y baja simple; devolución/aviso como tarea entendible. Siempre
sobre modelos existentes y con auditoría, no otro módulo de clientes paralelo.

Marketplace: mantener catálogo por marca, separar consulta/disponibilidad/compra,
y cerrar stock, intención, comprobante y aceptación antes de marcar una orden como
pagada o entregada. Medir un evento comercial confirmado; no usar una visita como
venta ni el estado de un NFT como prueba de entrega física.

Autonomía de empresa: asistente por objetivo (proteger producto, informar con QR,
operar pallet), requisitos y responsable faltante; recetas de perfil con revisión;
prueba inicial de unidad y estado de preparación persistido. No crear llaves,
activar lotes o cambiar tecnología por avanzar entre pantallas.

## 6. Polygon e IOTA: preservar ambos y hacer legible su evidencia

Según el código/documentación del repo, Polygon representa la capa de propiedad
digital y transferencias controladas; IOTA, la evidencia pública mínima/hash-only.
La documentación del piloto IOTA todavía refiere a IOTA EVM testnet (1076).
Una configuración en el repo no demuestra disponibilidad de esa red ni confirmación
de una transacción hoy. No se cambian redes, contratos ni custodias en esta entrega.

Próximo cierre: panel legible de solicitud/enviada/confirmada/fallida, red/contrato,
prueba RPC y hash del contenido; validación manual sin firmar, y publicación sólo
con identidad/autorización/limite de gasto. Demo/testnet debe distinguirse de una
operación comercial. La caída de RPC debe aparecer como verificación pendiente,
no como éxito ni como desaparición del registro. No enviar cada TAP a blockchain.

La documentación pública actual de IOTA presenta Move y Notarization Toolkit con
Single Notarization y Audit Trails y lo anuncia como Alpha. Se agrega como candidato
a una prueba aislada de compatibilidad/costo/custodia, no como sustitución inmediata
del writer EVM actual ni de Polygon. No se presupone que ambos SDK sean intercambiables.
Fuentes: https://docs.iota.org/ y https://docs.iota.org/developer/iota-notarization
Índice oficial Polygon: https://docs.polygon.technology/llms.txt
Referencia interna: docs/polygon-ownership-layer.md y docs/iota-proof-layer.md.

## 7. Diseño, movimiento y herramientas

Conservar la línea visual clara/cian de landing y el sistema de cada aplicación.
La mejora tiene que ser visible en navegación, formularios y resolución de errores,
no añadir una introducción que se interponga entre el usuario y su tarea.

Motion ya está en el stack. Adoptar movimiento reducido y carga selectiva para
animaciones de layout donde agreguen claridad; CSS/diálogo nativo para transiciones
pequeñas y foco. En esta entrega no se agregó dependencia ni se cambió lockfile.
La guía oficial de Motion propone reducedMotion y useReducedMotion; se evalúan
sobre la versión fijada del repo antes de cualquier actualización.
Fuente: https://motion.dev/docs/react-accessibility

MapLibre ya sirve la cartografía: siguiente mejora es frescura/fuente/precisión y
clustering sobre lecturas reales, no puntos ficticios ni ubicación IP presentada
como GPS. Los gráficos deben conservar período, denominador, estado de fuente y
salida tabular. No cambiar todas las bibliotecas a la vez para tener una versión nueva.

Demo Lab: cada escenario debe indicar tecnología, simulación/testnet/registro real,
qué acción se ejecutó y qué requiere hardware o un proveedor. Conservar acceso a
las demos existentes y ejecutar sus recorridos antes de anunciar «todo activo».
No fabricar cuentas, avisos, puntos, mints o ventas en producción para poblarlas.

## 8. Secuencia de aceptación recomendada

A. Publicar portal + SUN de esta entrega con pruebas de lectura, avisos y aislamiento.
B. Perfil multicanal y producción masiva QR/GS1 con error por fila y prueba impresa.
C. Lector/gateway UHF de un cliente → EPCIS → unidad/caja/pallet/recepción.
D. Servicio posventa + marketplace con estados comerciales comprobables.
E. Prueba legible de Polygon/IOTA y demarcación de testnet bajo presupuesto.
F. Repetir accesibilidad, rendimiento móvil y pruebas del recorrido por rol.

No se fija una fecha sin medir cada integración. El criterio para superar a la
competencia es reducir intervención del superadmin, pasos y fallos con datos de
uso reales. No se declara superioridad a partir de un screenshot o una lista de
funciones. S0–S7 siguen siendo el eje; estos frentes son cierres y extensiones.
