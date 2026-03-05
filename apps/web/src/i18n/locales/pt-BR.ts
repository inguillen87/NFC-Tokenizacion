import type { WebCopy } from "../types";
import { esAR } from "./es-AR";

export const ptBR: WebCopy = {
  ...esAR,
  nav: { product: "Produto", pricing: "Planos", reseller: "Revendedores", docs: "Docs", cta: "Painel", requestDemo: "Solicitar demo", by: "by" },
  hero: { ...esAR.hero, title: "Não vendemos apenas tags NFC: operamos a plataforma de autenticação e rastreabilidade.", body: "De trilhas NTAG215 para campanhas até NTAG 424 DNA TagTamper para anti-fraude crítico, com gateway API, scan intelligence e camada premium tokenization-ready.", primary: "Solicitar demo enterprise", secondary: "Ver arquitetura", tertiary: "Ver preços" },
  what: { ...esAR.what, eyebrow: "O que a plataforma faz", description: "Infraestrutura para marcas, revendedores e operações internacionais com controle por lote." },
  useCases: { ...esAR.useCases, eyebrow: "Verticais", title: "Casos de uso com ROI direto" },
  reseller: { ...esAR.reseller, title: "Modelo revendedor / white-label desde o início" },
  cta: { ...esAR.cta, title: "Pronto para um piloto enterprise", primary: "Agendar demo", secondary: "Falar com vendas" },
  auth: { loginTitle: "Acesso ao painel", loginBody: "Entre para gerenciar tenants, lotes e analytics antifraude.", registerTitle: "Solicitar demo", registerBody: "Envie seus dados para iniciar um piloto enterprise.", company: "Empresa", email: "Email corporativo", password: "Senha" },
};
