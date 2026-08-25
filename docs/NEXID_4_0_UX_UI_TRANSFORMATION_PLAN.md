# NexID 4.0 — Plan de transformación UX/UI y experiencia de producto

Estado: propuesta ejecutable para decisión

Fecha de referencia: 25 de agosto de 2026

Alcance: web pública, Demo Lab, superficies de producto relacionadas, sistema visual, accesibilidad y performance. Este documento no certifica Preview ni Producción.

## 1. Decisión ejecutiva

El feedback recibido es correcto: NexID transmite capacidad técnica, modernidad y seriedad, pero obliga a una persona nueva a procesar demasiados conceptos, rutas y advertencias antes de entender el valor de negocio.

La respuesta no es agregar más botones, más animaciones o más secciones visibles. La respuesta es:

1. reducir la cantidad de decisiones simultáneas;
2. expresar primero el resultado para el cliente;
3. separar recorridos comerciales, operativos, de consumidor y técnicos;
4. conservar la profundidad técnica mediante divulgación progresiva;
5. mostrar producto funcionando antes de explicar toda su arquitectura;
6. reemplazar el aspecto genérico de SaaS generado por IA por una dirección de arte propia;
7. reconstruir el sistema de UI para evitar que cada nueva funcionalidad vuelva a saturar la experiencia.

La hipótesis central de NexID 4.0 es:

> NexID convierte cada producto físico en un punto verificable de información, protección y relación con el cliente.

Las precisiones sobre evidencia NFC/SUN, datos declarados, límites físicos, ownership, Polygon, IOTA, offline, SDK y gobernanza deben seguir siendo rigurosas, pero no competir por atención en el primer pantallazo.

## 2. Evidencia de la auditoría actual

### 2.1 Web pública observada

Medición de la home pública a 1280 × 720 realizada el 25 de agosto de 2026:

- aproximadamente 1.903 palabras;
- 69 enlaces;
- 35 botones;
- 22 secciones o bloques principales;
- aproximadamente 10.775 px de altura;
- más de 40 elementos con animación CSS;
- alrededor de 18 rutas o acciones al desplegar navegación;
- cuatro CTAs diferentes en la zona hero de escritorio;
- mezcla de audiencias: comprador, integrador, consumidor, inversor, reseller y auditor.

El Demo Lab presenta aproximadamente 866 palabras, 35 enlaces y diez demos visibles. Funciona mejor como catálogo técnico que como primera experiencia para un comprador no técnico.

### 2.2 Evidencia del repositorio

- La portada canónica está concentrada en `apps/web/src/app/page.tsx`, con 530 líneas.
- La web pública tiene 44 páginas y el dashboard 62; no existe hoy un mapa actualizado que represente toda esa superficie.
- El menú móvil construye 16 destinos antes de sumar las acciones de ingreso y demo.
- `apps/web/src/components/landing-sections.tsx` tiene 1.919 líneas y contiene 20 secciones exportadas, además de simulaciones internas.
- `apps/web/src/app/globals.css` supera 53.000 líneas, 1,5 MB en fuente y contiene aproximadamente 6.744 usos de `!important`. Esto indica acumulación de estilos, especificidad creciente y alto costo de mantenimiento.
- Varias páginas críticas son monolíticas: Proof Verify supera 2.900 líneas, SUN 1.900, Docs 1.390 y Demo Lab 1.180.
- El cliente principal del Demo Lab supera 5.400 líneas y ronda 302 KB en fuente.
- Conviven `/demo`, `/demo-lab`, `/demo-sandbox` y otras demos dentro del dashboard, sin un selector canónico que explique cuál corresponde a cada audiencia.
- La landing ofrece simultáneamente formulario de demo, modal comercial, chat de ventas y helpbot contextual. En móvil, dos asistentes pueden competir por la misma zona inferior.
- No se encontraron Playwright, Cypress, axe, Lighthouse CI ni Storybook configurados como gates del producto actual.
- El hero actual combina gradiente de texto, vidrio translúcido, cyan, verde, violeta, badges, métricas, globo/escena, video y cuatro llamadas a la acción. Esa combinación explica la percepción de producto potente, pero también el aspecto de plantilla tecnológica saturada.
- La home servida puede mezclar contenido localizado con textos hardcodeados en español. Debe existir una única fuente de contenido por idioma y una prueba que impida mezclar ES, EN y PT-BR.

### 2.3 Clasificación de los requerimientos recibidos

