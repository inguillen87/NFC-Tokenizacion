# Guía de Manejo de Objeciones y FAQ Completo: nexID

Este documento sirve como manual estratégico y de preparación de ventas (Sales Playbook) para afrontar reuniones de alta prioridad con dueños de bodegas, gerentes de operaciones, distribuidores e inversores tradicionales. Su propósito es erradicar el nerviosismo proporcionando respuestas contundentes, estructuradas y con enfoque de negocio.

---

## 1. El Gran Combate: NFC Criptográfico nexID vs. Código QR Tradicional

Esta es la pregunta más frecuente. La respuesta corta es: **El QR es un cartel estático que se copia con una fotocopia; el chip nexID es un microprocesador de seguridad activa que valida la presencia física del producto.**

### Tabla Comparativa de Tecnologías

| Característica | Código QR Tradicional | nexID NFC Criptográfico (NTAG 424 DNA) |
| :--- | :--- | :--- |
| **Copiabilidad / Fraude** | **Crítica.** Cualquier persona le saca una foto y puede imprimir 10,000 etiquetas iguales. | **Imposible.** Cada toque genera una firma criptográfica única de un solo uso (NFC SUN). |
| **Experiencia de Usuario** | **Fricción.** Requiere abrir la cámara, enfocar, buena luz y presionar un enlace flotante. | **Instantánea.** Solo requiere acercar el teléfono a la botella (Tap). Funciona en 0.5 segundos de forma nativa. |
| **Detección de Apertura** | **Nula.** El QR no cambia si la botella ya fue abierta, rellenada o adulterada. | **Física.** El circuito TagTamper se rompe al girar la cápsula, informando al ledger que ya fue abierta. |
| **Geolocalización Antifraude** | **Fácil de engañar.** Solo reporta la IP de red del navegador del usuario de forma estática. | **Activa.** Valida dinámicamente firmas geográficas cruzadas, levantando alertas si hay taps simultáneos lejanos. |
| **Estatus y Valor de Lujo** | **Bajo.** Asociado a cartas de restaurantes baratos, menús digitales y folletos de supermercado. | **Premium.** Asociado a tarjetas de crédito de metal black, pasaportes biométricos y llaves de vehículos de alta gama. |

### Cómo responder en vivo:
> *"Mire, don [Nombre del dueño], un código QR en su etiqueta es el equivalente a poner un cartel en la puerta que dice 'Esto es original'. Cualquiera puede fotocopiar ese cartel y pegarlo en una botella falsa. Con nexID, lo que ponemos en su botella no es un cartel, es un microchip de seguridad similar al que tiene su tarjeta de crédito. Cada vez que alguien lo toca con el celular, el chip genera un código matemático que sirve para esa milésima de segundo y nunca más. Si alguien intenta copiar el chip, el sistema lo detecta al instante. Su QR es publicidad; nuestro chip es seguridad y propiedad digital."*

---

## 2. Objeciones del Bodeguero (Dueño / Enólogo / Gerente de Planta)

### Objeción A: *"Esto me va a encarecer mucho el costo por botella (Unit Economics)"*
* **La Realidad:** El costo de un chip NTAG 424 DNA ronda los centavos de dólar según el volumen de compra. Para una botella de vino premium que se vende al público a $30 USD, $50 USD o más de $100 USD, el costo porcentual es inferior al 1.5%.
* **Respuesta:**
  > *"Entiendo perfectamente que cada centavo cuenta en la estructura de costos. Pero analicémoslo así: el costo del chip representa menos del 1.5% del valor de su botella de gama media-alta. A cambio de ese porcentaje, usted está logrando dos cosas que hoy no tiene: primero, erradica el riesgo de que falsifiquen su vino de autor (cuyo daño reputacional cuesta millones); y segundo, abre un canal Direct-to-Consumer. Hoy gasta más en intermediarios y distribuidores para obtener datos que con este chip obtiene directamente en su CRM. No es un costo, es una inversión en canal de venta directa."*

### Objeción B: *"Me va a ralentizar la línea de embotellado y etiquetado"*
* **La Realidad:** Los chips NFC vienen integrados en rollos autoadhesivos estándar (inlays) que las máquinas etiquetadoras industriales pueden aplicar de manera automática en el mismo proceso de etiquetado frontal, contra-etiquetado o debajo de la cápsula.
* **Respuesta:**
  > *"No se preocupe por la parte operativa. Los chips vienen en formato autoadhesivo (rollos industriales) que se integran directamente en el reverso de su contraetiqueta o bajo el sello de la cápsula de forma automatizada. No hay que detener la línea ni aplicar procesos manuales; sus máquinas etiquetadoras actuales pueden colocarlos sin perder velocidad de producción. Nosotros le proveemos el rollo pre-programado y encriptado."*

### Objeción C: *"El público que compra mis vinos es gente grande, no van a usar el celular para esto"*
* **La Realidad:** El consumidor de vinos de alta gama valora el ritual y el estatus. NFC no requiere descargar aplicaciones y la tecnología está tan difundida (por los pagos sin contacto como Apple Pay / Google Pay) que su uso es intuitivo.
* **Respuesta:**
  > *"Es un excelente punto. Por eso diseñamos la plataforma para que **no requiera descargar ninguna aplicación**. El comprador solo tiene que acercar el celular y la pantalla se enciende sola con su botella digital en 3D. Hoy en día, la gente mayor ya paga el supermercado o el taxi apoyando el celular en el posnet; el gesto es exactamente el mismo. Además, para los coleccionistas de vinos finos, el hecho de tener su 'cava digital' e influir en votaciones de la bodega mediante la gobernanza les otorga un estatus exclusivo que les encanta presumir."*

