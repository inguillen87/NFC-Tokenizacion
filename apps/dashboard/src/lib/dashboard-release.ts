export const DASHBOARD_RELEASE='2026.09.19-dashboard.22';
export const DASHBOARD_RELEASE_DATE='2026-09-19';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "Investigar una identidad sin perder su historia",
    "title": "Más allá de los primeros movimientos.",
    "summary": "El recorrido del lote ahora navega por páginas y busca GTIN, lote, serie o tipo de evento en todo el período. Seguís una identidad exacta sin confundir declaraciones con evidencia física.",
    "back": "Abrir lotes",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Cómo probar esta entrega",
    "steps": [
      "Abrí un lote y entrá a Recorrido del lote.",
      "Consultá el período y avanzá o retrocedé entre páginas de hasta 50 movimientos.",
      "Filtrá por identidad o tipo; desde una referencia usá Seguir esta identidad.",
      "Descargá el informe de la página con sus filtros, corte de registros y SHA-256."
    ],
    "boundary": "La paginación consulta datos y permisos actuales bajo un corte de fecha de ingreso. No es una fotografía inmutable entre páginas, una topología vigente ni una lectura UHF física.",
    "cards": [
      {
        "title": "Páginas, no una muestra fija",
        "text": "EPCIS y custodia autorizada se ordenan juntos. Fechas iguales y microsegundos mantienen el orden sin duplicar registros de fuentes distintas.",
        "tag": "Historial"
      },
      {
        "title": "Encontrar la identidad correcta",
        "text": "GTIN, lote y serie consultan la base dentro del período, no sólo las filas ya cargadas. Una referencia puede abrir su seguimiento exacto.",
        "tag": "Investigación"
      },
      {
        "title": "Evidencia con alcance explícito",
        "text": "HTML y JSON corresponden a la página consultada e incluyen filtros y corte. No se presentan como el historial completo.",
        "tag": "Informe"
      },
      {
        "title": "Errores recuperables",
        "text": "Una fuente caída retira el resultado anterior. La misma página puede reintentarse; cambios de permisos obligan a iniciar una consulta autorizada.",
        "tag": "Operación"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "Investigate an identity without losing its history",
    "title": "Beyond the first movements.",
    "summary": "Batch traceability now pages through history and queries GTIN, lot, serial or event type across the selected period.",
    "back": "Open batches",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Try this release",
    "steps": [
      "Open a batch and its traceability view.",
      "Select a period and navigate pages of up to 50 movements.",
      "Filter an identity or use Follow this identity from a reference.",
      "Export the loaded page with its filters, record cutoff and digest."
    ],
    "boundary": "Each page rechecks current permissions and data under a record-time boundary. This is not an immutable cross-page snapshot or a physical RFID certification.",
    "cards": [
      {
        "title": "Paged history",
        "text": "Authorized EPCIS and custody records share a deterministic order, including identical IDs across sources and microsecond timestamps.",
        "tag": "History"
      },
      {
        "title": "Scoped identity search",
        "text": "Query the database by GTIN, lot or serial rather than searching only loaded rows.",
        "tag": "Investigation"
      },
      {
        "title": "Page-specific evidence",
        "text": "HTML and JSON include page scope and filters instead of claiming complete historical coverage.",
        "tag": "Evidence"
      },
      {
        "title": "Recoverable failures",
        "text": "Unconfirmed data is cleared; a failed read can retry its position and permission changes require a new query.",
        "tag": "Operations"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "Investigue uma identidade sem perder seu histórico",
    "title": "Além dos primeiros movimentos.",
    "summary": "O percurso do lote agora navega por páginas e consulta GTIN, lote, série e tipo de evento no período selecionado.",
    "back": "Abrir lotes",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Como testar",
    "steps": [
      "Abra um lote e seu percurso.",
      "Consulte o período e navegue páginas de até 50 movimentos.",
      "Filtre a identidade ou use Seguir esta identidade em uma referência.",
      "Exporte a página com filtros, corte de registro e hash."
    ],
    "boundary": "Cada página revalida dados e permissões sob um corte de registro. Não é uma fotografia imutável entre páginas nem comprovação física de RFID.",
    "cards": [
      {
        "title": "Histórico paginado",
        "text": "EPCIS e custódia autorizados mantêm ordem determinística, incluindo microssegundos e IDs iguais em fontes diferentes.",
        "tag": "Histórico"
      },
      {
        "title": "Busca por identidade",
        "text": "GTIN, lote e série consultam o período no banco, não apenas as linhas visíveis.",
        "tag": "Investigação"
      },
      {
        "title": "Evidência por página",
        "text": "HTML e JSON incluem filtros e limites explícitos sem declarar todo o histórico.",
        "tag": "Evidência"
      },
      {
        "title": "Falhas recuperáveis",
        "text": "Dados não confirmados são retirados; a leitura pode ser repetida e mudanças de permissões exigem nova consulta.",
        "tag": "Operação"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
