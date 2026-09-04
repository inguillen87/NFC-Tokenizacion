"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CircleDashed,
  Database,
  Eye,
  FileText,
  LockKeyhole,
  Recycle,
  ShieldCheck,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useConnectedProductIndustry } from "./connected-product-industry-context";
import styles from "./dpp-role-explorer.module.css";

type RoleKey = "person" | "brand" | "service" | "circularity";
type EvidenceKey = "declared" | "verified" | "unavailable";
type LocaleKey = "es" | "pt-BR" | "en";

export type DppExplorerIndustry = "bottles" | "perfume" | "agro";

const DEMO_PROFILE_BY_INDUSTRY: Readonly<Record<DppExplorerIndustry, "wine" | "packaging" | "agro">> = {
  bottles: "wine",
  perfume: "packaging",
  agro: "agro",
};

type PassportField = {
  label: string;
  value: string;
  source: string;
  responsible: string;
  granularity: string;
  updated: string;
  visibility: string;
  evidence: EvidenceKey;
};

type RoleView = {
  label: string;
  shortLabel: string;
  scope: string;
  description: string;
  condition: string;
  journey: {
    who: string;
    receives: string;
    protected: string;
    returns: string;
  };
  fields: PassportField[];
};

type ExplorerCopy = {
  sample: string;
  mode: string;
  eyebrow: string;
  title: string;
  intro: string;
  guideLabel: string;
  guideSteps: [string, string, string];
  journeyTitle: string;
  journeyIntro: string;
  journeyLabels: [string, string, string, string];
  technicalToggle: string;
  technicalHint: string;
  passportLabel: string;
  product: string;
  passportId: string;
  recordLevel: string;
  recordLevelValue: string;
  activeView: string;
  fieldLabel: string;
  sourceLabel: string;
  responsibleLabel: string;
  granularityLabel: string;
  updatedLabel: string;
  visibilityLabel: string;
  legendTitle: string;
  evidenceLabel: string;
  legend: Record<EvidenceKey, { label: string; detail: string }>;
  disclaimer: string;
  cta: string;
  tabsLabel: string;
  roles: Record<RoleKey, RoleView>;
};

type IndustryProfile = {
  product: string;
  passportId: string;
  recordLevelValue: string;
  organization: string;
  contextReference: string;
  primaryLevel: string;
  itemLevel: string;
  modelLevel: string;
  managementLevel: string;
  marketLevel: string;
  publicFieldLabel: string;
  publicFieldValue: string;
  publicFieldSource: string;
  productRecordValue: string;
  serviceCaseValue: string;
  serviceEventSource: string;
  serviceResponsible: string;
  materialLabel: string;
  materialValue: string;
  materialSource: string;
  recoveryLabel: string;
  recoveryValue: string;
  circularitySource: string;
};

const ROLE_KEYS: readonly RoleKey[] = ["person", "brand", "service", "circularity"];

const ROLE_ICONS: Record<RoleKey, LucideIcon> = {
  person: UserRound,
  brand: Building2,
  service: Wrench,
  circularity: Recycle,
};

const EVIDENCE_ICONS: Record<EvidenceKey, LucideIcon> = {
  declared: FileText,
  verified: BadgeCheck,
  unavailable: LockKeyhole,
};

