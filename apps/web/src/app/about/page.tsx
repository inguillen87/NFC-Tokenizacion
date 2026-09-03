import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Database,
  ExternalLink,
  FileBadge2,
  FileSearch,
  Recycle,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { schedulingUrls, type AppLocale } from "@product/config";
import { PublicSiteHeader } from "../../components/public-site-header";
import { getWebI18n } from "../../lib/locale";
import { buildPublicPageMetadata } from "../../lib/public-page-metadata";
import styles from "./about.module.css";

type AboutCopy = {
  home: string;
  skip: string;
  eyebrow: string;
  title: string;
  lead: string;
  nexidLabel: string;
  nexidTitle: string;
  nexidBody: string;
  inmovarLabel: string;
  inmovarTitle: string;
  inmovarBody: string;
  boundary: string;
  passportEyebrow: string;
  passportTitle: string;
  passportIntro: string;
  passportFields: Array<{ title: string; body: string }>;
  rolesEyebrow: string;
  rolesTitle: string;
  rolesIntro: string;
  roles: Array<{ title: string; question: string; body: string }>;
  methodEyebrow: string;
  methodTitle: string;
  methodIntro: string;
  method: Array<{ title: string; body: string }>;
  founderEyebrow: string;
  founderRole: string;
  founderBody: string;
  portraitAlt: string;
  instagram: string;
  linkedin: string;
  portfolio: string;
  sourcesEyebrow: string;
  sourcesTitle: string;
  sourcesIntro: string;
  sources: Array<{ title: string; body: string }>;
  closeTitle: string;
  closeBody: string;
  meeting: string;
  docs: string;
};

