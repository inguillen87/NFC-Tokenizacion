"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef, type CSSProperties } from "react";
import { DEMO_TENANT_SLUG } from "@product/config";
import type { AppLocale } from "@product/config";
import { ArrowLeft, BadgeCheck, CalendarDays, CheckCircle2, ChevronRight, Fingerprint, MapPin, PackageCheck, ShieldCheck, Smartphone, UserRound, AlertTriangle, ShoppingCart, RefreshCw, Check, Cpu, Network, QrCode, RadioTower } from "lucide-react";
import { HeroTrustAtlasSvg } from "../../../components/hero-scene";
import { platformVerticals } from "../../../lib/platform-verticals";
import { ThreeDProduct } from "../../investor-snapshot/investor-snapshot-client";
import { DemoLabThemeToggle } from "./demo-lab-hub-theme";
import type { VectorMapPoint, VectorMapRoute } from "@product/ui";

type Role = "ceo" | "operator" | "buyer";
type Beat = 0 | 1 | 2 | 3;
type DemoWizardStep = 0 | 1 | 2 | 3;
type Vertical =
  | "wine"
  | "seeds"
  | "pharma"
  | "creamJar"
  | "perfume"
  | "creamTube"
  | "bracelet"
  | "ticket"
  | "sneaker"
  | "luxury"
  | "bottle"
  | "logistics"
  | "electronics"
  | "textile";
type SimulationMode = "valid" | "tamper" | "replay";
type DemoAction = "origin" | "tap" | "join" | "warranty" | "tokenize" | "report";
type DemoModalView = "product" | "mobile" | "nft" | "claim" | null;
type DemoScenarioTone = "origin" | "ok" | "risk" | "open";
type DemoTrustScenarioKey = "qr-gs1" | "nfc-424" | "offline-verifier" | "polygon-ownership" | "iota-proof" | "dual-proof" | "sensor-evidence" | "authorized-network";
type DemoScenario = {
  tone: DemoScenarioTone;
  headline: string;
  body: string;
  stateLabel: string;
  allowed: string[];
  blocked: string[];
  chain: string;
  primaryAction: DemoAction;
  primaryLabel: string;
};

type DemoRealProductVariant = "studio" | "cinematic" | "stage";

const DEMO_VERTICAL_ORDER: Vertical[] = platformVerticals.map((item) => item.demoVertical as Vertical);

const DEMO_VERTICAL_ALIASES: Record<string, Vertical> = {
  wine: "wine",
  wines: "wine",
  vino: "wine",
  vinos: "wine",
  spirits: "wine",
  agro: "seeds",
  food: "seeds",
  alimentos: "seeds",
  seeds: "seeds",
  semillas: "seeds",
  pharma: "pharma",
  health: "pharma",
  salud: "pharma",
  medicamento: "pharma",
  medicamentos: "pharma",
  cosmetics: "perfume",
  beauty: "perfume",
  belleza: "perfume",
  cosmetica: "perfume",
  perfume: "perfume",
  events: "bracelet",
  event: "bracelet",
  tickets: "bracelet",
  access: "bracelet",
  eventos: "bracelet",
  luxury: "luxury",
  retail: "luxury",
  lujo: "luxury",
  bottle: "bottle",
  bottles: "bottle",
  botella: "bottle",
  botellas: "bottle",
  sneaker: "sneaker",
  sneakers: "sneaker",
  zapatilla: "sneaker",
  zapatillas: "sneaker",
  logistics: "logistics",
  logistica: "logistics",
  "cold-chain": "logistics",
  cadenafria: "logistics",
  electronics: "electronics",
  electronica: "electronics",
  warranty: "electronics",
  garantia: "electronics",
  textile: "textile",
  textil: "textile",
  dpp: "textile",
};

function normalizeDemoVertical(value?: string | null): Vertical {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return DEMO_VERTICAL_ALIASES[normalized] || "wine";
}

function normalizeDemoTrustScenario(value?: string | null): DemoTrustScenarioKey | null {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  const aliases: Record<string, DemoTrustScenarioKey> = {
    "qr": "qr-gs1",
    "gs1": "qr-gs1",
    "qr-gs1": "qr-gs1",
    "gs1-qr": "qr-gs1",
    "nfc": "nfc-424",
    "424": "nfc-424",
    "nfc-424": "nfc-424",
    "ntag-424": "nfc-424",
    "offline": "offline-verifier",
    "offline-verifier": "offline-verifier",
    "offline-reader": "offline-verifier",
    "field-verifier": "offline-verifier",
    "lector-offline": "offline-verifier",
    "app-offline": "offline-verifier",
    "polygon": "polygon-ownership",
    "ownership": "polygon-ownership",
    "polygon-ownership": "polygon-ownership",
    "iota": "iota-proof",
    "iota-proof": "iota-proof",
    "audit-proof": "iota-proof",
    "dual": "dual-proof",
    "dual-proof": "dual-proof",
    "dpp": "dual-proof",
    "sensor": "sensor-evidence",
    "sensors": "sensor-evidence",
    "sensor-evidence": "sensor-evidence",
    "uhf": "sensor-evidence",
    "iot": "sensor-evidence",
    "authorized": "authorized-network",
    "authorized-network": "authorized-network",
    "network": "authorized-network",
  };
  return aliases[normalized] || null;
}

function getScenarioStart(value?: string | null): { key: DemoTrustScenarioKey | null; beat: Beat; vertical: Vertical } {
  const key = normalizeDemoTrustScenario(value);
  if (key === "iota-proof" || key === "sensor-evidence" || key === "dual-proof") return { key, beat: 1, vertical: key === "sensor-evidence" ? "logistics" : "textile" };
  if (key === "offline-verifier") return { key, beat: 1, vertical: "seeds" };
  if (key === "authorized-network") return { key, beat: 0, vertical: "electronics" };
  if (key === "polygon-ownership") return { key, beat: 3, vertical: "luxury" };
  if (key === "nfc-424") return { key, beat: 1, vertical: "wine" };
  if (key === "qr-gs1") return { key, beat: 0, vertical: "pharma" };
  return { key: null, beat: 1, vertical: "wine" };
}

function getTrustScenarioInitialStep(key: DemoTrustScenarioKey | null): DemoWizardStep {
  if (key === "iota-proof" || key === "sensor-evidence" || key === "dual-proof") return 2;
  if (key === "polygon-ownership") return 3;
  if (key === "nfc-424" || key === "offline-verifier") return 1;
  return 0;
}

type DemoTrustScenarioContext = {
  tone: DemoTrustScenarioKey;
  eyebrow: string;
  title: string;
  body: string;
  labels: DemoTrustScenarioLabels;
  publicProof: string;
  privateData: string;
  decisionPath: DemoTrustScenarioStep[];
  businessOutcome: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
};

type DemoTrustScenarioStep = {
  label: string;
  body: string;
};

type DemoTrustScenarioLabels = {
  publicProof: string;
  privateData: string;
  decisionPath: string;
  businessOutcome: string;
};

function getTrustScenarioContext(key: DemoTrustScenarioKey | null, locale: AppLocale): DemoTrustScenarioContext | null {
  if (!key) return null;
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const labels: DemoTrustScenarioLabels = isEn
    ? {
      publicProof: "Public proof",
      privateData: "Private in nexID",
      decisionPath: "Decision path",
      businessOutcome: "Business outcome",
    }
    : isBr
    ? {
      publicProof: "Prova publica",
      privateData: "Privado no nexID",
      decisionPath: "Como se decide",
      businessOutcome: "Decisao habilitada",
    }
    : {
      publicProof: "Publico verificable",
      privateData: "Privado en nexID",
      decisionPath: "Como se decide",
      businessOutcome: "Decision habilitada",
    };

  const copyByKey: Record<DemoTrustScenarioKey, Omit<DemoTrustScenarioContext, "labels">> = {
    "qr-gs1": {
      tone: key,
      eyebrow: isEn ? "Identity layer" : isBr ? "Camada de identidade" : "Capa de identidad",
      title: isEn ? "QR / GS1 starts the product passport without forcing an app." : "QR / GS1 abre el pasaporte de producto sin obligar a instalar una app.",
      body: isEn ? "Useful for fast rollout: product data, batch, links, recall and consumer entry point. It is not crypto-auth by itself, so nexID can add NFC or proof layers when risk grows." : "Sirve para rollout rapido: datos de producto, lote, links, recall y entrada del consumidor. No es cripto-autenticacion por si solo; nexID suma NFC o proof cuando el riesgo sube.",
      publicProof: isEn ? "Visible: GS1 link, product data, lot and resolver policy." : "Publico: link GS1, datos de producto, lote y politica de resolucion.",
      privateData: isEn ? "Private: CRM identity, commercial terms and tenant rules." : "Privado: identidad CRM, terminos comerciales y reglas del tenant.",
      decisionPath: isEn
        ? [
          { label: "Identity", body: "Open the passport, lot and resolver." },
          { label: "Risk", body: "Escalate to NFC or proof when abuse appears." },
          { label: "Channel", body: "Route support, recall, rewards or CRM." },
        ]
        : [
          { label: "Identidad", body: "Abre pasaporte, lote y resolver." },
          { label: "Riesgo", body: "Escala a NFC o proof cuando aparece abuso." },
          { label: "Canal", body: "Deriva soporte, recall, rewards o CRM." },
        ],
      businessOutcome: isEn ? "Fast rollout with a clear path to stronger layers." : "Rollout rapido con camino claro a capas mas fuertes.",
      primaryHref: "/demo-lab?scenario=qr-gs1",
      primaryLabel: isEn ? "Replay QR/GS1 demo" : "Reproducir demo QR/GS1",
      secondaryHref: "/docs#trust-layers",
      secondaryLabel: isEn ? "Read trust layers" : "Leer capas de confianza",
    },
    "nfc-424": {
      tone: key,
      eyebrow: isEn ? "Cryptographic touch" : "Toque criptografico",
      title: isEn ? "NFC 424 validates the physical object before any claim." : "NFC 424 valida el objeto fisico antes de cualquier reclamo.",
      body: isEn ? "The demo explains why SUN, UID and tenant policy come before ownership, rewards or warranty. The buyer sees a verdict, not raw cryptography." : "La demo explica por que SUN, UID y politica del tenant vienen antes de ownership, rewards o garantia. El comprador ve un veredicto, no criptografia cruda.",
      publicProof: isEn ? "Visible: verdict, physical state and masked UID." : "Publico: veredicto, estado fisico y UID enmascarado.",
      privateData: isEn ? "Private: secret material, replay controls and tenant KMS." : "Privado: secretos, controles replay y KMS del tenant.",
      decisionPath: isEn
        ? [
          { label: "Fresh tap", body: "Read SUN/UID from the real item." },
          { label: "Tenant policy", body: "Check replay, channel and batch rules." },
          { label: "Verdict", body: "Only then unlock claim, reward or support." },
        ]
        : [
          { label: "Tap fresco", body: "Lee SUN/UID desde el objeto real." },
          { label: "Politica tenant", body: "Evalua replay, canal y reglas de lote." },
          { label: "Veredicto", body: "Recien ahi habilita claim, reward o soporte." },
        ],
      businessOutcome: isEn ? "Blocks copy/replay before warranty, claim or reward activation." : "Bloquea copia o replay antes de activar garantia, reclamo o reward.",
      primaryHref: "/demo-lab?scenario=nfc-424",
      primaryLabel: isEn ? "Replay NFC demo" : "Reproducir demo NFC",
      secondaryHref: "/docs#trust-layers",
      secondaryLabel: isEn ? "Read NFC layer" : "Leer capa NFC",
    },
    "offline-verifier": {
      tone: key,
      eyebrow: isEn ? "Field mode" : "Modo campo",
      title: isEn ? "Offline verification keeps the workflow running without signal." : "La verificacion offline mantiene el flujo vivo sin senal.",
      body: isEn ? "Perfect for warehouses, rural operations, wineries and mines: the device validates locally, queues evidence and syncs later with the official verdict." : "Ideal para depositos, campo, cavas y minas: el dispositivo valida localmente, encola evidencia y sincroniza despues con el veredicto oficial.",
      publicProof: isEn ? "Visible: provisional pass, queue count and sync status." : "Publico: pase provisional, cola y estado de sync.",
      privateData: isEn ? "Private: permission bundle, operator identity and internal QA." : "Privado: bundle de permisos, operador y QA interno.",
      decisionPath: isEn
        ? [
          { label: "Bundle", body: "Load authorized products and rules." },
          { label: "Local check", body: "Validate in the field without internet." },
          { label: "Sync", body: "Publish the official verdict when signal returns." },
        ]
        : [
          { label: "Bundle", body: "Carga productos autorizados y reglas." },
          { label: "Check local", body: "Valida en campo sin internet." },
          { label: "Sync", body: "Emite veredicto oficial al recuperar senal." },
        ],
      businessOutcome: isEn ? "Operations keep moving when warehouses, farms or mines lose signal." : "La operacion sigue viva cuando deposito, campo o mina pierden senal.",
      primaryHref: "/demo-lab?scenario=offline-verifier",
      primaryLabel: isEn ? "Replay offline demo" : "Reproducir demo offline",
      secondaryHref: "/docs#trust-layers",
      secondaryLabel: isEn ? "Read offline architecture" : "Leer arquitectura offline",
    },
    "polygon-ownership": {
      tone: key,
      eyebrow: isEn ? "Ownership layer" : "Capa ownership",
      title: isEn ? "Polygon is the ownership certificate, not the first authenticity check." : "Polygon es el certificado de propiedad, no la primera verificacion de autenticidad.",
      body: isEn ? "The deep link opens the business outcome because ownership only makes sense after a fresh tap, buyer validation and tenant approval. This is how a C-level audience sees warranty, resale and club value." : "El deep link abre el resultado comercial porque ownership solo tiene sentido despues de tap fresco, comprador validado y aprobacion del tenant. Asi un C-level entiende garantia, reventa y club.",
      publicProof: isEn ? "Visible: certificate request, token/tx when approved, public owner status." : "Publico: solicitud de certificado, token/tx al aprobarse y estado de owner.",
      privateData: isEn ? "Private: buyer identity, invoice, warranty policy and CRM segment." : "Privado: identidad del comprador, factura, politica de garantia y segmento CRM.",
      decisionPath: isEn
        ? [
          { label: "Authentic item", body: "Require QR/NFC validation first." },
          { label: "Approved buyer", body: "Apply warranty, invoice and tenant policy." },
          { label: "Owner record", body: "Issue or display the Polygon certificate." },
        ]
        : [
          { label: "Objeto autentico", body: "Exige validacion QR/NFC primero." },
          { label: "Comprador aprobado", body: "Aplica garantia, factura y politica tenant." },
          { label: "Owner record", body: "Emite o muestra certificado Polygon." },
        ],
      businessOutcome: isEn ? "Resale, warranty and loyalty become gated by real product proof." : "Reventa, garantia y loyalty quedan atados a prueba real de producto.",
      primaryHref: "/docs#trust-layers",
      primaryLabel: isEn ? "Read Polygon policy" : "Leer politica Polygon",
      secondaryHref: "/?contact=demo#contact-modal",
      secondaryLabel: isEn ? "Design ownership pilot" : "Disenar piloto ownership",
    },
    "iota-proof": {
      tone: key,
      eyebrow: isEn ? "Audit proof layer" : "Capa de auditoria",
      title: isEn ? "IOTA proves logistics evidence without publishing private operations." : "IOTA prueba evidencia logistica sin publicar operaciones privadas.",
      body: isEn ? "The deep link opens the traceability step because this layer is about custody, Merkle roots and public verification. It connects directly with Proof Verify so an auditor can test a hash." : "El deep link abre trazabilidad porque esta capa trata custodia, Merkle roots y verificacion publica. Conecta directo con Proof Verify para que un auditor pruebe un hash.",
      publicProof: isEn ? "Visible: event hash, Merkle root, tx/explorer and inclusion status." : "Publico: hash de evento, Merkle root, tx/explorer y estado de inclusion.",
      privateData: isEn ? "Private: customer, route manifest, QA docs and commercial contract." : "Privado: cliente, manifiesto de ruta, QA interno y contrato comercial.",
      decisionPath: isEn
        ? [
          { label: "Canonical event", body: "Hash the custody or QA fact." },
          { label: "Merkle root", body: "Group many events into one public anchor." },
          { label: "Verify", body: "Let any auditor test inclusion in Proof Verify." },
        ]
        : [
          { label: "Evento canonico", body: "Hashea custodia o hecho QA." },
          { label: "Merkle root", body: "Agrupa muchos eventos en un anchor publico." },
          { label: "Verificar", body: "Permite a cualquiera probar inclusion en Proof Verify." },
        ],
      businessOutcome: isEn ? "Auditors get proof of existence while clients and routes stay private." : "Auditores prueban existencia sin ver clientes, rutas ni documentos privados.",
      primaryHref: DEMO_PUBLIC_PROOF_URL,
      primaryLabel: isEn ? "Open Proof Verify demo" : "Abrir Proof Verify demo",
      secondaryHref: "/docs#trust-layers",
      secondaryLabel: isEn ? "Read IOTA layer" : "Leer capa IOTA",
    },
    "dual-proof": {
      tone: key,
      eyebrow: isEn ? "DPP-ready stack" : "Stack DPP-ready",
      title: isEn ? "DPP combines identity, ownership and industrial audit proof." : "DPP combina identidad, ownership y auditoria industrial.",
      body: isEn ? "Use this when the buyer asks for a serious enterprise story: QR/GS1 and NFC for the object, Polygon for ownership, IOTA for audit evidence." : "Usalo cuando el comprador pide una historia enterprise seria: QR/GS1 y NFC para el objeto, Polygon para ownership, IOTA para evidencia auditada.",
      publicProof: isEn ? "Visible: passport, proof hash, owner status and compliance trail." : "Publico: pasaporte, proof hash, owner status y camino compliance.",
      privateData: isEn ? "Private: PII, tenant policy, supplier docs and pricing terms." : "Privado: PII, politica tenant, docs de proveedor y precios.",
      decisionPath: isEn
        ? [
          { label: "Object", body: "QR/GS1 plus NFC prove the physical item." },
          { label: "Owner", body: "Polygon represents approved ownership." },
          { label: "Audit", body: "IOTA anchors hash-only evidence." },
        ]
        : [
          { label: "Objeto", body: "QR/GS1 mas NFC prueban el item fisico." },
          { label: "Owner", body: "Polygon representa ownership aprobado." },
          { label: "Auditoria", body: "IOTA ancla evidencia hash-only." },
        ],
      businessOutcome: isEn ? "A serious DPP story without mixing PII, ownership and audit data." : "Historia DPP seria sin mezclar PII, ownership y datos de auditoria.",
      primaryHref: DEMO_PUBLIC_PROOF_URL,
      primaryLabel: isEn ? "Verify public proof" : "Verificar prueba publica",
      secondaryHref: "/docs#trust-layers",
      secondaryLabel: isEn ? "Read DPP model" : "Leer modelo DPP",
    },
    "sensor-evidence": {
      tone: key,
      eyebrow: isEn ? "Industrial evidence" : "Evidencia industrial",
      title: isEn ? "Sensor evidence turns pallets, boxes and conditions into audit facts." : "La evidencia de sensores convierte pallets, cajas y condiciones en hechos auditables.",
      body: isEn ? "The buyer sees a clean verdict while operations keeps UHF, IoT, temperature and custody details in a controlled proof trail." : "El comprador ve un veredicto simple mientras operaciones conserva UHF, IoT, temperatura y custodia en un trail controlado.",
      publicProof: isEn ? "Visible: milestone hash, risk state and proof receipt." : "Publico: hash del hito, estado de riesgo y recibo proof.",
      privateData: isEn ? "Private: sensor stream, lane economics and warehouse data." : "Privado: stream sensor, costos de ruta y datos de deposito.",
      decisionPath: isEn
        ? [
          { label: "Measure", body: "Capture sensor, pallet or UHF events." },
          { label: "Anchor", body: "Publish only the milestone hash." },
          { label: "Act", body: "Flag risk before receiving or settlement." },
        ]
        : [
          { label: "Medir", body: "Captura eventos de sensor, pallet o UHF." },
          { label: "Anclar", body: "Publica solo el hash del hito." },
          { label: "Actuar", body: "Marca riesgo antes de recibir o liquidar." },
        ],
      businessOutcome: isEn ? "Industrial traceability becomes auditable without exposing operations." : "La trazabilidad industrial queda auditable sin exponer operacion.",
      primaryHref: DEMO_PUBLIC_PROOF_URL,
      primaryLabel: isEn ? "Open proof receipt" : "Abrir recibo proof",
      secondaryHref: "/docs#trust-layers",
      secondaryLabel: isEn ? "Read sensor flow" : "Leer flujo sensor",
    },
    "authorized-network": {
      tone: key,
      eyebrow: isEn ? "Supplier network" : "Red autorizada",
      title: isEn ? "Authorized partners operate without receiving raw infrastructure secrets." : "Los partners autorizados operan sin recibir secretos crudos de infraestructura.",
      body: isEn ? "This scenario is for resellers, printers, integrators and suppliers: they encode and audit within role boundaries while nexID protects tenant keys and policy." : "Este escenario es para resellers, imprentas, integradores y proveedores: codifican y auditan por rol mientras nexID protege claves y politica del tenant.",
      publicProof: isEn ? "Visible: partner role, batch status and audit receipt." : "Publico: rol del partner, estado del batch y recibo auditado.",
      privateData: isEn ? "Private: API keys, KMS material, billing and tenant contracts." : "Privado: API keys, material KMS, facturacion y contratos tenant.",
      decisionPath: isEn
        ? [
          { label: "Role", body: "Define what each partner can encode." },
          { label: "Batch", body: "Operate under tenant policy and limits." },
          { label: "Audit", body: "Leave a proof trail without exposing secrets." },
        ]
        : [
          { label: "Rol", body: "Define que puede codificar cada partner." },
          { label: "Batch", body: "Opera bajo politica y limites del tenant." },
          { label: "Auditoria", body: "Deja prueba sin exponer secretos." },
        ],
      businessOutcome: isEn ? "Supplier scale without handing out raw keys, contracts or tenant data." : "Escala de proveedores sin entregar keys, contratos ni datos tenant.",
      primaryHref: "/docs#trust-layers",
      primaryLabel: isEn ? "Read access model" : "Leer modelo de acceso",
      secondaryHref: "/?contact=demo#contact-modal",
      secondaryLabel: isEn ? "Plan partner pilot" : "Planear piloto partner",
    },
  };

  return { ...copyByKey[key], labels };
}

function verticalTo3DIndustry(vertical: Vertical): string {
  if (vertical === "wine") return "bodegas";
  if (vertical === "bottle") return "botellas";
  if (vertical === "seeds" || vertical === "logistics") return "agro";
  if (vertical === "pharma") return "pharma";
  if (vertical === "creamJar" || vertical === "perfume" || vertical === "creamTube" || vertical === "sneaker" || vertical === "luxury" || vertical === "textile") return "cosmetica";
  if (vertical === "bracelet" || vertical === "ticket" || vertical === "electronics") return "eventos";
  return "bodegas";
}

const demoLabRealAssets: Record<Vertical, { imageUrl: string; imageLightUrl: string; credit: string }> = {
  wine: { imageUrl: "/sdk/verticals/wine-spirits-424-tt.png", imageLightUrl: "/sdk/verticals/light/premium-wine-light.webp", credit: "nexID generated asset" },
  seeds: { imageUrl: "/sdk/verticals/agro-nfc-qr-traceability.webp", imageLightUrl: "/sdk/verticals/light/premium-agro-light.webp", credit: "nexID generated asset" },
  pharma: { imageUrl: "/sdk/pharma-authentication-pack.webp", imageLightUrl: "/sdk/verticals/light/premium-pharma-agro-light-enterprise.webp", credit: "nexID generated asset" },
  creamJar: { imageUrl: "/sdk/verticals/cosmetics-nfc-qr-tamper.webp", imageLightUrl: "/sdk/verticals/light/premium-beauty-light.webp", credit: "nexID generated asset" },
  perfume: { imageUrl: "/sdk/verticals/cosmetics-nfc-qr-tamper.webp", imageLightUrl: "/sdk/verticals/light/premium-beauty-light.webp", credit: "nexID generated asset" },
  creamTube: { imageUrl: "/sdk/verticals/cosmetics-nfc-qr-tamper.webp", imageLightUrl: "/sdk/verticals/light/premium-beauty-light.webp", credit: "nexID generated asset" },
  bracelet: { imageUrl: "/sdk/verticals/events-nfc-qr-access.webp", imageLightUrl: "/sdk/verticals/light/premium-events-light-enterprise.webp", credit: "nexID generated asset" },
  ticket: { imageUrl: "/sdk/verticals/events-nfc-qr-access.webp", imageLightUrl: "/sdk/verticals/light/premium-events-light-enterprise.webp", credit: "nexID generated asset" },
  sneaker: { imageUrl: "/sdk/verticals/sneaker-nfc-qr-tamper.png", imageLightUrl: "/sdk/verticals/light/premium-sneaker-light-enterprise.webp", credit: "nexID generated asset" },
  luxury: { imageUrl: "/sdk/verticals/luxury-nfc-qr-tamper.webp", imageLightUrl: "/sdk/verticals/light/premium-beauty-light.webp", credit: "nexID generated asset" },
  bottle: { imageUrl: "/sdk/verticals/beverages-bottle-nfc-qr.png", imageLightUrl: "/sdk/verticals/light/premium-bottle-light-enterprise.webp", credit: "nexID generated asset" },
  logistics: { imageUrl: "/sdk/verticals/logistics-uhf-nfc-qr.webp", imageLightUrl: "/sdk/verticals/light/premium-logistics-light-enterprise.webp", credit: "nexID generated asset" },
  electronics: { imageUrl: "/sdk/verticals/electronics-warranty-nfc-qr.webp", imageLightUrl: "/sdk/verticals/light/premium-electronics-light-enterprise.webp", credit: "nexID generated asset" },
  textile: { imageUrl: "/sdk/verticals/textile-dpp-nfc-qr.webp", imageLightUrl: "/sdk/verticals/light/premium-textile-light-enterprise.webp", credit: "nexID generated asset" },
};

type DemoEvent = {
  id?: string;
  result?: string;
  uidMasked?: string;
  created_at?: string;
  city?: string;
  country_code?: string;
  lat?: number | null;
  lng?: number | null;
  product_name?: string;
  sku?: string;
  vertical?: string;
};

type DemoLead = {
  id: string;
  locale: string;
  contact: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  country?: string | null;
  vertical?: string | null;
  role_interest?: string | null;
  estimated_volume?: string | null;
  tag_type?: string | null;
  volume?: number | null;
  source: string;
  status: string;
  message?: string | null;
  notes?: string | null;
  assigned_to?: string | null;
  created_at: string;
};

type DemoTicket = {
  id: string;
  locale: string;
  contact: string;
  title: string;
  detail?: string | null;
  status: string;
  source: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
};

type DemoOrder = {
  id: string;
  locale: string;
  contact: string;
  company?: string | null;
  tag_type?: string | null;
  volume?: number | null;
  notes?: string | null;
  status: string;
  source: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
};