| Requerimiento | Estado actual | Decisión 4.0 |
| --- | --- | --- |
| Credibilidad técnica y producto sofisticado | Completo, fortaleza | Preservar y concentrar en Trust Center, Developers y pruebas guiadas |
| Entender qué hace NexID en menos de 10 segundos | Faltante | Nueva propuesta de valor y prueba de comprensión |
| Ser claro para público no técnico | Parcial | Recorrido comercial por defecto, sin vocabulario de protocolo |
| Mantener profundidad para técnicos | Completo pero mal ubicado | Divulgación progresiva y portal Developers separado |
| Navegación simple | Faltante | Cinco categorías máximas y dos CTAs globales |
| Landing liviana | Faltante | Cinco bloques principales, no 22 |
| Demos entendibles | Parcial | Wizard guiado y laboratorio avanzado separado |
| Identidad visual propia, no “hecha con IA” | Parcial | Nueva dirección de arte, fotografía real y reglas anti-patrón genérico |
| Mejor funcionamiento integral | Parcial | Sistema compartido, contratos de interacción, QA y observabilidad |
| IA más barata | No resuelto por la promoción | Piloto medido; no cambiar el modelo masivo por Sol |

### 2.4 Benchmark visual y de comunicación

El patrón común entre Scantrust, Kezzler, atma.io, Certilogo, Digimarc, Arianee y Authentic Vision no es una librería visual concreta. Es la disciplina de la primera pantalla:

| Referente | Patrón útil | Aplicación a NexID |
| --- | --- | --- |
| Scantrust | Promesa directa, producto y UI móvil en una sola escena, selector de intención y prueba social | Mostrar un producto real, su resultado y una decisión inicial |
| Kezzler | Una frase editorial dominante, navegación corta y un solo CTA | Reducir vocabulario y usar una idea por viewport |
| atma.io | Categoría clara, fotografía de uso y plataforma explicada después | Humanizar el producto antes de mostrar infraestructura |
| Certilogo | El objeto físico es protagonista y `Check a code` es una acción inequívoca | Dar al tap/verificación una acción reconocible y simple |
| Digimarc | Titular orientado a resultado, navegación agrupada y demo como CTA principal | Hablar de protección/confianza antes de tecnologías |
| Arianee | Presentación premium del pasaporte y ownership | Reservar la capa premium para casos donde realmente aporta valor |
| Authentic Vision | Materialidad del producto y etiqueta como centro visual | Construir una firma visual basada en packaging real |

Lo que NexID no debe copiar:

- claims absolutos que excedan la evidencia disponible;
- páginas de marketing sin prueba técnica;
- métricas de escala ajenas;
- estética de competidor sin una identidad propia;
- simplificación que oculte límites físicos o de custodia.

La ventaja defendible de NexID puede ser combinar la claridad comercial de esos referentes con una frontera de evidencia más honesta y verificable.

### 2.5 Mapa competitivo ampliado

El mercado no es una sola categoría. Comparar a todos como si vendieran exactamente el mismo producto produciría decisiones incorrectas. Para NexID 4.0 se separan cuatro arenas competitivas y una capa de tecnologías habilitadoras:

| Arena | Plataformas observadas | Superposición con NexID | Lectura estratégica |
| --- | --- | --- | --- |
| Plataforma físico-digital integrada | Authena, QlikTag, Scantrust, Kezzler | identidad por ítem, NFC/QR, autenticación, trazabilidad, DPP, engagement y analítica | Competencia frontal. Authena y QlikTag son los comparables más cercanos por amplitud |
| Trazabilidad enterprise y compliance | atma.io/Avery Dennison, Circularise, Mojix/Seagull, TraceLink | GS1, EPCIS, DPP, integración industrial, datos de proveedores y compliance | Competencia en cuentas grandes; también posibles socios. No conviene reconstruir un WMS, PLM o network farmacéutico |
| Pasaporte, ownership y ciclo premium | Arianee, Aura Blockchain Consortium, Certilogo, Trust-Place | DPP, autenticidad, garantía, ownership, transferencia, reventa, postventa y experiencias | Competencia alta en lujo. Son referentes de lifecycle y consumer UX |
| Autenticación o carrier especializado | Systech/Markem-Imaje, Digimarc, Authentic Vision | huella de impresión, watermark/código, marcador físico, detección de copia y anti-diversion | Sustitutos parciales del NFC seguro; pueden ganar por costo o adaptación a una línea existente |
| Estándares y componentes, no competidores | NXP NTAG 424 DNA/TagTamper, GS1 Digital Link, EPCIS 2.0, normas DPP | chip seguro, URL resoluble, vocabulario de eventos e interoperabilidad | Son dependencias y vías de integración. NexID no debe presentarlos como tecnología propietaria |

#### Competidores prioritarios

