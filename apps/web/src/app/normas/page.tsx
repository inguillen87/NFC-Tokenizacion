import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, FileCheck2, Globe2, Lock, Nfc, Pill, ShieldCheck, Wine } from "lucide-react";
import type { CSSProperties } from "react";
import { PublicSiteHeader } from "../../components/public-site-header";
import { getWebI18n } from "../../lib/locale";
import styles from "./normas.module.css";

type StatusKey = "now" | "design" | "ready" | "complements" | "project" | "roadmap";
type StandardKey = "nfc" | "gs1" | "espr" | "wine" | "fmd" | "anmat" | "privacy" | "iso27001";
type Locale = "es-AR" | "pt-BR" | "en";

type StandardCopy = { name: string; scope: string; body: string; sectors: string[] };
type NormasCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  lead: string;
  legendLabel: string;
  statuses: Record<StatusKey, { label: string; hint: string }>;
  standards: Record<StandardKey, StandardCopy>;
  source: string;
  boundaryTitle: string;
  boundary: string;
  checked: string;
  demo: string;
  contact: string;
};

/** Status and official sources do not depend on language. Sources were checked on 2026-11-28. */
const STANDARDS: ReadonlyArray<{ key: StandardKey; status: StatusKey; icon: typeof Nfc; source?: string }> = [
  { key: "nfc", status: "now", icon: Nfc },
  { key: "gs1", status: "now", icon: Globe2, source: "https://gs1.eu/wp-content/uploads/2025/07/Implementation-Considerations-for-Unique-DPP-Product-Identifiers_GS1.pdf" },
  { key: "privacy", status: "design", icon: Lock },
  { key: "espr", status: "ready", icon: FileCheck2, source: "https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en" },
  { key: "fmd", status: "complements", icon: Pill, source: "https://www.ema.europa.eu/en/news/new-safety-features-medicines-sold-eu" },
  { key: "anmat", status: "complements", icon: ShieldCheck, source: "https://www.anmat.gob.ar/trazabilidad/recomendaciones.asp" },
  { key: "wine", status: "project", icon: Wine, source: "https://eur-lex.europa.eu/eli/C/2023/1190/oj" },
  { key: "iso27001", status: "roadmap", icon: ShieldCheck },
];