const copyByLocale: Record<AppLocale, AboutCopy> = {
  "es-AR": {
    home: "Inicio de nexID",
    skip: "Ir al contenido",
    eyebrow: "Quiénes somos · Pasaporte Digital de Producto",
    title: "Construimos el pasaporte digital que acompaña a cada producto.",
    lead:
      "nexID es una plataforma de Pasaporte Digital de Producto (DPP) y trazabilidad del ecosistema Inmovar Latam. Organiza identidad, datos declarados, documentos, uso, circularidad y evidencia en un registro que evoluciona durante el ciclo de vida. NFC y QR son puertas de acceso; los permisos definen qué ve cada persona o equipo.",
    nexidLabel: "Infraestructura de producto",
    nexidTitle: "nexID",
    nexidBody:
      "Conecta el producto físico con un pasaporte gobernado por modelo, lote o unidad. La misma base alimenta experiencias públicas, operación empresarial e integraciones sin convertir cada lectura en una promesa que los datos no respaldan.",
    inmovarLabel: "El ecosistema",
    inmovarTitle: "Inmovar Latam",
    inmovarBody:
      "Es el ecosistema tecnológico desde el que se impulsa el desarrollo de nexID y se conectan producto, ingeniería e implementación empresarial.",
    boundary:
      "nexID conserva la fuente, el responsable, la fecha y el estado de cada dato, y puede verificar eventos digitales cuando existe evidencia. No transforma una declaración de la marca en un hecho certificado, no confirma por sí solo la autenticidad física y no garantiza automáticamente el cumplimiento de una regulación.",
    passportEyebrow: "Qué construimos",
    passportTitle: "Un registro vivo. No una ficha estática pegada al envase.",
    passportIntro:
      "El pasaporte separa con claridad qué identifica al producto, qué declara cada fuente, qué puede consultarse y qué evidencia respalda un cambio.",
    passportFields: [
      { title: "Identidad y alcance", body: "Referencia, modelo, lote o unidad. La granularidad se define según el producto y el dato que debe mantenerse." },
      { title: "Trazabilidad declarada", body: "Origen, materiales, fabricación, cadena y documentos, conservando la fuente y el responsable de cada campo." },
      { title: "Uso y circularidad", body: "Instrucciones, cuidado, reparación, reutilización, separación y fin de vida cuando esa información está disponible." },
      { title: "Evidencia y cambios", body: "Versión, fecha, fuente y eventos verificables. Lo no informado o no validado se muestra con su estado real." },
    ],
    rolesEyebrow: "Información según el rol",
    rolesTitle: "Una misma identidad. La vista adecuada para cada actor.",
    rolesIntro:
      "No todos necesitan —ni deben— ver lo mismo. nexID aplica permisos y contexto sin duplicar el pasaporte.",
    roles: [
      { title: "Persona que usa o compra", question: "¿Qué es, cómo lo uso y qué hago al final de su vida útil?", body: "Consulta únicamente la información publicada y los servicios disponibles para ese producto, sin exponer datos internos de operación." },
      { title: "Marca y operación", question: "¿Qué dato falta, quién lo mantiene y qué versión está vigente?", body: "Administra modelos, lotes, unidades, responsables, documentos y permisos desde una fuente gobernada." },
      { title: "Servicio y circularidad", question: "¿Cómo se cuida, repara, reutiliza, separa o recupera?", body: "Accede a instrucciones y acciones específicas cuando la marca las publica y el rol tiene permiso." },
      { title: "Auditoría y autoridades", question: "¿De dónde proviene el dato y qué evidencia existe?", body: "Revisa fuente, estado, fecha e historial dentro del alcance habilitado. El acceso no equivale a aprobación ni certificación." },
    ],
    methodEyebrow: "Cómo lo llevamos a operación",
    methodTitle: "De datos dispersos a un pasaporte gobernado.",
    methodIntro:
      "Primero diseñamos el dato y sus responsabilidades; después elegimos el soporte físico y las experiencias que lo utilizan.",
    method: [
      { title: "Modelar el pasaporte", body: "Definimos la granularidad, los campos, la fuente, el responsable, la visibilidad y el ciclo de actualización." },
      { title: "Conectar el producto", body: "Elegimos QR, NFC estándar o NFC seguro según el caso. El soporte abre el pasaporte; no reemplaza la calidad del dato." },
      { title: "Gobernar el ciclo de vida", body: "Versionamos información, permisos y evidencia para que cada actor consulte lo que corresponde en cada etapa." },
    ],
    founderEyebrow: "Fundador",
    founderRole: "Fundador y CEO de nexID · Ingeniero Informático",
    founderBody:
      "Marcelo Guillén lidera nexID como fundador y CEO. Es Ingeniero Informático y fundador de Inmovar Latam. Desde 2013 crea y lidera productos en fintech, SaaS, GovTech, automatización y trazabilidad.",
    portraitAlt: "Retrato institucional de Marcelo Guillén, fundador y CEO de nexID",
    instagram: "Marcelo Guillén en Instagram",
    linkedin: "Marcelo Guillén en LinkedIn",
    portfolio: "Portfolio oficial",
    sourcesEyebrow: "Información pública",
    sourcesTitle: "Conocé el ecosistema y nuestra documentación.",
    sourcesIntro: "Accesos directos para ampliar la información institucional y técnica sin cargar la portada.",
    sources: [
      { title: "Inmovar Latam", body: "Conocé el ecosistema tecnológico en el que nace y se desarrolla nexID." },
      { title: "Datos fiscales", body: "Consultá la inscripción digital pública disponible para validación institucional." },
      { title: "Descargar certificado MiPyME de Marcelo Guillén (PDF)", body: "Descargá el documento público disponible en formato PDF." },
    ],
    closeTitle: "Diseñemos el pasaporte de tu producto.",
    closeBody: "Podemos mapear identidad, datos, roles, evidencia y soporte de acceso para construir un primer alcance DPP útil, comprensible y honesto.",
    meeting: "Agendar una reunión",
    docs: "Ver documentación",
  },
  "pt-BR": {
    home: "Início da nexID",
    skip: "Ir para o conteúdo",
    eyebrow: "Quem somos · Passaporte Digital de Produto",
    title: "Construímos o passaporte digital que acompanha cada produto.",
    lead:
      "A nexID é uma plataforma de Passaporte Digital de Produto (DPP) e rastreabilidade do ecossistema Inmovar Latam. Organiza identidade, dados declarados, documentos, uso, circularidade e evidência em um registro que evolui durante o ciclo de vida. NFC e QR são portas de acesso; as permissões definem o que cada pessoa ou equipe pode ver.",
    nexidLabel: "Infraestrutura de produto",
    nexidTitle: "nexID",
    nexidBody:
      "Conecta o produto físico a um passaporte governado por modelo, lote ou unidade. A mesma base alimenta experiências públicas, operação empresarial e integrações sem transformar cada leitura em uma promessa que os dados não sustentam.",
    inmovarLabel: "O ecossistema",
    inmovarTitle: "Inmovar Latam",
    inmovarBody:
      "É o ecossistema tecnológico que impulsiona o desenvolvimento da nexID e conecta produto, engenharia e implementação empresarial.",
    boundary:
      "A nexID preserva a fonte, o responsável, a data e o estado de cada dado, e pode verificar eventos digitais quando existe evidência. Não transforma uma declaração da marca em um fato certificado, não confirma sozinha a autenticidade física e não garante automaticamente o cumprimento de uma regulamentação.",
    passportEyebrow: "O que construímos",
    passportTitle: "Um registro vivo. Não uma ficha estática colada à embalagem.",
    passportIntro:
      "O passaporte separa com clareza o que identifica o produto, o que cada fonte declara, o que pode ser consultado e qual evidência sustenta uma mudança.",
    passportFields: [
      { title: "Identidade e alcance", body: "Referência, modelo, lote ou unidade. A granularidade é definida conforme o produto e o dado que deve ser mantido." },
      { title: "Rastreabilidade declarada", body: "Origem, materiais, fabricação, cadeia e documentos, preservando a fonte e o responsável por cada campo." },
      { title: "Uso e circularidade", body: "Instruções, cuidado, reparo, reutilização, separação e fim de vida quando essas informações estão disponíveis." },
      { title: "Evidência e mudanças", body: "Versão, data, fonte e eventos verificáveis. O que não foi informado ou validado aparece com seu estado real." },
    ],
    rolesEyebrow: "Informação conforme o papel",
    rolesTitle: "Uma mesma identidade. A visão certa para cada ator.",
    rolesIntro:
      "Nem todos precisam —ou devem— ver a mesma coisa. A nexID aplica permissões e contexto sem duplicar o passaporte.",
    roles: [
      { title: "Pessoa que usa ou compra", question: "O que é, como uso e o que faço no fim da vida útil?", body: "Consulta somente as informações publicadas e os serviços disponíveis para esse produto, sem expor dados internos da operação." },
      { title: "Marca e operação", question: "Qual dado falta, quem o mantém e qual versão está vigente?", body: "Administra modelos, lotes, unidades, responsáveis, documentos e permissões a partir de uma fonte governada." },
      { title: "Serviço e circularidade", question: "Como cuidar, reparar, reutilizar, separar ou recuperar?", body: "Acessa instruções e ações específicas quando a marca as publica e o papel tem permissão." },
      { title: "Auditoria e autoridades", question: "De onde vem o dado e qual evidência existe?", body: "Revisa fonte, estado, data e histórico dentro do escopo autorizado. O acesso não equivale a aprovação nem certificação." },
    ],
    methodEyebrow: "Como levamos à operação",
    methodTitle: "De dados dispersos a um passaporte governado.",
    methodIntro:
      "Primeiro desenhamos o dado e suas responsabilidades; depois escolhemos o suporte físico e as experiências que o utilizam.",
    method: [
      { title: "Modelar o passaporte", body: "Definimos granularidade, campos, fonte, responsável, visibilidade e ciclo de atualização." },
      { title: "Conectar o produto", body: "Escolhemos QR, NFC padrão ou NFC seguro conforme o caso. O suporte abre o passaporte; não substitui a qualidade do dado." },
      { title: "Governar o ciclo de vida", body: "Versionamos informações, permissões e evidências para que cada ator consulte o que corresponde em cada etapa." },
    ],
    founderEyebrow: "Fundador",
    founderRole: "Fundador e CEO da nexID · Engenheiro de Informática",
    founderBody:
      "Marcelo Guillén lidera a nexID como fundador e CEO. É Engenheiro de Informática e fundador da Inmovar Latam. Desde 2013 cria e lidera produtos em fintech, SaaS, GovTech, automação e rastreabilidade.",
    portraitAlt: "Retrato institucional de Marcelo Guillén, fundador e CEO da nexID",
    instagram: "Marcelo Guillén no Instagram",
    linkedin: "Marcelo Guillén no LinkedIn",
    portfolio: "Portfólio oficial",
    sourcesEyebrow: "Informação pública",
    sourcesTitle: "Conheça o ecossistema e nossa documentação.",
    sourcesIntro: "Acessos diretos para ampliar a informação institucional e técnica sem sobrecarregar a página inicial.",
    sources: [
      { title: "Inmovar Latam", body: "Conheça o ecossistema tecnológico no qual a nexID nasceu e se desenvolve." },
      { title: "Dados fiscais", body: "Consulte a inscrição digital pública disponível para validação institucional." },
      { title: "Baixar certificado MiPyME de Marcelo Guillén (PDF)", body: "Baixe o documento público disponível em formato PDF." },
    ],
    closeTitle: "Vamos desenhar o passaporte do seu produto.",
    closeBody: "Podemos mapear identidade, dados, papéis, evidências e suporte de acesso para construir um primeiro escopo DPP útil, compreensível e honesto.",
    meeting: "Agendar uma reunião",
    docs: "Ver documentação",
  },
  en: {
    home: "nexID home",
    skip: "Skip to content",
    eyebrow: "About us · Digital Product Passport",
    title: "We build the digital passport that stays with every product.",
    lead:
      "nexID is a Digital Product Passport (DPP) and traceability platform within the Inmovar Latam ecosystem. It organizes identity, declared data, documents, use, circularity and evidence in a record that evolves across the product lifecycle. NFC and QR are access points; permissions determine what each person or team can see.",
    nexidLabel: "Product infrastructure",
    nexidTitle: "nexID",
    nexidBody:
      "It connects the physical product to a passport governed by model, batch or unit. The same foundation serves public experiences, enterprise operations and integrations without turning every scan into a claim the data cannot support.",
    inmovarLabel: "The ecosystem",
    inmovarTitle: "Inmovar Latam",
    inmovarBody:
      "It is the technology ecosystem that supports nexID's development and connects product, engineering and enterprise implementation.",
    boundary:
      "nexID preserves the source, owner, date and status of each data point, and can verify digital events when evidence exists. It does not turn a brand declaration into a certified fact, does not by itself prove physical authenticity and does not automatically guarantee regulatory compliance.",
    passportEyebrow: "What we build",
    passportTitle: "A living record. Not a static page attached to a package.",
    passportIntro:
      "The passport clearly separates what identifies the product, what each source declares, what can be viewed and what evidence supports a change.",
    passportFields: [
      { title: "Identity and scope", body: "Reference, model, batch or unit. Granularity is defined by the product and the data that must be maintained." },
      { title: "Declared traceability", body: "Origin, materials, manufacturing, supply chain and documents, retaining the source and owner of each field." },
      { title: "Use and circularity", body: "Instructions, care, repair, reuse, separation and end-of-life guidance when that information is available." },
      { title: "Evidence and change", body: "Version, date, source and verifiable events. Missing or unvalidated information is shown with its real status." },
    ],
    rolesEyebrow: "Information by role",
    rolesTitle: "One identity. The right view for each actor.",
    rolesIntro:
      "Not everyone needs —or should— see the same information. nexID applies permissions and context without duplicating the passport.",
    roles: [
      { title: "Person using or buying", question: "What is it, how do I use it and what happens at end of life?", body: "They see only published information and services available for that product, without exposure to internal operating data." },
      { title: "Brand and operations", question: "What data is missing, who maintains it and which version is current?", body: "They manage models, batches, units, owners, documents and permissions from a governed source." },
      { title: "Service and circularity", question: "How can it be cared for, repaired, reused, separated or recovered?", body: "They access specific instructions and actions when the brand publishes them and the role is authorized." },
      { title: "Auditors and authorities", question: "Where did the data come from and what evidence exists?", body: "They review source, status, date and history within the authorized scope. Access does not imply approval or certification." },
    ],
    methodEyebrow: "How we make it operational",
    methodTitle: "From scattered data to a governed passport.",
    methodIntro:
      "We design the data and its responsibilities first; then we choose the physical carrier and the experiences that use it.",
    method: [
      { title: "Model the passport", body: "We define granularity, fields, source, owner, visibility and the update lifecycle." },
      { title: "Connect the product", body: "We choose QR, standard NFC or secure NFC for the use case. The carrier opens the passport; it cannot replace data quality." },
      { title: "Govern the lifecycle", body: "We version information, permissions and evidence so each actor sees what is appropriate at each stage." },
    ],
    founderEyebrow: "Founder",
    founderRole: "Founder and CEO of nexID · Computer Engineer",
    founderBody:
      "Marcelo Guillén leads nexID as its founder and CEO. He is a Computer Engineer and the founder of Inmovar Latam. Since 2013, he has created and led products across fintech, SaaS, GovTech, automation and traceability.",
    portraitAlt: "Institutional portrait of Marcelo Guillén, founder and CEO of nexID",
    instagram: "Marcelo Guillén on Instagram",
    linkedin: "Marcelo Guillén on LinkedIn",
    portfolio: "Official portfolio",
    sourcesEyebrow: "Public information",
    sourcesTitle: "Explore the ecosystem and our documentation.",
    sourcesIntro: "Direct paths to institutional and technical information without crowding the home page.",
    sources: [
      { title: "Inmovar Latam", body: "Learn about the technology ecosystem in which nexID was created and is developed." },
      { title: "Tax registration", body: "Open the public digital registration available for institutional review." },
      { title: "Download Marcelo Guillén's MiPyME certificate (PDF)", body: "Download the available public document in PDF format." },
    ],
    closeTitle: "Let's design your product passport.",
    closeBody: "We can map identity, data, roles, evidence and the access carrier to build a useful, understandable and honest first DPP scope.",
    meeting: "Book a meeting",
    docs: "View documentation",
  },
};

