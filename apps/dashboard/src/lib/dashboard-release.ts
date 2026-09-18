/** Public, non-operational release metadata. Never add tenant or provider credentials here. */
export const DASHBOARD_RELEASE = "2026.09.17-dashboard.5";
export const DASHBOARD_RELEASE_DATE = "2026-09-17";
export const RELEASE_NOTES = {
  "es-AR": {
    link: "Novedades y versión", eyebrow: "Evolución del centro de control", title: "El mapa y tu operación, conectados.",
    summary: "Mapa profesional accesible desde el CRM y Analítica. Un recorrido guiado para configurar la ficha del producto y recibir el manifiesto de cada rollo, conservando permisos y controles.",
    back: "Ir al centro de control", site: "Sitio de nexID", label: "Versión de esta interfaz", changes: "Qué cambió", guide: "Cómo probar esta entrega",
    steps: ["Ingresá con tu cuenta habitual. Desde tu perfil, abrí Configuración del workspace para ver la navegación por tareas.", "Explorá los grupos de tareas. Solo verás las secciones habilitadas para tu rol.", "En el celular, abrí y cerrá el menú. Con teclado, probá Tab y Escape.", "Volvé a esta página desde Novedades y versión para identificar la entrega."],
    boundary: "Esta página describe cambios de la interfaz; no es un monitor de disponibilidad ni una certificación de la API o de los TAP. No muestra datos de empresas ni consulta la base de datos.",
    cards: [
      { title: "Mapa profesional visible", text: "El mapa original del CRM se conserva. El centro geográfico suma calles, satélite, relieve, densidad, filtros y evidencia de las lecturas. Sin coordenadas, no se inventan puntos.", tag: "Organización" },
      { title: "Recepción guiada del rollo", text: "Seleccioná el archivo, validalo contra el servidor y confirmá la importación. No se activan etiquetas, no se exportan claves y no se reemplaza el protocolo de calidad.", tag: "Accesibilidad" },
      { title: "Ficha común, sin mezclar rubros", text: "Editá producto, marca, SKU, lote visible e imagen. Los campos avanzados de vino quedan separados; solo se envían los campos que cambiaste.", tag: "Uso responsable" },
      { title: "Versiones fáciles de reconocer", text: "La consulta geográfica usa una muestra acotada. Buscar dentro de ella o cambiar capas no crea consultas periódicas a la base. La fuente y las limitaciones permanecen visibles.", tag: "Trazabilidad" },
    ],
  },
  en: {
    link: "What's new and version", eyebrow: "Your control center, improved", title: "Your map and operations, connected.",
    summary: "Clearer navigation to find products, review scans and manage your team. The same permissions, organized around your work.",
    back: "Open control center", site: "nexID website", label: "This interface version", changes: "What's changed", guide: "Try this release",
    steps: ["Sign in with your usual account. From your profile, open Workspace settings to see task navigation.", "Explore the task groups. Only sections allowed for your role are shown.", "On mobile, open and close the menu. With a keyboard, try Tab and Escape.", "Return through What's new and version to identify the release."],
    boundary: "This page describes interface changes, not live availability or API/NFC certification. It contains no company data and does not query the database.",
    cards: [
      { title: "Professional geographic workspace", text: "The original CRM map remains available. The geographic workspace adds layers, sample filters and recorded reading evidence without inventing locations.", tag: "Organization" },
      { title: "Guided roll intake", text: "Choose a supplier manifest, validate it with the server, then confirm import. This does not activate tags or replace quality approval.", tag: "Accessibility" },
      { title: "Shared product identity", text: "Edit shared product, brand, SKU, lot and image fields. Wine-specific fields remain separate; only changed fields are submitted.", tag: "Responsible usage" },
      { title: "Recognizable releases", text: "Each panel release has a visible reference and concrete notes, so you can identify the version when reporting a problem.", tag: "Traceability" },
    ],
  },
  "pt-BR": {
    link: "Novidades e versão", eyebrow: "Evolução do centro de controle", title: "Seu mapa e sua operação, conectados.",
    summary: "Navegação mais clara para encontrar produtos, revisar leituras e gerenciar sua equipe. As mesmas permissões, organizadas em torno do seu trabalho.",
    back: "Ir ao centro de controle", site: "Site da nexID", label: "Versão desta interface", changes: "O que mudou", guide: "Como testar esta entrega",
    steps: ["Entre com sua conta habitual. No seu perfil, abra a configuração do workspace para ver a navegação por tarefas.", "Explore os grupos de tarefas. Você verá apenas as seções permitidas para seu perfil.", "No celular, abra e feche o menu. Com teclado, teste Tab e Escape.", "Volte por Novidades e versão para identificar a entrega."],
    boundary: "Esta página descreve mudanças da interface, não disponibilidade ao vivo nem certificação da API ou de leituras NFC. Não mostra dados de empresas nem consulta o banco de dados.",
    cards: [
      { title: "Mapa profissional acessível", text: "O mapa original permanece disponível. O centro geográfico reúne camadas, filtros e evidências das leituras, sem inventar localizações.", tag: "Organização" },
      { title: "Recebimento guiado do rolo", text: "Escolha o manifesto do fornecedor, valide no servidor e confirme a importação. Isso não ativa etiquetas nem substitui o controle de qualidade.", tag: "Acessibilidade" },
      { title: "Identidade comum do produto", text: "Edite produto, marca, SKU, lote e imagem. Campos de vinho ficam separados e somente os campos alterados são enviados.", tag: "Uso responsável" },
      { title: "Versões reconhecíveis", text: "Cada entrega do painel tem uma referência visível e notas concretas para identificar a versão ao relatar um problema.", tag: "Rastreabilidade" },
    ],
  },
} as const;
export function releaseCopy(locale: string) { return RELEASE_NOTES[locale === "en" || locale === "pt-BR" ? locale : "es-AR"]; }
