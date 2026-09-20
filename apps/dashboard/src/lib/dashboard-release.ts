export const DASHBOARD_RELEASE='2026.09.20-dashboard.27';
export const DASHBOARD_RELEASE_DATE='2026-09-20';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "S4 · contenido publicado reutilizable",
    "title": "Prepará el próximo lote sin empezar de cero.",
    "summary": "Buscá una publicación de la misma empresa, compará sus campos con el trabajo actual y elegí qué reutilizar. El lote destino conserva su propia revisión y aprobación.",
    "back": "Abrir lotes",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Recorrido",
    "steps": [
      "Abrí un borrador editable en Passport Studio y elegí Reutilizar contenido.",
      "Buscá contenido ya publicado de la misma empresa, plantilla e idioma.",
      "Seleccioná campos después de revisar ambos valores; no se marca ninguno automáticamente.",
      "Aplicá la preparación local, guardá y seguí el circuito de revisión del lote destino."
    ],
    "boundary": "La biblioteca no inscribe ni publica lotes. No copia identificadores, fechas, avisos ni datos del chip. La referencia guardada con el borrador es una declaración del editor, no una aprobación transferida ni una sincronización automática.",
    "cards": [
      {
        "title": "Fuentes publicadas",
        "text": "Sólo publicaciones de otros lotes de la misma empresa. Un borrador nuevo no reemplaza el contenido publicado que se reutiliza.",
        "tag": "Biblioteca"
      },
      {
        "title": "Selección campo a campo",
        "text": "Antes/después y selección explícita, con datos del lote protegidos. No se copia una configuración completa.",
        "tag": "UX"
      },
      {
        "title": "Origen revalidado",
        "text": "Antes de aplicar se vuelve a leer la publicación y la revisión destino. Si cambiaron, no se modifica el trabajo local.",
        "tag": "Control"
      },
      {
        "title": "Revisión propia",
        "text": "Guardar continúa usando la revisión, auditoría y respuesta recuperable existentes. El origen no aprueba el nuevo destino.",
        "tag": "Gobernanza"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "S4 · reusable published content",
    "title": "Prepare the next batch without starting over.",
    "summary": "Select fields from a published passport in the same company and compare them with current work. The destination retains its own review and publication.",
    "back": "Open batches",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Workflow",
    "steps": [
      "Open an editable Passport Studio draft and choose Reuse content.",
      "Search publications from the same company, template and language.",
      "Review and explicitly select individual fields.",
      "Apply locally, save and complete the destination review workflow."
    ],
    "boundary": "No enrollment, publication, identifier or NFC configuration change is automatic. The saved source reference is an editor declaration, not transferred approval or live synchronization.",
    "cards": [
      {
        "title": "Published sources",
        "text": "Only other batches within the company; newer draft work does not replace their publication.",
        "tag": "Library"
      },
      {
        "title": "Field selection",
        "text": "Before/after values and no preselected fields. Batch-specific data stays untouched.",
        "tag": "UX"
      },
      {
        "title": "Revalidated source",
        "text": "Publication and destination revision are checked again before local application.",
        "tag": "Control"
      },
      {
        "title": "Independent review",
        "text": "Saving uses the existing durable revision and audit workflow. Source approval is not inherited.",
        "tag": "Governance"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "S4 · conteúdo publicado reutilizável",
    "title": "Prepare o próximo lote sem começar do zero.",
    "summary": "Escolha campos de um passaporte publicado da mesma empresa e compare com o trabalho atual. O destino mantém sua revisão e publicação.",
    "back": "Abrir lotes",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Fluxo",
    "steps": [
      "Abra um rascunho editável no Passport Studio e selecione Reutilizar conteúdo.",
      "Busque publicações da mesma empresa, modelo e idioma.",
      "Revise e selecione explicitamente os campos.",
      "Aplique localmente, salve e siga a revisão do lote destino."
    ],
    "boundary": "A biblioteca não publica nem inscreve lotes automaticamente. Identificadores, datas e dados NFC são preservados. A referência de origem é declarada pelo editor, não transfere aprovação nem cria sincronização.",
    "cards": [
      {
        "title": "Fontes publicadas",
        "text": "Somente outros lotes da mesma empresa; novos rascunhos não substituem o conteúdo publicado.",
        "tag": "Biblioteca"
      },
      {
        "title": "Escolha dos campos",
        "text": "Valores antes/depois sem seleção automática. Dados específicos do lote ficam protegidos.",
        "tag": "UX"
      },
      {
        "title": "Fonte revalidada",
        "text": "Publicação e revisão do destino são verificadas novamente antes da aplicação local.",
        "tag": "Controle"
      },
      {
        "title": "Revisão própria",
        "text": "Salvar usa a revisão e auditoria existentes. A aprovação da origem não é herdada.",
        "tag": "Governança"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