const passportIcons = [Boxes, Database, Recycle, FileSearch] as const;
const roleIcons = [Users, Building2, Wrench, ShieldCheck] as const;
const methodIcons = [Database, ScanLine, ShieldCheck] as const;

function InstagramBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8Z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 6.65A5.35 5.35 0 1 1 12 17.35 5.35 5.35 0 0 1 12 6.65Zm0 2A3.35 3.35 0 1 0 12 15.35 3.35 3.35 0 0 0 12 8.65Z"
      />
      <path fill="currentColor" d="M18.72 6.42a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z" />
    </svg>
  );
}

function LinkedinBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.119 20.452H3.555V9H7.12v11.452ZM20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.047c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286Z"
      />
    </svg>
  );
}

const instagramHref = "https://www.instagram.com/inguillen/";
const linkedinHref = "https://www.linkedin.com/in/marcelo-guill%C3%A9n-54876527/";
const portfolioHrefByLocale: Record<AppLocale, string> = {
  "es-AR": "https://www.inguillen.ar/?lang=es",
  "pt-BR": "https://www.inguillen.ar/?lang=pt",
  en: "https://www.inguillen.ar/?lang=en",
};
const afipDataFiscalHref = "https://qr.afip.gob.ar/?qr=-F2blnmFe6pmSP-chYnylQ,,";
const mipymeCertificateHref = "/certificados/certificado-mipyme-intellitech.pdf";
const inmovarHref = process.env.NEXT_PUBLIC_INMOVAR_URL?.trim() || "https://www.inmov.ar/";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  return buildPublicPageMetadata("about", locale);
}

