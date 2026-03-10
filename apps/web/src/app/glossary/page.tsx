import { Card, SectionHeading } from "@product/ui";
import { BackLink } from "../../components/back-link";
import { getWebI18n } from "../../lib/locale";

type GlossaryCopy = {
  eyebrow: string;
  title: string;
  description: string;
  approvedTitle: string;
  approved: Array<{ term: string; def: string }>;
  bannedTitle: string;
  banned: Array<{ term: string; why: string }>;
  canonicalTitle: string;
  canonical: string[];
  rulesTitle: string;
  rules: string[];
};

const copyByLocale: Record<"es-AR" | "pt-BR" | "en", GlossaryCopy> = {
  "es-AR": {
    eyebrow: "Glosario operativo",
    title: "Source of truth de marca y producto",
    description: "Definiciones canónicas para web, deck, demos, ventas y documentación técnica-comercial, alineadas con GS1 Digital Link y perfiles NXP.",
    approvedTitle: "Términos aprobados",
    approved: [
      { term: "Identidad física verificable", def: "Categoría madre: objeto físico + identidad digital + validación operativa." },
      { term: "Verify", def: "Prueba autenticidad, estado y validez de una unidad o credencial." },
      { term: "Passport", def: "Gemelo digital con lote, origen, historial, canal, warranty y ownership." },
      { term: "Rights", def: "Derechos digitales: acceso, titularidad, vouchers, perks, garantía, transferencia." },
      { term: "QR fallback", def: "Mismo backend, otro carrier para cobertura y continuidad de adopción." },
      { term: "Basic / NTAG215", def: "Interacción y escala: activaciones, acceso general, serialización y warranty." },
      { term: "Secure / NTAG 424 DNA (TagTamper)", def: "Confianza fuerte: autenticidad, tamper, vouchers, documentos y casos sensibles." },
    ],
    bannedTitle: "Términos prohibidos o restringidos",
    banned: [
      { term: "Empresa de chips NFC", why: "Reduce la categoría a hardware commodity." },
      { term: "Empresa de tokenización de vinos", why: "Achica el mercado y confunde la propuesta." },
      { term: "Blockchain-first", why: "Desordena el mensaje principal para B2B y gobierno." },
      { term: "Imposible de clonar", why: "Claim absoluto no defendible comercialmente." },
      { term: "Cold-chain (sin sensor)", why: "No prometer sensing si no existe integración real." },
    ],
    canonicalTitle: "Frases canónicas",
    canonical: [
      "Convertimos productos, credenciales y documentos en identidades digitales verificables.",
      "Antifraude protege la verdad del objeto. Tokenización digitaliza derechos sobre ese objeto.",
      "Basic para interacción y escala. Secure para prueba y confianza.",
      "La tokenización no es el inicio: primero identidad física verificable, después derechos digitales.",
    ],
    rulesTitle: "Reglas de uso editorial",
    rules: [
      "Siempre explicar en orden: Verify → Passport → Rights.",
      "No usar tokenización en hero como categoría principal.",
      "No mezclar una activación aislada con plataforma de validación.",
      "Si un dato es demo, debe estar marcado como demo no auditada.",
      "Reseller: vender canal y resultados, no jerga de arquitectura interna.",
    ],
  },
  "pt-BR": {
    eyebrow: "Glossário operacional",
    title: "Source of truth de marca e produto",
    description: "Definições canônicas para site, deck, demos, vendas e documentação, alinhadas a GS1 Digital Link e perfis NXP.",
    approvedTitle: "Termos aprovados",
    approved: [
      { term: "Identidade física verificável", def: "Categoria principal: objeto físico + identidade digital + validação." },
      { term: "Verify", def: "Valida autenticidade, estado e validade operacional." },
      { term: "Passport", def: "Gêmeo digital com lote, origem, histórico, canal, garantia e ownership." },
      { term: "Rights", def: "Direitos digitais: acesso, titularidade, vouchers, perks, garantia e transferência." },
      { term: "QR fallback", def: "Mesmo backend, outro carrier para cobertura e escala." },
      { term: "Basic / NTAG215", def: "Interação e volume com serialização e garantia básica." },
      { term: "Secure / NTAG 424 DNA (TagTamper)", def: "Confiança forte para autenticidade, tamper e casos sensíveis." },
    ],
    bannedTitle: "Termos proibidos ou restritos",
    banned: [
      { term: "Empresa de chips NFC", why: "Reduz a proposta para commodity." },
      { term: "Empresa de tokenização de vinhos", why: "Encolhe o mercado e confunde." },
      { term: "Blockchain-first", why: "Polui a mensagem principal." },
      { term: "Impossível de clonar", why: "Claim absoluto sem sustentação robusta." },
      { term: "Cold-chain (sem sensor)", why: "Não prometer sensing sem integração real." },
    ],
    canonicalTitle: "Frases canônicas",
    canonical: [
      "Convertemos produtos, credenciais e documentos em identidades digitais verificáveis.",
      "Antifraude protege a verdade do objeto. Tokenização digitaliza direitos sobre o objeto.",
      "Basic para interação e escala. Secure para prova e confiança.",
      "Tokenização não é o começo: antes vem a identidade física verificável.",
    ],
    rulesTitle: "Regras editoriais",
    rules: [
      "Sempre explicar: Verify → Passport → Rights.",
      "Não usar tokenização como categoria do hero.",
      "Não confundir ativação isolada com plataforma.",
      "Dados demo devem estar marcados como não auditados.",
      "Revenda: foco em canal e resultado, não jargão interno.",
    ],
  },
  en: {
    eyebrow: "Operational glossary",
    title: "Brand and product source of truth",
    description: "Canonical definitions for website, deck, demos, sales and product documentation, aligned with GS1 Digital Link and NXP profiles.",
    approvedTitle: "Approved terms",
    approved: [
      { term: "Verifiable physical identity", def: "Core category: physical object + digital identity + validation layer." },
      { term: "Verify", def: "Proves authenticity, state and policy validity." },
      { term: "Passport", def: "Digital twin with batch, origin, lifecycle, warranty and ownership." },
      { term: "Rights", def: "Digital rights such as access, ownership, vouchers, perks and transfer." },
      { term: "QR fallback", def: "Same backend with alternate carrier for continuity and scale." },
      { term: "Basic / NTAG215", def: "Volume interaction, serialization and entry-level warranty flows." },
      { term: "Secure / NTAG 424 DNA (TagTamper)", def: "High-trust authenticity/tamper profile for sensitive use cases." },
    ],
    bannedTitle: "Banned or restricted terms",
    banned: [
      { term: "NFC chip company", why: "Reduces the category to hardware." },
      { term: "Wine tokenization company", why: "Narrows market and confuses positioning." },
      { term: "Blockchain-first", why: "Distracts from the core B2B value proposition." },
      { term: "Impossible to clone", why: "Absolute claim with legal/commercial risk." },
      { term: "Cold-chain (without sensor)", why: "Do not claim sensing without real integration." },
    ],
    canonicalTitle: "Canonical phrases",
    canonical: [
      "We turn products, credentials and documents into verifiable digital identities.",
      "Anti-fraud protects the truth of the object. Tokenization digitizes rights on top of that object.",
      "Basic for interaction and scale. Secure for proof and trust.",
      "Tokenization is not step one: first establish a verifiable physical identity.",
    ],
    rulesTitle: "Editorial usage rules",
    rules: [
      "Always explain in order: Verify → Passport → Rights.",
      "Do not lead hero messaging with tokenization.",
      "Do not confuse one-off activation with a validation platform.",
      "If data is simulated, label it as unaudited demo data.",
      "Reseller pages should focus on channel outcomes, not internal architecture jargon.",
    ],
  },
};

export default async function GlossaryPage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];

  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink href="/docs" />
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white">{copy.approvedTitle}</h3>
        <div className="mt-4 grid gap-3">
          {copy.approved.map((item) => (
            <div key={item.term} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-semibold text-cyan-200">{item.term}</p>
              <p className="mt-1 text-sm text-slate-300">{item.def}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.bannedTitle}</h3>
          <div className="mt-4 grid gap-3">
            {copy.banned.map((item) => (
              <div key={item.term} className="rounded-xl border border-rose-300/30 bg-rose-500/10 p-3">
                <p className="text-sm font-semibold text-rose-200">{item.term}</p>
                <p className="mt-1 text-sm text-rose-100">{item.why}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.canonicalTitle}</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {copy.canonical.map((line) => <li key={line}>• {line}</li>)}
          </ul>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white">{copy.rulesTitle}</h3>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {copy.rules.map((line) => <li key={line}>• {line}</li>)}
        </ul>
      </Card>
    </main>
  );
}
