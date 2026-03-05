export type WebLocale = "es-AR" | "pt-BR" | "en";

export type WebCopy = {
  nav: { product: string; pricing: string; reseller: string; docs: string; cta: string; requestDemo: string; by: string };
  hero: {
    badge: string;
    title: string;
    body: string;
    primary: string;
    secondary: string;
    tertiary: string;
    stats: Array<{ label: string; value: string; delta: string; tone?: "good" | "warn" | "danger" }>;
  };
  what: { eyebrow: string; title: string; description: string; cards: Array<{ title: string; body: string }> };
  plans: { eyebrow: string; title: string; description: string; cards: Array<{ name: string; badge: string; price: string; body: string; bullets: string[]; tone: "cyan" | "amber" }> };
  secure: { eyebrow: string; title: string; description: string; bullets: string[] };
  useCases: { eyebrow: string; title: string; description: string; cards: Array<{ title: string; body: string }> };
  reseller: { eyebrow: string; title: string; description: string; cards: Array<{ title: string; body: string }> };
  api: { eyebrow: string; title: string; description: string; bullets: string[] };
  identity: { eyebrow: string; title: string; description: string; bullets: string[] };
  roi: { eyebrow: string; title: string; description: string; metrics: Array<{ label: string; value: string; detail: string }> };
  credibility: { eyebrow: string; title: string; description: string; items: string[] };
  cta: { title: string; body: string; primary: string; secondary: string };
  auth: { loginTitle: string; loginBody: string; registerTitle: string; registerBody: string; company: string; email: string; password: string };
  docs: { title: string; list: string[] };
};