const COPY: Record<"es" | "pt-BR" | "en", ExplorerCopy> = {
  es: {
    sample: "Escenario ilustrativo · Sin datos productivos",
    mode: "Acceso organizado por rol",
    eyebrow: "EXPLORADOR DE PASAPORTE DIGITAL",
    title: "Un pasaporte. La información justa para cada rol.",
    intro: "La ficha es una sola, pero no todos ven lo mismo. Cambiá de rol para comprobar qué recibe cada participante y qué queda protegido.",
    guideLabel: "Cómo explorar el pasaporte",
    guideSteps: ["Elegí quién consulta", "Mirá qué información recibe", "Revisá fuente, responsable y estado"],
    journeyTitle: "Qué pasa para este participante",
    journeyIntro: "Seguí el recorrido antes de abrir el detalle técnico.",
    journeyLabels: ["Quién está mirando", "Qué recibe", "Qué queda protegido", "Qué vuelve a la empresa"],
    technicalToggle: "Ver fuentes, responsables y evidencia",
    technicalHint: "Detalle auditable del pasaporte para esta vista",
    passportLabel: "Pasaporte digital de muestra",
    product: "Reserva Andina",
    passportId: "NEX-DEMO · RA-2407",
    recordLevel: "Nivel del registro",
    recordLevelValue: "Lote de demostración",
    activeView: "Vista activa",
    fieldLabel: "Campo y valor",
    sourceLabel: "Fuente",
    responsibleLabel: "Responsable",
    granularityLabel: "Nivel",
    updatedLabel: "Última actualización",
    visibilityLabel: "Visibilidad",
    legendTitle: "Cómo leer la evidencia",
    evidenceLabel: "Estado",
    legend: {
      declared: {
        label: "Declarado",
        detail: "Información publicada por la organización responsable.",
      },
      verified: {
        label: "Verificado digitalmente",
        detail: "La integridad del registro de muestra fue comprobada; no certifica el producto físico.",
      },
      unavailable: {
        label: "No disponible",
        detail: "El campo no fue publicado o no está habilitado para este rol.",
      },
    },
    disclaimer: "Demo ilustrativa. La disponibilidad depende del producto, del pasaporte configurado y de los permisos. La verificación digital no certifica por sí sola la autenticidad física.",
    cta: "Explorar el Demo Lab",
    tabsLabel: "Elegir vista del pasaporte por rol",
    roles: {
      person: {
        label: "Persona",
        shortLabel: "Consulta pública",
        scope: "Información para quien usa o compra el producto",
        description: "Ve la historia, las instrucciones y los servicios que la marca decidió publicar para este producto.",
        condition: "Sólo campos públicos. Los datos personales requieren consentimiento explícito.",
        journey: {
          who: "Una persona abre el NFC o QR desde su celular, sin instalar una app.",
          receives: "La ficha pública vigente: identidad, historia, origen e instrucciones o servicios habilitados.",
          protected: "Su identidad y los datos internos no se exponen. Compartir datos personales requiere consentimiento explícito.",
          returns: "Puede registrarse la lectura del producto y la acción elegida; eso no identifica automáticamente a la persona.",
        },
        fields: [
          {
            label: "Historia y origen",
            value: "Cosecha 2022 · Valle de Uco",
            source: "Declaración del productor",
            responsible: "Bodega Balmec",
            granularity: "Lote",
            updated: "Actualización de muestra",
            visibility: "Pública",
            evidence: "declared",
          },
          {
            label: "Identificador del pasaporte",
            value: "NEX-DEMO · RA-2407",
            source: "Registro digital de muestra",
            responsible: "nexID Demo",
            granularity: "Lote",
            updated: "Al abrir esta demo",
            visibility: "Pública",
            evidence: "verified",
          },
          {
            label: "Datos internos de operación",
            value: "No visibles en la experiencia pública",
            source: "Sistema de la marca",
            responsible: "Equipo autorizado",
            granularity: "Ítem",
            updated: "No informada",
            visibility: "Restringida",
            evidence: "unavailable",
          },
        ],
      },
      brand: {
        label: "Marca",
        shortLabel: "Gestión del pasaporte",
        scope: "Contenido, versiones y actividad autorizada",
        description: "Publica la ficha, mantiene sus versiones y consulta señales permitidas para mejorar información y servicio.",
        condition: "Las interacciones personales sólo se vinculan cuando existe base válida y consentimiento aplicable.",
        journey: {
          who: "El equipo autorizado de la empresa responsable del pasaporte.",
          receives: "Gestión de contenidos, versiones, lotes y actividad operativa disponible según su permiso.",
          protected: "Los datos personales permanecen separados salvo base válida y consentimiento aplicable.",
          returns: "El dashboard organiza taps y acciones registradas con producto, lote, canal y procedencia disponible.",
        },
        fields: [
          {
            label: "Ficha de producto",
            value: "Historia, origen y recomendaciones",
            source: "Gestor de contenido DPP",
            responsible: "Bodega Balmec",
            granularity: "Modelo + lote",
            updated: "Versión demo vigente",
            visibility: "Publicable",
            evidence: "declared",
          },
          {
            label: "Integridad de la versión",
            value: "Registro de muestra sin cambios pendientes",
            source: "Control digital de versiones",
            responsible: "nexID Demo",
            granularity: "Lote",
            updated: "Al confirmar la versión",
            visibility: "Equipo de marca",
            evidence: "verified",
          },
          {
            label: "Identidad de la persona",
            value: "No disponible sin consentimiento",
            source: "Preferencias de privacidad",
            responsible: "Titular de los datos",
            granularity: "Ítem",
            updated: "No corresponde",
            visibility: "Protegida",
            evidence: "unavailable",
          },
        ],
      },
      service: {
        label: "Servicio / canal",
        shortLabel: "Atención con contexto",
        scope: "Sólo lo necesario para resolver una tarea",
        description: "Recibe el contexto del lote y del servicio asignado, sin abrir toda la información interna del pasaporte.",
        condition: "La organización define qué campos comparte, con qué operador y durante cuánto tiempo.",
        journey: {
          who: "Un operador o canal habilitado por la empresa para resolver una consulta.",
          receives: "Sólo el contexto mínimo del producto, lote y servicio iniciado.",
          protected: "No recibe el perfil completo ni información interna fuera de su permiso.",
          returns: "El caso y su seguimiento pueden quedar vinculados al producto para atención y postventa.",
        },
        fields: [
          {
            label: "Caso de servicio",
            value: "Consulta de conservación iniciada",
            source: "Acción elegida en la experiencia",
            responsible: "Mesa de atención de muestra",
            granularity: "Ítem",
            updated: "Al iniciar el caso demo",
            visibility: "Operador asignado",
            evidence: "verified",
          },
          {
            label: "Contexto compartido",
            value: "Reserva Andina · Lote RA-2407",
            source: "Pasaporte publicado",
            responsible: "Bodega Balmec",
            granularity: "Lote",
            updated: "Versión demo vigente",
            visibility: "Servicio autorizado",
            evidence: "declared",
          },
          {
            label: "Perfil completo de la persona",
            value: "No requerido para resolver esta consulta",
            source: "Política de minimización",
            responsible: "Organización responsable",
            granularity: "Ítem",
            updated: "No corresponde",
            visibility: "No compartida",
            evidence: "unavailable",
          },
        ],
      },
      circularity: {
        label: "Circularidad / autoridad",
        shortLabel: "Información aplicable",
        scope: "Materiales, instrucciones y evidencia por permiso",
        description: "Consulta campos de circularidad o control sólo cuando aplican al producto y el rol está autorizado.",
        condition: "Esta vista no implica cumplimiento normativo automático ni reemplaza la validación de una autoridad.",
        journey: {
          who: "Un operador de circularidad o una autoridad con acceso aplicable.",
          receives: "Materiales, instrucciones, fuente y responsable publicados para el producto y el mercado.",
          protected: "Los campos no aplicables o no autorizados permanecen ocultos.",
          returns: "La consulta aporta trazabilidad operativa; no implica cumplimiento automático ni certificación.",
        },
        fields: [
          {
            label: "Composición del envase",
            value: "Vidrio y componentes declarados",
            source: "Ficha técnica del envase",
            responsible: "Productor de la muestra",
            granularity: "Modelo",
            updated: "Versión demo vigente",
            visibility: "Según rol",
            evidence: "declared",
          },
          {
            label: "Instrucciones de recuperación",
            value: "Separación y circuito a definir por mercado",
            source: "Contenido de circularidad",
            responsible: "Operador responsable",
            granularity: "Modelo + mercado",
            updated: "Al publicar cambios",
            visibility: "Pública si aplica",
            evidence: "declared",
          },
          {
            label: "Certificación regulatoria",
            value: "No incluida en este escenario ilustrativo",
            source: "Documento no aportado",
            responsible: "No informado",
            granularity: "Modelo",
            updated: "No disponible",
            visibility: "No publicada",
            evidence: "unavailable",
          },
        ],
      },
    },
  },
  "pt-BR": {
    sample: "Cenário ilustrativo · Sem dados produtivos",
    mode: "Acesso organizado por função",
    eyebrow: "EXPLORADOR DE PASSAPORTE DIGITAL",
    title: "Um passaporte. A informação certa para cada função.",
    intro: "A ficha é uma só, mas nem todos veem o mesmo. Troque de função para conferir o que cada participante recebe e o que permanece protegido.",
    guideLabel: "Como explorar o passaporte",
    guideSteps: ["Escolha quem consulta", "Veja quais informações recebe", "Revise fonte, responsável e estado"],
    journeyTitle: "O que acontece para este participante",
    journeyIntro: "Acompanhe o percurso antes de abrir os detalhes técnicos.",
    journeyLabels: ["Quem está consultando", "O que recebe", "O que fica protegido", "O que retorna à empresa"],
    technicalToggle: "Ver fontes, responsáveis e evidências",
    technicalHint: "Detalhe auditável do passaporte para esta visão",
    passportLabel: "Passaporte digital de amostra",
    product: "Reserva Andina",
    passportId: "NEX-DEMO · RA-2407",
    recordLevel: "Nível do registro",
    recordLevelValue: "Lote de demonstração",
    activeView: "Visão ativa",
    fieldLabel: "Campo e valor",
    sourceLabel: "Fonte",
    responsibleLabel: "Responsável",
    granularityLabel: "Nível",
    updatedLabel: "Última atualização",
    visibilityLabel: "Visibilidade",
    legendTitle: "Como ler a evidência",
    evidenceLabel: "Estado",
    legend: {
      declared: { label: "Declarado", detail: "Informação publicada pela organização responsável." },
      verified: { label: "Verificado digitalmente", detail: "A integridade do registro de amostra foi verificada; isso não certifica o produto físico." },
      unavailable: { label: "Não disponível", detail: "O campo não foi publicado ou não está habilitado para esta função." },
    },
    disclaimer: "Demo ilustrativa. A disponibilidade depende do produto, do passaporte configurado e das permissões. A verificação digital, por si só, não certifica a autenticidade física.",
    cta: "Explorar o Demo Lab",
    tabsLabel: "Escolher a visão do passaporte por função",
    roles: {
      person: {
        label: "Pessoa",
        shortLabel: "Consulta pública",
        scope: "Informação para quem usa ou compra o produto",
        description: "Vê a história, as instruções e os serviços que a marca decidiu publicar para este produto.",
        condition: "Somente campos públicos. Dados pessoais exigem consentimento explícito.",
        journey: {
          who: "Uma pessoa abre o NFC ou QR pelo celular, sem instalar um aplicativo.",
          receives: "A ficha pública atual: identidade, história, origem e instruções ou serviços habilitados.",
          protected: "Sua identidade e os dados internos não são expostos. Dados pessoais exigem consentimento explícito.",
          returns: "A leitura do produto e a ação escolhida podem ser registradas; isso não identifica automaticamente a pessoa.",
        },
        fields: [
          { label: "História e origem", value: "Safra 2022 · Valle de Uco", source: "Declaração do produtor", responsible: "Bodega Balmec", granularity: "Lote", updated: "Atualização de amostra", visibility: "Pública", evidence: "declared" },
          { label: "Identificador do passaporte", value: "NEX-DEMO · RA-2407", source: "Registro digital de amostra", responsible: "nexID Demo", granularity: "Lote", updated: "Ao abrir esta demo", visibility: "Pública", evidence: "verified" },
          { label: "Dados internos de operação", value: "Não visíveis na experiência pública", source: "Sistema da marca", responsible: "Equipe autorizada", granularity: "Item", updated: "Não informada", visibility: "Restrita", evidence: "unavailable" },
        ],
      },
      brand: {
        label: "Marca",
        shortLabel: "Gestão do passaporte",
        scope: "Conteúdo, versões e atividade autorizada",
        description: "Publica a ficha, mantém versões e consulta sinais permitidos para melhorar informação e serviço.",
        condition: "Interações pessoais só são vinculadas quando existe uma base válida e o consentimento aplicável.",
        journey: {
          who: "A equipe autorizada da empresa responsável pelo passaporte.",
          receives: "Gestão de conteúdo, versões, lotes e atividade operacional disponível conforme a permissão.",
          protected: "Dados pessoais permanecem separados, salvo base válida e consentimento aplicável.",
          returns: "O dashboard organiza toques e ações registradas com produto, lote, canal e procedência disponível.",
        },
        fields: [
          { label: "Ficha do produto", value: "História, origem e recomendações", source: "Gestor de conteúdo DPP", responsible: "Bodega Balmec", granularity: "Modelo + lote", updated: "Versão demo vigente", visibility: "Publicável", evidence: "declared" },
          { label: "Integridade da versão", value: "Registro de amostra sem alterações pendentes", source: "Controle digital de versões", responsible: "nexID Demo", granularity: "Lote", updated: "Ao confirmar a versão", visibility: "Equipe da marca", evidence: "verified" },
          { label: "Identidade da pessoa", value: "Não disponível sem consentimento", source: "Preferências de privacidade", responsible: "Titular dos dados", granularity: "Item", updated: "Não se aplica", visibility: "Protegida", evidence: "unavailable" },
        ],
      },
      service: {
        label: "Serviço / canal",
        shortLabel: "Atendimento com contexto",
        scope: "Somente o necessário para resolver uma tarefa",
        description: "Recebe o contexto do lote e do serviço atribuído, sem abrir todas as informações internas do passaporte.",
        condition: "A organização define quais campos compartilha, com qual operador e por quanto tempo.",
        journey: {
          who: "Um operador ou canal habilitado pela empresa para resolver uma solicitação.",
          receives: "Somente o contexto mínimo do produto, lote e serviço iniciado.",
          protected: "Não recebe o perfil completo nem informações internas fora da sua permissão.",
          returns: "O caso e seu acompanhamento podem ficar vinculados ao produto para atendimento e pós-venda.",
        },
        fields: [
          { label: "Caso de serviço", value: "Consulta de conservação iniciada", source: "Ação escolhida na experiência", responsible: "Atendimento de amostra", granularity: "Item", updated: "Ao iniciar o caso demo", visibility: "Operador atribuído", evidence: "verified" },
          { label: "Contexto compartilhado", value: "Reserva Andina · Lote RA-2407", source: "Passaporte publicado", responsible: "Bodega Balmec", granularity: "Lote", updated: "Versão demo vigente", visibility: "Serviço autorizado", evidence: "declared" },
          { label: "Perfil completo da pessoa", value: "Não é necessário para resolver esta consulta", source: "Política de minimização", responsible: "Organização responsável", granularity: "Item", updated: "Não se aplica", visibility: "Não compartilhada", evidence: "unavailable" },
        ],
      },
      circularity: {
        label: "Circularidade / autoridade",
        shortLabel: "Informação aplicável",
        scope: "Materiais, instruções e evidência por permissão",
        description: "Consulta campos de circularidade ou controle somente quando se aplicam ao produto e a função está autorizada.",
        condition: "Esta visão não implica conformidade automática nem substitui a validação de uma autoridade.",
        journey: {
          who: "Um operador de circularidade ou uma autoridade com acesso aplicável.",
          receives: "Materiais, instruções, fonte e responsável publicados para o produto e o mercado.",
          protected: "Campos não aplicáveis ou não autorizados permanecem ocultos.",
          returns: "A consulta contribui para a rastreabilidade operacional; não implica conformidade automática nem certificação.",
        },
        fields: [
          { label: "Composição da embalagem", value: "Vidro e componentes declarados", source: "Ficha técnica da embalagem", responsible: "Produtor da amostra", granularity: "Modelo", updated: "Versão demo vigente", visibility: "Conforme a função", evidence: "declared" },
          { label: "Instruções de recuperação", value: "Separação e circuito a definir por mercado", source: "Conteúdo de circularidade", responsible: "Operador responsável", granularity: "Modelo + mercado", updated: "Ao publicar alterações", visibility: "Pública se aplicável", evidence: "declared" },
          { label: "Certificação regulatória", value: "Não incluída neste cenário ilustrativo", source: "Documento não fornecido", responsible: "Não informado", granularity: "Modelo", updated: "Não disponível", visibility: "Não publicada", evidence: "unavailable" },
        ],
      },
    },
  },
  en: {
    sample: "Illustrative scenario · No production data",
    mode: "Role-based access",
    eyebrow: "DIGITAL PRODUCT PASSPORT EXPLORER",
    title: "One passport. The right information for each role.",
    intro: "There is one record, but not everyone sees the same view. Switch roles to check what each participant receives and what remains protected.",
    guideLabel: "How to explore the passport",
    guideSteps: ["Choose who is viewing", "See which information they receive", "Check source, owner and status"],
    journeyTitle: "What happens for this participant",
    journeyIntro: "Follow the journey before opening the technical detail.",
    journeyLabels: ["Who is viewing", "What they receive", "What stays protected", "What returns to the company"],
    technicalToggle: "View sources, owners and evidence",
    technicalHint: "Auditable passport detail for this view",
    passportLabel: "Sample digital product passport",
    product: "Reserva Andina",
    passportId: "NEX-DEMO · RA-2407",
    recordLevel: "Record level",
    recordLevelValue: "Demonstration batch",
    activeView: "Active view",
    fieldLabel: "Field and value",
    sourceLabel: "Source",
    responsibleLabel: "Responsible party",
    granularityLabel: "Level",
    updatedLabel: "Last update",
    visibilityLabel: "Visibility",
    legendTitle: "How to read the evidence",
    evidenceLabel: "Status",
    legend: {
      declared: { label: "Declared", detail: "Information published by the responsible organization." },
      verified: { label: "Digitally verified", detail: "Sample-record integrity was checked; this does not certify the physical product." },
      unavailable: { label: "Unavailable", detail: "The field was not published or is not enabled for this role." },
    },
    disclaimer: "Illustrative demo. Availability depends on the product, configured passport and permissions. Digital verification alone does not certify physical authenticity.",
    cta: "Explore Demo Lab",
    tabsLabel: "Choose the passport view by role",
    roles: {
      person: {
        label: "Person",
        shortLabel: "Public view",
        scope: "Information for the person using or buying the product",
        description: "Sees the story, instructions and services the brand chose to publish for this product.",
        condition: "Public fields only. Personal data requires explicit consent.",
        journey: {
          who: "A person opens the NFC or QR from their phone without installing an app.",
          receives: "The current public record: identity, story, origin, and enabled instructions or services.",
          protected: "Their identity and internal data are not exposed. Sharing personal data requires explicit consent.",
          returns: "The product read and selected action may be recorded; that does not automatically identify the person.",
        },
        fields: [
          { label: "Story and origin", value: "2022 harvest · Valle de Uco", source: "Producer declaration", responsible: "Bodega Balmec", granularity: "Batch", updated: "Sample update", visibility: "Public", evidence: "declared" },
          { label: "Passport identifier", value: "NEX-DEMO · RA-2407", source: "Sample digital record", responsible: "nexID Demo", granularity: "Batch", updated: "When this demo opens", visibility: "Public", evidence: "verified" },
          { label: "Internal operations data", value: "Not visible in the public experience", source: "Brand system", responsible: "Authorized team", granularity: "Item", updated: "Not reported", visibility: "Restricted", evidence: "unavailable" },
        ],
      },
      brand: {
        label: "Brand",
        shortLabel: "Passport management",
        scope: "Content, versions and authorized activity",
        description: "Publishes the record, maintains its versions and reviews permitted signals to improve information and service.",
        condition: "Personal interactions are linked only when a valid basis and applicable consent exist.",
        journey: {
          who: "The authorized team at the company responsible for the passport.",
          receives: "Content, version and batch management plus operational activity available to its role.",
          protected: "Personal data stays separate unless a valid basis and applicable consent exist.",
          returns: "The dashboard organizes recorded taps and actions with available product, batch, channel and provenance.",
        },
        fields: [
          { label: "Product record", value: "Story, origin and recommendations", source: "DPP content manager", responsible: "Bodega Balmec", granularity: "Model + batch", updated: "Current demo version", visibility: "Publishable", evidence: "declared" },
          { label: "Version integrity", value: "Sample record with no pending changes", source: "Digital version control", responsible: "nexID Demo", granularity: "Batch", updated: "When the version is confirmed", visibility: "Brand team", evidence: "verified" },
          { label: "Person identity", value: "Unavailable without consent", source: "Privacy preferences", responsible: "Data subject", granularity: "Item", updated: "Not applicable", visibility: "Protected", evidence: "unavailable" },
        ],
      },
      service: {
        label: "Service / channel",
        shortLabel: "Contextual support",
        scope: "Only what is needed to resolve a task",
        description: "Receives the batch and assigned-service context without opening every internal passport field.",
        condition: "The organization defines which fields are shared, with which operator and for how long.",
        journey: {
          who: "An operator or channel enabled by the company to resolve a request.",
          receives: "Only the minimum product, batch and initiated-service context.",
          protected: "It does not receive the full profile or internal information outside its permission.",
          returns: "The case and follow-up can remain linked to the product for service and aftercare.",
        },
        fields: [
          { label: "Service case", value: "Storage question started", source: "Action selected in the experience", responsible: "Sample support desk", granularity: "Item", updated: "When the demo case starts", visibility: "Assigned operator", evidence: "verified" },
          { label: "Shared context", value: "Reserva Andina · Batch RA-2407", source: "Published passport", responsible: "Bodega Balmec", granularity: "Batch", updated: "Current demo version", visibility: "Authorized service", evidence: "declared" },
          { label: "Full person profile", value: "Not needed to resolve this request", source: "Data-minimization policy", responsible: "Responsible organization", granularity: "Item", updated: "Not applicable", visibility: "Not shared", evidence: "unavailable" },
        ],
      },
      circularity: {
        label: "Circularity / authority",
        shortLabel: "Applicable information",
        scope: "Materials, instructions and evidence by permission",
        description: "Accesses circularity or oversight fields only when they apply to the product and the role is authorized.",
        condition: "This view does not imply automatic regulatory compliance or replace an authority's validation.",
        journey: {
          who: "A circularity operator or authority with applicable access.",
          receives: "Published materials, instructions, source and responsible party for the product and market.",
          protected: "Fields that do not apply or are not authorized remain hidden.",
          returns: "The consultation can support operational traceability; it does not imply automatic compliance or certification.",
        },
        fields: [
          { label: "Packaging composition", value: "Declared glass and components", source: "Packaging technical record", responsible: "Sample producer", granularity: "Model", updated: "Current demo version", visibility: "Role dependent", evidence: "declared" },
          { label: "Recovery instructions", value: "Sorting and route to be defined per market", source: "Circularity content", responsible: "Responsible operator", granularity: "Model + market", updated: "When changes are published", visibility: "Public if applicable", evidence: "declared" },
          { label: "Regulatory certification", value: "Not included in this illustrative scenario", source: "No document provided", responsible: "Not reported", granularity: "Model", updated: "Unavailable", visibility: "Not published", evidence: "unavailable" },
        ],
      },
    },
  },
};