| Plataforma | Fortaleza pública relevante | Riesgo para NexID | Respuesta recomendada |
| --- | --- | --- | --- |
| **Authena** | NFC, sellos físico-digitales, blockchain, geolocalización, sensores ambientales, trazabilidad, condition monitoring, alertas y DPP | Muy alto en farma, alimentos, bebidas y operaciones con sensores | Competir con claridad, evidencia auditable, despliegue LATAM y arquitectura vendor-neutral; tratar sensórica real como brecha hasta tener hardware probado |
| **QlikTag** | NTAG 424 DNA, GS1 Digital Link, tokenización on/off-chain, ownership, APIs, RBAC, analítica, encoder y diseñador no-code | Muy alto; es el comparable funcional más cercano | Adoptar su claridad de flujo y onboarding, no sus claims absolutos; productizar API/SDK y evaluar encoder/plantillas como integración, no como promesa inmediata |
| **Scantrust** | QR seguro, autenticación sin app, alertas, trazabilidad, e-label/DPP y engagement | Alto en bienes masivos donde NFC es demasiado costoso | Ofrecer una escalera explícita por riesgo y costo: QR/GS1 para identidad; NFC seguro cuando el caso exige mayor resistencia |
| **Kezzler** | IDs serializados, eventos de producto/lote, GS1/EPCIS, DPP, manufacturing y smart packaging | Alto en trazabilidad + compliance + engagement enterprise | Integrar por estándares y diferenciar el recorrido de verificación/ownership, sin imitar toda su suite de supply chain |
| **atma.io / Avery Dennison** | Connected Product Cloud, QR/NFC/RFID/BLE, DPPaaS, GS1 y alcance físico global | Muy alto por escala, etiquetas, consultoría y distribución | Posicionar NexID como opción más ágil, modular y vendor-neutral; no competir en fabricación global de etiquetas |
| **Systech / Markem-Imaje** | e-Fingerprint sobre códigos impresos existentes, serialización y línea de packaging | Alto en farma y CPG porque evita agregar un tag | Mantener arquitectura multi-carrier y admitir integración; no afirmar que NFC es siempre la respuesta correcta |
| **Digimarc** | Product Cloud, GS1 Digital Link, watermarks/códigos y carriers impresos | Alto donde el packaging impreso y la escala pesan más que SUN/SDM | Diferenciar niveles de evidencia y permitir carriers alternativos mediante adaptadores |
| **Arianee** | DPP, ownership, transferencia, reparación, reventa y portal white-label | Muy alto en lujo y experiencia posterior a la compra | Usarlo como benchmark del ciclo de vida; diferenciar con operación multi-tenant y offline verificable sólo cuando exista prueba completa |
| **Aura Blockchain Consortium** | DPP de lujo, claim/transferencia, e-warranty, digital twins y respaldo institucional | Alto en grandes marcas de lujo | No competir por logos; ofrecer capa operativa interoperable y una frontera precisa entre dato, evidencia y propiedad |
| **Circularise** | Trazabilidad de materiales, intercambio selectivo de datos, DPP y compliance industrial | Medio/alto en materiales, químicos y cadenas multiactor | Priorizar integración/partnership. NexID puede aportar identidad, tap y experiencia de consumidor sobre esa profundidad regulatoria |
| **Mojix / Seagull** | EPCIS, RFID/QR, CTE/KDE, captura móvil y conexión entre etiquetas y eventos | Alto en trazabilidad operativa enterprise | Consumir y emitir EPCIS; no convertir NexID en WMS o plataforma de inventario generalista |
| **TraceLink** | Network farmacéutica, serialización, DSCSA, EPCIS, recalls y trading partners | Alto sólo en life sciences regulado de gran escala | No competir frontalmente; integrar datos y concentrarse en NFC, evidencia y experiencia de producto |

No se cuentan como rivales independientes marcas ya integradas: Scanbuy Smart Packaging forma parte de Kezzler; EVRYTHNG forma parte de Digimarc; Mojix forma parte de Seagull Software y Systech se comercializa dentro del ecosistema Markem-Imaje.

### 2.6 Authena y QlikTag: qué aprender y qué no copiar

Authena compite muy directamente cuando el comprador busca autenticación, trazabilidad, integridad y monitoreo físico en una sola contratación. Su combinación de NFC, IoT, sensores, alertas y dashboard muestra una brecha real de NexID: no se debe vender condition monitoring productivo mientras no existan dispositivos, calibración, ingestión y evidencia operacional verificadas.

QlikTag compite todavía más cerca de la arquitectura NexID: producto serializado, GS1 Digital Link, NTAG 424 DNA, experiencia web sin app, modelo de datos, roles, APIs, analítica, ownership y tokenización. Su mayor lección comercial es el flujo visible `Digitalize → Tokenize → Design → Embed → Encode → Activate`. NexID debe traducir su producto a un conjunto aún más corto de tareas:

1. `Crear identidad`;
2. `Codificar`;
3. `Verificar`;
4. `Rastrear`;
5. `Transferir`;
6. `Auditar`.

Esas tareas pertenecen a la consola y a los recorridos de producto, no todas al hero. La landing debe mostrar sólo `Conectar → Verificar → Activar una experiencia` y revelar el resto al avanzar.

Ni Authena ni QlikTag deben copiarse como sistema visual completo. Sus webs actuales también acumulan contenido, logos y claims. Son benchmark de capacidades y empaquetado; para densidad, jerarquía y ritmo visual son mejores referencias las primeras pantallas de Scantrust, Kezzler, atma.io, Certilogo y Arianee.