const copyByLocale: Record<Locale, NormasCopy> = {
  "es-AR": {
    metaTitle: "Normas y estándares | nexID",
    metaDescription: "Cómo trabaja nexID con NFC seguro, GS1 Digital Link, el Pasaporte Digital de la UE, trazabilidad farmacéutica y protección de datos, con el estado real de cada uno.",
    eyebrow: "Normas y estándares",
    title: "Trabajamos con las normas que tus clientes ya exigen.",
    lead: "Identificación, trazabilidad y privacidad alineadas a estándares de la UE, LATAM y el mundo. Te decimos qué cubre la plataforma hoy, qué está preparado y qué depende de tu producto.",
    legendLabel: "Cómo leer cada estado",
    statuses: {
      now: { label: "Compatible hoy", hint: "Funciona en la plataforma actual." },
      design: { label: "Por diseño", hint: "La plataforma está construida para cumplirlo; tu organización completa sus obligaciones." },
      ready: { label: "Preparado", hint: "La estructura está; los campos exactos los define cada acto por producto." },
      complements: { label: "Complementa", hint: "Suma evidencia al sistema oficial; no lo reemplaza." },
      project: { label: "Por proyecto", hint: "Se arma para tu producto con reglas propias." },
      roadmap: { label: "En hoja de ruta", hint: "Seguimos sus controles; la certificación aún no está emitida." },
    },
    standards: {
      nfc: { name: "NFC seguro · NTAG 424 DNA", scope: "ISO/IEC 14443 · Global", body: "Cada toque genera un mensaje firmado de un solo uso (SUN, AES-128) y una copia repetida se detecta. La versión TT informa si el precinto se abrió.", sectors: ["Vinos", "Cosmética", "Farma", "Agro"] },
      gs1: { name: "GS1 Digital Link", scope: "GS1 · Global", body: "Registro de identidades por GTIN y lote, con rutas /01/…/10/… para QR y NFC. Es una de las vías previstas para identificar productos en el pasaporte digital de la UE.", sectors: ["Todos los rubros"] },
      privacy: { name: "Protección de datos", scope: "GDPR (UE) · LGPD (Brasil) · Ley 25.326 (Argentina)", body: "Minimización de datos, consentimiento por canal y finalidad, y permisos por rol. Un toque es actividad de un producto, no la identidad de una persona.", sectors: ["Todos los rubros"] },
      espr: { name: "Pasaporte Digital de Producto UE", scope: "ESPR · Reglamento (UE) 2024/1781", body: "El marco ya rige y los requisitos llegan por producto, con al menos 18 meses de transición. nexID ya separa identidad, datos declarados y evidencia para sumar esos campos.", sectors: ["Textiles", "Agro", "Cosmética", "Envases"] },
      fmd: { name: "Medicamentos falsificados UE", scope: "Directiva FMD · UE", body: "Desde 2019 exige identificador único 2D y dispositivo antimanipulación. nexID no reemplaza ese identificador ni el repositorio oficial: suma un precinto NFC y el prospecto vigente.", sectors: ["Farma"] },
      anmat: { name: "Trazabilidad de medicamentos", scope: "ANMAT · Argentina · Disp. 2891/2026", body: "El Sistema Nacional de Trazabilidad y el nuevo código 2D en envases, con estándar GS1. nexID agrega evidencia de apertura y acceso al prospecto desde el producto.", sectors: ["Farma"] },
      wine: { name: "Etiqueta electrónica de vinos", scope: "Reglamento (UE) 2021/2117", body: "Ingredientes y tabla nutricional pueden ir por QR. Esa vista no puede tener marketing ni rastrear al usuario, así que la publicamos aparte del pasaporte.", sectors: ["Vinos"] },
      iso27001: { name: "Seguridad de la información", scope: "ISO/IEC 27001", body: "Registros de auditoría, roles, cifrado y control de accesos siguiendo sus controles. Todavía no contamos con la certificación emitida.", sectors: ["Plataforma"] },
    },
    source: "Fuente oficial",
    boundaryTitle: "Lo que una plataforma puede y no puede certificar",
    boundary: "La certificación de un producto o de una empresa la otorga el organismo o auditor que corresponde. nexID te da la identidad, la evidencia y la estructura de datos para llegar preparado; no reemplaza ese proceso.",
    checked: "Normas revisadas el 28 de noviembre de 2026. Los plazos de la UE pueden cambiar con cada publicación oficial.",
    demo: "Probar demo",
    contact: "Hablar de mi rubro",
  },
  "pt-BR": {
    metaTitle: "Normas e padrões | nexID",
    metaDescription: "Como a nexID trabalha com NFC seguro, GS1 Digital Link, o Passaporte Digital da UE, rastreabilidade farmacêutica e proteção de dados, com o estado real de cada um.",
    eyebrow: "Normas e padrões",
    title: "Trabalhamos com as normas que seus clientes já exigem.",
    lead: "Identificação, rastreabilidade e privacidade alinhadas a padrões da UE, da América Latina e do mundo. Dizemos o que a plataforma cobre hoje, o que está preparado e o que depende do seu produto.",
    legendLabel: "Como ler cada estado",
    statuses: {
      now: { label: "Compatível hoje", hint: "Funciona na plataforma atual." },
      design: { label: "Por design", hint: "A plataforma foi construída para cumprir; sua organização completa as obrigações." },
      ready: { label: "Preparado", hint: "A estrutura existe; os campos exatos vêm de cada ato por produto." },
      complements: { label: "Complementa", hint: "Soma evidência ao sistema oficial; não o substitui." },
      project: { label: "Por projeto", hint: "Montado para o seu produto com regras próprias." },
      roadmap: { label: "No roadmap", hint: "Seguimos seus controles; a certificação ainda não foi emitida." },
    },
    standards: {
      nfc: { name: "NFC seguro · NTAG 424 DNA", scope: "ISO/IEC 14443 · Global", body: "Cada toque gera uma mensagem assinada de uso único (SUN, AES-128) e uma cópia repetida é detectada. A versão TT informa se o lacre foi aberto.", sectors: ["Vinhos", "Cosméticos", "Farma", "Agro"] },
      gs1: { name: "GS1 Digital Link", scope: "GS1 · Global", body: "Registro de identidades por GTIN e lote, com rotas /01/…/10/… para QR e NFC. É uma das vias previstas para identificar produtos no passaporte digital da UE.", sectors: ["Todos os setores"] },
      privacy: { name: "Proteção de dados", scope: "GDPR (UE) · LGPD (Brasil) · Lei 25.326 (Argentina)", body: "Minimização de dados, consentimento por canal e finalidade, e permissões por papel. Um toque é atividade de um produto, não a identidade de uma pessoa.", sectors: ["Todos os setores"] },
      espr: { name: "Passaporte Digital de Produto UE", scope: "ESPR · Regulamento (UE) 2024/1781", body: "O marco já vigora e os requisitos chegam por produto, com pelo menos 18 meses de transição. A nexID já separa identidade, dados declarados e evidência para somar esses campos.", sectors: ["Têxteis", "Agro", "Cosméticos", "Embalagens"] },
      fmd: { name: "Medicamentos falsificados UE", scope: "Diretiva FMD · UE", body: "Desde 2019 exige identificador único 2D e dispositivo antiviolação. A nexID não substitui esse identificador nem o repositório oficial: soma um lacre NFC e a bula vigente.", sectors: ["Farma"] },
      anmat: { name: "Rastreabilidade de medicamentos", scope: "ANMAT · Argentina · Disp. 2891/2026", body: "O Sistema Nacional de Rastreabilidade e o novo código 2D nas embalagens, com padrão GS1. A nexID agrega evidência de abertura e acesso à bula a partir do produto.", sectors: ["Farma"] },
      wine: { name: "Rótulo eletrônico de vinhos", scope: "Regulamento (UE) 2021/2117", body: "Ingredientes e tabela nutricional podem ir por QR. Essa visão não pode ter marketing nem rastrear o usuário, por isso a publicamos separada do passaporte.", sectors: ["Vinhos"] },
      iso27001: { name: "Segurança da informação", scope: "ISO/IEC 27001", body: "Registros de auditoria, papéis, criptografia e controle de acesso seguindo seus controles. Ainda não temos a certificação emitida.", sectors: ["Plataforma"] },
    },
    source: "Fonte oficial",
    boundaryTitle: "O que uma plataforma pode e não pode certificar",
    boundary: "A certificação de um produto ou de uma empresa é concedida pelo órgão ou auditor correspondente. A nexID entrega a identidade, a evidência e a estrutura de dados para chegar preparado; não substitui esse processo.",
    checked: "Normas revisadas em 28 de novembro de 2026. Os prazos da UE podem mudar a cada publicação oficial.",
    demo: "Testar a demo",
    contact: "Falar do meu setor",
  },
  en: {
    metaTitle: "Standards and regulations | nexID",
    metaDescription: "How nexID works with secure NFC, GS1 Digital Link, the EU Digital Product Passport, pharmaceutical traceability and data protection, with the real status of each.",
    eyebrow: "Standards and regulations",
    title: "We work with the rules your customers already require.",
    lead: "Identification, traceability and privacy aligned with EU, Latin American and global standards. We tell you what the platform covers today, what is prepared and what depends on your product.",
    legendLabel: "How to read each status",
    statuses: {
      now: { label: "Supported today", hint: "Works on the current platform." },
      design: { label: "By design", hint: "The platform is built for it; your organisation completes its own obligations." },
      ready: { label: "Prepared", hint: "The structure exists; exact fields come from each product act." },
      complements: { label: "Complements", hint: "Adds evidence to the official system; does not replace it." },
      project: { label: "Per project", hint: "Built for your product with its own rules." },
      roadmap: { label: "On the roadmap", hint: "We follow its controls; certification has not been issued yet." },
    },
    standards: {
      nfc: { name: "Secure NFC · NTAG 424 DNA", scope: "ISO/IEC 14443 · Global", body: "Each tap produces a signed single-use message (SUN, AES-128) and a repeated copy is detected. The TT version reports whether the seal was opened.", sectors: ["Wine", "Cosmetics", "Pharma", "Agri"] },
      gs1: { name: "GS1 Digital Link", scope: "GS1 · Global", body: "Identity registry by GTIN and lot, with /01/…/10/… paths for QR and NFC. It is one of the routes anticipated for identifying products in the EU digital passport.", sectors: ["All sectors"] },
      privacy: { name: "Data protection", scope: "GDPR (EU) · LGPD (Brazil) · Law 25.326 (Argentina)", body: "Data minimisation, consent per channel and purpose, and role-based permissions. A tap is product activity, not a person's identity.", sectors: ["All sectors"] },
      espr: { name: "EU Digital Product Passport", scope: "ESPR · Regulation (EU) 2024/1781", body: "The framework applies and requirements arrive per product, with at least 18 months of transition. nexID already separates identity, declared data and evidence to add those fields.", sectors: ["Textiles", "Agri", "Cosmetics", "Packaging"] },
      fmd: { name: "EU Falsified Medicines", scope: "FMD · EU", body: "Since 2019 it requires a 2D unique identifier and an anti-tampering device. nexID does not replace that identifier or the official repository: it adds an NFC seal and the current leaflet.", sectors: ["Pharma"] },
      anmat: { name: "Medicine traceability", scope: "ANMAT · Argentina · Disp. 2891/2026", body: "The National Traceability System and the new 2D code on packs, using GS1. nexID adds opening evidence and leaflet access from the product.", sectors: ["Pharma"] },
      wine: { name: "Wine e-label", scope: "Regulation (EU) 2021/2117", body: "Ingredients and nutrition can be provided by QR. That view may not contain marketing or track the user, so we publish it separately from the passport.", sectors: ["Wine"] },
      iso27001: { name: "Information security", scope: "ISO/IEC 27001", body: "Audit logs, roles, encryption and access control following its controls. We do not hold the certification yet.", sectors: ["Platform"] },
    },
    source: "Official source",
    boundaryTitle: "What a platform can and cannot certify",
    boundary: "Certification of a product or a company is granted by the relevant authority or auditor. nexID gives you the identity, evidence and data structure to arrive prepared; it does not replace that process.",
    checked: "Rules reviewed on 28 November 2026. EU timelines can change with each official publication.",
    demo: "Try the demo",
    contact: "Talk about my sector",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];
  return { title: copy.metaTitle, description: copy.metaDescription, alternates: { canonical: "/normas" } };
}

