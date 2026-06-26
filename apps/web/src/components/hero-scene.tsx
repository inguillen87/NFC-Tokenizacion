"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { AppLocale } from "@product/config";
import { Globe3dMap } from "@product/ui";
import { platformVerticals, type PlatformDemoVertical, type PlatformVertical } from "../lib/platform-verticals";

type Vertical = PlatformDemoVertical;
type HeroSelectorKey = PlatformDemoVertical;

const HeroThreeStage = dynamic(() => import("./hero-three-stage").then((mod) => mod.HeroThreeStage), {
  ssr: false,
});

function verticalLabel(item: PlatformVertical, locale: AppLocale) {
  if (locale === "en") return item.titleEn;
  if (locale === "pt-BR") return item.titlePt;
  return item.title;
}

type LocationPoint = {
  city: string;
  country: string;
  label: string;
  lat: number;
  lng: number;
};

type Scene = {
  label: string;
  profile: string;
  action: string;
  result: string;
  product: string;
  batch: string;
  uid: string;
  origin: LocationPoint;
  security: string;
  nextAction: string;
  marketplace: string;
  loyalty: string;
  businessValue: string;
  objectClass: string;
  phoneTag: string;
  steps: string[];
};

const tapLocations: LocationPoint[] = [
  { city: "Buenos Aires", country: "Argentina", label: "miembro del club", lat: -34.6037, lng: -58.3816 },
  { city: "Santiago", country: "Chile", label: "comprador en tienda", lat: -33.4489, lng: -70.6693 },
  { city: "Sao Paulo", country: "Brasil", label: "demo de distribuidor", lat: -23.5558, lng: -46.6396 },
  { city: "Miami", country: "Estados Unidos", label: "distribuidor de exportacion", lat: 25.7617, lng: -80.1918 },
  { city: "Zurich", country: "Suiza", label: "coleccionista premium", lat: 47.3769, lng: 8.5417 },
  { city: "Cordoba", country: "Argentina", label: "ingreso de evento", lat: -31.4201, lng: -64.1888 },
];