Los claims publicados por cada proveedor se tratan como declaraciones comerciales de su propia web, no como validación independiente de seguridad, escala o conformidad.

### 2.7 Matriz de capacidades NexID frente al mercado

Esta matriz es interna y no debe trasladarse completa a la landing. `Demostrado en repositorio` significa que existe un flujo persistente, rutas y pruebas focales; no equivale a Producción verificada. No se ejecutaron esas suites durante esta auditoría documental.

| Capacidad NexID | Estado comprobable actual | Referentes competitivos | Decisión 4.0 |
| --- | --- | --- | --- |
| QR / GS1 Digital Link | **Parcial**: resolver, registro tenant-scoped, API pública y base GS1/EPCIS; sin despliegue o certificación GS1 confirmados | QlikTag, Scantrust, Kezzler, atma.io | Mantener como entrada de bajo costo y cerrar interoperabilidad antes de hacer claim de conformidad |
| NFC / SUN / TagTamper | **Parcial fuerte**: servicio, persistencia, UI y suite amplia; falta ceremonia física completa y certificación de hardware | Authena, QlikTag | Producto central `Verify`; separar criptografía válida de origen, contenido, adhesión y apertura física |
| DPP / Passport | **Parcial**: passport consumidor/operativo y un perfil vertical; modelo canónico aún no coincide íntegramente con eventos históricos | atma.io, Circularise, Kezzler, Arianee, Aura | Unificar modelo de eventos, resolver requisitos regulatorios por categoría y retirar el claim genérico de “DPP completo” |
| Traceability / EPCIS | **Parcial**: captura, consulta, export y perfil EPCIS acotado; sin certificación ni tráfico productivo verificado | Kezzler, Mojix, TraceLink, Circularise | Ser interoperable y auditable; no intentar sustituir ERP/WMS/PLM |
| Anti-counterfeit / riesgo | **Parcial**: replay, SUN, tamper y anomalías alimentan scoring determinista | Scantrust, Systech, Authentic Vision | Presentar `señal de riesgo` y evidencia, nunca una sentencia universal de falsificación |
| Loyalty / CRM / garantía | **Demostrado en repositorio**: programas, miembros, ledger, recompensas, redenciones, CRM base y garantía | QlikTag, Trust-Place, Arianee | Convertirlo en valor post-tap visible; falta prueba de tenant comercial, fulfilment y campañas externas productivas |
| Ownership / marketplace / reventa | **Parcial**: ownership durable, claims, catálogo y listing P2P; compra secundaria no liquida pago ni transfiere NFT | QlikTag, Arianee, Aura, Certilogo | Mostrar claim y lifecycle; no vender settlement de reventa hasta completar pago, transferencia y disputas |
| Polygon / IOTA | **Demo/testnet real**: transacciones y verificadores públicos documentados | QlikTag, Arianee, Aura | Ofrecer como trust layers opcionales; no presentarlo como mainnet, propiedad legal o producción enterprise |
| Offline de campo | **Parcial**: captura, bundles y sync; la verificación criptográfica SUN/SDM nativa completa todavía no ocurre en dispositivo | Arianee y soluciones industriales | Mantener veredictos locales provisionales y convertir offline criptográfico en diferencial sólo tras threat model y prueba física |
| SDK / API / webhooks | **Parcial fuerte**: SDK tipado, OpenAPI, AsyncAPI, outbox y firmas; paquete privado y sin canary E2E de cliente productivo | QlikTag, Kezzler, Circularise | Publicar developer experience gradual, quickstart y sandbox verificable |
| Multi-tenant / reseller | **Parcial fuerte**: onboarding, RBAC, aislamiento y rol reseller; falta control plane completo, white-label y billing delegado | QlikTag, plataformas enterprise | Terminar tareas de operador antes de promover un programa reseller completo |
| Sensores / condition monitoring | **Parcial experimental**: existen contratos/eventos relacionados, no evidencia de flota física operacional | Authena, atma.io/Wiliot | Integrar hardware probado o partner; no construir ni prometer una plataforma IoT completa en esta fase |
| Diseñador no-code y encoder | **Faltante como producto terminado** | QlikTag | Investigar luego del core UX; comenzar con plantillas verticales y proceso de encoding gobernado |
| IA | **Parcial**: inferencia real en algunos flujos y simulación/reglas en otros, sin capa unificada de evaluación | suites enterprise con copilots | Renombrar superficies simuladas, centralizar evaluaciones y usar IA sólo donde el resultado sea medible |

### 2.8 Posicionamiento competitivo recomendado

NexID no debe presentarse como “la plataforma que hace todo”. Esa amplitud es precisamente lo que hoy dificulta entenderla.

La posición defendible es:

> **Identidad y evidencia verificable para productos físicos, con experiencias útiles después de cada tap o scan.**

La arquitectura comercial se expresa en tres capas:

