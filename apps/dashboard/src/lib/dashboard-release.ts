export const DASHBOARD_RELEASE='2026.09.19-dashboard.25';
export const DASHBOARD_RELEASE_DATE='2026-09-19';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "S4 · revisión editorial",
    "title": "Cada cambio, con su contexto.",
    "summary": "Passport Studio permite comparar contenido público, trabajo guardado, cambios locales y revisiones históricas antes de restaurar o publicar.",
    "back": "Abrir lotes",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Cómo usar esta entrega",
    "steps": [
      "Abrí Passport Studio del lote y entrá a Cambios.",
      "Elegí dos fuentes: contenido público, borrador guardado, trabajo local o revisión histórica.",
      "Filtrá añadidos, modificaciones y retirados por sección o texto.",
      "Revisá el efecto de recuperar contenido; guardar, revisar y publicar siguen siendo acciones distintas."
    ],
    "boundary": "Comparar no escribe ni publica. Una revisión histórica no es una versión publicada; una URL distinta no prueba el contenido ni la vigencia del documento enlazado.",
    "cards": [
      {
        "title": "Historial comparable",
        "text": "Elegí revisiones recibidas del servidor y comparalas con el trabajo actual sin restaurarlas.",
        "tag": "Versiones"
      },
      {
        "title": "Diferencias claras",
        "text": "Campos añadidos, modificados y retirados con fuentes explícitas y filtros locales.",
        "tag": "Revisión"
      },
      {
        "title": "Confirmaciones con contexto",
        "text": "La restauración muestra los campos que reemplazará. Enviar, aprobar y publicar muestran el alcance sobre el contenido público.",
        "tag": "Control"
      },
      {
        "title": "Conflictos recuperables",
        "text": "Releer versión guardada ahora pide confirmación antes de descartar cambios locales; Escape no reutiliza una confirmación anterior.",
        "tag": "Operación"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "S4 · editorial review",
    "title": "Every change in context.",
    "summary": "Compare published content, saved work, local changes and historical revisions before restoring or publishing.",
    "back": "Open batches",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Get started",
    "steps": [
      "Open the batch Passport Studio and select Changes.",
      "Choose public content, saved work, local work or a historical revision.",
      "Filter added, changed and removed fields by section or text.",
      "Review what restoring content would replace; saving, review and publication remain separate."
    ],
    "boundary": "Comparison makes no writes. A historical revision is not a publication, and a different URL does not prove the content or validity of its linked document.",
    "cards": [
      {
        "title": "Comparable history",
        "text": "Compare loaded historical revisions without restoring them.",
        "tag": "Versions"
      },
      {
        "title": "Visible differences",
        "text": "Added, changed and removed fields keep explicit sources and local filters.",
        "tag": "Review"
      },
      {
        "title": "Contextual confirmation",
        "text": "Restoring and publishing show the scope of the content changes before confirmation.",
        "tag": "Control"
      },
      {
        "title": "Recoverable conflicts",
        "text": "Reloading a newer revision requires explicit local-discard confirmation. Escape never reuses a previous confirmation.",
        "tag": "Operations"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "S4 · revisão editorial",
    "title": "Cada mudança, com seu contexto.",
    "summary": "Compare conteúdo público, trabalho salvo, alterações locais e revisões históricas antes de restaurar ou publicar.",
    "back": "Abrir lotes",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Como começar",
    "steps": [
      "Abra o Passport Studio do lote e entre em Mudanças.",
      "Escolha conteúdo público, trabalho salvo, alterações locais ou revisão histórica.",
      "Filtre campos adicionados, alterados e retirados por seção ou texto.",
      "Revise o efeito da restauração; salvar, revisar e publicar continuam separados."
    ],
    "boundary": "Comparar não escreve nem publica. Uma revisão histórica não é uma publicação; uma URL diferente não comprova o conteúdo ou a validade do documento externo.",
    "cards": [
      {
        "title": "Histórico comparável",
        "text": "Compare revisões recebidas sem restaurá-las.",
        "tag": "Versões"
      },
      {
        "title": "Diferenças claras",
        "text": "Campos adicionados, alterados e retirados com fontes e filtros locais.",
        "tag": "Revisão"
      },
      {
        "title": "Confirmação com contexto",
        "text": "Restaurar e publicar mostram o alcance editorial antes da confirmação.",
        "tag": "Controle"
      },
      {
        "title": "Conflitos recuperáveis",
        "text": "Reler a revisão salva exige confirmação antes de descartar o trabalho local. Escape não reutiliza uma confirmação anterior.",
        "tag": "Operação"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