export default async function AboutPage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];
  const portfolioHref = portfolioHrefByLocale[locale];
  const meetingHref = schedulingUrls.meeting;
  const sourceLinks = [
    { href: inmovarHref, external: true, download: false, icon: Building2 },
    { href: afipDataFiscalHref, external: true, download: false, icon: ExternalLink },
    { href: mipymeCertificateHref, external: false, download: true, icon: FileBadge2 },
  ] as const;

  return (
    <div className="landing-root about-page">
      <PublicSiteHeader />

      <main id="main-content" tabIndex={-1} data-nav-inert className={styles.page}>
        <div className={styles.shell}>

        <section className={styles.hero} aria-labelledby="about-title">
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 id="about-title" className="brand-editorial-gradient">{copy.title}</h1>
            <p className={styles.heroLead}>{copy.lead}</p>

            <div className={styles.relationship}>
              <article>
                <span>{copy.nexidLabel}</span>
                <h2>{copy.nexidTitle}</h2>
                <p>{copy.nexidBody}</p>
              </article>
              <article>
                <span>{copy.inmovarLabel}</span>
                <h2>{copy.inmovarTitle}</h2>
                <p>{copy.inmovarBody}</p>
              </article>
            </div>

            <p className={styles.boundary}>{copy.boundary}</p>
          </div>
        </section>

        <section className={`${styles.section} ${styles.passportSection}`} aria-labelledby="about-passport-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{copy.passportEyebrow}</p>
              <h2 id="about-passport-title">{copy.passportTitle}</h2>
            </div>
            <p className={styles.sectionIntro}>{copy.passportIntro}</p>
          </div>

          <div className={styles.passportGrid}>
            {copy.passportFields.map((item, index) => {
              const Icon = passportIcons[index] ?? FileSearch;
              return (
                <article key={item.title} className={styles.passportCard}>
                  <span className={styles.passportIcon}><Icon aria-hidden="true" /></span>
                  <div>
                    <span className={styles.passportNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.rolesBlock}>
            <div className={styles.rolesHeader}>
              <div>
                <p className={styles.eyebrow}>{copy.rolesEyebrow}</p>
                <h3>{copy.rolesTitle}</h3>
              </div>
              <p>{copy.rolesIntro}</p>
            </div>

            <div className={styles.roleGrid}>
              {copy.roles.map((role, index) => {
                const Icon = roleIcons[index] ?? Users;
                return (
                  <details key={role.title} className={styles.roleCard} open={index === 0}>
                    <summary>
                      <span className={styles.roleIcon}><Icon aria-hidden="true" /></span>
                      <span className={styles.roleSummary}>
                        <strong>{role.title}</strong>
                        <span>{role.question}</span>
                      </span>
                      <ArrowRight aria-hidden="true" className={styles.roleArrow} />
                    </summary>
                    <p>{role.body}</p>
                  </details>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="about-method-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{copy.methodEyebrow}</p>
              <h2 id="about-method-title">{copy.methodTitle}</h2>
            </div>
            <p className={styles.sectionIntro}>{copy.methodIntro}</p>
          </div>

          <div className={styles.methodGrid}>
            {copy.method.map((item, index) => {
              const Icon = methodIcons[index] ?? Sparkles;
              return (
                <article key={item.title} className={styles.methodCard}>
                  <span className={styles.methodIcon}><Icon aria-hidden="true" /></span>
                  <span className={styles.methodNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.founderSection} aria-labelledby="founder-title">
          <div className={styles.founderGrid}>
            <div className={styles.portrait}>
              <Image
                src="/team/marcelo-guillen.png"
                alt={copy.portraitAlt}
                fill
                sizes="(max-width: 360px) calc(100vw - 3rem), 312px"
                loading="lazy"
              />
            </div>

            <div className={styles.founderCopy}>
              <p className={styles.eyebrow}>{copy.founderEyebrow}</p>
              <h2 id="founder-title">Marcelo Guillén</h2>
              <p className={styles.founderRole}>{copy.founderRole}</p>
              <p>{copy.founderBody}</p>

              <a
                href={portfolioHref}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.portfolioLink}
              >
                <BriefcaseBusiness aria-hidden="true" />
                {copy.portfolio}
                <ExternalLink aria-hidden="true" />
              </a>

              <nav className={styles.socialLinks} aria-label={`${copy.founderEyebrow}: Marcelo Guillén`}>
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={copy.instagram}
                  className={`${styles.socialLink} ${styles.instagram}`}
                >
                  <InstagramBrandIcon />
                  Instagram
                  <ExternalLink aria-hidden="true" />
                </a>
                <a
                  href={linkedinHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={copy.linkedin}
                  className={`${styles.socialLink} ${styles.linkedin}`}
                >
                  <LinkedinBrandIcon />
                  LinkedIn
                  <ExternalLink aria-hidden="true" />
                </a>
              </nav>
            </div>
          </div>
        </section>

        <section id="respaldo" className={styles.section} aria-labelledby="about-sources-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{copy.sourcesEyebrow}</p>
              <h2 id="about-sources-title">{copy.sourcesTitle}</h2>
            </div>
            <p className={styles.sectionIntro}>{copy.sourcesIntro}</p>
          </div>

          <div className={styles.sourceGrid}>
            {copy.sources.map((source, index) => {
              const link = sourceLinks[index];
              const Icon = link.icon;
              return (
                <a
                  key={source.title}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  download={link.download || undefined}
                  className={styles.sourceCard}
                >
                  <div>
                    <strong><Icon aria-hidden="true" />{source.title}</strong>
                    <p>{source.body}</p>
                  </div>
                  <ArrowRight aria-hidden="true" className={styles.sourceArrow} />
                </a>
              );
            })}
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="about-close-title">
          <div>
            <p className={styles.eyebrow}>nexID</p>
            <h2 id="about-close-title">{copy.closeTitle}</h2>
            <p>{copy.closeBody}</p>
          </div>
          <div className={styles.actions}>
            <a href={meetingHref} target="_blank" rel="noopener noreferrer" className={styles.primaryAction}>
              {copy.meeting}
              <ExternalLink aria-hidden="true" />
            </a>
            <Link href="/docs" className={styles.secondaryAction}>
              <BookOpen aria-hidden="true" />
              {copy.docs}
            </Link>
          </div>
        </section>
        </div>
      </main>
    </div>
  );
}
