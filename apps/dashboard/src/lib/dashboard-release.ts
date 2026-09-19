export const DASHBOARD_RELEASE='2026.09.19-dashboard.20';
export const DASHBOARD_RELEASE_DATE='2026-09-19';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "Preparación industrial por archivo",
    "title": "De la lista de identidades a la plancha de etiquetas.",
    "summary": "Validá hasta 100 identidades GS1 por archivo, confirmá el registro completo y descargá la plancha. El QR básico permite preparar copias del enlace del lote sin inventar unidades.",
    "back": "Abrir lotes",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Cómo probar el recorrido",
    "steps": [
      "Abrí un lote QR o GS1 y elegí Enlaces QR / estado NFC.",
      "Entrá a Producción QR / GS1. Cargá el CSV y revisá los errores por fila.",
      "Para GS1, validá los permisos y confirmá el archivo completo con su referencia.",
      "Prepará la plancha, descargá el manifiesto y verificá una muestra física antes de fabricar."
    ],
    "boundary": "No convierte NFC ni certifica lectura física. Requiere perfil activo y, para GS1, el prefijo autorizado del cliente. No crea derechos GS1 ni habilita etiquetas automáticamente.",
    "cards": [
      {
        "title": "Validación antes de escribir",
        "text": "GTIN, lote, serie, duplicados, autorización de prefijo y conflictos con identidades existentes. Las filas bloqueadas impiden el registro completo.",
        "tag": "Control por fila"
      },
      {
        "title": "Una transacción por archivo",
        "text": "Registro, auditoría y comprobante se confirman juntos. Repetir el mismo intento recupera el resultado, sin duplicar identidades.",
        "tag": "Integridad"
      },
      {
        "title": "Salida para impresión",
        "text": "Plancha HTML autónoma, datos CSV y manifiesto JSON generados desde el estado actual del registro.",
        "tag": "Imprenta"
      },
      {
        "title": "Comprobantes recuperables",
        "text": "Consultá las últimas importaciones del lote y prepará otra copia sin volver a registrar el archivo.",
        "tag": "Continuidad"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "Bounded label production",
    "title": "From identifiers to a printable label sheet.",
    "summary": "Validate up to 100 GS1 identities per file, commit the complete set and download the sheet. Basic QR prints repeat the registered batch link.",
    "back": "Open batches",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Workflow",
    "steps": [
      "Open a QR or GS1 batch and its channel configuration.",
      "Upload a CSV and inspect row-level errors.",
      "Confirm the authorized GS1 file with a business reference.",
      "Download the sheet and manifest, then check a physical sample before production."
    ],
    "boundary": "Does not convert NFC, grant GS1 rights or certify printed labels. The active channel and authorized company prefix are required.",
    "cards": [
      {
        "title": "Validate first",
        "text": "Identifier syntax, duplicates, ownership entitlement and existing registry conflicts are checked before insertion.",
        "tag": "Validation"
      },
      {
        "title": "Atomic registration",
        "text": "Identities, audit and receipt commit together. Replaying the same operation does not duplicate the file.",
        "tag": "Integrity"
      },
      {
        "title": "Printable outputs",
        "text": "Self-contained HTML sheet, CSV and JSON manifest from current registered identities.",
        "tag": "Print"
      },
      {
        "title": "Recoverable receipts",
        "text": "Retrieve recent batch imports and prepare another printout without registering again.",
        "tag": "Continuity"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "Preparação de etiquetas por arquivo",
    "title": "Das identidades à folha de impressão.",
    "summary": "Valide até 100 identidades GS1, confirme o arquivo completo e baixe a folha. O QR básico repete o link registrado do lote.",
    "back": "Abrir lotes",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Fluxo",
    "steps": [
      "Abra um lote QR ou GS1 e sua configuração de canais.",
      "Carregue o CSV e revise os erros por linha.",
      "Confirme o arquivo autorizado com uma referência operacional.",
      "Baixe folha e manifesto e verifique uma amostra física antes de produzir."
    ],
    "boundary": "Não converte NFC, concede direitos GS1 ou certifica a impressão. Requer canal ativo e prefixo autorizado da empresa.",
    "cards": [
      {
        "title": "Validar antes de gravar",
        "text": "Sintaxe, duplicatas, autorização do prefixo e conflitos existentes antes do registro.",
        "tag": "Validação"
      },
      {
        "title": "Transação por arquivo",
        "text": "Identidades, auditoria e comprovante são confirmados juntos, sem duplicar ao repetir a tentativa.",
        "tag": "Integridade"
      },
      {
        "title": "Saída de impressão",
        "text": "Folha HTML autônoma, CSV e manifesto JSON do registro atual.",
        "tag": "Impressão"
      },
      {
        "title": "Comprovantes recuperáveis",
        "text": "Consulte importações recentes e prepare outra impressão sem registrar novamente.",
        "tag": "Continuidade"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
