export const SUN_LOCALES = ["es-AR", "pt-BR", "en"] as const;
export type SunLocale = (typeof SUN_LOCALES)[number];

type SunTranslation = Readonly<{
  es: string;
  pt: string;
  en: string;
}>;

export const SUN_LOCALE_COOKIE = "locale";

/**
 * UI-only SUN copy. Product names, producer declarations and API evidence are
 * intentionally absent: changing the presentation language must never rewrite
 * the evidence returned by the server.
 */
export const SUN_UI_TRANSLATIONS: readonly SunTranslation[] = [
  { es: "Pasaporte NFC", pt: "Passaporte NFC", en: "NFC passport" },
  { es: "Pasaporte QR", pt: "Passaporte QR", en: "QR passport" },
  { es: "Controles del pasaporte", pt: "Controles do passaporte", en: "Passport controls" },
  { es: "Secciones del producto", pt: "Seções do produto", en: "Product sections" },
  { es: "Resumen", pt: "Resumo", en: "Overview" },
  { es: "Producto", pt: "Produto", en: "Product" },
  { es: "Origen", pt: "Origem", en: "Origin" },
  { es: "Estado", pt: "Estado", en: "Status" },
  { es: "Servicios", pt: "Serviços", en: "Services" },
  { es: "Muestra demo", pt: "Demonstração", en: "Demo preview" },
  { es: "Volver al Demo Lab", pt: "Voltar ao Demo Lab", en: "Back to Demo Lab" },
  { es: "Identidad", pt: "Identidade", en: "Identity" },
  { es: "Modo demo", pt: "Modo demo", en: "Demo mode" },
  { es: "Dato simulado", pt: "Dado simulado", en: "Simulated data" },
  { es: "Ver producto", pt: "Ver produto", en: "View product" },
  { es: "Ver origen y mapa", pt: "Ver origem e mapa", en: "View origin and map" },
  { es: "Entender apertura", pt: "Entender a abertura", en: "Understand opening" },
  { es: "Ver opciones de muestra", pt: "Ver opções de demonstração", en: "View demo options" },
  { es: "Perfil de muestra", pt: "Perfil de demonstração", en: "Demo profile" },
  { es: "Perfil oficial del piloto", pt: "Perfil oficial do piloto", en: "Official pilot profile" },
  { es: "Tap físico activo", pt: "Toque físico ativo", en: "Active physical tap" },
  { es: "Consulta segura", pt: "Consulta segura", en: "Secure view" },
  { es: "Tap SUN", pt: "Toque SUN", en: "SUN tap" },
  { es: "MUESTRA DEMO · SIN TAP FÍSICO", pt: "DEMONSTRAÇÃO · SEM TOQUE FÍSICO", en: "DEMO PREVIEW · NO PHYSICAL TAP" },
  { es: "Batch de muestra", pt: "Lote de demonstração", en: "Demo batch" },
  { es: "Lote", pt: "Lote", en: "Batch" },
  { es: "Lote comercial", pt: "Lote comercial", en: "Commercial batch" },
  { es: "UID del Tag", pt: "UID da tag", en: "Tag UID" },
  { es: "UID del tag", pt: "UID da tag", en: "Tag UID" },
  { es: "Lectura", pt: "Leitura", en: "Read" },
  { es: "Lectura registrada", pt: "Leitura registrada", en: "Recorded read" },
  { es: "Registrada ahora", pt: "Registrada agora", en: "Recorded now" },
  { es: "Etiqueta", pt: "Etiqueta", en: "Tag" },
  { es: "Sello", pt: "Lacre", en: "Seal" },
  { es: "Tecnología", pt: "Tecnologia", en: "Technology" },
  { es: "Indicador técnico", pt: "Indicador técnico", en: "Technical indicator" },
  { es: "Lote / batch", pt: "Lote / batch", en: "Batch" },
  { es: "Origen declarado", pt: "Origem declarada", en: "Declared origin" },
  { es: "Origen informado", pt: "Origem informada", en: "Reported origin" },
  { es: "Origen no informado", pt: "Origem não informada", en: "Origin not provided" },
  { es: "Origen pendiente", pt: "Origem pendente", en: "Origin pending" },
  { es: "Lectura digital confirmada", pt: "Leitura digital confirmada", en: "Digital read confirmed" },
  { es: "Lectura no confirmada", pt: "Leitura não confirmada", en: "Read not confirmed" },
  { es: "Ficha digital disponible", pt: "Ficha digital disponível", en: "Digital product record available" },
  { es: "Lectura repetida", pt: "Leitura repetida", en: "Repeated read" },
  { es: "Lectura por revisar", pt: "Leitura para revisar", en: "Read requires review" },
  { es: "Apertura declarada", pt: "Abertura declarada", en: "Declared opening" },
  { es: "Atención recomendada", pt: "Atenção recomendada", en: "Review recommended" },
  { es: "Sin apertura detectada", pt: "Nenhuma abertura detectada", en: "No opening detected" },
  { es: "Declarada por un operador", pt: "Declarada por um operador", en: "Declared by an operator" },
  { es: "Apertura detectada", pt: "Abertura detectada", en: "Opening detected" },
  { es: "Estado del sello no disponible", pt: "Estado do lacre indisponível", en: "Seal status unavailable" },
  { es: "Ver controles de esta lectura", pt: "Ver controles desta leitura", en: "View read controls" },
  { es: "Datos principales de esta lectura", pt: "Dados principais desta leitura", en: "Key data for this read" },
  { es: "Este resultado corresponde únicamente a este tag y esta lectura.", pt: "Este resultado corresponde somente a esta tag e a esta leitura.", en: "This result applies only to this tag and this read." },
  { es: "Este resultado corresponde a la etiqueta digital. No confirma por sí solo la autenticidad ni el estado del producto físico.", pt: "Este resultado corresponde à etiqueta digital. Sozinho, não confirma a autenticidade nem o estado do produto físico.", en: "This result applies to the digital tag. On its own, it does not confirm the physical product's authenticity or condition." },
  { es: "La apertura fue declarada por un operador; no fue detectada automáticamente por la etiqueta digital.", pt: "A abertura foi declarada por um operador; não foi detectada automaticamente pela etiqueta digital.", en: "The opening was declared by an operator; it was not detected automatically by the digital tag." },
  { es: "La apertura informada proviene de la etiqueta digital; su relación con el envase depende de cómo fue instalada.", pt: "A abertura informada vem da etiqueta digital; sua relação com a embalagem depende de como ela foi instalada.", en: "The reported opening comes from the digital tag; its relationship to the package depends on how the tag was installed." },

  { es: "Mapa del pasaporte", pt: "Mapa do passaporte", en: "Passport map" },
  { es: "Origen y ubicación de muestra", pt: "Origem e localização de demonstração", en: "Demo origin and location" },
  { es: "Origen y zona estimada por red", pt: "Origem e zona estimada pela rede", en: "Origin and network-estimated area" },
  { es: "Origen y zona compartida", pt: "Origem e zona compartilhada", en: "Origin and shared area" },
  { es: "Origen y ubicación reportada", pt: "Origem e localização informada", en: "Origin and reported location" },
  { es: "Zona de esta lectura", pt: "Zona desta leitura", en: "Area for this read" },
  { es: "Sin ubicación", pt: "Sem localização", en: "No location" },
  { es: "El tap no informó coordenadas. El pasaporte sigue disponible y no se inventa una posición.", pt: "O toque não informou coordenadas. O passaporte continua disponível e nenhuma posição é inventada.", en: "The tap provided no coordinates. The passport remains available, and no position is invented." },
  { es: "Zona estimada por red", pt: "Zona estimada pela rede", en: "Network-estimated area" },
  { es: "Red / IP · aproximada", pt: "Rede / IP · aproximada", en: "Network / IP · approximate" },
  { es: "Es una referencia amplia calculada por la conexión. No es GPS del teléfono ni una ubicación exacta.", pt: "É uma referência ampla calculada pela conexão. Não é o GPS do telefone nem uma localização exata.", en: "This is a broad estimate based on the connection. It is not the phone's GPS or an exact location." },
  { es: "Zona compartida por el teléfono", pt: "Zona compartilhada pelo telefone", en: "Area shared by the phone" },
  { es: "Navegador · aproximada", pt: "Navegador · aproximada", en: "Browser · approximate" },
  { es: "El navegador compartió esta zona aproximada después del tap y con consentimiento. La coordenada pública está redondeada.", pt: "O navegador compartilhou esta zona aproximada após o toque e com consentimento. A coordenada pública está arredondada.", en: "The browser shared this approximate area after the tap with consent. The public coordinate is rounded." },
  { es: "Ubicación informada por integración", pt: "Localização informada pela integração", en: "Integration-reported location" },
  { es: "Fuente heredada · no confirmada", pt: "Fonte legada · não confirmada", en: "Legacy source · unconfirmed" },
  { es: "La integración informó esta coordenada, pero el registro no acredita consentimiento del navegador ni una posición exacta.", pt: "A integração informou esta coordenada, mas o registro não comprova consentimento do navegador nem uma posição exata.", en: "The integration reported this coordinate, but the record does not prove browser consent or an exact position." },
  { es: "Zona de muestra", pt: "Zona de demonstração", en: "Demo area" },
  { es: "Demo simulado", pt: "Demonstração simulada", en: "Simulated demo" },
  { es: "Este punto pertenece al Demo Lab y no representa un teléfono ni una lectura física.", pt: "Este ponto pertence ao Demo Lab e não representa um telefone nem uma leitura física.", en: "This point belongs to the Demo Lab and does not represent a phone or a physical read." },
  { es: "Fuente reportada", pt: "Fonte informada", en: "Reported source" },
  { es: "Se muestra la coordenada informada por la fuente sin atribuirle una precisión adicional.", pt: "A coordenada informada pela fonte é exibida sem atribuir precisão adicional.", en: "The coordinate reported by the source is shown without assigning additional accuracy." },
  { es: "Origen no geolocalizado", pt: "Origem não geolocalizada", en: "Origin not geolocated" },
  { es: "Ubicación no confirmada", pt: "Localização não confirmada", en: "Location not confirmed" },
  { es: "La empresa todavía no informó coordenadas.", pt: "A empresa ainda não informou coordenadas.", en: "The company has not provided coordinates yet." },
  { es: "Informado por la empresa", pt: "Informado pela empresa", en: "Reported by the company" },
  { es: "Cómo se obtuvo esta ubicación", pt: "Como esta localização foi obtida", en: "How this location was obtained" },
  { es: "Ubicación de esta lectura", pt: "Localização desta leitura", en: "Location for this read" },
  { es: "Ubicación demo simulada", pt: "Localização simulada da demonstração", en: "Simulated demo location" },
  { es: "Zona aproximada confirmada", pt: "Zona aproximada confirmada", en: "Approximate area confirmed" },
  { es: "Zona de red · no es GPS", pt: "Zona de rede · não é GPS", en: "Network area · not GPS" },
  { es: "Sin ubicación registrada", pt: "Sem localização registrada", en: "No location recorded" },
  { es: "Sin fuente ni precisión registradas", pt: "Sem fonte nem precisão registradas", en: "No source or accuracy recorded" },
  { es: "Hora no registrada", pt: "Horário não registrado", en: "Time not recorded" },
  { es: "Fuente / precisión", pt: "Fonte / precisão", en: "Source / accuracy" },
  { es: "Hora del tap", pt: "Horário do toque", en: "Tap time" },
  { es: "Ver fuente y horario", pt: "Ver fonte e horário", en: "View source and time" },
  { es: "Compartir ubicación aproximada del teléfono", pt: "Compartilhar localização aproximada do telefone", en: "Share the phone's approximate location" },
  { es: "El tap no compartió ubicación. El pasaporte funciona igual y podés agregar una zona si querés.", pt: "O toque não compartilhou localização. O passaporte continua funcionando e você pode adicionar uma zona se quiser.", en: "The tap did not share a location. The passport still works, and you can add an area if you choose." },
  { es: "Esta ubicación pertenece a la simulación y no a un teléfono real.", pt: "Esta localização pertence à demonstração, não a um telefone real.", en: "This location belongs to the simulation, not to a real phone." },
  { es: "El teléfono compartió una zona aproximada después del tap y con tu permiso.", pt: "O telefone compartilhou uma zona aproximada após o toque e com a sua permissão.", en: "The phone shared an approximate area after the tap and with your permission." },
  { es: "No es tu posición: la red estima una zona amplia y puede ubicarte en otra ciudad. Compartí la ubicación del teléfono si querés mejorarla.", pt: "Esta não é a sua posição: a rede estima uma área ampla e pode indicar outra cidade. Compartilhe a localização do telefone se quiser melhorar a estimativa.", en: "This is not your position: the network estimates a broad area and may place you in another city. Share the phone location if you want to improve it." },
  { es: "Se muestra la zona informada por la fuente, sin agregar precisión que no fue reportada.", pt: "Mostramos a zona informada pela fonte, sem adicionar uma precisão que não foi fornecida.", en: "The area reported by the source is shown without adding unreported accuracy." },
  { es: "Los puntos y la conexión son simulados y no representan un recorrido físico.", pt: "Os pontos e a conexão são simulados e não representam um trajeto físico.", en: "The points and connection are simulated and do not represent a physical route." },
  { es: "El mapa muestra únicamente el origen declarado. Esta lectura no informó coordenadas y no se reutiliza una ciudad histórica como ubicación actual.", pt: "O mapa mostra somente a origem declarada. Esta leitura não informou coordenadas e nenhuma cidade histórica é reutilizada como localização atual.", en: "The map shows only the declared origin. This read provided no coordinates, and a historical city is not reused as the current location." },
  { es: "La zona de red es una referencia amplia de la conexión: no es GPS, no ubica el producto y no prueba dónde ocurrió el tap.", pt: "A zona de rede é uma referência ampla da conexão: não é GPS, não localiza o produto e não prova onde o toque ocorreu.", en: "The network area is a broad connection reference: it is not GPS, does not locate the product, and does not prove where the tap occurred." },
  { es: "La zona fue compartida por el teléfono después del tap y con permiso. Se muestra separada del origen, sin inventar un recorrido.", pt: "A zona foi compartilhada pelo telefone após o toque e com permissão. Ela aparece separada da origem, sem inventar um trajeto.", en: "The area was shared by the phone after the tap with permission. It is shown separately from the origin, without inventing a route." },
  { es: "La fuente y la precisión quedan explicadas sin inventar una ruta. La coordenada informada por la integración se mantiene separada del origen.", pt: "A fonte e a precisão são explicadas sem inventar uma rota. A coordenada informada pela integração permanece separada da origem.", en: "The source and accuracy are explained without inventing a route. The integration-reported coordinate remains separate from the origin." },
  { es: "Coordenada declarada por la empresa; no medida por el NFC.", pt: "Coordenada declarada pela empresa; não medida pelo NFC.", en: "Coordinate declared by the company; not measured by NFC." },
  { es: "Vista local sin solicitudes automáticas a proveedores de mapas externos.", pt: "Visualização local sem solicitações automáticas a provedores de mapas externos.", en: "Local view with no automatic requests to external map providers." },
  { es: "Abrir mapa ↗", pt: "Abrir mapa ↗", en: "Open map ↗" },
  { es: "Ver ambos puntos", pt: "Ver os dois pontos", en: "View both points" },
  { es: "Cargando cartografía", pt: "Carregando cartografia", en: "Loading map" },
  { es: "Preparando cuadrícula local", pt: "Preparando grade local", en: "Preparing local grid" },
  { es: "Las ubicaciones informadas siguen disponibles en la lista.", pt: "As localizações informadas continuam disponíveis na lista.", en: "Reported locations remain available in the list." },
  { es: "Las ubicaciones y sus enlaces siguen accesibles debajo.", pt: "As localizações e seus links continuam acessíveis abaixo.", en: "Locations and their links remain available below." },
  { es: "Reintentar mapa", pt: "Tentar carregar o mapa novamente", en: "Retry map" },
  { es: "No hay ubicaciones reportadas.", pt: "Não há localizações informadas.", en: "No reported locations." },
  { es: "La empresa no informó coordenadas de origen y el usuario no confirmó una zona para esta lectura.", pt: "A empresa não informou coordenadas de origem e o usuário não confirmou uma zona para esta leitura.", en: "The company provided no origin coordinates, and the user did not confirm an area for this read." },
  { es: "Zona por red", pt: "Zona pela rede", en: "Network area" },
  { es: "Zona por red / IP", pt: "Zona por rede / IP", en: "Network / IP area" },
  { es: "Navegador consentido", pt: "Navegador autorizado", en: "Consented browser" },
  { es: "Punto demo", pt: "Ponto demo", en: "Demo point" },
  { es: "Esta lectura", pt: "Esta leitura", en: "This read" },
  { es: "No calculamos una distancia para el usuario porque la ubicación de red es demasiado amplia para presentarla como una medición precisa.", pt: "Não calculamos uma distância para o usuário porque a localização de rede é ampla demais para ser apresentada como uma medição precisa.", en: "We do not calculate a user distance because the network location is too broad to present as a precise measurement." },
  { es: "No calculamos una distancia porque la fuente de esta ubicación no acredita una medición consentida y comparable.", pt: "Não calculamos uma distância porque a fonte desta localização não comprova uma medição consentida e comparável.", en: "We do not calculate a distance because this location source does not establish a consented, comparable measurement." },
  { es: "Se muestra únicamente la ubicación disponible. No se inventa una posición ni una ruta para el punto faltante.", pt: "Mostramos somente a localização disponível. Nenhuma posição ou rota é inventada para o ponto ausente.", en: "Only the available location is shown. No position or route is invented for the missing point." },
  { es: "Cartografía:", pt: "Cartografia:", en: "Map data:" },
  { es: "El proveedor cartográfico recibe la IP de red y el área de las teselas solicitadas. La URL y el identificador del pasaporte no se envían mediante la política no-referrer.", pt: "O provedor cartográfico recebe o IP da rede e a área dos blocos solicitados. A URL e o identificador do passaporte não são enviados devido à política no-referrer.", en: "The map provider receives the network IP and requested tile area. The passport URL and identifier are not sent because of the no-referrer policy." },
  { es: "Solo origen · lectura sin coordenadas", pt: "Somente origem · leitura sem coordenadas", en: "Origin only · read without coordinates" },
  { es: "No mostramos un mapa, una ruta ni puntos de ejemplo.", pt: "Não mostramos mapa, rota ou pontos de exemplo.", en: "No map, route, or sample points are shown." },
  { es: "Sin coordenadas observadas", pt: "Sem coordenadas observadas", en: "No observed coordinates" },
  { es: "Ubicación no disponible", pt: "Localização indisponível", en: "Location unavailable" },

  { es: "Ubicación de este teléfono", pt: "Localização deste telefone", en: "This phone's location" },
  { es: "Zona aproximada del teléfono", pt: "Zona aproximada do telefone", en: "Phone's approximate area" },
  { es: "Agregá la zona del teléfono a esta lectura", pt: "Adicione a zona do telefone a esta leitura", en: "Add the phone's area to this read" },
  { es: "La ciudad estimada por la red puede ser incorrecta. Sólo pediremos ubicación al tocar el botón. El origen reportado del producto no se modifica.", pt: "A cidade estimada pela rede pode estar incorreta. Só pediremos a localização quando você tocar no botão. A origem informada do produto não será alterada.", en: "The network-estimated city may be wrong. Location is requested only when you press the button. The product's reported origin is not changed." },
  { es: "Agregar zona al pasaporte", pt: "Adicionar zona ao passaporte", en: "Add area to passport" },
  { es: "Solicitando permiso...", pt: "Solicitando permissão...", en: "Requesting permission..." },
  { es: "Guardando zona...", pt: "Salvando zona...", en: "Saving area..." },
  { es: "Volver a intentar", pt: "Tentar novamente", en: "Try again" },
  { es: "Opcional · ubicación aproximada · zona redondeada · sin cambiar la validación", pt: "Opcional · localização aproximada · zona arredondada · sem alterar a validação", en: "Optional · approximate location · rounded area · validation unchanged" },
  { es: "Medición aproximada guardada", pt: "Medição aproximada salva", en: "Approximate measurement saved" },
  { es: "El mapa ya usa la zona aproximada que compartiste después del tap.", pt: "O mapa já usa a zona aproximada que você compartilhou após o toque.", en: "The map now uses the approximate area you shared after the tap." },
  { es: "Ver comprobante de ubicación", pt: "Ver comprovante de localização", en: "View location receipt" },
  { es: "Fuente:", pt: "Fonte:", en: "Source:" },
  { es: "geolocalización aproximada del navegador con permiso", pt: "geolocalização aproximada do navegador com permissão", en: "permission-based approximate browser geolocation" },
  { es: "Precisión informada:", pt: "Precisão informada:", en: "Reported accuracy:" },
  { es: "Tap recibido:", pt: "Toque recebido:", en: "Tap received:" },
  { es: "Ubicación medida:", pt: "Localização medida:", en: "Location measured:" },
  { es: "Abrir zona aproximada en OpenStreetMap (sitio externo)", pt: "Abrir zona aproximada no OpenStreetMap (site externo)", en: "Open approximate area in OpenStreetMap (external site)" },
  { es: "Cómo funciona", pt: "Como funciona", en: "How it works" },
  { es: "No pudimos asociar la ubicación a este evento. La validación SUN no cambió; hacé un nuevo tap físico para volver a intentarlo.", pt: "Não foi possível associar a localização a este evento. A validação SUN não mudou; faça um novo toque físico para tentar novamente.", en: "We could not link the location to this event. SUN validation did not change; make a new physical tap to try again." },
  { es: "El permiso fue denegado. Podés habilitarlo en el navegador y volver a intentar; el pasaporte sigue funcionando sin ubicación.", pt: "A permissão foi negada. Você pode ativá-la no navegador e tentar novamente; o passaporte continua funcionando sem localização.", en: "Permission was denied. You can enable it in the browser and try again; the passport still works without location." },
  { es: "El teléfono no obtuvo una ubicación a tiempo. Revisá señal y permisos; la validación SUN sigue disponible.", pt: "O telefone não obteve a localização a tempo. Verifique o sinal e as permissões; a validação SUN continua disponível.", en: "The phone did not get a location in time. Check signal and permissions; SUN validation remains available." },
  { es: "Este navegador o contexto no permite geolocalización. Abrí el pasaporte por HTTPS en el navegador del teléfono; la validación sigue funcionando.", pt: "Este navegador ou contexto não permite geolocalização. Abra o passaporte por HTTPS no navegador do telefone; a validação continua funcionando.", en: "This browser or context does not allow geolocation. Open the passport over HTTPS in the phone browser; validation still works." },
  { es: "El navegador devolvió una medición sin coordenadas o precisión utilizables. No la guardamos; podés volver a intentar.", pt: "O navegador retornou uma medição sem coordenadas ou precisão utilizáveis. Ela não foi salva; você pode tentar novamente.", en: "The browser returned a measurement without usable coordinates or accuracy. It was not saved; you can try again." },
  { es: "El navegador devolvió una medición anterior a tu solicitud. La descartamos y podés pedir una medición nueva.", pt: "O navegador retornou uma medição anterior à sua solicitação. Ela foi descartada e você pode pedir uma nova medição.", en: "The browser returned a measurement older than your request. It was discarded, and you can request a new measurement." },
  { es: "La zona no se guardó esta vez. La autorización de la lectura sigue disponible y podés volver a intentar.", pt: "A zona não foi salva desta vez. A autorização da leitura continua disponível e você pode tentar novamente.", en: "The area was not saved this time. The read authorization remains available, and you can try again." },
  { es: "La autorización breve de esta lectura ya no está disponible. La ubicación no se marcó como guardada; hacé un nuevo tap físico para asociar otra medición.", pt: "A autorização breve desta leitura não está mais disponível. A localização não foi marcada como salva; faça um novo toque físico para associar outra medição.", en: "The short-lived authorization for this read is no longer available. The location was not marked as saved; make a new physical tap to link another measurement." },
  { es: "No pudimos confirmar si el servidor guardó esta medición. No la mostramos como guardada; hacé un nuevo tap físico para asociar una ubicación con certeza.", pt: "Não foi possível confirmar se o servidor salvou esta medição. Ela não é mostrada como salva; faça um novo toque físico para associar uma localização com certeza.", en: "We could not confirm whether the server saved this measurement. It is not shown as saved; make a new physical tap to link a location with certainty." },
  { es: "No se pudo obtener una zona aproximada. El pasaporte sigue funcionando sin ella.", pt: "Não foi possível obter uma zona aproximada. O passaporte continua funcionando sem ela.", en: "An approximate area could not be obtained. The passport still works without it." },
  { es: "El teléfono reportó esta zona y se actualizó el evento sin repetir el tap. La medición ocurre después de tocar el botón: no es una coordenada emitida por el NFC, no fue verificada de forma independiente y no prueba el instante RF, recorrido, custodia o autenticidad física. El punto público está redondeado y puede abarcar un área mayor. Como contexto agregado, nexID sólo guarda la zona horaria del navegador.", pt: "O telefone informou esta zona e o evento foi atualizado sem repetir o toque. A medição ocorre após tocar no botão: não é uma coordenada emitida pelo NFC, não foi verificada de forma independente e não comprova o instante de RF, trajeto, custódia ou autenticidade física. O ponto público é arredondado e pode abranger uma área maior. Como contexto adicional, a nexID guarda apenas o fuso horário do navegador.", en: "The phone reported this area and the event was updated without repeating the tap. Measurement occurs after pressing the button: it is not a coordinate emitted by NFC, was not independently verified, and does not prove the RF moment, route, custody, or physical authenticity. The public point is rounded and may cover a larger area. As added context, nexID stores only the browser time zone." },
  { es: "El NFC pasivo no aporta ubicación. La geolocalización del navegador toma una medición nueva después de tocar el botón; puede usar señales del dispositivo como Wi-Fi, red móvil o GPS. nexID redondea la zona y guarda fuente, precisión y horarios separados del tap. Como contexto agrega sólo la zona horaria: no agrega idioma, user-agent, plataforma ni tamaño de pantalla.", pt: "O NFC passivo não fornece localização. A geolocalização do navegador faz uma nova medição depois que você toca no botão; pode usar sinais do dispositivo como Wi-Fi, rede móvel ou GPS. A nexID arredonda a zona e guarda fonte, precisão e horários separados do toque. Como contexto, adiciona apenas o fuso horário: não adiciona idioma, user-agent, plataforma nem tamanho da tela.", en: "Passive NFC does not provide location. Browser geolocation takes a new measurement after you press the button and may use device signals such as Wi-Fi, mobile network, or GPS. nexID rounds the area and stores source, accuracy, and timestamps separately from the tap. It adds only the browser time zone as context—not language, user agent, platform, or screen size." },

  { es: "Estado y sensores", pt: "Estado e sensores", en: "Status and sensors" },
  { es: "Condicion informada del producto", pt: "Condição informada do produto", en: "Reported product condition" },
  { es: "Datos ambientales del producto", pt: "Dados ambientais do produto", en: "Product environmental data" },
  { es: "Ultima lectura reportada", pt: "Última leitura informada", en: "Latest reported reading" },
  { es: "Ficha del lote · no es lectura en vivo", pt: "Ficha do lote · não é leitura ao vivo", en: "Batch record · not a live reading" },
  { es: "Muestra demo · no es lectura en vivo", pt: "Demonstração · não é leitura ao vivo", en: "Demo sample · not a live reading" },
  { es: "Simulación local · sin hardware", pt: "Simulação local · sem hardware", en: "Local simulation · no hardware" },
  { es: "Exposicion baja (simulada)", pt: "Baixa exposição (simulada)", en: "Low exposure (simulated)" },
  { es: "Sin golpes críticos en la simulación", pt: "Sem impactos críticos na simulação", en: "No critical impacts in the simulation" },
  { es: "Fuente", pt: "Fonte", en: "Source" },
  { es: "Observada", pt: "Observada", en: "Observed" },
  { es: "Modo", pt: "Modo", en: "Mode" },
  { es: "Temperatura", pt: "Temperatura", en: "Temperature" },
  { es: "Humedad", pt: "Umidade", en: "Humidity" },
  { es: "Luz", pt: "Luz", en: "Light" },
  { es: "Impacto", pt: "Impacto", en: "Impact" },
  { es: "Este bloque proviene de datos configurados, no de un sensor en vivo. Un historial solo aparece cuando llegan eventos con fuente y fecha.", pt: "Este bloco vem de dados configurados, não de um sensor ao vivo. O histórico só aparece quando chegam eventos com fonte e data.", en: "This block comes from configured data, not a live sensor. History appears only when events arrive with a source and timestamp." },
  { es: "Datos simulados del Demo Lab. El perfil y las distinciones siguientes ilustran el formato; no son certificaciones reales.", pt: "Dados simulados do Demo Lab. O perfil e as distinções abaixo ilustram o formato; não são certificações reais.", en: "Simulated Demo Lab data. The profile and distinctions below illustrate the format; they are not real certifications." },
  { es: "Ver JSON normalizado", pt: "Ver JSON normalizado", en: "View normalized JSON" },
  { es: "Monitoreo IoT", pt: "Monitoramento IoT", en: "IoT monitoring" },
  { es: "Sin telemetría IoT asociada a este lote.", pt: "Nenhuma telemetria IoT associada a este lote.", en: "No IoT telemetry is associated with this batch." },
  { es: "La identidad NFC y la bitácora de eventos siguen disponibles; no inferimos temperatura, humedad ni golpes sin evidencia.", pt: "A identidade NFC e o registro de eventos continuam disponíveis; não inferimos temperatura, umidade ou impactos sem evidência.", en: "NFC identity and the event log remain available; temperature, humidity, and impacts are not inferred without evidence." },
  { es: "Ficha sensorial del productor", pt: "Ficha sensorial do produtor", en: "Producer sensory profile" },
  { es: "La marca todavía no cargó una ficha sensorial para este producto.", pt: "A marca ainda não publicou uma ficha sensorial para este produto.", en: "The brand has not yet published a sensory profile for this product." },
  { es: "Distinciones ilustrativas", pt: "Distinções ilustrativas", en: "Illustrative distinctions" },
  { es: "Puntaje demo", pt: "Pontuação demo", en: "Demo score" },
  { es: "Premio simulado", pt: "Prêmio simulado", en: "Simulated award" },
  { es: "Origen de ejemplo", pt: "Origem de exemplo", en: "Sample origin" },
  { es: "Bitácora de Eventos", pt: "Registro de eventos", en: "Event log" },

  { es: "Servicios de la marca", pt: "Serviços da marca", en: "Brand services" },
  { es: "¿Qué querés hacer con este producto?", pt: "O que você quer fazer com este produto?", en: "What would you like to do with this product?" },
  { es: "Cada acción es opcional y se procesa por separado de la lectura NFC.", pt: "Cada ação é opcional e processada separadamente da leitura NFC.", en: "Each action is optional and processed separately from the NFC read." },
  { es: "Sin alertas reportadas", pt: "Sem alertas informados", en: "No reported alerts" },
  { es: "Podés consultar los servicios que la marca habilitó para esta unidad.", pt: "Você pode consultar os serviços que a marca habilitou para esta unidade.", en: "You can view the services the brand enabled for this unit." },
  { es: "Lectura con observaciones", pt: "Leitura com observações", en: "Read with observations" },
  { es: "Revisá la evidencia antes de iniciar una acción asociada al producto.", pt: "Revise a evidência antes de iniciar uma ação associada ao produto.", en: "Review the evidence before starting an action linked to the product." },
  { es: "Acciones protegidas", pt: "Ações protegidas", en: "Protected actions" },
  { es: "Claim, garantía y promociones quedan pausados mientras la marca revisa la lectura.", pt: "Vínculo, garantia e promoções ficam pausados enquanto a marca revisa a leitura.", en: "Claim, warranty, and promotions remain paused while the brand reviews the read." },
  { es: "Tap vigente", pt: "Toque vigente", en: "Current tap" },
  { es: "Tap vencido", pt: "Toque expirado", en: "Expired tap" },
  { es: "Vista guardada", pt: "Visualização salva", en: "Saved view" },
  { es: "Muestra sin tap físico", pt: "Demonstração sem toque físico", en: "Preview without a physical tap" },
  { es: "Frescura no informada", pt: "Atualidade não informada", en: "Freshness not provided" },
  { es: "Beneficios publicados por la marca", pt: "Benefícios publicados pela marca", en: "Benefits published by the brand" },
  { es: "La marca no publicó una promoción para este producto", pt: "A marca não publicou uma promoção para este produto", en: "The brand has not published a promotion for this product" },
  { es: "Revisar lectura", pt: "Revisar leitura", en: "Review read" },
  { es: "La promoción queda oculta mientras esta lectura requiere revisión.", pt: "A promoção fica oculta enquanto esta leitura exige revisão.", en: "The promotion remains hidden while this read requires review." },
  { es: "La promoción no está habilitada por la política de este producto.", pt: "A promoção não está habilitada pela política deste produto.", en: "The promotion is not enabled by this product's policy." },
  { es: "Las acciones protegidas pueden pedir una nueva lectura NFC antes de continuar.", pt: "As ações protegidas podem exigir uma nova leitura NFC antes de continuar.", en: "Protected actions may require a new NFC read before continuing." },
  { es: "Servicios disponibles para este producto", pt: "Serviços disponíveis para este produto", en: "Services available for this product" },
  { es: "Solicitar compra", pt: "Solicitar compra", en: "Request purchase" },
  { es: "Consultá disponibilidad con la marca. La solicitud no confirma stock ni completa una compra.", pt: "Consulte a disponibilidade com a marca. A solicitação não confirma estoque nem conclui uma compra.", en: "Ask the brand about availability. The request does not confirm stock or complete a purchase." },
  { es: "Suscribirme a novedades", pt: "Assinar novidades", en: "Subscribe to updates" },
  { es: "Elegí si querés recibir información publicada por la marca. No promete premios.", pt: "Escolha se quer receber informações publicadas pela marca. Isso não promete prêmios.", en: "Choose whether to receive information published by the brand. It does not promise rewards." },
  { es: "Solicitar vínculo o gestionar", pt: "Solicitar vínculo ou gerenciar", en: "Request link or manage" },
  { es: "El tap no transfiere propiedad: identidad, compra y política se validan por separado.", pt: "O toque não transfere propriedade: identidade, compra e política são validadas separadamente.", en: "The tap does not transfer ownership: identity, purchase, and policy are validated separately." },
  { es: "Solicitar garantía", pt: "Solicitar garantia", en: "Request warranty" },
  { es: "Iniciá la revisión de la marca. Enviar la solicitud no confirma su aceptación.", pt: "Inicie a revisão da marca. Enviar a solicitação não confirma sua aceitação.", en: "Start the brand review. Submitting the request does not confirm acceptance." },
  { es: "La marca no habilitó servicios adicionales para este producto.", pt: "A marca não habilitou serviços adicionais para este produto.", en: "The brand has not enabled additional services for this product." },
  { es: "Reportar esta lectura a la marca", pt: "Informar esta leitura à marca", en: "Report this read to the brand" },
  { es: "Como se protege cada accion", pt: "Como cada ação é protegida", en: "How each action is protected" },
  { es: "Toca el chip NFC para acciones protegidas", pt: "Toque no chip NFC para ações protegidas", en: "Tap the NFC chip for protected actions" },
  { es: "Hace un nuevo tap desde la etiqueta fisica", pt: "Faça um novo toque na etiqueta física", en: "Make a new tap from the physical tag" },
  { es: "El QR abre contenido y CRM, pero no prueba posesion ni autenticidad criptografica. Acerca el telefono al chip NFC para reclamar, registrar garantia o solicitar tokenizacion.", pt: "O QR abre conteúdo e CRM, mas não comprova posse nem autenticidade criptográfica. Aproxime o telefone do chip NFC para solicitar vínculo, registrar garantia ou pedir tokenização.", en: "The QR opens content and CRM but does not prove possession or cryptographic authenticity. Bring the phone near the NFC chip to claim, register a warranty, or request tokenization." },
  { es: "Desbloquea el telefono, acerca la zona NFC a la etiqueta y abri el enlace que aparezca. Esta vista historica conserva la evidencia, pero no puede fabricar la frescura criptografica de otro tap.", pt: "Desbloqueie o telefone, aproxime a área NFC da etiqueta e abra o link exibido. Esta visualização histórica preserva a evidência, mas não pode recriar a atualidade criptográfica de outro toque.", en: "Unlock the phone, bring its NFC area near the tag, and open the link that appears. This historical view preserves evidence but cannot recreate the cryptographic freshness of another tap." },

  { es: "Novedades de la marca", pt: "Novidades da marca", en: "Brand updates" },
  { es: "Opt-in separado del tap. No activa premios, propiedad ni garantía y no solicita ubicación o datos del dispositivo.", pt: "Consentimento separado do toque. Não ativa prêmios, propriedade ou garantia e não solicita localização nem dados do dispositivo.", en: "Opt-in is separate from the tap. It does not activate rewards, ownership, or warranty and does not request location or device data." },
  { es: "Suscripción solicitada", pt: "Assinatura solicitada", en: "Subscription requested" },
  { es: "La marca puede comunicarse por el canal autorizado. Podrás pedir la baja desde cualquier mensaje.", pt: "A marca pode entrar em contato pelo canal autorizado. Você poderá cancelar em qualquer mensagem.", en: "The brand may contact you through the authorized channel. You can unsubscribe from any message." },
  { es: "Cerrar formulario", pt: "Fechar formulário", en: "Close form" },
  { es: "Elegir canal de contacto", pt: "Escolher canal de contato", en: "Choose contact channel" },
  { es: "Nombre", pt: "Nome", en: "Name" },
  { es: "(opcional)", pt: "(opcional)", en: "(optional)" },
  { es: "Tu nombre", pt: "Seu nome", en: "Your name" },
  { es: "Email o WhatsApp", pt: "Email ou WhatsApp", en: "Email or WhatsApp" },
  { es: "Confirmar suscripción", pt: "Confirmar assinatura", en: "Confirm subscription" },
  { es: "Guardando autorización...", pt: "Salvando autorização...", en: "Saving authorization..." },
  { es: "No pudimos guardar la autorización. Reintentá en unos segundos.", pt: "Não foi possível salvar a autorização. Tente novamente em alguns segundos.", en: "We could not save the authorization. Try again in a few seconds." },

  { es: "Información técnica de la etiqueta", pt: "Informações técnicas da etiqueta", en: "Tag technical information" },
  { es: "Identificador del chip", pt: "Identificador do chip", en: "Chip identifier" },
  { es: "Número de lectura", pt: "Número da leitura", en: "Read number" },
  { es: "Evidencia CMAC", pt: "Evidência CMAC", en: "CMAC evidence" },
  { es: "Registro público opcional", pt: "Registro público opcional", en: "Optional public record" },
  { es: "Hash de Transacción", pt: "Hash da transação", en: "Transaction hash" },
  { es: "Señal electrónica TagTamper", pt: "Sinal eletrônico TagTamper", en: "TagTamper electronic signal" },
  { es: "Detalle técnico TagTamper byte por byte", pt: "Detalhe técnico TagTamper byte a byte", en: "Byte-by-byte TagTamper technical detail" },
  { es: "Byte", pt: "Byte", en: "Byte" },
  { es: "fuente", pt: "fonte", en: "source" },
  { es: "longitud", pt: "comprimento", en: "length" },
  { es: "Este detalle describe la señal electrónica TT reportada por la etiqueta. Por sí solo no prueba el contenido, la custodia ni la integridad física del producto.", pt: "Este detalhe descreve o sinal eletrônico TT informado pela etiqueta. Sozinho, não comprova o conteúdo, a custódia ou a integridade física do produto.", en: "This detail describes the electronic TT signal reported by the tag. On its own, it does not prove the product's contents, custody, or physical integrity." },

  { es: "Pasaporte digital agro", pt: "Passaporte digital agro", en: "Agricultural digital passport" },
  { es: "Cultivo", pt: "Cultura", en: "Crop" },
  { es: "Variedad", pt: "Variedade", en: "Variety" },
  { es: "Familia", pt: "Família", en: "Family" },
  { es: "Formulación", pt: "Formulação", en: "Formulation" },
  { es: "Confianza", pt: "Confiança", en: "Trust" },
  { es: "Lote, registro y canal", pt: "Lote, registro e canal", en: "Batch, registration, and channel" },
  { es: "Registro", pt: "Registro", en: "Registration" },
  { es: "Producción", pt: "Produção", en: "Production" },
  { es: "Vencimiento", pt: "Validade", en: "Expiration" },
  { es: "Distribuidor", pt: "Distribuidor", en: "Distributor" },
  { es: "Canal autorizado", pt: "Canal autorizado", en: "Authorized channel" },
  { es: "Consultar estado o recall", pt: "Consultar estado ou recall", en: "Check status or recall" },
  { es: "Información técnica", pt: "Informações técnicas", en: "Technical information" },
  { es: "Abrir ficha técnica", pt: "Abrir ficha técnica", en: "Open technical sheet" },
  { es: "Abrir hoja de seguridad", pt: "Abrir ficha de segurança", en: "Open safety data sheet" },
  { es: "Uso responsable y EPP", pt: "Uso responsável e EPI", en: "Responsible use and PPE" },
  { es: "Ver equipo de protección", pt: "Ver equipamento de proteção", en: "View protective equipment" },
  { es: "Confirmar que leí las indicaciones", pt: "Confirmar que li as orientações", en: "Confirm I read the instructions" },
  { es: "Soporte y asesor", pt: "Suporte e consultor", en: "Support and advisor" },
  { es: "Contactar a un asesor", pt: "Contatar um consultor", en: "Contact an advisor" },
  { es: "Herramienta agronómica", pt: "Ferramenta agronômica", en: "Agronomic tool" },
  { es: "Capacitación y beneficios", pt: "Treinamento e benefícios", en: "Training and benefits" },
  { es: "Comenzar capacitación", pt: "Iniciar treinamento", en: "Start training" },
  { es: "Ver beneficio disponible", pt: "Ver benefício disponível", en: "View available benefit" },
  { es: "Procedencia y eventos", pt: "Procedência e eventos", en: "Provenance and events" },
  { es: "Reportar un problema", pt: "Informar um problema", en: "Report a problem" },
  { es: "Datos técnicos del pasaporte", pt: "Dados técnicos do passaporte", en: "Passport technical data" },
  { es: "Autenticación", pt: "Autenticação", en: "Authentication" },
  { es: "Acciones sensibles bloqueadas", pt: "Ações sensíveis bloqueadas", en: "Sensitive actions blocked" },
  { es: "No hay eventos públicos adicionales para mostrar.", pt: "Não há eventos públicos adicionais para mostrar.", en: "There are no additional public events to show." },

  { es: "Ejemplo del Demo Lab", pt: "Exemplo do Demo Lab", en: "Demo Lab example" },
  { es: "El tag de muestra informa: sello abierto", pt: "A tag de demonstração informa: lacre aberto", en: "The demo tag reports: seal open" },
  { es: "Sello abierto en esta simulación", pt: "Lacre aberto nesta simulação", en: "Seal open in this simulation" },
  { es: "La etiqueta digital de muestra informa una apertura. No se realizó un toque NFC real ni se inspeccionó un envase físico.", pt: "A etiqueta digital de demonstração informa uma abertura. Nenhum toque NFC real foi realizado e nenhuma embalagem física foi inspecionada.", en: "The demo digital tag reports an opening. No real NFC tap was made, and no physical package was inspected." },
  { es: "Producto físico de muestra", pt: "Produto físico de demonstração", en: "Demo physical product" },
  { es: "Esta fixture permite recorrer la ficha y la trazabilidad simulada. Un resultado real requiere leer la etiqueta física y validar la evidencia del evento.", pt: "Este exemplo permite explorar a ficha e a rastreabilidade simulada. Um resultado real exige ler a etiqueta física e validar a evidência do evento.", en: "This fixture lets you explore the product page and simulated traceability. A real result requires reading the physical tag and validating the event evidence." },
  { es: "Producto físico · muestra", pt: "Produto físico · demonstração", en: "Physical product · demo" },
  { es: "Preview simulado", pt: "Prévia simulada", en: "Simulated preview" },
  { es: "Se simuló", pt: "Foi simulado", en: "Simulated" },
  { es: "La fixture ilustra cómo se presentarían el chip y la política del tenant después de una lectura real.", pt: "O exemplo ilustra como o chip e a política do tenant seriam apresentados após uma leitura real.", en: "The fixture illustrates how the chip and tenant policy would appear after a real read." },
  { es: "Explorar preview", pt: "Explorar prévia", en: "Explore preview" },
  { es: "Podés recorrer la ficha de muestra. Garantía, beneficios y certificado requieren un tap físico y evidencia real.", pt: "Você pode explorar a ficha de demonstração. Garantia, benefícios e certificado exigem um toque físico e evidência real.", en: "You can explore the demo page. Warranty, benefits, and certificate require a physical tap and real evidence." },
  { es: "Simulación sin tap físico: muestra cómo se comunica una apertura sin crear evidencia real.", pt: "Simulação sem toque físico: mostra como uma abertura é comunicada sem criar evidência real.", en: "Simulation without a physical tap: it shows how an opening is communicated without creating real evidence." },
  { es: "Simulada", pt: "Simulada", en: "Simulated" },
  { es: "Abierto (demo)", pt: "Aberto (demo)", en: "Open (demo)" },
  { es: "Ficha informativa", pt: "Ficha informativa", en: "Information page" },
  { es: "Información pública del producto", pt: "Informações públicas do produto", en: "Public product information" },
  { es: "El QR abre la ficha del producto; las acciones protegidas requieren un tap NFC nuevo.", pt: "O QR abre a ficha do produto; as ações protegidas exigem um novo toque NFC.", en: "The QR opens the product page; protected actions require a new NFC tap." },
  { es: "Informativa", pt: "Informativa", en: "Informational" },
  { es: "Nuevo tap requerido", pt: "Novo toque necessário", en: "New tap required" },
  { es: "Este enlace ya fue utilizado", pt: "Este link já foi utilizado", en: "This link has already been used" },
  { es: "La URL ya se usó. Repetí el tap físico para obtener una lectura fresca antes de activar servicios.", pt: "A URL já foi usada. Repita o toque físico para obter uma leitura nova antes de ativar serviços.", en: "This URL has already been used. Make another physical tap to obtain a fresh read before activating services." },
  { es: "No aplicable", pt: "Não aplicável", en: "Not applicable" },
  { es: "No pudimos validar esta lectura", pt: "Não foi possível validar esta leitura", en: "We could not validate this read" },
  { es: "El producto fue identificado, pero el perfil técnico del lote no coincide con esta lectura.", pt: "O produto foi identificado, mas o perfil técnico do lote não corresponde a esta leitura.", en: "The product was identified, but the batch technical profile does not match this read." },
  { es: "Estado del sello no válido", pt: "Estado do lacre inválido", en: "Invalid seal status" },
  { es: "No pudimos validar el estado del sello", pt: "Não foi possível validar o estado do lacre", en: "We could not validate the seal status" },
  { es: "La lectura del estado TT es inválida. Repetí el tap y, si continúa, no uses el producto y avisá a la marca.", pt: "A leitura do estado TT é inválida. Repita o toque e, se persistir, não use o produto e avise a marca.", en: "The TT status read is invalid. Tap again and, if it persists, do not use the product and contact the brand." },
  { es: "No válido", pt: "Inválido", en: "Invalid" },
  { es: "Señal de riesgo detectada", pt: "Sinal de risco detectado", en: "Risk signal detected" },
  { es: "Revisá el producto antes de usarlo", pt: "Revise o produto antes de usá-lo", en: "Inspect the product before use" },
  { es: "La identidad digital pasó los controles, pero la lectura reportó una señal de riesgo. No uses el producto hasta revisarlo y avisá a la marca.", pt: "A identidade digital passou pelos controles, mas a leitura informou um sinal de risco. Não use o produto até revisá-lo e avise a marca.", en: "The digital identity passed validation, but the read reported a risk signal. Do not use the product until it is inspected, and contact the brand." },
  { es: "La lectura reportó una señal de riesgo y no permitió confirmar la identidad digital. Repetí el tap y avisá a la marca.", pt: "A leitura informou um sinal de risco e não permitiu confirmar a identidade digital. Repita o toque e avise a marca.", en: "The read reported a risk signal and could not confirm the digital identity. Tap again and contact the brand." },
  { es: "La lectura necesita revisión", pt: "A leitura precisa de revisão", en: "This read needs review" },
  { es: "No pudimos confirmar la identidad digital. Repetí el tap y, si continúa, avisá a la marca.", pt: "Não foi possível confirmar a identidade digital. Repita o toque e, se persistir, avise a marca.", en: "We could not confirm the digital identity. Tap again and, if it persists, contact the brand." },
  { es: "Lectura NFC verificada", pt: "Leitura NFC verificada", en: "Verified NFC read" },
  { es: "El estado del sello es inconsistente", pt: "O estado do lacre é inconsistente", en: "The seal status is inconsistent" },
  { es: "La identidad digital pasó los controles, pero las fuentes reportaron estados de sello incompatibles. Revisá los detalles o avisá a la marca.", pt: "A identidade digital passou pelos controles, mas as fontes informaram estados de lacre incompatíveis. Revise os detalhes ou avise a marca.", en: "The digital identity passed validation, but the sources reported incompatible seal states. Review the details or contact the brand." },
  { es: "Inconsistente", pt: "Inconsistente", en: "Inconsistent" },
  { es: "Registro de una lectura NFC", pt: "Registro de uma leitura NFC", en: "NFC read record" },
  { es: "En esa lectura, el tag informó: sello cerrado", pt: "Nessa leitura, a tag informou: lacre fechado", en: "In that read, the tag reported: seal closed" },
  { es: "El tag informa: sello cerrado", pt: "A tag informa: lacre fechado", en: "The tag reports: seal closed" },
  { es: "Es un registro histórico: en esa lectura la identidad digital pasó los controles y el chip reportó estado cerrado. No describe necesariamente el estado actual.", pt: "É um registro histórico: nessa leitura, a identidade digital passou pelos controles e o chip informou estado fechado. Isso não descreve necessariamente o estado atual.", en: "This is a historical record: in that read, the digital identity passed validation and the chip reported a closed state. It does not necessarily describe the current state." },
  { es: "La lectura digital pasó los controles y el chip reporta estado cerrado. Esto no certifica por sí solo el contenido ni una inspección física del envase.", pt: "A leitura digital passou pelos controles e o chip informa estado fechado. Isso, por si só, não certifica o conteúdo nem uma inspeção física da embalagem.", en: "The digital read passed validation and the chip reports a closed state. On its own, this does not certify the contents or a physical inspection of the package." },
  { es: "En esa lectura, el tag informó: sello abierto", pt: "Nessa leitura, a tag informou: lacre aberto", en: "In that read, the tag reported: seal open" },
  { es: "El tag informa: sello abierto", pt: "A tag informa: lacre aberto", en: "The tag reports: seal open" },
  { es: "Es un registro histórico: en esa lectura la identidad digital pasó los controles y el chip reportó una apertura. No describe necesariamente el estado actual.", pt: "É um registro histórico: nessa leitura, a identidade digital passou pelos controles e o chip informou uma abertura. Isso não descreve necessariamente o estado atual.", en: "This is a historical record: in that read, the digital identity passed validation and the chip reported an opening. It does not necessarily describe the current state." },
  { es: "La lectura digital pasó los controles, pero el chip reporta una apertura. Si vos no lo abriste o ves daños, no uses el producto y avisá a la marca.", pt: "A leitura digital passou pelos controles, mas o chip informa uma abertura. Se você não abriu ou notar danos, não use o produto e avise a marca.", en: "The digital read passed validation, but the chip reports an opening. If you did not open it or see damage, do not use the product and contact the brand." },
  { es: "En esa lectura se validó la identidad NFC", pt: "Nessa leitura, a identidade NFC foi validada", en: "The NFC identity was validated in that read" },
  { es: "Identidad NFC validada", pt: "Identidade NFC validada", en: "NFC identity validated" },
  { es: "Es un registro histórico: la identidad digital pasó los controles, pero el estado del sello no fue informado.", pt: "É um registro histórico: a identidade digital passou pelos controles, mas o estado do lacre não foi informado.", en: "This is a historical record: the digital identity passed validation, but the seal status was not provided." },
  { es: "La identidad digital pasó los controles, pero el estado del sello no fue informado.", pt: "A identidade digital passou pelos controles, mas o estado do lacre não foi informado.", en: "The digital identity passed validation, but the seal status was not provided." },

  { es: "Estado TT no disponible", pt: "Estado TT indisponível", en: "TT status unavailable" },
  { es: "TT abierto reportado", pt: "TT aberto informado", en: "Reported open TT" },
  { es: "Esta lectura no aporta los dos bytes necesarios para interpretar el estado electrónico de apertura.", pt: "Esta leitura não fornece os dois bytes necessários para interpretar o estado eletrônico de abertura.", en: "This read does not provide the two bytes required to interpret the electronic opening status." },
  { es: "TT reporta cerrado", pt: "TT informa fechado", en: "TT reports closed" },
  { es: "Los bytes permanente y actual reportan estado cerrado.", pt: "Os bytes permanente e atual informam estado fechado.", en: "The permanent and current bytes report a closed state." },
  { es: "TT reporta abierto", pt: "TT informa aberto", en: "TT reports open" },
  { es: "Los bytes permanente y actual reportan apertura.", pt: "Os bytes permanente e atual informam abertura.", en: "The permanent and current bytes report an opening." },
  { es: "TT registra apertura previa", pt: "TT registra abertura anterior", en: "TT records a previous opening" },
  { es: "El byte permanente registra una apertura anterior y el byte actual reporta cerrado.", pt: "O byte permanente registra uma abertura anterior e o byte atual informa fechado.", en: "The permanent byte records a previous opening and the current byte reports closed." },
  { es: "TT inválido", pt: "TT inválido", en: "Invalid TT" },
  { es: "Al menos uno de los bytes contiene el valor inválido 49. La lectura requiere revisión técnica.", pt: "Pelo menos um dos bytes contém o valor inválido 49. A leitura exige revisão técnica.", en: "At least one byte contains the invalid value 49. The read requires technical review." },
  { es: "TT contradictorio", pt: "TT contraditório", en: "Contradictory TT" },
  { es: "El estado actual reporta apertura, pero el byte permanente sigue cerrado. Las acciones sensibles deben permanecer bloqueadas.", pt: "O estado atual informa abertura, mas o byte permanente continua fechado. As ações sensíveis devem permanecer bloqueadas.", en: "The current state reports an opening, but the permanent byte remains closed. Sensitive actions must remain blocked." },
  { es: "Patrón TT no reconocido", pt: "Padrão TT não reconhecido", en: "Unrecognized TT pattern" },
  { es: "Los dos bytes están presentes, pero no coinciden con un patrón TT admitido por esta configuración.", pt: "Os dois bytes estão presentes, mas não correspondem a um padrão TT aceito por esta configuração.", en: "Both bytes are present, but they do not match a TT pattern accepted by this configuration." },
  { es: "Los bytes TT y el estado informado por el servicio no coinciden. Las acciones sensibles deben permanecer bloqueadas.", pt: "Os bytes TT e o estado informado pelo serviço não correspondem. As ações sensíveis devem permanecer bloqueadas.", en: "The TT bytes and the state reported by the service do not match. Sensitive actions must remain blocked." },
  { es: "Memoria permanente", pt: "Memória permanente", en: "Permanent memory" },
  { es: "Estado actual", pt: "Estado atual", en: "Current state" },

  { es: "Origen de muestra", pt: "Origem de demonstração", en: "Demo origin" },
  { es: "Origen simulado", pt: "Origem simulada", en: "Simulated origin" },
  { es: "Lote, productor y pasaporte de muestra", pt: "Lote, produtor e passaporte de demonstração", en: "Demo batch, producer, and passport" },
  { es: "Origen demo", pt: "Origem demo", en: "Demo origin" },
  { es: "Evento simulado · sin tap físico", pt: "Evento simulado · sem toque físico", en: "Simulated event · no physical tap" },
  { es: "Tap simulado", pt: "Toque simulado", en: "Simulated tap" },
  { es: "Apertura de sello simulada en la muestra", pt: "Abertura do lacre simulada na demonstração", en: "Seal opening simulated in the demo" },
  { es: "Lectura simulada · sin tap físico", pt: "Leitura simulada · sem toque físico", en: "Simulated read · no physical tap" },
  { es: "Evento demo", pt: "Evento demo", en: "Demo event" },
  { es: "Origen -> evento simulado", pt: "Origem -> evento simulado", en: "Origin -> simulated event" },
  { es: "Recorrido de muestra · no representa una ruta física verificada", pt: "Trajeto de demonstração · não representa uma rota física verificada", en: "Demo path · does not represent a verified physical route" },
  { es: "Lote, productor y pasaporte registrados por el tenant", pt: "Lote, produtor e passaporte registrados pelo tenant", en: "Batch, producer, and passport registered by the tenant" },
  { es: "Lectura NFC registrada", pt: "Leitura NFC registrada", en: "Recorded NFC read" },
  { es: "Mensaje SUN válido y TT abierto reportado", pt: "Mensagem SUN válida e TT aberto informado", en: "Valid SUN message and reported open TT" },
  { es: "Mensaje NFC del chip validado", pt: "Mensagem NFC do chip validada", en: "Chip NFC message validated" },
  { es: "Origen declarado -> lectura", pt: "Origem declarada -> leitura", en: "Declared origin -> read" },
  { es: "Segmento calculado entre registros; no prueba el recorrido físico", pt: "Segmento calculado entre registros; não comprova o trajeto físico", en: "Segment calculated between records; it does not prove the physical route" },
  { es: "La marca cargó el origen declarado, el lote, el producto y sus reglas antes de salir al canal.", pt: "A marca cadastrou a origem declarada, o lote, o produto e suas regras antes de enviá-lo ao canal.", en: "The brand configured the declared origin, batch, product, and its rules before sending it to market." },
  { es: "10% de descuento en la proxima compra", pt: "10% de desconto na próxima compra", en: "10% off the next purchase" },
  { es: "Ejemplo de promocion configurada para mostrar el formato. La marca debe publicar condiciones, vigencia y disponibilidad reales antes de activarla.", pt: "Exemplo de promoção configurada para mostrar o formato. A marca deve publicar condições, validade e disponibilidade reais antes de ativá-la.", en: "Example promotion configured to show the format. The brand must publish real terms, validity, and availability before activating it." },
  { es: "NO CANJEABLE", pt: "NÃO RESGATÁVEL", en: "NOT REDEEMABLE" },
  { es: "DEMO · JSON ESTATICO", pt: "DEMO · JSON ESTÁTICO", en: "DEMO · STATIC JSON" },

  { es: "Sommelier", pt: "Sommelier", en: "Sommelier" },
  { es: "Trivia", pt: "Quiz", en: "Quiz" },
  { es: "Calificar", pt: "Avaliar", en: "Rate" },
  { es: "Novedades", pt: "Novidades", en: "Updates" },
  { es: "Enviar", pt: "Enviar", en: "Send" },
  { es: "Siguiente", pt: "Próxima", en: "Next" },
  { es: "Volver a empezar", pt: "Recomeçar", en: "Start again" },
  { es: "Incluir una zona aproximada en este mensaje (opcional). Se redondea antes de enviarla y nunca se guarda la coordenada exacta del dispositivo.", pt: "Incluir uma zona aproximada nesta mensagem (opcional). Ela é arredondada antes do envio e a coordenada exata do dispositivo nunca é salva.", en: "Include an approximate area in this message (optional). It is rounded before sending, and the device's exact coordinate is never stored." },

  { es: "No informado", pt: "Não informado", en: "Not provided" },
  { es: "No informada", pt: "Não informada", en: "Not provided" },
  { es: "No disponible", pt: "Indisponível", en: "Unavailable" },
  { es: "Disponible", pt: "Disponível", en: "Available" },
  { es: "Pendiente", pt: "Pendente", en: "Pending" },
  { es: "En revisión", pt: "Em revisão", en: "Under review" },
  { es: "Bloqueada", pt: "Bloqueada", en: "Blocked" },
  { es: "Por revisar", pt: "Para revisar", en: "Requires review" },
  { es: "No confirmada", pt: "Não confirmada", en: "Not confirmed" },
  { es: "No confirmado", pt: "Não confirmado", en: "Not confirmed" },
  { es: "Verificada", pt: "Verificada", en: "Verified" },
  { es: "Cerrado", pt: "Fechado", en: "Closed" },
  { es: "Abierto", pt: "Aberto", en: "Open" },
  { es: "Inválido", pt: "Inválido", en: "Invalid" },
  { es: "No reconocido", pt: "Não reconhecido", en: "Unrecognized" },
] as const;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const translationIndex = new Map<string, SunTranslation>();
for (const entry of SUN_UI_TRANSLATIONS) {
  translationIndex.set(normalizeText(entry.es), entry);
  translationIndex.set(normalizeText(entry.pt), entry);
  translationIndex.set(normalizeText(entry.en), entry);
}