1. **Conectar:** identidad por QR/GS1 o NFC según costo y riesgo;
2. **Verificar y operar:** evidencia, riesgo, eventos y trazabilidad;
3. **Activar valor:** pasaporte, garantía, loyalty, ownership y postventa.

Polygon, IOTA, offline, SDK, EPCIS y sensórica aparecen como capacidades opcionales o técnicas, no como seis propuestas de valor simultáneas.

La ventaja buscada no es tener más tarjetas que QlikTag o Authena. Es hacer que NexID sea más fácil de comprar, desplegar, demostrar y auditar en mercados donde los líderes globales resultan pesados o poco adaptados, sin sacrificar estándares ni honestidad técnica.

## 3. Principios de producto 4.0

### 3.1 Una pantalla, una decisión principal

Cada pantalla debe responder:

- qué está viendo la persona;
- por qué le importa;
- cuál es la siguiente acción recomendada;
- dónde ampliar el detalle si lo necesita.

No debe haber tres o cuatro CTAs con jerarquía visual equivalente.

### 3.2 Resultado antes que mecanismo

Orden de comunicación:

1. resultado para el cliente;
2. ejemplo visible;
3. cómo funciona en tres pasos;
4. evidencia y límites;
5. arquitectura técnica.

No comenzar por SUN, SDM, TT, blockchain, hash-only, KMS o RBAC. Esos términos se revelan cuando la persona pide detalle.

### 3.3 Profundidad progresiva

La simplificación no puede degradar la honestidad técnica. Cada claim importante tendrá tres capas:

- capa simple: qué resultado obtiene la persona;
- capa de evidencia: qué se valida y qué no se valida;
- capa técnica: protocolo, API, threat boundary y prueba verificable.

### 3.4 Una experiencia por audiencia

Las superficies deben dejar de mezclar recorridos:

- empresa o marca: valor, casos, rollout y demo;
- operaciones: lotes, riesgo, alertas y trazabilidad declarada;
- consumidor: tap, resultado, pasaporte, garantía y beneficios;
- desarrollador: API, SDK, webhooks, contratos y sandbox;
- auditor o seguridad: Proof, Trust Center, arquitectura y límites.

### 3.5 Verdad demostrable

- Nunca presentar simulación como tracción, cliente o métrica productiva.
- Identificar claramente `Demo`, `Simulado`, `Preview` o `Evidencia pública verificada`.
- No convertir un resultado de mensaje NFC/SUN en veredicto sobre contenido, origen o custodia física.
- No usar logos, cifras o testimonios sin autorización y fuente verificable.

## 4. Arquitectura de información objetivo

### 4.1 Navegación global

Máximo cinco categorías visibles en desktop:

1. **Producto**
   - Cómo funciona
   - Verificación y riesgo
   - Pasaporte y postventa
   - Operación y analítica
2. **Soluciones**
   - Marcas premium
   - Agro y alimentos
   - Vinos y bebidas
   - Belleza y lujo
   - Eventos y acceso
   - Logística e industria
3. **Demo**
   - Demo guiada
   - Experiencia consumidor
   - Demo Lab avanzado
4. **Recursos**
   - Casos y pilotos verificables
   - Trust Center
   - Proof Verify
   - Precios
5. **Developers**
   - Docs
   - API y SDK
   - Sandbox
   - Estado del servicio

Acciones globales:

- primaria: `Ver demo`;
- secundaria: `Hablar con ventas`;
- utilitaria, sin competir visualmente: `Ingresar`.

En móvil no se mostrarán 16 enlaces planos. Se usarán las cinco categorías como acordeones y un dock con una sola acción primaria.

### 4.2 Mapa de rutas propuesto

| Ruta | Objetivo | Audiencia | Profundidad |
| --- | --- | --- | --- |
| `/` | comprender y elegir siguiente paso | comprador no técnico | baja |
| `/product` | entender la plataforma de extremo a extremo | comprador y operador | media |
| `/solutions/[vertical]` | ver un caso coherente por industria | negocio | media |
| `/demo` | completar una historia guiada de 60–90 s | todos | baja |
| `/demo/lab` | explorar escenarios y herramientas avanzadas | técnico y preventa | alta |
| `/consumer` | experimentar el flujo posterior al tap | consumidor y marca | baja |
| `/trust` | entender evidencia, límites y controles | seguridad y auditoría | alta |
| `/developers` | integrar API, SDK y webhooks | desarrollador | alta |
| `/proof` | verificar evidencia pública | auditor y cliente | especializada |
| `/pricing` | elegir piloto o pedir cotización | comprador | media |

Las rutas existentes no se eliminan de golpe. Se crea una matriz `ruta actual → ruta objetivo → redirect/canonical → propietario → prueba` para preservar SEO, enlaces compartidos y contratos públicos.

## 5. Landing 4.0

Objetivo: una persona nueva debe poder explicar qué hace NexID después de diez segundos y elegir una acción sin conocer NFC, blockchain o trazabilidad.

