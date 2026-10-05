import type { TapAssociationAction, TapAssociationOutcome } from "./tap-association-model";
export type AssociationLocale = "es-AR" | "en" | "pt-BR";
type Copy = {
  eyebrow: string; title: string; intro: string; reference: string; choose: string; checking: string; active: string;
  loginNeeded: string; login: string; checkError: string; checkAgain: string; sending: string; retry: string;
  results: string; done: string; products: string; freshHelp: string;
  alternatives: string; readingDetails: string; history: string; subtitle: string;
  titles: Record<TapAssociationOutcome, string>;
  actions: Record<TapAssociationAction, { label: string; detail: string; button: string }>;
  outcomes: Record<TapAssociationOutcome, string>;
};
export function associationLocale(value: string): AssociationLocale {
  return value.toLowerCase().startsWith("pt") ? "pt-BR" : value.toLowerCase().startsWith("en") ? "en" : "es-AR";
}
export const associationCopy: Record<AssociationLocale, Copy> = {
  "es-AR": {
    eyebrow: "Después de tu TAP", title: "Guardá tu producto en tu cuenta", reference: "Referencia de lectura",
    subtitle: "Guardá su historia para volver cuando quieras.", alternatives: "Otras opciones", readingDetails: "Sobre esta lectura", history: "Ver historial de lecturas",
    titles: {
      saved: "Producto guardado", linked: "Vínculo confirmado", claimed: "Titularidad registrada", enrolled: "Inscripción confirmada",
      recorded_pending: "Registro pendiente de confirmación", committed_unknown: "Revisá el registro en tu cuenta", review_required: "Hace falta una revisión",
      fresh_required: "Necesitás otra lectura", fresh_expired: "La lectura venció", fresh_used: "Esta lectura ya se usó", session_required: "Iniciá sesión para continuar",
      no_program: "Beneficios no disponibles", blocked: "Acción no confirmada", unconfirmed: "Falta confirmar el resultado",
    },
    intro: "La referencia del enlace no confirma autenticidad ni permisos. Cada acción se valida con tu sesión y la política de la empresa.",
    choose: "Una acción por vez", checking: "Comprobando tu sesión…", active: "Se usará tu sesión actual.",
    loginNeeded: "Iniciá sesión para continuar. Después tendrás que confirmar la acción elegida.", login: "Iniciar sesión",
    checkError: "No pudimos comprobar la sesión. No enviamos una acción nueva.", checkAgain: "Comprobar sesión",
    sending: "Esperando confirmación…", retry: "Reintentar solo esta acción", results: "Resultado de cada acción", done: "Respuesta recibida", products: "Revisar mis productos",
    freshHelp: "Estas acciones requieren una lectura NFC vigente. Si hace falta otra, acercá el teléfono a la etiqueta y completá el flujo desde esa pantalla.",
    actions: {
      save: { label: "Guardar producto", detail: "Guarda la lectura y vincula el producto con tu cuenta y la empresa. No solicita titularidad ni habilita premios.", button: "Guardar producto en mi cuenta" },
      join: { label: "Vincularme con la empresa", detail: "Vincula tu cuenta con la empresa y guarda el producto. No autoriza mensajes comerciales ni inscribe en beneficios.", button: "Vincular mi cuenta y guardar producto" },
      claim: { label: "Solicitar titularidad digital", detail: "La empresa valida los requisitos. El proceso también puede guardar el producto y vincular tu cuenta. No transfiere un NFT ni activa garantía.", button: "Solicitar registro de titularidad" },
      rewards: { label: "Inscribirme en beneficios", detail: "Solicita inscripción en el programa disponible. No canjea premios ni confirma puntos nuevos.", button: "Solicitar inscripción en beneficios" },
    },
    outcomes: {
      saved: "Producto guardado y vinculado a tu cuenta y a la empresa.", linked: "Vínculo con la empresa confirmado; el producto quedó guardado.",
      claimed: "Titularidad digital registrada en NexID. No se ejecutó una transferencia NFT ni se activó garantía.", enrolled: "Inscripción confirmada. No se realizó un canje ni se confirmaron puntos nuevos.",
      recorded_pending: "La titularidad quedó registrada, pero falta completar su confirmación técnica. Revisá tu colección; no volveremos a enviar esta acción.",
      committed_unknown: "El servidor informó un registro realizado, pero el resultado completo no está confirmado. Revisá tu colección antes de continuar.",
      review_required: "La empresa exige una revisión adicional. Esta respuesta no creó una solicitud de revisión ni registró titularidad.",
      fresh_required: "Se requiere un nuevo TAP y completar los requisitos desde la etiqueta. Tu sesión sigue activa.",
      fresh_expired: "Pasó el tiempo para confirmar esta lectura. Acercá de nuevo el teléfono a la etiqueta y completá la acción desde esa pantalla. Tu sesión sigue activa.",
      fresh_used: "Esta lectura ya se usó para una acción. Revisá tus productos; para una acción nueva, acercá otra vez el teléfono a la etiqueta. Tu sesión sigue activa.",
      session_required: "La sesión no está activa. Iniciá sesión y confirmá de nuevo esta acción.", no_program: "La empresa no tiene un programa de beneficios activo para esta lectura.",
      blocked: "La acción no fue confirmada para esta cuenta o lectura. El producto puede haber quedado guardado; revisá tu colección.",
      unconfirmed: "No recibimos una confirmación completa. La operación puede haberse registrado; revisá tus productos antes de reintentar solo esta acción.",
    },
  },
  en: {
    eyebrow: "After your tap", title: "Save your product to your account", reference: "Reading reference",
    subtitle: "Save its story and come back whenever you like.", alternatives: "Other options", readingDetails: "About this reading", history: "View reading history",
    titles: {
      saved: "Product saved", linked: "Connection confirmed", claimed: "Digital title registered", enrolled: "Enrollment confirmed",
      recorded_pending: "Record awaiting confirmation", committed_unknown: "Review the record in your account", review_required: "Additional review needed",
      fresh_required: "A new reading is needed", fresh_expired: "This reading has expired", fresh_used: "This reading was already used", session_required: "Sign in to continue",
      no_program: "Benefits unavailable", blocked: "Action not confirmed", unconfirmed: "Result awaiting confirmation",
    },
    intro: "The link reference does not confirm authenticity or permissions. Each action is checked against your session and company policy.",
    choose: "One action at a time", checking: "Checking your session…", active: "Your current session will be used.", loginNeeded: "Sign in to continue. You will then need to confirm your chosen action.", login: "Sign in",
    checkError: "We could not check your session. No new action was sent.", checkAgain: "Check session", sending: "Waiting for confirmation…", retry: "Retry only this action", results: "Result of each action", done: "Response received", products: "Review my products",
    freshHelp: "These actions require a current NFC reading. If another is needed, tap the tag with your phone and complete the flow on that screen.",
    actions: {
      save: { label: "Save product", detail: "Saves the reading and links the product to your account and the company. Does not claim title or activate rewards.", button: "Save product to my account" },
      join: { label: "Connect with the company", detail: "Links your account to the company and saves the product. Does not authorize marketing messages or enroll in rewards.", button: "Link my account and save product" },
      claim: { label: "Request digital title", detail: "The company checks its requirements. The process may also save the product and link your account. It does not transfer an NFT or activate a warranty.", button: "Request digital title registration" },
      rewards: { label: "Enroll in benefits", detail: "Requests enrollment in the available program. Does not redeem rewards or confirm new points.", button: "Request benefits enrollment" },
    },
    outcomes: {
      saved: "Product saved and linked to your account and the company.", linked: "Company connection confirmed; the product was saved.", claimed: "Digital title registered in NexID. No NFT transfer or warranty activation took place.", enrolled: "Enrollment confirmed. No redemption or new points were confirmed.",
      recorded_pending: "Digital title was recorded, but technical confirmation is incomplete. Review your collection; we will not resend this action.", committed_unknown: "The server reported a committed record, but the full result is unconfirmed. Review your collection before continuing.",
      review_required: "The company requires additional review. This response did not create a review request or register title.", fresh_required: "A new tap and the tag's required steps are needed. Your session remains active.", session_required: "Your session is not active. Sign in and confirm this action again.", no_program: "The company has no active benefits program for this reading.",
      fresh_expired: "The time to confirm this reading has passed. Tap the tag again and complete the action from that screen. Your session remains active.",
      fresh_used: "This reading has already been used for an action. Review your products; for a new action, tap the tag again. Your session remains active.",
      blocked: "The action was not confirmed for this account or reading. The product may have been saved; review your collection.", unconfirmed: "We did not receive full confirmation. The operation may have been recorded; review your products before retrying only this action.",
    },
  },
  "pt-BR": {
    eyebrow: "Depois do seu toque", title: "Guarde seu produto na sua conta", reference: "Referência da leitura",
    subtitle: "Guarde a história e volte quando quiser.", alternatives: "Outras opções", readingDetails: "Sobre esta leitura", history: "Ver histórico de leituras",
    titles: {
      saved: "Produto guardado", linked: "Vínculo confirmado", claimed: "Titularidade registrada", enrolled: "Inscrição confirmada",
      recorded_pending: "Registro aguardando confirmação", committed_unknown: "Revise o registro na sua conta", review_required: "Análise adicional necessária",
      fresh_required: "É necessária outra leitura", fresh_expired: "A leitura expirou", fresh_used: "Esta leitura já foi usada", session_required: "Entre para continuar",
      no_program: "Benefícios indisponíveis", blocked: "Ação não confirmada", unconfirmed: "Resultado aguardando confirmação",
    },
    intro: "A referência do link não confirma autenticidade nem permissões. Cada ação é validada com sua sessão e a política da empresa.",
    choose: "Uma ação por vez", checking: "Verificando sua sessão…", active: "Sua sessão atual será utilizada.", loginNeeded: "Entre para continuar. Depois, confirme a ação escolhida.", login: "Entrar",
    checkError: "Não foi possível verificar a sessão. Nenhuma nova ação foi enviada.", checkAgain: "Verificar sessão", sending: "Aguardando confirmação…", retry: "Repetir somente esta ação", results: "Resultado de cada ação", done: "Resposta recebida", products: "Revisar meus produtos",
    freshHelp: "Estas ações exigem uma leitura NFC vigente. Se precisar de outra, aproxime o celular da etiqueta e conclua o fluxo nessa tela.",
    actions: {
      save: { label: "Guardar produto", detail: "Guarda a leitura e vincula o produto à sua conta e à empresa. Não solicita titularidade nem libera prêmios.", button: "Guardar produto na minha conta" },
      join: { label: "Vincular-me à empresa", detail: "Vincula sua conta à empresa e guarda o produto. Não autoriza mensagens comerciais nem inscreve em benefícios.", button: "Vincular minha conta e guardar produto" },
      claim: { label: "Solicitar titularidade digital", detail: "A empresa valida os requisitos. O processo também pode guardar o produto e vincular sua conta. Não transfere NFT nem ativa garantia.", button: "Solicitar registro de titularidade" },
      rewards: { label: "Inscrever-me em benefícios", detail: "Solicita inscrição no programa disponível. Não resgata prêmios nem confirma novos pontos.", button: "Solicitar inscrição em benefícios" },
    },
    outcomes: {
      saved: "Produto guardado e vinculado à sua conta e à empresa.", linked: "Vínculo com a empresa confirmado; o produto foi guardado.", claimed: "Titularidade digital registrada no NexID. Não houve transferência NFT nem ativação de garantia.", enrolled: "Inscrição confirmada. Nenhum resgate ou novo ponto foi confirmado.",
      recorded_pending: "A titularidade foi registrada, mas falta a confirmação técnica. Revise sua coleção; não enviaremos esta ação novamente.", committed_unknown: "O servidor informou um registro realizado, mas o resultado completo não foi confirmado. Revise sua coleção antes de continuar.",
      review_required: "A empresa exige análise adicional. Esta resposta não criou uma solicitação de análise nem registrou titularidade.", fresh_required: "É necessário um novo toque e concluir os requisitos na etiqueta. Sua sessão continua ativa.", session_required: "A sessão não está ativa. Entre e confirme esta ação novamente.", no_program: "A empresa não tem um programa de benefícios ativo para esta leitura.",
      fresh_expired: "O prazo para confirmar esta leitura terminou. Aproxime o celular da etiqueta novamente e conclua a ação nessa tela. Sua sessão continua ativa.",
      fresh_used: "Esta leitura já foi usada para uma ação. Revise seus produtos; para uma nova ação, aproxime o celular da etiqueta novamente. Sua sessão continua ativa.",
      blocked: "A ação não foi confirmada para esta conta ou leitura. O produto pode ter sido guardado; revise sua coleção.", unconfirmed: "Não recebemos confirmação completa. A operação pode ter sido registrada; revise seus produtos antes de repetir somente esta ação.",
    },
  },
};
