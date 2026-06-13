"use client";

import React, { useState, useRef, useEffect } from "react";
import * as THREE from "three";
import { 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Download, 
  Cpu, 
  ShieldCheck, 
  Award, 
  TrendingUp, 
  Database,
  Smartphone,
  Layers,
  HelpCircle,
  QrCode,
  Lock,
  ArrowRight,
  Bot,
  Zap,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Coins,
  Volume2,
  VolumeX,
  RefreshCw,
  Gift,
  HelpCircle as HelpIcon,
  BookOpen,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@product/ui";

// Multi-market FAQs object
const faqCategories = [
  {
    id: "bodegas",
    label: "Bodegas",
    icon: Award,
    items: [
      {
        q: "¿El chip NFC nexID encarece el costo unitario por botella y reduce mi margen en líneas de volumen? ¿Realmente lo necesito?",
        a: "Seamos totalmente directos: sí. En líneas de volumen de gama media o baja, un costo adicional de 1.00 USD por botella (en chip NTAG/TagTamper) destruye el margen comercial. Esta tecnología no es para consumo masivo local. Sin embargo, en tus líneas de exportación y alta gama, no adoptarla es un riesgo existencial: la Unión Europea está implementando el Pasaporte Digital de Productos (DPP bajo la ley ESPR) y EE.UU. endurece la trazabilidad con la FDA FSMA 204. Las bodegas que sigan usando etiquetas de papel tradicionales quedarán fuera del mercado internacional. Ser los innovadores que lideran esta transición en LATAM no es un costo de embalaje: es la llave de entrada obligatoria al mercado de exportación global, permitiéndote además cobrar un sobreprecio por la autenticidad certificada.",
        ctx: "Ser el primer exportador de tu región en cumplir digitalmente con las normativas de la UE te posiciona como socio estratégico preferente frente a los importadores europeos, quienes prefieren bodegas con trazabilidad de origen 100% automatizada."
      },
      {
        q: "¿Qué pasa si un falsificador inyecta vino barato con una jeringa ultra-fina a través del corcho sin tocar la cápsula ni el chip? ¿El sistema no da un falso positivo de autenticidad?",
        a: "Es una verdad incómoda: un ataque quirúrgico con micro-jeringa directo al corcho sin alterar la cápsula exterior no puede ser detectado físicamente por un sensor electrónico, ya que el chip no mide la composición química del líquido en tiempo real. Cualquiera que te diga lo contrario te está mintiendo. Sin embargo, nexID neutraliza el fraude a escala comercial: primero, porque rellenar artesanalmente botella por botella con jeringa es económicamente inviable para el crimen organizado a gran escala; segundo, porque el circuito TagTamper detecta cualquier rotura física al girar la cápsula; y tercero, si la botella viaja al mercado gris, nuestra telemetría de geolocalización detecta escaneos anómalos (por ejemplo, el mismo chip leído en Londres y Shanghái a la vez), alertando a tu equipo de inmediato.",
        ctx: "La seguridad perfecta no existe, pero nexID eleva tanto la barrera de entrada y el costo para el falsificador que el fraude deja de ser rentable, protegiendo la reputación y la prima de precio de tu marca en mercados internacionales de alta gama."
      },
      {
        q: "¿La integración del chip en la línea de producción va a ralentizar mi embotellado automatizado o requerir nueva maquinaria costosa?",
        a: "Cualquier cambio en la línea física de embotellado genera fricción inicial y es incómodo para el equipo de operaciones. Sí, al principio requiere calibración. Pero no es necesario rediseñar tu maquinaria: trabajamos en conjunto con las imprentas de etiquetas para integrar el inlay NFC directamente en la etiqueta autoadhesiva o cápsula antes de que llegue a tu bodega. Esto significa que la botella se etiqueta al mismo ritmo de siempre. La única adición es el arco de lectura/aprovisionamiento al final de la línea para registrar los chips en la base de datos, lo cual se automatiza con nuestros SDKs industriales.",
        ctx: "Un proceso automatizado y certificado bajo estándares internacionales de trazabilidad digital reduce los tiempos de aduana e inspección en los puertos de destino, ya que la documentación de origen está vinculada criptográficamente al chip."
      },
      {
        q: "¿Qué pasa si los servidores de nexID se caen y el consumidor en Europa escanea la botella y da error? ¿No daña eso la reputación de mi bodega?",
        a: "Sí, absolutamente. Si un consumidor premium en un restaurante exclusivo escanea el vino y el sistema no responde, la experiencia de marca es un fracaso total. Es un riesgo real en cualquier infraestructura digital. Para evitar esto, en nexID implementamos redundancia geográfica múltiple en la nube (AWS y Render) con copias de seguridad locales y CDN perimetral. Además, cada chip nexID posee una firma criptográfica offline estática pregrabada. Si el servidor no está accesible, la app web realiza una validación criptográfica local en el dispositivo del cliente garantizando que el chip es auténtico, incluso sin conexión a internet.",
        ctx: "La resiliencia tecnológica es parte de nuestro acuerdo de nivel de servicio (SLA) para B2B. Ser pioneros en implementar trazabilidad digital de contingencia demuestra el nivel de profesionalismo de tu bodega ante los distribuidores de todo el mundo."
      },
      {
        q: "¿Qué pasa si un falsificador simplemente despega la etiqueta con el chip (sin material VOID) y la pega en una botella falsa? ¿Cómo justifica nexID la inversión en este escenario?",
        a: "Es una objeción crítica. Si el material no es auto-destructivo (VOID), despegarlo intacto es sumamente difícil: el adhesivo acrílico de alta cohesión sobre vidrio curvo rompe el filamento de aluminio de la antena NFC en el 90% de los intentos, dejando el chip inoperativo. Pero si buscas seguridad física total, ofrecemos como opcional de setup etiquetas con adhesivo destructible de transferencia o tipo 'tatuaje' (VOID Tamper-Evident), que se pueden solicitar fácilmente a proveedores globales. Aunque incrementan levemente el costo unitario, al intentar despegarlas dejan un patrón de residuo físico 'tatuado' en el vidrio que evidencia visualmente la manipulación y destruye la antena. Si optas por tags estándar sin VOID, nexID lo resuelve cruzando telemetría en la nube: comparamos despachos oficiales con lecturas geográficas en destino, alertando de inmediato ante cualquier desvío de canal o intento de reutilización.",
        ctx: "La base de datos de exportaciones sincroniza las lecturas de aduana con las del consumidor final en tiempo real. Así, la bodega sabe exactamente qué porcentaje del lote llegó al destino correcto y detecta desvíos de canal sin depender exclusivamente de la seguridad física del envase."
      }
    ]
  },
  {
    id: "cosmetica",
    label: "Cosmética",
    icon: Sparkles,
    items: [
      {
        q: "¿El adhesivo o la antena NFC pueden reaccionar químicamente con mi perfume o crema en caso de micro-fugas, arruinando la fórmula?",
        a: "Es una preocupación crítica y totalmente válida de los directores de control de calidad. Las fragancias y cosméticos de lujo contienen disolventes y aceites esenciales que pueden degradar adhesivos comunes y provocar la liberación de compuestos químicos no deseados. Por eso, en nexID no pegamos chips genéricos de bajo costo en el interior del envase. Diseñamos inlays externos ultra-delgados que se aplican bajo la etiqueta frontal o en la base exterior del frasco, o bien integrados herméticamente en la tapa plástica o de aleación de aluminio. Además, todos nuestros adhesivos acrílicos son inertes y cumplen con las normativas internacionales de seguridad y la regulación REACH de la Unión Europea.",
        ctx: "El estricto cumplimiento de la normativa REACH y ANMAT asegura que la incorporación de la tecnología no interfiera con la homologación dermatológica o química de tus productos en ningún país del mundo."
      },
      {
        q: "¿Colocar un microchip NFC no arruinará el diseño visual minimalista e impecable de mis envases de cosmética de lujo?",
        a: "Un chip visible o un relieve tosco destruye el atractivo visual y la sofisticación que vende la cosmética de lujo. Si colocáramos etiquetas gruesas con chips estándar, tus diseñadores rechazarían el proyecto de inmediato. La respuesta es la invisibilidad: nuestros inlays nexID tienen un grosor de solo 150 micras (más delgado que un cabello humano) y se laminan de forma imperceptible debajo del papel texturado, de algodón o metalizado de tus etiquetas. Para botellas de vidrio serigrafiadas sin etiquetas, inyectamos la antena directamente en la estructura interna de la tapa o el difusor, haciéndola invisible a la vista pero activa al tacto.",
        ctx: "La elegancia no se negocia. La tecnología nexID actúa como una capa de seguridad y marketing invisible que solo cobra vida cuando el cliente decide interactuar con ella."
      },
      {
        q: "En cosmética, ¿cómo evito que un falsificador compre mis envases vacíos originales, los rellene con producto falso y los revenda con el chip original marcando 'auténtico'?",
        a: "Esta es la mayor vulnerabilidad en el mercado secundario de perfumes y cremas premium. Si el chip sigue activo, el sistema dirá que es original. nexID aborda este problema con honestidad técnica mediante la tecnología TagTamper: un micro-filamento conductor que recorre el cierre del frasco o el sello del atomizador. En el momento en que el consumidor presiona el atomizador por primera vez o desenrosca la tapa para usar el producto, el filamento físico se rompe mecánicamente. El chip sigue funcionando para marketing, pero el estado cambia permanentemente en nuestra base de datos a 'abierto/consumido'. Si alguien intenta rellenarlo y revenderlo, cualquier escaneo posterior alertará al comprador de que el envase ya fue abierto y violado.",
        ctx: "Esto destruye el mercado negro de rellenado de perfumes de lujo en origen, protegiendo tu marca y asegurando al consumidor final que está pagando por la fórmula original sin alteraciones."
      },
      {
        q: "¿Cómo justifico la inversión en chips NFC frente a mis accionistas cuando existen alternativas de trazabilidad mucho más económicas como los códigos QR?",
        a: "Si solo buscas marcar una casilla de trazabilidad básica para el mercado local, un código QR estático es más barato. Pero si tu objetivo es exportar y competir globalmente, el QR es un peligro: cualquiera lo puede fotocopiar y duplicar en miles de envases falsos en el extranjero. Además, la Unión Europea avanza firmemente hacia la obligatoriedad del Pasaporte Digital de Producto (DPP) para cosméticos, exigiendo registrar la circularidad y la cadena de suministro de forma inmutable. Con nexID, no solo cumples con estas leyes internacionales antes que tus competidores de LATAM, sino que conviertes el envase físico en un portal interactivo directo al consumidor (D2C) para compras recurrentes con un solo toque, aumentando la lealtad y el valor del ciclo de vida del cliente (LTV).",
        ctx: "El retorno de la inversión (ROI) no proviene solo de la prevención de la falsificación, sino de la eficiencia regulatoria internacional y de la creación de un nuevo canal digital de ventas recurrentes sin intermediarios."
      },
      {
        q: "En cosméticos, si un falsificador despega la etiqueta del perfume original para pegarla en un frasco clonado, ¿cómo detectamos el fraude si no usamos adhesivos VOID?",
        a: "Las antenas NFC de papel son extremadamente frágiles y se cortan al despegar el pegamento. Pero si buscas protección física total, existen etiquetas de transferencia de adhesivo o tipo 'tatuaje' (VOID) que se consiguen fácilmente con proveedores globales. Al intentar despegarlas, la antena metálica y el diseño se fragmentan y quedan parcialmente pegados ('tatuados') en el frasco de vidrio, haciendo imposible su reutilización. Si prefieres tags más económicos sin VOID, nuestro motor de telemetría detecta comportamientos incongruentes en la nube (como escaneos duplicados o geolocalizaciones imposibles de un mismo chip en dos países distintos), marcando de inmediato el envase como sospechoso en la base de datos centralizada.",
        ctx: "Al contrastar la base de datos de despachos a distribuidores autorizados con las coordenadas GPS del cliente final que escanea el perfume, nexID identifica de inmediato la fuga al mercado gris o la reutilización del chip."
      }
    ]
  },
  {
    id: "pharma-agro",
    label: "Farmacéutica & Agro",
    icon: Layers,
    items: [
      {
        q: "¿Qué ventaja tiene sobre el código de barras que exige la regulación de medicamentos?",
        a: "El código de barras es estático y fácilmente duplicable por fotocopiadoras en empaques apócrifos. El microchip nexID genera una firma criptográfica dinámica de un solo uso que se valida contra nuestro servidor seguro en Render/AWS.",
        ctx: "Si una mafia copia el empaque, el servidor detecta que la firma del chip está ausente, es inválida o reporta ubicaciones geográficas simultáneas imposibles, bloqueando la falsificación de medicamentos de alto costo."
      },
      {
        q: "En el agro, ¿qué valor tiene colocar chips en bolsas de semillas de autor o agroquímicos?",
        a: "El mercado negro de semillas adulteradas y agroquímicos diluidos genera pérdidas millonarias y daña cosechas enteras. El chip nexID certifica el origen del criadero o laboratorio oficial directamente en el campo mediante un tap con el celular.",
        ctx: "El productor escanea el bidón o bolsa con su celular y valida que el agroquímico posee la composición y concentración original, protegiendo los derechos de autor y la producción agrícola."
      }
    ]
  },
  {
    id: "eventos-tickets",
    label: "Eventos & Tickets",
    icon: Smartphone,
    items: [
      {
        q: "Los códigos QR de las entradas se revenden y duplican. ¿Cómo lo soluciona nexID?",
        a: "Reemplazamos el QR digital por pulseras o credenciales VIP físicas inteligentes equipadas con chip NFC nexID. Cada ingreso requiere un tap físico que se procesa en milisegundos contra nuestro servidor Render.",
        ctx: "Al ser imposible clonar la llave criptográfica del chip, se erradica por completo la entrada duplicada o el fraude de accesos en eventos VIP y corporativos."
      }
    ]
  },
  {
    id: "inversores",
    label: "Inversores y Trazabilidad Híbrida",
    icon: Coins,
    items: [
      {
        q: "¿Por qué ofrecer una solución híbrida (Servidor Seguro + Blockchain Opcional)?",
        a: "Muchos clientes tradicionales le temen a las tecnologías criptográficas complejas y a las billeteras digitales. Al ofrecer por defecto una base de datos segura hospedada en la nube, logramos un registro e integración inmediatos y sin fricciones.",
        ctx: "Si una marca lanza una edición especial y desea máxima inmutabilidad para el mercado de reventa o coleccionistas, activamos la capa digital descentralizada como un servicio de valor agregado premium."
      },
      {
        q: "¿Cómo garantizan la seguridad de la base de datos si es centralizada?",
        a: "La seguridad del sistema no depende del servidor, sino de la criptografía de firma única de cada chip físico. Cada lectura genera una firma de seguridad dinámica que solo puede ser descifrada por nuestras claves criptográficas maestras.",
        ctx: "Incluso ante una intrusión en el servidor de base de datos, un atacante no puede generar firmas dinámicas falsas de chips físicos porque no posee las claves maestras de cifrado."
      },
      {
        q: "¿Cómo escala el modelo SaaS en Render y AWS?",
        a: "Operamos un modelo de software de alta rentabilidad: margen por volumen en el hardware programado (chips) + suscripción SaaS mensual por el uso del panel CRM, telemetría y el motor nexID Cognitive AI Engine.",
        ctx: "Esto nos da ingresos predecibles y un moat defensivo basado en el software y la integración criptográfica propietaria."
      }
    ]
  }
];

// Interactive presentation slides array
const slides = [
  {
    title: "1) nexID Thesis",
    tagline: "Propiedad Digital y Autenticidad Física",
    bullets: [
      "nexID convierte productos físicos en activos verificables, trazables y operables.",
      "Arquitectura Híbrida: base de datos segura por defecto para una integración sencilla, con opción de activar tecnología blockchain.",
      "Monetización escalable mediante hardware, integración en fábrica, suscripción mensual y licencias del sistema."
    ]
  },
  {
    title: "2) El Problema del Mercado",
    tagline: "Falsificación y Pérdida del Cliente",
    bullets: [
      "Los códigos QR estáticos y hologramas son copiables por cualquier estafador mediante fotos.",
      "Las bodegas y marcas premium pierden el rastro de sus productos tras la venta en vinotecas o exportación.",
      "El marketing tradicional (email, newsletter) tiene tasas de conversión mediocres (<2% CTR)."
    ]
  },
  {
    title: "3) La Solución Híbrida",
    tagline: "Servidor en Nube Segura + Propiedad Digital",
    bullets: [
      "Firma criptográfica dinámica validada contra nuestro servidor en la nube ultra-seguro por defecto.",
      "Integración inmediata para marcas tradicionales sin necesidad de lidiar con criptomonedas o costos de transacción de red.",
      "Registro descentralizado opcional para generar certificados digitales de propiedad y garantizar inmutabilidad."
    ]
  },
  {
    title: "4) Seguridad Criptográfica",
    tagline: "Monitoreo Activo de Claves",
    bullets: [
      "Cada tap genera una firma dinámica única (SUN) que se descifra con llaves custodiadas en HSM/KMS.",
      "Telemetría de geolocalización activa: alerta si el mismo chip es leído simultáneamente en dos ciudades.",
      "Circuito físico TagTamper: el chip detecta e informa si la cápsula o sello original ya fue abierto."
    ]
  },
  {
    title: "5) nexID Cognitive AI",
    tagline: "Motor de Optimización de Tono",
    bullets: [
      "Reescritura de campañas comerciales en 3 perfiles: Sommelier, Club Privado y Modern Web3.",
      "Telemetría de impacto live: calcula el Prestige Score, Viralidad y la Huella Emocional del texto.",
      "Traducción semántica inteligente de palabras planas a jerga enológica y tecnológica premium."
    ]
  },
  {
    title: "6) Fidelidad & Gamificación VIP",
    tagline: "Estatus y Cava Digital 3D",
    bullets: [
      "Cava digital interactiva donde los consumidores reclaman la propiedad y coleccionan sus botellas.",
      "Categorías de membresía metálica (Bronce, Plata, Oro) con beneficios y preventas exclusivas.",
      "Gobernanza activa: encuestas on-chain para decidir cortes del próximo Blend o diseño de etiquetas."
    ]
  },
  {
    title: "7) Tracción y Modelo B2B",
    tagline: "SaaS Recurrente y Alto Margen",
    bullets: [
      "Ingresos recurrentes por SaaS de acceso al CRM, geolocalización, AI Engine y portal VIP.",
      "Venta del hardware pre-programado en inlays autoadhesivos con margen del 40%.",
      "Ecosistema multimercado aplicable a Bodegas, Cosmética, Farmacéutica, Agro y Eventos."
    ]
  },
  {
    title: "8) Live Demo Checklist",
    tagline: "Demostración Práctica en 3 Minutos",
    bullets: [
      "1. Hackear QR: Demostrar cómo se clona un QR fotocopiándolo desde una pantalla.",
      "2. Tap NFC: Acercar el móvil a una botella con chip nexID y abrir el Portal VIP sin instalar apps.",
      "3. Live CRM: Mostrar en la notebook cómo el tap apareció en vivo en el panel de control de nexID."
    ]
  }
];

export function ThreeDProduct({ active, tapping, labelImageUrl, industry, chipModel }: { active: boolean; tapping: boolean; labelImageUrl?: string | null; industry: string; chipModel: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (typeof window === "undefined" || !mountRef.current) return;
    
    const container = mountRef.current;
    const width = container.clientWidth || 130;
    const height = container.clientHeight || 240;
    
    // Scene
    const scene = new THREE.Scene();
    
    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 6.2, 20);
    camera.lookAt(0, 5.8, 0);
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.3);
    mainLight.position.set(6, 12, 10);
    scene.add(mainLight);
    
    const fillLight = new THREE.DirectionalLight(0x06b6d4, 0.75); // Cyan fill
    fillLight.position.set(-6, 5, -5);
    scene.add(fillLight);
    
    const rimLight = new THREE.DirectionalLight(0x8b5cf6, 0.9); // Purple rim
    rimLight.position.set(0, 10, -8);
    scene.add(rimLight);

    // Dynamic Hotspot coordinates and neck lighting
    let hotspotY = 11.0;
    let hotspotX = 0;
    let hotspotZ = 0;
    
    if (industry === "cosmetica") {
      hotspotY = 4.65;
    } else if (industry === "agro") {
      hotspotX = 0.8;
      hotspotY = 5.15;
    } else if (industry === "pharma") {
      hotspotY = 4.45;
    } else if (industry === "eventos") {
      hotspotY = 2.2;
      hotspotZ = 0.06;
    }

    const hotspotLight = new THREE.PointLight(0x06b6d4, 0, 8);
    hotspotLight.position.set(hotspotX, hotspotY, hotspotZ);
    scene.add(hotspotLight);
    
    // Main Product Group
    const productGroup = new THREE.Group();
    scene.add(productGroup);
    
    let mainGeometry: THREE.BufferGeometry | null = null;
    let mainMaterial: THREE.Material | null = null;
    let labelGeometry: THREE.BufferGeometry | null = null;
    let labelX = 0;
    let labelY = 0;
    let labelZ = 0;
    let labelRotationY = 0;

    // Build Morphing Geometries
    if (industry === "cosmetica") {
      // Rectangular glass perfume bottle
      mainGeometry = new THREE.BoxGeometry(3, 4.5, 1.8);
      mainMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.05,
        metalness: 0.1,
        transmission: 0.95,
        thickness: 0.8,
        ior: 1.5,
        clearcoat: 1.0,
      });
      const perfumeBody = new THREE.Mesh(mainGeometry, mainMaterial);
      perfumeBody.position.y = 2.25;
      productGroup.add(perfumeBody);
      
      // Golden collar
      const collarGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.5, 16);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xe2b857,
        roughness: 0.2,
        metalness: 0.9,
      });
      const collar = new THREE.Mesh(collarGeo, goldMat);
      collar.position.set(0, 4.6, 0);
      productGroup.add(collar);
      
      // Spray cap
      const capGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.7, 16);
      const cap = new THREE.Mesh(capGeo, goldMat);
      cap.position.set(0, 5.2, 0);
      productGroup.add(cap);
      
      labelGeometry = new THREE.PlaneGeometry(2.4, 2.8);
      labelY = 2.25;
      labelZ = 0.91;
      
    } else if (industry === "agro") {
      // Stout plastic chemical canister
      mainGeometry = new THREE.BoxGeometry(3.6, 5.0, 2.6);
      mainMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xe2e8f0, // Industrial matte white/gray plastic
        roughness: 0.4,
        metalness: 0.05,
        clearcoat: 0.1,
      });
      const canisterBody = new THREE.Mesh(mainGeometry, mainMaterial);
      canisterBody.position.y = 2.5;
      productGroup.add(canisterBody);
      
      // Offset colored cap
      const capGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.5, 16);
      const capMat = new THREE.MeshStandardMaterial({
        color: 0xd97706, // Orange cap
        roughness: 0.5,
        metalness: 0.1,
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(0.8, 5.15, 0);
      productGroup.add(cap);
      
      // Handle
      const handleGeo = new THREE.BoxGeometry(0.4, 1.8, 0.8);
      const handle = new THREE.Mesh(handleGeo, mainMaterial);
      handle.position.set(-0.8, 5.2, 0);
      productGroup.add(handle);
      
      labelGeometry = new THREE.PlaneGeometry(3.0, 3.4);
      labelY = 2.5;
      labelZ = 1.31;
      
    } else if (industry === "pharma") {
      // Amber glass medicine bottle
      mainGeometry = new THREE.CylinderGeometry(1.4, 1.4, 4.2, 32);
      mainMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x451a03, // Amber glass
        roughness: 0.08,
        metalness: 0.1,
        transmission: 0.65,
        thickness: 0.6,
        ior: 1.5,
        clearcoat: 0.8,
      });
      const pharmaBody = new THREE.Mesh(mainGeometry, mainMaterial);
      pharmaBody.position.y = 2.1;
      productGroup.add(pharmaBody);
      
      // White plastic child safety cap
      const capGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.7, 32);
      const capMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.6,
        metalness: 0.1,
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(0, 4.45, 0);
      productGroup.add(cap);
      
      labelGeometry = new THREE.CylinderGeometry(1.41, 1.41, 2.8, 32, 1, true);
      labelY = 2.1;
      
    } else if (industry === "eventos") {
      // VIP Pass Smart Card
      mainGeometry = new THREE.BoxGeometry(4.4, 3.0, 0.08);
      mainMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x111827, // Matte carbon fiber card
        roughness: 0.15,
        metalness: 0.95,
        clearcoat: 1.0,
      });
      const cardBody = new THREE.Mesh(mainGeometry, mainMaterial);
      cardBody.position.y = 2.2;
      productGroup.add(cardBody);
      
      // Gold circuit chip inlay
      const plateGeo = new THREE.BoxGeometry(0.8, 0.8, 0.02);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xe2b857,
        roughness: 0.1,
        metalness: 0.9,
      });
      const plate = new THREE.Mesh(plateGeo, goldMat);
      plate.position.set(-1.4, 2.2, 0.05);
      productGroup.add(plate);
      
      labelGeometry = new THREE.PlaneGeometry(4.2, 2.8);
      labelY = 2.2;
      labelZ = 0.045;
      
    } else {
      // Default: Wine Bottle
      const points = [];
      points.push(new THREE.Vector2(0, 0));
      points.push(new THREE.Vector2(1.7, 0));
      points.push(new THREE.Vector2(1.8, 0.1));
      points.push(new THREE.Vector2(1.85, 0.4));
      points.push(new THREE.Vector2(1.85, 6.0));
      points.push(new THREE.Vector2(1.75, 6.8));
      points.push(new THREE.Vector2(1.5, 7.5));
      points.push(new THREE.Vector2(1.5, 7.5));
      points.push(new THREE.Vector2(1.1, 8.2));
      points.push(new THREE.Vector2(0.7, 8.8));
      points.push(new THREE.Vector2(0.55, 9.3));
      points.push(new THREE.Vector2(0.55, 12.0));
      points.push(new THREE.Vector2(0.65, 12.1));
      points.push(new THREE.Vector2(0.65, 12.4));
      points.push(new THREE.Vector2(0.5, 12.5));
      points.push(new THREE.Vector2(0, 12.5));
      
      mainGeometry = new THREE.LatheGeometry(points, 32);
      mainMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x061e0e,
        roughness: 0.04,
        metalness: 0.1,
        transmission: 0.8,
        thickness: 0.9,
        ior: 1.5,
        clearcoat: 1.0,
      });
      
      const bottleMesh = new THREE.Mesh(mainGeometry, mainMaterial);
      bottleMesh.position.y = 0.2;
      productGroup.add(bottleMesh);
      
      labelGeometry = new THREE.CylinderGeometry(1.86, 1.86, 3.8, 32, 1, true);
      labelY = 3.6;
    }
    
    // Label Canvas
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    const drawLabel = (bgImage?: HTMLImageElement) => {
      if (!ctx) return;
      ctx.clearRect(0, 0, 512, 512);
      
      if (bgImage) {
        ctx.drawImage(bgImage, 0, 0, 512, 512);
        ctx.fillStyle = "rgba(9, 9, 11, 0.55)";
        ctx.fillRect(0, 0, 512, 512);
      } else {
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, 512, 512);
      }
      
      // Golden borders
      ctx.strokeStyle = "#e2b857";
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, 472, 472);
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 30, 452, 452);
      
      // Tailored Label content based on selected industry
      let title = "N E X I D";
      let subtitle = "Gran Blend Seleccionado";
      let detail1 = "ORIGEN: MENDOZA, ARGENTINA";
      let chipName = chipModel === "tamper" ? "NTAG 424 DNA TT" : chipModel === "dna" ? "NTAG 424 DNA" : "NTAG 215";
      let detail2 = `NFC CHIP: ${chipName}`;
      
      if (industry === "cosmetica") {
        title = "N E X I D   A U R A";
        subtitle = "Eau de Parfum Premium";
        detail1 = "ORIGEN: GRASSE / BS. AS.";
      } else if (industry === "agro") {
        title = "N E X I D   A G R O";
        subtitle = "Semillas Fiscalizadas Lote #4";
        detail1 = "ORIGEN: PAMPA HÚMEDA, ARG.";
      } else if (industry === "pharma") {
        title = "N E X I D   P H A R M A";
        subtitle = "Medicina de Alta Complejidad";
        detail1 = "ORIGEN: LAB ZURICH / SUIZA";
      } else if (industry === "eventos") {
        title = "N E X I D   P A S S";
        subtitle = "Global Business Summit 2026";
        detail1 = "LUGAR: PREDIO VIP ACCESOS";
      }
      
      // Text
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(title, 256, 100);
      
      ctx.fillStyle = "#e2b857";
      ctx.font = "italic 700 24px Georgia, serif";
      ctx.fillText(subtitle, 256, 160);
      
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "600 16px monospace";
      ctx.fillText("SERVIDOR SEGURO Y REGISTRO DIGITAL", 256, 220);
      
      // Shield logo in gold
      ctx.strokeStyle = "#e2b857";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(256, 260);
      ctx.lineTo(300, 280);
      ctx.lineTo(290, 330);
      ctx.quadraticCurveTo(256, 370, 256, 370);
      ctx.quadraticCurveTo(222, 330, 222, 330);
      ctx.lineTo(212, 280);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "#e2b857";
      ctx.fill();
      
      // n inside shield
      ctx.fillStyle = "#000000";
      ctx.font = "900 28px sans-serif";
      ctx.fillText("N", 256, 320);
      
      // Details
      ctx.fillStyle = "#e2b857";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(detail1, 256, 410);
      ctx.fillStyle = "#6b7280";
      ctx.font = "14px monospace";
      ctx.fillText(detail2, 256, 440);
    };
    
    const labelTexture = new THREE.CanvasTexture(canvas);

    if (labelImageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = labelImageUrl;
      img.onload = () => {
        drawLabel(img);
        labelTexture.needsUpdate = true;
      };
    } else {
      drawLabel();
      labelTexture.needsUpdate = true;
    }
    
    const labelMaterial = new THREE.MeshStandardMaterial({
      map: labelTexture,
      roughness: 0.6,
      metalness: 0.1,
      bumpScale: 0.05,
    });
    
    if (labelGeometry) {
      const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
      labelMesh.position.set(labelX, labelY, labelZ);
      labelMesh.rotation.y = labelRotationY;
      productGroup.add(labelMesh);
    }
    
    // NFC Chip hotspot torus
    const hotspotGeometry = new THREE.TorusGeometry(0.6, 0.08, 16, 64);
    const hotspotMaterial = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.7,
    });
    const hotspotMesh = new THREE.Mesh(hotspotGeometry, hotspotMaterial);
    
    // Rotate events card hotspot to lay flat against the face, otherwise standard collar
    if (industry === "eventos") {
      hotspotMesh.position.set(hotspotX, hotspotY, hotspotZ);
    } else {
      hotspotMesh.rotation.x = Math.PI / 2;
      hotspotMesh.position.set(hotspotX, hotspotY, hotspotZ);
    }
    productGroup.add(hotspotMesh);
    
    // Animation loop variables
    let animationFrameId: number;
    let targetRotationY = 0;
    let currentRotationY = 0;
    let isDragging = false;
    let previousMouseX = 0;
    
    // Drag rotation controls
    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMouseX = e.clientX;
    };
    
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMouseX;
      targetRotationY += deltaX * 0.015;
      previousMouseX = e.clientX;
    };
    
    const onMouseUp = () => {
      isDragging = false;
    };
 
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMouseX = e.touches[0].clientX;
      }
    };
 
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMouseX;
      targetRotationY += deltaX * 0.015;
      previousMouseX = e.touches[0].clientX;
    };
 
    const onTouchEnd = () => {
      isDragging = false;
    };
    
    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("touchstart", onTouchStart);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);
    
    let clock = new THREE.Clock();
    
    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      
      // Auto-rotation when not dragging
      if (!isDragging) {
        targetRotationY += 0.003;
      }
      
      // Smooth interpolation for rotation
      currentRotationY += (targetRotationY - currentRotationY) * 0.1;
      productGroup.rotation.y = currentRotationY;
      
      // Floating motion
      productGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.15;
      
      // Handle active state - spin and shine
      if (active) {
        hotspotMaterial.color.setHex(0xa855f7); // Purple success
        hotspotMesh.scale.setScalar(1 + Math.sin(elapsedTime * 6) * 0.15);
        hotspotMaterial.opacity = 0.9;
        hotspotLight.intensity = 2.0 + Math.sin(elapsedTime * 10) * 0.5;
      } else if (tapping) {
        // Blink light rapidly
        hotspotMaterial.color.setHex(0x06b6d4); // Cyan read
        const speed = Math.sin(elapsedTime * 25) > 0 ? 1 : 0;
        hotspotMaterial.opacity = speed * 0.8 + 0.1;
        hotspotLight.intensity = speed * 2.5;
        hotspotMesh.scale.setScalar(1 + speed * 0.25);
      } else {
        // Idle heartbeat glow
        hotspotMaterial.color.setHex(0x06b6d4); // Cyan idle
        hotspotMaterial.opacity = 0.4 + Math.sin(elapsedTime * 3) * 0.25;
        hotspotLight.intensity = 0.4 + Math.sin(elapsedTime * 3) * 0.25;
        hotspotMesh.scale.setScalar(1 + Math.sin(elapsedTime * 3) * 0.08);
      }
      
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    
    const animateRef = animate;
    animateRef();
    
    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth || 130;
      const h = container.clientHeight || 240;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    
    window.addEventListener("resize", handleResize);
    
    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      
      if (mainGeometry) mainGeometry.dispose();
      if (mainMaterial) mainMaterial.dispose();
      if (labelGeometry) labelGeometry.dispose();
      labelMaterial.dispose();
      labelTexture.dispose();
      hotspotGeometry.dispose();
      hotspotMaterial.dispose();
      
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", handleResize);
    };
  }, [active, tapping, labelImageUrl, industry, chipModel]);
  
  return (
    <div ref={mountRef} className="w-full h-full relative cursor-grab active:cursor-grabbing" />
  );
}

