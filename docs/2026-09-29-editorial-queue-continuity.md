# NexID — bandeja editorial: selección, consultas y continuidad

## Alcance
Dashboard sobre `bbec34f46e7fcab57574a33dda95a9066d59ad34`, continuación del inicio editorial publicado. Se modifica únicamente la bandeja de revisión, su entrada de servidor y su lectura. No cambia el editor, la API, el esquema, los permisos ni los interruptores comerciales.

## Operación visible
La bandeja no selecciona silenciosamente el primer pasaporte. Presenta una indicación para elegir el producto; la selección abre su siguiente paso, versión y comentarios, llevando el foco al detalle. «Volver a la lista» regresa al pasaporte elegido sin cambiar filtros ni hacer consultas. Los enlaces de Studio mantienen empresa y lote y no ejecutan aprobación o publicación.

Las consultas pueden cancelarse. Cancelar retira resultados anteriores, libera los controles y permite consultar de nuevo sin esperar al transporte. Las páginas siguientes/anteriores conservan sus cursores; una interrupción transitoria permite reintentar esa página, mientras que una posición invalidada o pérdida de acceso exige otra consulta. Cambiar filtros no consulta automáticamente ni mantiene resultados como si correspondieran a los filtros nuevos.

## Correcciones reproducidas y frontera de datos
Las pruebas sobre el componente anterior mostraron datos previos al cambiar de empresa/actor, una bandeja visible con el contexto deshabilitado y aceptación de respuestas marcadas demo en el cuerpo o las cabeceras. Esas regresiones quedan cubiertas con el componente real y transporte sintético.

La lectura exige procedencia productiva, JSON, UTF-8 válido y coincidencia de empresa, filtros y página. Limita el cuerpo a 256 KiB y aplica un único plazo de 12 segundos a cabeceras/cuerpo, incluso ante transporte no cooperativo. No sigue redirecciones, no repite solicitudes automáticamente y no expone mensajes de error internos.

La página de servidor usa esa misma lectura. Rechaza filtros repetidos/inesperados antes de consultar y no busca datos para sesiones demo. El cliente recibe una huella no reversible del contexto autenticado, no identificadores de sesión ni cookies. Cambio de fuente, empresa, actor o permisos retira el estado previo; una respuesta tardía de un contexto desmontado no lo restaura. El retorno tardío del portapapeles no confirma una búsqueda que ya cambió.

Se conserva la interpretación original de los indicadores: todos los pasaportes incorporados al alcance, no sólo la página o búsqueda. «Para mi rol» no significa asignación personal ni autorización permanente. No se deduce calidad, aceptación física o publicación a partir de la selección.

## Validación local terminada
Dashboard completo: 1.952 aprobadas, cero fallos y dos omisiones preexistentes; incluye 60 nuevas pruebas de lectura y página. TypeScript aprobado. Navegador: 102 comprobaciones y 11 vistas aprobadas, con 320/390/768/1440 px, claro/oscuro, teclado, búsqueda, paginación, cancelación, pérdida de acceso, portapapeles tardío, texto largo y StrictMode. Sin infracciones detectadas por axe ni desbordamiento horizontal en esas vistas.

Las pruebas de navegador sustituyen datos, sesiones, transporte y Next Link; los componentes y contratos de la bandeja son reales. No son una aceptación autenticada de cliente. El harness integrado existente actualiza su selección explícita después del filtrado, pero no se ejecutó en este bloque. No se cambian o eliminan sus operaciones de aprobación/publicación.

Las huellas de convergencia y 483 rutas preservadas se verifican contra la base y se actualizan sólo para las cuatro fuentes revisadas y una nueva. Se mantienen las suites previas del workflow y se agrega la nueva aceptación de la bandeja. CI, candidata y publicación se registran por commit al finalizar, sin anticipar resultados.

## Límites de entrega
No hay escrituras de negocio, migraciones, cambios de claves o permisos, alta de usuarios, mensajes externos ni habilitación de proveedor/acuse. La compilación de publicación se realiza en CI y Vercel; no se duplican dependencias ni compilaciones en el equipo local con almacenamiento limitado.