La home tendrá cinco bloques principales:

### Bloque 1 — Hero

- una promesa;
- una frase de apoyo, máximo dos líneas;
- un CTA primario y uno secundario;
- una visual real de producto/tap/interfaz, no un collage de dashboards;
- un enlace discreto `Qué verifica exactamente`.

Propuesta de copy inicial:

> **Cada producto puede demostrar más y vender mejor.**
>
> NexID conecta NFC o QR con evidencia verificable, información del producto, garantía y postventa, sin exigir una app al comprador.

CTAs:

- `Ver cómo funciona`;
- `Hablar de un piloto`.

El copy debe validarse con compradores reales. No se congela por preferencia interna.

### Bloque 2 — Flujo en tres pasos

Una animación narrativa controlada:

1. la marca conecta el producto;
2. el cliente toca o escanea;
3. NexID muestra evidencia y habilita la acción permitida.

La explicación técnica se abre mediante `Ver evidencia y límites`, sin ocupar el recorrido principal.

### Bloque 3 — Valor por rol

Tres tabs, no una pared de tarjetas:

- Marca: protección, relación directa y postventa;
- Operaciones: lotes, alertas y eventos declarados;
- Cliente: información, garantía y beneficios.

### Bloque 4 — Demo de un caso

Mostrar un solo escenario por defecto, por ejemplo una botella premium. Un selector permite cambiar de vertical sin renderizar once industrias simultáneamente.

### Bloque 5 — Prueba y conversión

- evidencia pública o controles reales, sin métricas inventadas;
- logos sólo con autorización;
- vínculo al Trust Center;
- CTA final único: `Diseñar un piloto`.

El footer contiene la navegación extensa, datos fiscales y recursos institucionales. La certificación MiPyME y los enlaces fiscales no compiten con la propuesta de valor principal.

## 6. Demo 4.0

### 6.1 Demo guiada para público general

Wizard de tres pasos:

1. elegir producto o industria;
2. simular tap/scan;
3. ver resultado y siguiente acción.

Requisitos:

- comenzar en menos de un clic;
- completarse en 60–90 segundos;
- lenguaje simple por defecto;
- estado `Simulado` permanente y visible;
- una sola historia coherente;
- al final, elegir `Ver detalle técnico`, `Probar otro caso` o `Hablar de un piloto`.

### 6.2 Demo Lab avanzado

El laboratorio conserva la profundidad actual, pero se organiza por tarea:

- verificar;
- codificar;
- explorar prueba pública;
- probar offline;
- revisar cadena o ownership;
- integrar API/SDK.

No se muestran diez demos con el mismo peso. Se usa búsqueda, categorías y un estado `Recomendado para vos` basado en la ruta de entrada, no en perfilado opaco.

### 6.3 Producto operativo

El dashboard y portales deben compartir patrones:

- navegación por trabajo, no por tecnología;
- vistas resumen con expansión al detalle;
- empty states que enseñan la próxima acción;
- filtros persistentes y visibles;
- estados de validación consistentes;
- errores accionables;
- separación explícita entre dato declarado, evidencia observada e inferencia;
- mismo vocabulario en web, dashboard, docs y API.

## 7. Dirección visual: profesional y no genérica

### 7.1 Qué retirar

- gradientes de texto como recurso permanente;
- glassmorphism en toda tarjeta;
- paleta cyan + violeta + verde compitiendo a la vez;
- emojis como iconografía de navegación empresarial;
- badges y métricas decorativas sin necesidad;
- filas de cards idénticas;
- mapas, globos y partículas antes de comprender el producto;
- copy con anglicismos innecesarios o frases de pitch genéricas;
- animaciones de entrada en cada elemento.

### 7.2 Dirección recomendada

- base clara o neutra para lectura y confianza, con secciones oscuras sólo cuando aporten contraste;
- una paleta de marca principal y colores semánticos reservados para estados;
- tipografía de alta legibilidad con una voz editorial propia;
- fotografía y video reales de producto, tag, envase y uso humano;
- macrofotografía, materialidad y detalle industrial como firma de marca;
- diagramas simples, con datos y fuentes claros;
- iconografía consistente, sin mezclar emoji, outline, 3D y pictograma;
- espacios amplios y jerarquía tipográfica fuerte;
- una animación distintiva del tap como activo reconocible de NexID.

### 7.3 Motion system

- microinteracciones: 160–240 ms;
- cambios de sección o estado: 320–500 ms;
- narrativa principal: máximo 700–900 ms por transición;
- movimiento sólo para explicar estado, relación o causalidad;
- `prefers-reduced-motion` obligatorio;
- sin scroll hijacking;
- sin parallax en móvil de gama media;
- sin animar layout cuando perjudique INP o lectura.

La librería no es la solución principal. Se recomienda:

- CSS moderno para estados simples;
- Motion para transiciones, presencia y gestos;
- Radix Primitives o una base equivalente para menú, dialog, tabs, tooltip y accordion accesibles;
- Embla sólo si un carrusel aporta comprensión;
- Three.js únicamente para una escena insignia, cargada de forma diferida y con fallback estático;
- evitar sumar GSAP, Rive o Lottie hasta demostrar una necesidad que Motion/CSS no cubran.

## 8. Sistema de diseño y arquitectura frontend

### 8.1 Fundación

Crear tokens versionados para:

- color de marca y estados;
- tipografía y escala fluida;
- spacing;
- radios;
- sombras;
- motion;
- breakpoints;
- focus ring;
- densidad de datos.

### 8.2 Componentes mínimos

- Header y mega-menu;
- Mobile navigation;
- Button y link action;
- Section intro;
- Tabs;
- Accordion técnico;
- Evidence status;
- Product story;
- Demo stepper;
- Case study;
- CTA band;
- Form;
- Toast, error y empty state;
- Data table y filter bar;
- Skeleton y progressive loading.

Cada componente debe tener estados default, hover, focus, active, disabled, loading, error, empty y reduced-motion cuando aplique.

### 8.3 Desacople técnico

- dividir `page.tsx` en composición declarativa y secciones pequeñas;
- retirar copy inline y hardcodeado;
- usar esquemas tipados de contenido por locale;
- fraccionar `globals.css` por tokens, base, layout, componentes y superficies;
- impedir nuevos estilos globales de página salvo tokens y reset;
- extraer páginas monolíticas en server components, islands interactivas y modelos de vista;
- lazy-load de mapas, globos, video y 3D después del contenido principal;
- establecer budget de dependencias y bundle por ruta;
- no mezclar la migración visual con un upgrade masivo de framework en el mismo release.

## 9. Localización, contenido y tono

- ES, EN y PT-BR usan el mismo esquema de campos y cobertura.
- Ningún texto visible queda hardcodeado en componentes compartidos.
- Prueba automática contra mezcla de idiomas en rutas públicas.
- Glosario editorial único para `tap`, `scan`, `verificación`, `evidencia`, `dato declarado`, `TT`, `ownership` y `prueba pública`.
- Regla de copy: una frase expresa una idea; títulos orientados a resultado; detalle técnico en acordeón o página propia.
- Revisión humana de todo copy público para retirar muletillas de IA, superlativos sin prueba y traducciones literales.

## 10. Plan de ejecución

### Fase 0 — Seguridad, baseline y medición (2–3 días)

Entregables:

- rotación de credenciales locales expuestas durante la auditoría;
- ampliación del secret scanner para formatos actuales de proveedores externos;
- inventario de rutas, CTAs, audiencias, idiomas y analytics;
- baseline de Core Web Vitals, bundle, accesibilidad y conversión;
- matriz de claims con fuente, owner y superficie permitida;
- captura visual desktop y móvil de las rutas críticas.

Gate: no publicar Preview ni Producción con credenciales pendientes de rotación.

### Fase 1 — Arquitectura y prototipo (4–5 días)

Entregables:

- sitemap 4.0;
- navegación desktop/móvil;
- wireframes de home, demo y product hub;
- copy ES de primer nivel;
- prueba de comprensión con al menos cinco personas no técnicas y tres técnicas;
- decisión visual entre dos direcciones de arte, evaluada en pantallas reales.

Gate: 80% de participantes explica correctamente qué hace NexID después de diez segundos.

### Fase 2 — Design system y shell (5–7 días)

Entregables:

- tokens y primitives;
- header, mega-menu, mobile navigation y footer;
- tipografía, grid, formularios y status system;
- Storybook o catálogo equivalente;
- reglas de motion y reduced-motion;
- primeras pruebas visuales y de teclado.

Gate: cero defectos críticos/serios de accesibilidad en componentes base.

### Fase 3 — Home 4.0 (5–7 días)

Entregables:

- cinco bloques principales;
- un hero liviano;
- una historia de producto;
- prueba y límites progresivos;
- localización completa;
- SEO, metadata, canonical y redirects preservados;
- instrumentación de CTAs y embudo.

Gate: LCP móvil p75 menor a 2,5 s, INP menor a 200 ms, CLS menor a 0,1 y cero mezcla de idiomas.

### Fase 4 — Demo guiada y Lab (5–7 días)

Entregables:

- wizard de tres pasos;
- un caso insignia;
- selector por industria;
- Lab reorganizado por tarea;
- handoff coherente a ventas, docs o prueba pública;
- etiquetas de simulación persistentes.

Gate: al menos 80% completa la demo sin ayuda en menos de 90 segundos.

### Fase 5 — Producto, Trust y Developers (7–10 días)

Entregables:

- shell compartido para dashboard y portales;
- migración de las tareas de mayor frecuencia;
- Trust Center;
- Developers hub;
- Proof/SUN simplificados en superficie y completos en evidencia;
- glossary y docs alineados con el vocabulario del producto.