// Industry ROI presets data structure
export interface IndustryPreset {
  name: string;
  label: string;
  volume: number;
  fraudRate: number;
  icon: string;
  price: number;
  defaultChip: "tamper" | "dna" | "ntag";
  defaultChipCost: number;
}

export const INDUSTRY_PRESETS: IndustryPreset[] = [
  { name: "bodegas", label: "Bodegas Premium", volume: 150000, fraudRate: 4.2, icon: "🍷", price: 45, defaultChip: "tamper", defaultChipCost: 1.00 },
  { name: "cosmetica", label: "Cosmética de Lujo", volume: 300000, fraudRate: 5.5, icon: "💄", price: 75, defaultChip: "tamper", defaultChipCost: 1.00 },
  { name: "agro", label: "Agro Premium", volume: 80000, fraudRate: 6.8, icon: "🌾", price: 60, defaultChip: "dna", defaultChipCost: 0.80 },
  { name: "pharma", label: "Farmacéutica (Alto Costo)", volume: 50000, fraudRate: 3.5, icon: "🧪", price: 120, defaultChip: "tamper", defaultChipCost: 1.00 },
  { name: "eventos", label: "Eventos & Tickets VIP", volume: 25000, fraudRate: 8.5, icon: "🎫", price: 50, defaultChip: "ntag", defaultChipCost: 0.50 },
];