type DemoSummary = {
  ok?: boolean;
  exists?: boolean;
  degraded?: boolean;
  source?: string;
  tagCount?: number;
  crm?: { leads?: number; tickets?: number; orders?: number };
  recentLeads?: DemoLead[];
  recentTickets?: DemoTicket[];
  recentOrders?: DemoOrder[];
  events?: DemoEvent[];
};

type DemoMapPoint = {
  city: string;
  country?: string;
  lat: number;
  lng: number;
  scans?: number;
  risk?: number;
  status?: string;
  lastSeen?: string;
  vertical?: string;
};

const LOCATIONS = {
  origin: { city: "Valle de Uco", country: "Argentina", countryCode: "AR", lat: -33.6131, lng: -69.2075, label: "Origen del producto" },
  mendoza: { city: "Mendoza", country: "Argentina", countryCode: "AR", lat: -32.8895, lng: -68.8458, label: "Bodega / QA" },
  zurich: { city: "Zurich", country: "Suiza", countryCode: "CH", lat: 47.3769, lng: 8.5417, label: "Toque del cliente" },
};

type DemoLocation = (typeof LOCATIONS)[keyof typeof LOCATIONS];

const STABLE_DEMO_TIME = "2026-05-01T00:00:00.000Z";
const DEMO_PUBLIC_PROOF_URL = "/proof/verify?event_hash=sha256%3A0ea0478b694f01a5a76eda955a78c74701786b3d13ac241e6f6cfc3363938320&anchor_id=33333333-3333-4333-8333-333333333333";

