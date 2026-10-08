# SUN: demos por rubro

La entrada pública `/sun` sin una lectura muestra una galería de cuatro experiencias. Antes dibujaba un pasaporte sin producto, imagen ni coordenadas. Valle Secreto queda destacada para la presentación; el botón del hero abre directamente Profundo 2019 y el menú ofrece «Demos por rubro».

| Experiencia | Enlace público | Datos |
| --- | --- | --- |
| Valle Secreto | `/sun?demo=1&profile=valle-secreto&scenario=closed` | Ficha y fotografía públicas de Profundo 2019; estado, sensores y juego simulados |
| Agroquímicos | `/sun?demo=1&source=demo-lab&profile=agrochem&scenario=closed` | CampoNexo, producto y ubicaciones de muestra; sin formulación, dosis o instrucciones de aplicación |
| Perfumería | `/sun?demo=1&source=demo-lab&profile=fragrance&scenario=closed` | Casa Bruma, marca inventada con fotografía de referencia del banco visual existente |
| Packaging | `/sun?demo=1&source=demo-lab&profile=perfume&scenario=closed` | Estuche Aurora, perfil ilustrativo existente de Demo Lab |

`/sun?demo=1` sin otra selección abre Valle Secreto. Los perfiles explícitos y el handoff anterior de Demo Lab conservan su selección. No se elige una marca al azar al recargar.

Cada tarjeta permite comparar `scenario=closed`, `opened` o `invalid`, también desde un selector al comienzo del pasaporte. Cerrado y abierto describen estados simulados: una apertura no demuestra falsificación y un cierre no certifica un producto físico. La lectura no válida usa `ok:false`, estado `INVALID` y sello `UNKNOWN`; todas sus acciones protegidas quedan bloqueadas. La ficha informativa sigue disponible. Sin escenario explícito, Valle conserva cerrado y el handoff genérico de Demo Lab conserva abierto. Estos parámetros no cambian una lectura real, un QR ni un snapshot.

La galería sólo aparece en una entrada realmente vacía, con idioma opcional. Los marcadores de NFC, QR, snapshot, evento, lote y valores malformados conservan su flujo de lectura. La galería no consulta productos, solicita ubicación, monta el mapa ni crea eventos de CRM. Los perfiles son un catálogo público resuelto en el servidor; la URL no permite sustituir marca, fotografía externa, tenant o permisos.

Los enlaces internos del menú comercial y el regreso del pasaporte a Demo Lab cargan su destino al elegirlo. Se desactivaron sus precargas automáticas después de observar solicitudes anticipadas a Demo Lab, «Quiénes somos» y contacto durante QA; sus destinos y controles de navegación se conservan.

No hay compras, titularidad, premios o verificación de etiquetas reales en estas demos. Tampoco se afirma un acuerdo comercial con las marcas de referencia. API y dashboard no incluyen cambios en esta entrega.

Esta entrega parte de WEB `9defc0206f43d3a6bcff829a733665801938c9df` y no incluye el incremento pendiente del sommelier con proveedor LLM. La compilación de producción se prepara sin asignar dominios y se publica sólo después de CI y de QA sobre el despliegue real en claro/oscuro y móvil. El comprobante de publicación y sus resultados se conservan por separado; este documento describe el código y no confirma por sí solo la publicación.
