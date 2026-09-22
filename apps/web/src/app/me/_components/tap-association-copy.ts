import type { TapAssociationAction, TapAssociationOutcome } from "./tap-association-model";
export type AssociationLocale = "es-AR" | "en" | "pt-BR";
type Copy = {
  eyebrow: string; title: string; intro: string; reference: string; choose: string; checking: string; active: string;
  loginNeeded: string; login: string; checkError: string; checkAgain: string; sending: string; retry: string;
  results: string; done: string; products: string; freshHelp: string;
  actions: Record<TapAssociationAction, { label: string; detail: string; button: string }>;
  outcomes: Record<TapAssociationOutcome, string>;
};
export function associationLocale(value: string): AssociationLocale {
  return value.toLowerCase().startsWith("pt") ? "pt-BR" : value.toLowerCase().startsWith("en") ? "en" : "es-AR";
}
export const associationCopy: Record<AssociationLocale, Copy> = {
  "es-AR": {
    eyebrow: "Opciones de esta lectura", title: "Elegí qué querés hacer", reference: "Referencia recibida",
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
      session_required: "La sesión no está activa. Iniciá sesión y confirmá de nuevo esta acción.", no_program: "La empresa no tiene un programa de beneficios activo para esta lectura.",
      blocked: "La acción no fue confirmada para esta cuenta o lectura. El producto puede haber quedado guardado; revisá tu colección.",
      unconfirmed: "No recibimos una confirmación completa. La operación puede haberse registrado; revisá tus productos antes de reintentar solo esta acción.",
    },
  },
  en: {
    eyebrow: "Options for this reading", title: "Choose what you want to do", reference: "Received reference",
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
      blocked: "The action was not confirmed for this account or reading. The product may have been saved; review your collection.", unconfirmed: "We did not receive full confirmation. The operation may have been recorded; review your products before retrying only this action.",
    },
  },
  "pt-BR": {
    eyebrow: "Opções desta leitura", title: "Escolha o que deseja fazer", reference: "Referência recebida",
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
      blocked: "A ação não foi confirmada para esta conta ou leitura. O produto pode ter sido guardado; revise sua coleção.", unconfirmed: "Não recebemos confirmação completa. A operação pode ter sido registrada; revise seus produtos antes de repetir somente esta ação.",
    },
  },
};