export const INDUSTRY_SIM_DETAILS: Record<string, {
  productName: string;
  location: string;
  authText: string;
  selloText: string;
  nodes: string[];
  iot: string[];
  steps: Array<{ title: string; desc: string }>;
  detailsTitle: string;
  detailsTagline: string;
  detailsGrid: Array<{ label: string; val: string }>;
  detailsQuote: string;
  mintTitle: string;
  mintDesc: string;
  mintSuccess: string;
  reward1Title: string;
  reward1Sub: string;
  reward2Title: string;
  reward2Sub: string;
  marketTitle: string;
  marketDesc: string;
  tabLabels: string[];
  chatPrompts: Array<{ label: string; q: string }>;
}> = {
  bodegas: {
    productName: "Gran Blend 2026",
    location: "Mendoza, Argentina",
    authText: "Autenticidad de Origen",
    selloText: "Sello Cerrado Original",
    nodes: ["MDZ", "BUE", "RTM", "ZRH"],
    iot: ["🌡️ Temp: 14.2°C", "💧 Hum: 58%", "⚡ GPS Lock: OK"],
    steps: [
      { title: "1. Viñedo Origen", desc: "Luján de Cuyo, Mendoza · Registrado en Origen" },
      { title: "2. Logística y Aduana", desc: "Despacho de puerto e ingreso en Zurich" },
      { title: "3. Sello de Seguridad", desc: "TagTamper Intacto (Original)" }
    ],
    detailsTitle: "Ficha Enológica",
    detailsTagline: "🏅 96 pts Suckling",
    detailsGrid: [
      { label: "Varietal:", val: "Malbec 100%" },
      { label: "Crianza:", val: "18m Roble Fr." },
      { label: "Crítica:", val: "Reserva Premium" },
      { label: "Servicio:", val: "16°C - 18°C" }
    ],
    detailsQuote: '"Color rubí, notas a ciruela madura, cacao y vainilla persistentes."',
    mintTitle: "Registrar en Blockchain",
    mintDesc: "Generá el gemelo digital de esta botella para poseer el certificado inmutable de autenticidad en el ledger de Polygon.",
    mintSuccess: "Tu certificado inmutable en la red Polygon Amoy ha sido generado con éxito.",
    reward1Title: "Copa de Degustación",
    reward1Sub: "Cata en Cava Mendoza",
    reward2Title: "Tour VIP Bodega",
    reward2Sub: "15% Off Reservas",
    marketTitle: "Marketplace Cava VIP",
    marketDesc: "Cava de compra y venta entre coleccionistas",
    tabLabels: ["Sello", "Web3", "Premios", "Cava", "Chat"],
    chatPrompts: [
      { label: "🍷 Maridaje", q: "¿Con qué comida marida este blend?" },
      { label: "🍇 Notas de Cata", q: "¿Cuáles son sus notas de cata?" },
      { label: "🏔️ Origen", q: "¿Cuál es el origen de este viñedo?" }
    ]
  },
  cosmetica: {
    productName: "Elysian Elixir Perfume",
    location: "Grasse, Francia / Latam",
    authText: "Autenticidad REACH",
    selloText: "Fórmula Inalterada",
    nodes: ["GSE", "PAR", "BUE", "SCL"],
    iot: ["🌡️ Temp: 18.5°C", "☀️ UV Index: 0.0", "⚡ Sello: Hermético"],
    steps: [
      { title: "1. Esencia Origen", desc: "Flores de Jazmín, Grasse · Lote Acreditado" },
      { title: "2. Importación y Fraccionado", desc: "Aduana de Buenos Aires e ingreso a planta" },
      { title: "3. Sello de Apertura", desc: "TagTamper Activo e Intacto" }
    ],
    detailsTitle: "Ficha de Fragancia",
    detailsTagline: "✨ Extracto de Parfum",
    detailsGrid: [
      { label: "Familia:", val: "Floral Oriental" },
      { label: "Concentración:", val: "30% Aceites Es." },
      { label: "Nariz:", val: "M. Guerlain" },
      { label: "Volumen:", val: "100 ml" }
    ],
    detailsQuote: '"Notas de salida de jazmín y azafrán, con fondo de cedro y ámbar gris."',
    mintTitle: "Certificado de Lujo NFT",
    mintDesc: "Registrá la autenticidad y propiedad única de tu frasco de perfume en el registro descentralizado de Polygon.",
    mintSuccess: "Tu certificado de autenticidad y propiedad de lujo ha sido minteado en Polygon.",
    reward1Title: "Masterclass de Perfumería",
    reward1Sub: "Acceso digital exclusivo",
    reward2Title: "Muestra Exclusiva",
    reward2Sub: "Lanzamientos 2027 gratis",
    marketTitle: "Colección Fragance VIP",
    marketDesc: "Intercambio exclusivo de frascos numerados",
    tabLabels: ["Sello", "Web3", "Regalos", "Club", "Chat"],
    chatPrompts: [
      { label: "💄 Fragancia", q: "¿Cuáles son las notas olfativas de este perfume?" },
      { label: "✨ Cuidado", q: "¿Es seguro para pieles sensibles?" },
      { label: "🇫🇷 Origen", q: "¿De dónde proviene la esencia?" }
    ]
  },
  agro: {
    productName: "BioGuard Max 500",
    location: "Lote Fitosanitario",
    authText: "Autenticidad Agro",
    selloText: "Fórmula Fitosanitaria Pura",
    nodes: ["LAB", "ROS", "PER", "SLP"],
    iot: ["🌡️ Temp: 22.1°C", "📊 Presión: 1.0atm", "⚡ Sello: Sellado"],
    steps: [
      { title: "1. Síntesis de Lote", desc: "Laboratorio Central de Biotecnología · Certificado" },
      { title: "2. Despacho a Planta", desc: "Puerto Rosario y despacho a Distribuidor Pergamino" },
      { title: "3. Integridad de Bidón", desc: "TagTamper intacto sin micro-filtraciones" }
    ],
    detailsTitle: "Ficha Fitosanitaria",
    detailsTagline: "🌾 Certificación SENASA",
    detailsGrid: [
      { label: "Compuesto:", val: "Bio-Fungicida" },
      { label: "Pureza:", val: "99.8% Activo" },
      { label: "Vencimiento:", val: "Diciembre 2028" },
      { label: "Aplicación:", val: "Foliar Directa" }
    ],
    detailsQuote: '"Producto orgánico de amplio espectro para cereales y oleaginosas premium."',
    mintTitle: "Tokenización Fitosanitaria",
    mintDesc: "Registrá la huella de carbono y trazabilidad de este lote agroquímico en el ledger público de Polygon.",
    mintSuccess: "Pasaporte digital del lote fitosanitario registrado en la red Polygon.",
    reward1Title: "Asesoramiento Agrónomo",
    reward1Sub: "Consulta técnica live",
    reward2Title: "Descuento Reabastecimiento",
    reward2Sub: "10% en tu próximo pedido",
    marketTitle: "Trazabilidad de Lotes",
    marketDesc: "Trazabilidad de carbono y transferencia de lotes",
    tabLabels: ["Sello", "Web3", "Beneficios", "Lotes", "Chat"],
    chatPrompts: [
      { label: "🌾 Dosificación", q: "¿Cuál es la dosis recomendada por hectárea?" },
      { label: "🚜 Aplicación", q: "¿En qué condiciones climáticas se debe aplicar?" },
      { label: "🧪 Fitosanitario", q: "¿Qué hongos o plagas controla?" }
    ]
  },
  pharma: {
    productName: "OncoCure Forte 100mg",
    location: "Cadena de Frío Monitoreada",
    authText: "Autenticidad FDA / EMA",
    selloText: "Cadena de Frío Intacta",
    nodes: ["FRA", "BUE", "HOS", "PAC"],
    iot: ["🌡️ Temp: 4.8°C (Rango OK)", "💧 Hum: 45%", "❄️ Alerta Frío: Ninguna"],
    steps: [
      { title: "1. Síntesis Alemana", desc: "Planta Central Frankfurt · Cripto-Sello Generado" },
      { title: "2. Arribo Ezeiza", desc: "Ingreso a depósito refrigerado aduanero · Acreditado" },
      { title: "3. Monitoreo de Sello", desc: "TagTamper intacto y verificado en la app" }
    ],
    detailsTitle: "Ficha del Medicamento",
    detailsTagline: "🧪 Receta Archivada",
    detailsGrid: [
      { label: "Principio A.:", val: "Inmunoterapia" },
      { label: "Concentración:", val: "100 mg / Vial" },
      { label: "Temperatura:", val: "2°C - 8°C Const." },
      { label: "Lote ID:", val: "ON-88392-A" }
    ],
    detailsQuote: '"Medicamento oncológico de alta especialidad. No exponer a la luz directa del sol."',
    mintTitle: "Pasaporte de Salud Cripto",
    mintDesc: "Generá el certificado inmutable de cumplimiento de la cadena de frío y autenticidad del medicamento para el paciente.",
    mintSuccess: "Pasaporte médico registrado y verificado en la blockchain Polygon.",
    reward1Title: "Soporte al Paciente",
    reward1Sub: "Línea médica 24/7 VIP",
    reward2Title: "Rebaja Deducible",
    reward2Sub: "Verificar con prepaga",
    marketTitle: "Registro de Cadena de Frío",
    marketDesc: "Portal de verificación y auditoría médica de lotes",
    tabLabels: ["Sello", "Web3", "Auditoría", "Historial", "Chat"],
    chatPrompts: [
      { label: "❄️ Cadena de Frío", q: "¿Cuál fue el registro histórico de temperatura?" },
      { label: "🇩🇪 Procedencia", q: "¿Dónde se fabricó este lote?" },
      { label: "🛡️ Normativas", q: "¿Cumple con regulaciones FDA o EMA?" }
    ]
  },
  eventos: {
    productName: "VIP Global Summit 2026",
    location: "Buenos Aires, Argentina",
    authText: "Acreditación Digital",
    selloText: "Pase Activo y Válido",
    nodes: ["SIST", "PROD", "ENTR", "VIP"],
    iot: ["⏱️ Hora: 19:30", "📍 Sector: VIP Front Row", "🔑 Acceso: Permitido"],
    steps: [
      { title: "1. Ticket Generado", desc: "Acreditación digital centralizada nexID" },
      { title: "2. Envío Credencial", desc: "Asignación de chip NTAG a pulsera física" },
      { title: "3. Primer Acceso Puerta", desc: "Validado en lector táctil inteligente" }
    ],
    detailsTitle: "Detalles del Pase",
    detailsTagline: "🎫 Acceso Full Access",
    detailsGrid: [
      { label: "Categoría:", val: "VIP Founders" },
      { label: "Ubicación:", val: "Fila 1 a 3" },
      { label: "Catering:", val: "Premium Incluido" },
      { label: "Beneficios:", val: "Afterparty Pass" }
    ],
    detailsQuote: '"Válido para todas las conferencias magistrales, workshops y cocktail de networking."',
    mintTitle: "Mint Ticket a NFT Coleccionable",
    mintDesc: "Convertí tu credencial física en un ticket NFT digital inmutable de colección (POAP) en la blockchain.",
    mintSuccess: "POAP NFT Coleccionable emitido con éxito en la red Polygon.",
    reward1Title: "Acceso Afterparty",
    reward1Sub: "Cocktail de Cierre VIP",
    reward2Title: "Preventa Summit 2027",
    reward2Sub: "50% Off precio Lanzamiento",
    marketTitle: "Marketplace de Entradas",
    marketDesc: "Canal seguro de transferencia P2P de pases",
    tabLabels: ["Ingreso", "Ticket", "Premios", "Market", "Chat"],
    chatPrompts: [
      { label: "🔑 Mis Accesos", q: "¿Qué áreas me permite ingresar este VIP Pass?" },
      { label: "🥂 Catering", q: "¿Qué incluye el catering Founders?" },
      { label: "⏱️ Horarios", q: "¿Cuál es la agenda de charlas y afterparty?" }
    ]
  }
};

// Backward-compatible wrapper for demo-lab
export function ThreeDBottle({ active, tapping, labelImageUrl }: { active: boolean; tapping: boolean; labelImageUrl?: string | null }) {
  return <ThreeDProduct active={active} tapping={tapping} labelImageUrl={labelImageUrl} industry="bodegas" chipModel="tamper" />;
}

// Interactive ROI & Financial Impact Calculator Component
interface RoiCalculatorProps {
  selectedPreset: string;
  setSelectedPreset: (v: string) => void;
  volume: number;
  setVolume: (v: number) => void;
  fraudRate: number;
  setFraudRate: (v: number) => void;
  retailPrice: number;
  setRetailPrice: (v: number) => void;
  selectedChipModel: "tamper" | "dna" | "ntag";
  setSelectedChipModel: (v: "tamper" | "dna" | "ntag") => void;
  chipCost: number;
  setChipCost: (v: number) => void;
  resellPrice: number;
  setResellPrice: (v: number) => void;
  businessProfile: "direct" | "reseller";
  setBusinessProfile: (v: "direct" | "reseller") => void;
  exportRegion: "latam" | "europe_usa" | "asia" | "grey_market";
  setExportRegion: (v: "latam" | "europe_usa" | "asia" | "grey_market") => void;
}

const REGION_CITATIONS = {
  latam: {
    source: "CAME (Cámara Argentina de la Mediana Empresa)",
    text: "El comercio ilegal y la falsificación en el Mercosur generan pérdidas del 8.5% anual en valor minorista para marcas de consumo de autor.",
    rate: 6.5
  },
  europe_usa: {
    source: "OIV (Organización Internacional de la Viña y el Vino)",
    text: "El fraude en vinos premium y destilados finos en canales de exportación tradicionales oscila históricamente entre el 4% y el 6%.",
    rate: 4.2
  },
  asia: {
    source: "APEC / WIPO (World Intellectual Property Org)",
    text: "En mercados emergentes de Asia-Pacífico, la adulteración física de envases originales de cosmética y agroquímicos supera el 10% por falta de sellado serializado.",
    rate: 10.0
  },
  grey_market: {
    source: "ICC (International Chamber of Commerce)",
    text: "El mercado gris y los desvíos de carga no autorizados a través de portales de ecommerce informales drenan hasta un 12% del margen de la marca.",
    rate: 12.0
  }
};