Gate: cinco tareas críticas completables por teclado y móvil, con estados DOM y visuales coherentes.

### Fase 6 — Release controlado (3–5 días)

Entregables:

- build y suites focales;
- pruebas visuales responsive;
- axe/WCAG 2.2 AA;
- Lighthouse CI y budgets;
- smoke en Preview con UI → API → DB donde corresponda;
- despliegue canary, monitoreo y rollback por SHA;
- promoción a Producción sólo con evidencia independiente.

Duración estimada: cinco a siete semanas para una transformación completa, con incrementos visibles semanales. Una home nueva aislada puede llegar a Preview antes, pero no debe presentarse como cierre 4.0.

## 11. Métricas de éxito

### Comprensión

- al menos 80% responde correctamente `qué hace NexID`, `para quién` y `qué hago después` tras diez segundos;
- menos de 20% confunde evidencia digital con autenticidad física completa;
- cero términos técnicos no explicados en el recorrido comercial principal.

### Navegación

- máximo cinco categorías globales;
- máximo dos CTAs de venta visibles con jerarquía clara;
- reducción de enlaces visibles en home superior al 50%;
- task success mayor al 85% para demo, pricing, docs e ingreso.

### Conversión

- CTA principal del hero;
- inicio y finalización de demo;
- solicitud de piloto cualificada;
- tiempo hasta primera interacción útil;
- abandono por paso y por viewport.

### Calidad

- WCAG 2.2 AA;
- cero issues axe críticos o serios en rutas objetivo;
- Web Vitals dentro de `good` en p75 móvil;
- cero mezcla de locales;
- cero claims sin fuente;
- cero simulaciones presentadas como datos reales.

## 12. Estrategia de ramas y releases

- rama aislada con prefijo `codex/`;
- un incremento visual por Preview;
- no mezclar el refactor global de CSS, la home y el Demo Lab en un solo deploy;
- mantener redirects y contratos públicos;
- usar feature flags cuando una migración visual necesite convivencia temporal;
- registrar SHA exacto, URL de Preview, suite ejecutada y evidencia de smoke;
- promover una sola versión a Producción por vez;
- rollback explícito por SHA y flags.

## 13. Primer incremento recomendado

Nombre: `NexID 4.0 Foundation + Home Slice`.

Incluye:

1. rotación y scanner de secretos;
2. inventario y baseline;
3. tokens visuales mínimos;
4. nueva navegación de cinco categorías;
5. hero de una promesa y dos CTAs;
6. flujo de tres pasos;
7. un caso de producto;
8. Trust teaser y CTA final;
9. localización ES/EN/PT-BR completa;
10. Preview verificable con pruebas visuales, teclado, mobile y performance.

No incluye todavía:

- migración completa del dashboard;
- rediseño integral de Proof/SUN;
- eliminación masiva de estilos legacy;
- cambios de proveedor o infraestructura ajenos a UX/UI;
- promoción automática a Producción.

Este corte permite validar la nueva dirección con usuarios y socios antes de trasladarla a toda la plataforma.

## 14. Fuentes de referencia

- Authena: [autenticación, trazabilidad, IoT y DPP](https://authena.io/)
- QlikTag: [plataforma, NFC seguro y experience designer](https://qliktag.com/product/)
- Scantrust: [anti-counterfeit](https://www.scantrust.com/anti-counterfeit-solutions/)
- Kezzler: [plataforma](https://kezzler.com/) y [actualización 2026](https://kezzler.com/whats-new-on-our-platform-q1-2026/)
- atma.io / Avery Dennison: [Connected Product Cloud](https://www.atma.io/)
- Systech: [brand protection](https://www.systechone.com/solutions/brand-protection/)
- Digimarc: [GS1 Digital Link](https://www.digimarc.com/use-cases/GS1-Digital-Link)
- Arianee: [plataforma](https://www.arianee.com/en/platform)
- Aura Blockchain Consortium: [soluciones](https://auraconsortium.com/solutions) y [límites/integración](https://auraconsortium.com/support)
- Circularise: [DPP y compliance ESPR](https://www.circularise.com/dpp-for-espr)
- Mojix: [product traceability](https://www.mojix.com/solutions/product-traceability)
- TraceLink: [network y EPCIS](https://www.tracelink.com/supply-chain-orchestration/life-sciences-company/wholesale-distributor)
- Trust-Place: [postventa, ownership y DPP](https://www.trust-place.com/fr)
- GS1: [Digital Link](https://www.gs1.org/standards/gs1-digital-link) y [EPCIS](https://www.gs1.org/standards/epcis)
- NXP: [NTAG 424 DNA y TagTamper](https://www.nxp.com/products/rfid-nfc/nfc-hf/ntag-for-tags-labels/ntag-424-dna-424-dna-tagtamper-advanced-security-and-privacy-for-trusted-iot-applications:NT4H2421Gx)
- Comisión Europea: [Digital Product Passport](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en)