const labels: Record<AppLocale, {
  selectorTitle: string;
  microcopy: string;
  commercialRail: string;
  valuePills: string[];
  ctaBands: string[];
  phoneLabel: string;
  swapTap: string;
  liveTap: string;
  whatHappened: string;
  routeTitle: string;
  originMap: string;
  tapMap: string;
  openOriginMap: string;
  custody: string;
  assetBank: string;
  realAsset: string;
  renderFallback: string;
  evidenceChart: string;
  labels: {
    product: string;
    origin: string;
    tap: string;
    distance: string;
    uid: string;
    batch: string;
    security: string;
    nextAction: string;
    marketplace: string;
    loyalty: string;
      businessValue: string;
  };
  metrics: {
    authenticity: string;
    traceability: string;
    commercial: string;
  };
  items: Record<Vertical, Scene>;
}> = {
  "es-AR": {
    selectorTitle: "Elegí vertical",
    microcopy: "Cada toque convierte seguridad en relación: prueba de origen, club, garantía, puntos, recompra y tienda contextual para la marca.",
    commercialRail: "Capa comercial que se activa después del toque",
    valuePills: ["Club VIP", "Puntos", "Garantía", "Dato para CRM", "Tienda", "Token opcional"],
    ctaBands: ["Bodegas", "Eventos", "Cosmética", "Agro", "Moda", "Salud"],
    phoneLabel: "Salida celular",
    swapTap: "Cambiar toque",
    liveTap: "Toque simulado",
    whatHappened: "Qué está pasando",
    routeTitle: "Ruta de confianza",
    originMap: "Origen",
    tapMap: "Toque",
    openOriginMap: "Ver origen en Maps",
    custody: "Origen, distancia y acción quedan unidos al evento.",
    assetBank: "Banco visual",
    realAsset: "Foto real",
    renderFallback: "Render interactivo",
    evidenceChart: "Evidencia del toque",
    labels: {
      product: "Producto",
      origin: "Origen",
      tap: "Toque actual",
      distance: "Distancia",
      uid: "UID",
      batch: "Lote",
      security: "Seguridad",
      nextAction: "Siguiente acción",
      marketplace: "Tienda",
      loyalty: "Beneficios",
      businessValue: "Valor para marca",
    },
    metrics: {
      authenticity: "Autenticidad",
      traceability: "Trazabilidad",
      commercial: "Post-tap",
    },
    items: {
      seeds: {
        label: "Agro",
        profile: "QR + NFC UID",
        action: "Bolsa abierta en campo: lote, ficha técnica y custodia visibles.",
        result: "Lote y origen verificados",
        product: "Semilla premium",
        batch: "AG-903",
        uid: "QRF-903-17",
        origin: { city: "Rosario", country: "Argentina", label: "planta", lat: -32.9442, lng: -60.6505 },
        security: "QR/NFC UID + trazabilidad logística",
        nextAction: "Ficha técnica, soporte y reclamo",
        marketplace: "Reposición, asesor técnico y cupón rural",
        loyalty: "Soporte técnico, reposición y beneficios por lote",
        businessValue: "Trazabilidad + asistencia + canal rural",
        objectClass: "agro-demo tampered scanning",
        phoneTag: "AGRO - LOT_OK",
        steps: ["Lectura en campo", "Lote confirmado", "Origen visible", "Soporte activo"],
      },
      bracelet: {
        label: "Eventos",
        profile: "NTAG215",
        action: "Pulsera VIP escaneada en puerta: UID serializado y regla del servidor.",
        result: "Acceso VIP aprobado",
        product: "Pulsera VIP",
        batch: "EVT-BA-ACCESS-17",
        uid: "0470****8842",
        origin: { city: "Buenos Aires", country: "Argentina", label: "venue", lat: -34.5792, lng: -58.4208 },
        security: "UID + estado de acceso + bloqueo de reingreso",
        nextAction: "Beneficio backstage o mejora de entrada",
        marketplace: "Promos de barra, merch y reventa controlada",
        loyalty: "Puntos por asistencia, mejoras y merch",
        businessValue: "Control de acceso + datos de audiencia + ingresos post-evento",
        objectClass: "wristband-demo scanning",
        phoneTag: "EVENTO - INGRESO_OK",
        steps: ["Toque en ingreso", "Servidor valida UID", "Marca ingreso", "Activa beneficio"],
      },
      pharma: {
        label: "Pharma",
        profile: "NTAG 424 DNA",
        action: "Medicamento escaneado: veracidad, lote y recall por unidad verificado en base de datos.",
        result: "Medicamento verificado",
        product: "Amoxicilina Premium",
        batch: "PHA-2026-081",
        uid: "04C3****99A4",
        origin: { city: "Bogota", country: "Colombia", label: "laboratorio", lat: 4.711, lng: -74.0721 },
        security: "SUN anticopia + recall unitario",
        nextAction: "Ver prospecto digital o reporte de lote",
        marketplace: "Canal farmacia + soporte médico",
        loyalty: "Garantía de autenticidad, prospecto y recordatorios de dosis",
        businessValue: "Auditoría de lote + alerta recall + first party CRM",
        objectClass: "pharma-demo scanning",
        phoneTag: "PHARMA - AUTH_OK",
        steps: ["Lectura en caja", "SUN valida origen", "Verifica estado de recall", "Abre prospecto digital"],
      },
      perfume: {
        label: "Cosmética",
        profile: "NTAG 424 DNA",
        action: "Tapa o sello validado: el producto demuestra lote, origen y garantía.",
        result: "Producto genuino",
        product: "Serum premium",
        batch: "COS-CS-442",
        uid: "04B2****72C1",
        origin: { city: "Santiago", country: "Chile", label: "laboratorio", lat: -33.4489, lng: -70.6693 },
        security: "SUN dinámico + lote + garantía",
        nextAction: "Registro de garantía y recompra",
        marketplace: "Venta cruzada, muestras y beneficios",
        loyalty: "Garantía, muestras y recompra",
        businessValue: "Antifalsificación + datos propios + venta cruzada",
        objectClass: "cosmetic-demo scanning",
        phoneTag: "COSMETIC - VERIFIED",
        steps: ["Toque en tapa", "SUN verifica autenticidad", "Muestra lote", "Activa garantía"],
      },
      wine: {
        label: "Vino",
        profile: "NTAG 424 DNA TT",
        action: "Descorche o sello abierto: la etiqueta cambia estado y el SUN valida el toque.",
        result: "Auténtico, sello abierto",
        product: "Gran Reserva Malbec",
        batch: "MZA-2026-0424",
        uid: "04A7****1090",
        origin: { city: "Valle de Uco", country: "Argentina", label: "bodega", lat: -33.6131, lng: -69.2075 },
        security: "SUN dinámico + sello físico + anticopia",
        nextAction: "Club, garantía, reclamo de dueño o token premium",
        marketplace: "Voucher post-compra + trazabilidad de colección",
        loyalty: "320 pts, club de cosecha, voucher y recompra premium",
        businessValue: "CRM post-toque + tienda + tokenización opcional",
        objectClass: "hero-bottle scanning tampered",
        phoneTag: "VINO - AUT_OK",
        steps: ["Se lee UID físico", "SUN evita copia", "El sello queda abierto", "Se abre club y tienda"],
      },
      sneaker: {
        label: "Zapatillas",
        profile: "NTAG 424 DNA",
        action: "Zapatilla coleccionable verificada: UID, rareza, dueño y beneficio quedan unidos al toque.",
        result: "Autenticada con dueño",
        product: "Drop Runner 37Z",
        batch: "SNK-37Z-055",
        uid: "04F1****37Z9",
        origin: { city: "Buenos Aires", country: "Argentina", label: "drop studio", lat: -34.5875, lng: -58.3974 },
        security: "SUN dinámico + UID + reclamo de dueño",
        nextAction: "Verificar dueño, garantía, reventa o token premium",
        marketplace: "Drop exclusivo, reventa controlada y beneficios de comunidad",
        loyalty: "Acceso a drops, puntos y certificado de colección",
        businessValue: "Anticopia + ownership + canal de resale",
        objectClass: "sneaker-demo scanning",
        phoneTag: "SNEAKER - OWNER_OK",
        steps: ["Toque en lengueta", "SUN valida pieza", "Rareza visible", "Dueño/token habilitado"],
      },
      logistics: {
        label: "Logística",
        profile: "UHF + NFC",
        action: "Pallet escaneado en distribuidora: temperatura, ruta de custodia y lote confirmados.",
        result: "Cadena de frío OK",
        product: "Pallet Vacunas Co-19",
        batch: "LOG-VAC-884",
        uid: "04E9****4820",
        origin: { city: "Mendoza", country: "Argentina", label: "centro logístico", lat: -32.8895, lng: -68.8458 },
        security: "Sensores IoT + UID + cadena de custodia",
        nextAction: "Ficha de temperatura y auditoría",
        marketplace: "Servicios logísticos premium + seguros de carga",
        loyalty: "Historial de ruta, temperatura promedio y reporte de conformidad",
        businessValue: "Auditoría en tiempo real + reclamos automatizados + control de calidad",
        objectClass: "logistics-demo scanning",
        phoneTag: "LOGISTICS - COLD_OK",
        steps: ["Lectura en pallet", "Check de temperatura IoT", "Valida ruta", "Confirma recepción"],
      },
      electronics: {
        label: "Electrónica",
        profile: "NFC + QR",
        action: "Dispositivo electrónico validado: propiedad, número de serie y garantía activados.",
        result: "Garantía activa",
        product: "Smartwatch Nex-V",
        batch: "ELE-NX-2026",
        uid: "04D8****1024",
        origin: { city: "Miami", country: "USA", label: "distribuidora", lat: 25.7617, lng: -80.1918 },
        security: "UID único + firma digital + tracking de garantía",
        nextAction: "Soporte oficial, registro o reclamo",
        marketplace: "Accesorios oficiales + extensión de garantía",
        loyalty: "Garantía digital activa, soporte prioritario y club de upgrades",
        businessValue: "Antifraude de garantía + registro post-venta + ofertas de upgrade",
        objectClass: "electronics-demo scanning",
        phoneTag: "ELECTRONICS - WARRANTY_OK",
        steps: ["Toque en caja/equipo", "SUN valida serie", "Garantía se activa", "Habilita soporte"],
      },
      textile: {
        label: "Textil",
        profile: "NFC + QR DPP",
        action: "Pasaporte digital textil escaneado: origen, materiales y reventa verificados.",
        result: "Pasaporte DPP válido",
        product: "Campera Denim Premium",
        batch: "TEX-DEN-021",
        uid: "048A****3920",
        origin: { city: "Madrid", country: "España", label: "fábrica textil", lat: 40.4168, lng: -3.7038 },
        security: "Pasaporte digital europeo + UID NFC + certificado de propiedad",
        nextAction: "Ver circularidad y reclamar dueño",
        marketplace: "Canal de recompra circular + guía de cuidados",
        loyalty: "Acceso a pre-ventas, club de circularidad y descuento por reciclado",
        businessValue: "Cumplimiento regulatorio EU DPP + reventa de marca + engagement circular",
        objectClass: "textile-demo scanning",
        phoneTag: "TEXTILE - DPP_OK",
        steps: ["Lectura de etiqueta", "Valida pasaporte DPP", "Muestra materiales/origen", "Habilita reventa/cuidados"],
      },
      luxury: {
        label: "Lujo",
        profile: "NTAG 424 DNA",
        action: "Reloj cronógrafo escaneado: certificado de propiedad, garantía y autenticidad validados en el servidor.",
        result: "Autenticado con dueño",
        product: "Reloj cronógrafo premium",
        batch: "LUX-CH-2026",
        uid: "04C2****99B4",
        origin: { city: "Miami", country: "USA", label: "distribuidora", lat: 25.7617, lng: -80.1918 },
        security: "SUN dinámico + certificado de propiedad",
        nextAction: "Verificar dueño, garantía, reventa o token premium",
        marketplace: "Beneficios exclusivos, recompra y club de coleccionistas",
        loyalty: "Garantía digital activa, acceso VIP y club de coleccionistas",
        businessValue: "Antifalsificación + mercado de reventa verificado + CRM directo",
        objectClass: "luxury-demo scanning",
        phoneTag: "LUXURY - AUTH_OK",
        steps: ["Toque en tarjeta", "SUN verifica autenticidad", "Valida propiedad", "Abre club de valor"],
      },
      bottle: {
        label: "Botellas",
        profile: "NFC + QR",
        action: "Botella de bebida retornable escaneada: procedencia, ciclo de reciclaje y retorno validados.",
        result: "Retorno Validado",
        product: "Bebida Gaseosa Orgánica",
        batch: "BEV-OR-902",
        uid: "048E****2039",
        origin: { city: "Rosario", country: "Argentina", label: "planta embotelladora", lat: -32.9442, lng: -60.6505 },
        security: "QR + UID NFC + control de ciclo",
        nextAction: "Registrar retorno de envase o ver impacto ecológico",
        marketplace: "Tienda de recarga + cupones verdes",
        loyalty: "Descuento en próxima compra por retornar envase",
        businessValue: "Estadísticas ESG + incentivos de circularidad + control de inventario",
        objectClass: "bottle-demo scanning",
        phoneTag: "BOTTLE - RETURN_OK",
        steps: ["Lectura de envase", "Verifica retorno", "Asigna incentivo ecológico", "Confirma recepción"],
      },
    },
  },
  "pt-BR": {
    selectorTitle: "Escolha o vertical",
    microcopy: "Cada toque transforma seguranca em relacionamento: prova de origem, clube, garantia, pontos, recompra e marketplace contextual para a marca.",
    commercialRail: "Camada comercial ativada depois do toque",
    valuePills: ["Clube VIP", "Pontos", "Garantia", "CRM lead", "Marketplace", "Token opcional"],
    ctaBands: ["Vinhos", "Eventos", "Cosmeticos", "Agro", "Moda", "Pharma"],
    phoneLabel: "Saida mobile",
    swapTap: "Trocar toque",
    liveTap: "Toque simulado",
    whatHappened: "O que acontece",
    routeTitle: "Rota de confianca",
    originMap: "Origem",
    tapMap: "Toque",
    openOriginMap: "Ver origem no Maps",
    custody: "Origem, distancia e acao ficam ligados ao evento.",
    assetBank: "Banco visual",
    realAsset: "Foto real",
    renderFallback: "Render interativo",
    evidenceChart: "Evidencia do toque",
    labels: {
      product: "Produto",
      origin: "Origem",
      tap: "Toque atual",
      distance: "Distancia",
      uid: "UID",
      batch: "Lote",
      security: "Seguranca",
      nextAction: "Proxima acao",
      marketplace: "Marketplace",
      loyalty: "Loyalty",
      businessValue: "Valor empresa",
    },
    metrics: {
      authenticity: "Autenticidade",
      traceability: "Rastreabilidade",
      commercial: "Pos-toque",
    },
    items: {
      seeds: {
        label: "Agro",
        profile: "QR + NFC UID",
        action: "Saco aberto no campo: lote, ficha tecnica e custodia visiveis.",
        result: "Lote e origem verificados",
        product: "Semente premium",
        batch: "AG-903",
        uid: "QRF-903-17",
        origin: { city: "Rosario", country: "Argentina", label: "planta", lat: -32.9442, lng: -60.6505 },
        security: "QR/NFC UID + rastreabilidade logistica",
        nextAction: "Ficha tecnica, suporte e reclamo",
        marketplace: "Reposicao, tecnico e cupom rural",
        loyalty: "Suporte tecnico, reposicao e beneficios por lote",
        businessValue: "Rastreabilidade + assistencia + canal rural",
        objectClass: "agro-demo tampered scanning",
        phoneTag: "AGRO - LOT_OK",
        steps: ["Scan no campo", "Lote confirmado", "Origem visivel", "Suporte ativo"],
      },
      bracelet: {
        label: "Eventos",
        profile: "NTAG215",
        action: "Pulseira VIP escaneada na porta: UID serializado e regra server-side.",
        result: "Acesso VIP aprovado",
        product: "Pulseira VIP",
        batch: "EVT-BA-ACCESS-17",
        uid: "0470****8842",
        origin: { city: "Buenos Aires", country: "Argentina", label: "venue", lat: -34.5792, lng: -58.4208 },
        security: "UID + estado de acesso + bloqueio duplicado",
        nextAction: "Beneficio backstage ou upgrade",
        marketplace: "Promos, merch e revenda controlada",
        loyalty: "Pontos por presenca, upgrades e merch",
        businessValue: "Controle de acesso + dados de audiencia + receita pos-evento",
        objectClass: "wristband-demo scanning",
        phoneTag: "EVENT - ENTRY_OK",
        steps: ["Toque na entrada", "Backend valida UID", "Marca check-in", "Ativa beneficio"],
      },
      pharma: {
        label: "Pharma",
        profile: "NTAG 424 DNA",
        action: "Medicamento escaneado: veracidade, lote e recall por unidade verificado no banco de dados.",
        result: "Medicamento verificado",
        product: "Amoxicilina Premium",
        batch: "PHA-2026-081",
        uid: "04C3****99A4",
        origin: { city: "Bogota", country: "Colombia", label: "laboratorio", lat: 4.711, lng: -74.0721 },
        security: "SUN anticopia + recall unitario",
        nextAction: "Ver bula digital ou relatorio de lote",
        marketplace: "Canal farmacia + suporte medico",
        loyalty: "Garantia de autenticidade, bula e lembretes de dose",
        businessValue: "Auditoria de lote + alerta recall + first party CRM",
        objectClass: "pharma-demo scanning",
        phoneTag: "PHARMA - AUTH_OK",
        steps: ["Leitura na caixa", "SUN valida origem", "Verifica estado de recall", "Abre bula digital"],
      },
      perfume: {
        label: "Cosmeticos",
        profile: "NTAG 424 DNA",
        action: "Tampa ou lacre validado: o produto mostra lote, origem e garantia.",
        result: "Produto genuino",
        product: "Serum premium",
        batch: "COS-CS-442",
        uid: "04B2****72C1",
        origin: { city: "Santiago", country: "Chile", label: "laboratorio", lat: -33.4489, lng: -70.6693 },
        security: "SUN dinamico + lote + garantia",
        nextAction: "Registro de garantia e recompra",
        marketplace: "Cross-sell, amostras e loyalty",
        loyalty: "Garantia, amostras e recompra",
        businessValue: "Antifalsificacao + first-party data + cross-sell",
        objectClass: "cosmetic-demo scanning",
        phoneTag: "COSMETIC - VERIFIED",
        steps: ["Toque na tampa", "SUN verifica", "Lote aparece", "Garantia ativa"],
      },
      wine: {
        label: "Vinho",
        profile: "NTAG 424 DNA TT",
        action: "Rolha ou lacre aberto: o tamper muda estado e o SUN valida o toque.",
        result: "Autentico, lacre aberto",
        product: "Gran Reserva Malbec",
        batch: "MZA-2026-0424",
        uid: "04A7****1090",
        origin: { city: "Valle de Uco", country: "Argentina", label: "vinicola", lat: -33.6131, lng: -69.2075 },
        security: "SUN dinamico + tamper fisico + anti-replay",
        nextAction: "Clube, garantia, dono ou token premium",
        marketplace: "Voucher pos-compra + rastreabilidade de colecao",
        loyalty: "320 pts, clube de safra, voucher e recompra premium",
        businessValue: "CRM pos-toque + marketplace + tokenizacao opcional",
        objectClass: "hero-bottle scanning tampered",
        phoneTag: "WINE - AUTH_OK",
        steps: ["Leitura de UID fisico", "SUN reduz replay", "Lacre muda para OPENED", "Clube e marketplace abrem"],
      },
      sneaker: {
        label: "Tenis",
        profile: "NTAG 424 DNA",
        action: "Tenis colecionavel verificado: UID, raridade, dono e beneficio ficam ligados ao toque.",
        result: "Autenticado com dono",
        product: "Drop Runner 37Z",
        batch: "SNK-37Z-055",
        uid: "04F1****37Z9",
        origin: { city: "Buenos Aires", country: "Argentina", label: "drop studio", lat: -34.5875, lng: -58.3974 },
        security: "SUN dinamico + UID + claim de dono",
        nextAction: "Verificar dono, garantia, revenda ou token premium",
        marketplace: "Drop exclusivo, revenda controlada e beneficios de comunidade",
        loyalty: "Acesso a drops, pontos e certificado de colecao",
        businessValue: "Anti copia + ownership + canal de resale",
        objectClass: "sneaker-demo scanning",
        phoneTag: "SNEAKER - OWNER_OK",
        steps: ["Toque na lingueta", "SUN valida peca", "Raridade visivel", "Dono/token habilitado"],
      },
      logistics: {
        label: "Logistica",
        profile: "UHF + NFC",
        action: "Pallet escaneado na distribuidora: temperatura, rota de custodia e lote confirmados.",
        result: "Cadeia de frio OK",
        product: "Pallet Vacunas Co-19",
        batch: "LOG-VAC-884",
        uid: "04E9****4820",
        origin: { city: "Mendoza", country: "Argentina", label: "centro logistico", lat: -32.8895, lng: -68.8458 },
        security: "Sensores IoT + UID + cadeia de custodia",
        nextAction: "Ficha de temperatura e auditoria",
        marketplace: "Servicos logisticos premium + seguros de carga",
        loyalty: "Historico de rota, temperatura media e relatorio de conformidade",
        businessValue: "Auditoria em tempo real + reclamacoes automatizadas + controle de qualidade",
        objectClass: "logistics-demo scanning",
        phoneTag: "LOGISTICS - COLD_OK",
        steps: ["Leitura no pallet", "Check de temperatura IoT", "Valida rota", "Confirma recepcao"],
      },
      electronics: {
        label: "Eletronica",
        profile: "NFC + QR",
        action: "Dispositivo eletronico verificado: propriedade, numero de serie e garantia ativados.",
        result: "Garantia Ativa",
        product: "Smartwatch Nex-V",
        batch: "ELE-NX-2026",
        uid: "04D8****1024",
        origin: { city: "Miami", country: "USA", label: "distribuidora", lat: 25.7617, lng: -80.1918 },
        security: "UID unico + assinatura digital + tracking de garantia",
        nextAction: "Suporte oficial, registro ou reclamacao",
        marketplace: "Acessorios oficiais + extensao de garantia",
        loyalty: "Garantia digital activa, suporte prioritario e clube de upgrades",
        businessValue: "Antifraude de garantia + registro pos-venda + ofertas de upgrade",
        objectClass: "electronics-demo scanning",
        phoneTag: "ELECTRONICS - WARRANTY_OK",
        steps: ["Toque na caixa/equipamento", "SUN valida serie", "Garantia activa", "Habilita suporte"],
      },
      textile: {
        label: "Textil",
        profile: "NFC + QR DPP",
        action: "Passaporte digital textil escaneado: origem, composicao e revenda verificados.",
        result: "Passaporte DPP Valido",
        product: "Jaqueta Denim Premium",
        batch: "TEX-DEN-021",
        uid: "048A****3920",
        origin: { city: "Madrid", country: "Espanha", label: "fabrica textil", lat: 40.4168, lng: -3.7038 },
        security: "Passaporte digital europeu + UID NFC + certificado de propriedade",
        nextAction: "Ver circularidade e reclamar dono",
        marketplace: "Canal de recompra circular + guia de cuidados",
        loyalty: "Acesso a pre-vendas, clube de circularidade e desconto por reciclagem",
        businessValue: "Cumplimiento regulatorio EU DPP + revenda de marca + engajamento circular",
        objectClass: "textile-demo scanning",
        phoneTag: "TEXTILE - DPP_OK",
        steps: ["Leitura da etiqueta", "Valida pasaporte DPP", "Mostra materiais/origem", "Habilita revenda/cuidados"],
      },
      luxury: {
        label: "Luxo",
        profile: "NTAG 424 DNA",
        action: "Relogio cronografo escaneado: certificado de propriedade, garantia e autenticidade validados no servidor.",
        result: "Autenticado com dono",
        product: "Relogio Cronografo Premium",
        batch: "LUX-CH-2026",
        uid: "04C2****99B4",
        origin: { city: "Miami", country: "USA", label: "distribuidora", lat: 25.7617, lng: -80.1918 },
        security: "SUN dinamico + certificado de propriedade",
        nextAction: "Verificar dono, garantia, revenda ou token premium",
        marketplace: "Beneficios exclusivos, recompra e clube de colecionadores",
        loyalty: "Garantia digital ativa, acesso VIP e clube de colecionadores",
        businessValue: "Antifalsificacao + mercado de revenda verificado + CRM direto",
        objectClass: "luxury-demo scanning",
        phoneTag: "LUXURY - AUTH_OK",
        steps: ["Toque no cartao", "SUN verifica autenticidade", "Valida propriedade", "Abre clube de valor"],
      },
      bottle: {
        label: "Garrafas",
        profile: "NFC + QR",
        action: "Garrafa de bebida retornavel escaneada: procedencia, ciclo de reciclagem e retorno validados.",
        result: "Retorno Validado",
        product: "Refrigerante Organico",
        batch: "BEV-OR-902",
        uid: "048E****2039",
        origin: { city: "Rosario", country: "Argentina", label: "planta de engarrafamento", lat: -32.9442, lng: -60.6505 },
        security: "QR + UID NFC + controle de ciclo",
        nextAction: "Registrar retorno da embalagem ou ver impacto ecologico",
        marketplace: "Loja de recarga + cupons verdes",
        loyalty: "Desconto na proxima compra por retornar embalagem",
        businessValue: "Estatisticas ESG + incentivos de circularidade + controle de estoque",
        objectClass: "bottle-demo scanning",
        phoneTag: "BOTTLE - RETURN_OK",
        steps: ["Leitura da garrafa", "Verifica retorno", "Atribui incentivo ecologico", "Confirma recepcao"],
      },
    },
  },
  en: {
    selectorTitle: "Choose vertical",
    microcopy: "Every tap turns security into relationship: origin proof, club, warranty, points, reorder and a contextual marketplace for the brand.",
    commercialRail: "Commercial layer unlocked after the tap",
    valuePills: ["VIP club", "Points", "Warranty", "CRM lead", "Marketplace", "Optional token"],
    ctaBands: ["Wineries", "Events", "Cosmetics", "Agro", "Fashion", "Pharma"],
    phoneLabel: "Mobile output",
    swapTap: "Change tap",
    liveTap: "Simulated tap",
    whatHappened: "What happens",
    routeTitle: "Trust route",
    originMap: "Origin",
    tapMap: "Tap",
    openOriginMap: "Open origin map",
    custody: "Origin, distance and physical action are attached to the event.",
    assetBank: "Visual bank",
    realAsset: "Real photo",
    renderFallback: "Interactive render",
    evidenceChart: "Tap evidence",
    labels: {
      product: "Product",
      origin: "Origin",
      tap: "Current tap",
      distance: "Distance",
      uid: "UID",
      batch: "Batch",
      security: "Security",
      nextAction: "Next action",
      marketplace: "Marketplace",
      loyalty: "Loyalty",
      businessValue: "Business value",
    },
    metrics: {
      authenticity: "Authenticity",
      traceability: "Traceability",
      commercial: "Post-tap",
    },
    items: {
      seeds: {
        label: "Agro",
        profile: "QR + NFC UID",
        action: "Bag opened in field: lot, technical sheet and custody become visible.",
        result: "Lot and origin verified",
        product: "Premium seed",
        batch: "AG-903",
        uid: "QRF-903-17",
        origin: { city: "Rosario", country: "Argentina", label: "plant", lat: -32.9442, lng: -60.6505 },
        security: "QR/NFC UID + logistics traceability",
        nextAction: "Technical sheet, support and claim flow",
        marketplace: "Reorder, agronomist support and rural coupon",
        loyalty: "Technical support, reorder and lot benefits",
        businessValue: "Traceability + support + rural channel",
        objectClass: "agro-demo tampered scanning",
        phoneTag: "AGRO - LOT_OK",
        steps: ["Field scan", "Lot is confirmed", "Origin is visible", "Support opens"],
      },
      bracelet: {
        label: "Events",
        profile: "NTAG215",
        action: "VIP wristband scanned at gate: serialized UID and server-side rule.",
        result: "VIP access granted",
        product: "VIP wristband",
        batch: "EVT-BA-ACCESS-17",
        uid: "0470****8842",
        origin: { city: "Buenos Aires", country: "Argentina", label: "venue", lat: -34.5792, lng: -58.4208 },
        security: "UID + access state + duplicate entry block",
        nextAction: "Backstage perk or ticket upgrade",
        marketplace: "Bar promos, merch and controlled resale",
        loyalty: "Attendance points, upgrades and merch",
        businessValue: "Access control + audience data + post-event revenue",
        objectClass: "wristband-demo scanning",
        phoneTag: "EVENT - ENTRY_OK",
        steps: ["Tap at access", "Backend validates UID", "Check-in is written", "Benefit is unlocked"],
      },
      pharma: {
        label: "Pharma",
        profile: "NTAG 424 DNA",
        action: "Medicine scanned: authenticity, batch and unit recall status verified in database.",
        result: "Medicine verified",
        product: "Premium Amoxicillin",
        batch: "PHA-2026-081",
        uid: "04C3****99A4",
        origin: { city: "Bogota", country: "Colombia", label: "lab", lat: 4.711, lng: -74.0721 },
        security: "Dynamic SUN + unit recall",
        nextAction: "View digital leaflet or batch audit trail",
        marketplace: "Pharmacy channel + medical support",
        loyalty: "Authenticity warranty, leaflet and dosage reminders",
        businessValue: "Batch audit trail + recall alert + first-party CRM",
        objectClass: "pharma-demo scanning",
        phoneTag: "PHARMA - AUTH_OK",
        steps: ["Box scan", "SUN verifies origin", "Verifies recall status", "Opens digital leaflet"],
      },
      perfume: {
        label: "Cosmetics",
        profile: "NTAG 424 DNA",
        action: "Cap or seal validated: the product proves batch, origin and warranty.",
        result: "Genuine product",
        product: "Premium serum",
        batch: "COS-CS-442",
        uid: "04B2****72C1",
        origin: { city: "Santiago", country: "Chile", label: "lab", lat: -33.4489, lng: -70.6693 },
        security: "Dynamic SUN + batch + warranty",
        nextAction: "Warranty registration and reorder",
        marketplace: "Cross-sell, samples and loyalty",
        loyalty: "Warranty, samples and reorder",
        businessValue: "Anti-counterfeit + first-party data + cross-sell",
        objectClass: "cosmetic-demo scanning",
        phoneTag: "COSMETIC - VERIFIED",
        steps: ["Tap on cap", "SUN proves authenticity", "Batch appears", "Warranty opens"],
      },
      wine: {
        label: "Wine",
        profile: "NTAG 424 DNA TT",
        action: "Uncork or seal break: tamper changes state and SUN validates the tap.",
        result: "Authentic, opened seal",
        product: "Gran Reserva Malbec",
        batch: "MZA-2026-0424",
        uid: "04A7****1090",
        origin: { city: "Uco Valley", country: "Argentina", label: "winery", lat: -33.6131, lng: -69.2075 },
        security: "Dynamic SUN + physical tamper + anti-replay",
        nextAction: "Club, warranty, ownership or premium token",
        marketplace: "Post-purchase voucher + collectible provenance",
        loyalty: "320 pts, harvest club, voucher and premium reorder",
        businessValue: "Post-tap CRM + marketplace + optional tokenization",
        objectClass: "hero-bottle scanning tampered",
        phoneTag: "WINE - AUTH_OK",
        steps: ["Reads physical UID", "SUN blocks replay", "Seal becomes OPENED", "Club and marketplace open"],
      },
      sneaker: {
        label: "Sneakers",
        profile: "NTAG 424 DNA",
        action: "Collectible sneaker verified: UID, rarity, owner and benefits stay attached to the tap.",
        result: "Authenticated owner",
        product: "Drop Runner 37Z",
        batch: "SNK-37Z-055",
        uid: "04F1****37Z9",
        origin: { city: "Buenos Aires", country: "Argentina", label: "drop studio", lat: -34.5875, lng: -58.3974 },
        security: "Dynamic SUN + UID + ownership claim",
        nextAction: "Verify owner, warranty, resale or premium token",
        marketplace: "Exclusive drop, controlled resale and community benefits",
        loyalty: "Drop access, points and collector certificate",
        businessValue: "Anti-copy + ownership + resale channel",
        objectClass: "sneaker-demo scanning",
        phoneTag: "SNEAKER - OWNER_OK",
        steps: ["Tap on tongue", "SUN validates item", "Rarity visible", "Owner/token enabled"],
      },
      logistics: {
        label: "Logistics",
        profile: "UHF + NFC",
        action: "Pallet scanned at warehouse: temperature, custody route and batch confirmed.",
        result: "Cold chain OK",
        product: "Co-19 Vaccine Pallet",
        batch: "LOG-VAC-884",
        uid: "04E9****4820",
        origin: { city: "Mendoza", country: "Argentina", label: "logistics hub", lat: -32.8895, lng: -68.8458 },
        security: "IoT Sensors + UID + custody chain",
        nextAction: "Temperature log and audit trail",
        marketplace: "Premium logistics + cargo insurance",
        loyalty: "Route history, average temperature and compliance report",
        businessValue: "Real-time auditing + automated claims + quality control",
        objectClass: "logistics-demo scanning",
        phoneTag: "LOGISTICS - COLD_OK",
        steps: ["Pallet read", "IoT temperature check", "Validate route", "Confirm delivery"],
      },
      electronics: {
        label: "Electronics",
        profile: "NFC + QR",
        action: "Electronic device verified: ownership, serial number and warranty activated.",
        result: "Warranty Active",
        product: "Nex-V Smartwatch",
        batch: "ELE-NX-2026",
        uid: "04D8****1024",
        origin: { city: "Miami", country: "USA", label: "distributor", lat: 25.7617, lng: -80.1918 },
        security: "Unique UID + digital signature + warranty tracking",
        nextAction: "Official support, register or claim",
        marketplace: "Official accessories + warranty extension",
        loyalty: "Active digital warranty, priority support and upgrade club",
        businessValue: "Warranty anti-fraud + registration + upgrade offers",
        objectClass: "electronics-demo scanning",
        phoneTag: "ELECTRONICS - WARRANTY_OK",
        steps: ["Box/device tap", "SUN validates serial", "Warranty activates", "Enables support"],
      },
      textile: {
        label: "Textile",
        profile: "NFC + QR DPP",
        action: "Digital product passport scanned: origin, composition and verified resale status.",
        result: "Valid DPP Passport",
        product: "Premium Denim Jacket",
        batch: "TEX-DEN-021",
        uid: "048A****3920",
        origin: { city: "Madrid", country: "Spain", label: "textile mill", lat: 40.4168, lng: -3.7038 },
        security: "EU Digital Passport + NFC UID + owner cert",
        nextAction: "View circularity and claim ownership",
        marketplace: "Circular resale channel + care guide",
        loyalty: "Pre-sales access, circularity club and recycling discounts",
        businessValue: "EU DPP compliance + branded resale + circular engagement",
        objectClass: "textile-demo scanning",
        phoneTag: "TEXTILE - DPP_OK",
        steps: ["Tag scan", "Validate DPP passport", "Show materials/origin", "Enable circular options"],
      },
      luxury: {
        label: "Luxury",
        profile: "NTAG 424 DNA",
        action: "Chronograph watch scanned: certificate of ownership, warranty and authenticity verified on server.",
        result: "Authenticated owner",
        product: "Premium Chronograph Watch",
        batch: "LUX-CH-2026",
        uid: "04C2****99B4",
        origin: { city: "Miami", country: "USA", label: "distributor", lat: 25.7617, lng: -80.1918 },
        security: "Dynamic SUN + ownership certificate",
        nextAction: "Verify owner, warranty, resale or premium token",
        marketplace: "Exclusive benefits, resale and collector club",
        loyalty: "Active digital warranty, VIP access and collector club",
        businessValue: "Anti-counterfeiting + verified resale market + direct CRM",
        objectClass: "luxury-demo scanning",
        phoneTag: "LUXURY - AUTH_OK",
        steps: ["Card tap", "SUN verifies authenticity", "Validates ownership", "Opens value club"],
      },
      bottle: {
        label: "Bottles",
        profile: "NFC + QR",
        action: "Returnable beverage bottle scanned: provenance, recycling cycle and returns verified.",
        result: "Return Verified",
        product: "Organic Soda Bottle",
        batch: "BEV-OR-902",
        uid: "048E****2039",
        origin: { city: "Rosario", country: "Argentina", label: "bottling plant", lat: -32.9442, lng: -60.6505 },
        security: "QR + UID NFC + cycle control",
        nextAction: "Register container return or see green impact",
        marketplace: "Refill store + green coupons",
        loyalty: "Next purchase discount for returning container",
        businessValue: "ESG stats + circularity incentives + inventory control",
        objectClass: "bottle-demo scanning",
        phoneTag: "BOTTLE - RETURN_OK",
        steps: ["Bottle read", "Verify return", "Assigns green incentive", "Confirms reception"],
      },
    },
  },
};