export function RoiCalculator({
  selectedPreset,
  setSelectedPreset,
  volume,
  setVolume,
  fraudRate,
  setFraudRate,
  retailPrice,
  setRetailPrice,
  selectedChipModel,
  setSelectedChipModel,
  chipCost,
  setChipCost,
  resellPrice,
  setResellPrice,
  businessProfile,
  setBusinessProfile,
  exportRegion,
  setExportRegion
}: RoiCalculatorProps) {

  const handleChipModelChange = (model: "tamper" | "dna" | "ntag") => {
    setSelectedChipModel(model);
    let baseCost = 1.00;
    if (model === "dna") baseCost = 0.80;
    else if (model === "ntag") baseCost = 0.50;
    setChipCost(baseCost);
    setResellPrice(baseCost * 1.5);
  };

  const handleRegionChange = (region: "latam" | "europe_usa" | "asia" | "grey_market") => {
    setExportRegion(region);
    setFraudRate(REGION_CITATIONS[region].rate);
  };

  // Tiered SaaS Billing calculation (from User Feedback)
  // Base rate: $0.05 / bottle per month. Decrements by $0.01 per bottle every 5,000 monthly bottles (min $0.01 cap).
  // Minimum monthly volume to work is 1000 bottles/month. Maximum monthly SaaS fee is capped at $1000/month.
  const rawMonthlyVolume = volume / 12;
  const monthlyVolume = Math.max(1000, rawMonthlyVolume); // 1000 bottles/month minimum
  const pricePerBottle = Math.max(0.01, 0.05 - Math.floor(Math.max(0, monthlyVolume - 5000) / 5000) * 0.01);
  const nexIdSaaSMonthly = Math.min(1000, monthlyVolume * pricePerBottle); // Capped at $1000/month
  const nexIdSaaSYearly = nexIdSaaSMonthly * 12;

  // Direct B2B calculations
  const grossLoss = volume * retailPrice * (fraudRate / 100);
  const preventedFraud = grossLoss * 0.98; // 98% efficiency
  const nexIdChipsCost = volume * chipCost;
  const totalDirectCost = nexIdChipsCost + nexIdSaaSYearly;
  const directNetSavings = preventedFraud - totalDirectCost;

  // Reseller B2B2B calculations
  const hardwareCostToReseller = volume * chipCost;
  const hardwareRevenueFromClient = volume * resellPrice;
  const hardwareProfit = hardwareRevenueFromClient - hardwareCostToReseller;
  const saasReferralCommission = nexIdSaaSYearly * 0.20; // 20% setup & ongoing SaaS referral commission
  const totalResellerProfit = hardwareProfit + saasReferralCommission;

  // Output mappings based on business profile
  const isReseller = businessProfile === "reseller";
  const finalInvestment = isReseller ? hardwareCostToReseller : totalDirectCost;
  const finalNetGain = isReseller ? totalResellerProfit : directNetSavings;
  const roiMultiplier = finalInvestment > 0 ? (finalNetGain / finalInvestment) : 0;
  const dtcClients = Math.round(volume * 0.35); // 35% scan rate

  const [activeQuestion, setActiveQuestion] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [customQuery, setCustomQuery] = useState("");

  const getAiAnswer = (qId: string) => {
    const regionName = exportRegion === 'latam' ? 'Mendoza / Mercosur' : exportRegion === 'europe_usa' ? 'Europa / EE.UU.' : exportRegion === 'asia' ? 'Asia / Pacífico' : 'Mercado Gris Global';
    const regionSource = REGION_CITATIONS[exportRegion]?.source || "Fuentes Globales";
    
    if (qId.startsWith("custom:")) {
      const userQuestion = qId.substring(7).toLowerCase();
      
      if (userQuestion.includes("2.87") || userQuestion.includes("ahorra") || userQuestion.includes("perdida") || userQuestion.includes("pérdida") || userQuestion.includes("cómo se calcula") || userQuestion.includes("calcula") || userQuestion.includes("formula") || userQuestion.includes("fórmula")) {
        const lossVal = (retailPrice * (fraudRate / 100)).toFixed(2);
        const preventedVal = (retailPrice * (fraudRate / 100) * 0.98).toFixed(2);
        return `El ahorro de $${preventedVal} USD (que se aproxima a $2.87 USD en la configuración que viste en pantalla) por cada chip individual se calcula de forma transparente con la siguiente fórmula:

Ahorro Unitario = Precio del Producto ($${retailPrice}.00 USD) × Tasa de Fraude de la Región (${fraudRate.toFixed(1)}%) × Eficiencia de nexID (98%).

Es decir: $${retailPrice}.00 × ${(fraudRate / 100).toFixed(3)} × 0.98 = $${preventedVal} USD.

Antes de nexID, tu marca pierde en promedio $${lossVal} USD por cada botella fabricada debido a falsificaciones o mercado gris. Al colocar un chip de $${chipCost.toFixed(2)} USD en el tapón, logras evitar $${preventedVal} USD de esa pérdida de inmediato. Esto significa que recuperas el costo de cada chip ${(chipCost > 0 ? (retailPrice * (fraudRate / 100) * 0.98 / chipCost) : 0).toFixed(1)} veces al vender tu producto. ¡Es una amortización directa e inmediata por botella!`;
      }
      
      if (userQuestion.includes("reutili") || userQuestion.includes("nuevo") || userQuestion.includes("lote") || userQuestion.includes("consumible")) {
        return `Para garantizar la autenticidad física de cada botella o envase, nexID asocia criptográficamente un identificador único (UID) a la firma de hardware del chip NFC. Si los chips fueran reutilizables, un falsificador podría extraer el chip de una botella original consumida e insertarlo en una botella rellenada, burlando al sistema. Al usar chips consumibles no reutilizables adheridos al tapón o al sello de seguridad, la apertura destruye físicamente el sensor o invalida el estado en el registro seguro, haciendo imposible el rellenado ilegal o mercado gris. Esto es lo que permite una eficiencia del 98% en la prevención de fraude y pérdidas.`;
      }
      
      if (userQuestion.includes("costo") || userQuestion.includes("precio") || userQuestion.includes("invert") || userQuestion.includes("plata") || userQuestion.includes("dinero") || userQuestion.includes("inversión")) {
        return `Tu inversión anual estimada es de $${finalInvestment.toLocaleString(undefined, {maximumFractionDigits:0})} USD (que incluye $${nexIdChipsCost.toLocaleString(undefined, {maximumFractionDigits:0})} USD en chips y $${nexIdSaaSYearly.toLocaleString(undefined, {maximumFractionDigits:0})} USD de suscripción SaaS). Dado que el precio de venta de tu producto es de $${retailPrice} USD y previenes pérdidas por $${preventedFraud.toLocaleString(undefined, {maximumFractionDigits:0})} USD anuales, cada botella que produce tu marca ahorra en promedio $${(retailPrice * (fraudRate / 100) * 0.98).toFixed(2)} USD frente al fraude de la región ${exportRegion === 'latam' ? 'Mendoza / Mercosur' : exportRegion === 'europe_usa' ? 'Europa / EE.UU.' : exportRegion === 'asia' ? 'Asia / Pacífico' : 'Mercado Gris Global'}. El costo del chip se recupera con creces, rindiendo un retorno neto anual de $${finalNetGain.toLocaleString(undefined, {maximumFractionDigits:0})} USD.`;
      }
      
      if (userQuestion.includes("tiempo") || userQuestion.includes("recuper") || userQuestion.includes("mes") || userQuestion.includes("dia") || userQuestion.includes("amorti")) {
        const paybackDays = preventedFraud > 0 ? ((nexIdChipsCost / preventedFraud) * 365) : 0;
        return `El tiempo estimado de recuperación de la inversión de hardware (chips) es de ${paybackDays.toFixed(1)} días de ventas de cada lote. Dado que vendes aproximadamente ${Math.round(volume / 12).toLocaleString()} unidades al mes, el costo mensual de chips es de $${Math.round(nexIdChipsCost / 12).toLocaleString()} USD. Con un ahorro preventivo neto de $${Math.round(finalNetGain / 12).toLocaleString()} USD/mes, la inversión en chips del lote de cada mes se amortiza en los primeros días del ciclo de ventas de ese mismo lote. No es un costo hundido de infraestructura, sino un insumo que se autofinancia de inmediato.`;
      }
      
      if (userQuestion.includes("blockchain") || userQuestion.includes("web3") || userQuestion.includes("nft") || userQuestion.includes("seguridad") || userQuestion.includes("seguro") || userQuestion.includes("nube")) {
        return `La arquitectura de nexID utiliza un modelo híbrido en el que la firma digital de los chips NFC se valida contra nuestro servidor seguro en la nube. Opcionalmente, para marcas que exportan y requieren certificar de forma pública el lote, se genera un pasaporte digital (NFT) en la red Polygon. Esto garantiza que ningún actor de la cadena logística o de distribución pueda alterar el historial del producto, ya que cada toque del consumidor se registra de forma inmutable, dando control completo e inmediato al propietario de la marca.`;
      }

      if (userQuestion.includes("ayuda") || userQuestion.includes("como") || userQuestion.includes("plataforma") || userQuestion.includes("que es") || userQuestion.includes("explic")) {
        return `Esta plataforma ayuda al empresario y a su equipo de ventas a calcular el Retorno de Inversión (ROI) real antes de comprar hardware. Al mover los controles de volumen, precio y tasa de fraude, nuestro sistema calcula instantáneamente el impacto financiero de nexID. Como consultor financiero IA, te recomiendo configurar tu volumen de ventas real y precio minorista para demostrarle a tu directorio cómo cada chip evita pérdidas y genera un canal directo de contacto (DTC) con el 35% de tus compradores.`;
      }
      
      return `Interesante pregunta sobre tu marca. Con tus variables actuales (volumen de ${volume.toLocaleString()} unidades y precio de $${retailPrice} USD), cada chip de $${chipCost.toFixed(2)} USD te protege de una pérdida de $${(retailPrice * (fraudRate / 100) * 0.98).toFixed(2)} USD por botella. Esto genera un ahorro neto de $${finalNetGain.toLocaleString(undefined, {maximumFractionDigits:0})} USD anuales. ¿Deseas que profundicemos en cómo la tasa de fraude del ${fraudRate}% de tu región influye en este resultado o cómo calcular la amortización por lote?`;
    }

    switch (qId) {
      case "non-reusable":
        return `Para garantizar la autenticidad física de cada botella o envase, nexID asocia criptográficamente un identificador único (UID) a la firma de hardware del chip NFC. Si los chips fueran reutilizables, un falsificador podría extraer el chip de una botella original consumida e insertarlo en una botella rellenada, burlando al sistema. Al usar chips consumibles no reutilizables adheridos al tapón o al sello de seguridad, la apertura destruye físicamente el sensor o invalida el estado en el registro seguro, haciendo imposible el rellenado ilegal o mercado gris. Esto es lo que permite una eficiencia del 98% en la prevención de fraude y pérdidas.`;
      
      case "tagtamper-cost":
        const extraInvestment = volume * 1.00;
        const baseInvestment = volume * 0.50;
        const diffCost = extraInvestment - baseInvestment;
        const additionalLoss = volume * retailPrice * (fraudRate / 100) * 0.38;
        return `¡Totalmente rentable! Con tus parámetros actuales (Volumen: ${volume.toLocaleString()} uds, Precio: $${retailPrice} USD, Tasa de Pérdida: ${fraudRate.toFixed(1)}%), el uso de un chip premium como el NTAG 424 DNA TagTamper ($1.00) representa una inversión en chips de $${extraInvestment.toLocaleString(undefined, {maximumFractionDigits:0})} USD, mientras que un chip estándar de $0.50 costaría $${baseInvestment.toLocaleString(undefined, {maximumFractionDigits:0})} USD. Si bien ahorras $${diffCost.toLocaleString(undefined, {maximumFractionDigits:0})} USD en el hardware, al no contar con detección física de apertura, la eficiencia de protección cae drásticamente del 98% a menos del 60%. Esto significa que la marca perdería más de $${additionalLoss.toLocaleString(undefined, {maximumFractionDigits:0})} USD anuales debido a fraudes y reventas que el chip básico no puede detectar. El chip TagTamper se paga solo protegiendo tu reputación y evitando fugas de canal.`;
      
      case "payback-period":
        const monthlyChips = Math.round(nexIdChipsCost / 12);
        const monthlyGain = Math.round(finalNetGain / 12);
        const paybackDays = preventedFraud > 0 ? ((nexIdChipsCost / preventedFraud) * 365) : 0;
        const coverageRatio = chipCost > 0 ? ((retailPrice * (fraudRate / 100) * 0.98) / chipCost) : 0;
        return `Dado que los chips son un insumo físico consumible por lote y no un activo fijo, la recuperación del dinero invertido se mide sobre la velocidad de venta y la detención de pérdidas de ese mismo lote. Con tus parámetros, la inversión anual en chips es de $${nexIdChipsCost.toLocaleString(undefined, {maximumFractionDigits:0})} USD ($${monthlyChips.toLocaleString(undefined, {maximumFractionDigits:0})} USD/mes) y tu ahorro neto anual proyectado es de $${finalNetGain.toLocaleString(undefined, {maximumFractionDigits:0})} USD ($${monthlyGain.toLocaleString(undefined, {maximumFractionDigits:0})} USD/mes). Esto significa que recuperas la inversión total en chips de cada lote en los primeros ${paybackDays.toFixed(1)} días de ventas de dicho lote. A nivel unitario, cada chip que cuesta $${chipCost.toFixed(2)} USD evita una pérdida estimada de $${(retailPrice * (fraudRate / 100) * 0.98).toFixed(2)} USD. ¡Un ratio de cobertura unitaria de ${coverageRatio.toFixed(1)}x!`;
      
      case "region-influence":
        return `La región seleccionada (${regionName}) posee una tasa de pérdida/fraude estimada del ${fraudRate.toFixed(1)}% según reportes de ${regionSource}. Con un precio de venta de $${retailPrice} USD por unidad, esto significa que tu marca pierde un promedio de $${(retailPrice * (fraudRate / 100)).toFixed(2)} USD por cada botella producida antes de implementar nexID. En regiones con alta incidencia de falsificación, el retorno de inversión del sistema se dispara a un multiplicador de ${roiMultiplier.toFixed(1)}x. En zonas con menor tasa de fraude, el ROI se mantiene sumamente atractivo porque nexID no solo previene fraude, sino que conecta de manera directa al ${Math.round(volume * 0.35).toLocaleString()} clientes (35% de lecturas estimadas) a tu canal directo DTC, abriendo nuevas oportunidades de venta recurrente.`;
      
      default:
        return "";
    }
  };

  const handleQuestionSelect = (qId: string) => {
    setAiThinking(true);
    setActiveQuestion(qId);
    setTimeout(() => {
      setAiThinking(false);
    }, 650);
  };

  const handleCustomQuerySubmit = () => {
    if (!customQuery.trim()) return;
    setAiThinking(true);
    const query = customQuery.toLowerCase();
    
    let foundId = `custom:${customQuery}`;
    
    setActiveQuestion(foundId);
    setCustomQuery("");
    setTimeout(() => {
      setAiThinking(false);
    }, 850);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 lg:p-10 shadow-2xl relative overflow-hidden backdrop-blur-md">
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full filter blur-[100px] pointer-events-none" />
      
      <div className="space-y-8">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 border-b border-white/5 pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">
              ⚡ Simulador Financiero B2B
            </div>
            <h2 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-tight leading-none">
              Ahorro por Pérdidas y Retorno de Inversión (ROI)
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Descubre cuánto dinero pierde tu marca por fraude y reventa del mercado gris, y cómo la arquitectura híbrida de nexID (Servidor Seguro + Registro Digital) recupera ese margen con un retorno de inversión masivo.
            </p>
          </div>
          
          {/* Business Profile Selection */}
          <div className="flex gap-2 bg-slate-900/80 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setBusinessProfile("direct")}
              className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                !isReseller
                  ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Marca Directa (B2B)
            </button>
            <button
              onClick={() => setBusinessProfile("reseller")}
              className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                isReseller
                  ? "bg-purple-500/20 border border-purple-500/30 text-purple-300 shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Revendedor / Imprenta (B2B2B)
            </button>
          </div>
        </div>

        {/* Sliders + Graph Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Sliders */}
          <div className="lg:col-span-4 space-y-5 bg-slate-900/30 p-6 rounded-2xl border border-white/5 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">
                Ajustar Variables de Marca
              </h3>
              
              {/* Chip Model Dropdown */}
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-slate-400 uppercase block">Modelo de Chip NFC:</label>
                <select
                  value={selectedChipModel}
                  onChange={(e) => handleChipModelChange(e.target.value as any)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500 transition-colors"
                >
                  <option value="tamper">NTAG 424 DNA TagTamper ($1.00 base)</option>
                  <option value="dna">NTAG 424 DNA ($0.80 base)</option>
                  <option value="ntag">NTAG 215 ($0.50 base)</option>
                </select>
              </div>

              {/* Region Selector Dropdown */}
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-slate-400 uppercase block">Región de Exportación:</label>
                <select
                  value={exportRegion}
                  onChange={(e) => handleRegionChange(e.target.value as any)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500 transition-colors"
                >
                  <option value="europe_usa">Europa / EE.UU. (OIV: ~4.2% fraude)</option>
                  <option value="latam">Mendoza / Mercosur (CAME: ~6.5% fraude)</option>
                  <option value="asia">Asia / Pacífico (APEC: ~10% fraude)</option>
                  <option value="grey_market">Mercado Gris Global (ICC: ~12% desvío)</option>
                </select>
              </div>

              {/* Slider 1: Volume */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400 uppercase">Volumen Anual</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={volume}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setVolume(val);
                        setSelectedPreset(""); // custom
                      }}
                      className="w-[85px] bg-slate-950/80 border border-white/10 rounded px-1.5 py-0.5 text-right font-mono text-white text-xs outline-none focus:border-cyan-500/50"
                    />
                    <span className="text-slate-400 font-mono text-[9px]">uds</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="1500000"
                  step="10000"
                  value={volume}
                  onChange={(e) => {
                    setVolume(Number(e.target.value));
                    setSelectedPreset(""); // custom
                  }}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>10K (Mín 1K/mes)</span>
                  <span>1.5M</span>
                </div>
              </div>

              {/* Slider 2: Fraud Rate (Only visible or editable for direct) */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400 uppercase">Tasa de Fraude / Pérdida</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={fraudRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFraudRate(val);
                        setSelectedPreset(""); // custom
                      }}
                      className="w-[50px] bg-slate-950/80 border border-white/10 rounded px-1.5 py-0.5 text-right font-mono text-rose-400 text-xs outline-none focus:border-rose-500/50"
                    />
                    <span className="text-rose-400 font-mono text-[9px]">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="20.0"
                  step="0.1"
                  value={fraudRate}
                  onChange={(e) => {
                    setFraudRate(Number(e.target.value));
                    setSelectedPreset(""); // custom
                  }}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-rose-400"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>0.5%</span>
                  <span>20%</span>
                </div>
              </div>

              {/* Slider 3: Price */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400 uppercase">Precio de Venta Producto</span>
                  <div className="flex items-center gap-1">
                    <span className="text-cyan-400 font-mono text-[9px]">$</span>
                    <input
                      type="number"
                      value={retailPrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setRetailPrice(val);
                        setSelectedPreset(""); // custom
                      }}
                      className="w-[50px] bg-slate-950/80 border border-white/10 rounded px-1.5 py-0.5 text-right font-mono text-cyan-400 text-xs outline-none focus:border-cyan-500/50"
                    />
                    <span className="text-cyan-400 font-mono text-[9px]">USD</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="15"
                  max="300"
                  step="5"
                  value={retailPrice}
                  onChange={(e) => {
                    setRetailPrice(Number(e.target.value));
                    setSelectedPreset(""); // custom
                  }}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>$15</span>
                  <span>$300</span>
                </div>
              </div>

              {/* Slider 4: Chip Cost */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400 uppercase">Costo Base del Chip</span>
                  <div className="flex items-center gap-1">
                    <span className="text-amber-400 font-mono text-[9px]">$</span>
                    <input
                      type="number"
                      step="0.05"
                      value={chipCost}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setChipCost(val);
                      }}
                      className="w-[60px] bg-slate-950/80 border border-white/10 rounded px-1.5 py-0.5 text-right font-mono text-amber-400 text-xs outline-none focus:border-amber-500/50"
                    />
                    <span className="text-amber-400 font-mono text-[9px]">USD</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="2.00"
                  step="0.05"
                  value={chipCost}
                  onChange={(e) => setChipCost(Number(e.target.value))}
                  className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                  <span>$0.10</span>
                  <span>$2.00</span>
                </div>
              </div>

              {/* Slider 5: Resell Price (Reseller only) */}
              {isReseller && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-400 uppercase">Precio Reventa del Chip</span>
                    <div className="flex items-center gap-1">
                      <span className="text-purple-400 font-mono text-[9px]">$</span>
                      <input
                        type="number"
                        step="0.05"
                        value={resellPrice}
                        onChange={(e) => setResellPrice(Number(e.target.value))}
                        className="w-[60px] bg-slate-950/80 border border-white/10 rounded px-1.5 py-0.5 text-right font-mono text-purple-400 text-xs outline-none focus:border-purple-500/50"
                      />
                      <span className="text-purple-400 font-mono text-[9px]">USD</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={chipCost + 0.05}
                    max="3.00"
                    step="0.05"
                    value={resellPrice}
                    onChange={(e) => setResellPrice(Number(e.target.value))}
                    className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-400"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                    <span>${(chipCost + 0.05).toFixed(2)}</span>
                    <span>$3.00</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Cost breakdown */}
            <div className="pt-3 border-t border-white/5 space-y-1.5 text-[9px] text-slate-400 leading-none font-mono">
              <div className="flex justify-between">
                <span>Volumen Mensual Promedio:</span>
                <span className="text-slate-200">{Math.round(monthlyVolume).toLocaleString()} uds/mes</span>
              </div>
              <div className="flex justify-between">
                <span>Precio SaaS/unidad:</span>
                <span className="text-emerald-400 font-bold">${pricePerBottle.toFixed(3)} USD/mes</span>
              </div>
              <div className="flex justify-between">
                <span>Suscripción SaaS:</span>
                <span className="text-slate-200">${Math.round(nexIdSaaSMonthly).toLocaleString()} USD/mes (${Math.round(nexIdSaaSYearly).toLocaleString()}/año)</span>
              </div>
              
              {!isReseller ? (
                <>
                  <div className="flex justify-between">
                    <span>Inversión en Chips:</span>
                    <span className="text-slate-200">${nexIdChipsCost.toLocaleString(undefined, {maximumFractionDigits:0})} USD</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2 text-xs font-bold leading-none">
                    <span>Inversión Anual Total:</span>
                    <span className="text-white">${finalInvestment.toLocaleString(undefined, {maximumFractionDigits:0})} USD</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span>Costo Compra Chips:</span>
                    <span className="text-slate-200">${hardwareCostToReseller.toLocaleString(undefined, {maximumFractionDigits:0})} USD</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reventa Chips a Cliente:</span>
                    <span className="text-slate-200">${hardwareRevenueFromClient.toLocaleString(undefined, {maximumFractionDigits:0})} USD</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2 text-xs font-bold leading-none">
                    <span>Inversión Anual (Chips):</span>
                    <span className="text-white">${finalInvestment.toLocaleString(undefined, {maximumFractionDigits:0})} USD</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Graphs */}
          <div className="lg:col-span-8 flex flex-col justify-between gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
              
              {/* Card 1: Comparative bar chart */}
              <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-5 flex flex-col justify-between h-[310px]">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-500 block">
                    {!isReseller ? "Pérdida vs Ahorro" : "Costo vs Ingresos"}
                  </span>
                  <h4 className="text-xs font-black text-white uppercase mt-1 leading-tight">Mapeo de Capital</h4>
                </div>
                
                {/* SVG Bar Chart */}
                <div className="h-[160px] flex items-end justify-around relative pt-4">
                  <div className="absolute inset-x-0 bottom-0 h-[120px] border-b border-white/5 pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-[60px] h-0 border-b border-dashed border-white/5 pointer-events-none" />
                  
                  {/* Bar 1: Loss / Cost */}
                  <div className="flex flex-col items-center w-[40px] z-10 group">
                    <div className="text-[9px] font-mono font-bold text-rose-400 mb-1 leading-none group-hover:scale-105 transition-transform">
                      -${(!isReseller ? grossLoss : hardwareCostToReseller) >= 1000000 
                        ? `${((!isReseller ? grossLoss : hardwareCostToReseller)/1000000).toFixed(1)}M` 
                        : `${Math.round((!isReseller ? grossLoss : hardwareCostToReseller)/1000)}k`}
                    </div>
                    <motion.div
                      className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-lg shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                      initial={{ height: 0 }}
                      animate={{ height: Math.min(120, ((!isReseller ? grossLoss : hardwareCostToReseller) / Math.max(!isReseller ? grossLoss : hardwareCostToReseller, finalNetGain)) * 120) || 5 }}
                      transition={{ type: "spring", stiffness: 85, damping: 15 }}
                    />
                    <span className="text-[8px] font-black text-slate-500 uppercase mt-2">
                      {!isReseller ? "Pérdida" : "Compra"}
                    </span>
                  </div>
                  
                  {/* Bar 2: Net Savings / Reseller Profit */}
                  <div className="flex flex-col items-center w-[40px] z-10 group">
                    <div className="text-[9px] font-mono font-bold text-emerald-400 mb-1 leading-none group-hover:scale-105 transition-transform">
                      +${finalNetGain >= 1000000 
                        ? `${(finalNetGain/1000000).toFixed(1)}M` 
                        : `${Math.round(finalNetGain/1000)}k`}
                    </div>
                    <motion.div
                      className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      initial={{ height: 0 }}
                      animate={{ height: Math.min(120, (finalNetGain / Math.max(!isReseller ? grossLoss : hardwareCostToReseller, finalNetGain)) * 120) || 5 }}
                      transition={{ type: "spring", stiffness: 85, damping: 15 }}
                    />
                    <span className="text-[8px] font-black text-slate-500 uppercase mt-2">
                      {!isReseller ? "Ahorro Neto" : "Ganancia"}
                    </span>
                  </div>
                </div>
                
                <p className="text-[9px] text-slate-400 text-center italic leading-tight">
                  {!isReseller 
                    ? "*Evita rellenado, copias y fugas al 98%." 
                    : "*SaaS setup ref + comisión de hardware."}
                </p>
              </div>

              {/* Card 2: Cumulative Area Chart (DTC Client growth) */}
              <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-5 flex flex-col justify-between h-[310px]">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-500 block">Clientes Conectados DTC</span>
                  <h4 className="text-xs font-black text-white uppercase mt-1 leading-tight">Fidelización Directa</h4>
                </div>
                
                {/* Dynamic SVG Line/Area graph */}
                <div className="h-[140px] w-full relative pt-4 overflow-hidden">
                  <svg className="w-full h-full" viewBox="0 0 100 60" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Grid Lines */}
                    <line x1="0" y1="15" x2="100" y2="15" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                    <line x1="0" y1="35" x2="100" y2="35" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                    <line x1="0" y1="55" x2="100" y2="55" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                    
                    {/* Gradient area */}
                    <path
                      d="M0 60 L10 50 L30 42 L60 28 L100 10 L100 60 Z"
                      fill="url(#areaGrad)"
                    />
                    
                    {/* Glowing line */}
                    <motion.path
                      d="M0 60 L10 50 L30 42 L60 28 L100 10"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                    
                    {/* Nodes */}
                    <circle cx="100" cy="10" r="2" fill="#ffffff" />
                    <circle cx="100" cy="10" r="4" fill="none" stroke="#06b6d4" strokeWidth="1" className="animate-ping origin-center" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
                  </svg>
                  
                  {/* Year indicators */}
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-1 px-1">
                    <span>Año 1</span>
                    <span>Año 3</span>
                    <span>Año 5</span>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] text-slate-400">Nuevos Clientes:</span>
                    <span className="text-xs font-black text-white font-mono">{dtcClients.toLocaleString()} /año</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1 rounded overflow-hidden">
                    <div className="bg-cyan-400 h-full w-[35%]" />
                  </div>
                  <span className="text-[8px] text-slate-500 block leading-tight">
                    Tasa de contacto directo post-compra del 35% de lecturas.
                  </span>
                </div>
              </div>

              {/* Card 3: ROI Multiplier Card */}
              <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-5 flex flex-col justify-between h-[310px] text-center relative overflow-hidden group hover:border-cyan-500/20 transition duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full filter blur-[40px] pointer-events-none" />
                
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-500 block">Eficiencia de Inversión</span>
                  <h4 className="text-xs font-black text-white uppercase mt-1 leading-tight">Multiplicador ROI</h4>
                </div>
                
                {/* Gold Multiplier Circle */}
                <div className="my-auto py-2">
                  <div className="w-28 h-28 rounded-full border-4 border-amber-400/20 bg-amber-500/5 flex flex-col items-center justify-center mx-auto relative shadow-[0_0_30px_rgba(245,158,11,0.05)] group-hover:scale-105 group-hover:border-amber-400/40 transition duration-300">
                    <div className="absolute inset-0 rounded-full border border-dashed border-amber-400/30 animate-spin" style={{ animationDuration: "35s" }} />
                    
                    <span className="text-[8px] font-bold text-amber-300 uppercase tracking-widest leading-none">Múltiplo</span>
                    <span className="text-3xl font-black text-white font-mono mt-0.5 tracking-tighter">
                      {roiMultiplier.toFixed(1)}x
                    </span>
                    <span className="text-[8px] text-emerald-400 font-bold uppercase mt-0.5">Retorno Neto</span>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[9px] text-slate-400 px-1 font-mono">
                    <span>{!isReseller ? "Inversión:" : "Costo Compra:"}</span>
                    <span className="text-slate-200 font-bold">${finalInvestment.toLocaleString(undefined, {maximumFractionDigits:0})} USD</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-slate-400 px-1 font-mono">
                    <span>{!isReseller ? "Ahorro Neto:" : "Ganancia Neta:"}</span>
                    <span className="text-emerald-400 font-bold">${finalNetGain.toLocaleString(undefined, {maximumFractionDigits:0})} USD</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Citations Card */}
            <div className="w-full p-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 text-slate-300 text-[10px] leading-relaxed flex flex-col md:flex-row gap-3 items-start md:items-center">
              <span className="text-cyan-400 text-xs font-mono font-black shrink-0 border border-cyan-400/30 px-1.5 py-0.5 rounded bg-cyan-400/10">
                INFO REGIONAL
              </span>
              <div>
                <strong className="text-white block uppercase tracking-wide text-[9px]">{REGION_CITATIONS[exportRegion].source}</strong>
                <span className="text-slate-400 italic">"{REGION_CITATIONS[exportRegion].text}"</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* nexID AI Intelligent Diagnostic Report Card */}
        {/* ========================================== */}
        <div className="mt-8 pt-8 border-t border-white/5 space-y-6 relative">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-cyan-500/5 rounded-full filter blur-[80px] pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Bot className="w-4 h-4 text-cyan-400 animate-pulse" /> Diagnóstico Financiero nexID AI
                </h3>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Estudio predictivo de retorno y amortización de inversión en hardware criptográfico. Actualizado en tiempo real.
              </p>
            </div>
            
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 bg-slate-950/60 px-2.5 py-1 text-[9px] font-mono text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Modelo Cognitivo v4.2 Activo
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Col 1: Metrics summary */}
            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-4">
              <span className="text-[9px] font-black uppercase text-slate-500 block tracking-wider">Métricas de Amortización</span>
              
              <div className="space-y-3">
                {/* Metric 1 */}
                <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3 shadow-inner">
                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wide">Costo de Chips (Consumible)</span>
                  <div className="text-xl font-black text-white font-mono mt-1">${nexIdChipsCost.toLocaleString(undefined, {maximumFractionDigits:0})} USD</div>
                  <p className="text-[8px] text-slate-500 mt-1 leading-normal">
                    *Gasto operativo anual. Chips nuevos no reutilizables por lote.
                  </p>
                </div>

                {/* Metric 2 */}
                <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3 shadow-inner">
                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wide">Ratio de Cobertura Unitario</span>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                    {(chipCost > 0 ? ((retailPrice * (fraudRate / 100) * 0.98) / chipCost) : 0).toFixed(1)}x
                  </div>
                  <p className="text-[8px] text-slate-500 mt-1 leading-normal">
                    Cada chip evita en promedio ${(retailPrice * (fraudRate / 100) * 0.98).toFixed(2)} USD de pérdida.
                  </p>
                </div>

                {/* Metric 3 */}
                <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3 shadow-inner">
                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wide">Amortización por Lote</span>
                  <div className="text-xl font-black text-amber-400 font-mono mt-1">
                    {preventedFraud > 0 ? ((nexIdChipsCost / preventedFraud) * 365).toFixed(1) : "0"} días
                  </div>
                  <p className="text-[8px] text-slate-500 mt-1 leading-normal">
                    Tiempo para recuperar la inversión de hardware del lote de producción.
                  </p>
                </div>
              </div>
            </div>

            {/* Col 2: Dynamic AI Insight paragraph */}
            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-3 h-full min-h-[190px] flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-slate-500 block tracking-wider">Recomendación Estratégica</span>
                <p className="text-xs text-slate-300 leading-relaxed mt-2.5">
                  {fraudRate > 8.0 ? (
                    `⚠️ La tasa de fraude detectada en ${exportRegion === 'latam' ? 'Mendoza / Mercosur' : exportRegion === 'europe_usa' ? 'Europa / EE.UU.' : exportRegion === 'asia' ? 'Asia / Pacífico' : 'Mercado Gris Global'} (${fraudRate.toFixed(1)}%) representa una fuga crítica de capital. Es imperativo utilizar chips premium NTAG 424 DNA con detección de apertura (TagTamper) para neutralizar desvíos y evitar que botellas rellenadas destruyan la reputación premium de la marca.`
                  ) : roiMultiplier > 2.5 ? (
                    `⚡ Tu modelo de negocio muestra una viabilidad excepcional. Con un ROI proyectado de ${roiMultiplier.toFixed(1)}x, el diferencial entre el costo de chip ($${chipCost.toFixed(2)}) y el precio de venta ($${retailPrice} USD) absorbe holgadamente el gasto operativo. Recomendamos iniciar el piloto comercial de inmediato.`
                  ) : (
                    `📈 Con un multiplicador de retorno de ${roiMultiplier.toFixed(1)}x, la implementación de nexID se justifica plenamente. Además de prevenir pérdidas físicas, la activación de canales de interacción directa con el consumidor (estimamos ${Math.round(volume * 0.35).toLocaleString()} escaneos anuales) compensará con creces el costo del hardware a través de fidelización y recompra directa.`
                  )}
                </p>
              </div>
              <div className="text-[8px] text-cyan-400 font-mono flex items-center gap-1 border-t border-white/5 pt-2.5">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                Recomendación adaptada a tus variables financieras actuales.
              </div>
            </div>

            {/* Col 3: Interactive Q&A simulator */}
            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 space-y-4 flex flex-col justify-between min-h-[310px]">
              <div>
                <span className="text-[9px] font-black uppercase text-slate-500 block tracking-wider mb-2.5">Preguntas al Asistente IA</span>
                
                {/* Custom Open-ended query input field */}
                <div className="flex gap-1.5 mb-3">
                  <input
                    type="text"
                    placeholder="Escribe tu pregunta personalizada..."
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customQuery.trim()) {
                        handleCustomQuerySubmit();
                      }
                    }}
                    className="flex-1 bg-slate-950/60 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] text-white placeholder-slate-500 outline-none focus:border-cyan-500/40 transition-colors"
                  />
                  <button
                    onClick={handleCustomQuerySubmit}
                    disabled={!customQuery.trim() || aiThinking}
                    className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded-xl px-2.5 py-1.5 text-[10px] font-bold hover:bg-cyan-500/35 disabled:opacity-40 transition-all shrink-0"
                  >
                    Consultar
                  </button>
                </div>

                <span className="text-[8px] font-bold uppercase text-slate-600 block mb-1.5 tracking-wide">Sugerencias predefinidas:</span>
                <div className="space-y-1.5">
                  {[
                    { id: "non-reusable", q: "¿Por qué cada lote requiere chips nuevos?" },
                    { id: "tagtamper-cost", q: "¿Es rentable TagTamper ($1.00) vs Estándar ($0.50)?" },
                    { id: "payback-period", q: "¿Cómo se calcula la recuperación de inversión?" },
                    { id: "region-influence", q: "¿Por qué influye la tasa de fraude regional?" }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleQuestionSelect(item.id)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${
                        activeQuestion === item.id 
                          ? "bg-cyan-500/10 border-cyan-500/35 text-cyan-300"
                          : "bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200"
                      }`}
                    >
                      {item.q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat answer display area */}
              <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-white/5 min-h-[120px] flex flex-col justify-center">
                {activeQuestion === "" ? (
                  <p className="text-[9.5px] text-slate-500 italic text-center leading-normal">
                    Selecciona una pregunta arriba para ver el análisis de la inteligencia artificial.
                  </p>
                ) : aiThinking ? (
                  <div className="flex flex-col items-center justify-center space-y-2 py-4">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[8px] font-mono text-cyan-400/80 tracking-widest uppercase">AI analizando datos...</span>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-1.5"
                  >
                    <div className="text-[8px] font-mono text-cyan-400 uppercase tracking-widest font-black leading-none">
                      Respuesta nexID AI:
                    </div>
                    <p className="text-[9.5px] text-slate-300 leading-relaxed font-normal">
                      {getAiAnswer(activeQuestion)}
                    </p>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

const DEFAULT_CRM_QUERIES: Record<string, Array<{ id: string; query: string; answer: string; timestamp: string; tag: string; status: "respondido" | "procesando" }>> = {
  bodegas: [
    {
      id: "q-b1",
      query: "Tengo una cena con carne asada y quiero quedar bien. ¿Este blend de Mendoza va bien o me recomiendan el Cabernet Sauvignon de su bodega?",
      answer: "Sí, este Gran Blend 2026 marida de forma excepcional con carnes rojas a la brasa. Si querés una alternativa más estructurada, nuestro Cabernet Sauvignon Reserva es una excelente opción. Además, por convenio, podés adquirirlo con 15% off en el club.",
      timestamp: "19:42:10",
      tag: "Venta Directa",
      status: "respondido"
    },
    {
      id: "q-b2",
      query: "¿Tienen convenios o alianzas con otras bodegas como Catena Zapata o Rutini para visitas guiadas en Luján de Cuyo?",
      answer: "Sí, formamos parte de la Alianza de Cavas Premium de Mendoza. Al presentar tu ticket NFT de nexID, accedés a un 20% de descuento en el tour enológico de Bodega Catena Zapata.",
      timestamp: "19:15:30",
      tag: "Alianza B2B",
      status: "respondido"
    },
    {
      id: "q-b3",
      query: "¿Se puede guardar esta botella en cava por más de 8 años o ya está lista para consumo?",
      answer: "Este lote tiene un potencial de guarda de hasta 10 años en condiciones óptimas (14°C - 16°C, sin luz). Sin embargo, la cosecha actual está en su momento óptimo de maduración para consumo inmediato.",
      timestamp: "18:02:45",
      tag: "Enología",
      status: "respondido"
    }
  ],
  cosmetica: [
    {
      id: "q-c1",
      query: "¿Qué otros productos parecidos recomiendan si tengo piel extremadamente seca y sensible?",
      answer: "Para piel seca, recomendamos complementar Elysian Elixir con nuestra Crema Facial Hidratante Aura con ácido hialurónico. El escaneo de este frasco te otorga un cupón de 10% de descuento para esa compra.",
      timestamp: "19:50:22",
      tag: "Venta Cruzada",
      status: "respondido"
    },
    {
      id: "q-c2",
      query: "¿Tienen convenios de distribución o alianzas exclusivas con cadenas como Sephora o Juleriaque en Latam?",
      answer: "¡Exacto! Juleriaque es nuestro distribuidor oficial en Latam. Escaneando el chip en cualquier sucursal física, podés acumular el doble de puntos de fidelidad en tu pasaporte digital nexID.",
      timestamp: "18:22:12",
      tag: "Distribución",
      status: "respondido"
    },
    {
      id: "q-c3",
      query: "¿Los componentes y esencias que usan para el fijador cumplen con normativas veganas y libres de crueldad?",
      answer: "Absolutamente. Elysian Elixir está certificado como Cruelty-Free y 100% Vegano. Todos los ingredientes cumplen con el estándar REACH europeo de seguridad dermatológica.",
      timestamp: "17:40:05",
      tag: "Sostenibilidad",
      status: "respondido"
    }
  ],
  agro: [
    {
      id: "q-a1",
      query: "Si llueve en unas dos horas, ¿el BioGuard Max 500 resiste el lavado o pierdo la aplicación en el cultivo?",
      answer: "BioGuard Max posee un agente adherente de rápida absorción que se fija en la cutícula foliar en solo 45 minutos. Si la lluvia es menor a 15mm transcurrida una hora, el activo mantiene un 92% de efectividad.",
      timestamp: "19:33:04",
      tag: "Soporte Técnico",
      status: "respondido"
    },
    {
      id: "q-a2",
      query: "¿Tienen convenios con cooperativas locales en Pergamino o Santa Fe para compras a granel de este lote?",
      answer: "Sí, tenemos convenios de distribución directa con la Cooperativa Agrícola de Pergamino y la AFA en Santa Fe. Podes transferir tu token de lote digital directamente a sus cuentas para retirar mercadería.",
      timestamp: "19:10:15",
      tag: "B2B Lead",
      status: "respondido"
    },
    {
      id: "q-a3",
      query: "¿Qué dosis por hectárea recomiendan para un ataque severo de roya en soja?",
      answer: "Para ataques severos detectados (más del 20% de incidencia foliar), sugerimos aplicar 1.8 litros por hectárea, preferentemente en horas de baja radiación solar (mañana o atardecer).",
      timestamp: "18:14:50",
      tag: "Uso de Producto",
      status: "respondido"
    }
  ],
  pharma: [
    {
      id: "q-p1",
      query: "Tengo un resfrío fuerte con fiebre. ¿Este medicamento OncoCure es compatible con analgésicos comunes como el paracetamol?",
      answer: "⚠️ ATENCIÓN: OncoCure es una terapia oncológica de alta especialidad y NO debe usarse para resfríos comunes. Si estás bajo tratamiento con OncoCure, la toma de paracetamol debe ser supervisada por tu médico oncólogo debido a la carga hepática.",
      timestamp: "19:48:19",
      tag: "Médico",
      status: "respondido"
    },
    {
      id: "q-p2",
      query: "¿Tienen alianza o convenio con laboratorios internacionales para asegurar la entrega si hay falta de stock local?",
      answer: "Sí, formamos parte de la red de suministro de emergencia con laboratorios de Frankfurt y Basilea. Al verificar la autenticidad con tu chip nexID, el sistema reserva stock prioritario en aduana en caso de quiebre de inventario.",
      timestamp: "19:05:32",
      tag: "Cadena de Suministro",
      status: "respondido"
    },
    {
      id: "q-p3",
      query: "¿Este lote ON-88392-A cuenta con cobertura y convenios directos de prepagas como OSDE o Swiss Medical?",
      answer: "Sí, OncoCure está incluido en el plan de oncología especial al 100% de cobertura para afiliados de OSDE (Planes 310 en adelante) y Swiss Medical, previa validación del pasaporte digital de cadena de frío.",
      timestamp: "17:55:40",
      tag: "Descuento VIP",
      status: "respondido"
    }
  ],
  eventos: [
    {
      id: "q-e1",
      query: "¿Este VIP Pass me da acceso a la zona de networking con los speakers principales durante el afterparty de cierre?",
      answer: "Sí, los pases VIP Founders tienen acceso exclusivo al cocktail de cierre en el sector VIP Lounge, donde podrás realizar networking directo con los oradores y sponsors del Summit.",
      timestamp: "19:51:02",
      tag: "Acceso VIP",
      status: "respondido"
    },
    {
      id: "q-e2",
      query: "¿Tienen convenios de alojamiento o tarifas corporativas con hoteles cercanos para asistentes que viajamos desde el interior?",
      answer: "Sí, tenemos tarifas preferenciales (15% de descuento) en el Hotel Hilton y el Sheraton Buenos Aires. Podés reclamar tu código de descuento en la pestaña 'Premios' tras verificar tu credencial física.",
      timestamp: "19:20:40",
      tag: "Logística",
      status: "respondido"
    },
    {
      id: "q-e3",
      query: "¿El catering premium Founders de la tarde incluye opciones libres de gluten (apto celíacos) y opciones veganas?",
      answer: "Absolutamente. Contamos con una isla exclusiva de catering certificado Sin TACC y opciones veganas gourmet durante todo el evento. Informale a los camareros de tu rango VIP Founders.",
      timestamp: "18:44:15",
      tag: "Servicios",
      status: "respondido"
    }
  ]
};

const detectTag = (query: string, industry: string): string => {
  const q = query.toLowerCase();
  if (industry === "bodegas") {
    if (q.includes("cena") || q.includes("comida") || q.includes("marida") || q.includes("comer") || q.includes("llevar") || q.includes("quedar bien") || q.includes("precio") || q.includes("comprar")) return "Venta Directa";
    if (q.includes("convenio") || q.includes("alianza") || q.includes("catena") || q.includes("rutini") || q.includes("socios")) return "Alianza B2B";
    return "Enología";
  } else if (industry === "cosmetica") {
    if (q.includes("parecido") || q.includes("crema") || q.includes("otro") || q.includes("rutina") || q.includes("combinar")) return "Venta Cruzada";
    if (q.includes("convenio") || q.includes("distrib") || q.includes("sephora") || q.includes("juleriaque") || q.includes("tienda")) return "Distribución";
    return "Sostenibilidad";
  } else if (industry === "agro") {
    if (q.includes("lluvia") || q.includes("viento") || q.includes("clima") || q.includes("lavado")) return "Soporte Técnico";
    if (q.includes("convenio") || q.includes("cooperativa") || q.includes("pergamino") || q.includes("compras") || q.includes("granel")) return "B2B Lead";
    return "Uso de Producto";
  } else if (industry === "pharma") {
    if (q.includes("resfrio") || q.includes("gripe") || q.includes("tos") || q.includes("tomar") || q.includes("dosis") || q.includes("medico") || q.includes("paracetamol")) return "Médico";
    if (q.includes("laboratorio") || q.includes("falta") || q.includes("stock") || q.includes("entrega")) return "Cadena de Suministro";
    return "Descuento VIP";
  } else {
    if (q.includes("orador") || q.includes("vip") || q.includes("networking") || q.includes("charla") || q.includes("entrar")) return "Acceso VIP";
    if (q.includes("hotel") || q.includes("alojamiento") || q.includes("viaje") || q.includes("donde")) return "Logística";
    return "Servicios";
  }
};

export function InvestorSnapshotClient() {
  const [activeTab, setActiveTab] = useState<"slides" | "playbook" | "downloads">("slides");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [openFaq, setOpenFaq] = useState<string | null>("bodegas-0");
  const [faqCatFilter, setFaqCatFilter] = useState("bodegas");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Mouse tilt states for 3D card parallax
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const tiltRef = useRef<HTMLDivElement>(null);

  // Lifted Multimercado Industry Selector states
  const [selectedIndustry, setSelectedIndustry] = useState<string>("bodegas");
  const [selectedChipModel, setSelectedChipModel] = useState<"tamper" | "dna" | "ntag">("tamper");
  const [volume, setVolume] = useState<number>(150000);
  const [fraudRate, setFraudRate] = useState<number>(4.0);
  const [retailPrice, setRetailPrice] = useState<number>(45);
  const [chipCost, setChipCost] = useState<number>(1.00);
  const [resellPrice, setResellPrice] = useState<number>(1.50);
  const [businessProfile, setBusinessProfile] = useState<"direct" | "reseller">("direct");
  const [exportRegion, setExportRegion] = useState<"latam" | "europe_usa" | "asia" | "grey_market">("latam");

  // Phone Simulator states
  const [simStep, setSimStep] = useState<"idle" | "tapping" | "loading" | "active">("idle");
  const [phoneTab, setPhoneTab] = useState<"validate" | "mint" | "rewards" | "market" | "chat">("validate");
  const [isMinted, setIsMinted] = useState(false);
  const [minting, setMinting] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<Record<string, boolean>>({});

  // Custom AI label states (Demo Preventa Customizer)
  const [customLabelUrl, setCustomLabelUrl] = useState<string | null>(null);
  const [labelPrompt, setLabelPrompt] = useState("");
  const [generatingLabel, setGeneratingLabel] = useState(false);
  const [labelGenError, setLabelGenError] = useState<string | null>(null);
  const [showAiCustomizer, setShowAiCustomizer] = useState(false);

  // Phone Assistant Chat states
  const [phoneChatMessages, setPhoneChatMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: "¡Hola! Soy tu Sommelier AI de Cava. ¿En qué varietal o cata te puedo asesorar hoy?" }
  ]);
  const [phoneChatInput, setPhoneChatInput] = useState("");
  const [phoneChatTyping, setPhoneChatTyping] = useState(false);

  // CRM B2B Real-time Queries states
  const [studioTab, setStudioTab] = useState<"designer" | "crm">("designer");
  const [crmQueries, setCrmQueries] = useState<Array<{ id: string; query: string; answer: string; timestamp: string; tag: string; status: "respondido" | "procesando" }>>([]);
  const [unreadCrmCount, setUnreadCrmCount] = useState(0);

  // Mobile responsiveness and PWA state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Hugging Face config states
  const [showHfySettings, setShowHfySettings] = useState(false);
  const [hfTokenInput, setHfTokenInput] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("hf_api_token");
      if (storedToken) {
        setHfTokenInput(storedToken);
      }
    }
  }, []);

  const getIndustryDefaultChat = (ind: string) => {
    if (ind === "cosmetica") {
      return [{ sender: "bot" as const, text: "¡Hola! Soy tu Asistente de Estilo Aura. ¿En qué fragancia te puedo asesorar hoy?" }];
    } else if (ind === "agro") {
      return [{ sender: "bot" as const, text: "¡Hola! Soy tu Inspector de Lotes nexID. ¿Qué consulta de trazabilidad tenés sobre el lote?" }];
    } else if (ind === "pharma") {
      return [{ sender: "bot" as const, text: "¡Hola! Soy tu Asistente Validante Médico. ¿Qué lote o medicamento deseas verificar hoy?" }];
    } else if (ind === "eventos") {
      return [{ sender: "bot" as const, text: "¡Hola! Soy tu Coordinador de Accesos. ¿Qué duda tenés sobre tu VIP Pass?" }];
    } else {
      return [{ sender: "bot" as const, text: "¡Hola! Soy tu Sommelier AI de Cava. ¿En qué varietal o cata te puedo asesorar hoy?" }];
    }
  };

  // Synchronize preset inputs
  const applyIndustryPreset = (industryName: string) => {
    const preset = INDUSTRY_PRESETS.find(p => p.name === industryName);
    if (preset) {
      setSelectedIndustry(industryName);
      setVolume(preset.volume);
      setFraudRate(preset.fraudRate);
      setRetailPrice(preset.price);
      setSelectedChipModel(preset.defaultChip);
      setChipCost(preset.defaultChipCost);
      setResellPrice(preset.defaultChipCost * 1.5);
      
      if (industryName === "eventos") {
        setExportRegion("latam");
      } else if (industryName === "bodegas" || industryName === "cosmetica") {
        setExportRegion("europe_usa");
      } else if (industryName === "agro") {
        setExportRegion("latam");
      } else {
        setExportRegion("europe_usa");
      }
    }
  };

  useEffect(() => {
    setPhoneChatMessages(getIndustryDefaultChat(selectedIndustry));
    setCustomLabelUrl(null);
    setLabelPrompt("");
    setLabelGenError(null);
    setCrmQueries(DEFAULT_CRM_QUERIES[selectedIndustry] || []);
    setUnreadCrmCount(0);
  }, [selectedIndustry]);

  const renderAiStudio = () => {
    return (
      <div className="flex flex-col h-full justify-between">
        <div className="space-y-3 flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <div>
              <span className="text-[10px] font-black text-white uppercase tracking-wider block leading-none">nexID AI Studio</span>
              <span className="text-[7px] text-slate-500 uppercase tracking-widest block mt-0.5">Control Panel</span>
            </div>
          </div>

          {/* CRM vs. Diseñador Tabs */}
          <div className="flex gap-1 bg-slate-900 p-0.5 rounded-lg border border-white/5">
            <button
              type="button"
              onClick={() => {
                setStudioTab("designer");
                setUnreadCrmCount(0);
              }}
              className={`flex-1 py-1 rounded-md text-[7.5px] font-black uppercase tracking-wider transition ${
                studioTab === "designer" 
                  ? "bg-slate-950 text-amber-400 border border-white/5" 
                  : "text-slate-500 hover:text-slate-350"
              }`}
            >
              🎨 Arte AI
            </button>
            <button
              type="button"
              onClick={() => {
                setStudioTab("crm");
                setUnreadCrmCount(0);
              }}
              className={`flex-1 py-1 rounded-md text-[7.5px] font-black uppercase tracking-wider transition relative ${
                studioTab === "crm" 
                  ? "bg-slate-950 text-cyan-400 border border-white/5" 
                  : "text-slate-500 hover:text-slate-350"
              }`}
            >
              📊 CRM Consultas
              {unreadCrmCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
            </button>
          </div>

          {studioTab === "designer" ? (
            <div className="space-y-3 flex-1 flex flex-col justify-between overflow-y-auto pr-1">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-mono text-slate-400 uppercase block">Diseño de Etiqueta / Arte:</label>
                  <textarea
                    value={labelPrompt}
                    onChange={(e) => setLabelPrompt(e.target.value)}
                    placeholder={
                      selectedIndustry === "bodegas"
                        ? "Ej: Un fénix dorado volando sobre viñas de Mendoza, estilo art decó..."
                        : selectedIndustry === "cosmetica"
                        ? "Ej: Flores silvestres y rocío matutino sobre vidrio dorado, abstracto..."
                        : selectedIndustry === "agro"
                        ? "Ej: Hojas de maíz digitalizadas de neón verde sobre fondo oscuro..."
                        : selectedIndustry === "pharma"
                        ? "Ej: Moléculas flotantes en tonos azules y plateados, estilo laboratorio..."
                        : "Ej: Un pase VIP holográfico con estrellas doradas y patrón geométrico..."
                    }
                    rows={3}
                    className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-[9px] text-white outline-none focus:border-cyan-500 transition-colors resize-none leading-normal font-sans"
                  />
                </div>

                {/* Styles list */}
                <div className="space-y-1">
                  <span className="text-[7.5px] font-mono text-slate-500 uppercase block">Estilos Sugeridos:</span>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { name: "⚡ Cyberpunk", prompt: "A futuristic glowing neon cyber design with holographic elements, 8k" },
                      { name: "👑 Art Decó", prompt: "A minimalist luxury design with golden geometric lines, art deco style" },
                      { name: "🍂 Clásico", prompt: "A vintage traditional premium style, elegant texture, high resolution" },
                      { name: "✨ Abstracto", prompt: "Luxury abstract organic shapes with gold foil, premium modern aesthetic" }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setLabelPrompt(item.prompt)}
                        className="text-[7.5px] bg-slate-900 hover:bg-slate-850 border border-white/5 rounded py-1 text-slate-450 text-center transition truncate"
                        title={item.prompt}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>

                {labelGenError && (
                  <p className="text-[7px] text-amber-400 font-semibold italic bg-amber-500/5 p-1.5 rounded border border-amber-500/10 leading-normal">
                    ⚠️ {labelGenError}. Usando patrón de cava de contingencia.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleGenerateLabel(labelPrompt)}
                disabled={generatingLabel || !labelPrompt.trim()}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-[9.5px] uppercase py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.15)] border border-amber-400/20 mt-2 shrink-0 animate-fade-in"
              >
                {generatingLabel ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Diseñando Arte...</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Generar Arte AI</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col justify-between flex-1 overflow-hidden mt-1">
              <div className="space-y-2 flex-1 overflow-y-auto pr-1 max-h-[310px] scrollbar-thin scrollbar-thumb-slate-850">
                <div className="flex justify-between items-center text-[7.5px] font-mono text-slate-500 uppercase tracking-wider border-b border-white/5 pb-1">
                  <span>Feed de Consultas</span>
                  <span className="text-cyan-400 font-bold animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-455 animate-pulse"></span>
                    En Vivo
                  </span>
                </div>

                {crmQueries.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-[8px] italic leading-normal">
                    Ninguna consulta registrada.<br />
                    Usa el chat del celular simulado para enviar una pregunta.
                  </div>
                ) : (
                  crmQueries.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-900/70 border border-white/5 rounded-lg p-2 space-y-1 text-[8.5px] hover:border-slate-800 transition"
                    >
                      <div className="flex justify-between items-center">
                        <span className={`px-1 rounded-[3px] text-[6.5px] font-mono font-bold leading-none py-0.5 border ${
                          item.tag === "Venta Directa" || item.tag === "Venta Cruzada"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : item.tag === "Alianza B2B" || item.tag === "Distribución" || item.tag === "B2B Lead"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : item.tag === "Médico" || item.tag === "Soporte Técnico" || item.tag === "Acceso VIP"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}>
                          {item.tag}
                        </span>
                        <span className="text-[7px] text-slate-550 font-mono">{item.timestamp}</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-350 font-semibold leading-snug">
                          💬 {item.query}
                        </p>
                        <div className="pl-1.5 border-l border-cyan-500/20 text-slate-400 text-[8px] leading-snug space-y-0.5">
                          <span className="text-cyan-400 font-bold block text-[7px] uppercase tracking-wider">nexID AI Engine:</span>
                          {item.status === "procesando" ? (
                            <span className="text-cyan-400/70 italic animate-pulse block">Procesando respuesta cognitiva...</span>
                          ) : (
                            <span className="block">{item.answer}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-2 text-[7.5px] text-slate-400 leading-normal mt-2 shrink-0">
                💡 <strong>CRM B2B Telemetry:</strong> Almacena al instante lo que tus clientes preguntan al escanear, cruzando convenios de recompra y alianzas de marca en vivo.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleGenerateLabel = async (promptText: string) => {
    if (!promptText.trim()) return;
    setGeneratingLabel(true);
    setLabelGenError(null);
    triggerNfcBeep();

    try {
      const response = await fetch("/api/generate-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          customToken: hfTokenInput,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate label");
      }

      const data = await response.json();
      if (!data.imageUrl) {
        throw new Error("No image URL returned from API");
      }
      setCustomLabelUrl(data.imageUrl);
      triggerSuccessChime();
    } catch (err: any) {
      console.warn("Hugging Face Image Generation failed, falling back to local canvas pattern:", err);
      setLabelGenError(err.message || "Error al conectar con Hugging Face");
      
      // Local premium Malbec gradient pattern fallback
      setTimeout(() => {
        const localCanvas = document.createElement("canvas");
        localCanvas.width = 512;
        localCanvas.height = 512;
        const localCtx = localCanvas.getContext("2d");
        if (localCtx) {
          const grad = localCtx.createLinearGradient(0, 0, 512, 512);
          grad.addColorStop(0, "#4a121a"); // Deep Malbec Red
          grad.addColorStop(0.5, "#180408"); // Grape Black
          grad.addColorStop(1, "#6b21a8"); // Web3 Purple
          localCtx.fillStyle = grad;
          localCtx.fillRect(0, 0, 512, 512);
          
          localCtx.strokeStyle = "rgba(226, 184, 87, 0.2)";
          localCtx.lineWidth = 1;
          for (let i = 0; i < 9; i++) {
            localCtx.beginPath();
            localCtx.arc(256, 256, 40 + i * 20, 0, Math.PI * 2);
            localCtx.stroke();
          }
          
          setCustomLabelUrl(localCanvas.toDataURL("image/jpeg"));
          triggerSuccessChime();
        }
      }, 1200);
    } finally {
      setGeneratingLabel(false);
    }
  };

  const handleSaveToken = (val: string) => {
    setHfTokenInput(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("hf_api_token", val);
    }
  };

  // Interactive bidding and marketplace states
  const [bidsCount, setBidsCount] = useState(3);
  const [myBidAmount, setMyBidAmount] = useState<number | null>(null);
  const [currentBasePrice, setCurrentBasePrice] = useState(0.18);

  // Web Audio Synth for NFC Tap Beep & Success chime
  const playSound = (freq: number, type: "sine" | "triangle" | "sawtooth", duration: number) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio context blocked
    }
  };

  const triggerNfcBeep = () => {
    playSound(880, "sine", 0.15); // high B5 note
  };

  const triggerSuccessChime = () => {
    playSound(523.25, "triangle", 0.1); // C5
    setTimeout(() => {
      playSound(659.25, "triangle", 0.1); // E5
    }, 100);
    setTimeout(() => {
      playSound(783.99, "triangle", 0.2); // G5
    }, 200);
  };

  const startTapSimulation = () => {
    if (simStep !== "idle") return;
    setSimStep("tapping");
    
    // Tap event contact beep
    setTimeout(() => {
      triggerNfcBeep();
      setSimStep("loading");
    }, 700);

    // Active state and success chime
    setTimeout(() => {
      setSimStep("active");
      triggerSuccessChime();
    }, 2000);
  };

  const resetSimulation = () => {
    setSimStep("idle");
    setPhoneTab("validate");
    setIsMinted(false);
    setMinting(false);
    setClaimedRewards({});
    setBidsCount(3);
    setMyBidAmount(null);
    setCurrentBasePrice(0.18);
    setPhoneChatInput("");
    setPhoneChatTyping(false);
    setCustomLabelUrl(null);
    setLabelPrompt("");
    setLabelGenError(null);
    setSelectedIndustry("bodegas");
    setSelectedChipModel("tamper");
    setVolume(150000);
    setFraudRate(4.0);
    setRetailPrice(45);
    setChipCost(1.00);
    setResellPrice(1.50);
    setBusinessProfile("direct");
    setExportRegion("latam");
    setShowAiCustomizer(false);
    setPhoneChatMessages(getIndustryDefaultChat("bodegas"));
  };

  const handlePlaceBid = () => {
    const nextBid = Number((currentBasePrice + 0.01).toFixed(3));
    setCurrentBasePrice(nextBid);
    setBidsCount(prev => prev + 1);
    setMyBidAmount(nextBid);
    triggerSuccessChime();
  };

  const handleSendPhoneMessage = async (msgText: string) => {
    if (!msgText.trim()) return;
    
    const userMsg = { sender: "user" as const, text: msgText };
    setPhoneChatMessages(prev => [...prev, userMsg]);
    setPhoneChatInput("");
    setPhoneChatTyping(true);
    triggerNfcBeep();

    // Create a new CRM query entry in real-time
    const newQueryId = `q-user-${Math.random().toString(36).substr(2, 9)}`;
    const timeStr = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const tag = detectTag(msgText, selectedIndustry);
    
    const newCrmEntry = {
      id: newQueryId,
      query: msgText,
      answer: "Procesando respuesta por Cognitive AI...",
      timestamp: timeStr,
      tag: tag,
      status: "procesando" as const
    };
    
    setCrmQueries(prev => [newCrmEntry, ...prev]);
    if (studioTab !== "crm") {
      setUnreadCrmCount(prev => prev + 1);
    }
    
    try {
      const response = await fetch("/api/cognitive-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: msgText,
          tone: "sommelier-chat",
          industry: selectedIndustry,
          customToken: hfTokenInput
        })
      });
      
      if (!response.ok) throw new Error("API call failed");
      const data = await response.json();
      
      setPhoneChatMessages(prev => [...prev, { sender: "bot", text: data.optimizedText }]);
      setCrmQueries(prev => prev.map(q => q.id === newQueryId ? { ...q, answer: data.optimizedText, status: "respondido" } : q));
      triggerSuccessChime();
    } catch (err) {
      console.warn("Hugging Face API failed or token not set, using local parser:", err);
      
      // Local Industry Chat Fallback
      setTimeout(() => {
        const q = msgText.toLowerCase();
        let reply = "";
        
        if (selectedIndustry === "cosmetica") {
          reply = "Como tu Asistente Aura, te confirmo que Elysian Elixir es 100% original. ¿Quieres consultar sobre las notas olfativas o el cuidado?";
          if (q.includes("nota") || q.includes("aroma") || q.includes("olfativa") || q.includes("olor")) {
            reply = "Elysian Elixir abre con flores de jazmín y azafrán, corazón de ámbar gris y fondo de madera de cedro. Una concentración premium del 30%.";
          } else if (q.includes("cuidado") || q.includes("piel") || q.includes("crema") || q.includes("sensible")) {
            reply = "Nuestros productos son hipoalergénicos e integran principios activos orgánicos con resistencia química testada ante REACH.";
          } else if (q.includes("origen") || q.includes("grasse") || q.includes("donde")) {
            reply = "La esencia se produce en Grasse, Francia, y se fracciona bajo estrictos estándares en laboratorios locales acreditados.";
          } else if (q.includes("parecido") || q.includes("crema") || q.includes("otro") || q.includes("rutina") || q.includes("combinar")) {
            reply = "Para piel extremadamente seca, recomendamos complementar tu rutina con nuestra crema regeneradora Aura. Sephora (nuestro aliado de distribución) tiene stock disponible y obtienes 15% off.";
          } else if (q.includes("convenio") || q.includes("distrib") || q.includes("sephora") || q.includes("juleriaque") || q.includes("tienda")) {
            reply = "Contamos con convenios exclusivos de distribución con Juleriaque y Sephora en toda la región. Podrás canjear puntos de fidelidad en cualquiera de sus locales.";
          }
        } else if (selectedIndustry === "agro") {
          reply = "Como tu Inspector Técnico BioGuard, confirmo que este lote fitosanitario es original. ¿Quieres consultar dosis o el origen?";
          if (q.includes("dosis") || q.includes("aplicar") || q.includes("uso") || q.includes("hectarea")) {
            reply = "BioGuard Max se aplica de forma foliar directa diluyendo 1.5 litros por hectárea en condiciones de viento menor a 10km/h.";
          } else if (q.includes("origen") || q.includes("lote") || q.includes("rosario")) {
            reply = "Este lote fitosanitario fue sintetizado en laboratorio y despachado desde el puerto de Rosario hacia Pergamino, certificado por SENASA.";
          } else if (q.includes("plaga") || q.includes("hongo") || q.includes("enfermedad")) {
            reply = "Controla hongos de suelo y de hoja de amplio espectro, con degradación biodegradable en 14 días sin residuos químicos.";
          } else if (q.includes("lluvia") || q.includes("viento") || q.includes("clima") || q.includes("lavado")) {
            reply = "BioGuard Max 500 incluye polímeros adherentes que resisten el lavado por lluvia transcurridos 45 minutos de la aplicación foliar.";
          } else if (q.includes("convenio") || q.includes("cooperativa") || q.includes("pergamino") || q.includes("compras") || q.includes("granel")) {
            reply = "Tenemos convenios vigentes con la Cooperativa Agrícola de Pergamino y la AFA para entregas a granel con facturación unificada.";
          }
        } else if (selectedIndustry === "pharma") {
          reply = "Como tu Asistente Validante, confirmo la autenticidad y cadena de frío de OncoCure. ¿Quieres auditar la temperatura o el lote?";
          if (q.includes("temperatura") || q.includes("frio") || q.includes("grados") || q.includes("cadena")) {
            reply = "La temperatura histórica se mantuvo constante en 4.8°C (Rango exigido: 2°C a 8°C). No se registran alertas de desviación térmica.";
          } else if (q.includes("lote") || q.includes("origen") || q.includes("frankfurt")) {
            reply = "Lote ON-88392-A sintetizado en Frankfurt, Alemania, e ingresado por Ezeiza con habilitación aduanera y certificado del Ministerio de Salud.";
          } else if (q.includes("seguridad") || q.includes("fda") || q.includes("ema")) {
            reply = "Cumple con las normativas FDA/EMA de serialización y sellado inteligente TagTamper contra falsificación de medicamentos de alto costo.";
          } else if (q.includes("resfrio") || q.includes("gripe") || q.includes("tos") || q.includes("tomar") || q.includes("dosis") || q.includes("medico") || q.includes("paracetamol")) {
            reply = "⚠️ ALERTA: OncoCure es una inmunoterapia oncológica. Para resfríos, sugerimos usar paracetamol o antigripales certificados de laboratorios de nuestra red.";
          } else if (q.includes("convenio") || q.includes("prepaga") || q.includes("cobertura") || q.includes("osde")) {
            reply = "Este lote cuenta con cobertura del 100% de la cartilla oncológica para afiliados de OSDE (planes 310 en adelante) y Swiss Medical.";
          }
        } else if (selectedIndustry === "eventos") {
          reply = "Como tu Coordinador de Accesos, te confirmo que este VIP Pass es 100% auténtico. ¿Quieres consultar accesos o el catering?";
          if (q.includes("acceso") || q.includes("sector") || q.includes("entrar") || q.includes("donde")) {
            reply = "Tu credencial otorga acceso al Sector VIP Front Row, charlas plenarias y VIP Lounge. Solo debes hacer tap en los molinetes.";
          } else if (q.includes("catering") || q.includes("comida") || q.includes("bebida")) {
            reply = "El catering premium Founders está incluido de 12:00 a 18:00, con cocktail y barra libre en el afterparty de cierre.";
          } else if (q.includes("agenda") || q.includes("charla") || q.includes("horario")) {
            reply = "La acreditación inicia a las 09:00. Las charlas principales comienzan a las 10:00 y el cocktail de networking a las 18:30.";
          } else if (q.includes("hotel") || q.includes("alojamiento") || q.includes("viaje")) {
            reply = "Contamos con convenios y tarifas corporativas en el Hotel Hilton y el Sheraton Buenos Aires para todos los asistentes del Summit.";
          }
        } else {
          reply = "Como Sommelier AI de nexID, te confirmo que este Gran Blend 2026 es 100% auténtico. ¿Te gustaría saber de su maridaje o notas de cata?";
          if (q.includes("maridaje") || q.includes("comida") || q.includes("comer") || q.includes("marida")) {
            reply = "Este Gran Blend 2026 de Luján de Cuyo marida de forma excepcional con carnes rojas a la brasa, empanadas criollas y quesos duros maduros. Servir a 17°C.";
          } else if (q.includes("cata") || q.includes("notas") || q.includes("sabor") || q.includes("olor") || q.includes("aroma")) {
            reply = "En copa presenta un color rojo rubí profundo con reflejos violáceos. En nariz sobresalen notas a ciruelas negras, vainilla y chocolate amargo de la madera.";
          } else if (q.includes("origen") || q.includes("mendoza") || q.includes("viñedo") || q.includes("donde")) {
            reply = "Las uvas provienen de un viñedo exclusivo a 1.100 msnm en Luján de Cuyo, Mendoza. La amplitud térmica del desierto aporta frescura y concentración única.";
          } else if (q.includes("blockchain") || q.includes("token") || q.includes("nft") || q.includes("web3")) {
            reply = "Cada botella posee un gemelo digital registrado en Polygon Amoy. Esto certifica que el lote es original y te permite reclamar beneficios y airdrops.";
          } else if (q.includes("cena") || q.includes("quedar bien") || q.includes("llevar") || q.includes("impresionar")) {
            reply = "Para una cena especial, este Gran Blend 2026 es la elección perfecta para quedar bien. Si buscas complementar, tenemos convenio con Catena Zapata para su Malbec premium.";
          } else if (q.includes("convenio") || q.includes("alianza") || q.includes("catena") || q.includes("rutini")) {
            reply = "Contamos con una alianza con la red de bodegas de Luján de Cuyo, incluyendo preventas exclusivas cruzadas con Catena Zapata y Rutini.";
          }
        }
        
        setPhoneChatMessages(prev => [...prev, { sender: "bot", text: reply }]);
        setCrmQueries(prev => prev.map(q => q.id === newQueryId ? { ...q, answer: reply, status: "respondido" } : q));
        triggerSuccessChime();
      }, 1200);
    } finally {
      setPhoneChatTyping(false);
    }
  };

  const handleMintNft = () => {
    if (minting || isMinted) return;
    setMinting(true);
    playSound(440, "sawtooth", 0.5); // processing rumble
    
    setTimeout(() => {
      setMinting(false);
      setIsMinted(true);
      triggerSuccessChime();
    }, 2200);
  };

  const handleClaimReward = (id: string) => {
    if (claimedRewards[id]) return;
    setClaimedRewards(prev => ({ ...prev, [id]: true }));
    triggerSuccessChime();
  };

  // Card Parallax Tilt handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tiltRef.current) return;
    const rect = tiltRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    // Cap rotation to 8 degrees
    setTiltY((x / (rect.width / 2)) * 8);
    setTiltX(-(y / (rect.height / 2)) * 8);
  };

  const handleMouseLeave = () => {
    setTiltX(0);
    setTiltY(0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 lg:py-16 space-y-12 relative">
      
      {/* Background Neon Orbs */}
      <div className="absolute top-[10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-[150px] pointer-events-none" />

      {/* Premium Header */}
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 border-b border-white/5 pb-10 relative">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-cyan-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            Interactive Investor Hub
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-white uppercase leading-none bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
            nexID: Ecosistema Híbrido
          </h1>
          <p className="text-sm lg:text-base text-slate-400 max-w-3xl leading-relaxed">
            Una plataforma de trazabilidad de alto rendimiento. Base de datos centralizada segura por defecto, con opción de registro digital para colecciones exclusivas.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-950/80 p-2 rounded-2xl border border-white/10 gap-1.5 shrink-0 self-stretch lg:self-auto shadow-2xl backdrop-blur-md">
          {[
            { id: "slides", label: "Slides Pitch", icon: Layers },
            { id: "playbook", label: "Playbook Objeciones", icon: HelpIcon },
            { id: "downloads", label: "PDFs", icon: Download }
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  triggerNfcBeep();
                }}
                className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                  isActive 
                    ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.15)]" 
                    : "text-slate-400 hover:text-white border border-transparent hover:bg-white/[0.03]"
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Split Interactive Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative">
        
        {/* Left Column (Content Canvas) */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {activeTab === "slides" && (
              <motion.div
                key="slides"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/90 to-slate-900/60 p-8 lg:p-10 min-h-[460px] flex flex-col justify-between shadow-2xl relative overflow-hidden backdrop-blur-md">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full filter blur-[100px] pointer-events-none" />
                  
                  {/* Slide header info */}
                  <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5 pb-4">
                    <span>{slides[currentSlide].title}</span>
                    <span className="text-cyan-400">Slide {currentSlide + 1} de {slides.length}</span>
                  </div>

                  {/* Slide core layout */}
                  <div className="my-auto py-6 space-y-6">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 block">
                      {slides[currentSlide].tagline}
                    </span>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight leading-none">
                      {slides[currentSlide].title.split(") ")[1] || slides[currentSlide].title}
                    </h2>
                    
                    <div className="grid gap-4 pt-2">
                      {slides[currentSlide].bullets.map((bullet, idx) => (
                        <div key={idx} className="flex items-start gap-4 text-sm text-slate-300 leading-relaxed group">
                          <span className="h-6 w-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                            {idx + 1}
                          </span>
                          <span className="group-hover:text-white transition-colors">{bullet}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Slide controls */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-4">
                    <button
                      onClick={() => {
                        setCurrentSlide(prev => Math.max(0, prev - 1));
                        triggerNfcBeep();
                      }}
                      disabled={currentSlide === 0}
                      className="text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </button>

                    <div className="flex gap-2">
                      {slides.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setCurrentSlide(idx);
                            triggerNfcBeep();
                          }}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${
                            currentSlide === idx 
                              ? "bg-cyan-400 w-6 shadow-[0_0_10px_rgba(6,182,212,0.6)]" 
                              : "bg-white/10 hover:bg-white/20"
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1));
                        triggerNfcBeep();
                      }}
                      disabled={currentSlide === slides.length - 1}
                      className="text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2"
                    >
                      Siguiente <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Additional Pitch Metrics Widget */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { title: "Arquitectura", value: "Capa Híbrida", desc: "Nube default + Registro Digital" },
                    { title: "Soporte Nube", value: "AWS / Render", desc: "Redundancia multinodo" },
                    { title: "Costo por Unidad", value: "Centavos USD", desc: "<1.5% del valor minorista" }
                  ].map((item, idx) => (
                    <div key={idx} className="rounded-2xl border border-white/5 bg-slate-900/10 hover:bg-slate-900/30 p-4 text-center transition duration-200">
                      <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">{item.title}</span>
                      <strong className="text-base text-white font-black mt-1 block">{item.value}</strong>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "playbook" && (
              <motion.div
                key="playbook"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                {/* FAQ categories grid selector */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {faqCategories.map((cat) => {
                    const CatIcon = cat.icon;
                    const isSelected = faqCatFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setFaqCatFilter(cat.id);
                          setOpenFaq(`${cat.id}-0`);
                          triggerNfcBeep();
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all gap-2 ${
                          isSelected 
                            ? "bg-purple-500/10 border-purple-500/40 text-purple-300 shadow-lg" 
                            : "bg-slate-900/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10"
                        }`}
                      >
                        <CatIcon className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-wider leading-none">{cat.label.split(" & ")[0]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* FAQs Container */}
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-2xl space-y-4 flex-1 backdrop-blur-md">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
                    <BookOpen className="w-4 h-4 text-purple-400" /> Respuestas Argumentativas de Venta
                  </h3>

                  <div className="space-y-3">
                    {faqCategories.find(c => c.id === faqCatFilter)?.items.map((item, idx) => {
                      const uniqueId = `${faqCatFilter}-${idx}`;
                      const isOpen = openFaq === uniqueId;
                      return (
                        <div 
                          key={idx}
                          className={`rounded-xl border transition-all duration-300 ${
                            isOpen ? "border-purple-500/40 bg-purple-950/10" : "border-white/5 bg-slate-900/10 hover:border-white/10"
                          }`}
                        >
                          <button
                            onClick={() => {
                              setOpenFaq(isOpen ? null : uniqueId);
                              triggerNfcBeep();
                            }}
                            className="w-full flex items-center justify-between gap-4 p-4 text-left font-black text-xs uppercase text-white tracking-wide"
                          >
                            <span>{item.q}</span>
                            <span className="shrink-0 text-slate-500 font-bold transition-transform duration-300" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>
                              ▼
                            </span>
                          </button>
                          
                          {isOpen && (
                            <div className="p-4 pt-0 border-t border-white/5 space-y-3 text-xs text-slate-300 leading-relaxed">
                              <p>{item.a}</p>
                              {item.ctx && (
                                <div className="rounded-xl bg-slate-950/80 p-3.5 border-l-2 border-cyan-400/40 flex gap-3 items-start shadow-inner">
                                  <span className="text-cyan-400 shrink-0 text-xs font-mono font-black">ℹ</span>
                                  <p className="text-[11px] text-slate-400 italic leading-relaxed">{item.ctx}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "downloads" && (
              <motion.div
                key="downloads"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6 flex-1 flex flex-col justify-center"
              >
                <div className="rounded-3xl border border-white/10 bg-slate-950/85 p-10 shadow-2xl text-center space-y-8 backdrop-blur-md max-w-xl mx-auto w-full">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 flex items-center justify-center text-3xl mx-auto shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                    📂
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Descarga de PDFs Premium</h2>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                      Material oficial exportado con las mejores herramientas vectoriales. Listo para adjuntar en correos comerciales o presentar en reuniones.
                    </p>
                  </div>

                  <div className="grid gap-4 max-w-md mx-auto pt-2">
                    <a
                      href="/nexid_pitch_deck.pdf"
                      download="nexid_pitch_deck.pdf"
                      onClick={triggerSuccessChime}
                      className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-slate-900/40 hover:bg-slate-900 text-xs font-bold uppercase tracking-wider text-white hover:border-cyan-500/30 hover:shadow-lg transition-all"
                    >
                      <span className="flex items-center gap-3">
                        <span className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-300">📊</span>
                        <span>nexID Pitch Deck (Apaisado)</span>
                      </span>
                      <Download className="w-4 h-4 text-cyan-400" />
                    </a>

                    <a
                      href="/nexid_sales_playbook.pdf"
                      download="nexid_sales_playbook.pdf"
                      onClick={triggerSuccessChime}
                      className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-slate-900/40 hover:bg-slate-900 text-xs font-bold uppercase tracking-wider text-white hover:border-purple-500/30 hover:shadow-lg transition-all"
                    >
                      <span className="flex items-center gap-3">
                        <span className="p-2.5 rounded-lg bg-purple-500/10 text-purple-300">📖</span>
                        <span>Playbook & FAQs (Retrato)</span>
                      </span>
                      <Download className="w-4 h-4 text-purple-400" />
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column (The 3D Parallax NFC Simulator Arena) */}
        <div className="lg:col-span-5 flex">
          <div 
            ref={tiltRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="w-full rounded-3xl border border-white/10 bg-slate-950/80 p-6 lg:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between backdrop-blur-md transition-transform duration-200"
            style={{ 
              transform: `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
            }}
          >
            {/* Glossy overlay reflection */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.03] pointer-events-none" />

            {/* Arena Header */}
            <div className="w-full flex items-center justify-between border-b border-white/5 pb-4 mb-4 z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                Live Demo Arena
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Audio</span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1.5 rounded-lg border border-white/10 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title="Activar/Desactivar Audio"
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setShowHfySettings(!showHfySettings)}
                  className={`p-1.5 rounded-lg border transition ${showHfySettings ? "border-purple-500/50 bg-purple-500/10 text-purple-300 shadow-md" : "border-white/10 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850"}`}
                  title="Configurar Hugging Face API"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Collapsible Hugging Face Settings Card */}
            {showHfySettings && (
              <div className="w-full mb-4 p-4 rounded-2xl border border-purple-500/25 bg-purple-950/10 text-slate-300 space-y-2.5 z-10 shadow-lg relative">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    🤗 Configuración Hugging Face API
                  </span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono ${hfTokenInput ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                    {hfTokenInput ? "LLM LIVE CONECTADO" : "HEURÍSTICAS LOCALES"}
                  </span>
                </div>
                <p className="text-[9px] text-slate-400 leading-normal">
                  Pega tu API Token de Hugging Face (gratuito) para habilitar respuestas reales mediante el modelo Qwen en la pestaña AI Chat. Si se deja en blanco, la demo usará heurísticas enológicas locales.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="hf_..."
                    value={hfTokenInput}
                    onChange={(e) => handleSaveToken(e.target.value)}
                    className="flex-1 bg-slate-950/70 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500 transition-colors font-mono"
                  />
                  {hfTokenInput && (
                    <button
                      onClick={() => handleSaveToken("")}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition font-bold"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Industry Preset Selector Tabs */}
            <div className="flex flex-wrap gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5 mb-4 shrink-0 z-10">
              {INDUSTRY_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyIndustryPreset(preset.name)}
                  className={`flex-1 min-w-[70px] py-2 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    selectedIndustry === preset.name
                      ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-300 shadow-lg"
                      : "text-slate-400 hover:text-white border border-transparent"
                  }`}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>

            {/* Tap Stage */}
            <div className="w-full h-[520px] relative border border-white/5 bg-slate-950/60 rounded-2xl overflow-hidden flex items-center justify-center z-10 shadow-inner">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none" />

              {/* nexID AI Studio (Administrative B2B Customizer) */}
              <AnimatePresence>
                {!isMobile && simStep === "active" && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ type: "spring", stiffness: 120, damping: 15 }}
                    className="absolute right-4 top-4 bottom-4 w-[220px] bg-slate-950/95 border border-white/10 rounded-2xl p-4 flex flex-col justify-between backdrop-blur-md z-20 shadow-2xl"
                  >
                    {renderAiStudio()}
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Bottle floating container */}
              <div className={
                isMobile
                  ? simStep === "active"
                    ? "absolute top-2 left-4 w-[60px] h-[90px] flex items-center justify-center bg-white/[0.01] border border-white/5 rounded-xl opacity-20 pointer-events-none transition-all duration-300 z-10"
                    : "absolute top-4 left-1/2 -translate-x-1/2 w-[140px] h-[220px] flex items-center justify-center bg-white/[0.01] border border-white/5 rounded-3xl backdrop-blur-sm transition-all duration-300 z-10"
                  : "absolute left-[4%] w-[160px] h-[450px] flex items-center justify-center bg-white/[0.01] border border-white/5 rounded-3xl backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden transition-all duration-300"
              }>
                <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 via-transparent to-transparent pointer-events-none" />
                <ThreeDProduct 
                  active={simStep === "active"} 
                  tapping={simStep === "tapping" || simStep === "loading"} 
                  labelImageUrl={customLabelUrl}
                  industry={selectedIndustry}
                  chipModel={selectedChipModel}
                />
                
                {/* Contact Ripple point */}
                {simStep === "loading" && (
                  <motion.div 
                    initial={{ scale: 0.1, opacity: 1 }}
                    animate={{ scale: 5, opacity: 0 }}
                    transition={{ duration: 0.8, repeat: 1 }}
                    className={
                      isMobile 
                        ? "absolute top-[35%] w-6 h-6 rounded-full border-2 border-cyan-400 bg-cyan-400/20 z-20"
                        : "absolute top-[22%] w-10 h-10 rounded-full border-2 border-cyan-400 bg-cyan-400/20 z-20"
                    }
                  />
                )}
              </div>

              {/* Simulated iPhone Frame */}
              <motion.div
                animate={
                  isMobile
                    ? simStep === "idle"
                      ? { x: 0, y: 110, rotate: 0, scale: 0.85 }
                      : simStep === "tapping"
                      ? { x: 0, y: -40, rotate: 0, scale: 0.95 }
                      : { x: 0, y: 0, rotate: 0, scale: 1.05 } // Centered on mobile
                    : simStep === "idle"
                    ? { x: 105, y: -10, rotate: 8, scale: 0.95 }
                    : simStep === "tapping"
                    ? { x: -20, y: -70, rotate: -20, scale: 1.02 }
                    : { x: 45, y: 0, rotate: 0, scale: 1.1 } // Centered & zoomed in active state
                }
                transition={
                  simStep === "tapping"
                    ? { type: "spring", stiffness: 220, damping: 14 }
                    : { type: "spring", stiffness: 100, damping: 18 }
                }
                className="absolute right-[8%] w-[270px] h-[460px] border-[8px] border-slate-800 rounded-[40px] bg-slate-950 shadow-2xl z-20 flex flex-col items-center justify-between overflow-hidden shadow-cyan-500/5"
              >
                {/* iPhone Bezel notch */}
                <div className="w-28 h-5 bg-slate-900 rounded-b-2xl absolute top-0 z-30 flex items-center justify-center">
                  <div className="w-10 h-1 bg-slate-800 rounded-full mb-1" />
                </div>
                
                {simStep === "idle" && (
                  <div className="text-center p-4 my-auto space-y-4">
                    <Smartphone className="w-14 h-14 mx-auto text-slate-500 animate-pulse" />
                    <span className="text-xs font-black uppercase text-slate-400 block tracking-widest leading-none">Acercá para Tap</span>
                  </div>
                )}

                {simStep === "tapping" && (
                  <div className="text-center p-4 my-auto">
                    <Zap className="w-12 h-12 mx-auto text-cyan-400 animate-pulse" />
                    <span className="text-xs font-black uppercase text-cyan-300 block tracking-widest mt-2">Leyendo Chip</span>
                  </div>
                )}

                {simStep === "loading" && (
                  <div className="text-center my-auto space-y-2">
                    <RefreshCw className="w-10 h-10 mx-auto text-purple-400 animate-spin" />
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Verificando...</span>
                  </div>
                )}

                {simStep === "active" && (() => {
                  const simData = INDUSTRY_SIM_DETAILS[selectedIndustry] || INDUSTRY_SIM_DETAILS.bodegas;
                  return (
                    <div className="w-full h-full bg-[#020617] flex flex-col justify-between p-4 pt-10 relative select-none">
                      
                      {/* Status bar */}
                      <div className="absolute top-1.5 left-4 right-4 flex justify-between items-center text-[8px] text-slate-500 font-mono">
                        <span>12:00</span>
                        <div className="flex gap-1.5 items-center">
                          <span>5G</span>
                          <div className="w-3.5 h-2.5 border border-slate-600 rounded-sm bg-emerald-500" />
                        </div>
                      </div>

                      <div className="text-center shrink-0 border-b border-white/5 pb-2">
                        <span className="text-[10px] font-black tracking-widest text-cyan-400 block uppercase">nexID VIP PORTAL</span>
                        <strong className="text-[14px] text-white block mt-0.5 uppercase truncate leading-none">{simData.productName}</strong>
                        <span className="text-[9px] text-slate-500 uppercase font-mono tracking-wider mt-0.5 block">{simData.location}</span>
                      </div>

                      {/* Sim Phone Screen Content */}
                      <div className="flex-1 my-3 rounded-lg bg-slate-900/60 p-3 flex flex-col justify-between text-xs leading-relaxed text-slate-300 overflow-y-auto">
                        {phoneTab === "validate" && (
                          <div className="space-y-3.5 w-full text-left my-auto">
                            <div className="flex items-center gap-2 border-b border-white/5 pb-2 justify-center">
                              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 filter drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]" />
                              <div>
                                <span className="text-[11px] font-black text-white uppercase block leading-none">{simData.authText}</span>
                                <span className="text-[9px] text-emerald-400 uppercase font-bold leading-none mt-0.5 block">{simData.selloText}</span>
                              </div>
                            </div>
                            
                            {/* Mini SVG Map */}
                            {/* Mini SVG Map */}
                            <div className="w-full h-[75px] rounded-lg bg-slate-950/90 border border-cyan-500/10 relative p-1.5 flex flex-col justify-between overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]">
                              <div className="flex justify-between items-center px-1 text-[7.5px] text-slate-500 uppercase font-black tracking-wider z-10">
                                <span>Trazabilidad de Ruta</span>
                                <span className="text-cyan-400 animate-pulse flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ping" />
                                  En Tránsito Live
                                </span>
                              </div>
                              <svg className="w-full h-[40px] relative z-10" viewBox="0 0 160 40" preserveAspectRatio="none">
                                <defs>
                                  {/* Grid pattern */}
                                  <pattern id="phone-map-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                    <path d="M 10 0 H 0 V 10" fill="none" stroke="rgba(6,182,212,0.08)" strokeWidth="0.45" />
                                  </pattern>
                                  <pattern id="phone-map-grid-fine" width="4" height="4" patternUnits="userSpaceOnUse">
                                    <path d="M 4 0 H 0 V 4" fill="none" stroke="rgba(148,163,184,0.035)" strokeWidth="0.35" />
                                  </pattern>
                                  {/* Radar Sweep Gradient */}
                                  <linearGradient id="phone-radar-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
                                    <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.12" />
                                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                                  </linearGradient>
                                  <linearGradient id="phone-route-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                                    <stop offset="48%" stopColor="#22d3ee" stopOpacity="0.95" />
                                    <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.82" />
                                  </linearGradient>
                                  <radialGradient id="phone-comet-gradient" cx="40%" cy="40%" r="70%">
                                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                                    <stop offset="45%" stopColor="#22d3ee" stopOpacity="0.88" />
                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                                  </radialGradient>
                                  {/* Soft Glow Filter */}
                                  <filter id="phone-soft-glow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                                    <feMerge>
                                      <feMergeNode in="blur" />
                                      <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                  </filter>
                                </defs>

                                {/* Background Grid */}
                                <rect width="160" height="40" fill="url(#phone-map-grid)" />
                                <rect width="160" height="40" fill="url(#phone-map-grid-fine)" opacity="0.8" />

                                {/* Radar Sweep Bar */}
                                <rect width="40" height="40" fill="url(#phone-radar-gradient)">
                                  <animate attributeName="x" values="-40;160" dur="2.5s" repeatCount="indefinite" />
                                </rect>

                                <g transform="translate(86 20)" opacity="0.42">
                                  <circle r="17" fill="none" stroke="#22d3ee" strokeWidth="0.4" strokeDasharray="2 4" />
                                  <line x1="-22" x2="22" y1="0" y2="0" stroke="#22d3ee" strokeWidth="0.35" />
                                  <line x1="0" x2="0" y1="-22" y2="22" stroke="#22d3ee" strokeWidth="0.35" />
                                  <g>
                                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite" />
                                    <line x1="0" y1="0" x2="21" y2="0" stroke="#67e8f9" strokeWidth="0.7" strokeLinecap="round" opacity="0.85" />
                                  </g>
                                </g>

                                {/* Grid lines */}
                                <line x1="0" y1="20" x2="160" y2="20" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
                                <line x1="80" y1="0" x2="80" y2="40" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
                                
                                {/* Route Path */}
                                <path id="sim-phone-path" d="M20 30 Q50 10 90 25 T140 10" fill="none" stroke="url(#phone-route-gradient)" strokeWidth="1.35" strokeDasharray="3,3" opacity="0.86">
                                  <animate attributeName="stroke-dashoffset" values="0;-36" dur="2.4s" repeatCount="indefinite" />
                                </path>
                                
                                {/* Glowing path segment for current transit */}
                                <path d="M20 30 Q50 10 70 17" fill="none" stroke="#f59e0b" strokeWidth="1.8" filter="url(#phone-soft-glow)" opacity="0.78">
                                  <animate attributeName="opacity" values="0.32;0.86;0.32" dur="2.2s" repeatCount="indefinite" />
                                </path>
                                
                                {/* Animated Comet/Particle gliding along the route path */}
                                <circle r="4.4" fill="url(#phone-comet-gradient)" filter="url(#phone-soft-glow)">
                                  <animateMotion dur="3.5s" repeatCount="indefinite">
                                    <mpath href="#sim-phone-path" />
                                  </animateMotion>
                                </circle>
                                <circle r="1.8" fill="#f59e0b" opacity="0.5">
                                  <animateMotion dur="3.5s" begin="-0.18s" repeatCount="indefinite">
                                    <mpath href="#sim-phone-path" />
                                  </animateMotion>
                                </circle>
                                <circle r="1.2" fill="#a78bfa" opacity="0.45">
                                  <animateMotion dur="3.5s" begin="-0.34s" repeatCount="indefinite">
                                    <mpath href="#sim-phone-path" />
                                  </animateMotion>
                                </circle>

                                {/* Intermediate Nodes */}
                                {[{ x: 60, y: 18, c: "#f59e0b" }, { x: 100, y: 22, c: "#06b6d4" }].map((node, nodeIdx) => (
                                  <g key={`phone-relay-${nodeIdx}`}>
                                    <circle cx={node.x} cy={node.y} r="2.5" fill={node.c} />
                                    <circle cx={node.x} cy={node.y} r="3" fill="none" stroke={node.c} strokeWidth="0.65">
                                      <animate attributeName="r" values="3;8;3" dur="2.2s" begin={`${nodeIdx * 0.55}s`} repeatCount="indefinite" />
                                      <animate attributeName="opacity" values="0.72;0;0.72" dur="2.2s" begin={`${nodeIdx * 0.55}s`} repeatCount="indefinite" />
                                    </circle>
                                  </g>
                                ))}
                                
                                {/* Pulse rings for Origin */}
                                <circle cx="20" cy="30" r="3" fill="#f59e0b" />
                                <circle cx="20" cy="30" r="3" fill="none" stroke="#f59e0b" strokeWidth="0.8">
                                  <animate attributeName="r" values="3;9" dur="1.8s" repeatCount="indefinite" />
                                  <animate attributeName="opacity" values="1;0" dur="1.8s" repeatCount="indefinite" />
                                </circle>

                                {/* Pulse rings for Destination */}
                                <circle cx="140" cy="10" r="3" fill="#06b6d4" />
                                <circle cx="140" cy="10" r="3" fill="none" stroke="#06b6d4" strokeWidth="0.8">
                                  <animate attributeName="r" values="3;9" dur="1.8s" repeatCount="indefinite" />
                                  <animate attributeName="opacity" values="1;0" dur="1.8s" repeatCount="indefinite" />
                                </circle>
                                {[{ x: 36, y: 11, dx: 13, dy: 7, c: "#22d3ee" }, { x: 121, y: 29, dx: -16, dy: -5, c: "#a78bfa" }, { x: 74, y: 33, dx: 10, dy: -12, c: "#34d399" }].map((particle, pidx) => (
                                  <circle key={`phone-particle-${pidx}`} cx={particle.x} cy={particle.y} r="1.05" fill={particle.c} opacity="0.28">
                                    <animate attributeName="cx" values={`${particle.x};${particle.x + particle.dx};${particle.x}`} dur={`${3.1 + pidx * 0.6}s`} begin={`${pidx * 0.4}s`} repeatCount="indefinite" />
                                    <animate attributeName="cy" values={`${particle.y};${particle.y + particle.dy};${particle.y}`} dur={`${3.1 + pidx * 0.6}s`} begin={`${pidx * 0.4}s`} repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="0.08;0.64;0.08" dur={`${3.1 + pidx * 0.6}s`} begin={`${pidx * 0.4}s`} repeatCount="indefinite" />
                                  </circle>
                                ))}
                              </svg>
                              <div className="flex justify-between text-[6.5px] text-slate-400 font-mono leading-none px-1">
                                <span>{simData.nodes[0]}</span>
                                <span>{simData.nodes[1]}</span>
                                <span>{simData.nodes[2]}</span>
                                <span>{simData.nodes[3]}</span>
                              </div>
                            </div>
                            
                            {/* Live Telemetry Info ticker */}
                            <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-md p-1.5 text-[8px] font-mono text-cyan-300 flex justify-between items-center leading-none">
                              <span>{simData.iot[0]}</span>
                              <span>{simData.iot[1]}</span>
                              <span>{simData.iot[2]}</span>
                            </div>
                            
                            {/* Timeline steps */}
                            <div className="space-y-2 relative pl-3 border-l border-white/10 ml-2 text-[9px] leading-tight">
                              <div className="relative">
                                <span className="absolute -left-[16.5px] top-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[6px] text-white font-bold">✓</span>
                                <span className="font-bold text-slate-300 uppercase block leading-none">{simData.steps[0].title}</span>
                                <span className="text-slate-400 block mt-0.5 leading-none">{simData.steps[0].desc}</span>
                              </div>
                              
                              <div className="relative">
                                <span className="absolute -left-[16.5px] top-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[6px] text-white font-bold">✓</span>
                                <span className="font-bold text-slate-300 uppercase block leading-none">{simData.steps[1].title}</span>
                                <span className="text-slate-400 block mt-0.5 leading-none">{simData.steps[1].desc}</span>
                              </div>
                              
                              <div className="relative">
                                <span className="absolute -left-[16.5px] top-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[6px] text-white font-bold">✓</span>
                                <span className="font-bold text-slate-300 uppercase block leading-none">{simData.steps[2].title}</span>
                                <span className="text-emerald-400 font-bold block mt-0.5 leading-none">{simData.steps[2].desc}</span>
                              </div>
                            </div>

                            {/* Details card */}
                            <div className="pt-2 border-t border-white/5 text-[9px] bg-slate-950/50 p-2 rounded-lg space-y-1.5">
                              <div className="flex justify-between items-center text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                                <span>{simData.detailsTitle}</span>
                                <span className="text-amber-400">{simData.detailsTagline}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8.5px]">
                                {simData.detailsGrid.map((gridItem, gidx) => (
                                  <div key={gidx}>
                                    <span className="text-slate-500 block">{gridItem.label}</span>
                                    <span className="text-slate-200 font-bold">{gridItem.val}</span>
                                  </div>
                                ))}
                              </div>
                              <p className="text-[7.5px] text-slate-400 leading-tight italic border-t border-white/5 pt-1">
                                {simData.detailsQuote}
                              </p>
                            </div>
                          </div>
                        )}

                        {phoneTab === "mint" && (
                          <div className="space-y-3.5 w-full text-center my-auto">
                            {isMinted ? (
                              <div className="space-y-2.5 p-1 bg-slate-950/40 rounded-xl border border-white/5">
                                <Award className="w-8 h-8 mx-auto text-purple-400 filter drop-shadow-[0_0_8px_rgba(168,85,247,0.3)]" />
                                <div>
                                  <p className="font-black text-white text-[11px] uppercase leading-none">Propiedad Digital Registrada</p>
                                  <span className="text-[8px] text-emerald-400 font-bold mt-1 block">Inmutable · Polygon Ledger</span>
                                </div>
                                <div className="text-[8px] font-mono text-slate-300 bg-slate-950 p-2 rounded border border-white/5 text-left space-y-1">
                                  <div className="flex justify-between">
                                    <span>Token ID:</span>
                                    <span className="text-purple-300">#84920</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Billetera:</span>
                                    <span className="text-slate-400 truncate w-[100px] text-right">0x8a92...11d9</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Tx Hash:</span>
                                    <span className="text-cyan-400 truncate w-[100px] text-right cursor-pointer hover:underline">0xbc79...2fa8</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Bloque:</span>
                                    <span className="text-slate-400">#38104822</span>
                                  </div>
                                </div>
                                <span className="text-[7.5px] text-slate-500 block leading-tight">
                                  {simData.mintSuccess}
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-3 p-1">
                                <Coins className="w-9 h-9 mx-auto text-purple-400" />
                                <div>
                                  <p className="font-black text-[12px] text-white uppercase leading-none">{simData.mintTitle}</p>
                                  <p className="text-[9px] text-slate-400 mt-2 max-w-[190px] mx-auto leading-relaxed font-semibold">
                                    {simData.mintDesc}
                                  </p>
                                </div>
                                <button 
                                  onClick={handleMintNft}
                                  disabled={minting}
                                  className="w-full bg-purple-600 hover:bg-purple-500 text-[10px] text-white font-black uppercase rounded-xl py-3 transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.3)] border border-purple-500/20"
                                >
                                  {minting ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                      <span>Generando Gemelo...</span>
                                    </>
                                  ) : (
                                    <span>Crear Gemelo Digital</span>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {phoneTab === "rewards" && (
                          <div className="space-y-3.5 w-full text-center my-auto">
                            <Gift className="w-9 h-9 mx-auto text-amber-400" />
                            <div>
                              <p className="font-black text-white text-[12px] uppercase leading-none">Premios del Club VIP</p>
                              <p className="text-[8.5px] text-slate-400 mt-1">Beneficios exclusivos para propietarios</p>
                            </div>
                            
                            <div className="space-y-2.5 pt-1 border-t border-white/5 max-h-[180px] overflow-y-auto">
                              {/* Reward 1 */}
                              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-white/5">
                                <div className="text-left space-y-0.5">
                                  <span className="text-slate-200 font-bold text-[9px] block leading-none">{simData.reward1Title}</span>
                                  <span className="text-slate-500 text-[7px] block leading-none">{simData.reward1Sub}</span>
                                </div>
                                {claimedRewards["wine"] ? (
                                  <span className="text-emerald-400 font-mono font-bold uppercase text-[9px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                    CUPON-MDZ-99B
                                  </span>
                                ) : (
                                  <button 
                                    onClick={() => handleClaimReward("wine")}
                                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded text-[8px] font-black uppercase transition-all shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                                  >
                                    Canjear
                                  </button>
                                )}
                              </div>

                              {/* Reward 2 */}
                              <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-white/5">
                                <div className="text-left space-y-0.5">
                                  <span className="text-slate-200 font-bold text-[9px] block leading-none">{simData.reward2Title}</span>
                                  <span className="text-slate-500 text-[7px] block leading-none">{simData.reward2Sub}</span>
                                </div>
                                {claimedRewards["tour"] ? (
                                  <span className="text-emerald-400 font-mono font-bold uppercase text-[9px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                    TOUR-ANDES-44X
                                  </span>
                                ) : (
                                  <button 
                                    onClick={() => handleClaimReward("tour")}
                                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded text-[8px] font-black uppercase transition-all shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                                  >
                                    Canjear
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {phoneTab === "market" && (
                          <div className="space-y-3.5 w-full text-center my-auto">
                            <ShoppingBag className="w-9 h-9 mx-auto text-cyan-400" />
                            <div>
                              <p className="font-black text-white text-[12px] uppercase leading-none">{simData.marketTitle}</p>
                              <p className="text-[8px] text-slate-400 mt-1">{simData.marketDesc}</p>
                            </div>
                            
                            <div className="pt-2.5 border-t border-white/5 text-left space-y-1.5 text-[9px] font-mono bg-slate-950/40 p-2.5 rounded-lg">
                              <div className="flex justify-between">
                                <span className="text-slate-500">VALOR ESTIMADO:</span>
                                <span className="text-white font-bold">{currentBasePrice.toFixed(3)} ETH</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">OFERTAS TOTALES:</span>
                                <span className="text-cyan-400 font-bold">{bidsCount} Ofertas</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">VARIACIÓN:</span>
                                <span className="text-emerald-400 font-bold">+14.5% este mes</span>
                              </div>
                              {myBidAmount && (
                                <div className="flex justify-between border-t border-white/5 pt-1.5 text-purple-300 font-bold">
                                  <span>TU OFERTA LIVE:</span>
                                  <span>{myBidAmount.toFixed(3)} ETH</span>
                                </div>
                              )}
                            </div>
                            
                            <button 
                              onClick={handlePlaceBid}
                              className="w-full bg-slate-900 border border-cyan-500/30 text-cyan-300 font-black text-[9px] uppercase py-2.5 rounded-xl hover:bg-slate-800 transition shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                            >
                              Hacer Oferta (+0.01 ETH)
                            </button>
                          </div>
                        )}



                        {phoneTab === "chat" && (
                          <div className="flex flex-col h-full justify-between">
                            {/* Chat Messages */}
                            <div className="flex-1 space-y-2 overflow-y-auto mb-2 pr-1 max-h-[160px] text-[8.5px] leading-tight text-left">
                              {phoneChatMessages.map((msg, idx) => (
                                <div 
                                  key={idx} 
                                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                                >
                                  <div className={`rounded-lg p-2 max-w-[85%] ${
                                    msg.sender === "user" 
                                      ? "bg-purple-600/35 border border-purple-500/20 text-white rounded-tr-none" 
                                      : "bg-slate-950/70 border border-white/5 text-amber-300 rounded-tl-none"
                                  }`}>
                                    {msg.text}
                                  </div>
                                </div>
                              ))}
                              {phoneChatTyping && (
                                <div className="flex justify-start">
                                  <div className="rounded-lg p-2 bg-slate-950/70 border border-white/5 text-slate-500 rounded-tl-none animate-pulse">
                                    {selectedIndustry === "bodegas" ? "Sommelier AI escribiendo..." : selectedIndustry === "cosmetica" ? "Aura AI escribiendo..." : selectedIndustry === "agro" ? "Inspector AI escribiendo..." : selectedIndustry === "pharma" ? "Validador AI escribiendo..." : "Coordinador AI escribiendo..."}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Chat Prompts */}
                            <div className="flex flex-wrap gap-1 mb-2 pt-1 border-t border-white/5 justify-center">
                              {simData.chatPrompts.map((prompt, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleSendPhoneMessage(prompt.q)}
                                  className="text-[7.5px] bg-slate-950 border border-white/5 rounded px-1.5 py-0.5 text-slate-450 hover:text-white transition"
                                >
                                  {prompt.label}
                                </button>
                              ))}
                            </div>
                            
                            {/* Chat Input */}
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleSendPhoneMessage(phoneChatInput);
                              }}
                              className="flex gap-1 border-t border-white/5 pt-2"
                            >
                              <input
                                type="text"
                                value={phoneChatInput}
                                onChange={(e) => setPhoneChatInput(e.target.value)}
                                placeholder={
                                  selectedIndustry === "bodegas" ? "Preguntale al Sommelier..." :
                                  selectedIndustry === "cosmetica" ? "Preguntale a Aura..." :
                                  selectedIndustry === "agro" ? "Preguntale al Inspector..." :
                                  selectedIndustry === "pharma" ? "Preguntale al Validador..." :
                                  "Preguntale al Coordinador..."
                                }
                                className="flex-1 bg-slate-950/80 border border-white/10 rounded-md px-2 py-1 text-[8.5px] text-white outline-none focus:border-cyan-500 transition-colors"
                              />
                              <button
                                type="submit"
                                className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded px-2 py-1 text-[8.5px] font-black uppercase transition-all"
                              >
                                Enviar
                              </button>
                            </form>
                          </div>
                        )}
                      </div>

                      {/* Sim Phone Tabs */}
                      <div className="grid grid-cols-5 gap-0.5 border-t border-white/10 pt-2 shrink-0">
                        {simData.tabLabels.map((label, lidx) => {
                          const tabIds = ["validate", "mint", "rewards", "market", "chat"] as const;
                          const tid = tabIds[lidx];
                          return (
                            <button
                              key={tid}
                              onClick={() => {
                                setPhoneTab(tid);
                                triggerNfcBeep();
                              }}
                              className={`text-[8.5px] font-black uppercase rounded py-1 transition ${
                                phoneTab === tid 
                                  ? "bg-cyan-500/20 text-cyan-300" 
                                  : "text-slate-500 hover:text-slate-355"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            </div>

            {/* Action Buttons */}
            <div className="w-full grid grid-cols-2 gap-3 z-10">
              {simStep === "idle" ? (
                <Button
                  onClick={startTapSimulation}
                  variant="primary"
                  className="col-span-2 gap-2.5 text-xs py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-black tracking-widest uppercase border border-cyan-400/30 shadow-[0_0_30px_rgba(6,182,212,0.25)] rounded-2xl"
                >
                  <Smartphone className="w-4 h-4 text-white" />
                  Simular NFC Tap
                </Button>
              ) : (
                <Button
                  onClick={resetSimulation}
                  variant="secondary"
                  className="col-span-2 gap-2 text-xs py-3 border border-white/10 text-slate-300 rounded-2xl"
                >
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  Reiniciar Simulador
                </Button>
              )}
            </div>

            {/* Sim Info Box */}
            <div className="w-full mt-4 p-4 rounded-2xl border border-white/5 bg-slate-900/30 text-[10px] text-slate-400 leading-relaxed space-y-1.5 z-10">
              {simStep === "idle" && (
                <p>💡 <strong>Cómo probar:</strong> Haz clic en <strong>Simular NFC Tap</strong>. Observa el arco de traslación del móvil y escucha el \"bip\" dinámico al conectar.</p>
              )}
              {simStep === "active" && (
                <p>🚀 <strong>Interactúa:</strong> Navega por las pestañas del celular simulado en el centro. Intenta generar el NFT en Polygon o reclamar beneficios en el club.</p>
              )}
            </div>

            {/* Responsive Mobile nexID AI Studio */}
            <AnimatePresence>
              {isMobile && simStep === "active" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full bg-slate-950/95 border border-white/10 rounded-2xl p-4 shadow-2xl mt-4 relative backdrop-blur-md min-h-[360px]"
                >
                  {renderAiStudio()}
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>

      {/* Interactive ROI Calculator Section */}
      <RoiCalculator 
        selectedPreset={selectedIndustry}
        setSelectedPreset={applyIndustryPreset}
        volume={volume}
        setVolume={setVolume}
        fraudRate={fraudRate}
        setFraudRate={setFraudRate}
        retailPrice={retailPrice}
        setRetailPrice={setRetailPrice}
        selectedChipModel={selectedChipModel}
        setSelectedChipModel={setSelectedChipModel}
        chipCost={chipCost}
        setChipCost={setChipCost}
        resellPrice={resellPrice}
        setResellPrice={setResellPrice}
        businessProfile={businessProfile}
        setBusinessProfile={setBusinessProfile}
        exportRegion={exportRegion}
        setExportRegion={setExportRegion}
      />

      {/* Slide 6 VIP metal card parallax feature overlay (Premium aesthetic showcase) */}
      <section className="rounded-3xl border border-white/10 bg-slate-950 p-8 lg:p-10 shadow-2xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full filter blur-[100px] pointer-events-none" />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-cyan-400 block">Prestigio de Marca & Estatus</span>
            <h2 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-tight">Membresías Metálicas Premium</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Consumir un producto verificado por nexID otorga puntos y sube el rango del usuario en la cava digital. Los inversores adoran este incentivo de lealtad porque impulsa la recurrencia comercial B2C sin intermediarios.
            </p>
            <div className="flex gap-4 pt-2">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
                <span className="text-[8px] text-slate-500 block uppercase font-bold">Rango Gold</span>
                <span className="text-base text-amber-400 font-black">Cofradía Activa</span>
              </div>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
                <span className="text-[8px] text-slate-500 block uppercase font-bold">Retención</span>
                <span className="text-base text-purple-400 font-black">+24% Recurrencia</span>
              </div>
            </div>
          </div>

          {/* Interactive VIP metal card mockup */}
          <div className="flex justify-center">
            <motion.div 
              whileHover={{ rotateY: 15, rotateX: -10 }}
              transition={{ type: "spring", stiffness: 150, damping: 15 }}
              className="w-[320px] h-[190px] rounded-2xl bg-gradient-to-br from-amber-300/35 via-amber-600/15 to-slate-900 border-2 border-amber-400/40 p-6 flex flex-col justify-between shadow-[0_20px_50px_rgba(251,191,36,0.15)] relative overflow-hidden group cursor-pointer"
            >
              {/* Card glossy shine */}
              <div className="absolute -inset-full bg-gradient-to-tr from-transparent via-white/[0.05] to-transparent group-hover:left-full duration-1000 transition-all pointer-events-none" />
              
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[7px] font-bold text-amber-300 uppercase tracking-widest block">NEXID PRESTIGE</span>
                  <span className="text-sm font-black text-white uppercase tracking-tight mt-1 block">VIP GOLD MEMBER</span>
                </div>
                <div className="w-8 h-8 rounded bg-gradient-to-tr from-amber-400 to-amber-200 border border-amber-300/30 flex items-center justify-center text-slate-950 font-black text-sm">
                  N
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[6px] text-slate-400 block uppercase">Propietario de Lote</span>
                  <span className="text-xs text-white font-mono leading-none">04:A5:8C:12:F3:60</span>
                </div>
                <span className="text-[10px] font-bold text-amber-400/90 tracking-wider">MENDOZA 2026</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

    </div>
  );
}