### Objeción D: *"¿Qué pasa en las bodegas o restaurantes subterráneos donde no hay señal de internet?"*
* **La Realidad:** Los celulares modernos pueden leer chips NFC sin conexión a internet activa y guardar la firma criptográfica localmente en el navegador (offline cache) para validarla en cuanto el teléfono recupere señal.
* **Respuesta:**
  > *"Nuestra tecnología contempla este escenario. Si el cliente está en una cava subterránea sin señal, el celular lee la firma criptográfica dinámica del chip y la guarda de forma segura. En cuanto el teléfono detecta datos móviles o Wi-Fi, la firma se envía al ledger para certificar la propiedad y actualizar su cava digital. El cliente no pierde la experiencia y usted no pierde el dato."*

---

## 3. Preguntas de Inversores (Modelo de Negocio y Escalabilidad)

### Pregunta A: *"¿Cuál es la barrera de entrada (Moat)? ¿Qué evita que un competidor compre chips NFC y haga lo mismo?"*
* **Respuesta:**
  > *"Cualquiera puede comprar chips NFC en el mercado, pero el valor de nexID no está en el chip físico (hardware comoditizado). Está en el software y la integración criptográfica propietaria. Tenemos un motor de descifrado SUN (Secure Unique NFC) que interactúa con claves criptográficas rotativas almacenadas en un módulo seguro (KMS). Si un competidor copia los chips, no tiene las llaves criptográficas maestras para validarlos en nuestra blockchain, por lo que el sistema los rechazará. Además, la suite de marketing inteligente (nexID Cognitive AI Engine) y el sistema de gobernanza y fidelización VIP integrados al CRM del productor son imposibles de replicar con hardware genérico."*

### Pregunta B: *"¿Por qué usan Blockchain (Web3) en lugar de una base de datos tradicional?"*
* **Respuesta:**
  > *"Una base de datos tradicional (como SQL) está controlada por una sola parte (nosotros o la bodega). Si un empleado infiel altera la base de datos, puede cambiar el dueño de una botella valiosa o certificar botellas falsas. Al registrar la propiedad de la botella en una blockchain (Polygon Ledger) mediante un contrato inteligente, el registro de autenticidad y propiedad se vuelve inmutable y públicamente auditable. Esto es crucial para el mercado secundario (subastas, reventa de botellas de colección) porque el comprador de la botella puede auditar on-chain la procedencia de la botella sin tener que confiar ciegamente en una base de datos privada."*

### Pregunta C: *"¿Cómo escalan el modelo de negocio? (SaaS vs. Hardware)"*
* **Respuesta:**
  > *"Nuestro modelo de negocio es híbrido y sumamente escalable. Por un lado, vendemos los tags físicos nexID programados (ingreso por volumen). Por el otro, operamos bajo un modelo SaaS recurrente mensual para las bodegas, cobrándoles por el uso del CRM, el nexID Cognitive AI Engine, la telemetría de geolocalización antifraude y el portal de gobernanza VIP. A medida que la bodega embotella más cosechas con nuestro chip, su dependencia y volumen de datos en nuestro CRM crece, asegurando retención a largo plazo y facturación SaaS recurrente."*

---

## 4. Preguntas del Consumidor Final (El Comprador del Vino)

### Pregunta A: *"¿Tengo que descargar una aplicación para usar nexID?"*
* **Respuesta:**
  > *"No. La tecnología NFC nexID es 100% nativa. Con solo apoyar la parte trasera del celular en la cápsula de la botella, se abrirá automáticamente una pestaña segura del navegador mostrándote el certificado de autenticidad, la cava digital y el sommelier virtual. Sin descargas, sin registros pesados."*

### Pregunta B: *"¿Esta etiqueta inteligente consume batería o emite radiación?"*
* **Respuesta:**
  > *"Absolutamente no. El chip es pasivo (no tiene batería propia). Solo se enciende durante una milésima de segundo cuando recibe la energía electromagnética que emite el celular al apoyarse. Es totalmente inocuo y seguro para el vino."*

### Pregunta C: *"¿Mi información personal y de ubicación está protegida?"*
* **Respuesta:**
  > *"Sí, cumplimos con los estándares más estrictos de privacidad. La geolocalización solo se solicita para validar que la firma criptográfica se haya realizado en un lugar geográficamente coherente y evitar copias del chip. No rastreamos tus movimientos diarios y tu identidad digital está resguardada de forma anónima on-chain."*

---

## 5. El "As bajo la manga" para la reunión en vivo

Cuando expongas ante el dueño de la bodega, seguí esta estructura de demostración:

1.  **Llevá dos botellas iguales:** Una con chip nexID y otra común con un código QR impreso.
2.  **Mostrá la debilidad del QR:** Pedile al dueño que escanee el QR de la botella común. Luego, sacale una foto con tu celular a ese QR y escanealo desde la pantalla de tu móvil. Decile: *"Vea, acabo de duplicar la identidad de su botella en un segundo"*.
3.  **Mostrá la fortaleza de nexID:** Pedile que apoye el celular en tu botella inteligente. Se abrirá el Portal nexID VIP mostrando la botella en 3D interactiva. 
4.  **Simulá el descorche:** Si es posible, abrí la botella nexID TagTamper (o rompe el circuito de muestra) y volvé a apoyarla. El celular mostrará una alerta roja: *"ATENCIÓN: Botella abierta el 12/06/2026. Sello violado"*.
5.  **Abrí tu notebook con el CRM:** Mostrale cómo su tap en Buenos Aires apareció en el mapa al instante con el score de riesgo en 0%. Decile: *"Si esta botella ahora viaja a Miami y alguien intenta duplicar el chip, el CRM le avisará a usted al instante. Usted tiene el control total"*.