const copy: Record<AppLocale, {
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  nav: { landing: string; login: string; sun: string; portal: string };
  kpis: { tags: string; events: string; portal: string; route: string; noFeed: string; leads: string };
  valueCards: Array<{ metric: string; title: string; body: string }>;
  roles: Record<Role, { label: string; headline: string; focus: string }>;
  beats: Record<Beat, { title: string; body: string; event: string; mode: SimulationMode; location: keyof typeof LOCATIONS; status: string; cta: string }>;
  verticals: Record<Vertical, { label: string; profile: string; product: string; visual: string; proof: string[] }>;
  controls: { narrative: string; cinematicStart: string; cinematicStop: string; product: string; mobile: string; feed: string; valid: string; tamper: string; replay: string; refresh: string; marketplace: string; mapTitle: string; mapSubtitle: string; realFeed: string; adminKey: string; noGeo: string; origin: string; currentTap: string; distance: string; openOrigin: string; openTap: string; joinClub: string; warranty: string; tokenize: string; syncing: string; synced: string; unavailable: string; sendingScan: string; registeredScan: string; failedScan: string; configs: Array<{ title: string; body: string }> };
}> = {
  "es-AR": {
    heroEyebrow: "Laboratorio comercial nexID",
    heroTitle: "Mirá cómo un producto físico se vuelve verificable, vendible y medible.",
    heroBody: "Un entorno guiado para vender la historia completa: origen, toque del cliente, seguridad, portal, tienda y datos de negocio sin tratar el sandbox como evidencia productiva.",
    nav: { landing: "Inicio", login: "Ingresar", sun: "SUN celular", portal: "Portal usuario" },
    kpis: { tags: "Etiquetas fisicas", events: "Eventos", portal: "Portal", route: "Ruta origen-toque", noFeed: "Sin eventos recientes", leads: "Contactos / asociaciones" },
    valueCards: [
      { metric: "CRM + club", title: "Fidelización después del toque", body: "Puntos, garantías, recompra y promociones de la marca quedan conectados al pasaporte del consumidor." },
      { metric: "Tienda", title: "Red de alta gama por marca y zona", body: "Cada marca conserva su tienda, pero convive en una red nexID para descubrir productos de valor cercanos." },
      { metric: "Canal listo", title: "Operable para terceros", body: "Imprentas, integradores y agencias pueden cargar lotes, operar cuentas de marca y ver contactos sin tocar criptografía." },
      { metric: "Datos vivos", title: "Ventas con analítica", body: "Lecturas, rutas, riesgo, clics y solicitudes llegan al CRM y al panel en tiempo real." },
    ],
    roles: {
      ceo: { label: "CEO / inversor", headline: "Del toque al ingreso: protección de marca, datos y fidelización.", focus: "Usalo para mostrar margen, canal de revendedores y valor recurrente sin entrar en jerga técnica." },
      operator: { label: "Operaciones", headline: "Control real de lotes, UIDs, mapas y alertas.", focus: "Aterriza importacion, activacion, lecturas reales y excepciones de riesgo." },
      buyer: { label: "Comprador", headline: "Confianza clara antes de comprar o consumir.", focus: "La persona entiende origen, estado del sello, beneficios y próximo paso." },
    },
    beats: {
      0: { title: "1. Nace el producto", body: "La marca activa lote, UID y origen.", event: "Lote real conectado a Bodega Balmec.", mode: "valid", location: "mendoza", status: "ORIGEN_LISTO", cta: "Ver origen" },
      1: { title: "2. Toque del cliente", body: "El consumidor verifica y ve distancia.", event: "Toque valido en Zurich con ruta al origen.", mode: "valid", location: "zurich", status: "AUTENTICADO", cta: "Unirme al club" },
      2: { title: "3. Riesgo bloqueado", body: "Copia o lectura duplicada entra al registro.", event: "Senial de copia para antifraude.", mode: "replay", location: "zurich", status: "COPIA_BLOQUEADA", cta: "Ver alerta" },
      3: { title: "4. Apertura + venta", body: "El sello cambia estado y prepara beneficios sujetos a política.", event: "Sello abierto + solicitud de reclamo/tokenización.", mode: "tamper", location: "zurich", status: "ABIERTO", cta: "Solicitar propiedad" },
    },
    verticals: {
      wine: { label: "Vino", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Etiqueta adherida a botella", "Descorche / sello roto", "SUN anti copia", "Origen + toque global"] },
      seeds: { label: "Semillas", profile: "QR + NFC UID", product: "Sobre semilla certificada", visual: "seed-packet-demo", proof: ["Sobre antifalsificacion", "Lote y variedad", "Custodia agro", "Uso rural"] },
      pharma: { label: "Pharma", profile: "QR + NFC + recall", product: "Medicamento serializado", visual: "pharma-pack-demo", proof: ["Caja y lote auditables", "Prospecto digital", "Cadena de frio", "Recall por unidad"] },
      creamJar: { label: "Skincare", profile: "NTAG 424 DNA", product: "Set dermocosmético premium", visual: "cream-jar-demo", proof: ["Sello tapa-envase", "Apertura cambia estado", "Garantía premium", "Anti mercado gris"] },
      perfume: { label: "Perfume", profile: "NTAG 424 DNA", product: "Perfume premium", visual: "perfume-demo", proof: ["Sello en tapa y cuello", "Lote y serie", "Garantía", "Anti falsificación"] },
      creamTube: { label: "Crema", profile: "NTAG213 + lote", product: "Crema dermocosmética", visual: "cream-tube-demo", proof: ["Sello sobre tapa flip", "Lote visible", "Garantía", "Recompra"] },
      bracelet: { label: "Brazalete", profile: "NTAG215", product: "Brazalete VIP evento", visual: "event-bracelet-demo", proof: ["Celular toca pulsera", "UID serializado", "Zonas VIP", "Bloqueo de reingreso"] },
      ticket: { label: "Entrada", profile: "QR + NFC UID", product: "Entrada fiesta VIP", visual: "party-ticket-demo", proof: ["QR visible", "UID respaldo", "Acceso por zona", "Copia bloqueada"] },
      sneaker: { label: "Zapatilla", profile: "NTAG 424 DNA", product: "Drop Runner 37Z", visual: "sneaker-demo", proof: ["Toque en lengueta", "UID + SUN", "Rareza visible", "Dueño/token"] },
      luxury: { label: "Lujo", profile: "NTAG 424 DNA", product: "Reloj Cronógrafo Premium", visual: "luxury-demo", proof: ["Toque en tarjeta", "UID + SUN", "Evidencia de autenticidad", "Owner/club"] },
      bottle: { label: "Envases refill", profile: "GS1/QR + NFC", product: "Envase Refill Premium", visual: "bottle-demo", proof: ["Envase retornable", "GS1/QR + NFC opcional", "ciclo refill", "Incentivo activo"] },
      logistics: { label: "Logistica", profile: "UHF + NFC + sensor", product: "Caja cadena fria", visual: "logistics-pack-demo", proof: ["Pallet/caja trazable", "Sensor temperatura", "Ruta auditada", "Entrega verificada"] },
      electronics: { label: "Electrónica", profile: "QR + NFC garantía", product: "Dispositivo serializado", visual: "electronics-demo", proof: ["Serial verificable", "Garantía por unidad", "Soporte postventa", "Reclamo antifraude"] },
      textile: { label: "Textil DPP", profile: "QR + NFC DPP", product: "Etiqueta pasaporte textil", visual: "textile-dpp-demo", proof: ["Origen y composicion", "Cuidado conectado", "Sustentabilidad", "Reventa verificable"] },
    },
    controls: {
      narrative: "Narrativa por audiencia", cinematicStart: "Iniciar recorrido", cinematicStop: "Pausar recorrido", product: "Producto físico", mobile: "Resultado en celular", feed: "Registro de eventos", valid: "Registrar toque válido en Zúrich", tamper: "Romper sello / descorchar", replay: "Simular copia duplicada", refresh: "Actualizar", marketplace: "Portal + tienda", mapTitle: "Mapa vivo: origen del producto vs toque del cliente", mapSubtitle: "Línea animada, distancia y enlaces de ubicación para construir confianza.", realFeed: "Registro público real conectado.", adminKey: "Modo lectura/prueba: la escritura privada de lecturas corre en entorno seguro.", noGeo: "Todavía no hay eventos públicos con ubicación disponibles desde la API.", origin: "Origen", currentTap: "Toque actual", distance: "Distancia", openOrigin: "Abrir origen", openTap: "Abrir toque", joinClub: "Unirme al club", warranty: "Activar garantía", tokenize: "Crear NFT", syncing: "Conectando con Bodega Balmec...", synced: "Bodega Balmec sincronizada con servidor.", unavailable: "Bodega Balmec no disponible.", sendingScan: "Enviando lectura", registeredScan: "Lectura registrada en Bodega Balmec.", failedScan: "No se pudo simular el toque.", configs: [
        { title: "QR / GS1 Digital Link", body: "Entrada economica para contenido, lote, retiro de producto y trazabilidad GS1. Ideal como respaldo visible; cualquiera puede copiarlo, por eso no habilita reclamo de dueño por si solo." },
        { title: "NTAG213 / NTAG215", body: "UID físico serializado para entradas, pulseras, garantías simples y activaciones masivas. Sube la fricción contra capturas de pantalla y permite reglas por lote desde el servidor." },
        { title: "NTAG 424 DNA", body: "Cada toque genera SUN dinamico con CMAC para detectar copias, enlaces reutilizados y lecturas sospechosas. Es la capa recomendada para productos de valor medio/alto." },
        { title: "Offline Verifier", body: "Android primero, iOS donde Core NFC/ISO 7816 lo permita, o lector dedicado para campo sin senal: ejecuta checks locales con bundle autorizado, sin master keys, y mantiene veredicto provisional hasta sync backend." },
        { title: "Polygon Ownership Demo", body: "Activa ownership, certificado o token premium solo despues de tap fresco, comprador validado y politica aprobada. Polygon no reemplaza la validacion SUN ni recibe taps individuales." },
        { title: "IOTA Proof Layer Demo", body: "Muestra auditoria opcional para DPP, lotes y logistica: se anclan hashes o Merkle roots, no datos privados ni lecturas individuales." },
        { title: "Dual Proof DPP", body: "Combina QR/GS1, NFC 424, Polygon para ownership e IOTA para evidencia industrial cuando el cliente necesita compliance avanzado." },
        { title: "NTAG 424 DNA TT + tokenización", body: "Suma estado físico del sello: cerrado, abierto o manipulado. Permite pasaporte, garantía, tienda y token Polygon solo cuando la política de compra/reclamo lo habilita." },
      ] },
  },
  "pt-BR": {
    heroEyebrow: "Enterprise Lab",
    heroTitle: "Veja como um produto fisico vira confianca, dados e receita.",
    heroBody: "Uma experiencia para vender a historia completa: origem, toque do cliente, seguranca, portal, marketplace e dados de negocio.",
    nav: { landing: "Landing", login: "Entrar", sun: "SUN mobile", portal: "Portal usuario" },
    kpis: { tags: "Tags fisicas", events: "Eventos", portal: "Portal", route: "Rota origem-toque", noFeed: "Sem feed recente", leads: "Leads / associacoes" },
    valueCards: [
      { metric: "CRM + clube", title: "Fidelizacao pos-toque", body: "Pontos, garantias, recompra e promos do tenant ficam conectados ao passport do consumidor." },
      { metric: "Marketplace", title: "Rede luxury por marca e regiao", body: "Cada marca mantem sua loja, mas convive em uma rede nexID para descobrir produtos premium proximos." },
      { metric: "Reseller ready", title: "White-label operavel", body: "Graficas, integradores e agencias carregam lotes, operam tenants e veem leads sem tocar criptografia." },
      { metric: "Dados vivos", title: "Vendas com analitica", body: "Scans, rotas, risco, cliques e solicitacoes chegam ao CRM e ao dashboard em tempo real." },
    ],
    roles: {
      ceo: { label: "CEO / investidor", headline: "Do toque ao revenue: marca protegida, dados e fidelizacao.", focus: "Use para mostrar margem, canal revendedor e receita recorrente sem jargao tecnico." },
      operator: { label: "Operacoes", headline: "Controle de lotes, UIDs, mapas e alertas.", focus: "Mostra importacao, ativacao, leituras reais e excecoes de risco." },
      buyer: { label: "Comprador", headline: "Confianca instantanea antes de comprar ou consumir.", focus: "A pessoa entende origem, estado do lacre, beneficios e proximo passo." },
    },
    beats: {
      0: { title: "1. Produto nasce", body: "A marca ativa lote, UID e origem.", event: "Lote real conectado ao Bodega Balmec.", mode: "valid", location: "mendoza", status: "ORIGIN_READY", cta: "Ver origem" },
      1: { title: "2. Toque do cliente", body: "O consumidor verifica e ve distancia.", event: "Toque valido em Zurique com rota de origem.", mode: "valid", location: "zurich", status: "AUTH_OK", cta: "Entrar no clube" },
      2: { title: "3. Risco bloqueado", body: "Replay ou duplicata entra no feed.", event: "Replay signal para antifraude.", mode: "replay", location: "zurich", status: "REPLAY_BLOCKED", cta: "Ver alerta" },
      3: { title: "4. Abertura + venda", body: "O lacre muda estado e abre beneficios.", event: "Lacre aberto + dono/tokenizacao.", mode: "tamper", location: "zurich", status: "OPENED", cta: "Reivindicar dono" },
    },
    verticals: {
      wine: { label: "Garrafa", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Etiqueta na garrafa", "Rolha / lacre aberto", "SUN anti-replay", "Origem + toque global"] },
      seeds: { label: "Sementes", profile: "QR + NFC UID", product: "Envelope de semente certificada", visual: "seed-packet-demo", proof: ["Envelope antifraude", "Lote e variedade", "Custodia agro", "Uso rural"] },
      pharma: { label: "Pharma", profile: "QR + NFC + recall", product: "Medicamento serializado", visual: "pharma-pack-demo", proof: ["Caixa e lote auditaveis", "Bula digital", "Cadeia fria", "Recall por unidade"] },
      creamJar: { label: "Skincare", profile: "NTAG 424 DNA", product: "Set dermocosmetico premium", visual: "cream-jar-demo", proof: ["Lacre tampa-envase", "Abertura muda estado", "Garantia premium", "Anti grey-market"] },
      perfume: { label: "Perfume", profile: "NTAG 424 DNA", product: "Perfume premium", visual: "perfume-demo", proof: ["Lacre entre tampa e gargalo", "Lote e serie", "Garantia", "Antifalsificacao"] },
      creamTube: { label: "Creme", profile: "NTAG213 + lote", product: "Creme dermocosmetico", visual: "cream-tube-demo", proof: ["Lacre sobre tampa flip", "Lote visivel", "Garantia", "Recompra"] },
      bracelet: { label: "Pulseira", profile: "NTAG215", product: "Pulseira VIP evento", visual: "event-bracelet-demo", proof: ["Celular toca pulseira", "UID serializado", "Zonas VIP", "Bloqueio duplicado"] },
      ticket: { label: "Ingresso", profile: "QR + NFC UID", product: "Ingresso festa VIP", visual: "party-ticket-demo", proof: ["QR visivel", "UID respaldo", "Acesso por zona", "Replay bloqueado"] },
      sneaker: { label: "Tenis", profile: "NTAG 424 DNA", product: "Drop Runner 37Z", visual: "sneaker-demo", proof: ["Toque na lingueta", "UID + SUN", "Raridade visivel", "Dono/token"] },
      luxury: { label: "Luxo", profile: "NTAG 424 DNA", product: "Relogio de Luxo", visual: "luxury-demo", proof: ["Toque no cartao", "UID + SUN", "Evidencia de autenticidade", "Dono/clube"] },
      bottle: { label: "Embalagens refill", profile: "GS1/QR + NFC", product: "Embalagem Refill Premium", visual: "bottle-demo", proof: ["Embalagem retornavel", "GS1/QR + NFC opcional", "ciclo refill", "Incentivo ativo"] },
      logistics: { label: "Logistica", profile: "UHF + NFC + sensor", product: "Caixa cadeia fria", visual: "logistics-pack-demo", proof: ["Pallet/caixa rastreavel", "Sensor temperatura", "Rota auditada", "Entrega verificada"] },
      electronics: { label: "Eletronica", profile: "QR + NFC garantia", product: "Dispositivo serializado", visual: "electronics-demo", proof: ["Serial verificavel", "Garantia por unidade", "Suporte pos-venda", "Reclamo antifraude"] },
      textile: { label: "Textil DPP", profile: "QR + NFC DPP", product: "Etiqueta passport textil", visual: "textile-dpp-demo", proof: ["Origem e composicao", "Cuidado conectado", "Sustentabilidade", "Revenda verificavel"] },
    },
    controls: { narrative: "Narrativa por audiencia", cinematicStart: "Iniciar cinematic", cinematicStop: "Pausar cinematic", product: "Produto fisico", mobile: "Resultado mobile", feed: "Command feed", valid: "Registrar toque valido em Zurique", tamper: "Abrir lacre / rolha", replay: "Simular replay duplicado", refresh: "Atualizar", marketplace: "Portal + marketplace", mapTitle: "Mapa vivo: origem do produto vs toque do cliente", mapSubtitle: "Linha animada, distancia e links de localizacao para construir confianca.", realFeed: "Feed publico real conectado.", adminKey: "Modo leitura/validacao: a escrita privada de scans roda em ambiente seguro.", noGeo: "Ainda nao ha eventos publicos com localizacao na API.", origin: "Origem", currentTap: "Toque atual", distance: "Distancia", openOrigin: "Abrir origem", openTap: "Abrir toque", joinClub: "Entrar no clube", warranty: "Ativar garantia", tokenize: "Tokenizar premium", syncing: "Conectando ao Bodega Balmec...", synced: "Bodega Balmec sincronizada com backend.", unavailable: "Bodega Balmec indisponivel.", sendingScan: "Enviando scan", registeredScan: "Scan registrado no Bodega Balmec.", failedScan: "Nao foi possivel simular o toque.", configs: [
      { title: "QR / GS1 Digital Link", body: "Entrada economica para conteudo, lote, recall e rastreabilidade GS1. Otimo fallback visivel; pode ser copiado, entao nao libera propriedade premium sozinho." },
      { title: "NTAG213 / NTAG215", body: "UID fisico serializado para tickets, pulseiras, garantias simples e ativacoes massivas. Permite regras server-side por lote." },
      { title: "NTAG 424 DNA", body: "Cada toque gera SUN dinamico com CMAC para detectar replay, links reutilizados e copias. Recomendado para valor medio/alto." },
      { title: "Offline Verifier", body: "Android primeiro, iOS onde Core NFC/ISO 7816 permitir, ou leitor dedicado para campo sem sinal: executa checks locais com bundle autorizado, sem master keys, e mantem veredito provisional ate sync backend." },
      { title: "Polygon Ownership Demo", body: "Ativa ownership, certificado ou token premium somente depois de toque fresco, comprador validado e politica aprovada. Polygon nao substitui SUN nem recebe eventos individuais." },
      { title: "IOTA Proof Layer Demo", body: "Mostra auditoria opcional para DPP, lotes e logistica: ancoramos hashes ou Merkle roots, nao dados privados nem leituras individuais." },
      { title: "Dual Proof DPP", body: "Combina QR/GS1, NFC 424, Polygon para ownership e IOTA para evidencia industrial quando o cliente precisa de compliance avancado." },
      { title: "NTAG 424 DNA TT + tokenizacao", body: "Soma estado fisico do lacre: fechado, aberto ou manipulado. Habilita passport, garantia, marketplace e token Polygon conforme politica comercial." },
    ] },
  },
  en: {
    heroEyebrow: "Enterprise Lab",
    heroTitle: "See a physical product become trust, data, and revenue.",
    heroBody: "A sales-ready experience for origin, customer tap, security, portal, marketplace and business analytics.",
    nav: { landing: "Landing", login: "Login", sun: "SUN mobile", portal: "User portal" },
    kpis: { tags: "Physical tags", events: "Events", portal: "Portal", route: "Origin-tap route", noFeed: "No recent feed", leads: "Leads / associations" },
    valueCards: [
      { metric: "CRM + club", title: "Post-tap loyalty", body: "Points, warranty, repurchase and tenant promos stay attached to the consumer passport." },
      { metric: "Marketplace", title: "Luxury network by brand and region", body: "Each brand keeps its own store while joining a nexID network for nearby premium discovery." },
      { metric: "Reseller ready", title: "Operational white-label", body: "Printers, integrators and agencies can load batches, operate tenants and see leads without touching cryptography." },
      { metric: "Live data", title: "Sales with analytics", body: "Scans, routes, risk, clicks and requests land in CRM and dashboards in real time." },
    ],
    roles: {
      ceo: { label: "CEO / investor", headline: "From tap to revenue: protected brand, data and loyalty.", focus: "Show margin, reseller channel and recurring value without technical friction." },
      operator: { label: "Operations", headline: "Real control for batches, UIDs, maps and alerts.", focus: "Ground the rollout: import, activation, live scans and risk exceptions." },
      buyer: { label: "Buyer", headline: "Instant confidence before buying or consuming.", focus: "People understand origin, seal status, benefits and the next action." },
    },
    beats: {
      0: { title: "1. Product origin", body: "Brand activates batch, UID and origin.", event: "Real batch connected to Bodega Balmec.", mode: "valid", location: "mendoza", status: "ORIGIN_READY", cta: "View origin" },
      1: { title: "2. Customer tap", body: "Consumer verifies and sees distance.", event: "Valid Zurich tap with origin route.", mode: "valid", location: "zurich", status: "AUTH_OK", cta: "Join club" },
      2: { title: "3. Risk blocked", body: "Replay or duplicate enters the feed.", event: "Replay signal for anti-fraud.", mode: "replay", location: "zurich", status: "REPLAY_BLOCKED", cta: "View alert" },
      3: { title: "4. Open + monetize", body: "Seal state changes and benefits open.", event: "Opened seal + ownership/tokenization CTA.", mode: "tamper", location: "zurich", status: "OPENED", cta: "Activate ownership" },
    },
    verticals: {
      wine: { label: "Wine", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Label on bottle", "Uncork / broken seal", "SUN anti-replay", "Origin + global tap"] },
      seeds: { label: "Seeds", profile: "QR + NFC UID", product: "Certified seed packet", visual: "seed-packet-demo", proof: ["Anti-counterfeit packet", "Lot and variety", "Agro custody", "Rural use"] },
      pharma: { label: "Pharma", profile: "QR + NFC + recall", product: "Serialized medicine pack", visual: "pharma-pack-demo", proof: ["Auditable pack and lot", "Digital leaflet", "Cold chain", "Unit recall"] },
      creamJar: { label: "Skincare", profile: "NTAG 424 DNA", product: "Premium dermocosmetic set", visual: "cream-jar-demo", proof: ["Lid-package seal", "Opening changes state", "Premium warranty", "Anti grey-market"] },
      perfume: { label: "Perfume", profile: "NTAG 424 DNA", product: "Premium perfume", visual: "perfume-demo", proof: ["Cap-neck seal", "Lot and serial", "Warranty", "Anti-counterfeit"] },
      creamTube: { label: "Cream", profile: "NTAG213 + batch", product: "Dermocosmetic cream", visual: "cream-tube-demo", proof: ["Seal over flip cap", "Visible batch", "Warranty", "Repurchase"] },
      bracelet: { label: "Wristband", profile: "NTAG215", product: "VIP event wristband", visual: "event-bracelet-demo", proof: ["Phone taps wristband", "Serialized UID", "VIP zones", "Duplicate block"] },
      ticket: { label: "Ticket", profile: "QR + NFC UID", product: "VIP party ticket", visual: "party-ticket-demo", proof: ["Visible QR", "UID fallback", "Zone access", "Replay blocked"] },
      sneaker: { label: "Sneaker", profile: "NTAG 424 DNA", product: "Drop Runner 37Z", visual: "sneaker-demo", proof: ["Tongue tap", "UID + SUN", "Rarity visible", "Owner/token"] },
      luxury: { label: "Luxury", profile: "NTAG 424 DNA", product: "Luxury Watch", visual: "luxury-demo", proof: ["Card tap", "UID + SUN", "Certificate of authenticity", "Owner/club"] },
      bottle: { label: "Refill packaging", profile: "GS1/QR + NFC", product: "Premium Refill Pack", visual: "bottle-demo", proof: ["Reusable container", "GS1/QR + optional NFC", "refill cycle", "Active incentive"] },
      logistics: { label: "Logistics", profile: "UHF + NFC + sensor", product: "Cold-chain carton", visual: "logistics-pack-demo", proof: ["Traceable pallet/carton", "Temperature sensor", "Audited route", "Verified delivery"] },
      electronics: { label: "Electronics", profile: "QR + NFC warranty", product: "Serialized device", visual: "electronics-demo", proof: ["Verifiable serial", "Unit warranty", "Support", "Anti-fraud claim"] },
      textile: { label: "Textile DPP", profile: "QR + NFC DPP", product: "Textile passport label", visual: "textile-dpp-demo", proof: ["Origin and composition", "Connected care", "Sustainability", "Verified resale"] },
    },
    controls: { narrative: "Audience narrative", cinematicStart: "Start cinematic", cinematicStop: "Pause cinematic", product: "Physical product", mobile: "Mobile result", feed: "Command feed", valid: "Register valid Zurich tap", tamper: "Break seal / uncork", replay: "Simulate duplicate replay", refresh: "Refresh", marketplace: "Portal + marketplace", mapTitle: "Live map: product origin vs customer tap", mapSubtitle: "Animated route, distance and location links to build trust.", realFeed: "Real public feed connected.", adminKey: "Read-only validation mode: private scan writes run in the secured environment.", noGeo: "No geolocated API events yet.", origin: "Origin", currentTap: "Current tap", distance: "Distance", openOrigin: "Open origin", openTap: "Open tap", joinClub: "Join club", warranty: "Activate warranty", tokenize: "Tokenize premium", syncing: "Connecting to Bodega Balmec...", synced: "Bodega Balmec synced with backend.", unavailable: "Bodega Balmec unavailable.", sendingScan: "Sending scan", registeredScan: "Scan registered in Bodega Balmec.", failedScan: "Could not simulate the tap.", configs: [
      { title: "QR / GS1 Digital Link", body: "Low-cost entry for content, batch, recall and GS1 traceability. It is a strong visible fallback, but it can be copied, so it should not unlock premium ownership by itself." },
      { title: "NTAG213 / NTAG215", body: "Serialized physical UID for tickets, wristbands, simple warranty and mass activations. Adds server-side rules by batch." },
      { title: "NTAG 424 DNA", body: "Every tap creates dynamic SUN + CMAC proof to detect replay, reused links and simple copies. Recommended for mid/high-value products." },
      { title: "Offline Verifier", body: "Android first, iOS where Core NFC/ISO 7816 allows it, or a dedicated reader for no-signal zones: runs local checks from an authorized bundle, without master keys, and keeps verdicts provisional until backend sync." },
      { title: "Polygon Ownership Demo", body: "Enables ownership, certificates or premium tokens only after a fresh tap, validated buyer and approved policy. Polygon does not replace SUN or receive individual taps." },
      { title: "IOTA Proof Layer Demo", body: "Shows optional audit evidence for DPP, batches and logistics: hashes or Merkle roots are anchored, not private data or individual taps." },
      { title: "Dual Proof DPP", body: "Combines QR/GS1, NFC 424, Polygon for ownership and IOTA for industrial evidence when a client needs advanced compliance." },
      { title: "NTAG 424 DNA TT + tokenization", body: "Adds physical seal state: closed, opened or tampered. Enables passport, warranty, marketplace and Polygon token only when claim policy allows it." },
    ] },
  },
};

type DemoCopy = (typeof copy)["es-AR"];

function toFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(radiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function mapsLink(location: { lat: number; lng: number }) {
  return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
}

function routeScopeLabel(locale: AppLocale, routeKm?: number) {
  if (locale === "en") {
    if ((routeKm || 0) > 2500) return "International route";
    if ((routeKm || 0) > 250) return "Regional route";
    return "Local route";
  }
  if (locale === "pt-BR") {
    if ((routeKm || 0) > 2500) return "Rota internacional";
    if ((routeKm || 0) > 250) return "Rota regional";
    return "Rota local";
  }
  if ((routeKm || 0) > 2500) return "Ruta internacional";
  if ((routeKm || 0) > 250) return "Ruta regional";
  return "Ruta local";
}

function routeEvidenceLabel(locale: AppLocale) {
  if (locale === "en") return "Evidence";
  if (locale === "pt-BR") return "Evidencia";
  return "Evidencia";
}

function routePolicyLabel(locale: AppLocale) {
  if (locale === "en") return "Policy";
  if (locale === "pt-BR") return "Politica";
  return "Politica";
}

function routeEvidenceValue(locale: AppLocale, scenario?: Pick<DemoScenario, "tone" | "stateLabel">, routeKm?: number) {
  if (scenario?.tone === "risk") {
    if (locale === "en") return "Blocked replay";
    if (locale === "pt-BR") return "Copia bloqueada";
    return "Copia bloqueada";
  }
  if (scenario?.tone === "open") {
    if (locale === "en") return "Seal event audited";
    if (locale === "pt-BR") return "Lacre auditado";
    return "Sello auditado";
  }
  if (scenario?.tone === "origin") {
    if (locale === "en") return "Origin prepared";
    if (locale === "pt-BR") return "Origem preparada";
    return "Origen preparado";
  }
  return routeScopeLabel(locale, routeKm);
}

function getRealProductBadge(locale: AppLocale) {
  if (locale === "en") return "Real product";
  if (locale === "pt-BR") return "Produto real";
  return "Producto real";
}

function formatEventResult(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "SIN DATO";
  if (normalized.includes("AUTH_OK") || normalized === "VALID") return "AUTENTICADO";
  if (normalized.includes("NOT_REGISTERED")) return "NO REGISTRADO";
  if (normalized.includes("REPLAY") || normalized.includes("DUPLICATE")) return "COPIA BLOQUEADA";
  if (normalized.includes("TAMPER")) return "MANIPULADO";
  if (normalized.includes("OPEN")) return "ABIERTO";
  if (normalized.includes("ORIGIN") || normalized.includes("PRODUCT")) return "ORIGEN LISTO";
  if (normalized.includes("REVOKED")) return "REVOCADO";
  if (normalized.includes("INVALID")) return "INVÁLIDO";
  return "EVENTO REGISTRADO";
}

function demoAtlasPointId(point: DemoMapPoint, index: number) {
  if (index === 0) return "origin";
  if (index === 1) return "tap";
  const slug = `${point.city}-${point.country || ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `tap-${index}-${slug || "point"}`;
}

function toDemoAtlasPoints(points: DemoMapPoint[], controls: Pick<DemoCopy["controls"], "origin" | "currentTap">): VectorMapPoint[] {
  return points.map((point, index) => ({
    id: demoAtlasPointId(point, index),
    label: point.city,
    sublabel: point.country || point.status || "",
    lat: point.lat,
    lng: point.lng,
    scans: point.scans,
    risk: point.risk,
    tone: index === 0 ? "origin" : point.risk ? "risk" : "tap",
    stageLabel: index === 0 ? controls.origin : controls.currentTap,
    evidence: point.status || point.lastSeen,
    lastSeen: point.lastSeen,
  }));
}

function getScenarioState(txt: DemoCopy, beat: Beat, routeKm: number, locale: AppLocale): DemoScenario {
  const routeEvidence = routeEvidenceValue(locale, undefined, routeKm);
  if (beat === 0) {
    return {
      tone: "origin",
      headline: "Producto activado en origen",
      body: "La marca programa lote, UID, origen y política comercial antes de entregar el producto al canal.",
      stateLabel: "ORIGEN ACTIVO",
      allowed: ["Auditar lote", "Abrir ubicación", "Preparar QR/NFC"],
      blocked: ["Reclamo de dueño", "Token de valor", "Garantía postventa"],
      chain: "Sin NFT: producto todavía no fue comprado ni reclamado.",
      primaryAction: "origin",
      primaryLabel: txt.controls.openOrigin,
    };
  }
  if (beat === 2) {
    return {
      tone: "risk",
      headline: "Copia o duplicado bloqueado",
      body: "El sistema conserva trazabilidad, pero bloquea club, puntos, tienda y tokenización hasta un nuevo toque físico válido.",
      stateLabel: "RIESGO BLOQUEADO",
      allowed: ["Ver procedencia", "Reportar incidente"],
      blocked: ["Reclamo de dueño", "Garantía", "Tokenización", "Tienda"],
      chain: "No se firma en cadena cuando hay copia o URL reutilizada.",
      primaryAction: "report",
      primaryLabel: "Reportar copia",
    };
  }
  if (beat === 3) {
    return {
      tone: "open",
      headline: "Sello abierto como evento del producto",
      body: "El producto conserva evidencia válida. Cambia su estado físico y solo prepara postventa o token de valor con compra/reclamo validado.",
      stateLabel: "SELLO ABIERTO",
      allowed: ["Garantía postventa", "Procedencia", "Token de valor con prueba de compra"],
      blocked: ["Reventa como cerrado", "Reclamo anonimo sin prueba"],
      chain: "Solicitud Polygon disponible cuando la política de dueño confirma comprador.",
      primaryAction: "tokenize",
      primaryLabel: txt.controls.tokenize,
    };
  }
  return {
    tone: "ok",
    headline: "Toque válido con ruta de confianza",
    body: `Origen y toque quedan unidos por evidencia viva: ${routeEvidence}. El consumidor ve el resultado de confianza y la marca recibe datos accionables.`,
    stateLabel: "AUTENTICADO",
    allowed: ["Unirse al club", "Guardar pasaporte", "Solicitud Polygon", "Voucher o recompra"],
    blocked: ["Transferir dueño sin ingreso/reclamo"],
    chain: "Tokenización bajo política: el toque válido crea una solicitud y solo cierra con tx_hash/token_id si el tenant aprueba la operación.",
    primaryAction: "join",
    primaryLabel: txt.controls.joinClub,
  };
}

async function readDemoSummary(): Promise<DemoSummary> {
  const response = await fetch("/api/demo/summary", { cache: "no-store" });
  const data = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
  if (!response.ok || data?.ok === false) throw new Error(String(data?.reason || "No se pudo leer Bodega Balmec."));
  return data as DemoSummary;
}

export function DemoLabClient({ locale, initialVertical, initialScenario }: { locale: AppLocale; initialVertical?: string; initialScenario?: string }) {
  const txt = copy[locale] || copy["es-AR"];
  const scenarioStart = useMemo(() => getScenarioStart(initialScenario), [initialScenario]);
  const [viewMode, setViewMode] = useState<"simulator" | "crm">("simulator");
  const [role, setRole] = useState<Role>("ceo");
  const [vertical, setVertical] = useState<Vertical>(() => initialVertical ? normalizeDemoVertical(initialVertical) : scenarioStart.vertical);
  const [beat, setBeat] = useState<Beat>(scenarioStart.beat);
  const [trustScenario, setTrustScenario] = useState<DemoTrustScenarioKey | null>(scenarioStart.key);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [status, setStatus] = useState(txt.controls.syncing);
  const [simulating, setSimulating] = useState(false);
  const [fallbackLastSeen, setFallbackLastSeen] = useState(STABLE_DEMO_TIME);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [modalView, setModalView] = useState<DemoModalView>(null);

  const [toasts, setToasts] = useState<Array<{
    id: string;
    title: string;
    body: string;
    type: "success" | "warn" | "error" | "info";
  }>>([]);

  const addToast = (title: string, body: string, type: "success" | "warn" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, body, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const lastEventCountRef = useRef<number>(0);

  useEffect(() => {
    if (!summary || !summary.events) return;
    const events = summary.events;
    if (lastEventCountRef.current === 0) {
      lastEventCountRef.current = events.length;
      return;
    }
    if (events.length > lastEventCountRef.current) {
      const newEvents = events.slice(0, events.length - lastEventCountRef.current);
      newEvents.forEach((event) => {
        const resultText = String(event.result || "").toUpperCase();
        const isSuccess = resultText.includes("AUTH_OK") || resultText.includes("VALID") || resultText.includes("VERIFIED") || resultText.includes("OK") || resultText.includes("AUTHENTICATED");
        const isRisk = resultText.includes("REPLAY") || resultText.includes("FAIL") || resultText.includes("SUSPICIOUS") || resultText.includes("COPIA");
        const isTamper = resultText.includes("TAMPER") || resultText.includes("OPEN") || resultText.includes("ABIERTO") || resultText.includes("MANIPULADO");
        
        const type = isSuccess ? "success" : isRisk ? "error" : isTamper ? "warn" : "info";
        const title = isSuccess 
          ? "Escaneo Autenticado" 
          : isRisk 
          ? "¡Alerta de Fraude!"
          : isTamper 
          ? "Sello de Seguridad Abierto" 
          : "Lectura Registrada";
        const body = `Producto: ${event.product_name || txt.verticals[vertical]?.product || "Lote Premium"} en ${event.city || "Ubicación remota"}. Verdict: ${event.result}`;
        addToast(title, body, type);
      });
      lastEventCountRef.current = events.length;
    }
  }, [summary, vertical]);

  useEffect(() => setFallbackLastSeen(new Date().toISOString()), []);

  useEffect(() => {
    if (initialVertical) {
      setVertical(normalizeDemoVertical(initialVertical));
      return;
    }
    setVertical(scenarioStart.vertical);
    setBeat(scenarioStart.beat);
    setTrustScenario(scenarioStart.key);
  }, [initialVertical, scenarioStart.beat, scenarioStart.key, scenarioStart.vertical]);

  function selectTrustScenario(key: DemoTrustScenarioKey) {
    const next = getScenarioStart(key);
    setTrustScenario(key);
    setVertical(next.vertical);
    setBeat(next.beat);
  }

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const next = await readDemoSummary();
        if (!alive) return;
        setSummary(next);
        setStatus(next.degraded || next.source === "public-proof" ? `${txt.controls.realFeed} ${txt.controls.adminKey}` : txt.controls.synced);
      } catch (error) {
        if (!alive) return;
        setStatus(error instanceof Error ? error.message : txt.controls.unavailable);
      }
    }
    const loadWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void load();
    };
    loadWhenVisible();
    const onVisibilityChange = () => loadWhenVisible();
    document.addEventListener("visibilitychange", onVisibilityChange);
    const id = window.setInterval(loadWhenVisible, 10000);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(id);
    };
  }, [txt.controls.adminKey, txt.controls.realFeed]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setBeat((current) => (current >= 3 ? 0 : ((current + 1) as Beat))), 5000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    setActionMessage(null);
  }, [beat, vertical]);

  useEffect(() => {
    if (!modalView) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setModalView(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalView]);

  const activeBeat = txt.beats[beat];
  const activeRole = txt.roles[role];
  const activeVertical = txt.verticals[vertical];
  const destination = LOCATIONS[activeBeat.location];
  const routeKm = haversineKm(LOCATIONS.origin, destination);
  const scenario = getScenarioState(txt, beat, routeKm, locale);
  const realProductBadge = getRealProductBadge(locale);
  const liveEvents = Array.isArray(summary?.events) ? summary.events : [];
  const latestEvent = liveEvents[0];
  const livePoints = liveEvents.flatMap<DemoMapPoint>((event) => {
    const lat = toFiniteNumber(event.lat);
    const lng = toFiniteNumber(event.lng);
    if (lat === null || lng === null) return [];
    return [{
      city: event.city || "Sin dato",
      country: event.country_code || "UNK",
      lat,
      lng,
      scans: 1,
      risk: /REPLAY|DUPLICATE|TAMPER|INVALID|REVOKED/i.test(event.result || "") ? 1 : 0,
      status: formatEventResult(event.result),
      lastSeen: event.created_at || fallbackLastSeen,
      vertical,
    }];
  });

  const mapPoints = useMemo<DemoMapPoint[]>(() => {
    const originPoint = { city: LOCATIONS.origin.city, country: LOCATIONS.origin.country, lat: LOCATIONS.origin.lat, lng: LOCATIONS.origin.lng, scans: 1, risk: 0, status: "ORIGEN LISTO", lastSeen: fallbackLastSeen, vertical };
    if (livePoints.length) return [originPoint, ...livePoints.slice(0, 18)];
    return [originPoint, { city: destination.city, country: destination.country, lat: destination.lat, lng: destination.lng, scans: 1, risk: activeBeat.mode === "replay" ? 1 : 0, status: activeBeat.status, lastSeen: fallbackLastSeen, vertical }];
  }, [activeBeat.mode, activeBeat.status, destination, fallbackLastSeen, livePoints, vertical]);

  const atlasPoints = useMemo(() => toDemoAtlasPoints(mapPoints, txt.controls), [mapPoints, txt.controls]);
  const atlasRoutes = useMemo<VectorMapRoute[]>(() => [{
    id: `route-origin-${destination.city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    fromLat: LOCATIONS.origin.lat,
    fromLng: LOCATIONS.origin.lng,
    toLat: destination.lat,
    toLng: destination.lng,
    label: `${LOCATIONS.origin.city} -> ${destination.city}`,
    tone: activeBeat.mode === "replay" ? "warn" : "info",
    distanceLabel: routeEvidenceValue(locale, scenario, routeKm),
    evidence: scenario.stateLabel,
  }], [activeBeat.mode, destination.city, destination.lat, destination.lng, locale, routeKm, scenario.stateLabel, scenario.tone]);

  async function refreshSummary() {
    try {
      const next = await readDemoSummary();
      setSummary(next);
      setStatus(next.degraded || next.source === "public-proof" ? `${txt.controls.realFeed} ${txt.controls.adminKey}` : txt.controls.synced);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : txt.controls.unavailable);
    }
  }

  async function simulate(mode: SimulationMode) {
    const nextBeat: Beat = mode === "replay" ? 2 : mode === "tamper" ? 3 : 1;
    const nextBeatCopy = txt.beats[nextBeat];
    const nextDestination = LOCATIONS[nextBeatCopy.location];
    const modeLabel = mode === "replay" ? "COPIA" : mode === "tamper" ? "APERTURA" : "TOQUE";
    setSimulating(true);
    setBeat(nextBeat);
    setStatus(`${txt.controls.sendingScan} ${modeLabel.toLowerCase()} - ${nextDestination.city}...`);
    try {
      const response = await fetch("/api/demo/simulate-tap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, city: nextDestination.city, countryCode: nextDestination.countryCode, lat: nextDestination.lat, lng: nextDestination.lng, deviceLabel: `Laboratorio nexID - ${nextDestination.label}` }),
      });
      const payload = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
      if (!response.ok || payload?.ok === false) throw new Error(String(payload?.reason || payload?.payload?.reason || "lectura fallida"));
      if (payload?.degraded) {
        setStatus(`${modeLabel}: ${String(payload.reason || txt.controls.adminKey)}`);
        setActionMessage(mode === "replay" ? "Copia simulada: reclamo de dueño, puntos y tokenización quedan bloqueados." : mode === "tamper" ? "Sello abierto: se registra evento del producto y queda listo para postventa controlada." : "Toque válido: club, tienda y analítica quedan listos para activar.");
        return;
      }
      setStatus(`${modeLabel}: ${txt.controls.registeredScan}`);
      setActionMessage(mode === "replay" ? "Copia simulada: reclamo de dueño, puntos y tokenización quedan bloqueados." : mode === "tamper" ? "Sello abierto: se registra evento del producto y queda listo para postventa controlada." : "Toque válido: club, tienda y analítica quedan listos para activar.");
      await refreshSummary();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : txt.controls.failedScan);
    } finally {
      setSimulating(false);
    }
  }

  function handleDemoAction(action: DemoAction) {
    if (action === "origin") {
      window.open(mapsLink(LOCATIONS.origin), "_blank", "noopener,noreferrer");
      setActionMessage("Origen abierto en Maps. Esta es la prueba de procedencia visible para el comprador.");
      return;
    }
    if (action === "tap") {
      window.open(mapsLink(destination), "_blank", "noopener,noreferrer");
      setActionMessage(`Toque actual abierto en Maps: ${destination.city}.`);
      return;
    }
    if (action === "report") {
      setActionMessage("Incidente creado para CRM: copia, manipulacion o inconsistencia queda listo para revision operativa.");
      return;
    }
    if (action === "warranty") {
      setActionMessage(beat === 2 ? "Garantía bloqueada: se necesita un nuevo toque físico válido." : "Garantía preparada: queda asociada al pasaporte del consumidor y a la marca.");
      return;
    }
    if (action === "tokenize") {
      setActionMessage(beat === 3 ? "Tokenización de valor preparada: requiere compra o reclamo validado antes de transferir propiedad." : beat === 1 ? "Solicitud de tokenización lista: Polygon registra tx_hash/token_id solo si el tenant aprueba la operación." : "Tokenización bloqueada por política de seguridad para este estado.");
      return;
    }
    setActionMessage(beat === 2 ? "Club bloqueado por copia. Repetí el toque físico para continuar." : "Club/tienda listo: el consumidor puede asociarse y recibir beneficios de la marca.");
  }

  function startGuidedDemo() {
    setBeat(0);
    setRunning(true);
    setModalView(null);
    setActionMessage("Modo guiado activo: primero mira la etiqueta cerrada, después el toque válido, copia bloqueada y apertura con reclamo/tokenización.");
  }

  return (
    <main className={`demo-lab-shell demo-lab-shell--${viewMode} container-shell py-8 text-slate-100`}>
      {/* Premium Toggle Header */}
      <div className="demo-lab-mode-bar demo-lab-mode-bar--compact mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-950/45 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-cyan-300">nexID Demo Lab</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode("simulator")}
            className={`demo-lab-mode-tab ${viewMode === "simulator" ? "is-active" : "is-inactive"} rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
              viewMode === "simulator"
                ? "border border-cyan-400/30 bg-cyan-500/20 text-cyan-200"
                : "border border-white/5 bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            Simulador de Producto
          </button>
          <button
            type="button"
            onClick={() => setViewMode("crm")}
            className={`demo-lab-mode-tab ${viewMode === "crm" ? "is-active" : "is-inactive"} rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition flex items-center gap-2 ${
              viewMode === "crm"
                ? "border border-cyan-400/30 bg-cyan-500/20 text-cyan-200"
                : "border border-white/5 bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            <span>Live CRM & Leads</span>
            {Number(summary?.crm?.leads ?? 0) > 0 && (
              <span className="rounded-full bg-cyan-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                {summary?.crm?.leads}
              </span>
            )}
          </button>
        </div>
      </div>

      {viewMode === "crm" ? (
        <DemoCrmDashboard
          summary={summary}
          locale={locale}
          mapPoints={mapPoints}
          activeVertical={activeVertical}
          refreshSummary={refreshSummary}
          simulate={simulate}
          simulating={simulating}
          txt={txt}
        />
      ) : (
        <>
          <DemoLabStudioHero
            txt={txt}
            beat={beat}
            vertical={vertical}
            activeVertical={activeVertical}
            scenario={scenario}
            destination={destination}
            routeKm={routeKm}
            locale={locale}
            summary={summary}
            mapPoints={mapPoints}
            liveEvents={liveEvents}
            latestEvent={latestEvent}
            simulating={simulating}
            activeTrustScenario={trustScenario}
            onVertical={(nextVertical) => {
              setTrustScenario(null);
              setVertical(nextVertical);
            }}
            onBeat={setBeat}
            onTrustScenario={selectTrustScenario}
            onPassport={() => setModalView("mobile")}
            onValid={() => void simulate("valid")}
            onOpen={() => void simulate("tamper")}
            onReplay={() => void simulate("replay")}
          />
        </>
      )}

      <DemoFlowModal
        view={modalView}
        txt={txt}
        beat={beat}
        vertical={vertical}
        status={activeBeat.status}
        product={activeVertical.product}
        destination={destination}
        routeKm={routeKm}
        scenario={scenario}
        actionMessage={actionMessage}
        locale={locale}
        onAction={handleDemoAction}
        onClose={() => setModalView(null)}
        onOpen={setModalView}
      />

      {/* Floating Toast Notification Center */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <style>{`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          .animate-slideInRight {
            animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
        {toasts.map((toast) => {
          const typeColors = {
            success: "bg-emerald-950/90 border-emerald-500/30 text-emerald-100",
            warn: "bg-amber-950/90 border-amber-500/30 text-amber-100",
            error: "bg-rose-950/90 border-rose-500/30 text-rose-100",
            info: "bg-slate-950/90 border-cyan-500/30 text-cyan-100"
          };
          const Icon = {
            success: CheckCircle2,
            warn: AlertTriangle,
            error: AlertTriangle,
            info: Fingerprint
          }[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100 animate-slideInRight ${typeColors[toast.type]}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                <Icon className={`h-5 w-5 ${
                  toast.type === "success" ? "text-emerald-400" :
                  toast.type === "warn" ? "text-amber-400" :
                  toast.type === "error" ? "text-rose-400" : "text-cyan-400"
                }`} />
              </div>
              <div className="flex-1">
                <h5 className="text-xs font-black uppercase tracking-wider">{toast.title}</h5>
                <p className="text-[11px] leading-relaxed text-slate-300 mt-1 font-medium">{toast.body}</p>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-400 hover:text-white text-xs self-start"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function DemoLabStudioHero({
  txt,
  beat,
  vertical,
  activeVertical,
  scenario,
  destination,
  routeKm,
  locale,
  summary,
  mapPoints,
  liveEvents,
  latestEvent,
  simulating,
  activeTrustScenario,
  onVertical,
  onBeat,
  onTrustScenario,
  onPassport,
  onValid,
  onOpen,
  onReplay,
}: {
  txt: DemoCopy;
  beat: Beat;
  vertical: Vertical;
  activeVertical: DemoCopy["verticals"][Vertical];
  scenario: DemoScenario;
  destination: DemoLocation;
  routeKm: number;
  locale: AppLocale;
  summary: DemoSummary | null;
  mapPoints: DemoMapPoint[];
  liveEvents: DemoEvent[];
  latestEvent?: DemoEvent;
  simulating: boolean;
  activeTrustScenario: DemoTrustScenarioKey | null;
  onVertical: (vertical: Vertical) => void;
  onBeat: (beat: Beat) => void;
  onTrustScenario: (scenario: DemoTrustScenarioKey) => void;
  onPassport: () => void;
  onValid: () => void;
  onOpen: () => void;
  onReplay: () => void;
}) {
  const verticalList = DEMO_VERTICAL_ORDER;
  const [step, setStep] = useState<DemoWizardStep>(() => getTrustScenarioInitialStep(activeTrustScenario));
  const trustContext = useMemo(() => getTrustScenarioContext(activeTrustScenario, locale), [activeTrustScenario, locale]);

  useEffect(() => {
    setStep(getTrustScenarioInitialStep(activeTrustScenario));
  }, [activeTrustScenario]);

  const stepLabels = locale === "en"
    ? ["Tap", "Verified", "Traced", "Won"]
    : locale === "pt-BR"
    ? ["Toque", "Verificou", "Rastreou", "Ganhou"]
    : ["Toca", "Verificó", "Trazó", "Ganó"];

  const stepGuidance = locale === "en"
    ? [
      { label: "Physical signal", title: "A product becomes a verifiable entry point.", body: "The NFC or QR touch opens the passport and starts a private evidence trail." },
      { label: "Trust decision", title: "nexID resolves whether the product can be trusted.", body: "SUN, UID, tenant policy and risk state become a clear business verdict." },
      { label: "Operational evidence", title: "The route becomes an auditable map, not a table.", body: "Custody, city, risk and hash-only proof are visible without exposing sensitive data." },
      { label: "Commercial action", title: "The brand gets the next best action.", body: "Warranty, claim, CRM, loyalty or ownership can be activated from the same tap." },
    ]
    : locale === "pt-BR"
    ? [
      { label: "Sinal fisico", title: "O produto vira um ponto verificavel.", body: "O toque NFC ou QR abre o passaporte e inicia evidencia privada." },
      { label: "Decisao de confianca", title: "nexID resolve se o produto e confiavel.", body: "SUN, UID, politica do tenant e risco viram um veredito claro." },
      { label: "Evidencia operacional", title: "A rota vira um mapa auditavel.", body: "Custodia, cidade, risco e prova hash-only ficam visiveis sem dados sensiveis." },
      { label: "Acao comercial", title: "A marca recebe a proxima melhor acao.", body: "Garantia, claim, CRM, loyalty ou ownership saem do mesmo toque." },
    ]
    : [
      { label: "Senal fisica", title: "El producto se vuelve un punto verificable.", body: "El toque NFC o QR abre el pasaporte y arranca evidencia privada." },
      { label: "Decision de confianza", title: "nexID resuelve si el producto es confiable.", body: "SUN, UID, politica del tenant y riesgo se vuelven un veredicto claro." },
      { label: "Evidencia operativa", title: "La ruta se ve como mapa auditable.", body: "Custodia, ciudad, riesgo y prueba hash-only quedan visibles sin datos sensibles." },
      { label: "Accion comercial", title: "La marca obtiene la proxima mejor accion.", body: "Garantia, reclamo, CRM, loyalty u ownership salen del mismo tap." },
    ];
  const activeStepGuidance = stepGuidance[step];
  const traceProofCards = locale === "en"
    ? [
      { label: "nexID", title: "Business verdict", body: "UID, batch, tenant policy and risk become one decision before benefits open.", proof: "Private rules stay inside nexID" },
      { label: "IOTA", title: "Public hash-only receipt", body: "A Merkle root or memo can prove inclusion without exposing customers, routes or keys.", proof: "Explorer proves time and payload" },
      { label: "Polygon", title: "Approved ownership", body: "Ownership or premium certificate only appears after buyer claim and tenant approval.", proof: "No mint on replay or anonymous claim" },
      { label: "API", title: "Operational action", body: "CRM, recall, warranty, loyalty or webhook receive a usable result from the same tap.", proof: "Enterprise systems can act" },
    ]
    : locale === "pt-BR"
    ? [
      { label: "nexID", title: "Veredito de negocio", body: "UID, lote, politica do tenant e risco viram uma decisao antes dos beneficios.", proof: "Regras privadas ficam no nexID" },
      { label: "IOTA", title: "Recibo publico hash-only", body: "Merkle root ou memo prova inclusao sem expor clientes, rotas ou chaves.", proof: "Explorer prova tempo e payload" },
      { label: "Polygon", title: "Ownership aprovado", body: "Certificado ou ownership aparece so depois de claim do comprador e aprovacao.", proof: "Sem mint em replay ou claim anonimo" },
      { label: "API", title: "Acao operacional", body: "CRM, recall, garantia, loyalty ou webhook recebem um resultado acionavel.", proof: "Sistemas enterprise podem agir" },
    ]
    : [
      { label: "nexID", title: "Veredicto de negocio", body: "UID, lote, politica del tenant y riesgo se vuelven una decision antes de abrir beneficios.", proof: "Reglas privadas quedan en nexID" },
      { label: "IOTA", title: "Recibo publico hash-only", body: "Merkle root o memo prueba inclusion sin exponer clientes, rutas privadas ni llaves.", proof: "Explorer prueba tiempo y payload" },
      { label: "Polygon", title: "Ownership aprobado", body: "Certificado u ownership aparece solo despues de claim del comprador y aprobacion.", proof: "Sin mint en replay o claim anonimo" },
      { label: "API", title: "Accion operativa", body: "CRM, recall, garantia, loyalty o webhook reciben un resultado accionable.", proof: "Sistemas enterprise pueden actuar" },
    ];
  const executiveOutcomeCards = locale === "en"
    ? [
      { metric: "Fraud", title: "Block copied URLs", body: "Replay, tamper and invalid channels stop before claims, store actions or certificates.", proof: "Risk policy applied" },
      { metric: "Channel", title: "See real demand", body: "Valid taps create city, campaign and stock signals without assuming personal identity.", proof: "CRM signal ready" },
      { metric: "Compliance", title: "Audit without data leak", body: "Hash-only evidence can be checked by auditors while private operations stay private.", proof: "DPP-ready proof" },
      { metric: "Revenue", title: "Open post-sale paths", body: "Warranty, ownership, loyalty and partner offers start from a verified product event.", proof: "Next action ready" },
    ]
    : locale === "pt-BR"
    ? [
      { metric: "Fraude", title: "Bloqueia URLs copiadas", body: "Replay, tamper e canal invalido param antes de claims, loja ou certificados.", proof: "Politica de risco aplicada" },
      { metric: "Canal", title: "Mostra demanda real", body: "Taps validos criam sinais de cidade, campanha e estoque sem assumir identidade pessoal.", proof: "Sinal CRM pronto" },
      { metric: "Compliance", title: "Audita sem vazar dados", body: "Evidencia hash-only pode ser checada por auditores mantendo operacao privada.", proof: "Prova DPP-ready" },
      { metric: "Receita", title: "Abre pos-venda", body: "Garantia, ownership, loyalty e ofertas de parceiros saem de evento verificado.", proof: "Proxima acao pronta" },
    ]
    : [
      { metric: "Fraude", title: "Bloquea URLs copiadas", body: "Replay, tamper y canal invalido frenan antes de claims, tienda o certificados.", proof: "Politica de riesgo aplicada" },
      { metric: "Canal", title: "Muestra demanda real", body: "Taps validos crean senales de ciudad, campana y stock sin asumir identidad personal.", proof: "Senal CRM lista" },
      { metric: "Compliance", title: "Audita sin filtrar datos", body: "Evidencia hash-only puede ser revisada por auditores sin exponer la operacion privada.", proof: "Prueba DPP-ready" },
      { metric: "Revenue", title: "Abre postventa", body: "Garantia, ownership, loyalty y ofertas de partners salen de un evento verificado.", proof: "Proxima accion lista" },
    ];
  const proofDecoderTitle = locale === "en" ? "What this map proves" : locale === "pt-BR" ? "O que este mapa prova" : "Que prueba este mapa";
  const proofDecoderBody = locale === "en"
    ? "The visible trace is a business explanation. The cryptographic evidence is hash-only: nexID keeps private data, IOTA can anchor audit receipts, and Polygon is reserved for ownership or certificates."
    : locale === "pt-BR"
    ? "A rota visivel e uma explicacao de negocio. A evidencia criptografica e hash-only: nexID guarda dados privados, IOTA pode ancorar recibos e Polygon fica para ownership ou certificados."
    : "La ruta visible es una explicacion de negocio. La evidencia criptografica es hash-only: nexID guarda datos privados, IOTA puede anclar recibos y Polygon queda para ownership o certificados.";
  const outcomeHeader = locale === "en"
    ? "Board-ready outcome from one verified tap"
    : locale === "pt-BR"
    ? "Resultado executivo de um toque verificado"
    : "Resultado ejecutivo de un tap verificado";
  const outcomeSubhead = locale === "en"
    ? "This is the part a buyer, auditor or investor needs to understand: product trust becomes operational control and commercial action, not just a pretty certificate."
    : locale === "pt-BR"
    ? "Isto e o que comprador, auditor ou investidor precisa entender: confianca do produto vira controle operacional e acao comercial."
    : "Esto es lo que un comprador, auditor o inversor necesita entender: la confianza del producto se convierte en control operativo y accion comercial.";
  const proofVerifierCta = locale === "en" ? "Open public Proof Verify" : locale === "pt-BR" ? "Abrir Proof Verify publico" : "Abrir Proof Verify publico";

  const scheduleLabel = locale === "en" ? "Schedule demo →" : locale === "pt-BR" ? "Agendar demo →" : "Agendar demo →";
  const backHome = locale === "en" ? "← nexID" : "← nexID";

  return (
    <section className={`demo-lab-studio demo-lab-studio--${vertical} demo-lab-studio--${scenario.tone} relative min-h-[calc(100vh-7rem)] overflow-hidden rounded-[28px] border border-cyan-300/15 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/30 shadow-2xl`}>

      {/* ── WIZARD NAV BAR ─────────────────────────────────────── */}
      <nav className="demo-lab-wizard-nav sticky top-3 z-20 m-3 flex flex-col gap-2 rounded-2xl border border-slate-700/70 bg-slate-950/80 p-2 backdrop-blur md:flex-row md:items-center md:justify-between" aria-label="Demo Lab wizard">
        <Link href="/" className="demo-lab-wizard-nav-back inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-white/10 px-4 text-xs font-black uppercase tracking-wider text-slate-300">
          {backHome}
        </Link>
        <div className="demo-lab-wizard-steps flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {stepLabels.map((label, index) => (
            <button
              suppressHydrationWarning
              key={index}
              type="button"
              aria-current={step === index ? "step" : undefined}
              aria-pressed={step === index}
              aria-label={`${index + 1}. ${label}`}
              onClick={() => setStep(index as 0 | 1 | 2 | 3)}
              className={`demo-lab-wizard-step-pill inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border px-4 text-xs font-black uppercase tracking-wider transition ${
                step === index
                  ? "is-active border-cyan-300 bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/20"
                  : step > index
                    ? "is-done border-emerald-300/40 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-white/5 text-slate-400"
              }`}
            >
              <span className="demo-lab-wizard-step-num grid h-5 w-5 place-items-center rounded-full bg-white/15 text-[10px]" aria-hidden="true">{index + 1}</span>{" "}
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="demo-lab-wizard-actions">
          <DemoLabThemeToggle />
          <a href="/?contact=demo#contact-modal" className="demo-lab-wizard-step-pill demo-lab-wizard-cta is-active inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-cyan-300 bg-cyan-300 px-4 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-500/20">
            <span className="demo-lab-cta-full">{scheduleLabel}</span>
            <span className="demo-lab-cta-short">Demo</span>
          </a>
        </div>
      </nav>

      <div className="demo-lab-wizard-brief" aria-live="polite">
        <div className="demo-lab-wizard-brief__copy">
          <span>{activeStepGuidance.label}</span>
          <strong>{activeStepGuidance.title}</strong>
          <p>{activeStepGuidance.body}</p>
        </div>
        <div className="demo-lab-wizard-brief__proof">
          <span>4 pasos</span>
          <span>hash-only</span>
          <span>IOTA / Polygon ready</span>
        </div>
      </div>

      <details className="demo-lab-trust-switcher" open={!activeTrustScenario}>
        <summary>
          <span>{locale === "en" ? "Switch trust layer" : locale === "pt-BR" ? "Trocar camada de confianca" : "Cambiar capa de confianza"}</span>
          <strong>{activeTrustScenario ? trustContext?.title : locale === "en" ? "Choose IOTA, Polygon, NFC, offline or DPP" : "Elegir IOTA, Polygon, NFC, offline o DPP"}</strong>
          <ChevronRight className="h-4 w-4" />
        </summary>
        {trustContext ? <DemoTrustScenarioContextCard context={trustContext} /> : null}
        <DemoTrustScenarioRail
          txt={txt}
          locale={locale}
          active={activeTrustScenario}
          onSelect={onTrustScenario}
          variant="wizard"
        />
      </details>

      {/* ── STEP 0: TOCA ─────────────────────────────────────── */}
      {step === 0 && (
        <div className="demo-lab-wizard-scene demo-lab-wizard-scene--toca grid min-h-[calc(100vh-12rem)] gap-5 p-3 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(18rem,1.35fr)_minmax(12rem,0.75fr)]">
          {/* Left: product context */}
          <div className="demo-lab-wizard-context rounded-3xl border border-white/10 bg-slate-900/65 p-5 shadow-inner">
            <p className="demo-lab-wizard-eyebrow text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.heroEyebrow}</p>
            <h2 className="demo-lab-wizard-product-name mt-2 text-3xl font-black leading-none text-white md:text-5xl">{activeVertical.product}</h2>
            <p className="demo-lab-wizard-tagline mt-3 text-sm leading-6 text-slate-400">{txt.verticals[vertical].label} · {activeVertical.profile}</p>
          </div>

          {/* Center: product visual + tap button */}
          <div className="demo-lab-wizard-center grid min-w-0 justify-items-center gap-4">
            <DemoCinematicProductRender
              vertical={vertical}
              product={activeVertical.product}
              badge={getRealProductBadge(locale)}
              beat={beat}
              title={scenario.stateLabel}
              stat={scenario.chain}
              variant="studio"
            />
            <button
              suppressHydrationWarning
              type="button"
              disabled={simulating}
              onClick={() => {
                onValid();
                setTimeout(() => setStep(1), 800);
              }}
              className="demo-lab-wizard-tap-btn relative grid h-44 w-44 place-items-center overflow-hidden rounded-full border border-cyan-300/40 bg-cyan-500/15 font-black uppercase text-cyan-50 shadow-[0_0_70px_rgba(6,182,212,0.25)]"
            >
              <span className="demo-lab-wizard-tap-ring absolute inset-5 rounded-full border border-cyan-200/30 animate-ping" />
              <span className="demo-lab-wizard-tap-ring demo-lab-wizard-tap-ring--2 absolute inset-9 rounded-full border border-cyan-200/20" />
              <Fingerprint className="relative z-10" size={48} />
              <span className="relative z-10 text-xs">Tocar tag NFC</span>
            </button>
          </div>

          {/* Right: vertical switcher */}
          <div className="demo-lab-wizard-verticals grid max-h-[68vh] gap-3 overflow-y-auto">
            {verticalList.map((item) => (
              <button
                suppressHydrationWarning
                key={item}
                type="button"
                onClick={() => onVertical(item)}
                className={`demo-lab-wizard-vertical-btn grid w-full grid-cols-[3.2rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border p-2 text-left transition ${
                  vertical === item
                    ? "is-active border-cyan-300/50 bg-cyan-500/20 text-white"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                }`}
              >
                <DemoStudioMiniProduct vertical={item} />
                <span>{txt.verticals[item].label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 1: VERIFICÓ ─────────────────────────────────── */}
      {step === 1 && (
        <div className="demo-lab-wizard-scene demo-lab-wizard-scene--verifico grid min-h-[calc(100vh-12rem)] gap-5 p-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.8fr)]">
          <div className="demo-lab-wizard-result-card grid min-h-[28rem] content-center justify-items-start rounded-3xl border border-white/10 bg-slate-900/65 p-5 shadow-inner">
            <div className="demo-lab-wizard-result-icon grid h-20 w-20 place-items-center rounded-3xl bg-emerald-500/15 text-emerald-200">
              <ShieldCheck size={64} />
            </div>
            <h2 className="demo-lab-wizard-result-status mt-4 text-3xl font-black leading-none text-white md:text-5xl">{scenario.stateLabel}</h2>
            <div className="demo-lab-wizard-result-pills mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200">🌍 Valle de Uco, Argentina</span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100">✅ SUN Signature OK</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200">⏱ {new Date().toLocaleTimeString(locale)}</span>
            </div>
            <p className="demo-lab-wizard-result-desc mt-3 max-w-2xl text-sm leading-6 text-slate-400">{scenario.headline}</p>
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setStep(2)}
              className="demo-lab-wizard-next-btn mt-5 inline-flex h-11 items-center justify-center rounded-full border border-cyan-300 bg-cyan-300 px-5 text-xs font-black uppercase tracking-wider text-slate-950"
            >
              {locale === "en" ? "See traceability → Traced" : locale === "pt-BR" ? "Ver rastreabilidade → Rastreou" : "Ver trazabilidad → Trazó"}
            </button>
          </div>

          {/* Live scan events sidebar */}
          <div className="demo-lab-wizard-events grid max-h-[68vh] gap-3 overflow-y-auto rounded-3xl border border-white/10 bg-slate-900/65 p-5 shadow-inner">
            <p className="demo-lab-wizard-eyebrow pb-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-300">ÚLTIMOS TAPS</p>
            {liveEvents.length === 0 ? (
              <div className="demo-lab-wizard-event demo-lab-wizard-event--autenticado rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-xs">
                <strong>AUTENTICADO</strong>
                <span>Zurich, CH</span>
                <small>SIM-DEMO · {new Date().toLocaleTimeString(locale)}</small>
              </div>
            ) : liveEvents.slice(0, 5).map((ev, i) => (
              <div
                key={i}
                className={`demo-lab-wizard-event rounded-2xl border bg-white/5 p-3 text-xs demo-lab-wizard-event--${
                  /AUTH_OK|VALID|AUTENTICADO/i.test(ev.result || "") ? "autenticado"
                  : /REPLAY|DUPLICATE|COPIA/i.test(ev.result || "") ? "invalido"
                  : /TAMPER|OPEN|ABIERTO/i.test(ev.result || "") ? "bloqueado"
                  : "autenticado"
                }`}
              >
                <strong>{formatEventResult(ev.result)}</strong>
                <span>{ev.city || destination.city}</span>
                <small>{ev.uidMasked || "UID-n/a"} · {ev.created_at ? new Date(ev.created_at).toLocaleTimeString(locale) : ""}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: TRAZÓ ────────────────────────────────────── */}
      {step === 2 && (
        <div className="demo-lab-wizard-scene demo-lab-wizard-scene--trazo grid min-h-[calc(100vh-12rem)] gap-5 p-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.8fr)]">
          <div className="demo-lab-wizard-map-container min-h-[32rem] overflow-hidden rounded-3xl border border-white/10 bg-slate-900/65">
            <DemoLiveOpsMap
              points={mapPoints}
              liveEvents={liveEvents}
              vertical={vertical}
              destination={destination}
              locale={locale}
              routeKm={routeKm}
              labels={txt.controls}
            />
            <div className="demo-lab-wizard-map-proof-strip">
              <span>{locale === "en" ? "HASH-ONLY PUBLIC PROOF" : locale === "pt-BR" ? "PROVA PUBLICA HASH-ONLY" : "PRUEBA PUBLICA HASH-ONLY"}</span>
              <strong>{locale === "en" ? "Map for people. Hash receipt for auditors. Private data stays in nexID." : locale === "pt-BR" ? "Mapa para pessoas. Recibo hash para auditoria. Dados privados ficam no nexID." : "Mapa para personas. Recibo hash para auditoria. Datos privados quedan en nexID."}</strong>
              <Link href={DEMO_PUBLIC_PROOF_URL}>
                Proof Verify
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <div className="demo-lab-wizard-trazo-side grid max-h-[68vh] gap-3 overflow-y-auto rounded-3xl border border-white/10 bg-slate-900/65 p-5 shadow-inner">
            <p className="demo-lab-wizard-eyebrow text-xs font-black uppercase tracking-[0.16em] text-cyan-300">ÚLTIMOS TAPS EN VIVO</p>
            <div className="demo-lab-wizard-proof-decoder">
              <div className="demo-lab-wizard-proof-decoder__head">
                <span>{locale === "en" ? "EXECUTIVE DECODER" : locale === "pt-BR" ? "DECODER EXECUTIVO" : "DECODIFICADOR EJECUTIVO"}</span>
                <strong>{proofDecoderTitle}</strong>
                <p>{proofDecoderBody}</p>
              </div>
              <div className="demo-lab-wizard-proof-grid">
                {traceProofCards.map((card) => (
                  <article key={card.label} className="demo-lab-wizard-proof-card">
                    <span>{card.label}</span>
                    <strong>{card.title}</strong>
                    <p>{card.body}</p>
                    <small>{card.proof}</small>
                  </article>
                ))}
              </div>
              <Link href={DEMO_PUBLIC_PROOF_URL} className="demo-lab-wizard-proof-link">
                {proofVerifierCta}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            {liveEvents.length === 0 ? (
              <div className="demo-lab-wizard-event demo-lab-wizard-event--autenticado rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-xs">
                <strong>AUTENTICADO</strong>
                <span>{destination.city}, {destination.countryCode}</span>
                <small>SIM-DEMO · en vivo</small>
              </div>
            ) : liveEvents.slice(0, 6).map((ev, i) => (
              <div
                key={i}
                className={`demo-lab-wizard-event rounded-2xl border bg-white/5 p-3 text-xs demo-lab-wizard-event--${
                  /AUTH_OK|VALID|AUTENTICADO/i.test(ev.result || "") ? "autenticado"
                  : /REPLAY|DUPLICATE|COPIA/i.test(ev.result || "") ? "invalido"
                  : /TAMPER|OPEN|ABIERTO/i.test(ev.result || "") ? "bloqueado"
                  : "autenticado"
                }`}
              >
                <strong>{formatEventResult(ev.result)}</strong>
                <span>{ev.city || destination.city}, {ev.country_code || ""}</span>
                <small>{ev.uidMasked || "UID-n/a"} · {ev.created_at ? new Date(ev.created_at).toLocaleTimeString(locale) : "en vivo"}</small>
              </div>
            ))}
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setStep(3)}
              className="demo-lab-wizard-next-btn mt-3 inline-flex h-11 items-center justify-center rounded-full border border-cyan-300 bg-cyan-300 px-5 text-xs font-black uppercase tracking-wider text-slate-950"
            >
              {locale === "en" ? "See business outcome → Won" : locale === "pt-BR" ? "Ver resultado comercial → Ganhou" : "Ver resultado comercial → Ganó"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: GANÓ ─────────────────────────────────────── */}
      {step === 3 && (
        <div className="demo-lab-wizard-scene demo-lab-wizard-scene--gano grid min-h-[calc(100vh-12rem)] content-center gap-5 p-3">
          <div className="demo-lab-wizard-gano-header max-w-4xl">
            <p className="demo-lab-wizard-eyebrow text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{locale === "en" ? "BRAND OUTCOME" : "RESULTADO PARA LA MARCA"}</p>
            <h2 className="mt-2 text-3xl font-black leading-none text-white md:text-5xl">{outcomeHeader}</h2>
            <p className="demo-lab-wizard-gano-lede">{outcomeSubhead}</p>
          </div>
          <div className="demo-lab-wizard-gano-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {executiveOutcomeCards.map((card) => (
              <div key={card.metric} className="demo-lab-wizard-gano-card rounded-3xl border border-white/10 bg-slate-900/65 p-5 shadow-inner">
                <div className="demo-lab-wizard-gano-icon grid h-14 w-14 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-200"><span>{card.metric}</span></div>
                <h3 className="mt-4 text-lg font-black text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{card.body}</p>
                <small>{card.proof}</small>
              </div>
            ))}
          </div>
          <div className="demo-lab-wizard-gano-cta flex flex-wrap gap-3">
            <a href="/?contact=demo#contact-modal" className="demo-lab-wizard-primary-cta inline-flex h-11 items-center justify-center rounded-full border border-cyan-300 bg-cyan-300 px-5 text-xs font-black uppercase tracking-wider text-slate-950">
              {locale === "en" ? "Schedule full demo →" : locale === "pt-BR" ? "Agendar demo completa →" : "Agendar demo completa →"}
            </a>
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setStep(0)}
              className="demo-lab-wizard-secondary-cta inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 text-xs font-black uppercase tracking-wider text-slate-200"
            >
              {locale === "en" ? "Try another vertical" : locale === "pt-BR" ? "Testar outra vertical" : "Probar otra vertical"}
            </button>
          </div>
        </div>
      )}

    </section>
  );
}

function DemoTrustScenarioContextCard({ context }: { context: DemoTrustScenarioContext }) {
  return (
    <article className={`demo-lab-trust-context demo-lab-trust-context--${context.tone}`}>
      <div className="demo-lab-trust-context__copy">
        <span>{context.eyebrow}</span>
        <h3>{context.title}</h3>
        <p>{context.body}</p>
      </div>
      <div className="demo-lab-trust-context__proofs">
        <div>
          <span>{context.labels.publicProof}</span>
          <strong>{context.publicProof}</strong>
        </div>
        <div>
          <span>{context.labels.privateData}</span>
          <strong>{context.privateData}</strong>
        </div>
      </div>
      <div className="demo-lab-trust-context__decision">
        <span>{context.labels.decisionPath}</span>
        <ol className="demo-lab-trust-context__steps">
          {context.decisionPath.map((step, index) => (
            <li className="demo-lab-trust-context__step" key={`${step.label}-${index}`}>
              <b>{index + 1}</b>
              <span>
                <strong>{step.label}</strong>
                <small>{step.body}</small>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="demo-lab-trust-context__outcome">
        <span>{context.labels.businessOutcome}</span>
        <strong>{context.businessOutcome}</strong>
      </div>
      <div className="demo-lab-trust-context__actions">
        <Link href={context.primaryHref} className="demo-lab-trust-context__primary">
          {context.primaryLabel}
          <ChevronRight className="h-4 w-4" />
        </Link>
        <Link href={context.secondaryHref} className="demo-lab-trust-context__secondary">
          {context.secondaryLabel}
        </Link>
      </div>
    </article>
  );
}

function DemoTrustScenarioRail({
  txt,
  locale,
  active,
  onSelect,
  variant = "default",
}: {
  txt: DemoCopy;
  locale: AppLocale;
  active: DemoTrustScenarioKey | null;
  onSelect: (scenario: DemoTrustScenarioKey) => void;
  variant?: "default" | "wizard";
}) {
  const labels = locale === "en"
    ? {
      eyebrow: "Enterprise proof scenarios",
      title: "Open the exact trust layer a buyer is asking about.",
      route: "Share route",
      sensorTitle: "UHF / IoT Sensor Evidence",
      sensorBody: "Pallet, carton and sensor evidence for industrial traceability. Consumer UX stays simple while logistics keeps audit depth.",
      networkTitle: "Authorized Network",
      networkBody: "Supplier, reseller and tenant roles can encode, validate and audit without receiving raw KMS keys or database URLs.",
    }
    : locale === "pt-BR"
    ? {
      eyebrow: "Cenarios enterprise de prova",
      title: "Abra a camada de confianca exata que o comprador pediu.",
      route: "Compartilhar rota",
      sensorTitle: "UHF / IoT Sensor Evidence",
      sensorBody: "Evidencia de pallet, caixa e sensores para rastreabilidade industrial. UX do consumidor fica simples; logistica guarda a auditoria.",
      networkTitle: "Rede autorizada",
      networkBody: "Fornecedor, reseller e tenant codificam, validam e auditam sem receber chaves KMS cruas nem URLs de banco.",
    }
    : {
      eyebrow: "Escenarios enterprise de prueba",
      title: "Abrir la capa de confianza exacta que pregunta el comprador.",
      route: "Compartir ruta",
      sensorTitle: "UHF / IoT Sensor Evidence",
      sensorBody: "Evidencia de pallet, caja y sensores para trazabilidad industrial. La UX del consumidor sigue simple y logistica conserva profundidad de auditoria.",
      networkTitle: "Red autorizada",
      networkBody: "Proveedor, reseller y tenant codifican, validan y auditan sin recibir claves KMS crudas ni URLs de base de datos.",
    };

  const configByTitle = new Map(txt.controls.configs.map((item) => [item.title, item]));
  const items: Array<{ key: DemoTrustScenarioKey; title: string; body: string; icon: typeof ShieldCheck; tone: string }> = [
    { key: "qr-gs1", title: configByTitle.get("QR / GS1 Digital Link")?.title || "QR / GS1 Digital Link", body: configByTitle.get("QR / GS1 Digital Link")?.body || "", icon: QrCode, tone: "identity" },
    { key: "nfc-424", title: configByTitle.get("NTAG 424 DNA")?.title || "NTAG 424 DNA", body: configByTitle.get("NTAG 424 DNA")?.body || "", icon: Fingerprint, tone: "secure" },
    { key: "offline-verifier", title: configByTitle.get("Offline Verifier")?.title || "Offline Verifier", body: configByTitle.get("Offline Verifier")?.body || "", icon: Cpu, tone: "industrial" },
    { key: "polygon-ownership", title: configByTitle.get("Polygon Ownership Demo")?.title || "Polygon Ownership Demo", body: configByTitle.get("Polygon Ownership Demo")?.body || "", icon: BadgeCheck, tone: "ownership" },
    { key: "iota-proof", title: configByTitle.get("IOTA Proof Layer Demo")?.title || "IOTA Proof Layer Demo", body: configByTitle.get("IOTA Proof Layer Demo")?.body || "", icon: Network, tone: "proof" },
    { key: "dual-proof", title: configByTitle.get("Dual Proof DPP")?.title || "Dual Proof DPP", body: configByTitle.get("Dual Proof DPP")?.body || "", icon: PackageCheck, tone: "dpp" },
    { key: "sensor-evidence", title: labels.sensorTitle, body: labels.sensorBody, icon: RadioTower, tone: "industrial" },
    { key: "authorized-network", title: labels.networkTitle, body: labels.networkBody, icon: ShieldCheck, tone: "network" },
  ];

  return (
    <div className={`demo-lab-trust-scenarios ${variant === "wizard" ? "demo-lab-trust-scenarios--wizard" : ""}`}>
      <div className="demo-lab-trust-scenarios__head">
        <span>{labels.eyebrow}</span>
        <strong>{labels.title}</strong>
      </div>
      <div className="demo-lab-trust-scenarios__grid">
        {items.map((item) => {
          const Icon = item.icon;
          const href = `/demo-lab?scenario=${item.key}`;
          return (
            <Link
              key={item.key}
              href={href}
              onClick={(event) => {
                event.preventDefault();
                window.history.replaceState(null, "", href);
                onSelect(item.key);
              }}
              className={`demo-lab-trust-scenario demo-lab-trust-scenario--${item.tone} ${active === item.key ? "is-active" : ""}`}
            >
              <Icon size={18} />
              <span>{item.title}</span>
              <p>{item.body}</p>
              <small>{labels.route}</small>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DemoStudioMiniProduct({ vertical }: { vertical: Vertical }) {
  return (
    <span className={`demo-lab-studio-mini demo-lab-studio-mini--${vertical}`} aria-hidden="true">
      <i />
    </span>
  );
}

function formatDemoTapTime(value?: string, locale: AppLocale = "es-AR") {
  if (!value) return locale === "en" ? "live" : "en vivo";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  const date = new Date(parsed);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return locale === "en" ? `${month}/${day}, ${hour}:${minute}` : `${day}/${month}, ${hour}:${minute}`;
}

function DemoLiveOpsMap({
  points,
  liveEvents,
  vertical,
  destination,
  locale,
  routeKm,
  labels,
}: {
  points: DemoMapPoint[];
  liveEvents: DemoEvent[];
  vertical: Vertical;
  destination: DemoLocation;
  locale: AppLocale;
  routeKm: number;
  labels: Pick<DemoCopy["controls"], "origin" | "currentTap">;
}) {
  const visiblePoints = points.slice(0, 9);
  const recentEvents = liveEvents.slice(0, 4);
  const totalScans = visiblePoints.reduce((acc, point) => acc + (point.scans || 1), 0);
  const risks = visiblePoints.reduce((acc, point) => acc + (point.risk || 0), 0);
  const title = locale === "en" ? "Live taps map" : locale === "pt-BR" ? "Mapa de taps ao vivo" : "Mapa de taps en vivo";
  const feedTitle = locale === "en" ? "Latest taps" : locale === "pt-BR" ? "Ultimos taps" : "Últimos taps";
  const fallbackText = locale === "en" ? "Waiting for live feed; showing route simulation." : locale === "pt-BR" ? "Aguardando feed real; mostrando rota simulada." : "Esperando feed real; mostrando ruta simulada.";

  const originPoint = visiblePoints[0];
  const atlasPoints = toDemoAtlasPoints(visiblePoints, labels);
  const atlasRoutes: VectorMapRoute[] = originPoint
    ? visiblePoints.slice(1).map((p, index) => ({
        id: `studio-route-${demoAtlasPointId(p, index + 1)}`,
        fromLat: originPoint.lat,
        fromLng: originPoint.lng,
        toLat: p.lat,
        toLng: p.lng,
        tone: p.risk ? ("warn" as const) : ("info" as const),
        label: `Ruta ${originPoint.city} → ${p.city}`,
        distanceLabel: routeScopeLabel(locale, routeKm),
        evidence: p.status || formatDemoTapTime(p.lastSeen, locale),
      }))
    : [];

  return (
    <div className="demo-lab-studio-info demo-lab-studio-live-map">
      <div className="demo-lab-studio-panel-head">
        <p>{title}</p>
        <span><i /> {totalScans} taps</span>
      </div>
      <div className={`demo-lab-mini-map demo-lab-mini-map--atlas demo-lab-mini-map--${vertical} flex justify-center items-center relative overflow-hidden`} aria-label={`${title}: ${LOCATIONS.origin.city} a ${destination.city}`}>
        <HeroTrustAtlasSvg points={atlasPoints} routes={atlasRoutes} selectedPointId="tap" />
        <div className="demo-lab-mini-map__legend z-10 pointer-events-none">
          <span>{LOCATIONS.origin.city}</span>
          <strong>{routeScopeLabel(locale, routeKm)}</strong>
          <span>{destination.city}</span>
        </div>
      </div>
      <div className="demo-lab-mini-map__stats">
        <span><strong>{visiblePoints.length}</strong> nodos</span>
        <span><strong>{risks}</strong> riesgo</span>
        <span><strong>{formatDemoTapTime(visiblePoints[1]?.lastSeen, locale)}</strong> último</span>
      </div>
      <div className="demo-lab-live-feed-mini">
        <p>{feedTitle}</p>
        {recentEvents.length ? recentEvents.map((event) => (
          <div key={event.id || `${event.created_at}-${event.uidMasked}`}>
            <span>{formatEventResult(event.result)}</span>
            <strong>{event.city || destination.city}</strong>
            <small>{event.uidMasked || event.sku || "UID n/a"} / {formatDemoTapTime(event.created_at, locale)}</small>
          </div>
        )) : <small>{fallbackText}</small>}
      </div>
    </div>
  );
}

function DemoFirstRunGuide({
  beat,
  simulating,
  onGuided,
  onValid,
  onOpen,
  onMobile,
}: {
  beat: Beat;
  simulating: boolean;
  onGuided: () => void;
  onValid: () => void;
  onOpen: () => void;
  onMobile: () => void;
}) {
  const guideSteps = [
    { beat: 0, kicker: "01", title: "Producto cerrado", body: "La etiqueta NFC esta intacta. Todavia no libera beneficios ni reclamo de dueño." },
    { beat: 1, kicker: "02", title: "Toque válido", body: "El SUN dinámico valida el producto y une origen, ubicación y consumidor." },
    { beat: 2, kicker: "03", title: "Copia bloqueada", body: "Una URL repetida o copiada no habilita club, tienda ni NFT." },
    { beat: 3, kicker: "04", title: "Apertura + reclamo", body: "El sello abierto dispara postventa, certificado y reclamo de dueño." },
  ];

  return (
    <section className="demo-lab-first-run-guide" aria-label="Guia rapida para probar la demo">
      <div className="demo-lab-guide-copy">
        <p>Primera vez aca</p>
        <h3>Proba el flujo como lo haria un cliente en 30 segundos.</h3>
        <span>Arranca cerrado, hace un toque válido, muestra cómo detecta copia/replay y termina con sello abierto, solicitud Polygon y reclamo.</span>
      </div>
      <div className="demo-lab-guide-steps">
        {guideSteps.map((step) => (
          <div key={step.kicker} className={`demo-lab-guide-step ${beat === step.beat ? "demo-lab-guide-step--active" : ""}`}>
            <strong>{step.kicker}</strong>
            <span>{step.title}</span>
            <small>{step.body}</small>
          </div>
        ))}
      </div>
      <div className="demo-lab-guide-actions">
        <button suppressHydrationWarning type="button" onClick={onGuided}>Ver prueba guiada</button>
        <button suppressHydrationWarning type="button" disabled={simulating} onClick={onValid}>Toque válido</button>
        <button suppressHydrationWarning type="button" disabled={simulating} onClick={onOpen}>Abrir sello</button>
        <button suppressHydrationWarning type="button" onClick={onMobile}>Ver celular</button>
      </div>
    </section>
  );
}

function DemoStageExplainer({ beat, scenario, routeKm, locale }: { beat: Beat; scenario: DemoScenario; routeKm: number; locale: AppLocale }) {
  const evidence = routeEvidenceValue(locale, scenario, routeKm);
  const copyByBeat: Record<Beat, { title: string; body: string; backend: string; next: string }> = {
    0: {
      title: "Etiqueta NFC cerrada",
      body: "El producto nacio con UID y origen, pero todavia no hay prueba fresca del consumidor.",
      backend: "Servidor: lote y UID listos, sin reclamo de dueño ni token de valor habilitado.",
      next: "Siguiente: simular toque válido.",
    },
    1: {
      title: "Toque físico fresco",
      body: `El cliente ve el resultado de confianza y la ruta al origen con ${evidence}.`,
      backend: "Servidor: evento válido, anti copia OK, acciones comerciales habilitables según política.",
      next: "Siguiente: abrir celular, preparar tokenización o simular apertura.",
    },
    2: {
      title: "Copia bloqueada",
      body: "La prueba muestra por que copiar una URL no alcanza para reclamar beneficios.",
      backend: "Servidor: riesgo registrado; reclamo, club, tienda sensible y token quedan bloqueados.",
      next: "Siguiente: repetir con un toque válido.",
    },
    3: {
      title: "Sello abierto",
      body: "La etiqueta se parte visualmente y el producto cambia de estado.",
      backend: "Servidor: postventa, certificado, solicitud de token y reclamo requieren política de compra/dueño.",
      next: "Siguiente: abrir solicitud de certificado o reclamar dueño.",
    },
  };
  const item = copyByBeat[beat];

  return (
    <aside className={`demo-lab-stage-explainer demo-lab-stage-explainer--${scenario.tone}`} aria-live="polite">
      <div>
        <p>Que esta pasando</p>
        <h4>{item.title}</h4>
        <span>{item.body}</span>
      </div>
      <div>
        <strong>{item.backend}</strong>
        <small>{item.next}</small>
      </div>
    </aside>
  );
}

function getTrustSignals(beat: Beat) {
  return [
    { label: "Toque físico", value: beat === 0 ? "pendiente" : beat === 2 ? "sospechoso" : "fresco", tone: beat === 0 ? "pending" : beat === 2 ? "blocked" : "ok" },
    { label: "SUN anti copia", value: beat === 2 ? "bloqueado" : beat === 0 ? "en espera" : "ok", tone: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
    { label: "Marca", value: "Bodega Balmec", tone: "ok" },
    { label: "Dueño", value: beat === 3 ? "reclamo listo" : beat === 2 ? "bloqueado" : "con regla", tone: beat === 3 ? "ok" : beat === 2 ? "blocked" : "pending" },
    { label: "Polygon", value: beat === 2 ? "sin NFT" : beat === 0 ? "antes de cadena" : "solicitud lista", tone: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
    { label: "Tienda", value: beat === 2 ? "cerrada" : beat === 0 ? "publica" : "abierta", tone: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
  ] as const;
}

function DemoDifferentiatorStrip({ beat, onGuided }: { beat: Beat; onGuided: () => void }) {
  const chain = ["Producto físico", "Confianza", "Dueño", "Comunidad", "Recompra", "Tienda", "Datos"];
  const activeIndex = beat === 0 ? 0 : beat === 1 ? 2 : beat === 2 ? 1 : 6;

  return (
    <section className="demo-lab-differentiator-strip mt-5">
      <div className="demo-lab-differentiator-copy">
        <p>Diferencial nexID</p>
        <h2>No vendemos solo anti-falsificacion. Convertimos cada producto en canal propio de ingresos.</h2>
        <span>El flujo que tiene que entender cualquier bodega, marca o evento: validar confianza, reclamar dueño, activar comunidad, recompra, tienda y datos.</span>
      </div>
      <div className="demo-lab-differentiator-chain" aria-label="Cadena de valor nexID">
        {chain.map((item, index) => (
          <span key={item} className={index <= activeIndex ? "active" : ""}>{item}</span>
        ))}
      </div>
      <button suppressHydrationWarning type="button" onClick={onGuided}>Presentacion guiada 90s</button>
    </section>
  );
}

function DemoCinematicShowcase({
  beat,
  locale,
  vertical,
  product,
  label,
  onGuided,
}: {
  beat: Beat;
  locale: AppLocale;
  vertical: Vertical;
  product: string;
  label: string;
  onGuided: () => void;
}) {
  const localized = locale === "en"
    ? {
      label: "nexID visual studio",
      title: "A demo that feels like a video: real product, physical proof, risk and business.",
      body: "This block works as a visual pitch inside the platform: any brand can understand trust, ownership, data and revenue in seconds.",
      openPack: "Open visual pack",
      scenes: [
        { beat: 0, tag: "Scene 01", title: "Product is born", body: "Premium package, UID and closed NFC label before the first tap.", stat: "UID + lot", tone: "origin" },
        { beat: 1, tag: "Scene 02", title: "Live tap", body: "Dynamic SUN, distance, origin and actionable data for consumer and brand.", stat: "Verified", tone: "ok" },
        { beat: 2, tag: "Scene 03", title: "Attack blocked", body: "A copied URL does not open benefits, claim, tokenization or store actions.", stat: "No claim", tone: "risk" },
        { beat: 3, tag: "Scene 04", title: "Business loop", body: "Open seal, owner claim, certificate, community and repurchase.", stat: "Open", tone: "open" },
      ],
      proof: {
        sun: beat === 0 ? "waiting" : beat === 2 ? "blocked" : "valid",
        claim: beat === 3 ? "owner ready" : beat === 2 ? "denied" : "gated",
        nft: beat === 2 ? "no mint" : beat === 0 ? "pre-chain" : "request",
        market: beat === 2 ? "closed" : beat === 0 ? "public" : "open",
      },
      proofLabels: { claim: "Claim", market: "Store" },
      passport: "Digital passport",
      tokenTitle: beat === 2 ? "Risk blocked" : beat === 0 ? "Waiting tap" : beat === 3 ? "Claim ready" : "Certificate pending",
      tokenBody: beat === 2 ? "Replay does not unlock benefits." : "Hashed UID, access rules and proof-layer evidence.",
      graph: "demand / risk / claim / repurchase",
    }
    : locale === "pt-BR"
      ? {
        label: "Estudio visual nexID",
        title: "Uma experiencia que parece video: produto real, prova fisica, risco e negocio.",
        body: "Este bloco funciona como apresentacao visual dentro da plataforma: qualquer marca entende confianca, dono, dados e receita em segundos.",
        openPack: "Abrir pacote visual",
        scenes: [
          { beat: 0, tag: "Cena 01", title: "Produto nasce", body: "Embalagem premium, UID e etiqueta NFC fechada antes do primeiro toque.", stat: "UID + lote", tone: "origin" },
          { beat: 1, tag: "Cena 02", title: "Toque vivo", body: "SUN dinamico, distancia, origem e dados acionaveis para consumidor e marca.", stat: "Verificado", tone: "ok" },
          { beat: 2, tag: "Cena 03", title: "Ataque bloqueado", body: "Uma URL copiada nao abre beneficios, dono, tokenizacao nem loja.", stat: "Sem dono", tone: "risk" },
          { beat: 3, tag: "Cena 04", title: "Ciclo comercial", body: "Lacre aberto, dono, certificado, comunidade e recompra.", stat: "Aberto", tone: "open" },
        ],
        proof: {
          sun: beat === 0 ? "em espera" : beat === 2 ? "bloqueado" : "valido",
          claim: beat === 3 ? "dono pronto" : beat === 2 ? "negado" : "com regra",
          nft: beat === 2 ? "sem mint" : beat === 0 ? "pre-cadeia" : "pedido",
          market: beat === 2 ? "fechada" : beat === 0 ? "publica" : "aberta",
        },
        proofLabels: { claim: "Dono", market: "Loja" },
        passport: "Passaporte digital",
        tokenTitle: beat === 2 ? "Risco bloqueado" : beat === 0 ? "Esperando toque" : beat === 3 ? "Claim pronto" : "Certificado pendente",
        tokenBody: beat === 2 ? "Replay nao libera beneficios." : "UID com hash, regras de acesso e evidencia em cadeia.",
        graph: "demanda / risco / dono / recompra",
      }
      : {
        label: "Estudio visual nexID",
        title: "Una prueba que se entiende como video: producto real, prueba fisica, riesgo y negocio.",
        body: "Este bloque funciona como presentacion visual dentro de la plataforma: cualquier marca entiende confianza, dueño, datos e ingresos en segundos.",
        openPack: "Abrir paquete visual",
        scenes: [
          { beat: 0, tag: "Escena 01", title: "Producto nace", body: "Envase de alto valor, UID y etiqueta NFC cerrada antes del primer toque.", stat: "UID + lote", tone: "origin" },
          { beat: 1, tag: "Escena 02", title: "Toque vivo", body: "SUN dinámico, distancia, origen y datos accionables para consumidor y marca.", stat: "Verificado", tone: "ok" },
          { beat: 2, tag: "Escena 03", title: "Ataque bloqueado", body: "Una URL copiada no abre beneficios, reclamo, tokenización ni tienda.", stat: "Sin reclamo", tone: "risk" },
          { beat: 3, tag: "Escena 04", title: "Ciclo comercial", body: "Sello abierto, reclamo de dueño, certificado, comunidad y recompra sujetos a política.", stat: "Abierto", tone: "open" },
        ],
        proof: {
          sun: beat === 0 ? "en espera" : beat === 2 ? "bloqueado" : "válido",
          claim: beat === 3 ? "dueño pendiente" : beat === 2 ? "denegado" : "con regla",
          nft: beat === 2 ? "sin NFT" : beat === 0 ? "antes de cadena" : "pedido listo",
          market: beat === 2 ? "cerrada" : beat === 0 ? "publica" : "abierta",
        },
        proofLabels: { claim: "Reclamo", market: "Tienda" },
        passport: "Pasaporte digital",
        tokenTitle: beat === 2 ? "Riesgo bloqueado" : beat === 0 ? "Esperando toque" : beat === 3 ? "Solicitud lista" : "Solicitud pendiente",
        tokenBody: beat === 2 ? "La copia no libera beneficios." : "UID con hash, reglas de acceso y evidencia opcional en cadena.",
        graph: "demanda / riesgo / reclamo / recompra",
      };
  const scenes: Array<{ beat: Beat; tag: string; title: string; body: string; stat: string; tone: "origin" | "ok" | "risk" | "open" }> = [
    localized.scenes[0],
    localized.scenes[1],
    localized.scenes[2],
    localized.scenes[3],
  ] as Array<{ beat: Beat; tag: string; title: string; body: string; stat: string; tone: "origin" | "ok" | "risk" | "open" }>;
  const active = scenes.find((scene) => scene.beat === beat) ?? scenes[1];
  const progress = `${(beat + 1) * 25}%`;
  const proofItems = [
    { label: "SUN", value: localized.proof.sun, state: beat === 0 ? "pending" : beat === 2 ? "blocked" : "ok" },
    { label: localized.proofLabels.claim, value: localized.proof.claim, state: beat === 3 ? "ok" : beat === 2 ? "blocked" : "pending" },
    { label: "NFT", value: localized.proof.nft, state: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
    { label: localized.proofLabels.market, value: localized.proof.market, state: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
  ] as const;
  const graphBars = [56, beat === 0 ? 32 : 78, beat === 2 ? 26 : 88, beat === 3 ? 96 : 58];

  return (
    <section className={`demo-lab-cinematic-showcase demo-lab-cinematic-showcase--${active.tone} mt-5`} aria-label={localized.label}>
      <div className="demo-lab-cinematic-copy">
        <p>{localized.label}</p>
        <h2>{localized.title}</h2>
        <span>{localized.body}</span>
        <div className="demo-lab-cinematic-actions">
          <button suppressHydrationWarning type="button" onClick={onGuided}>Reproducir recorrido</button>
        </div>
        <div className="demo-lab-cinematic-scenes" aria-label="Escenas de la experiencia">
          {scenes.map((scene) => (
            <article key={scene.tag} className={scene.beat === beat ? "active" : ""}>
              <small>{scene.tag}</small>
              <strong>{scene.title}</strong>
              <em>{scene.stat}</em>
              <span>{scene.body}</span>
            </article>
          ))}
        </div>
      </div>

      <div className="demo-lab-cinematic-canvas" style={{ "--cinematic-progress": progress } as CSSProperties}>
        <span className="demo-lab-cinematic-scanline" aria-hidden="true" />
        <span className="demo-lab-cinematic-orbit demo-lab-cinematic-orbit--one" aria-hidden="true" />
        <span className="demo-lab-cinematic-orbit demo-lab-cinematic-orbit--two" aria-hidden="true" />
        <div className="demo-lab-cinematic-product-shell">
          <DemoCinematicProductRender
            vertical={vertical}
            product={product}
            badge={getRealProductBadge(locale)}
            beat={beat}
            title={active.title}
            stat={active.stat}
          />
        </div>

        <div className="demo-lab-cinematic-headline">
          <small>{active.tag}</small>
          <strong>{active.title}</strong>
          <span>{active.stat}</span>
        </div>

        <div className="demo-lab-cinematic-proof-stack">
          {proofItems.map((item) => (
            <span key={item.label} className={`demo-lab-cinematic-proof demo-lab-cinematic-proof--${item.state}`}>
              <b>{item.label}</b>
              <em>{item.value}</em>
            </span>
          ))}
        </div>

        <div className="demo-lab-cinematic-token-card">
          <p>{localized.passport}</p>
          <strong>{localized.tokenTitle}</strong>
          <span>{localized.tokenBody}</span>
        </div>

        <div className="demo-lab-cinematic-graph" aria-label="Grafico de negocio post toque">
          <div>
            {graphBars.map((height, index) => (
              <span key={index} className={index <= beat ? "active" : ""} style={{ "--bar-height": `${height}%` } as CSSProperties} />
            ))}
          </div>
          <p>{localized.graph}</p>
        </div>
      </div>
    </section>
  );
}

function DemoCinematicProductRender({
  vertical,
  product,
  badge,
  beat,
  title,
  stat,
  variant = "cinematic",
}: {
  vertical: Vertical;
  product: string;
  badge: string;
  beat: Beat;
  title: string;
  stat: string;
  variant?: "cinematic" | "studio";
}) {
  return <DemoPremiumProductScene vertical={vertical} product={product} badge={badge} beat={beat} title={title} stat={stat} variant={variant} />;
}

function getPremiumSceneTone(beat: Beat): DemoScenarioTone {
  if (beat === 2) return "risk";
  if (beat === 3) return "open";
  if (beat === 1) return "ok";
  return "origin";
}

function getPremiumSceneAccent(beat: Beat) {
  if (beat === 2) return "#fb7185";
  if (beat === 3) return "#a78bfa";
  if (beat === 1) return "#34d399";
  return "#22d3ee";
}

function getPremiumSceneMeta(vertical: Vertical, beat: Beat, badge: string, stat?: string) {
  const tone = getPremiumSceneTone(beat);
  const status =
    tone === "risk"
      ? "BLOQUEADO"
      : tone === "open"
        ? "SELLO ABIERTO"
        : tone === "ok"
          ? "AUTENTICADO"
          : "LISTO";
  const phoneAction =
    tone === "risk"
      ? "Repetir tap físico"
      : tone === "open"
        ? "Reclamar dueño"
        : tone === "ok"
          ? "Compra confiable"
          : "Acercar teléfono";
  const sun = tone === "risk" ? "SUN bloquea copia" : tone === "origin" ? "SUN listo" : "SUN válido";
  const lifecycle = tone === "open" ? "Beneficios abiertos" : tone === "risk" ? "Beneficios bloqueados" : "Beneficios listos";

  const proofBody =
    tone === "risk"
      ? "Acciones bloqueadas hasta nuevo tap físico."
      : tone === "open"
        ? "Postventa, dueño y beneficios habilitados."
        : "Producto, UID y canal validados.";

  const base = {
    tone,
    status,
    phoneAction,
    sun,
    lifecycle,
    credential: badge,
    proofBody,
    chips: [badge, sun, lifecycle],
  };

  if (vertical === "wine") {
    return {
      ...base,
      family: "Botella premium real",
      evidence: "Malbec, lote y sello unidos al SUN",
      proofTitle: "Botella + sello + lote",
      tagTitle: "NTAG 424 DNA TT",
      crop: "portrait",
    };
  }

  if (vertical === "sneaker") {
    return {
      ...base,
      family: "Zapatilla coleccionable real",
      evidence: "UID, rareza, dueño y beneficio vinculados",
      proofTitle: "Lengueta NFC + owner",
      tagTitle: "Drop verificado",
      crop: "wide",
    };
  }

  if (vertical === "seeds") {
    return {
      ...base,
      family: "Sobre de semillas certificado",
      evidence: "Lote, origen y canal agricola auditados",
      proofTitle: "QR + NFC UID",
      tagTitle: "Lote trazable",
      crop: "wide",
    };
  }

  if (vertical === "pharma") {
    return {
      ...base,
      family: "Caja pharma serializada",
      evidence: "Lote, prospecto, cadena de frio y recall unidos",
      proofTitle: "Pack + lote + auditoria",
      tagTitle: "QR + NFC",
      crop: "square",
    };
  }

  if (vertical === "bracelet" || vertical === "ticket") {
    return {
      ...base,
      family: "Acceso real de evento",
      evidence: "Pulsera VIP, ingreso y postventa unidos",
      proofTitle: "Pulsera + UID + canal",
      tagTitle: "NTAG215",
      crop: "wide",
    };
  }

  if (vertical === "perfume") {
    return {
      ...base,
      family: "Fragancia premium real",
      evidence: "Tapa, serie y lote validados antes de compra",
      proofTitle: "Frasco + tapa + lote",
      tagTitle: "NTAG 424 DNA",
      crop: "portrait",
    };
  }

  if (vertical === "logistics") {
    return {
      ...base,
      family: "Caja logistica con sensor",
      evidence: "Ruta, temperatura y entrega auditadas",
      proofTitle: "UHF + NFC + IoT",
      tagTitle: "Cadena fria",
      crop: "wide",
    };
  }

  if (vertical === "electronics") {
    return {
      ...base,
      family: "Producto electronico serializado",
      evidence: "Serial, garantia y soporte antifraude vinculados",
      proofTitle: "Serial + garantia",
      tagTitle: "QR + NFC",
      crop: "wide",
    };
  }

  if (vertical === "textile") {
    return {
      ...base,
      family: "Etiqueta textil DPP",
      evidence: "Origen, composicion, cuidado y reventa verificables",
      proofTitle: "DPP + etiqueta",
      tagTitle: "QR + NFC",
      crop: "wide",
    };
  }

  return {
    ...base,
    family: "Set skincare premium",
    evidence: "Envase sellado, lote y recompra verificada",
    proofTitle: "Envase + sello + lote",
    tagTitle: "NTAG 424 DNA",
    crop: "square",
  };
}

function DemoPremiumProductScene({
  vertical,
  product,
  badge,
  beat,
  title,
  stat,
  variant,
  simulating,
}: {
  vertical: Vertical;
  product: string;
  badge: string;
  beat: Beat;
  title?: string;
  stat?: string;
  variant: DemoRealProductVariant;
  simulating?: boolean;
}) {
  const asset = demoLabRealAssets[vertical];
  const meta = getPremiumSceneMeta(vertical, beat, badge, stat);
  const style = { "--scene-accent": getPremiumSceneAccent(beat) } as CSSProperties;

  return (
    <div
      className={`demo-lab-premium-scene demo-lab-premium-scene--${variant} demo-lab-premium-scene--${vertical} demo-lab-premium-scene--${meta.tone} demo-lab-premium-scene--crop-${meta.crop}`}
      role="img"
      aria-label={`${badge}: ${product}. ${title || meta.status}.`}
      style={style}
    >
      <span className="demo-lab-premium-scene__aura" aria-hidden="true" />
      <span className="demo-lab-premium-scene__floor" aria-hidden="true" />

      <figure className="demo-lab-premium-scene__media" data-credit={asset?.credit} aria-hidden="true">
        {asset ? (
          <>
            <img className="nexid-premium-image--dark" src={asset.imageUrl} alt={product} loading="eager" decoding="async" />
            <img className="nexid-premium-image--light" src={asset.imageLightUrl} alt={product} loading="eager" decoding="async" />
          </>
        ) : (
          <div className="w-full h-[225px] relative overflow-hidden rounded-2xl bg-slate-950/20 border border-white/5 shadow-inner">
            <ThreeDProduct
              active={beat === 1 || beat === 3}
              tapping={!!simulating}
              industry={verticalTo3DIndustry(vertical)}
              chipModel={vertical === "wine" ? "tamper" : "dna"}
            />
          </div>
        )}
        <figcaption>
          <span>{meta.family}</span>
          <strong>{product}</strong>
          <small>{meta.evidence}</small>
        </figcaption>
      </figure>

      <div className="demo-lab-premium-scene__tag-card" aria-hidden="true">
        <span>nexID</span>
        <strong>{meta.tagTitle}</strong>
        <em>{meta.tone === "risk" ? "riesgo" : meta.tone === "open" ? "abierto" : "sellado"}</em>
      </div>

      <div className="demo-lab-premium-scene__phone" aria-hidden="true">
        <i />
        <span>Salida celular</span>
        <strong>{meta.status}</strong>
        <small>UID 04A7****1090</small>
        <em>{meta.phoneAction}</em>
      </div>

      <div className="demo-lab-premium-scene__proof" aria-hidden="true">
        <span>Producto real</span>
        <strong>{meta.proofTitle}</strong>
        <small>{meta.proofBody}</small>
      </div>

      <div className="demo-lab-premium-scene__ribbon" aria-hidden="true">
        {meta.chips.map((chip) => (
          <span key={chip}>{chip}</span>
        ))}
      </div>
    </div>
  );
}

function DemoExperienceLayer({
  beat,
  product,
  scenario,
  destination,
  routeKm,
  locale,
  onOpen,
}: {
  beat: Beat;
  product: string;
  scenario: DemoScenario;
  destination: DemoLocation;
  routeKm: number;
  locale: AppLocale;
  onOpen: (view: DemoModalView) => void;
}) {
  return (
    <section className="demo-lab-experience-layer" aria-label="Capa de experiencia y negocio">
      <DemoTrustScore beat={beat} />
      <DemoProofCard beat={beat} product={product} scenario={scenario} destination={destination} routeKm={routeKm} locale={locale} />
      <DemoPhoneMirror beat={beat} product={product} scenario={scenario} destination={destination} onOpen={onOpen} />
      <DemoUnlockLadder beat={beat} />
    </section>
  );
}

function DemoTrustScore({ beat }: { beat: Beat }) {
  const signals = getTrustSignals(beat);
  const passed = signals.filter((item) => item.tone === "ok").length;
  const score = Math.round((passed / signals.length) * 100);
  const label = beat === 2 ? "Riesgo detectado" : beat === 0 ? "Listo para validar" : beat === 3 ? "Lifecycle abierto" : "Confianza alta";

  return (
    <article className={`demo-lab-trust-score demo-lab-trust-score--beat-${beat}`}>
      <div className="demo-lab-trust-meter" style={{ "--trust-score": `${score}%` } as CSSProperties}>
        <strong>{score}</strong>
        <span>trust score</span>
      </div>
      <div>
        <p>Motor de confianza</p>
        <h4>{label}</h4>
        <div className="demo-lab-trust-signals">
          {signals.map((item) => (
            <span key={item.label} className={`demo-lab-trust-signal demo-lab-trust-signal--${item.tone}`}>
              <b>{item.label}</b>
              <em>{item.value}</em>
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function DemoProofCard({
  beat,
  product,
  scenario,
  destination,
  routeKm,
  locale,
}: {
  beat: Beat;
  product: string;
  scenario: DemoScenario;
  destination: DemoLocation;
  routeKm: number;
  locale: AppLocale;
}) {
  const txStatus = beat === 2 ? "bloqueado" : beat === 0 ? "antes de cadena" : "tx/solicitud lista";
  const owner = beat === 3 ? "dueño listo" : beat === 2 ? "reclamo bloqueado" : "ingreso requerido";

  return (
    <article className={`demo-lab-proof-card demo-lab-proof-card--${scenario.tone}`}>
      <div className="demo-lab-proof-card-header">
        <span>{scenario.stateLabel}</span>
        <strong>Tarjeta de prueba</strong>
      </div>
      <h4>{product}</h4>
      <div className="demo-lab-proof-grid">
        <InfoCell label="Origen" value={LOCATIONS.origin.city} />
        <InfoCell label="Toque" value={destination.city} />
        <InfoCell label={routeEvidenceLabel(locale)} value={routeEvidenceValue(locale, scenario, routeKm)} />
        <InfoCell label="Token" value={txStatus} />
        <InfoCell label="Dueño" value={owner} />
        <InfoCell label="UID" value="04B7****E2B5" />
      </div>
    </article>
  );
}

function DemoPhoneMirror({
  beat,
  product,
  scenario,
  destination,
  onOpen,
}: {
  beat: Beat;
  product: string;
  scenario: DemoScenario;
  destination: DemoLocation;
  onOpen: (view: DemoModalView) => void;
}) {
  const cta = beat === 2 ? "Repetir toque fisico" : beat === 3 ? "Ver salida celular" : beat === 0 ? "Acercar telefono" : "Unirme al club";

  return (
    <article className={`demo-lab-phone-mirror demo-lab-phone-mirror--${scenario.tone}`}>
      <div className="demo-lab-phone-shell">
        <div className="demo-lab-phone-topbar">
          <strong>nexID</strong>
          <em>Salida celular</em>
        </div>
        <div className="demo-lab-phone-status">{scenario.stateLabel}</div>
        <h4>{product}</h4>
        <p>{scenario.headline}</p>
        <div className="demo-lab-phone-route">
          <span>{LOCATIONS.origin.city}</span>
          <i />
          <span>{destination.city}</span>
        </div>
        <button suppressHydrationWarning type="button" onClick={() => onOpen("mobile")}>{cta}</button>
      </div>
    </article>
  );
}

function DemoUnlockLadder({ beat }: { beat: Beat }) {
  const rows = [
    { label: "Info publica", body: "Origen, lote, historia y contenido de marca.", unlocked: true },
    { label: "Club + beneficios", body: "Beneficios y recompra solo con toque válido.", unlocked: beat === 1 || beat === 3 },
    { label: "Garantía + reclamo", body: "Dueño, garantía y postventa con ingreso.", unlocked: beat === 3 },
    { label: "Solicitud / certificado", body: "Solicitud Polygon y token de valor si la política lo permite.", unlocked: beat === 1 || beat === 3 },
    { label: "Tienda", body: "Reventa, comunidad y ofertas contextuales.", unlocked: beat === 1 || beat === 3 },
    { label: "Registro de datos", body: "Eventos, riesgo, zona, demanda y atribucion.", unlocked: beat !== 0 },
  ];

  return (
    <article className="demo-lab-unlock-ladder">
      <p>Escalera comercial</p>
      <h4>Qué se habilita después del toque</h4>
      <div>
        {rows.map((row) => (
          <span key={row.label} className={row.unlocked && beat !== 2 ? "unlocked" : beat === 2 && row.label !== "Info publica" ? "blocked" : ""}>
            <b>{row.label}</b>
            <em>{beat === 2 && row.label !== "Info publica" ? "bloqueado por copia" : row.body}</em>
          </span>
        ))}
      </div>
    </article>
  );
}

function DemoLabProductThreeStage({
  vertical,
  product,
  beat,
  badge,
  simulating,
}: {
  vertical: Vertical;
  product: string;
  beat: Beat;
  badge: string;
  simulating: boolean;
}) {
  return <DemoPremiumProductScene vertical={vertical} product={product} badge={badge} beat={beat} variant="stage" simulating={simulating} />;
}

function isEventAccessVertical(vertical: Vertical) {
  return vertical === "bracelet" || vertical === "ticket";
}

function isPremiumCosmeticVertical(vertical: Vertical) {
  return vertical === "creamJar" || vertical === "perfume" || vertical === "creamTube";
}

function DemoWineProduct({
  product,
  badge,
  beat,
  stat,
  variant,
}: {
  product: string;
  badge: string;
  beat: Beat;
  stat?: string;
  variant: DemoRealProductVariant;
}) {
  const asset = demoLabRealAssets.wine;
  const blocked = beat === 2;
  const opened = beat === 3;
  const status = blocked ? "COPIA BLOQUEADA" : opened ? "SELLO ABIERTO" : beat === 0 ? "LISTO PARA TOQUE" : "AUTENTICADO";
  const action = blocked ? "Replay bloqueado" : opened ? "Reclamo + token pendiente" : "Compra confiable";
  const proof = stat || (blocked ? "SUN bloquea copia y beneficios" : "Origen, lote, sello y canal auditados");

  return (
    <div
      className={`demo-lab-wine-product demo-lab-wine-product--${variant} demo-lab-wine-product--beat-${beat}`}
      role="img"
      aria-label={`${badge}: ${product}. ${status}.`}
    >
      <span className="demo-lab-wine-product__aura" aria-hidden="true" />
      <span className="demo-lab-wine-product__floor" aria-hidden="true" />
      <figure className="demo-lab-wine-product__packshot" data-credit={asset.credit} aria-hidden="true">
        <img className="nexid-premium-image--dark" src={asset.imageUrl} alt="" loading="eager" decoding="async" />
        <img className="nexid-premium-image--light" src={asset.imageLightUrl} alt="" loading="eager" decoding="async" />
        <figcaption>
          <span>Producto real</span>
          <strong>{product}</strong>
          <small>Valle de Uco - 2022 - NTAG 424 DNA TT</small>
        </figcaption>
      </figure>
      <div className="demo-lab-wine-product__seal" aria-hidden="true">
        <span>nexID</span>
        <strong>NTAG 424 DNA TT</strong>
        <em>{opened ? "abierto" : blocked ? "riesgo" : "sellado"}</em>
      </div>
      <div className="demo-lab-wine-product__chip" aria-hidden="true">NFC</div>
      <div className="demo-lab-wine-product__phone" aria-hidden="true">
        <i />
        <span>Salida celular</span>
        <strong>{status}</strong>
        <small>UID 04A7****1090</small>
        <em>{action}</em>
      </div>
      <div className="demo-lab-wine-product__proof" aria-hidden="true">
        <span>{badge}</span>
        <strong>Botella + sello + lote</strong>
        <small>{proof}</small>
      </div>
    </div>
  );
}

function DemoPremiumCosmeticProduct({
  vertical,
  product,
  badge,
  beat,
  variant,
}: {
  vertical: Vertical;
  product: string;
  badge: string;
  beat: Beat;
  variant: DemoRealProductVariant;
}) {
  const asset = demoLabRealAssets[vertical];
  const blocked = beat === 2;
  const opened = beat === 3;
  const isPerfume = vertical === "perfume";
  const status = blocked ? "RIESGO BLOQUEADO" : opened ? "SELLO ABIERTO" : beat === 0 ? "SELLADO" : "AUTENTICADO";
  const action = blocked ? "Sin reclamo" : opened ? "Garantía lista" : "Compra confiable";
  const referenceLabel = isPerfume ? "Perfume premium real" : vertical === "creamJar" ? "Set skincare real" : "Dermo premium real";
  const proofLabel = isPerfume ? "Tapa NFC + lote" : "Envase sellado + lote";

  return (
    <div
      className={`demo-lab-cosmetic-product demo-lab-cosmetic-product--${variant} demo-lab-cosmetic-product--${vertical} demo-lab-cosmetic-product--beat-${beat}`}
      role="img"
      aria-label={`${badge}: ${product}. ${status}.`}
    >
      <figure className="demo-lab-cosmetic-photo" data-credit={asset.credit} aria-hidden="true">
        <img className="nexid-premium-image--dark" src={asset.imageUrl} alt="" loading="eager" decoding="async" />
        <img className="nexid-premium-image--light" src={asset.imageLightUrl} alt="" loading="eager" decoding="async" />
        <figcaption>
          <span>{referenceLabel}</span>
          <strong>{product}</strong>
          <small>{proofLabel}</small>
        </figcaption>
      </figure>
      <div className="demo-lab-cosmetic-product-chip" aria-hidden="true">NFC</div>
      <div className="demo-lab-cosmetic-phone" aria-hidden="true">
        <i />
        <span>Salida celular</span>
        <strong>{status}</strong>
        <small>UID 04A7****1090</small>
        <em>{action}</em>
      </div>
      <div className="demo-lab-cosmetic-proof-card" aria-hidden="true">
        <span>NTAG 424 DNA</span>
        <strong>{isPerfume ? "Tapa + serie + lote" : "Envase + sello + lote"}</strong>
        <small>{blocked ? "Replay no abre garantía" : "SUN dinámico validado"}</small>
      </div>
    </div>
  );
}

function DemoEventAccessProduct({
  vertical,
  product,
  badge,
  beat,
  variant,
}: {
  vertical: Vertical;
  product: string;
  badge: string;
  beat: Beat;
  variant: DemoRealProductVariant;
}) {
  const asset = demoLabRealAssets[vertical];
  const blocked = beat === 2;
  const opened = beat === 3;
  const status = blocked ? "COPIA BLOQUEADA" : opened ? "SELLO ABIERTO" : beat === 0 ? "LISTO PARA TOQUE" : "ACCESO VERIFICADO";
  const primary = vertical === "ticket" ? "Entrada VIP" : "Pulsera VIP";
  const action = blocked ? "Sin beneficios" : opened ? "Reclamo listo" : "Autentico";

  return (
    <div
      className={`demo-lab-event-product demo-lab-event-product--${variant} demo-lab-event-product--${vertical} demo-lab-event-product--beat-${beat}`}
      role="img"
      aria-label={`${badge}: ${product}. ${status}.`}
    >
      <figure className="demo-lab-event-photo" data-credit={asset.credit}>
        <img className="nexid-premium-image--dark" src={asset.imageUrl} alt="" loading="eager" decoding="async" />
        <img className="nexid-premium-image--light" src={asset.imageLightUrl} alt="" loading="eager" decoding="async" />
        <figcaption>
          <span>{badge}</span>
          <strong>{product}</strong>
        </figcaption>
      </figure>
      <div className="demo-lab-event-wristband" aria-hidden="true">
        <span className="demo-lab-event-wristband__band" />
        <span className="demo-lab-event-wristband__tag">N</span>
        <span className="demo-lab-event-wristband__chip" />
        <span className="demo-lab-event-wristband__lock">{opened ? "OPEN" : blocked ? "RISK" : "SUN"}</span>
      </div>
      <div className="demo-lab-event-phone" aria-hidden="true">
        <i />
        <span>{primary}</span>
        <strong>{status}</strong>
        <small>UID 04A7****1090</small>
        <em>{action}</em>
      </div>
      <div className="demo-lab-event-proof-card" aria-hidden="true">
        <span>NTAG215</span>
        <strong>NFC + pasaporte</strong>
        <small>{blocked ? "Replay no abre reclamo" : "Toque físico validado"}</small>
      </div>
    </div>
  );
}

function DemoSneakerProduct({
  product,
  badge,
  beat,
  stat,
  variant,
}: {
  product: string;
  badge: string;
  beat: Beat;
  stat?: string;
  variant: DemoRealProductVariant;
}) {
  const asset = demoLabRealAssets.sneaker;
  const blocked = beat === 2;
  const opened = beat === 3;
  const status = blocked ? "COPIA BLOQUEADA" : opened ? "OWNER LISTO" : beat === 0 ? "LISTO PARA TOQUE" : "AUTENTICADO";
  const action = blocked ? "Repetir tap físico" : opened ? "Claim + token pendiente" : "SUN dinámico validado";
  const proof = stat || (blocked ? "Replay no habilita beneficios" : "Lengueta NFC + UID + lote verificable");

  return (
    <div
      className={`demo-lab-sneaker-product demo-lab-sneaker-product--${variant} demo-lab-sneaker-product--beat-${beat}`}
      role="img"
      aria-label={`${badge}: ${product}. ${status}.`}
    >
      <span className="demo-lab-sneaker-product__aura" aria-hidden="true" />
      <span className="demo-lab-sneaker-product__floor" aria-hidden="true" />
      <figure className="demo-lab-sneaker-product__photo" data-credit={asset.credit}>
        <img className="nexid-premium-image--dark" src={asset.imageUrl} alt="" loading="eager" decoding="async" />
        <img className="nexid-premium-image--light" src={asset.imageLightUrl} alt="" loading="eager" decoding="async" />
        <figcaption>
          <span>{badge}</span>
          <strong>{product}</strong>
        </figcaption>
      </figure>
      <div className="demo-lab-sneaker-product__tag" aria-hidden="true">
        <span>nexID</span>
        <strong>{product}</strong>
        <em>NFC</em>
      </div>
      <div className="demo-lab-sneaker-product__chip" aria-hidden="true">NFC</div>
      <div className="demo-lab-sneaker-product__phone" aria-hidden="true">
        <i />
        <span>Salida celular</span>
        <strong>{status}</strong>
        <small>UID 04A7****1090</small>
        <em>{action}</em>
      </div>
      <div className="demo-lab-sneaker-product__proof" aria-hidden="true">
        <span>NTAG 424 DNA</span>
        <strong>Lengueta + UID + ownership</strong>
        <small>{proof}</small>
      </div>
    </div>
  );
}

function DemoRealProductShot({
  vertical,
  product,
  badge,
  variant,
}: {
  vertical: Vertical;
  product: string;
  badge: string;
  variant: DemoRealProductVariant;
}) {
  const asset = demoLabRealAssets[vertical];
  return (
    <figure
      className={`demo-lab-real-product-shot demo-lab-real-product-shot--${variant} demo-lab-real-product-shot--${vertical}`}
      data-credit={asset.credit}
      role="img"
      aria-label={`${badge}: ${product}`}
    >
      <img className="nexid-premium-image--dark" src={asset.imageUrl} alt="" loading="eager" decoding="async" />
      <img className="nexid-premium-image--light" src={asset.imageLightUrl} alt="" loading="eager" decoding="async" />
      <figcaption>
        <span>{badge}</span>
        <strong>{product}</strong>
      </figcaption>
    </figure>
  );
}

function ProductIllustration({ vertical, product, label, beat }: { vertical: Vertical; product: string; label: string; beat: Beat }) {
  const uid = `demo-product-${vertical}`;
  const statusLabel = beat === 2 ? "BLOQ" : beat === 3 ? "ABIERTO" : "NFC";
  const productLine = product.length > 24 ? `${product.slice(0, 22)}...` : product;
  const accent = beat === 2 ? "#fb7185" : beat === 3 ? "#a78bfa" : "#22d3ee";
  const sceneState = beat === 0 ? "origin" : beat === 1 ? "auth" : beat === 2 ? "blocked" : "open";
  const sealTitle = beat === 2 ? "COPIA" : beat === 3 ? "ABIERTO" : "CERRADO";
  const sealBody = beat === 0 ? "UID SELLADO" : beat === 1 ? "SUN OK" : beat === 2 ? "SIN RECLAMO" : "RECLAMO LISTO";
  const stateTitle = beat === 2 ? "Riesgo bloqueado" : beat === 3 ? "Etiqueta NFC abierta" : "Etiqueta NFC cerrada";
  const stateBody = beat === 0 ? "lista para primer toque" : beat === 1 ? "toque validado" : beat === 2 ? "copia detenida" : "beneficios habilitados";

  return (
    <div className={`demo-lab-product-scene demo-lab-product-scene--${sceneState}`} role="img" aria-label={`${label}: ${product}. ${stateTitle}.`}>
      <svg className="demo-lab-product-illustration" viewBox="0 0 360 420" aria-hidden="true" focusable="false">
      <defs>
        <filter id={`${uid}-shadow`} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#020617" floodOpacity="0.42" />
        </filter>
        <linearGradient id={`${uid}-glass`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.86" />
          <stop offset="42%" stopColor="#67e8f9" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.78" />
        </linearGradient>
        <linearGradient id={`${uid}-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="44%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id={`${uid}-holo`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="48%" stopColor="#a78bfa" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id={`${uid}-stage-glow`} cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-floor`} cx="50%" cy="50%" r="58%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
          <stop offset="62%" stopColor="#0f172a" stopOpacity="0.36" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-rim`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
          <stop offset="26%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="72%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={`${uid}-label-paper`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="54%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#c7d2fe" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor={accent} floodOpacity="0.28" />
        </filter>
      </defs>

      <ellipse cx="180" cy="368" rx="132" ry="30" fill={`url(#${uid}-floor)`} />
      <ellipse cx="180" cy="368" rx="82" ry="13" fill="#e0f2fe" opacity="0.07" />
      <path d="M58 342 C110 320 249 320 303 344 L266 373 C219 388 134 388 93 373 Z" fill="#0f172a" opacity="0.32" />
      <path d="M78 348 C128 333 229 332 282 348" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.16" />
      <ellipse cx="180" cy="218" rx="156" ry="144" fill={`url(#${uid}-stage-glow)`} />

      {vertical === "wine" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M158 38h44l7 58c2 15 13 24 25 34 13 11 19 28 19 49v141c0 27-20 48-49 48h-48c-29 0-49-21-49-48V179c0-21 6-38 19-49 12-10 23-19 25-34l7-58Z" fill="#7f1d1d" />
          <path d="M158 38h44l5 48h-54l5-48Z" fill="#f59e0b" />
          <path d="M141 119c14-14 27-21 39-21s25 7 39 21c-10 12-68 12-78 0Z" fill="#14532d" opacity="0.86" />
          <path d="M210 113c22 16 34 36 34 68v132c0 24-16 42-40 42h-16c18-21 22-66 22-133V113Z" fill="#020617" opacity="0.26" />
          <path d="M132 139c11-17 26-24 48-24 22 0 38 8 51 25" fill="none" stroke="#fef3c7" strokeWidth="5" strokeLinecap="round" opacity="0.16" />
          <path d="M124 157c16-19 33-29 56-29 25 0 44 10 60 29v43H124v-43Z" fill={`url(#${uid}-rim)`} opacity="0.35" />
          <rect x="127" y="210" width="106" height="82" rx="12" fill="#0f172a" opacity="0.2" />
          <rect x="130" y="212" width="100" height="78" rx="10" fill={`url(#${uid}-label-paper)`} />
          <rect x="142" y="225" width="76" height="12" rx="6" fill={`url(#${uid}-holo)`} opacity="0.72" />
          <text x="180" y="252" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="900" letterSpacing="2">GRAN RESERVA</text>
          <text x="180" y="270" textAnchor="middle" fill="#0f172a" fontSize="15" fontWeight="900" letterSpacing="2">MALBEC</text>
          <path d="M147 278h66" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" opacity="0.28" />
          <path d="M122 154c18-18 36-27 58-27 24 0 42 9 58 27v44H122v-44Z" fill="#450a0a" opacity="0.38" />
          <path d="M134 60c11-9 29-11 38-2 10 10 2 25-12 22-14-3-21-9-26-20Z" fill="#fde68a" opacity="0.52" />
          <path d="M149 54c-12 46-18 111-16 203" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity="0.08" />
        </g>
      ) : null}

      {vertical === "seeds" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M105 76h150c13 0 24 11 24 24v230c0 13-11 24-24 24H105c-13 0-24-11-24-24V100c0-13 11-24 24-24Z" fill="#84cc16" />
          <path d="M105 76h150c13 0 24 11 24 24v230c0 13-11 24-24 24H105c-13 0-24-11-24-24V100c0-13 11-24 24-24Z" fill={`url(#${uid}-holo)`} opacity="0.32" />
          <path d="M247 82c18 4 32 16 32 34v214c0 13-11 24-24 24h-26c14-26 18-79 18-161V82Z" fill="#14532d" opacity="0.2" />
          <path d="M101 88h158" stroke="#ecfccb" strokeWidth="10" strokeLinecap="round" opacity="0.42" />
          <path d="M96 177c46-18 115-18 168 2" fill="none" stroke="#fef08a" strokeWidth="4" strokeLinecap="round" opacity="0.16" />
          <rect x="101" y="105" width="158" height="52" rx="12" fill="#f0fdf4" />
          <text x="180" y="138" textAnchor="middle" fill="#166534" fontSize="13" fontWeight="900" letterSpacing="2">SEMILLAS</text>
          <rect x="119" y="169" width="122" height="34" rx="10" fill="#14532d" opacity="0.2" />
          <text x="180" y="191" textAnchor="middle" fill="#f0fdf4" fontSize="10" fontWeight="900" letterSpacing="1.6">TRAZA + ORIGEN</text>
          <path d="M109 289h142" stroke="#166534" strokeWidth="2" strokeDasharray="5 7" opacity="0.42" />
          <text x="180" y="317" textAnchor="middle" fill="#14532d" fontSize="13" fontWeight="900" letterSpacing="1.5">LOTE A12</text>
          {[132, 163, 197, 225].map((cx, index) => (
            <path key={cx} d={`M${cx} ${235 + (index % 2) * 14}c18-18 35-8 30 11-20 7-32 1-30-11Z`} fill="#facc15" opacity="0.82" />
          ))}
          {[126, 154, 188, 217].map((cx, index) => (
            <path key={`leaf-${cx}`} d={`M${cx} ${250 + (index % 2) * 9}c14-18 33-14 37 6-15 11-32 9-37-6Z`} fill="#fef3c7" opacity="0.34" />
          ))}
          <path d="M99 91h162" stroke="#ecfccb" strokeWidth="7" strokeLinecap="round" opacity="0.5" />
        </g>
      ) : null}

      {vertical === "creamJar" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <ellipse cx="180" cy="116" rx="73" ry="18" fill="#f8fafc" opacity="0.18" />
          <rect x="107" y="115" width="146" height="48" rx="16" fill={`url(#${uid}-metal)`} />
          <rect x="117" y="124" width="126" height="11" rx="6" fill="#f8fafc" opacity="0.38" />
          <path d="M89 164h182v111c0 47-34 78-91 78s-91-31-91-78V164Z" fill="#fce7f3" />
          <path d="M225 164h46v111c0 40-25 68-70 76 23-26 24-70 24-187Z" fill="#831843" opacity="0.12" />
          <path d="M89 164h182v64H89v-64Z" fill="#fff7ed" opacity="0.86" />
          <rect x="112" y="196" width="136" height="66" rx="14" fill="#fff1f2" />
          <rect x="125" y="207" width="110" height="10" rx="5" fill={`url(#${uid}-holo)`} opacity="0.48" />
          <text x="180" y="237" textAnchor="middle" fill="#be185d" fontSize="14" fontWeight="900" letterSpacing="4">CREMA</text>
          <text x="180" y="254" textAnchor="middle" fill="#9d174d" fontSize="8" fontWeight="900" letterSpacing="1.4">GARANTIA NFC</text>
          <path d="M91 275c27 25 62 38 89 38s62-13 89-38v16c0 38-36 62-89 62s-89-24-89-62v-16Z" fill="#fbcfe8" opacity="0.85" />
          <circle cx="239" cy="204" r="14" fill={`url(#${uid}-holo)`} opacity="0.74" />
          <path d="M116 178c9 45 8 104-5 138" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.22" />
        </g>
      ) : null}

      {vertical === "perfume" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <rect x="153" y="49" width="54" height="45" rx="8" fill={`url(#${uid}-metal)`} />
          <rect x="140" y="29" width="80" height="28" rx="8" fill="#f8fafc" />
          <rect x="151" y="34" width="58" height="7" rx="4" fill="#cbd5e1" opacity="0.7" />
          <path d="M110 116c0-22 18-40 40-40h60c22 0 40 18 40 40v194c0 24-19 43-43 43h-54c-24 0-43-19-43-43V116Z" fill={`url(#${uid}-glass)`} />
          <path d="M211 82c24 8 39 26 39 53v174c0 24-19 44-43 44h-18c19-26 24-77 22-271Z" fill="#020617" opacity="0.16" />
          <path d="M126 139c0-20 17-37 37-37h34c21 0 38 17 38 37v160c0 15-12 27-27 27h-56c-15 0-26-12-26-27V139Z" fill="#312e81" opacity="0.32" />
          <rect x="131" y="193" width="98" height="76" rx="12" fill="transparent" stroke="#e0e7ff" strokeWidth="2" opacity="0.45" />
          <rect x="144" y="206" width="72" height="9" rx="5" fill={`url(#${uid}-holo)`} opacity="0.56" />
          <text x="180" y="238" textAnchor="middle" fill="#f8fafc" fontSize="14" fontWeight="900" letterSpacing="2">PERFUME</text>
          <text x="180" y="255" textAnchor="middle" fill="#e0e7ff" fontSize="8" fontWeight="900" letterSpacing="1.2">ORIGEN VALIDADO</text>
          <path d="M122 126c20-22 80-26 110 4" stroke="#f8fafc" strokeWidth="8" strokeLinecap="round" opacity="0.16" />
          <path d="M136 126c-12 61-9 135 8 194" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.18" />
          <path d="M231 138c-8 58-7 109 5 153" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.08" />
        </g>
      ) : null}

      {vertical === "creamTube" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M127 79c0-26 21-47 53-47s53 21 53 47v230c0 27-18 46-53 46s-53-19-53-46V79Z" fill="#67e8f9" />
          <path d="M127 79c0-26 21-47 53-47s53 21 53 47v230c0 27-18 46-53 46s-53-19-53-46V79Z" fill={`url(#${uid}-holo)`} opacity="0.34" />
          <path d="M203 39c20 8 30 23 30 40v230c0 27-18 46-53 46h-8c20-28 31-98 31-316Z" fill="#0e7490" opacity="0.22" />
          <path d="M140 90h80M139 106h82" stroke="#ecfeff" strokeWidth="3" strokeLinecap="round" opacity="0.28" />
          <rect x="143" y="176" width="74" height="94" rx="10" fill="#cffafe" opacity="0.82" />
          <text x="183" y="229" textAnchor="middle" fill="#155e75" fontSize="13" fontWeight="900" letterSpacing="3" transform="rotate(90 183 229)">CREMA</text>
          <path d="M154 188h52" stroke="#155e75" strokeWidth="2" strokeLinecap="round" opacity="0.25" />
          <path d="M154 260h52" stroke="#155e75" strokeWidth="2" strokeLinecap="round" opacity="0.25" />
          <rect x="130" y="333" width="100" height="45" rx="12" fill="#0f172a" />
          <rect x="137" y="343" width="86" height="9" rx="5" fill="#475569" />
          <path d="M144 66c20-17 52-17 72 0" stroke="#ecfeff" strokeWidth="8" strokeLinecap="round" opacity="0.34" />
          <path d="M145 78c-8 72-8 154 0 234" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity="0.2" />
        </g>
      ) : null}

      {vertical === "bracelet" ? (
        <g filter={`url(#${uid}-shadow)`} transform="rotate(-8 180 210)">
          <path d="M51 198c46-40 212-60 258-10 20 22 4 58-28 62-66 9-151 26-220-4-27-12-31-30-10-48Z" fill="#14b8a6" />
          <path d="M69 197c68 18 155 4 230 0 13 17 0 42-24 46-60 10-148 24-211-5-24-11-22-29 5-41Z" fill={`url(#${uid}-holo)`} opacity="0.62" />
          <path d="M62 216c70 22 155 11 229 4" fill="none" stroke="#ecfeff" strokeWidth="6" strokeLinecap="round" opacity="0.18" />
          <path d="M66 198c34-26 108-42 168-34" fill="none" stroke="#ccfbf1" strokeWidth="5" strokeLinecap="round" opacity="0.2" />
          <rect x="149" y="189" width="70" height="38" rx="9" fill="#0f172a" />
          <text x="184" y="214" textAnchor="middle" fill="#ecfeff" fontSize="16" fontWeight="900" letterSpacing="2">VIP</text>
          <rect x="155" y="222" width="58" height="7" rx="4" fill="#22d3ee" opacity="0.42" />
          {[83, 111, 138].map((cx) => <circle key={cx} cx={cx} cy="218" r="6" fill="#0f172a" opacity="0.72" />)}
          {[84, 111, 138].map((cx) => <circle key={`rim-${cx}`} cx={cx} cy="218" r="9" fill="none" stroke="#ccfbf1" strokeWidth="2" opacity="0.18" />)}
          <circle cx="276" cy="205" r="20" fill="#c4b5fd" opacity="0.82" />
          <circle cx="276" cy="205" r="11" fill="#f8fafc" opacity="0.4" />
          <rect x="262" y="225" width="38" height="13" rx="6" fill="#071827" opacity="0.32" />
        </g>
      ) : null}

      {vertical === "ticket" ? (
        <g filter={`url(#${uid}-shadow)`} transform="rotate(-4 180 210)">
          <path d="M66 129h228c19 0 34 15 34 34v114c0 19-15 34-34 34H66c-19 0-34-15-34-34V163c0-19 15-34 34-34Z" fill="#e11d48" />
          <path d="M66 129h228c19 0 34 15 34 34v114c0 19-15 34-34 34H66c-19 0-34-15-34-34V163c0-19 15-34 34-34Z" fill={`url(#${uid}-holo)`} opacity="0.56" />
          <path d="M294 129c19 0 34 15 34 34v114c0 19-15 34-34 34h-48c17-30 20-91 18-182h30Z" fill="#020617" opacity="0.15" />
          <circle cx="35" cy="220" r="21" fill="#07111f" />
          <circle cx="325" cy="220" r="21" fill="#07111f" />
          <path d="M222 145v150" stroke="#fff7ed" strokeWidth="3" strokeDasharray="7 9" opacity="0.38" />
          <text x="82" y="183" fill="#fff7ed" fontSize="24" fontWeight="900" letterSpacing="3">FIESTA VIP</text>
          <text x="82" y="209" fill="#ffedd5" fontSize="10" fontWeight="900" letterSpacing="1.6">ACCESO CON NFC</text>
          <path d="M73 252h130" stroke="#fecdd3" strokeWidth="3" strokeDasharray="7 8" opacity="0.42" />
          <rect x="240" y="222" width="58" height="58" rx="8" fill="#f8fafc" />
          {[252, 276].map((x) => [234, 258].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="13" height="13" fill="#0f172a" />))}
          <rect x="275" y="260" width="13" height="13" fill="#0f172a" />
          <circle cx="258" cy="169" r="16" fill="#fff7ed" opacity="0.18" />
          <text x="258" y="173" textAnchor="middle" fill="#fff7ed" fontSize="9" fontWeight="900">VIP</text>
        </g>
      ) : null}

      <g className="demo-lab-open-burst" transform="translate(180 196)">
        <circle cx="0" cy="0" r="44" fill="none" stroke={accent} strokeWidth="3" />
        <path d="M0-72v-28M51-51l20-20M72 0h30M51 51l20 20M0 72v28M-51 51l-20 20M-72 0h-30M-51-51l-20-20" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      </g>

      <g className="demo-lab-nfc-seal" transform="translate(180 188) rotate(-7)">
        <rect x="-136" y="-42" width="272" height="84" rx="25" fill="#020617" opacity="0.34" filter={`url(#${uid}-glow)`} />
        <g className="demo-lab-nfc-seal-half demo-lab-nfc-seal-half--left">
          <path d="M-104-32H0v64h-104c-12 0-22-10-22-22v-20c0-12 10-22 22-22Z" fill="#071827" stroke={accent} strokeWidth="2" />
          <path d="M-92-4c12-15 30-15 42 0M-84 8c8-9 18-9 26 0M-74 20c4-4 8-4 12 0" fill="none" stroke="#ecfeff" strokeWidth="4" strokeLinecap="round" opacity="0.82" />
          <text x="-38" y="-6" textAnchor="middle" fill="#ecfeff" fontSize="17" fontWeight="900" letterSpacing="2">NFC</text>
          <text x="-38" y="15" textAnchor="middle" fill="#a5f3fc" fontSize="8" fontWeight="900" letterSpacing="1.6">FISICO</text>
        </g>
        <g className="demo-lab-nfc-seal-half demo-lab-nfc-seal-half--right">
          <path d="M0-32h104c12 0 22 10 22 22v20c0 12-10 22-22 22H0v-64Z" fill="#071827" stroke={accent} strokeWidth="2" />
          <text x="58" y="-5" textAnchor="middle" fill="#ecfeff" fontSize="14" fontWeight="900" letterSpacing="1.8">{sealTitle}</text>
          <text x="58" y="15" textAnchor="middle" fill="#a5f3fc" fontSize="8" fontWeight="900" letterSpacing="1.4">{sealBody}</text>
        </g>
        <rect className="demo-lab-nfc-seal-sweep" x="-125" y="-34" width="44" height="68" rx="12" fill="#ffffff" opacity="0.16" />
        <path className="demo-lab-nfc-seal-tear" d="M0-29v58" stroke="#ecfeff" strokeWidth="2" strokeDasharray="4 5" opacity="0.62" />
      </g>

      <g transform="translate(272 61)">
        <circle cx="0" cy="0" r="26" fill="#082f49" stroke={accent} strokeWidth="2" />
        <text x="0" y="4" textAnchor="middle" fill="#ecfeff" fontSize="12" fontWeight="900">{statusLabel}</text>
      </g>
      <text x="180" y="398" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="800">{productLine}</text>
    </svg>
      <span className="demo-lab-nfc-state-pill" aria-hidden="true">
        <strong>{stateTitle}</strong>
        <em>{stateBody}</em>
      </span>
    </div>
  );
}