const INDUSTRY_PROFILES: Record<LocaleKey, Record<DppExplorerIndustry, IndustryProfile>> = {
  es: {
    bottles: {
      product: "Reserva Andina",
      passportId: "NEX-DEMO · RA-2407",
      recordLevelValue: "Lote de demostración",
      organization: "Bodega Balmec",
      contextReference: "Lote RA-2407",
      primaryLevel: "Lote",
      itemLevel: "Ítem",
      modelLevel: "Modelo",
      managementLevel: "Modelo + lote",
      marketLevel: "Modelo + mercado",
      publicFieldLabel: "Historia y origen",
      publicFieldValue: "Cosecha 2022 · Valle de Uco",
      publicFieldSource: "Declaración del productor",
      productRecordValue: "Historia, origen y recomendaciones",
      serviceCaseValue: "Consulta de conservación iniciada",
      serviceEventSource: "Acción elegida en la experiencia",
      serviceResponsible: "Mesa de atención de muestra",
      materialLabel: "Composición del envase",
      materialValue: "Vidrio y componentes declarados",
      materialSource: "Ficha técnica del envase",
      recoveryLabel: "Instrucciones de recuperación",
      recoveryValue: "Separación y circuito a definir por mercado",
      circularitySource: "Contenido de circularidad",
    },
    perfume: {
      product: "Estuche Aurora",
      passportId: "NEX-DEMO · EA-2047",
      recordLevelValue: "Ítem de demostración",
      organization: "Marca Aurora · demo",
      contextReference: "Ítem EA-2047",
      primaryLevel: "Ítem",
      itemLevel: "Ítem",
      modelLevel: "Modelo",
      managementLevel: "Modelo + ítem",
      marketLevel: "Modelo + mercado",
      publicFieldLabel: "Materiales e instrucciones",
      publicFieldValue: "Cartón, inserto y pautas de separación declaradas",
      publicFieldSource: "Ficha declarada del packaging",
      productRecordValue: "Materiales, componentes y cuidado del estuche",
      serviceCaseValue: "Consulta de separación iniciada",
      serviceEventSource: "Acción elegida desde el estuche",
      serviceResponsible: "Canal de atención de muestra",
      materialLabel: "Composición del packaging",
      materialValue: "Cartón, inserto y acabados declarados",
      materialSource: "Ficha técnica declarada",
      recoveryLabel: "Guía de separación",
      recoveryValue: "Indicaciones configuradas según material y mercado",
      circularitySource: "Contenido de packaging",
    },
    agro: {
      product: "Insumo Horizonte",
      passportId: "NEX-DEMO · AG-3184",
      recordLevelValue: "Lote de demostración",
      organization: "Agro Horizonte · demo",
      contextReference: "Lote AG-3184",
      primaryLevel: "Lote",
      itemLevel: "Ítem",
      modelLevel: "Modelo",
      managementLevel: "Modelo + lote",
      marketLevel: "Modelo + mercado",
      publicFieldLabel: "Lote e instrucciones publicadas",
      publicFieldValue: "AG-3184 · información declarada para uso y gestión",
      publicFieldSource: "Ficha declarada del insumo",
      productRecordValue: "Identidad de lote, instrucciones y documentación publicada",
      serviceCaseValue: "Consulta técnica iniciada",
      serviceEventSource: "Acción elegida desde el envase",
      serviceResponsible: "Canal técnico de muestra",
      materialLabel: "Materiales del envase",
      materialValue: "Bidón, tapa y componentes declarados",
      materialSource: "Ficha técnica declarada del envase",
      recoveryLabel: "Gestión posterior del envase",
      recoveryValue: "Indicaciones según el programa habilitado en cada mercado",
      circularitySource: "Contenido de gestión del envase",
    },
  },
  "pt-BR": {
    bottles: {
      product: "Reserva Andina",
      passportId: "NEX-DEMO · RA-2407",
      recordLevelValue: "Lote de demonstração",
      organization: "Bodega Balmec",
      contextReference: "Lote RA-2407",
      primaryLevel: "Lote",
      itemLevel: "Item",
      modelLevel: "Modelo",
      managementLevel: "Modelo + lote",
      marketLevel: "Modelo + mercado",
      publicFieldLabel: "História e origem",
      publicFieldValue: "Safra 2022 · Valle de Uco",
      publicFieldSource: "Declaração do produtor",
      productRecordValue: "História, origem e recomendações",
      serviceCaseValue: "Consulta de conservação iniciada",
      serviceEventSource: "Ação escolhida na experiência",
      serviceResponsible: "Atendimento de amostra",
      materialLabel: "Composição da embalagem",
      materialValue: "Vidro e componentes declarados",
      materialSource: "Ficha técnica da embalagem",
      recoveryLabel: "Instruções de recuperação",
      recoveryValue: "Separação e circuito a definir por mercado",
      circularitySource: "Conteúdo de circularidade",
    },
    perfume: {
      product: "Estuche Aurora",
      passportId: "NEX-DEMO · EA-2047",
      recordLevelValue: "Item de demonstração",
      organization: "Marca Aurora · demo",
      contextReference: "Item EA-2047",
      primaryLevel: "Item",
      itemLevel: "Item",
      modelLevel: "Modelo",
      managementLevel: "Modelo + item",
      marketLevel: "Modelo + mercado",
      publicFieldLabel: "Materiais e instruções",
      publicFieldValue: "Papel-cartão, inserto e orientações de separação declarados",
      publicFieldSource: "Ficha declarada da embalagem",
      productRecordValue: "Materiais, componentes e cuidados com o estojo",
      serviceCaseValue: "Consulta de separação iniciada",
      serviceEventSource: "Ação escolhida no estojo",
      serviceResponsible: "Canal de atendimento de amostra",
      materialLabel: "Composição da embalagem",
      materialValue: "Papel-cartão, inserto e acabamentos declarados",
      materialSource: "Ficha técnica declarada",
      recoveryLabel: "Guia de separação",
      recoveryValue: "Orientações configuradas conforme material e mercado",
      circularitySource: "Conteúdo da embalagem",
    },
    agro: {
      product: "Insumo Horizonte",
      passportId: "NEX-DEMO · AG-3184",
      recordLevelValue: "Lote de demonstração",
      organization: "Agro Horizonte · demo",
      contextReference: "Lote AG-3184",
      primaryLevel: "Lote",
      itemLevel: "Item",
      modelLevel: "Modelo",
      managementLevel: "Modelo + lote",
      marketLevel: "Modelo + mercado",
      publicFieldLabel: "Lote e instruções publicadas",
      publicFieldValue: "AG-3184 · informação declarada para uso e gestão",
      publicFieldSource: "Ficha declarada do insumo",
      productRecordValue: "Identidade do lote, instruções e documentação publicada",
      serviceCaseValue: "Consulta técnica iniciada",
      serviceEventSource: "Ação escolhida na embalagem",
      serviceResponsible: "Canal técnico de amostra",
      materialLabel: "Materiais da embalagem",
      materialValue: "Galão, tampa e componentes declarados",
      materialSource: "Ficha técnica declarada da embalagem",
      recoveryLabel: "Gestão posterior da embalagem",
      recoveryValue: "Orientações conforme o programa habilitado em cada mercado",
      circularitySource: "Conteúdo de gestão da embalagem",
    },
  },
  en: {
    bottles: {
      product: "Reserva Andina",
      passportId: "NEX-DEMO · RA-2407",
      recordLevelValue: "Demonstration batch",
      organization: "Bodega Balmec",
      contextReference: "Batch RA-2407",
      primaryLevel: "Batch",
      itemLevel: "Item",
      modelLevel: "Model",
      managementLevel: "Model + batch",
      marketLevel: "Model + market",
      publicFieldLabel: "Story and origin",
      publicFieldValue: "2022 harvest · Valle de Uco",
      publicFieldSource: "Producer declaration",
      productRecordValue: "Story, origin and recommendations",
      serviceCaseValue: "Storage question started",
      serviceEventSource: "Action selected in the experience",
      serviceResponsible: "Sample support desk",
      materialLabel: "Packaging composition",
      materialValue: "Declared glass and components",
      materialSource: "Packaging technical record",
      recoveryLabel: "Recovery instructions",
      recoveryValue: "Sorting and route to be defined per market",
      circularitySource: "Circularity content",
    },
    perfume: {
      product: "Estuche Aurora",
      passportId: "NEX-DEMO · EA-2047",
      recordLevelValue: "Demonstration item",
      organization: "Aurora Brand · demo",
      contextReference: "Item EA-2047",
      primaryLevel: "Item",
      itemLevel: "Item",
      modelLevel: "Model",
      managementLevel: "Model + item",
      marketLevel: "Model + market",
      publicFieldLabel: "Materials and instructions",
      publicFieldValue: "Declared paperboard, insert and sorting guidance",
      publicFieldSource: "Declared packaging record",
      productRecordValue: "Materials, components and pack care",
      serviceCaseValue: "Sorting question started",
      serviceEventSource: "Action selected from the pack",
      serviceResponsible: "Sample support channel",
      materialLabel: "Packaging composition",
      materialValue: "Declared paperboard, insert and finishes",
      materialSource: "Declared technical record",
      recoveryLabel: "Sorting guide",
      recoveryValue: "Guidance configured by material and market",
      circularitySource: "Packaging content",
    },
    agro: {
      product: "Insumo Horizonte",
      passportId: "NEX-DEMO · AG-3184",
      recordLevelValue: "Demonstration batch",
      organization: "Agro Horizonte · demo",
      contextReference: "Batch AG-3184",
      primaryLevel: "Batch",
      itemLevel: "Item",
      modelLevel: "Model",
      managementLevel: "Model + batch",
      marketLevel: "Model + market",
      publicFieldLabel: "Batch and published instructions",
      publicFieldValue: "AG-3184 · declared use and handling information",
      publicFieldSource: "Declared input record",
      productRecordValue: "Batch identity, instructions and published documents",
      serviceCaseValue: "Technical question started",
      serviceEventSource: "Action selected from the container",
      serviceResponsible: "Sample technical channel",
      materialLabel: "Container materials",
      materialValue: "Declared canister, cap and components",
      materialSource: "Declared container technical record",
      recoveryLabel: "Post-use container handling",
      recoveryValue: "Guidance based on the program enabled in each market",
      circularitySource: "Container handling content",
    },
  },
};