function haversineKm(a: LocationPoint, b: LocationPoint) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(radiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function localeName(locale: AppLocale) {
  if (locale === "pt-BR") return "pt-BR";
  if (locale === "en") return "en-US";
  return "es-AR";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const HERO_MAP_WIDTH = 1200;
const HERO_MAP_HEIGHT = 620;

function projectMercator(point: LocationPoint) {
  const x = ((point.lng + 180) / 360) * HERO_MAP_WIDTH;
  const clippedLat = Math.max(-85.05112878, Math.min(85.05112878, point.lat));
  const sin = Math.sin((clippedLat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * HERO_MAP_HEIGHT;
  return { x, y };
}

function traceViewBox(origin: LocationPoint, tap: LocationPoint) {
  const coords = [projectMercator(origin), projectMercator(tap)];
  const minX = Math.min(...coords.map((coord) => coord.x));
  const maxX = Math.max(...coords.map((coord) => coord.x));
  const minY = Math.min(...coords.map((coord) => coord.y));
  const maxY = Math.max(...coords.map((coord) => coord.y));
  const width = Math.min(HERO_MAP_WIDTH, Math.max(150, Math.max(1, maxX - minX) * 4.2));
  const height = Math.min(HERO_MAP_HEIGHT, Math.max(116, Math.max(1, maxY - minY) * 4.8));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    x: clamp(centerX - width / 2, 0, HERO_MAP_WIDTH - width),
    y: clamp(centerY - height / 2, 0, HERO_MAP_HEIGHT - height),
    width,
    height,
  };
}

function projectMapPoint(point: LocationPoint, origin: LocationPoint, tap: LocationPoint) {
  const box = traceViewBox(origin, tap);
  const projected = projectMercator(point);
  const x = ((projected.x - box.x) / box.width) * 100;
  const y = ((projected.y - box.y) / box.height) * 100;
  return { x: clamp(x, 8, 92), y: clamp(y, 13, 84) };
}

function mapsHref(point: LocationPoint) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.lat},${point.lng}`)}`;
}

type HeroAtlasHover = {
  eyebrow: string;
  title: string;
  detail: string;
  tone: "origin" | "tap" | "route" | "country";
};

function HeroPremiumAtlas({
  origin,
  tap,
  routeHeadline,
  formattedDistance,
  onHover,
}: {
  origin: LocationPoint;
  tap: LocationPoint;
  routeHeadline: string;
  formattedDistance: string;
  onHover: (hover: HeroAtlasHover | null) => void;
}) {
  const routeStops = [
    { id: "origin", label: "Origen verificado", x: 286, y: 288, color: "#34d399" },
    { id: "sun", label: "SUN dinamico", x: 350, y: 212, color: "#67e8f9" },
    { id: "tap", label: "Tap fisico", x: 430, y: 205, color: "#22d3ee" },
    { id: "crm", label: "CRM / beneficio", x: 506, y: 252, color: "#a78bfa" },
  ];

  return (
    <svg className="hero-premium-atlas" viewBox="0 0 720 430" role="img" aria-label={`${routeHeadline}: ${origin.city} a ${tap.city}`}>
      <defs>
        <radialGradient id="hero-atlas-ocean" cx="38%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.62" />
          <stop offset="32%" stopColor="#0891b2" stopOpacity="0.42" />
          <stop offset="72%" stopColor="#082f49" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#020617" stopOpacity="1" />
        </radialGradient>
        <linearGradient id="hero-atlas-land" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.42" />
          <stop offset="48%" stopColor="#5eead4" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="0.46" />
        </linearGradient>
        <linearGradient id="hero-atlas-route" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
          <stop offset="42%" stopColor="#67e8f9" stopOpacity="1" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.86" />
        </linearGradient>
        <filter id="hero-atlas-glow">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="hero-atlas-sphere">
          <circle cx="360" cy="216" r="166" />
        </clipPath>
      </defs>

      <rect width="720" height="430" rx="30" fill="rgba(2,6,23,.18)" />
      <g opacity="0.28" stroke="#67e8f9" strokeWidth="1" fill="none">
        {[140, 206, 272, 338, 404, 470, 536].map((x) => <path key={`atlas-meridian-${x}`} d={`M${x} 54 C${310 + (x - 360) * 0.22} 142 ${310 + (x - 360) * 0.22} 288 ${x} 378`} />)}
        {[86, 132, 178, 224, 270, 316, 362].map((y) => <ellipse key={`atlas-parallel-${y}`} cx="360" cy="216" rx="166" ry={Math.max(12, Math.abs(216 - y) * 0.82)} />)}
      </g>
      <circle cx="360" cy="216" r="173" fill="rgba(34,211,238,.08)" filter="url(#hero-atlas-glow)" />
      <circle cx="360" cy="216" r="166" fill="url(#hero-atlas-ocean)" />

      <g clipPath="url(#hero-atlas-sphere)">
        <path
          className="hero-premium-atlas__country-hit"
          d="M204 156 C232 108 302 88 350 112 C385 130 396 168 374 196 C350 226 306 218 284 244 C258 274 290 318 252 348 C214 377 158 346 148 294 C139 246 174 207 204 156 Z"
          fill="url(#hero-atlas-land)"
          stroke="rgba(186,230,253,.34)"
          strokeWidth="2"
          onMouseEnter={() => onHover({ eyebrow: "Pais de origen", title: origin.country, detail: `${origin.city} - lote y UID nacen aca`, tone: "country" })}
          onMouseLeave={() => onHover(null)}
        />
        <path d="M294 254 C338 270 368 318 356 360 C344 402 298 420 260 398 C224 377 232 332 248 300 C260 276 272 260 294 254 Z" fill="url(#hero-atlas-land)" stroke="rgba(186,230,253,.34)" strokeWidth="2" />
        <path
          className="hero-premium-atlas__country-hit"
          d="M392 118 C462 82 562 104 604 164 C636 210 598 252 540 242 C502 236 482 256 452 286 C420 318 370 292 364 246 C358 198 348 144 392 118 Z"
          fill="url(#hero-atlas-land)"
          stroke="rgba(186,230,253,.24)"
          strokeWidth="2"
          opacity="0.84"
          onMouseEnter={() => onHover({ eyebrow: "Pais de destino", title: tap.country, detail: `${tap.city} - tap fisico del comprador`, tone: "country" })}
          onMouseLeave={() => onHover(null)}
        />
        <path d="M180 314 C260 250 346 246 428 286 C494 318 568 296 632 232" fill="none" stroke="rgba(125,245,255,.28)" strokeWidth="2" strokeDasharray="8 12" />
        <path d="M218 196 C318 170 422 188 540 162" fill="none" stroke="rgba(94,234,212,.22)" strokeWidth="1.5" strokeDasharray="4 10" />
      </g>

      <path className="hero-premium-atlas__route-shadow" d="M286 288 C332 188 430 174 506 252" />
      <path className="hero-premium-atlas__route" d="M286 288 C332 188 430 174 506 252" />
      <path
        className="hero-premium-atlas__route-hit"
        d="M286 288 C332 188 430 174 506 252"
        onMouseEnter={() => onHover({ eyebrow: "Trazabilidad viva", title: `${origin.city} -> ${tap.city}`, detail: `${formattedDistance} km - UID, SUN, tap fisico y CRM`, tone: "route" })}
        onMouseLeave={() => onHover(null)}
      />
      {routeStops.map((stop, index) => (
        <g
          key={stop.id}
          className="hero-premium-atlas__stop"
          transform={`translate(${stop.x} ${stop.y})`}
          onMouseEnter={() => onHover({ eyebrow: `Paso ${index + 1}`, title: stop.label, detail: index === 0 ? origin.city : index === routeStops.length - 1 ? tap.city : "Evidencia firmada en la ruta", tone: "route" })}
          onMouseLeave={() => onHover(null)}
        >
          <circle r="15" fill={stop.color} opacity="0.13" />
          <circle r="4.2" fill={stop.color} />
        </g>
      ))}
      <circle className="hero-premium-atlas__pulse hero-premium-atlas__pulse--origin" cx="286" cy="288" r="28" />
      <circle className="hero-premium-atlas__pulse hero-premium-atlas__pulse--tap" cx="506" cy="252" r="34" />
      <circle
        className="hero-premium-atlas__dot hero-premium-atlas__dot--origin"
        cx="286"
        cy="288"
        r="8"
        onMouseEnter={() => onHover({ eyebrow: "Ciudad de origen", title: origin.city, detail: `${origin.country} - producto, UID y lote`, tone: "origin" })}
        onMouseLeave={() => onHover(null)}
      />
      <circle
        className="hero-premium-atlas__dot hero-premium-atlas__dot--tap"
        cx="506"
        cy="252"
        r="9"
        onMouseEnter={() => onHover({ eyebrow: "Ciudad de tap", title: tap.city, detail: `${tap.country} - lectura fisica del consumidor`, tone: "tap" })}
        onMouseLeave={() => onHover(null)}
      />
      <g className="hero-premium-atlas__label" transform="translate(156 136)">
        <text>ARGENTINA</text>
      </g>
      <g className="hero-premium-atlas__label hero-premium-atlas__label--tap" transform="translate(490 142)">
        <text>{tap.country.toUpperCase()}</text>
      </g>
      <g className="hero-premium-atlas__city" transform="translate(112 310)">
        <rect width="160" height="48" rx="14" />
        <text x="14" y="20">{origin.city}</text>
        <text x="14" y="36">{origin.country}</text>
      </g>
      <g className="hero-premium-atlas__city hero-premium-atlas__city--tap" transform="translate(492 268)">
        <rect width="152" height="48" rx="14" />
        <text x="14" y="20">{tap.city}</text>
        <text x="14" y="36">{formattedDistance} km</text>
      </g>
    </svg>
  );
}

function HeroTraceMap({
  origin,
  tap,
  distance,
  numberLocale,
  txt,
}: {
  origin: LocationPoint;
  tap: LocationPoint;
  distance: number;
  numberLocale: string;
  txt: Pick<(typeof labels)["es-AR"], "routeTitle" | "originMap" | "tapMap" | "openOriginMap" | "custody">;
}) {
  const originPoint = projectMapPoint(origin, origin, tap);
  const tapPoint = projectMapPoint(tap, origin, tap);
  const pinDistance = Math.hypot(originPoint.x - tapPoint.x, originPoint.y - tapPoint.y);
  const pinsOverlap = pinDistance < 18;
  const originPinPoint = pinsOverlap
    ? { x: clamp(originPoint.x - 14, 14, 74), y: clamp(originPoint.y + 12, 26, 76) }
    : originPoint;
  const tapPinPoint = pinsOverlap
    ? { x: clamp(tapPoint.x + 14, 26, 86), y: clamp(tapPoint.y - 12, 22, 72) }
    : tapPoint;
  const formattedDistance = distance.toLocaleString(numberLocale);
  const routeHeadline = txt.routeTitle === "Trust route" ? "Live route" : txt.routeTitle.startsWith("Rota") ? "Rota viva" : "Ruta viva";
  const tapCopy = txt.routeTitle === "Trust route" ? "Physical tap" : txt.routeTitle.startsWith("Rota") ? "Toque físico" : "Tap físico";
  const distanceCopy = txt.routeTitle === "Trust route" ? "Distance" : txt.routeTitle.startsWith("Rota") ? "Distancia" : "Distancia";
  const routeMidX = (originPoint.x + tapPoint.x) / 2;
  const routeMidY = Math.max(16, Math.min(originPoint.y, tapPoint.y) - 16);
  const cityDots = [
    { x: 18, y: 24, label: origin.country },
    { x: 38, y: 38, label: origin.city },
    { x: 65, y: 34, label: tap.country },
    { x: 78, y: 62, label: tap.city },
    { x: 28, y: 74, label: "CRM" },
  ];
  const evidenceCopy = txt.routeTitle === "Trust route"
    ? `${formattedDistance} km with physical tap, SUN and channel evidence.`
    : txt.routeTitle.startsWith("Rota")
      ? `${formattedDistance} km com evidencia de toque, SUN e canal.`
    : `${formattedDistance} km con evidencia de toque físico, SUN y canal.`;

  const [atlasHover, setAtlasHover] = useState<HeroAtlasHover | null>(null);

  return (
    <div className="hero-trace-map hero-trace-map--clear hero-trace-map--globe flex items-center justify-center" aria-label={txt.routeTitle}>
      <HeroPremiumAtlas origin={origin} tap={tap} routeHeadline={routeHeadline} formattedDistance={formattedDistance} onHover={setAtlasHover} />
      <div className="hero-trace-map__globe" aria-label={`${origin.city} a ${tap.city}`}>
        <Globe3dMap
          theme="dark"
          points={[
            { city: origin.city, country: origin.country, lat: origin.lat, lng: origin.lng, scans: 1, status: "origin", vertical: "origen" },
            { city: tap.city, country: tap.country, lat: tap.lat, lng: tap.lng, scans: 1, status: "tap", vertical: "cliente" },
          ]}
          routes={[{
            fromLat: origin.lat,
            fromLng: origin.lng,
            toLat: tap.lat,
            toLng: tap.lng,
            tone: "success",
            label: `${origin.city} -> ${tap.city} / ${formattedDistance} km`,
          }]}
          width={640}
          height={430}
          className="border-0 bg-transparent shadow-none"
        />
      </div>
      <div className="hero-map-intel">
        <p>{atlasHover?.eyebrow || routeHeadline}</p>
        <strong>{atlasHover?.title || `${origin.city} / ${tap.city}`}</strong>
        <span>{atlasHover?.detail || evidenceCopy}</span>
      </div>
      <div className="hero-route-summary-card">
        <div className="hero-route-summary-grid">
          <span>
            <small>{txt.originMap}</small>
            <strong>{origin.city}</strong>
          </span>
          <span>
            <small>{tapCopy}</small>
            <strong>{tap.city}</strong>
          </span>
          <span>
            <small>{distanceCopy}</small>
            <strong>{formattedDistance} km</strong>
          </span>
        </div>
        <a className="hero-route-map-link" href={mapsHref(origin)} target="_blank" rel="noreferrer">
          {txt.openOriginMap}
        </a>
      </div>
    </div>
  );

  return (
    <div className="hero-trace-map hero-trace-map--clear flex items-center justify-center" aria-label={txt.routeTitle}>
      <div className="hero-trace-map__globe" aria-label={`${origin.city} a ${tap.city}`}>
        <Globe3dMap
          theme="dark"
          points={[
            { city: origin.city, country: origin.country, lat: origin.lat, lng: origin.lng, scans: 1, status: "origin", vertical: "origen" },
            { city: tap.city, country: tap.country, lat: tap.lat, lng: tap.lng, scans: 1, status: "tap", vertical: "cliente" },
          ]}
          routes={[{
            fromLat: origin.lat,
            fromLng: origin.lng,
            toLat: tap.lat,
            toLng: tap.lng,
            tone: "success",
            label: `${origin.city} -> ${tap.city} / ${formattedDistance} km`,
          }]}
          width={480}
          height={330}
          className="border-0 bg-transparent shadow-none"
        />
      </div>
      <svg viewBox="0 0 100 100" role="img" aria-label={`${origin.city} a ${tap.city}`}>
        <defs>
          <linearGradient id="hero-route-gradient" x1="0" x2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity=".18" />
            <stop offset="45%" stopColor="#67e8f9" stopOpacity=".96" />
            <stop offset="100%" stopColor="#34d399" stopOpacity=".22" />
          </linearGradient>
          <radialGradient id="hero-node-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity=".75" />
            <stop offset="55%" stopColor="#22d3ee" stopOpacity=".2" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <filter id="hero-route-soft-glow">
            <feGaussianBlur stdDeviation="1.8" />
          </filter>
        </defs>
        <rect className="hero-trace-map__water" x="0" y="0" width="100" height="100" rx="4" />
        <g className="hero-trace-map__grid">
          {[14, 28, 42, 56, 70, 84].map((value) => (
            <path key={`grid-v-${value}`} d={`M${value} 6 V94`} />
          ))}
          {[16, 32, 48, 64, 80].map((value) => (
            <path key={`grid-h-${value}`} d={`M6 ${value} H94`} />
          ))}
        </g>
        <g>
          <path className="hero-trace-map__land" d="M8 72 C18 58 28 54 43 58 C58 62 68 51 82 45 C91 41 96 48 91 58 C82 76 64 85 43 82 C27 80 18 83 8 72Z" />
          <path className="hero-trace-map__land hero-trace-map__land--europe" d="M48 21 C58 14 75 16 86 25 C94 32 88 43 76 40 C66 38 63 47 54 45 C43 42 38 29 48 21Z" />
          <path className="hero-trace-map__coast" d="M10 68 C24 58 34 59 50 62 C66 65 72 52 91 50" />
          <path className="hero-trace-map__road" d="M12 38 C26 29 42 31 55 38 C68 45 78 43 91 34" />
          <path className="hero-trace-map__road hero-trace-map__road--secondary" d="M16 84 C32 68 49 67 66 72 C78 75 86 70 94 61" />
        </g>
        {cityDots.map((dot, index) => (
          <g key={`${dot.label}-${index}`}>
            <circle className="hero-trace-map__city" cx={dot.x} cy={dot.y} r="0.85" />
            <text className="hero-trace-map__label" x={dot.x + 2.2} y={dot.y + 1.4}>{dot.label}</text>
          </g>
        ))}
        <path
          className="hero-trace-map__route-shadow"
          d={`M${originPoint.x.toFixed(1)} ${originPoint.y.toFixed(1)} Q${routeMidX.toFixed(1)} ${routeMidY.toFixed(1)} ${tapPoint.x.toFixed(1)} ${tapPoint.y.toFixed(1)}`}
        />
        <path
          className="hero-trace-map__route"
          d={`M${originPoint.x.toFixed(1)} ${originPoint.y.toFixed(1)} Q${routeMidX.toFixed(1)} ${routeMidY.toFixed(1)} ${tapPoint.x.toFixed(1)} ${tapPoint.y.toFixed(1)}`}
        />
        <circle cx={originPoint.x} cy={originPoint.y} r="7.4" fill="url(#hero-node-glow)" filter="url(#hero-route-soft-glow)" />
        <circle cx={tapPoint.x} cy={tapPoint.y} r="8.6" fill="#34d399" opacity=".12" filter="url(#hero-route-soft-glow)" />
        <circle className="hero-trace-map__origin" cx={originPoint.x} cy={originPoint.y} r="1.7" />
        <circle className="hero-trace-map__tap" cx={tapPoint.x} cy={tapPoint.y} r="2.05" />
        <circle cx={tapPoint.x} cy={tapPoint.y} r="5.6" fill="none" stroke="#34d399" strokeWidth=".45" opacity=".42" />
      </svg>
      <div className="hero-map-intel">
        <p>{routeHeadline}</p>
        <strong>{origin.city} / {tap.city}</strong>
        <span>{evidenceCopy}</span>
      </div>
      <div className="hero-route-summary-card">
        <div className="hero-route-summary-grid">
          <span>
            <small>{txt.originMap}</small>
            <strong>{origin.city}</strong>
          </span>
          <span>
            <small>{tapCopy}</small>
            <strong>{tap.city}</strong>
          </span>
          <span>
            <small>{distanceCopy}</small>
            <strong>{formattedDistance} km</strong>
          </span>
        </div>
        <a className="hero-route-map-link" href={mapsHref(origin)} target="_blank" rel="noreferrer">
          {txt.openOriginMap}
        </a>
      </div>
    </div>
  );
}

const heroPrimeProducts: Record<Vertical, {
  kind: "wine" | "bracelet" | "perfume" | "seeds";
  seal: string;
  detail: string;
  accent: string;
}> = {
  seeds: { kind: "seeds", seal: "LOTE", detail: "ORIGEN", accent: "#84cc16" },
  bracelet: { kind: "bracelet", seal: "VIP", detail: "UID OK", accent: "#2dd4bf" },
  pharma: { kind: "perfume", seal: "AUTH", detail: "LOTE OK", accent: "#38bdf8" },
  perfume: { kind: "perfume", seal: "AUTH", detail: "LOTE OK", accent: "#a78bfa" },
  wine: { kind: "wine", seal: "NFC TT", detail: "SUN OK", accent: "#22d3ee" },
  bottle: { kind: "wine", seal: "NFC QR", detail: "RETORNO", accent: "#38bdf8" },
  luxury: { kind: "bracelet", seal: "LUJO", detail: "OWNER", accent: "#c084fc" },
  sneaker: { kind: "bracelet", seal: "DROP", detail: "OWNER", accent: "#a78bfa" },
  logistics: { kind: "seeds", seal: "LOTE", detail: "ORIGEN", accent: "#a3e635" },
  electronics: { kind: "bracelet", seal: "DROP", detail: "OWNER", accent: "#818cf8" },
  textile: { kind: "bracelet", seal: "DROP", detail: "OWNER", accent: "#64748b" },
};

const heroRealAssets: Record<Vertical, {
  imageUrl: string;
  alt: string;
  bank: string;
  sourceLabel: string;
  sourceUrl: string;
}> = {
  seeds: {
    imageUrl: "/sdk/verticals/agro-nfc-qr-traceability.webp",
    alt: "Bolsa de semillas de Agro & Alimentos con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  bracelet: {
    imageUrl: "/sdk/verticals/events-nfc-qr-access.webp",
    alt: "Brazalete y app de Eventos & Tickets con tags NFC/QR nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  pharma: {
    imageUrl: "/sdk/pharma-authentication-pack.webp",
    alt: "Envase de medicamento y app de Pharma & Salud con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  perfume: {
    imageUrl: "/sdk/verticals/cosmetics-nfc-qr-tamper.webp",
    alt: "Envase de perfume premium de Belleza & Cosmética con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  wine: {
    imageUrl: "/sdk/verticals/wine-spirits-424-tt.png",
    alt: "Botella premium de Vinos & Spirits con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  bottle: {
    imageUrl: "/sdk/verticals/beverages-bottle-nfc-qr.png",
    alt: "Botella de bebida y refresco con tag NFC/QR nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  luxury: {
    imageUrl: "/sdk/verticals/luxury-nfc-qr-tamper.webp",
    alt: "Caja y tarjeta premium de Retail & Lujo con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  sneaker: {
    imageUrl: "/sdk/verticals/sneaker-nfc-qr-tamper.png",
    alt: "Zapatillas premium de colección con chip NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  logistics: {
    imageUrl: "/sdk/verticals/logistics-uhf-nfc-qr.webp",
    alt: "Cajas de Logística & Cadena de Frío con tags UHF/NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  electronics: {
    imageUrl: "/sdk/verticals/electronics-warranty-nfc-qr.webp",
    alt: "Dispositivo electrónico con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  textile: {
    imageUrl: "/sdk/verticals/textile-dpp-nfc-qr.webp",
    alt: "Prenda de vestir y pasaporte digital textil con tag NFC/QR nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
};

function HeroPrimeProduct({ active, product }: { active: Vertical; product: string }) {
  const spec = heroPrimeProducts[active];
  const uid = `hero-prime-${active}`;
  const productLine = product.length > 22 ? `${product.slice(0, 20)}...` : product;

  return (
    <svg className={`hero-prime-product hero-prime-product--${spec.kind}`} viewBox="0 0 360 420" aria-hidden="true" focusable="false">
      <defs>
        <filter id={`${uid}-shadow`} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="20" stdDeviation="18" floodColor="#020617" floodOpacity="0.5" />
        </filter>
        <filter id={`${uid}-glow`} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor={spec.accent} floodOpacity="0.38" />
        </filter>
        <linearGradient id={`${uid}-holo`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
          <stop offset="48%" stopColor="#a78bfa" stopOpacity="0.86" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.9" />
          <stop offset="48%" stopColor="#67e8f9" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.82" />
        </linearGradient>
        <linearGradient id={`${uid}-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="46%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id={`${uid}-paper`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="58%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#c7d2fe" />
        </linearGradient>
        <radialGradient id={`${uid}-floor`} cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor={spec.accent} stopOpacity="0.36" />
          <stop offset="64%" stopColor="#0f172a" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="180" cy="366" rx="142" ry="32" fill={`url(#${uid}-floor)`} />
      <path d="M48 338 C110 312 248 314 312 340 L270 375 C218 392 134 392 90 374 Z" fill="#020617" opacity="0.34" />
      <path d="M76 348 C126 329 234 329 284 348" fill="none" stroke={spec.accent} strokeWidth="2" strokeLinecap="round" opacity="0.24" />
      <ellipse cx="180" cy="214" rx="156" ry="148" fill={spec.accent} opacity="0.06" />

      {spec.kind === "wine" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M158 35h44l7 60c2 15 13 25 25 35 13 12 20 29 20 51v139c0 30-20 50-50 50h-48c-30 0-50-20-50-50V181c0-22 7-39 20-51 12-10 23-20 25-35l7-60Z" fill="#7f1d1d" />
          <path d="M158 35h44l5 50h-54l5-50Z" fill="#f59e0b" />
          <path d="M140 119c15-15 28-22 40-22s25 7 40 22c-11 13-69 13-80 0Z" fill="#14532d" opacity="0.9" />
          <path d="M211 112c22 17 35 38 35 69v132c0 25-16 43-41 43h-16c19-23 22-68 22-135V112Z" fill="#020617" opacity="0.26" />
          <path d="M123 156c17-20 35-30 57-30 25 0 45 10 61 30v45H123v-45Z" fill="#450a0a" opacity="0.36" />
          <rect x="129" y="211" width="102" height="82" rx="11" fill={`url(#${uid}-paper)`} />
          <rect x="141" y="224" width="78" height="12" rx="6" fill={`url(#${uid}-holo)`} opacity="0.72" />
          <text x="180" y="252" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="900" letterSpacing="2">GRAN RESERVA</text>
          <text x="180" y="271" textAnchor="middle" fill="#0f172a" fontSize="15" fontWeight="900" letterSpacing="2">MALBEC</text>
          <path d="M149 53c-13 48-17 116-14 205" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.1" />
          <path d="M134 60c11-9 29-11 38-2 10 10 2 25-12 22-14-3-21-9-26-20Z" fill="#fde68a" opacity="0.54" />
        </g>
      ) : null}

      {spec.kind === "bracelet" ? (
        <g filter={`url(#${uid}-shadow)`} transform="rotate(-8 180 214)">
          <path d="M48 198c48-42 216-62 262-11 21 23 4 60-29 64-67 10-152 28-223-4-28-13-32-31-10-49Z" fill="#14b8a6" />
          <path d="M68 197c70 19 157 4 232 0 14 18 0 44-24 48-61 10-149 25-214-5-25-11-22-30 6-43Z" fill={`url(#${uid}-holo)`} opacity="0.66" />
          <path d="M63 217c72 23 156 12 230 4" fill="none" stroke="#ecfeff" strokeWidth="7" strokeLinecap="round" opacity="0.2" />
          <rect x="144" y="187" width="78" height="42" rx="10" fill="#0f172a" />
          <text x="183" y="215" textAnchor="middle" fill="#ecfeff" fontSize="17" fontWeight="900" letterSpacing="2">VIP</text>
          {[83, 112, 141].map((cx) => <circle key={cx} cx={cx} cy="218" r="7" fill="#0f172a" opacity="0.74" />)}
          <circle cx="278" cy="205" r="21" fill="#c4b5fd" opacity="0.84" />
          <circle cx="278" cy="205" r="11" fill="#f8fafc" opacity="0.42" />
        </g>
      ) : null}

      {spec.kind === "perfume" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <rect x="153" y="48" width="54" height="46" rx="8" fill={`url(#${uid}-metal)`} />
          <rect x="140" y="28" width="80" height="29" rx="8" fill="#f8fafc" />
          <path d="M110 116c0-22 18-40 40-40h60c22 0 40 18 40 40v194c0 25-19 44-44 44h-52c-25 0-44-19-44-44V116Z" fill={`url(#${uid}-glass)`} />
          <path d="M211 82c24 8 39 26 39 53v174c0 25-19 45-44 45h-17c19-26 24-78 22-272Z" fill="#020617" opacity="0.16" />
          <path d="M126 139c0-20 17-37 37-37h34c21 0 38 17 38 37v160c0 15-12 28-28 28h-54c-16 0-27-13-27-28V139Z" fill="#312e81" opacity="0.32" />
          <rect x="131" y="193" width="98" height="76" rx="12" fill="transparent" stroke="#e0e7ff" strokeWidth="2" opacity="0.46" />
          <rect x="144" y="206" width="72" height="9" rx="5" fill={`url(#${uid}-holo)`} opacity="0.6" />
          <text x="180" y="238" textAnchor="middle" fill="#f8fafc" fontSize="14" fontWeight="900" letterSpacing="2">PERFUME</text>
          <text x="180" y="255" textAnchor="middle" fill="#e0e7ff" fontSize="8" fontWeight="900" letterSpacing="1.2">ORIGEN VALIDADO</text>
          <path d="M136 126c-12 61-9 135 8 194" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.18" />
        </g>
      ) : null}

      {spec.kind === "seeds" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M105 75h150c14 0 25 11 25 25v229c0 14-11 25-25 25H105c-14 0-25-11-25-25V100c0-14 11-25 25-25Z" fill="#84cc16" />
          <path d="M105 75h150c14 0 25 11 25 25v229c0 14-11 25-25 25H105c-14 0-25-11-25-25V100c0-14 11-25 25-25Z" fill={`url(#${uid}-holo)`} opacity="0.34" />
          <path d="M248 82c18 4 32 16 32 34v213c0 14-11 25-25 25h-25c14-27 18-80 18-162V82Z" fill="#14532d" opacity="0.2" />
          <rect x="100" y="105" width="160" height="52" rx="12" fill="#f0fdf4" />
          <text x="180" y="138" textAnchor="middle" fill="#166534" fontSize="13" fontWeight="900" letterSpacing="2">SEMILLAS</text>
          <rect x="119" y="170" width="122" height="34" rx="10" fill="#14532d" opacity="0.22" />
          <text x="180" y="192" textAnchor="middle" fill="#f0fdf4" fontSize="10" fontWeight="900" letterSpacing="1.6">TRAZA + ORIGEN</text>
          <path d="M109 289h142" stroke="#166534" strokeWidth="2" strokeDasharray="5 7" opacity="0.44" />
          <text x="180" y="317" textAnchor="middle" fill="#14532d" fontSize="13" fontWeight="900" letterSpacing="1.5">LOTE A12</text>
          {[132, 163, 197, 225].map((cx, index) => (
            <path key={cx} d={`M${cx} ${235 + (index % 2) * 14}c18-18 35-8 30 11-20 7-32 1-30-11Z`} fill="#facc15" opacity="0.84" />
          ))}
          <path d="M99 91h162" stroke="#ecfccb" strokeWidth="8" strokeLinecap="round" opacity="0.5" />
        </g>
      ) : null}

      <g className="hero-prime-product-seal" transform="translate(180 190) rotate(-7)">
        <rect x="-136" y="-42" width="272" height="84" rx="25" fill="#020617" opacity="0.38" filter={`url(#${uid}-glow)`} />
        <path d="M-104-32H0v64h-104c-12 0-22-10-22-22v-20c0-12 10-22 22-22Z" fill="#071827" stroke={spec.accent} strokeWidth="2" />
        <path d="M0-32h104c12 0 22 10 22 22v20c0 12-10 22-22 22H0v-64Z" fill="#071827" stroke={spec.accent} strokeWidth="2" />
        <path d="M-92-4c12-15 30-15 42 0M-84 8c8-9 18-9 26 0M-74 20c4-4 8-4 12 0" fill="none" stroke="#ecfeff" strokeWidth="4" strokeLinecap="round" opacity="0.84" />
        <text x="-38" y="-6" textAnchor="middle" fill="#ecfeff" fontSize="17" fontWeight="900" letterSpacing="2">NFC</text>
        <text x="-38" y="15" textAnchor="middle" fill="#a5f3fc" fontSize="8" fontWeight="900" letterSpacing="1.6">FISICO</text>
        <text x="58" y="-5" textAnchor="middle" fill="#ecfeff" fontSize="14" fontWeight="900" letterSpacing="1.8">{spec.seal}</text>
        <text x="58" y="15" textAnchor="middle" fill="#a5f3fc" fontSize="8" fontWeight="900" letterSpacing="1.4">{spec.detail}</text>
        <path d="M0-29v58" stroke="#ecfeff" strokeWidth="2" strokeDasharray="4 5" opacity="0.62" />
      </g>

      <g transform="translate(274 62)">
        <circle cx="0" cy="0" r="27" fill="#082f49" stroke={spec.accent} strokeWidth="2" />
        <text x="0" y="4" textAnchor="middle" fill="#ecfeff" fontSize="12" fontWeight="900">NFC</text>
      </g>
      <text x="180" y="399" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="800">{productLine}</text>
    </svg>
  );
}

function HeroProductVisual({ active, product }: { active: Vertical; product: string }) {
  const [threeReady, setThreeReady] = useState(false);
  const threeActive: any = active === "pharma" ? "cosmetics" : active;

  return (
    <div className="hero-product-visual-shell">
      {!threeReady ? <HeroPrimeProduct active={active} product={product} /> : null}
      <HeroThreeStage key={active} active={threeActive} product={product} onReady={() => setThreeReady(true)} />
    </div>
  );
}

function trustMetricValues(active: Vertical, distance: number) {
  const distanceScore = clamp(Math.round(64 + Math.min(distance, 2200) / 42), 70, 96);
  if (active === "wine") return [98, distanceScore, 91];
  if (active === "bracelet") return [86, 78, 84];
  if (active === "pharma") return [97, distanceScore, 94];
  if (active === "perfume") return [95, 82, 88];
  if (active === "seeds") return [92, 85, 90];
  if (active === "sneaker") return [96, 84, 93];
  if (active === "logistics") return [89, 79, 87];
  if (active === "electronics") return [94, 80, 89];
  if (active === "textile") return [95, 86, 92];
  return [90, 80, 90];
}

function HeroEvidenceChart({
  active,
  distance,
  numberLocale,
  txt,
}: {
  active: Vertical;
  distance: number;
  numberLocale: string;
  txt: Pick<(typeof labels)["es-AR"], "evidenceChart" | "metrics">;
}) {
  const values = trustMetricValues(active, distance);
  const metricLabels = [txt.metrics.authenticity, txt.metrics.traceability, txt.metrics.commercial];
  const polyline = values
    .map((value, index) => `${22 + index * 48},${92 - value * 0.62}`)
    .join(" ");

  return (
    <div className="hero-evidence-chart" aria-label={txt.evidenceChart}>
      <div className="hero-evidence-chart-head">
        <span>{txt.evidenceChart}</span>
        <strong>{distance.toLocaleString(numberLocale)} km</strong>
      </div>
      <svg viewBox="0 0 140 58" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`hero-evidence-line-${active}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="58%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <path d="M10 48H132M10 30H132M10 12H132" />
        <polyline points={polyline} />
        {values.map((value, index) => (
          <circle key={metricLabels[index]} cx={22 + index * 48} cy={92 - value * 0.62} r="3.1" />
        ))}
      </svg>
      <div className="hero-evidence-bars">
        {values.map((value, index) => (
          <div key={metricLabels[index]}>
            <span>{metricLabels[index]}</span>
            <em>
              <i style={{ width: `${value}%` }} />
            </em>
            <strong>{value}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroPassportPhone({
  active,
  data,
  distance,
  numberLocale,
  txt,
}: {
  active: Vertical;
  data: Scene;
  distance: number;
  numberLocale: string;
  txt: Pick<(typeof labels)["es-AR"], "phoneLabel" | "labels">;
}) {
  const asset = heroRealAssets[active];
  const actionLine = data.nextAction.length > 46 ? `${data.nextAction.slice(0, 44)}...` : data.nextAction;

  return (
    <div className={`hero-passport-phone hero-passport-phone--${active}`} aria-hidden="true">
      <span className="hero-passport-notch" />
      <div className="hero-passport-thumb">
        {asset ? <img src={asset.imageUrl} alt="" loading="eager" /> : <HeroProductVisual active={active} product={data.product} />}
      </div>
      <div className="hero-passport-body">
        <span>{txt.phoneLabel}</span>
        <strong>{data.product}</strong>
        <dl>
          <div>
            <dt>{txt.labels.uid}</dt>
            <dd>{data.uid}</dd>
          </div>
          <div>
            <dt>{txt.labels.distance}</dt>
            <dd>{distance.toLocaleString(numberLocale)} km</dd>
          </div>
        </dl>
        <p><i />{data.result}</p>
        <em>{actionLine}</em>
      </div>
    </div>
  );
}

function HeroProductShowcase({
  active,
  data,
  distance,
  numberLocale,
  txt,
}: {
  active: Vertical;
  data: Scene;
  distance: number;
  numberLocale: string;
  txt: Pick<(typeof labels)["es-AR"], "assetBank" | "realAsset" | "renderFallback" | "evidenceChart" | "metrics" | "phoneLabel" | "labels">;
}) {
  const asset = heroRealAssets[active];

  return (
    <div className={`hero-asset-showcase hero-asset-showcase--${active}`}>
      <div className="hero-asset-media">
        {asset ? (
          <div className="hero-asset-photo">
            <img className="hero-real-asset" src={asset.imageUrl} alt={asset.alt} loading="eager" />
            <span className="hero-asset-brand-mask" aria-hidden="true" />
            <span className="hero-asset-label-cover" aria-hidden="true">
              <em>nexID</em>
              <strong>{data.product}</strong>
              <small>{data.profile}</small>
            </span>
          </div>
        ) : (
          <div className="hero-asset-photo hero-asset-photo--fallback">
            <HeroProductVisual active={active} product={data.product} />
          </div>
        )}
        <span className="hero-asset-nfc">NFC</span>
        <span className="hero-asset-status">{data.profile}</span>
        <HeroPassportPhone active={active} data={data} distance={distance} numberLocale={numberLocale} txt={txt} />
      </div>
      <div className="hero-asset-copy">
        <span>{txt.assetBank} / {asset ? txt.realAsset : txt.renderFallback}</span>
        <strong>{data.product}</strong>
        <p>{data.batch} - {data.security}</p>
      </div>
      <HeroEvidenceChart active={active} distance={distance} numberLocale={numberLocale} txt={txt} />
    </div>
  );
}

export function HeroScene({ locale }: { locale: AppLocale }) {
  const [selectedVertical, setSelectedVertical] = useState<HeroSelectorKey>("wine");
  const [tapIndex, setTapIndex] = useState(0);
  const txt = labels[locale] || labels["es-AR"];
  const active = selectedVertical;
  const data = useMemo(() => txt.items[active], [txt, active]);
  const tap = tapLocations[tapIndex % tapLocations.length];
  const distance = haversineKm(data.origin, tap);
  const numberLocale = localeName(locale);

  useEffect(() => {
    setTapIndex(Math.floor(Math.random() * tapLocations.length));
  }, []);

  const proofRows = [
    { label: txt.labels.product, value: data.product },
    { label: txt.labels.origin, value: `${data.origin.city}, ${data.origin.country}` },
    { label: txt.labels.tap, value: `${tap.city}, ${tap.country} - ${tap.label}` },
    { label: txt.labels.distance, value: `${distance.toLocaleString(numberLocale)} km` },
    { label: txt.labels.uid, value: data.uid },
    { label: txt.labels.batch, value: data.batch },
    { label: txt.labels.security, value: data.security },
  ];
  const commerceRows = [
    { label: txt.labels.nextAction, value: data.nextAction },
    { label: txt.labels.marketplace, value: data.marketplace },
    { label: txt.labels.loyalty, value: data.loyalty },
    { label: txt.labels.businessValue, value: data.businessValue },
  ];

  return (
    <div>
      <div className="hero-scene rounded-2xl border border-white/10 p-4 md:p-5">
        <div className="hero-scene-topline flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">{txt.selectorTitle}</p>
          <button suppressHydrationWarning type="button" onClick={() => setTapIndex((current) => current + 1)} className="hero-scene-swap">
            {txt.swapTap}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {platformVerticals.map((item) => (
            <button
              suppressHydrationWarning
              key={item.id}
              type="button"
              onClick={() => setSelectedVertical(item.demoVertical)}
              className={`hero-vertical-pill ${selectedVertical === item.demoVertical ? "hero-vertical-pill--active" : ""}`}
              title={verticalLabel(item, locale)}
            >
              {item.shortTitle}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="hero-scene-stage-card rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="hero-scene-action text-xs font-semibold text-slate-200">{data.action}</p>
                <p className="mt-1 text-[11px] text-slate-400">{txt.liveTap}: {tap.city}, {tap.country}</p>
              </div>
              <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100">{data.profile}</span>
            </div>
            <div className={`hero-product-stage hero-product-stage--${active} mt-3`}>
              <div className="hero-object-frame hero-object-frame--split">
                <div className="hero-object-map-pane">
                  <HeroTraceMap origin={data.origin} tap={tap} distance={distance} numberLocale={numberLocale} txt={txt} />
                </div>
                <div className="hero-object-product-pane">
                  <HeroProductShowcase active={active} data={data} distance={distance} numberLocale={numberLocale} txt={txt} />
                </div>
              </div>
              <div className="hero-scene-phone">
                <span />
                <em>{data.phoneTag}</em>
                <strong>{data.result}</strong>
                <small>{tap.city} - {distance.toLocaleString(numberLocale)} km</small>
              </div>
            </div>
            <div className="hero-flow-steps mt-3">
              {data.steps.map((step, index) => (
                <div key={step} className="hero-flow-step">
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
            <div className="hero-commercial-rail mt-3">
              <span>{txt.commercialRail}</span>
              <div>
                {txt.valuePills.map((pill) => (
                  <em key={pill}>{pill}</em>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-scene-result-card rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
            <p className="hero-scene-result-label text-[11px] uppercase tracking-[0.14em] text-cyan-200">{txt.phoneLabel}</p>
            <p className="hero-scene-result-state mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-300">{data.result}</p>
            <div className="hero-passport-summary mt-3">
              <span>{data.profile}</span>
              <strong>{data.product}</strong>
              <em>{tap.city} - {distance.toLocaleString(numberLocale)} km</em>
            </div>
            <div className="hero-output-grid hero-output-grid--proof mt-3">
              {proofRows.map((item) => (
                <div key={item.label} className="hero-output-row">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="hero-commerce-stack mt-3">
              {commerceRows.map((item) => (
                <article key={item.label} className="hero-commerce-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
            <div className="hero-result-explain mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-300">{txt.whatHappened}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{data.action}</p>
            </div>
          </div>
        </div>

        <p className="hero-scene-microcopy mt-3 text-xs text-slate-300">{txt.microcopy}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {platformVerticals.map((item) => (
          <span key={item.id} className="hero-scene-band rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
            {verticalLabel(item, locale)}
          </span>
        ))}
      </div>
    </div>
  );
}
