export const DASHBOARD_RELEASE='2026.09.18-dashboard.14';
export const DASHBOARD_RELEASE_DATE='2026-09-18';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "S5 · integración ejecutable",
    "title": "El sistema del cliente ya tiene un punto de entrada.",
    "summary": "Descargá el SDK privado empaquetado con un importador CSV de recepciones y un receptor webhook firmado. Se instala y prueba fuera del repositorio, sin credenciales productivas para las pruebas.",
    "back": "Abrir API y SDK",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Cómo empezar",
    "steps": [
      "Descargá el kit desde API y SDK con tu sesión autorizada.",
      "Verificá el manifiesto, instalá el paquete local y ejecutá las pruebas incluidas.",
      "Usá el perfil ERP / WMS · CSV para consultar productos y enviar recepciones declaradas.",
      "Prepará la cola, revisá sus registros y confirmá la empresa antes del envío real."
    ],
    "boundary": "La descarga no crea API keys ni envía eventos. El adaptador CSV no es una integración nativa aceptada por un ERP concreto y no modifica precintos, autenticidad NFC ni estados logísticos.",
    "cards": [
      {
        "title": "Distribución privada",
        "text": "Paquete SDK existente, contratos OpenAPI/AsyncAPI y scripts ejecutables en un artefacto con checksum. Sin publicación pública en npm.",
        "tag": "SDK"
      },
      {
        "title": "CSV con cola durable",
        "text": "Plan local, ID comercial estable y recuperación de resultados inciertos sin duplicar deliberadamente el evento.",
        "tag": "ERP / WMS"
      },
      {
        "title": "Webhook firmado",
        "text": "Receptor v2 que valida tenant y event ID antes de persistir una proyección local. Duplicados se reconocen sin repetirla.",
        "tag": "Integración"
      },
      {
        "title": "Permisos acotados",
        "text": "El nuevo perfil elige sdk:products y sdk:events. No requiere claves NFC, permiso de activación ni acceso global.",
        "tag": "Operación"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "S5 · executable integration",
    "title": "A runnable starting point for the customer system.",
    "summary": "Download the private SDK with a durable receipt CSV adapter and signed webhook receiver. Install and test it outside the repository without production credentials.",
    "back": "Open API and SDK",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Get started",
    "steps": [
      "Download the kit with an authorized session.",
      "Verify the manifest, install the local package and run its tests.",
      "Choose the ERP / WMS CSV permission preset.",
      "Prepare the queue and explicitly confirm the tenant before sending."
    ],
    "boundary": "Downloading does not create credentials or send events. This is a CSV reference adapter, not an accepted native ERP integration or physical NFC verification.",
    "cards": [
      {
        "title": "Private distribution",
        "text": "Existing SDK, contracts and runnable scripts with artifact integrity checks. No public npm publication.",
        "tag": "SDK"
      },
      {
        "title": "Durable CSV queue",
        "text": "Local planning, stable business identifiers and bounded uncertain-result recovery.",
        "tag": "ERP / WMS"
      },
      {
        "title": "Signed callbacks",
        "text": "V2 receiver checks tenant and event identity before durable local projection.",
        "tag": "Webhook"
      },
      {
        "title": "Narrow permissions",
        "text": "Only sdk:products and sdk:events for this adapter. No NFC key export or tag activation.",
        "tag": "Access"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "S5 · integração executável",
    "title": "Um ponto de entrada executável para o cliente.",
    "summary": "Baixe o SDK privado com adaptador CSV de recebimentos e receptor webhook assinado. Instale e teste fora do repositório sem credenciais de produção.",
    "back": "Abrir API e SDK",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Primeiros passos",
    "steps": [
      "Baixe o kit com uma sessão autorizada.",
      "Verifique o manifesto, instale o pacote local e rode os testes.",
      "Selecione o perfil ERP / WMS CSV de permissões.",
      "Prepare a fila e confirme a empresa antes de enviar."
    ],
    "boundary": "Baixar não cria credenciais nem envia eventos. O adaptador CSV não é uma integração nativa validada em um ERP nem autenticação física NFC.",
    "cards": [
      {
        "title": "Distribuição privada",
        "text": "SDK existente, contratos e scripts com verificação de integridade. Sem publicação pública no npm.",
        "tag": "SDK"
      },
      {
        "title": "Fila CSV persistente",
        "text": "Planejamento local, identificadores estáveis e recuperação limitada de respostas incertas.",
        "tag": "ERP / WMS"
      },
      {
        "title": "Webhook assinado",
        "text": "Receptor v2 verifica empresa e evento antes de persistir a projeção local.",
        "tag": "Webhook"
      },
      {
        "title": "Permissões limitadas",
        "text": "Somente sdk:products e sdk:events. Não exporta chaves NFC nem ativa etiquetas.",
        "tag": "Acesso"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