function MobileOutcome({
  txt,
  beat,
  verticalLabel,
  status,
  product,
  destination,
  routeKm,
  scenario,
  onAction,
  actionMessage,
  locale,
}: {
  txt: DemoCopy;
  beat: Beat;
  verticalLabel: string;
  status: string;
  product: string;
  destination: DemoLocation;
  routeKm: number;
  scenario: DemoScenario;
  onAction: (action: DemoAction) => void;
  actionMessage: string | null;
  locale: AppLocale;
}) {
  const passport = beat === 0 ? "antes de cadena" : beat === 2 ? "bloqueado" : beat === 3 ? "abierto" : "listo";
  const marketplace = beat === 2 ? "bloqueada" : beat === 0 ? "pendiente" : "lista";

  return (
    <article
      aria-label={`${txt.controls.mobile} ${status}`}
      className={`demo-lab-mobile-card demo-lab-mobile-card--${scenario.tone} min-w-0 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.controls.mobile}</p>
          <h3 className="mt-2 text-2xl font-black text-white">{scenario.stateLabel}</h3>
          <p className="mt-1 text-sm text-slate-300">{product}</p>
        </div>
        <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase text-emerald-100">{verticalLabel}</span>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
        <p className="text-sm font-black text-white">{scenario.headline}</p>
        <p className="mt-2 text-xs leading-5 text-slate-300">{scenario.body}</p>
        <p className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-[11px] font-bold text-cyan-100">{scenario.chain}</p>
      </div>

      {/* Mini SVG Map */}
      <div className="w-full h-[75px] rounded-lg bg-slate-950/90 border border-cyan-500/10 relative p-1.5 flex flex-col justify-between overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] my-3 text-left">
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
            <pattern id="demo-phone-map-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 H 0 V 10" fill="none" stroke="rgba(6,182,212,0.04)" strokeWidth="0.5" />
            </pattern>
            <pattern id="demo-phone-map-grid-fine" width="2" height="2" patternUnits="userSpaceOnUse">
              <path d="M 2 0 H 0 V 2" fill="none" stroke="rgba(6,182,212,0.015)" strokeWidth="0.25" />
            </pattern>
            {/* Radar Sweep Gradient */}
            <linearGradient id="demo-phone-radar-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="demo-phone-route-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
              <stop offset="48%" stopColor="#22d3ee" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.82" />
            </linearGradient>
            <radialGradient id="demo-phone-comet-gradient" cx="40%" cy="40%" r="70%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#22d3ee" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </radialGradient>
            {/* Soft Glow Filter */}
            <filter id="demo-phone-soft-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Grid */}
          <rect width="160" height="40" fill="url(#demo-phone-map-grid)" />
          <rect width="160" height="40" fill="url(#demo-phone-map-grid-fine)" opacity="0.8" />

          {/* Radar Sweep Bar */}
          <rect width="40" height="40" fill="url(#demo-phone-radar-gradient)">
            <animate attributeName="x" values="-40;160" dur="2.5s" repeatCount="indefinite" />
          </rect>

          {/* Sincronización Circular HUD */}
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
          <path id="demo-sim-phone-path" d="M20 30 Q50 10 90 25 T140 10" fill="none" stroke="url(#demo-phone-route-gradient)" strokeWidth="1.35" strokeDasharray="3,3" opacity="0.86">
            <animate attributeName="stroke-dashoffset" values="0;-36" dur="2.4s" repeatCount="indefinite" />
          </path>
          
          {/* Glowing path segment for current transit */}
          <path d="M20 30 Q50 10 70 17" fill="none" stroke="#f59e0b" strokeWidth="1.8" filter="url(#demo-phone-soft-glow)" opacity="0.78">
            <animate attributeName="opacity" values="0.32;0.86;0.32" dur="2.2s" repeatCount="indefinite" />
          </path>
          
          {/* Animated Comet/Particle gliding along the route path */}
          <circle r="4.4" fill="url(#demo-phone-comet-gradient)" filter="url(#demo-phone-soft-glow)">
            <animateMotion dur="3.5s" repeatCount="indefinite">
              <mpath href="#demo-sim-phone-path" />
            </animateMotion>
          </circle>
          <circle r="1.8" fill="#f59e0b" opacity="0.5">
            <animateMotion dur="3.5s" begin="-0.18s" repeatCount="indefinite">
              <mpath href="#demo-sim-phone-path" />
            </animateMotion>
          </circle>
          <circle r="1.2" fill="#a78bfa" opacity="0.45">
            <animateMotion dur="3.5s" begin="-0.34s" repeatCount="indefinite">
              <mpath href="#demo-sim-phone-path" />
            </animateMotion>
          </circle>

          {/* Intermediate Nodes with expanding circles */}
          {[
            { x: 60, y: 18, c: "#f59e0b" },
            { x: 100, y: 22, c: "#06b6d4" }
          ].map((node, nodeIdx) => (
            <g key={`demo-phone-relay-${nodeIdx}`}>
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

          {/* Ambient micro signal dots */}
          {[
            { x: 36, y: 11, dx: 13, dy: 7, c: "#22d3ee" },
            { x: 121, y: 29, dx: -16, dy: -5, c: "#a78bfa" },
            { x: 74, y: 33, dx: 10, dy: -12, c: "#34d399" }
          ].map((particle, pidx) => (
            <circle key={`demo-phone-particle-${pidx}`} cx={particle.x} cy={particle.y} r="1.05" fill={particle.c} opacity="0.28">
              <animate attributeName="cx" values={`${particle.x};${particle.x + particle.dx};${particle.x}`} dur={`${3.1 + pidx * 0.6}s`} begin={`${pidx * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="cy" values={`${particle.y};${particle.y + particle.dy};${particle.y}`} dur={`${3.1 + pidx * 0.6}s`} begin={`${pidx * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.08;0.64;0.08" dur={`${3.1 + pidx * 0.6}s`} begin={`${pidx * 0.4}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </svg>
        <div className="flex justify-between text-[6.5px] text-slate-400 font-mono leading-none px-1">
          <span>Valle de Uco</span>
          <span>Mendoza QA</span>
          <span>Tránsito</span>
          <span>{destination.city}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoCell label={txt.controls.origin} value={LOCATIONS.origin.city} />
        <InfoCell label={txt.controls.currentTap} value={destination.city} />
        <InfoCell label={routeEvidenceLabel(locale)} value={routeEvidenceValue(locale, scenario, routeKm)} />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
        <div className="demo-lab-mobile-progress">
          <span style={{ width: `${Math.max(24, (beat + 1) * 25)}%` }} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button suppressHydrationWarning type="button" onClick={() => onAction("origin")} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-3 text-center text-xs font-bold text-cyan-100">{txt.controls.openOrigin}</button>
          <button suppressHydrationWarning type="button" onClick={() => onAction("tap")} className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-3 text-center text-xs font-bold text-violet-100">{txt.controls.openTap}</button>
          <button suppressHydrationWarning type="button" onClick={() => onAction(scenario.primaryAction)} className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-3 text-xs font-bold text-emerald-100">{scenario.primaryLabel}</button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoCell label="Pasaporte" value={passport} />
        <InfoCell label="Garantía" value={beat === 2 ? "bloqueada" : txt.controls.warranty} />
        <InfoCell label="Tienda" value={marketplace} />
      </div>
      {actionMessage ? <p className="demo-lab-action-message mt-4 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-3 text-xs font-bold text-emerald-100">{actionMessage}</p> : null}
    </article>
  );
}

function DemoFlowRail({ scenario, beat, onOpen }: { scenario: DemoScenario; beat: Beat; onOpen: (view: DemoModalView) => void }) {
  const riskCopy = beat === 2 ? "Bloqueado por copia" : "Listo para continuar";
  const items: Array<{ view: Exclude<DemoModalView, null>; eyebrow: string; title: string; body: string; tone: string }> = [
    { view: "product", eyebrow: scenario.stateLabel, title: "Ficha completa", body: "Producto, ruta y prueba", tone: scenario.tone },
    { view: "mobile", eyebrow: "Salida celular", title: "Vista consumidor", body: riskCopy, tone: scenario.tone },
    { view: "nft", eyebrow: "Polygon Amoy", title: "NFT / certificado", body: beat === 2 ? "Solicitud bloqueada por riesgo" : "Solicitud con aprobacion", tone: "nft" },
    { view: "claim", eyebrow: "Portal usuario", title: "Reclamar propiedad", body: "Ingreso, marca y titular", tone: "claim" },
  ];

  return (
    <div className="demo-lab-flow-rail mt-4">
      {items.map((item) => (
        <button suppressHydrationWarning key={item.view} type="button" onClick={() => onOpen(item.view)} className={`demo-lab-flow-rail-card demo-lab-flow-rail-card--${item.tone}`}>
          <span>{item.eyebrow}</span>
          <strong>{item.title}</strong>
          <small>{item.body}</small>
        </button>
      ))}
    </div>
  );
}

function DemoFlowModal({
  view,
  txt,
  beat,
  vertical,
  status,
  product,
  destination,
  routeKm,
  scenario,
  actionMessage,
  locale,
  onAction,
  onClose,
  onOpen,
}: {
  view: DemoModalView;
  txt: DemoCopy;
  beat: Beat;
  vertical: Vertical;
  status: string;
  product: string;
  destination: DemoLocation;
  routeKm: number;
  scenario: DemoScenario;
  actionMessage: string | null;
  locale: AppLocale;
  onAction: (action: DemoAction) => void;
  onClose: () => void;
  onOpen: (view: DemoModalView) => void;
}) {
  useEffect(() => {
    if (!view || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [view, onClose]);

  if (!view) return null;

  const title = view === "product" ? "Ficha completa del producto" : view === "mobile" ? "Resultado en celular" : view === "nft" ? "NFT / certificado Polygon" : "Reclamar propiedad";
  const subtitle = view === "product"
    ? "Producto, ruta, estado de prueba y salida operativa sin romper el layout principal."
    : view === "mobile"
      ? "Lo que ve el consumidor después del toque."
      : view === "nft"
        ? "Cómo se conecta el toque válido con tokenización y evidencia en cadena."
        : "Como el consumidor pasa de validar a asociar el producto en el portal.";

  return (
    <div className="demo-lab-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <button suppressHydrationWarning type="button" className="demo-lab-modal-scrim" aria-label="Cerrar modal" onClick={onClose} />
      <section className="demo-lab-modal-panel">
        <div className="demo-lab-modal-header">
          <div>
            <p>Flujo integrado</p>
            <h2>{title}</h2>
            <span>{subtitle}</span>
          </div>
          <button suppressHydrationWarning type="button" onClick={onClose}>Cerrar</button>
        </div>
        <div className="demo-lab-modal-tabs">
          <button suppressHydrationWarning type="button" onClick={() => onOpen("product")} className={view === "product" ? "active" : ""}>Ficha</button>
          <button suppressHydrationWarning type="button" onClick={() => onOpen("mobile")} className={view === "mobile" ? "active" : ""}>Celular</button>
          <button suppressHydrationWarning type="button" onClick={() => onOpen("nft")} className={view === "nft" ? "active" : ""}>NFT</button>
          <button suppressHydrationWarning type="button" onClick={() => onOpen("claim")} className={view === "claim" ? "active" : ""}>Reclamo</button>
        </div>
        {view === "product" ? (
          <DemoProductModalContent txt={txt} beat={beat} vertical={vertical} product={product} destination={destination} routeKm={routeKm} scenario={scenario} locale={locale} />
        ) : view === "mobile" ? (
          <MobileOutcome txt={txt} beat={beat} verticalLabel={txt.verticals[vertical].label} status={status} product={product} destination={destination} routeKm={routeKm} scenario={scenario} onAction={onAction} actionMessage={actionMessage} locale={locale} />
        ) : view === "nft" ? (
          <DemoNftModalContent beat={beat} scenario={scenario} />
        ) : (
          <DemoClaimModalContent beat={beat} scenario={scenario} />
        )}
      </section>
    </div>
  );
}

function DemoProductModalContent({
  txt,
  beat,
  vertical,
  product,
  destination,
  routeKm,
  scenario,
  locale,
}: {
  txt: DemoCopy;
  beat: Beat;
  vertical: Vertical;
  product: string;
  destination: DemoLocation;
  routeKm: number;
  scenario: DemoScenario;
  locale: AppLocale;
}) {
  const verticalCopy = txt.verticals[vertical];
  const proofItems = verticalCopy.proof.slice(0, 4);
  const state = beat === 2 ? "Bloqueado por replay" : beat === 3 ? "Sello abierto / reclamo" : beat === 0 ? "Listo para primer toque" : "Autenticado";

  return (
    <div className="demo-lab-product-modal">
      <section className="demo-lab-product-modal__visual" aria-label={`Ficha de ${product}`}>
        <div className={`demo-lab-product-modal__stage demo-lab-product-modal__stage--${vertical}`}>
          <DemoLabProductThreeStage
            vertical={vertical}
            product={product}
            beat={beat}
            badge={getRealProductBadge(locale)}
            simulating={false}
          />
        </div>
      </section>

      <section className="demo-lab-product-modal__info">
        <div className={`demo-lab-modal-status demo-lab-modal-status--${scenario.tone}`}>
          <span>{scenario.stateLabel}</span>
          <strong>{product}</strong>
          <p>{scenario.body}</p>
        </div>

        <div className="demo-lab-product-modal__facts">
          <InfoCell label="Vertical" value={verticalCopy.label} />
          <InfoCell label="Perfil" value={verticalCopy.profile} />
          <InfoCell label="Estado" value={state} />
          <InfoCell label={routeEvidenceLabel(locale)} value={routeEvidenceValue(locale, scenario, routeKm)} />
          <InfoCell label="Origen" value={LOCATIONS.origin.city} />
          <InfoCell label="Tap" value={destination.city} />
        </div>

        <div className="demo-lab-product-modal__proofs">
          {proofItems.map((item, index) => (
            <article key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
              <p>{index <= beat ? "Activo en este paso del flujo." : "Se habilita en una etapa posterior."}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DemoNftModalContent({ beat, scenario }: { beat: Beat; scenario: DemoScenario }) {
  const blocked = beat === 2;
  const steps = [
    { label: "01", title: "Toque válido", body: blocked ? "Copia detectada: no se firma en cadena." : "SUN fresco aporta evidencia y crea evento." },
    { label: "02", title: "UID hasheado", body: "El UID no se expone crudo; se usa hash con salt para el certificado." },
    { label: "03", title: "Solicitud", body: blocked ? "La solicitud queda bloqueada por política." : "Se prepara solicitud idempotente de tokenización." },
    { label: "04", title: "Polygon Amoy", body: blocked ? "Sin tx_hash/token_id hasta nuevo toque válido." : "Si la política aprueba el reclamo, el minter registra tx_hash y token_id." },
  ];
  return (
    <div className="demo-lab-modal-story">
      <div className={`demo-lab-modal-status demo-lab-modal-status--${scenario.tone}`}>
        <span>{scenario.stateLabel}</span>
        <strong>{blocked ? "Tokenización bloqueada por seguridad" : "Solicitud de tokenización lista para revisar"}</strong>
        <p>{scenario.chain}</p>
      </div>
      <div className="demo-lab-modal-step-grid">
        {steps.map((step) => (
          <article key={step.label}>
            <span>{step.label}</span>
            <strong>{step.title}</strong>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function DemoClaimModalContent({ beat, scenario }: { beat: Beat; scenario: DemoScenario }) {
  const blocked = beat === 2;
  const steps = [
    { label: "Ingreso", body: "El consumidor entra al portal con sesión propia." },
    { label: "Marca", body: "El reclamo valida que producto, marca y evento coincidan." },
    { label: "Dueño", body: blocked ? "La copia bloquea el reclamo hasta nuevo toque físico." : "El producto queda asociado al usuario si la política lo permite." },
    { label: "Tienda", body: blocked ? "Beneficios de valor bloqueados." : "Se habilitan club, garantía, recompra y beneficios." },
  ];
  return (
    <div className="demo-lab-modal-story">
      <div className={`demo-lab-modal-status demo-lab-modal-status--${scenario.tone}`}>
        <span>{scenario.stateLabel}</span>
        <strong>{blocked ? "Reclamo bloqueado correctamente" : "Reclamo listo con política de dueño"}</strong>
        <p>{scenario.body}</p>
      </div>
      <div className="demo-lab-modal-step-grid">
        {steps.map((step) => (
          <article key={step.label}>
            <span>{step.label}</span>
            <strong>{step.label}</strong>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function DemoFinalTapDock({
  status,
  simulating,
  onValid,
  onTamper,
  onReplay,
  onRefresh,
}: {
  status: string;
  simulating: boolean;
  onValid: () => void;
  onTamper: () => void;
  onReplay: () => void;
  onRefresh: () => void;
}) {
  const flow = [
    { step: "01", title: "Toque físico fresco", body: "El chip genera SUN dinámico. No sirve URL copiada." },
    { step: "02", title: "Anti copia + pasaporte", body: "Si es válido, se habilitan acciones sujetas a política y queda evento." },
    { step: "03", title: "Solicitud / certificado", body: "Se crea solicitud; Polygon devuelve tx_hash + token_id solo si la política aprueba." },
    { step: "04", title: "Reclamar dueño", body: "El usuario asocia producto con ingreso, marca y política de dueño." },
  ];

  return (
    <section className="demo-lab-final-dock mt-5 rounded-3xl border p-4 md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Lista antes del toque final</p>
          <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">Probar el camino real: toque válido - solicitud - reclamar dueño.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{status}</p>
        </div>
        <div className="demo-lab-final-actions">
          <button suppressHydrationWarning type="button" disabled={simulating} onClick={onValid} className="demo-lab-final-button demo-lab-final-button--primary">
            Simular toque válido
          </button>
          <button suppressHydrationWarning type="button" disabled={simulating} onClick={onReplay} className="demo-lab-final-button demo-lab-final-button--danger">
            Probar copia bloqueada
          </button>
          <button suppressHydrationWarning type="button" disabled={simulating} onClick={onTamper} className="demo-lab-final-button demo-lab-final-button--warn">
            Sello abierto
          </button>
          <button suppressHydrationWarning type="button" onClick={onRefresh} className="demo-lab-final-button demo-lab-final-button--ghost">
            Actualizar servidor
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {flow.map((item) => (
          <div key={item.step} className="demo-lab-final-step">
            <span>{item.step}</span>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StageRouteLayer({
  txt,
  routeKm,
  destination,
  scenario,
  locale,
}: {
  txt: DemoCopy;
  routeKm: number;
  destination: DemoLocation;
  scenario: DemoScenario;
  locale: AppLocale;
}) {
  const routeCopy = locale === "en"
    ? {
      eyebrow: "Live route",
      title: "Origin to tap verified",
      distance: "Evidence",
      origin: "Origin",
      tap: "Current tap",
      chain: "Proof chain",
      path: "Audited product route",
      pathBody: "One readable proof: product, UID, SUN, seal and channel policy.",
      checkpointA: "UID",
      checkpointB: "SUN",
      checkpointC: "Policy",
    }
    : locale === "pt-BR"
    ? {
      eyebrow: "Rota viva",
      title: "Origem e toque verificados",
      distance: "Evidencia",
      origin: "Origem",
      tap: "Toque atual",
      chain: "Cadeia de prova",
      path: "Rota auditada do produto",
      pathBody: "Uma prova legivel: produto, UID, SUN, lacre e politica do canal.",
      checkpointA: "UID",
      checkpointB: "SUN",
      checkpointC: "Politica",
    }
    : {
      eyebrow: "Ruta viva",
      title: "Origen y toque verificados",
      distance: "Evidencia",
      origin: "Origen",
      tap: "Toque actual",
      chain: "Cadena de prueba",
      path: "Ruta auditada del producto",
      pathBody: "Una prueba legible: producto, UID, SUN, sello y política de canal.",
      checkpointA: "UID",
      checkpointB: "SUN",
      checkpointC: "Politica",
    };
  const proofStrip = [
    { label: txt.controls.origin, value: LOCATIONS.origin.city },
    { label: txt.controls.currentTap, value: destination.city },
    { label: "SUN", value: scenario.tone === "risk" ? "bloqueado" : "válido" },
    { label: routeCopy.checkpointC, value: scenario.stateLabel },
  ];

  return (
    <div className={`demo-lab-stage-route-layer demo-lab-stage-route-layer--${scenario.tone}`} aria-hidden="true">
      <div className="demo-lab-route-backdrop">
        <svg className="demo-lab-route-diagram" viewBox="0 0 720 360" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="demo-lab-route-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="48%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor={scenario.tone === "risk" ? "#fb7185" : scenario.tone === "open" ? "#a78bfa" : "#60a5fa"} />
            </linearGradient>
            <radialGradient id="demo-lab-route-radar" cx="50%" cy="50%" r="58%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.22" />
              <stop offset="64%" stopColor="#22d3ee" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="720" height="360" rx="26" fill="url(#demo-lab-route-radar)" />
          <path className="demo-lab-route-diagram__grid" d="M92 56 H640 M92 118 H640 M92 180 H640 M92 242 H640 M92 304 H640 M128 34 V328 M248 34 V328 M368 34 V328 M488 34 V328 M608 34 V328" />
          <path className="demo-lab-route-diagram__ghost" d="M116 246 C214 112 318 98 402 176 C484 252 566 210 632 90" />
          <path className="demo-lab-route-diagram__line" d="M116 246 C214 112 318 98 402 176 C484 252 566 210 632 90" />
          <g className="demo-lab-route-diagram__node demo-lab-route-diagram__node--origin" transform="translate(116 246)">
            <circle r="33" />
            <circle r="11" />
          </g>
          <g className={`demo-lab-route-diagram__node demo-lab-route-diagram__node--tap demo-lab-route-diagram__node--${scenario.tone}`} transform="translate(632 90)">
            <circle r="38" />
            <circle r="13" />
          </g>
          <g className="demo-lab-route-diagram__checkpoint" transform="translate(264 125)">
            <rect x="-36" y="-18" width="72" height="36" rx="14" />
            <text textAnchor="middle" y="5">{routeCopy.checkpointA}</text>
          </g>
          <g className="demo-lab-route-diagram__checkpoint" transform="translate(410 181)">
            <rect x="-38" y="-18" width="76" height="36" rx="14" />
            <text textAnchor="middle" y="5">{routeCopy.checkpointB}</text>
          </g>
          <g className="demo-lab-route-diagram__checkpoint" transform="translate(538 198)">
            <rect x="-48" y="-18" width="96" height="36" rx="14" />
            <text textAnchor="middle" y="5">{routeCopy.checkpointC}</text>
          </g>
        </svg>
      </div>
      <div className="demo-lab-route-command">
        <small>{routeCopy.eyebrow}</small>
        <strong>{routeCopy.title}</strong>
        <span>{LOCATIONS.origin.city}{" -> "}{destination.city}</span>
      </div>
      <div className="demo-lab-route-summary">
        <span>
          <small>{routeCopy.distance}</small>
          <strong>{routeEvidenceValue(locale, scenario, routeKm)}</strong>
        </span>
        <span>
          <small>{routeCopy.tap}</small>
          <strong>{destination.city}</strong>
        </span>
        <span>
          <small>Estado</small>
          <strong>{scenario.stateLabel}</strong>
        </span>
      </div>
      <div className="demo-lab-route-proof-strip">
        {proofStrip.map((item) => (
          <span key={item.label}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      <div className="demo-lab-route-path-card">
        <small>{routeCopy.path}</small>
        <strong>{LOCATIONS.origin.city} - {destination.city}</strong>
        <span>{routeCopy.pathBody}</span>
      </div>
    </div>
  );
}

function DemoActionMatrix({
  txt,
  beat,
  routeKm,
  status,
  destination,
  scenario,
  onAction,
  actionMessage,
  locale,
}: {
  txt: DemoCopy;
  beat: Beat;
  routeKm: number;
  status: string;
  destination: DemoLocation;
  scenario: DemoScenario;
  onAction: (action: DemoAction) => void;
  actionMessage: string | null;
  locale: AppLocale;
}) {
  const actions: Array<{ id: DemoAction; label: string; body: string; locked: boolean }> = [
    { id: "join", label: txt.controls.joinClub, body: "Asocia al consumidor con club, beneficios y tienda de la marca.", locked: beat === 0 || beat === 2 },
    { id: "warranty", label: txt.controls.warranty, body: "Registra garantía, postventa o fecha de apertura con política de la marca.", locked: beat === 0 || beat === 2 },
    { id: "tokenize", label: txt.controls.tokenize, body: "Prepara solicitud Polygon con UID hasheado y evidencia de reclamo.", locked: beat === 0 || beat === 2 },
    { id: "report", label: "Reportar riesgo", body: "Crea alerta operativa cuando aparece copia, duplicado o manipulación sospechosa.", locked: beat !== 2 },
  ];

  return (
    <article className={`demo-lab-panel demo-lab-action-matrix demo-lab-action-matrix--${scenario.tone} rounded-3xl border border-white/10 bg-slate-950/60 p-5`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Estado comercial</p>
      <h2 className="mt-2 text-2xl font-black text-white">{scenario.headline}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{scenario.body}</p>

      <div className="demo-lab-policy-grid mt-4">
        <div className="demo-lab-policy-card">
          <p>Permitido ahora</p>
          {scenario.allowed.map((item) => <span key={item}>{item}</span>)}
        </div>
        <div className="demo-lab-policy-card demo-lab-policy-card--blocked">
          <p>Protegido / bloqueado</p>
          {scenario.blocked.map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {actions.map((action) => (
          <button suppressHydrationWarning key={action.id} type="button" onClick={() => onAction(action.id)} className={`demo-lab-action-tile ${action.locked ? "demo-lab-action-tile--locked" : ""}`}>
            <span>{action.label}</span>
            <small>{action.body}</small>
            <strong>{action.locked ? "Ver por qué bloquea" : "Ejecutar acción"}</strong>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <InfoCell label={routePolicyLabel(locale)} value={routeEvidenceValue(locale, scenario, routeKm)} />
        <InfoCell label="Estado" value={status} />
        <InfoCell label="Marca" value="Bodega Balmec" />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Ruta activa: {LOCATIONS.origin.city} -&gt; {destination.city}. Los botones cambian de política según estado físico, copia y compra/reclamo.
      </p>
      {actionMessage ? <p className="demo-lab-action-message mt-4 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-3 text-xs font-bold text-emerald-100">{actionMessage}</p> : null}
    </article>
  );
}

function DemoCrmDashboard({
  summary,
  locale,
  mapPoints,
  activeVertical,
  refreshSummary,
  simulate,
  simulating,
  txt,
}: {
  summary: DemoSummary | null;
  locale: AppLocale;
  mapPoints: DemoMapPoint[];
  activeVertical: any;
  refreshSummary: () => void;
  simulate: (mode: SimulationMode) => Promise<void>;
  simulating: boolean;
  txt: DemoCopy;
}) {
  const [activeTab, setActiveTab] = useState<"leads" | "tickets" | "orders" | "taps">("leads");
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Local overrides to simulate real-time CRM updates when buttons are clicked!
  const [localLeadsStatus, setLocalLeadsStatus] = useState<Record<string, string>>({});
  const [localTicketsStatus, setLocalTicketsStatus] = useState<Record<string, string>>({});
  const [localOrdersStatus, setLocalOrdersStatus] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void refreshSummary();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshSummary]);

  const recentLeads = summary?.recentLeads || [];
  const recentTickets = summary?.recentTickets || [];
  const recentOrders = summary?.recentOrders || [];
  const liveEvents = summary?.events || [];

  const atlasPoints = useMemo(() => toDemoAtlasPoints(mapPoints, txt.controls), [mapPoints, txt.controls]);
  const routes = useMemo<VectorMapRoute[]>(() => liveEvents
    .filter((event) => event.lat != null && event.lng != null)
    .map((event, index) => {
      const tone: VectorMapRoute["tone"] = event.result === "REPLAY_FAIL" || event.result === "SUSPICIOUS" ? "warn" : "info";
      return {
        id: `crm-route-${event.id || event.created_at || index}`,
        fromLat: LOCATIONS.origin.lat,
        fromLng: LOCATIONS.origin.lng,
        toLat: event.lat!,
        toLng: event.lng!,
        label: `${LOCATIONS.origin.city} -> ${event.city || "scan"}`,
        tone,
        evidence: formatEventResult(event.result),
      };
    })
    .slice(0, 10), [liveEvents]);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(locale === "en" ? "en-US" : "es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  const handleLeadAction = (leadId: string, actionName: string) => {
    setLocalLeadsStatus((prev) => ({ ...prev, [leadId]: actionName }));
    setActionMessage(`Lead actualizado: Estado cambiado a "${actionName}". Notificación enviada al equipo comercial.`);
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleTicketAction = (ticketId: string, statusName: string) => {
    setLocalTicketsStatus((prev) => ({ ...prev, [ticketId]: statusName }));
    setActionMessage(`Ticket de seguridad actualizado: Estado cambiado a "${statusName}". Registro de auditoría cerrado.`);
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleOrderAction = (orderId: string, statusName: string) => {
    setLocalOrdersStatus((prev) => ({ ...prev, [orderId]: statusName }));
    setActionMessage(`Orden comercial actualizada: Estado cambiado a "${statusName}". Se ha enviado confirmación de despacho al reseller.`);
    setTimeout(() => setActionMessage(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Total Etiquetas</span>
            <Fingerprint className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-white">{summary?.tagCount ?? "--"}</p>
          <div className="mt-1 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400 rounded-full" style={{ width: "70%" }} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Leads en CRM</span>
            <UserRound className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-400">{summary?.crm?.leads ?? 0}</p>
          <span className="text-[10px] font-medium text-slate-400">Contactos calificados</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Alertas de Fraude</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-rose-400">{summary?.crm?.tickets ?? 0}</p>
          <span className="text-[10px] font-medium text-slate-400">Incidencias de seguridad</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Órdenes Activas</span>
            <ShoppingCart className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-400">{summary?.crm?.orders ?? 0}</p>
          <span className="text-[10px] font-medium text-slate-400">Solicitudes de hardware</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Escaneos Totales</span>
            <Check className="h-4 w-4 text-violet-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-white">{liveEvents.length}</p>
          <span className="text-[10px] font-medium text-slate-400">Toques registrados</span>
        </div>
      </div>

      {/* Main Grid: Map & Controls / Streams */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Map panel (Span 2) */}
        <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">Mapa Operativo en Tiempo Real</h3>
              <p className="text-xs text-slate-400">Procedencia (Uco Valley) hacia puntos de escaneo actuales</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full bg-emerald-400 ${autoRefresh ? "animate-ping" : ""}`} />
              <span className="text-[10px] uppercase font-bold text-slate-400">
                {autoRefresh ? "Feed en vivo" : "Pausado"}
              </span>
            </div>
          </div>
          
          <div className="demo-lab-atlas-panel demo-lab-atlas-panel--live mt-4">
            <HeroTrustAtlasSvg points={atlasPoints} routes={routes} selectedPointId="tap" />
          </div>
        </div>

        {/* Action matrix / Live Log */}
        <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">Monitoreo de Eventos</h3>
              <button 
                type="button" 
                onClick={() => void refreshSummary()}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white"
              >
                <RefreshCw className="h-3 w-3" />
                Refrescar
              </button>
            </div>
            
            <p className="mt-2 text-xs text-slate-400">Transacciones y verificaciones criptográficas activas</p>

            {/* Consola de Simulación Rápida */}
            <div className="mt-4 mb-2 rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-cyan-300 mb-2.5 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                Consola de Simulación Rápida
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={simulating}
                  onClick={() => void simulate("valid")}
                  className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-2.5 text-center transition disabled:opacity-55"
                >
                  <span className="text-[11px] font-black text-emerald-400">✓ Válido</span>
                  <span className="text-[8px] text-slate-400 font-mono mt-0.5">Zúrich</span>
                </button>
                
                <button
                  type="button"
                  disabled={simulating}
                  onClick={() => void simulate("replay")}
                  className="flex flex-col items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-2.5 text-center transition disabled:opacity-55"
                >
                  <span className="text-[11px] font-black text-rose-400">⚠ Copia</span>
                  <span className="text-[8px] text-slate-400 font-mono mt-0.5">Replay</span>
                </button>

                <button
                  type="button"
                  disabled={simulating}
                  onClick={() => void simulate("tamper")}
                  className="flex flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-2.5 text-center transition disabled:opacity-55"
                >
                  <span className="text-[11px] font-black text-amber-400">✕ Abierto</span>
                  <span className="text-[8px] text-slate-400 font-mono mt-0.5">Tamper</span>
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2 overflow-y-auto max-h-[380px] pr-2">
              {liveEvents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">
                  Esperando toques en el SDK o aplicación móvil...
                </p>
              ) : (
                liveEvents.slice(0, 10).map((event) => {
                  const isSuccess = event.result === "AUTHENTICATED" || event.result === "VERIFIED" || event.result === "OK";
                  const isRisk = event.result === "REPLAY_FAIL" || event.result === "SUSPICIOUS" || event.result === "FAIL";
                  return (
                    <div 
                      key={event.id || `${event.created_at}-${event.uidMasked}`} 
                      className={`rounded-xl border p-3 text-xs transition ${
                        isSuccess 
                          ? "border-emerald-500/10 bg-emerald-500/5" 
                          : isRisk 
                          ? "border-rose-500/15 bg-rose-500/5 animate-pulse" 
                          : "border-white/5 bg-slate-950/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-white font-black">
                          {event.city || "Ciudad Desconocida"}, {event.country_code || "N/A"}
                        </strong>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          isSuccess 
                            ? "bg-emerald-500/10 text-emerald-400" 
                            : isRisk 
                            ? "bg-rose-500/10 text-rose-400" 
                            : "bg-slate-800 text-slate-300"
                        }`}>
                          {event.result}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-300">
                        {event.product_name || activeVertical?.product || "Lote Premium"} / {event.uidMasked || "UID-NA"}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">{formatTime(event.created_at || "")}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-3 text-center">
            <span className="text-[10px] text-slate-500 font-mono">
              Consola Operativa Segura · TLS 1.3 · Proof registry opcional
            </span>
          </div>
        </div>
      </div>

      {/* Action Notification Alert Toast */}
      {actionMessage && (
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-200 animate-fadeIn">
          {actionMessage}
        </div>
      )}

      {/* Ledger Section (Tables) */}
      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex gap-2">
            {(["leads", "tickets", "orders", "taps"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  activeTab === tab
                    ? "border border-cyan-400/30 bg-cyan-500/10 text-cyan-300"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab === "leads" && `Leads (${recentLeads.length})`}
                {tab === "tickets" && `Alertas / Incidentes (${recentTickets.length})`}
                {tab === "orders" && `Órdenes de Compra (${recentOrders.length})`}
                {tab === "taps" && `Historial de Escaneos (${liveEvents.length})`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input 
                type="checkbox" 
                checked={autoRefresh} 
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-white/20 bg-slate-950 text-cyan-500 focus:ring-0" 
              />
              Auto-refresh (10s)
            </label>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {/* LEADS TABLE */}
          {activeTab === "leads" && (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase font-black tracking-wider">
                  <th className="py-3 px-4">Compañía / Nombre</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4">Rubro</th>
                  <th className="py-3 px-4">Volumen</th>
                  <th className="py-3 px-4">Origen</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">No hay registros de leads activos en la base de datos.</td>
                  </tr>
                ) : (
                  recentLeads.map((lead) => {
                    const statusOverride = localLeadsStatus[lead.id] || lead.status;
                    return (
                      <tr key={lead.id} className="hover:bg-white/5 transition">
                        <td className="py-3 px-4">
                          <strong className="text-white block">{lead.company || "S/D"}</strong>
                          <span className="text-slate-400 text-[10px]">{lead.name || lead.contact}</span>
                        </td>
                        <td className="py-3 px-4 font-mono">{lead.email || lead.phone || lead.contact}</td>
                        <td className="py-3 px-4 uppercase font-bold text-cyan-300">{lead.vertical || "General"}</td>
                        <td className="py-3 px-4">{lead.volume ? `${lead.volume.toLocaleString(locale)} tags` : "S/D"}</td>
                        <td className="py-3 px-4 uppercase font-bold text-slate-400">{lead.source}</td>
                        <td className="py-3 px-4 text-slate-500">{formatTime(lead.created_at)}</td>
                        <td className="py-3 px-4">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                            statusOverride === "new" || statusOverride === "Nuevo" 
                              ? "bg-cyan-500/10 text-cyan-300 border border-cyan-400/20" 
                              : statusOverride === "contacted" || statusOverride === "Contactado" || statusOverride === "Contactado"
                              ? "bg-amber-500/10 text-amber-300 border border-amber-400/20"
                              : "bg-emerald-500/10 text-emerald-300 border border-emerald-400/20"
                          }`}>
                            {statusOverride}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => handleLeadAction(lead.id, "Contactado")}
                            disabled={statusOverride === "Contactado"}
                            className="rounded bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-300/30 px-2 py-1 text-[10px] text-slate-300 hover:text-cyan-200 transition"
                          >
                            Contactar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLeadAction(lead.id, "Calificado")}
                            disabled={statusOverride === "Calificado"}
                            className="rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 px-2 py-1 text-[10px] text-emerald-300 transition"
                          >
                            Calificar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* TICKETS (SECURITY INCIDENTS) TABLE */}
          {activeTab === "tickets" && (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase font-black tracking-wider">
                  <th className="py-3 px-4">Incidencia / Mensaje</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4">Origen canal</th>
                  <th className="py-3 px-4">Fecha reporte</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentTickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">No hay alertas de seguridad registradas en este período.</td>
                  </tr>
                ) : (
                  recentTickets.map((ticket) => {
                    const statusOverride = localTicketsStatus[ticket.id] || ticket.status;
                    return (
                      <tr key={ticket.id} className="hover:bg-white/5 transition">
                        <td className="py-3 px-4">
                          <strong className="text-rose-400 block">{ticket.title}</strong>
                          <span className="text-slate-400 text-[10px] block max-w-sm overflow-hidden text-ellipsis whitespace-nowrap">{ticket.detail || "Sin detalles"}</span>
                        </td>
                        <td className="py-3 px-4 font-mono">{ticket.contact}</td>
                        <td className="py-3 px-4 uppercase font-bold text-slate-400">{ticket.source}</td>
                        <td className="py-3 px-4 text-slate-500">{formatTime(ticket.created_at)}</td>
                        <td className="py-3 px-4">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                            statusOverride === "open" || statusOverride === "Abierto"
                              ? "bg-rose-500/10 text-rose-300 border border-rose-400/20"
                              : "bg-slate-500/10 text-slate-300 border border-white/10"
                          }`}>
                            {statusOverride}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleTicketAction(ticket.id, "Resuelto")}
                            disabled={statusOverride === "Resuelto" || statusOverride === "resolved"}
                            className="rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 px-2 py-1 text-[10px] text-emerald-300 transition"
                          >
                            Resolver
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* ORDER REQUESTS TABLE */}
          {activeTab === "orders" && (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase font-black tracking-wider">
                  <th className="py-3 px-4">Cliente / Compañía</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4">Tipo Tag NFC</th>
                  <th className="py-3 px-4">Cantidad</th>
                  <th className="py-3 px-4">Origen</th>
                  <th className="py-3 px-4">Fecha de Solicitud</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">No hay órdenes de compra activas en el CRM.</td>
                  </tr>
                ) : (
                  recentOrders.map((order) => {
                    const statusOverride = localOrdersStatus[order.id] || order.status;
                    return (
                      <tr key={order.id} className="hover:bg-white/5 transition">
                        <td className="py-3 px-4">
                          <strong className="text-white block">{order.company || "S/D"}</strong>
                        </td>
                        <td className="py-3 px-4 font-mono">{order.contact}</td>
                        <td className="py-3 px-4 uppercase font-bold text-violet-300">{order.tag_type || "NTAG 424 DNA"}</td>
                        <td className="py-3 px-4">{order.volume ? `${order.volume.toLocaleString(locale)} unidades` : "S/D"}</td>
                        <td className="py-3 px-4 uppercase font-bold text-slate-400">{order.source}</td>
                        <td className="py-3 px-4 text-slate-500">{formatTime(order.created_at)}</td>
                        <td className="py-3 px-4">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                            statusOverride === "new" || statusOverride === "Nuevo" || statusOverride === "pending"
                              ? "bg-amber-500/10 text-amber-300 border border-amber-400/20" 
                              : "bg-emerald-500/10 text-emerald-300 border border-emerald-400/20"
                          }`}>
                            {statusOverride}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOrderAction(order.id, "Aprobado")}
                            disabled={statusOverride === "Aprobado" || statusOverride === "approved"}
                            className="rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 px-2 py-1 text-[10px] text-emerald-300 transition"
                          >
                            Aprobar Despacho
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* ALL SCANS HISTORIAL TABLE */}
          {activeTab === "taps" && (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase font-black tracking-wider">
                  <th className="py-3 px-4">Ubicación</th>
                  <th className="py-3 px-4">Código País</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Tag UID</th>
                  <th className="py-3 px-4">Veredicto Cripto</th>
                  <th className="py-3 px-4">Fecha Toque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {liveEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">No hay escaneos históricos registrados en la red.</td>
                  </tr>
                ) : (
                  liveEvents.map((event) => {
                    const isSuccess = event.result === "AUTHENTICATED" || event.result === "VERIFIED" || event.result === "OK";
                    const isRisk = event.result === "REPLAY_FAIL" || event.result === "SUSPICIOUS" || event.result === "FAIL";
                    return (
                      <tr key={event.id || `${event.created_at}-${event.uidMasked}`} className="hover:bg-white/5 transition">
                        <td className="py-3 px-4 font-bold text-white">{event.city || "Sin dato"}</td>
                        <td className="py-3 px-4 font-mono uppercase text-slate-400">{event.country_code || "N/A"}</td>
                        <td className="py-3 px-4">{event.product_name || activeVertical?.product || "Lote General"}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{event.uidMasked || "UID-NA"}</td>
                        <td className="py-3 px-4">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                            isSuccess 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-400/20" 
                              : isRisk 
                              ? "bg-rose-500/10 text-rose-400 border border-rose-400/20" 
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}>
                            {event.result}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{formatTime(event.created_at || "")}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
