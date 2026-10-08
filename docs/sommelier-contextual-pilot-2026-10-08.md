# Sommelier contextual de NexID — candidato del 8 de octubre de 2026

Estado inicial: implementado y en validación; este documento no acredita publicación. La evidencia de despliegues, CI, dominios y consultas reales se entrega por separado al congelar y publicar el candidato.

## Experiencia implementada

La demo de Valle Secreto abre la pestaña del sommelier desde «Guía del vino», ofrece cinco temas y preguntas de continuación. Conserva hasta seis mensajes en memoria de la vista (hasta 6.000 bytes), excluye el saludo y reinicia el contexto al cambiar producto, perfil o idioma. Cambiar de idioma o desmontar la vista cancela la respuesta pendiente. No se consulta al proveedor al abrir la página o la pestaña: requiere una pregunta explícita.

Sólo esta demo usa el nuevo servicio `/api/sommelier/demo/session` y `/api/sommelier/chat`. Obtiene un permiso de 15 minutos, limitado al perfil de demo, mediante una cookie HttpOnly. La API selecciona hechos publicados y enlaces de fuente; el navegador no suministra datos de producto, tenant, modelo, clave o permiso NFC al proveedor. Las respuestas muestran si provienen del servicio en vivo o de la guía local. Un error, cuota agotada o respuesta rechazada conserva la guía contextual local y permite seguir consultando.

El chat en vivo sigue siendo una demostración: no verifica una botella, compra, reserva, titularidad, puntos, sensores ni certificaciones. El servicio no tiene herramientas de compra ni acceso a CRM. La conversación no se guarda en NexID ni se comparte con la bodega. Las preguntas enviadas voluntariamente al servicio se procesan por el proveedor configurado; la redacción de contactos, enlaces y coordenadas reduce datos incidentales, pero no equivale a anonimización garantizada.

La interfaz de SUN físico y el portal `/me` conserva su integración anterior. La API incorpora un modo de consumidor con sesión normal y autorización de evento/tenant; eso no significa que esas interfaces ya estén migradas ni aceptadas con usuarios reales.

## Costos y límites

El modelo principal es `openai/gpt-oss-20b:deepinfra` mediante Hugging Face. El respaldo es `gpt-6-luna` de OpenAI, únicamente cuando la bandera del servidor lo habilita. Se reutilizan las claves ya existentes en la API; no se añaden claves al navegador ni se contratan nuevos servicios.

Cada intento reserva por adelantado su consumo estimado, incluido un eventual respaldo. Hay límites independientes de solicitudes, intentos, longitud, salida (1.024 tokens, incluido razonamiento) y tiempo. La reserva global es US$0,50 y por tenant US$0,10 en ventanas **fijas** de 24 horas desde la primera reserva. Son límites de reserva con precios fijados en el código, no una garantía de factura del proveedor. No hay reintentos ilimitados ni modelos elegidos por el visitante. Ante fallo de PostgreSQL se rechaza la admisión.

No se envían pesos de modelos al teléfono. No se implementó aún caché semántica, enrutamiento por dificultad, entrenamiento propio, OIDC entre aplicaciones ni pruebas de carga de 500/5.400 tenants y 100.000 clientes. La comparación de costos usa un escenario explícito de tokens, no una medición de ahorro en producción.

## Validación y publicación

Las pruebas de navegador con proveedor sintético comprueban historial, continuidad, fuentes, errores, cuotas, doble activación, cancelación e interfaces claras/oscuras. No demuestran calidad ni facturación real del modelo. La consulta real al proveedor, Preview, CI, etapa de producción sin dominios y lectura posterior de versiones requieren evidencia propia.

La API se construye desde su baseline publicado `8cda02b643cb506a1315a4aa26881fc7be5bf3fc`; WEB desde `9defc0206f43d3a6bcff829a733665801938c9df`. DASH no se despliega. No hay migraciones ni escrituras de datos de clientes. Las únicas escrituras nuevas son reservas en la tabla de cuotas ya existente. Una respuesta libre del modelo sigue necesitando evaluación: los hechos seleccionados son controlados, pero el filtrado de texto no garantiza ausencia absoluta de alucinaciones.

Versiones candidatas: WEB `2026.10.08-web-sommelier-managed.1`; API `2026.10.08-api-sommelier-managed.1`.
