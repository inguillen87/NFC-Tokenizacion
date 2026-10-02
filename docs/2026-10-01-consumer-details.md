# SUN: carga progresiva y continuidad de interacción

Versión candidata: `2026.10.01-web-consumer-details.1`. Base publicada: `be89586f6041b69ba89288aa1fc752c2048d488b`, integrada mediante la PR #400. Este documento describe la implementación; no acredita por sí solo CI, Preview ni publicación.

## Comportamiento para el cliente

- Postventa y las experiencias de marca conservan su título mientras descargan sus opciones. El estado explica que se puede seguir consultando el producto, sin mostrar porcentajes inventados. La señal de carga respeta movimiento reducido y los colores claro/oscuro.
- Si el cliente escribe, desplaza la página, sigue otro enlace o usa el historial durante esa descarga, el resultado no recupera el foco. Una apertura manual sin otra interacción entrega el foco a las opciones; un error lo entrega al reintento. La información del producto permanece disponible.
- Los detalles de puntos del mapa distinguen apertura con teclado y con puntero. Cerrar con el botón o Escape devuelve el foco al control de origen si continúa disponible. Escape cierra una sola capa: menú externo, detalle del punto, o mapa ampliado. La reconstrucción del mapa no dirige el foco a un control antiguo.
- La marca estática de SUN usa una entrada independiente. El HelpBot público conserva su botón renderizado en servidor y carga su componente mediante un puente separado. Los componentes UI usados por SUN se importan desde sus entradas concretas para evitar dependencias ajenas al pasaporte.

Los logos grandes y el HERO animado públicos mantienen su presentación y ciclo de movimiento. No se modifican API, dashboard, dependencias, paquetes compartidos, cartografía, atribuciones, coordenadas, consentimiento, seguridad NFC, anti-replay, permisos ni contratos. No se agregan migraciones o escrituras comerciales.

## Comprobación

Las pruebas de navegador usan datos sintéticos, la implementación real del mapa y los componentes reales de consumidor. Cubren teclado, puntero, historial, descargas demoradas o fallidas, reintento, claro/oscuro y anchos de 320, 390, 768 y 1440 px. El reintento también se verifica sobre un build real de Next. No representan un TAP físico, GPS o una operación comercial real.

El presupuesto de carga se comprueba con el grafo compilado y mediciones de red. El tamaño gzip reconstruido localmente y el cuerpo codificado observado por Resource Timing son métricas diferentes; ninguna reducción se declara antes de medirla. Los tiempos de laboratorio no acreditan tiempos en teléfonos de clientes.

El incremento anterior conservó cuatro comparaciones visuales exactas fallidas en nexid.lat. Sus reportes permanecen intactos; las capturas nuevas tienen identidad y resultados propios y no cambian retrospectivamente esa aceptación. El registro de release debe precisar fuente, CI, deployment, dominios, métricas y cualquier control pendiente.
