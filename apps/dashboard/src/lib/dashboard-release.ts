/** Public, non-operational release metadata. Never add tenant or provider credentials here. */
export const DASHBOARD_RELEASE = "2026.09.17-dashboard.4";
export const DASHBOARD_RELEASE_DATE = "2026-09-17";
export const RELEASE_NOTES = {
  "es-AR": {
    link: "Novedades y versión", eyebrow: "Evolución del centro de control", title: "Menos búsqueda. Más operación.",
    summary: "Una navegación más clara para encontrar tus productos, revisar lecturas y gestionar tu equipo. Los mismos permisos, organizados alrededor de tu trabajo.",
    back: "Ir al centro de control", site: "Sitio de nexID", label: "Versión de esta interfaz", changes: "Qué cambió", guide: "Cómo probar esta entrega",
    steps: ["Ingresá con tu cuenta habitual. Desde tu perfil, abrí Configuración del workspace para ver la navegación por tareas.", "Explorá los grupos de tareas. Solo verás las secciones habilitadas para tu rol.", "En el celular, abrí y cerrá el menú. Con teclado, probá Tab y Escape.", "Volvé a esta página desde Novedades y versión para identificar la entrega."],
    boundary: "Esta página describe cambios de la interfaz; no es un monitor de disponibilidad ni una certificación de la API o de los TAP. No muestra datos de empresas ni consulta la base de datos.",
    cards: [
      { title: "Navegación por tareas", text: "Operación, productos y pasaportes, clientes, integraciones y administración. Las demos y los materiales comerciales tienen su propio grupo.", tag: "Organización" },
      { title: "Un menú móvil más accesible", text: "El foco del teclado permanece dentro del menú abierto. Escape lo cierra y devuelve el foco al botón; el contenido de fondo no interfiere.", tag: "Accesibilidad" },
      { title: "Carga al elegir una sección", text: "Los enlaces del menú no precargan módulos por aparecer en pantalla. Se abren cuando decidís navegar, sin añadir consultas periódicas.", tag: "Uso responsable" },
      { title: "Versiones fáciles de reconocer", text: "Cada entrega del panel tiene una referencia visible y notas concretas. Podés indicar qué versión estás probando al reportar un problema.", tag: "Trazabilidad" },
    ],
  },
  en: {
    link: "What's new and version", eyebrow: "Your control center, improved", title: "Less searching. More operating.",
    summary: "Clearer navigation to find products, review scans and manage your team. The same permissions, organized around your work.",
    back: "Open control center", site: "nexID website", label: "This interface version", changes: "What's changed", guide: "Try this release",
    steps: ["Sign in with your usual account. From your profile, open Workspace settings to see task navigation.", "Explore the task groups. Only sections allowed for your role are shown.", "On mobile, open and close the menu. With a keyboard, try Tab and Escape.", "Return through What's new and version to identify the release."],
    boundary: "This page describes interface changes, not live availability or API/NFC certification. It contains no company data and does not query the database.",
    cards: [
      { title: "Task-based navigation", text: "Operations, products and passports, customers, integrations and administration. Demos and sales materials have a separate group.", tag: "Organization" },
      { title: "A more accessible mobile menu", text: "Keyboard focus stays inside the open menu. Escape closes it and returns focus to its button; background content does not interfere.", tag: "Accessibility" },
      { title: "Load sections when chosen", text: "Menu links do not prefetch modules just because they are visible. They open when you navigate, without new periodic queries.", tag: "Responsible usage" },
      { title: "Recognizable releases", text: "Each panel release has a visible reference and concrete notes, so you can identify the version when reporting a problem.", tag: "Traceability" },
    ],
  },
  "pt-BR": {
    link: "Novidades e versão", eyebrow: "Evolução do centro de controle", title: "Menos procura. Mais operação.",
    summary: "Navegação mais clara para encontrar produtos, revisar leituras e gerenciar sua equipe. As mesmas permissões, organizadas em torno do seu trabalho.",
    back: "Ir ao centro de controle", site: "Site da nexID", label: "Versão desta interface", changes: "O que mudou", guide: "Como testar esta entrega",
    steps: ["Entre com sua conta habitual. No seu perfil, abra a configuração do workspace para ver a navegação por tarefas.", "Explore os grupos de tarefas. Você verá apenas as seções permitidas para seu perfil.", "No celular, abra e feche o menu. Com teclado, teste Tab e Escape.", "Volte por Novidades e versão para identificar a entrega."],
    boundary: "Esta página descreve mudanças da interface, não disponibilidade ao vivo nem certificação da API ou de leituras NFC. Não mostra dados de empresas nem consulta o banco de dados.",
    cards: [
      { title: "Navegação por tarefas", text: "Operação, produtos e passaportes, clientes, integrações e administração. Demos e materiais comerciais têm seu próprio grupo.", tag: "Organização" },
      { title: "Menu móvel mais acessível", text: "O foco do teclado permanece dentro do menu aberto. Escape fecha o menu e devolve o foco ao botão; o conteúdo de fundo não interfere.", tag: "Acessibilidade" },
      { title: "Carregar ao escolher uma seção", text: "Os links do menu não pré-carregam módulos apenas por estarem visíveis. Eles abrem ao navegar, sem novas consultas periódicas.", tag: "Uso responsável" },
      { title: "Versões reconhecíveis", text: "Cada entrega do painel tem uma referência visível e notas concretas para identificar a versão ao relatar um problema.", tag: "Rastreabilidade" },
    ],
  },
} as const;
export function releaseCopy(locale: string) { return RELEASE_NOTES[locale === "en" || locale === "pt-BR" ? locale : "es-AR"]; }
