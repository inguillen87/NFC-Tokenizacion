# NexID — edición guiada del pasaporte digital

## Alcance
Incremento del dashboard sobre `2e3273551bc919513c0dbd09aef49dfec6972986`, continuación de la bandeja editorial publicada. Se mejora el editor ya existente: siguiente paso, validación visible, navegación hacia campos y recuperación de operaciones inciertas. No se modifica API, esquema, contrato editorial, política de permisos ni configuración comercial.

## Resultado de UX/UI
El editor presenta un panel «Tu próximo paso» que deriva del estado persistido, los permisos y la operación pendiente. Distingue edición, revisión y publicación sin atribuir aceptación física ni porcentajes de finalización. Los campos diferentes se cuentan contra la revisión guardada, no contra una versión publicada anterior; escribir no se presenta como guardar.

La revisión del borrador reúne errores de formato y avisos por campos. Cada entrada navega a su sección y enfoca el control correspondiente; una cuenta de consulta recibe foco en la etiqueta sin habilitar edición. Los errores aparecen junto al campo, con `aria-invalid` y descripción asociada. Los contadores de caracteres se actualizan al escribir sin alterar el nombre accesible del control. Un documento opcional no vinculado se presenta como aviso, no como error de URL o evaluación normativa.

El diseño mantiene el sistema visual de Passport Studio, con jerarquía de próximo paso, etapas, lista de correcciones, estados locales y vista móvil del contenido. Claro/oscuro y anchos desde 320 px conservan el contenido y controles existentes. El panel no abre enlaces externos, completa datos ni agrega llamadas de servidor.

## Recuperación corregida
Se reprodujo que un guardado con resultado incierto seguido de un 403 podía dejar de estar marcado como incierto y habilitar otro guardado. Ahora la incertidumbre persiste ante denegación, indisponibilidad o conflicto posteriores. Sólo un recibo válido y coincidente resuelve el intento; se conserva su identificador y carga originales. No hay reintento automático.

Las verificaciones del estado inicial también mostraron falta de señalización del campo obligatorio y contadores desactualizados. La suite nueva diferencia esas carencias de UX del fallo de recuperación; no presenta pruebas añadidas como incidentes productivos observados.

## Validación local realizada
Dashboard completo: 1.971 pruebas aprobadas, cero fallos y dos omisiones preexistentes; incluye 19 nuevas pruebas del modelo de orientación. TypeScript aprobado. Nueva aceptación de navegador: 165 comprobaciones en 22 vistas, todas aprobadas, con teclado, 320/390/768/1440 px, claro/oscuro, errores y avisos, guardado confirmado, recibo perdido, roles e identificadores largos. Sin infracciones de axe ni desbordamientos en esas vistas.

Se inspeccionaron visualmente las correcciones en móvil claro y el borrador guardado en escritorio oscuro. La prueba de navegador usa el presenter real y respuestas sintéticas en memoria. No equivale a aceptación editorial autenticada de un cliente ni a persistencia en producción. El harness DOM anterior se conecta al módulo nuevo, conservando sus casos de revisión/publicación y recuperación.

Se verificaron las huellas anteriores de todas las fuentes del manifiesto de convergencia y las 483 rutas preservadas. Sólo se actualizan las dos fuentes revisadas y se registra una fuente nueva. No se retiran pruebas ni se alteran fuentes de API/web. Los resultados de CI y publicación se documentan sobre el commit final después de verificarlos.

## Límites
No se aprobaron ni publicaron pasaportes de clientes para este ensayo. No hay migraciones, cambios de usuarios o permisos, claves NFC, envíos a terceros ni activación de proveedor/acuse. Se conserva la separación entre aprobación del contenido y evidencia de autenticidad física.

## Ajuste de dependencia detectado por CI
El primer candidato no se promovió: la auditoría obligatoria bloqueó `undici` 6.28.0 por GHSA-3wwx-pv8p-q78v, GHSA-r53p-7pc4-xj5r y GHSA-rfgv-xxqx-mfg5. Se consultaron los avisos y releases oficiales de nodejs/undici: la corrección está en la línea 6.28.1 y posteriores.

La actualización dirigida resolvió 6.29.0 dentro del rango 6.x requerido por `@nomicfoundation/hardhat-utils`. Se verificó que cambió únicamente la entrada `node_modules/undici` del lockfile y que sigue marcada `dev: true`. Los demás paquetes y el manifiesto raíz permanecen idénticos; no se agregó una dependencia productiva ni se cambió el Undici integrado en Node.js.

La auditoría real volvió a aprobar, con cero hallazgos altos/críticos productivos y sin excepciones de desarrollo. No se modificaron el script de auditoría, sus umbrales ni su lista de excepciones. El nuevo commit y su instalación limpia deben completar nuevamente CI antes de promover. Los resultados del candidato anterior no se atribuyen al definitivo.
