export const DASHBOARD_RELEASE='2026.09.18-dashboard.13';
export const DASHBOARD_RELEASE_DATE='2026-09-18';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "Configuración por tipo de etiqueta",
    "title": "QR utilizables. NFC sin alteraciones.",
    "summary": "Desde cada lote: consultar TTStatus configurado, registrar GS1 Digital Link autorizado y generar el QR descargable del canal correspondiente.",
    "back": "Abrir lotes",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Recorrido",
    "steps": [
      "Abrí Lotes y elegí Enlaces QR / estado NFC.",
      "En TagTamper, consultá el mapeo existente sin cambiar claves ni contadores.",
      "En un lote GS1, registrá GTIN, lote y serie con un prefijo autorizado de la empresa.",
      "En QR o GS1 habilitado, generá el SVG para imprimir."
    ],
    "boundary": "No convierte una etiqueta NFC en QR ni inventa GTIN o autorizaciones GS1. Los códigos estáticos identifican contenido; no prueban autenticidad NFC ni estado del precinto.",
    "cards": [
      {
        "title": "TagTamper conservado",
        "text": "Fuente, longitud y valores TT existentes, sin atribuirles un estado físico nuevo.",
        "tag": "NFC"
      },
      {
        "title": "Registro GS1 conectado",
        "text": "Identidades del lote con autorización de prefijo y control de repetición.",
        "tag": "GS1"
      },
      {
        "title": "QR descargable",
        "text": "SVG generado por el servidor desde la identidad registrada, sin generadores externos.",
        "tag": "Impresión"
      },
      {
        "title": "Acceso directo al trabajo",
        "text": "Enlaces desde la lista y la ficha de producto; sin cambiar permisos ni sesión.",
        "tag": "UX"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "Carrier-specific configuration",
    "title": "Usable QR codes. NFC preserved.",
    "summary": "Inspect configured TTStatus, register authorized GS1 Digital Links and generate downloadable QR codes inside each batch.",
    "back": "Open batches",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Workflow",
    "steps": [
      "Open a batch and choose QR links / NFC state.",
      "Review TagTamper settings without changing keys or counters.",
      "Register GS1 identifiers using an authorized company prefix.",
      "Generate SVG for an enabled QR or GS1 channel."
    ],
    "boundary": "No NFC conversion, invented GTINs or implied physical authentication. Static links identify registered content only.",
    "cards": [
      {
        "title": "Preserved TagTamper",
        "text": "Existing source, length and mappings without inventing physical seal state.",
        "tag": "NFC"
      },
      {
        "title": "Connected GS1 registry",
        "text": "Scoped identifiers with prefix authorization and repeat checks.",
        "tag": "GS1"
      },
      {
        "title": "Downloadable QR",
        "text": "Server-generated SVG from the registered destination.",
        "tag": "Print"
      },
      {
        "title": "Direct workflow",
        "text": "Entry from the batch list and dossier without session changes.",
        "tag": "UX"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "Configuração por tipo de etiqueta",
    "title": "QR utilizável. NFC preservado.",
    "summary": "Consulte TTStatus, registre GS1 Digital Link autorizado e gere QR para impressão no lote.",
    "back": "Abrir lotes",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Fluxo",
    "steps": [
      "Abra o lote e escolha Enlaces QR / estado NFC.",
      "Consulte TagTamper sem alterar chaves ou contadores.",
      "Registre identificadores GS1 com um prefixo autorizado da empresa.",
      "Gere SVG de um canal QR ou GS1 habilitado."
    ],
    "boundary": "Não converte NFC nem inventa GTIN. Links estáticos não comprovam autenticidade física ou estado do lacre.",
    "cards": [
      {
        "title": "TagTamper preservado",
        "text": "Fonte, tamanho e valores existentes sem presumir estado físico.",
        "tag": "NFC"
      },
      {
        "title": "Registro GS1 conectado",
        "text": "Identidades por lote com autorização e controle de repetição.",
        "tag": "GS1"
      },
      {
        "title": "QR para impressão",
        "text": "SVG do destino registrado, gerado no servidor.",
        "tag": "Impressão"
      },
      {
        "title": "Acesso direto",
        "text": "Entrada pela lista e pelo dossiê, sem alterar a sessão.",
        "tag": "UX"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
