export const DASHBOARD_RELEASE='2026.09.19-dashboard.24';
export const DASHBOARD_RELEASE_DATE='2026-09-19';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "S3/S5 · agrupaciones operativas sin JSON",
    "title": "Unidades, cajas y pallets, en el formulario.",
    "summary": "Elegí un contenedor identificado y sus unidades, revisá la relación y registrala con el motor EPCIS existente. La selección puede incluir otros lotes de la misma empresa sin copiar sus datos a mano.",
    "back": "Abrir lotes",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Cómo empezar",
    "steps": [
      "Abrí Registrar movimientos desde el recorrido del lote.",
      "Elegí Unidades, cajas y pallets, la acción y la referencia estable.",
      "Buscá identidades con serie, seleccioná contenedor/unidades y validá.",
      "Revisá la representación y confirmá con los permisos y MFA requeridos."
    ],
    "boundary": "Registrar una agrupación es una declaración autenticada, no una prueba de lectura UHF o del contenido físico actual. Separar sólo afecta las identidades seleccionadas en el evento; no borra el historial ni altera tags.",
    "cards": [
      {
        "title": "Tres acciones claras",
        "text": "Agrupar, separar identidades elegidas u observar un grupo sin declarar un alta/baja.",
        "tag": "Operación"
      },
      {
        "title": "Selección registrada",
        "text": "Búsqueda por lote, GTIN o serie con alcance de empresa y resultados acotados. No se crean números de serie ficticios.",
        "tag": "Datos reales"
      },
      {
        "title": "Revisión visual",
        "text": "Contenedor y unidades se muestran antes de confirmar, contrastados con las identidades verificadas por el servicio.",
        "tag": "UX"
      },
      {
        "title": "Comprobante recuperable",
        "text": "Conserva la captura transaccional, evita duplicar el reintento y ofrece preparar el próximo movimiento sin borrar registros.",
        "tag": "Evidencia"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "S3/S5 · guided operational groupings",
    "title": "Units, cases and pallets without hand-written JSON.",
    "summary": "Select a registered container and serialized units, review the relationship and use the existing EPCIS capture engine.",
    "back": "Open batches",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Get started",
    "steps": [
      "Open movement intake from a batch trace.",
      "Choose units, cases and pallets, action and stable reference.",
      "Search registered identities, choose container and units, then validate.",
      "Review the relationship and confirm with required permissions and MFA."
    ],
    "boundary": "A registered grouping is an authenticated declaration, not physical UHF proof or current containment certification. Separation records selected identities without deleting history or altering tags.",
    "cards": [
      {
        "title": "Explicit actions",
        "text": "Add, separate selected units, or observe without declaring membership changes.",
        "tag": "Operations"
      },
      {
        "title": "Registered selection",
        "text": "Scoped batch, GTIN and serial search with bounded results; no invented serials.",
        "tag": "Identity"
      },
      {
        "title": "Visual review",
        "text": "Container and units are checked against the service-validated identities before confirmation.",
        "tag": "UX"
      },
      {
        "title": "Recoverable receipts",
        "text": "Existing atomic capture and retry recovery remain in place. Prepare another movement without deleting evidence.",
        "tag": "Evidence"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "S3/S5 · agrupamentos operacionais guiados",
    "title": "Unidades, caixas e pallets sem escrever JSON.",
    "summary": "Selecione um contêiner identificado e suas unidades serializadas, revise a relação e registre pelo motor EPCIS existente.",
    "back": "Abrir lotes",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Primeiros passos",
    "steps": [
      "Abra o registro de movimentos no percurso do lote.",
      "Escolha unidades, caixas e pallets, ação e referência estável.",
      "Busque identidades registradas, selecione contêiner/unidades e valide.",
      "Revise a relação e confirme com permissões e MFA exigidos."
    ],
    "boundary": "O agrupamento registrado é uma declaração autenticada, não prova física UHF ou certificação de conteúdo atual. Separar não apaga histórico nem modifica tags.",
    "cards": [
      {
        "title": "Ações explícitas",
        "text": "Agrupar, separar unidades selecionadas ou observar sem declarar alta/baixa.",
        "tag": "Operação"
      },
      {
        "title": "Identidades registradas",
        "text": "Busca por lote, GTIN ou série com escopo da empresa e resultados limitados.",
        "tag": "Identidade"
      },
      {
        "title": "Revisão visual",
        "text": "Contêiner e unidades são confrontados com as identidades validadas antes de confirmar.",
        "tag": "UX"
      },
      {
        "title": "Comprovante recuperável",
        "text": "Captura atômica e recuperação do mesmo envio; iniciar outro movimento não apaga evidência.",
        "tag": "Evidência"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
