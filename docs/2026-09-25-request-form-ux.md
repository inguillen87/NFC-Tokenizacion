# NexID — cierre de UX del alta de solicitudes

Base productiva comprobada: `cb2a845d8220d32716faa2a925ab7a03fe37908f`. Rama: `codex/nexid-request-form-ux-20260925`. Esta mejora usa la API ya publicada; no depende de las migraciones comerciales pendientes.

## Entrega

- «Nueva solicitud» lleva el foco y la vista al editor, también en móvil.
- Una guía compacta muestra datos pendientes y permite saltar al campo. Distingue edición local, borrador guardado, conflicto, operación en curso y resultado incierto; no emite recibos ni autoriza acciones.
- Errores junto al campo, descripciones persistentes y foco en el primer dato inválido. El nombre permite guardar un borrador parcial: no se inventan construcción, cantidad ni destino.
- La cantidad acepta sólo enteros sin separadores. `1,000`, `1.000`, decimales o notación exponencial no se redondean ni se envían; el texto permanece visible para corregirlo.
- La construcción seleccionada muestra las descripciones y comprobaciones ya existentes en el catálogo, sin prometer aprobación física o criptográfica.
- Se explica por qué «Revisar envío» no está disponible. La revisión mueve el foco a su encabezado; Escape o Volver regresan al control anterior sin enviar. Sólo la confirmación final usa el envío existente.

El componente no agrega consultas, autosave, almacenamiento local, órdenes técnicas, correos ni generación de claves. Se conservan tenant, autorización, idempotencia, versiones y recibos del cliente existente. No se cambió la API, SQL, dependencias, flags ni contratos de release .41.

## Verificación local

34 pruebas nuevas; suite completa del dashboard: 1.358 aprobadas y dos omisiones existentes. Tipos y build completos aprobados. El navegador de la guía comprueba ciclo completo, guardado parcial, errores, foco, retorno, incertidumbre, conflicto, denegación y cambio de contexto. La matriz cubre 320/390/1.440 px, claro/oscuro, y limita la altura de la guía móvil.

Se mantienen el navegador completo de solicitudes y la regresión de acceso/notificaciones. Las pruebas usan componentes y contratos reales con sesiones y transporte sintéticos, no registros de clientes. Capturas revisadas visualmente; los resultados finales y el CI por commit se consignan en la evidencia de cierre.

El manifiesto previo mantiene 438 fuentes inalteradas; se excluye únicamente el workspace revisado en este sprint. La guía y los errores no sustituyen los controles del servidor. Esta publicación no habilita cotización, proveedor o acuses pendientes del delta 0117–0121.

## Publicación

Antes de promover: CI del mismo commit, artefacto preparado sin asignación automática del dominio y comprobaciones HTTP. Hasta que exista evidencia canónica de promoción, este documento no declara el incremento publicado. La aceptación positiva en una sesión real y las operaciones físicas siguen siendo comprobaciones separadas.
