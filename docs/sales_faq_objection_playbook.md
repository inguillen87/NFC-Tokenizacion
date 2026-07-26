# Guía de Manejo de Objeciones y FAQ Completo: nexID

Este documento sirve como manual estratégico y de preparación de ventas (Sales Playbook) para afrontar reuniones de alta prioridad con dueños de bodegas, gerentes de operaciones, distribuidores e inversores tradicionales. Su propósito es erradicar el nerviosismo proporcionando respuestas contundentes, estructuradas y con enfoque de negocio.

---

## 1. El Gran Combate: NFC Criptográfico nexID vs. Código QR Tradicional

Esta es la pregunta más frecuente. La respuesta corta es: **El QR impreso puede copiarse con una foto; un NTAG 424 DNA provisionado genera una respuesta criptográfica dinámica que nexID valida contra el lote, el contador y la política anti-replay. Esa evidencia corresponde al tag y no prueba por sí sola el contenido, el origen ni la presencia física del producto.**

### Tabla Comparativa de Tecnologías

| Característica | Código QR Tradicional | nexID NFC Criptográfico (NTAG 424 DNA) |
| :--- | :--- | :--- |
| **Copiabilidad / Fraude** | **Crítica.** Cualquier persona le saca una foto y puede imprimir 10,000 etiquetas iguales. | **Alta resistencia.** Cada toque genera una firma criptográfica dinámica de un solo uso (NFC SUN), validada server-side. |
| **Experiencia de Usuario** | **Fricción.** Requiere abrir la cámara, enfocar, buena luz y presionar un enlace flotante. | **Rápida.** Solo requiere acercar el teléfono a la botella (tap); no necesita app y la velocidad depende del teléfono/red. |
| **Señal de Apertura** | **Nula.** El QR no cambia si la botella ya fue abierta. | **Estado TT reportado.** Si el circuito TagTamper fue integrado correctamente al cierre, nexID/DPP registra el estado abierto/cerrado reportado; no certifica por si solo el contenido ni la integridad fisica completa. |
| **Geolocalización Antifraude** | **Fácil de engañar.** Solo reporta la IP de red del navegador del usuario de forma estática. | **Señales de riesgo.** Cruza mensaje NFC, replay, región aproximada reportada, timing y patrón de lecturas para levantar alertas. Ubicación y dispositivo siguen siendo señales potencialmente manipulables. |
| **Estatus y Valor de Lujo** | **Bajo.** Asociado a cartas de restaurantes baratos, menús digitales y folletos de supermercado. | **Premium.** Asociado a tarjetas de crédito de metal black, pasaportes biométricos y llaves de vehículos de alta gama. |

### Cómo responder en vivo:
  > *"Mire, don [Nombre del dueño], un código QR en su etiqueta es el equivalente a poner un cartel en la puerta que dice 'Esto es original'. Cualquiera puede fotografiar ese cartel y pegarlo en una botella falsa. Con nexID, lo que ponemos en su botella no es solo un cartel: es un microchip de seguridad similar al que tiene una tarjeta contactless. Cada vez que alguien lo toca con el celular, el chip genera evidencia criptográfica dinámica. Si alguien intenta reutilizar una lectura o copiar la URL, el backend lo marca como replay o riesgo. Su QR es comunicación; nuestro chip suma evidencia dinámica, control anti-replay, DPP y propiedad digital cuando corresponde. Esa evidencia no certifica por sí sola el contenido de la botella."*

---

## 2. Objeciones del Bodeguero (Dueño / Enólogo / Gerente de Planta)

### Objeción A: *"Esto me va a encarecer mucho el costo por botella (Unit Economics)"*
* **La Realidad:** El costo de un chip NTAG 424 DNA depende de volumen, proveedor, formato y encoding. Para una botella premium, el caso se evalúa contra reducción de falsificación, postventa, DTC, garantía y datos propios, no como un adorno unitario.
* **Respuesta:**
  > *"Entiendo perfectamente que cada centavo cuenta en la estructura de costos. Lo correcto es mirarlo por línea y por riesgo: en vinos premium, el chip no compite contra una etiqueta común, compite contra falsificación, daño reputacional, soporte posventa y falta de datos propios. nexID reduce ese riesgo y abre un canal Direct-to-Consumer medible. Si el producto no tiene margen ni riesgo de falsificación, no lo fuerzo; si es premium, exportación o edición limitada, el retorno suele estar en seguridad, garantía y CRM."*