function getIndustryFields(copy: ExplorerCopy, profile: IndustryProfile, role: RoleKey): PassportField[] {
  const [first, second, third] = copy.roles[role].fields;

  if (role === "person") {
    return [
      {
        ...first,
        label: profile.publicFieldLabel,
        value: profile.publicFieldValue,
        source: profile.publicFieldSource,
        responsible: profile.organization,
        granularity: profile.primaryLevel,
      },
      {
        ...second,
        value: profile.passportId,
        granularity: profile.primaryLevel,
      },
      { ...third, granularity: profile.itemLevel },
    ];
  }

  if (role === "brand") {
    return [
      {
        ...first,
        value: profile.productRecordValue,
        responsible: profile.organization,
        granularity: profile.managementLevel,
      },
      { ...second, granularity: profile.primaryLevel },
      { ...third, granularity: profile.itemLevel },
    ];
  }

  if (role === "service") {
    return [
      {
        ...first,
        value: profile.serviceCaseValue,
        source: profile.serviceEventSource,
        responsible: profile.serviceResponsible,
        granularity: profile.itemLevel,
      },
      {
        ...second,
        value: `${profile.product} · ${profile.contextReference}`,
        responsible: profile.organization,
        granularity: profile.primaryLevel,
      },
      { ...third, granularity: profile.itemLevel },
    ];
  }

  return [
    {
      ...first,
      label: profile.materialLabel,
      value: profile.materialValue,
      source: profile.materialSource,
      responsible: profile.organization,
      granularity: profile.modelLevel,
    },
    {
      ...second,
      label: profile.recoveryLabel,
      value: profile.recoveryValue,
      source: profile.circularitySource,
      responsible: profile.organization,
      granularity: profile.marketLevel,
    },
    { ...third, granularity: profile.modelLevel },
  ];
}

