import type { WebCopy } from "../types";
import { esAR } from "./es-AR";

export const en: WebCopy = {
  ...esAR,
  nav: { product: "Product", pricing: "Pricing", reseller: "Resellers", docs: "Docs", cta: "Dashboard", requestDemo: "Request demo", by: "by" },
  hero: { ...esAR.hero, title: "We do more than sell NFC tags: we operate the authentication and traceability platform.", body: "From NTAG215 campaign rails to NTAG 424 DNA TagTamper anti-counterfeit deployments, powered by an API gateway, scan intelligence and a premium tokenization-ready identity layer.", primary: "Request enterprise demo", secondary: "View architecture", tertiary: "View pricing" },
  what: { ...esAR.what, eyebrow: "What the platform does", title: "Encoded tags + API gateway + anti-fraud + multi-tenant SaaS", description: "Built for brands, resellers and international operations with strict batch control." },
  useCases: { ...esAR.useCases, eyebrow: "Verticals", title: "Use-cases with direct ROI", description: "Designed for sectors where fraud impacts margin, trust and compliance." },
  reseller: { ...esAR.reseller, eyebrow: "Channel", title: "Reseller / white-label model from day one" },
  secure: { ...esAR.secure, eyebrow: "Why 424 TagTamper", title: "Secure layer for wine, cosmetics and pharma" },
  roi: { ...esAR.roi, title: "Clear economics for leadership and sales" },
  credibility: { ...esAR.credibility, title: "Investor-ready credibility for enterprise buyers" },
  cta: { ...esAR.cta, title: "Ready for an enterprise pilot", primary: "Book demo", secondary: "Talk to sales" },
  auth: { loginTitle: "Dashboard access", loginBody: "Sign in to manage tenants, batches and fraud analytics.", registerTitle: "Request demo", registerBody: "Submit your details to start an enterprise pilot.", company: "Company", email: "Work email", password: "Password" },
  docs: { title: "API quickstart", list: esAR.docs.list },
};