### Objeción B: *"Me va a ralentizar la línea de embotellado y etiquetado"*
* **La Realidad:** Los chips NFC vienen integrados en rollos autoadhesivos estándar (inlays) que las máquinas etiquetadoras industriales pueden aplicar de manera automática en el mismo proceso de etiquetado frontal, contra-etiquetado o debajo de la cápsula.
* **Respuesta:**
  > *"La parte operativa se valida con una prueba de línea, no con promesas genéricas. Los chips vienen en formato autoadhesivo industrial y normalmente se integran con aplicadores/labelers roll-fed en contraetiqueta, etiqueta frontal o bajo cápsula. La velocidad real depende del formato, ubicación del inlay, radio de lectura y QA de cada línea. Nosotros entregamos el rollo preprogramado y el spec de aplicación para reducir fricción antes de escalar."*

### Objeción C: *"El público que compra mis vinos es gente grande, no van a usar el celular para esto"*
* **La Realidad:** El consumidor de vinos de alta gama valora el ritual y el estatus. NFC no requiere descargar aplicaciones y la tecnología está tan difundida (por los pagos sin contacto como Apple Pay / Google Pay) que su uso es intuitivo.
* **Respuesta:**
  > *"Es un excelente punto. Por eso diseñamos la plataforma para que **no requiera descargar ninguna aplicación**. El comprador solo tiene que acercar el celular y la pantalla se enciende sola con su botella digital en 3D. Hoy en día, la gente mayor ya paga el supermercado o el taxi apoyando el celular en el posnet; el gesto es exactamente el mismo. Además, para los coleccionistas de vinos finos, el hecho de tener su 'cava digital' e influir en votaciones de la bodega mediante la gobernanza les otorga un estatus exclusivo que les encanta presumir."*

### Objeción D: *"¿Qué pasa en bodegas, restaurantes subterráneos o zonas rurales sin internet?"*
* **La Realidad:** NFC se puede leer sin internet. NTAG 424 DNA puede generar una respuesta SUN/SDM fresca sin internet porque el chip calcula la prueba internamente cuando recibe energía del celular o lector. Pero en el flujo web normal, el veredicto de confianza, claim, garantía, CRM y tokenización se completan cuando el backend vuelve a estar disponible. Para verificación instantánea offline se necesita app/lector controlado con reglas y claves provisionadas de forma segura.
* **Respuesta:**
  > *"Si el cliente está en una cava sin señal, el celular puede leer el NFC y el NTAG 424 DNA puede generar su código criptográfico fresco. Lo correcto es hablar de validación diferida: el tap queda guardado o se reintenta, y cuando vuelve internet el backend valida SUN/SDM, replay, tamper, lote y política. En operaciones industriales también podemos usar lectores o apps cerradas que validan localmente con claves derivadas y seguras. Lo que no prometemos es ownership, NFT o garantía final 100% offline en un navegador común."*

---

## 3. Preguntas de Inversores (Modelo de Negocio y Escalabilidad)

### Pregunta A: *"¿Cuál es la barrera de entrada (Moat)? ¿Qué evita que un competidor compre chips NFC y haga lo mismo?"*
* **Respuesta:**
  > *"Cualquiera puede comprar chips NFC en el mercado, pero el valor de nexID no está en el chip físico (hardware comoditizado). Está en el software, la custodia de claves, el motor SUN server-side y la política de claim. Si un competidor copia una URL o compra chips genéricos, no tiene las claves de lote ni el backend para validar CMAC, replay, tamper y tenant. Polygon entra después, para ownership o certificado cuando corresponde; IOTA puede entrar como proof opcional con hashes o Merkle roots. La ventaja está en integrar seguridad, CRM, warranty transfer y auditoría sin poner todos los taps on-chain."*