function resolveLocale(locale: string): LocaleKey {
  if (locale === "en") return "en";
  if (locale === "pt-BR" || locale.startsWith("pt")) return "pt-BR";
  return "es";
}

export function DppRoleExplorer({ locale, industry }: { locale: string; industry?: DppExplorerIndustry }) {
  const localeKey = resolveLocale(locale);
  const copy = COPY[localeKey];
  const sharedIndustry = useConnectedProductIndustry();
  const activeIndustry = industry ?? sharedIndustry?.activeIndustry ?? "bottles";
  const industryProfile = INDUSTRY_PROFILES[localeKey][activeIndustry];
  const [selectedRole, setSelectedRole] = useState<RoleKey>("person");
  const [tabOrientation, setTabOrientation] = useState<"vertical" | "horizontal">("vertical");
  const baseId = useId();
  const explorerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<RoleKey, HTMLButtonElement | null>>({
    person: null,
    brand: null,
    service: null,
    circularity: null,
  });
  const selectedView = copy.roles[selectedRole];
  const selectedFields = getIndustryFields(copy, industryProfile, selectedRole);
  const ActiveRoleIcon = ROLE_ICONS[selectedRole];
  const journeyCards = [
    { key: "who", label: copy.journeyLabels[0], body: selectedView.journey.who, Icon: ActiveRoleIcon },
    { key: "receives", label: copy.journeyLabels[1], body: selectedView.journey.receives, Icon: Eye },
    { key: "protected", label: copy.journeyLabels[2], body: selectedView.journey.protected, Icon: LockKeyhole },
    { key: "returns", label: copy.journeyLabels[3], body: selectedView.journey.returns, Icon: BarChart3 },
  ] as const;

  useEffect(() => {
    const explorer = explorerRef.current;
    if (!explorer || typeof ResizeObserver === "undefined") return;

    const syncOrientation = (width: number) => {
      const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      setTabOrientation(width <= 62 * rootFontSize ? "horizontal" : "vertical");
    };

    syncOrientation(explorer.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) syncOrientation(entry.contentRect.width);
    });
    observer.observe(explorer);
    return () => observer.disconnect();
  }, []);

  function selectRole(role: RoleKey) {
    setSelectedRole(role);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentRole: RoleKey) {
    const currentIndex = ROLE_KEYS.indexOf(currentRole);
    let targetIndex: number | null = null;

    if ((tabOrientation === "horizontal" && event.key === "ArrowRight") || (tabOrientation === "vertical" && event.key === "ArrowDown")) {
      targetIndex = (currentIndex + 1) % ROLE_KEYS.length;
    }
    if ((tabOrientation === "horizontal" && event.key === "ArrowLeft") || (tabOrientation === "vertical" && event.key === "ArrowUp")) {
      targetIndex = (currentIndex - 1 + ROLE_KEYS.length) % ROLE_KEYS.length;
    }
    if (event.key === "Home") targetIndex = 0;
    if (event.key === "End") targetIndex = ROLE_KEYS.length - 1;
    if (targetIndex === null) return;

    event.preventDefault();
    const targetRole = ROLE_KEYS[targetIndex];
    selectRole(targetRole);
    tabRefs.current[targetRole]?.focus();
  }

  return (
    <div ref={explorerRef} className={styles.explorer} data-role={selectedRole} data-industry={activeIndustry}>
      <div className={styles.topbar}>
        <span className={styles.sampleBadge}><ShieldCheck aria-hidden="true" />{copy.sample}</span>
        <span className={styles.modeBadge}><Eye aria-hidden="true" />{copy.mode}</span>
      </div>

      <div className={styles.intro}>
        <div className={styles.introCopy}>
          <p>{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <span>{copy.intro}</span>
        </div>

        <div className={styles.accessMap} aria-hidden="true">
          <span className={styles.orbit} />
          <span className={styles.orbitPulse} />
          <span className={styles.dataPath} />
          <span className={styles.passportCore}><Database /></span>
          {ROLE_KEYS.map((role, index) => {
            const RoleIcon = ROLE_ICONS[role];
            return (
              <span key={role} className={styles.accessNode} data-node={role} data-active={selectedRole === role} style={{ "--node-index": index } as CSSProperties}>
                <RoleIcon />
              </span>
            );
          })}
        </div>
      </div>

      <ol className={styles.guide} aria-label={copy.guideLabel}>
        {copy.guideSteps.map((step, index) => (
          <li key={step}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step}</strong>
          </li>
        ))}
      </ol>

      <div className={styles.workspace}>
        <div className={styles.roleRail} role="tablist" aria-label={copy.tabsLabel} aria-orientation={tabOrientation}>
          {ROLE_KEYS.map((role) => {
            const item = copy.roles[role];
            const RoleIcon = ROLE_ICONS[role];
            const isSelected = selectedRole === role;
            return (
              <button
                key={role}
                ref={(element) => { tabRefs.current[role] = element; }}
                id={`${baseId}-${role}-tab`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`${baseId}-role-panel`}
                tabIndex={isSelected ? 0 : -1}
                className={styles.roleTab}
                onClick={() => selectRole(role)}
                onKeyDown={(event) => handleTabKeyDown(event, role)}
              >
                <span className={styles.roleIcon}><RoleIcon aria-hidden="true" /></span>
                <span className={styles.roleText}><strong>{item.label}</strong><small>{item.shortLabel}</small></span>
                <ArrowRight className={styles.roleArrow} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div
          key={`${activeIndustry}-${selectedRole}`}
          id={`${baseId}-role-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-${selectedRole}-tab`}
          tabIndex={0}
          className={styles.passportPanel}
        >
          <div className={styles.recordHeader}>
            <div className={styles.recordIdentity}>
              <span className={styles.recordIcon}><ActiveRoleIcon aria-hidden="true" /></span>
              <span>
                <small>{copy.passportLabel}</small>
                <strong>{industryProfile.product}</strong>
                <em>{industryProfile.passportId}</em>
              </span>
            </div>
            <div className={styles.recordMeta}>
              <span><small>{copy.recordLevel}</small><strong>{industryProfile.recordLevelValue}</strong></span>
              <span><small>{copy.activeView}</small><strong>{selectedView.label}</strong></span>
            </div>
          </div>

          <section className={styles.roleJourney} aria-labelledby={`${baseId}-journey-title`}>
            <header className={styles.roleJourneyHeader}>
              <span className={styles.roleSummaryIcon}><ActiveRoleIcon aria-hidden="true" /></span>
              <div>
                <small>{copy.journeyTitle}</small>
                <strong id={`${baseId}-journey-title`}>{selectedView.scope}</strong>
                <p>{selectedView.description} {copy.journeyIntro}</p>
              </div>
            </header>

            <ol className={styles.journeyGrid}>
              {journeyCards.map(({ key, label, body, Icon }, index) => (
                <li key={key} data-journey={key} style={{ "--journey-index": index } as CSSProperties}>
                  <span className={styles.journeyIcon}><Icon aria-hidden="true" /></span>
                  <span className={styles.journeyNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{label}</strong>
                  <p>{body}</p>
                  {index < journeyCards.length - 1 ? <ArrowRight className={styles.journeyArrow} aria-hidden="true" /> : null}
                </li>
              ))}
            </ol>
          </section>

          <details className={styles.technicalDetails}>
            <summary>
              <span className={styles.technicalSummaryIcon}><Database aria-hidden="true" /></span>
              <span><strong>{copy.technicalToggle}</strong><small>{copy.technicalHint}</small></span>
              <ArrowRight className={styles.technicalSummaryArrow} aria-hidden="true" />
            </summary>
            <div className={styles.technicalContent}>
              <div className={styles.tableHeader} aria-hidden="true">
                <span>{copy.fieldLabel}</span>
                <span>{copy.sourceLabel} · {copy.responsibleLabel}</span>
                <span>{copy.granularityLabel} · {copy.updatedLabel}</span>
                <span>{copy.evidenceLabel}</span>
              </div>

              <ul className={styles.fieldList}>
                {selectedFields.map((field, index) => {
                  const EvidenceIcon = EVIDENCE_ICONS[field.evidence];
                  return (
                    <li key={`${activeIndustry}-${selectedRole}-${field.label}`} className={styles.fieldRow} data-evidence={field.evidence} style={{ "--row-index": index } as CSSProperties}>
                      <div className={styles.fieldPrimary}>
                        <small>{field.label}</small>
                        <strong>{field.value}</strong>
                      </div>
                      <dl className={styles.fieldDetails}>
                        <div><dt>{copy.sourceLabel}</dt><dd>{field.source}</dd></div>
                        <div><dt>{copy.responsibleLabel}</dt><dd>{field.responsible}</dd></div>
                      </dl>
                      <dl className={styles.fieldDetails}>
                        <div><dt>{copy.granularityLabel}</dt><dd>{field.granularity}</dd></div>
                        <div><dt>{copy.updatedLabel}</dt><dd>{field.updated}</dd></div>
                        <div><dt>{copy.visibilityLabel}</dt><dd>{field.visibility}</dd></div>
                      </dl>
                      <span className={styles.evidenceStatus}>
                        <EvidenceIcon aria-hidden="true" />
                        {copy.legend[field.evidence].label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.legend}>
          <strong>{copy.legendTitle}</strong>
          <div>
            {(Object.keys(copy.legend) as EvidenceKey[]).map((evidence) => {
              const EvidenceIcon = EVIDENCE_ICONS[evidence];
              return (
                <span key={evidence} className={styles.legendItem} data-evidence={evidence}>
                  <EvidenceIcon aria-hidden="true" />
                  <span><strong>{copy.legend[evidence].label}</strong><small>{copy.legend[evidence].detail}</small></span>
                </span>
              );
            })}
          </div>
        </div>
        <div className={styles.footerAction}>
          <p><CircleDashed aria-hidden="true" />{copy.disclaimer}</p>
          <Link href={`/demo-lab?profile=${DEMO_PROFILE_BY_INDUSTRY[activeIndustry]}`}>{copy.cta}<ArrowRight aria-hidden="true" /></Link>
        </div>
      </div>
    </div>
  );
}