export function isSunLocale(value?: string | null): value is SunLocale {
  return SUN_LOCALES.includes(String(value || "").trim() as SunLocale);
}

export function toDocumentLanguage(locale: SunLocale) {
  return locale === "en" ? "en" : locale;
}

function translatePattern(value: string, locale: SunLocale): string | null {
  const localizeDistanceToken = (token: string) => {
    const rawNumber = token.replace(/\s*km$/i, "").trim().replace(/\s/g, "");
    const separators = [...rawNumber.matchAll(/[.,]/g)].map((match) => match.index || 0);
    const lastSeparator = separators.at(-1) ?? -1;
    const digitsAfterLastSeparator = lastSeparator >= 0 ? rawNumber.length - lastSeparator - 1 : 0;
    const normalized = lastSeparator >= 0 && digitsAfterLastSeparator !== 3
      ? `${rawNumber.slice(0, lastSeparator).replace(/[.,]/g, "")}.${rawNumber.slice(lastSeparator + 1)}`
      : rawNumber.replace(/[.,]/g, "");
    const numericValue = Number(normalized);
    if (!Number.isFinite(numericValue)) return token;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: numericValue >= 100 ? 0 : 1 }).format(numericValue)} km`;
  };

  const accuracy = value.match(/^±([\d.,]+) m (?:como mínimo|no mínimo|minimum)$/i);
  if (accuracy) {
    return locale === "pt-BR"
      ? `±${accuracy[1]} m no mínimo`
      : locale === "en"
        ? `±${accuracy[1]} m minimum`
        : `±${accuracy[1]} m como mínimo`;
  }

  const browserEvidence = value.match(/^(?:Geolocalización aproximada del navegador con permiso, medida después del tap|Geolocalização aproximada do navegador com permissão, medida após o toque|Permission-based approximate browser geolocation measured after the tap) · (?:precisión informada|precisão informada|reported accuracy) ±([\d.,]+) m (?:como mínimo|no mínimo|minimum)\. (?:Zona pública redondeada; valores reportados por el cliente|Zona pública arredondada; valores informados pelo cliente|Public area rounded; client-reported values)\.$/i);
  if (browserEvidence) {
    return locale === "pt-BR"
      ? `Geolocalização aproximada do navegador com permissão, medida após o toque · precisão informada ±${browserEvidence[1]} m no mínimo. Zona pública arredondada; valores informados pelo cliente.`
      : locale === "en"
        ? `Permission-based approximate browser geolocation measured after the tap · reported accuracy ±${browserEvidence[1]} m minimum. Public area rounded; client-reported values.`
        : `Geolocalización aproximada del navegador con permiso, medida después del tap · precisión informada ±${browserEvidence[1]} m como mínimo. Zona pública redondeada; valores reportados por el cliente.`;
  }

  const linearDistance = value.match(/^(.+?\s+km)(?:\s+lineales|\s+em linha reta|\s+straight-line distance)$/i);
  if (linearDistance) {
    const distance = localizeDistanceToken(linearDistance[1]);
    return locale === "pt-BR"
      ? `${distance} em linha reta`
      : locale === "en"
        ? `${distance} straight-line distance`
        : `${distance} lineales`;
  }

  const demoDistance = value.match(/^(.+?\s+km)(?: de separación lineal entre dos puntos de muestra; no representa un recorrido físico| em linha reta entre dois pontos de demonstração; não representa um trajeto físico| straight-line distance between two demo points; it does not represent a physical route)\.$/i);
  if (demoDistance) {
    const distance = localizeDistanceToken(demoDistance[1]);
    return locale === "pt-BR"
      ? `${distance} em linha reta entre dois pontos de demonstração; não representa um trajeto físico.`
      : locale === "en"
        ? `${distance} straight-line distance between two demo points; it does not represent a physical route.`
        : `${distance} de separación lineal entre dos puntos de muestra; no representa un recorrido físico.`;
  }

  const consentedDistance = value.match(/^(.+?\s+km)(?: de separación lineal respecto del origen declarado\. La zona fue autorizada después del tap y no demuestra recorrido ni custodia| em linha reta desde a origem declarada\. A zona foi autorizada após o toque e não comprova trajeto nem custódia| straight-line distance from the declared origin\. The area was authorized after the tap and does not prove route or custody)\.$/i);
  if (consentedDistance) {
    const distance = localizeDistanceToken(consentedDistance[1]);
    return locale === "pt-BR"
      ? `${distance} em linha reta desde a origem declarada. A zona foi autorizada após o toque e não comprova trajeto nem custódia.`
      : locale === "en"
        ? `${distance} straight-line distance from the declared origin. The area was authorized after the tap and does not prove route or custody.`
        : `${distance} de separación lineal respecto del origen declarado. La zona fue autorizada después del tap y no demuestra recorrido ni custodia.`;
  }

  const updates = value.match(/^Novedades de (.+)$/);
  if (updates) {
    return locale === "pt-BR" ? `Novidades de ${updates[1]}` : locale === "en" ? `Updates from ${updates[1]}` : value;
  }

  const points = value.match(/^(\d[\d.,]*) puntos informados por la marca · sujetos a sus condiciones$/);
  if (points) {
    return locale === "pt-BR"
      ? `${points[1]} pontos informados pela marca · sujeitos às condições da marca`
      : locale === "en"
        ? `${points[1]} points reported by the brand · subject to its terms`
        : value;
  }

  const readings = value.match(/^Ver (lecturas recibidas|datos declarados del manifiesto|eventos de muestra) \((\d+)\)$/);
  if (readings) {
    const readingKey = readings[1] as "lecturas recibidas" | "datos declarados del manifiesto" | "eventos de muestra";
    const label = locale === "pt-BR"
      ? ({ "lecturas recibidas": "leituras recebidas", "datos declarados del manifiesto": "dados declarados do manifesto", "eventos de muestra": "eventos de demonstração" } as const)[readingKey]
      : locale === "en"
        ? ({ "lecturas recibidas": "received readings", "datos declarados del manifiesto": "declared manifest data", "eventos de muestra": "demo events" } as const)[readingKey]
        : readings[1];
    return locale === "es-AR" ? value : `${locale === "pt-BR" ? "Ver" : "View"} ${label} (${readings[2]})`;
  }

  return null;
}

export function translateSunUiText(value: string, locale: SunLocale): string {
  const normalized = normalizeText(value);
  if (!normalized) return value;
  const entry = translationIndex.get(normalized);
  const translated = entry
    ? locale === "pt-BR" ? entry.pt : locale === "en" ? entry.en : entry.es
    : translatePattern(normalized, locale);
  if (!translated || translated === normalized) return value;

  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  return `${leading}${translated}${trailing}`;
}

export function formatSunDate(value: string | Date, locale: SunLocale, options: Intl.DateTimeFormatOptions) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return locale === "pt-BR" ? "Não informado" : locale === "en" ? "Not provided" : "No informado";
  return new Intl.DateTimeFormat(locale, options).format(date);
}
