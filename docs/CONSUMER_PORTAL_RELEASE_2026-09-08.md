# Portal consumidor y acceso — 2026-09-08

## Publicación verificada

- Web: `ce3faf9b`, `2026.09.08-web.1`, deployment `dpl_E8c1DHjZpVC47Q5tbaQS6QAMmRJM`.
- API inicial: `d96640af`, `2026.09.08-api-otp.1`, deployment `dpl_6p9WSCSgSDwboWwgkJsWvQ4fvftG`.
- Ambos builds READY y promovidos por separado. `/release.json` coincide en nexid.lat y nexid.com.ar; API verificada en api.nexid.lat.

## Alcance

Inicio y productos guardados con datos reportados, cuatro destinos principales y menú Más accesible; claro/oscuro, textos simples y enlaces de lectura/experiencia/catálogo existentes. Se retiraron del inicio simuladores de comercio y valores/imágenes de relleno. No se implementaron pagos, transferencias, campañas ni nuevas funciones de rewards en este sprint.

Login con reenvío explícito, cambio de canal que limpia el código anterior, etiquetas accesibles y mensajes de aceptación del proveedor sin declarar entrega al destinatario. Autenticación y sesión siguen siendo obligatorias.

## QA

- 487/487 pruebas web; TypeScript y revisión de diff aprobados.
- API: 335 pruebas focales de OTP, seguridad, límites y consumer; build de producción ejecutó además las suites de regresión configuradas.
- Navegador local aislado: home con datos sintéticos, navegación a productos, estados vacío y sin respuesta, modo claro/oscuro, menú móvil Más, Escape y devolución del foco al botón. El servicio local está limitado a 127.0.0.1 y requiere `--local-qa`; no es una ruta desplegada.
- Viewport móvil del navegador de QA: ancho CSS 453, documento 436, sin desborde horizontal. La captura del IAB presenta recorte por escala; no se usa como certificación de un teléfono físico de 390 px.
- Producción: nexid.com.ar/me conserva el dominio y redirige al login consumidor sin sesión; controles nuevos visibles.

## Entrega real: todavía no certificada

Pedido autorizado realizado desde el login público a las 15:01:48 UTC. SMTP reportó accepted=1/rejected=0 y Twilio WhatsApp respondió 201/queued. El usuario confirmó que no recibió ninguno. Esa evidencia NO permite afirmar que ambos canales funcionan de punta a punta. Sigue pendiente identificar rechazo/retención posterior en los proveedores y validar el ingreso real con un código recibido por el usuario.

No se leyeron códigos ni se fabricó una sesión productiva. La prueba del portal con datos reales autenticados sigue pendiente del acceso.