export default async function NormasPage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];
  const statusOrder: readonly StatusKey[] = ["now", "design", "ready", "complements", "project", "roadmap"];

  return (
    <>
      <PublicSiteHeader />
      <main id="main-content" tabIndex={-1} data-nav-inert className={styles.page}>
        <div className={styles.glow} aria-hidden="true"><span /><span /></div>
        <header className={`container-shell ${styles.intro}`}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className={styles.lead}>{copy.lead}</p>
        </header>

        <section className={`container-shell ${styles.legend}`} aria-label={copy.legendLabel}>
          <ul>
            {statusOrder.map((key) => (
              <li key={key} data-status={key}>
                <span className={styles.dot} aria-hidden="true" />
                <strong>{copy.statuses[key].label}</strong>
                <small>{copy.statuses[key].hint}</small>
              </li>
            ))}
          </ul>
        </section>

        <section className={`container-shell ${styles.grid}`} aria-label={copy.eyebrow}>
          {STANDARDS.map(({ key, status, icon: Icon, source }, index) => {
            const item = copy.standards[key];
            return (
              <article key={key} className={styles.card} data-status={status} data-scroll-rise style={{ "--card-i": index } as CSSProperties}>
                <div className={styles.cardTop}>
                  <span className={styles.icon} aria-hidden="true"><Icon size={20} /></span>
                  <span className={styles.status}>{copy.statuses[status].label}</span>
                </div>
                <h2>{item.name}</h2>
                <p className={styles.scope}>{item.scope}</p>
                <p className={styles.body}>{item.body}</p>
                <ul className={styles.sectors}>{item.sectors.map((sector) => <li key={sector}>{sector}</li>)}</ul>
                {source ? (
                  <a className={styles.source} href={source} target="_blank" rel="noreferrer noopener">
                    {copy.source}<ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : null}
              </article>
            );
          })}
        </section>

        <section className={`container-shell ${styles.boundary}`} aria-labelledby="normas-boundary">
          <div>
            <h2 id="normas-boundary">{copy.boundaryTitle}</h2>
            <p>{copy.boundary}</p>
            <p className={styles.checked}>{copy.checked}</p>
          </div>
          <div className={styles.actions}>
            <Link href="/demo-lab" prefetch={false} className={styles.primary}>{copy.demo}<ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/?contact=demo#contact-modal" prefetch={false} className={styles.secondary}>{copy.contact}</Link>
          </div>
        </section>
      </main>
    </>
  );
}