### Pregunta B: *"¿Por qué usan Blockchain (Web3) en lugar de una base de datos tradicional?"*
* **Respuesta:**
  > *"La base operativa vive en nexID porque ahí se validan el chip, el tenant, el canal, el riesgo, la geolocalización aproximada y el CRM en tiempo real. Blockchain no reemplaza esa operación ni recibe todos los taps. Polygon se activa cuando hay propiedad digital, certificado transferible, NFT, garantía o claim de ownership; IOTA puede actuar como capa opcional de prueba para hashes, Merkle roots, DPP o logística. Así mantenemos velocidad, privacidad y costos bajo control, pero dejamos evidencia pública cuando realmente aporta valor probatorio o de mercado secundario."*

### Regla de veracidad para Web3
* **Respuesta corta para ventas:**
  > *"No somos partner oficial de Polygon ni IOTA salvo que exista un acuerdo público verificable. Integramos Polygon como capa de ownership y podemos integrar IOTA como proof layer opcional. Tampoco prometemos costo cero ni una transacción por tap: usamos hashes, Merkle roots y políticas por tenant para publicar solo lo que aporta valor."*

### Pregunta C: *"¿Cómo escalan el modelo de negocio? (SaaS vs. Hardware)"*
* **Respuesta:**
  > *"El modelo es híbrido: margen inicial por tags, encoding y onboarding; y SaaS recurrente por CRM/analytics, reglas de riesgo, webhooks, reportes, portal del consumidor y automatizaciones. El hardware abre la puerta, pero la retención viene de operar batches, garantías, campañas, alertas y datos propios por cosecha o línea de producto. Esa es la diferencia entre vender chips y vender infraestructura de confianza."*

---

## 4. Preguntas del Consumidor Final (El Comprador del Vino)

### Pregunta A: *"¿Tengo que descargar una aplicación para usar nexID?"*
* **Respuesta:**
  > *"No hace falta descargar una app en teléfonos NFC compatibles. El usuario acerca el celular al punto marcado y, si el teléfono está desbloqueado, NFC está habilitado y hay conectividad, se abre una experiencia web segura con el resultado de la evidencia NFC, origen declarado, garantía y beneficios. Sin app obligatoria ni registros pesados."*

### Pregunta B: *"¿Esta etiqueta inteligente consume batería o emite radiación?"*
* **Respuesta:**
  > *"No tiene batería propia ni emite señal activa. El chip es pasivo: se energiza solo cuando el celular o lector genera el campo NFC durante el tap. Es el mismo principio de etiquetas NFC pasivas usadas en retail, credenciales y packaging."*

### Pregunta C: *"¿Mi información personal y de ubicación está protegida?"*
* **Respuesta:**
  > *"Sí. La información personal queda off-chain y bajo control de acceso. Podemos usar región aproximada o señales técnicas para detectar fraude, pero no publicamos tu ubicación exacta, email, teléfono ni historial de compra en redes públicas. Si existe certificado o proof, la parte pública usa metadata sanitizada, hashes o referencias derivadas."*

---

## 5. El "As bajo la manga" para la reunión en vivo

Cuando expongas ante el dueño de la bodega, seguí esta estructura de demostración:

1.  **Llevá dos botellas iguales:** Una con chip nexID y otra común con un código QR impreso.
2.  **Mostrá la debilidad del QR:** Pedile al dueño que escanee el QR de la botella común. Luego, sacale una foto con tu celular a ese QR y escanealo desde la pantalla de tu móvil. Decile: *"Vea, acabo de duplicar la identidad de su botella en un segundo"*.
3.  **Mostrá la fortaleza de nexID:** Pedile que apoye el celular en tu botella inteligente. Se abrirá el Portal nexID VIP mostrando la botella en 3D interactiva. 
4.  **Simulá el descorche:** Solo con una muestra cuyo circuito TagTamper esté integrado al cierre, abrí la botella (o interrumpí el circuito de demostración) y volvé a apoyarla. El celular debe mostrar: *"Estado TT reportado: abierto desde el 12/06/2026"*. Aclará que es la lectura del circuito, no una certificación independiente del contenido.
5.  **Abrí tu notebook con el CRM:** Mostrale cómo su tap en Buenos Aires apareció en el mapa al instante con el score de riesgo en 0%. Decile: *"Si esta botella ahora viaja a Miami y alguien intenta duplicar el chip, el CRM le avisará a usted al instante. Usted tiene el control total"*.
