# S8a/S9a — Evidencia consultable y acciones explícitas

Release publicada: `2026.09.21-web-evidence-actions.1`.
Base web productiva: `b6c054bcc59c4eb10ff01f1ff38aa2ad05c4df19`.
API compatible: `1aef6c3827459bb2ddbc2b4907ffc6dda239b30a`,
`2026.09.21-api-s7-consistency.2`. Se publica únicamente web.

## Cambio para el usuario

El pasaporte ofrece evidencia de la lectura, fecha UTC, referencia y certificado
compartible cuando la API entregó su permiso. Consultar un registro anterior no
requiere repetir el TAP y no renueva su autorización comercial. QR, demo y NFC
informativo conservan sus límites. Los documentos agro usan los enlaces de la
ficha y muestran el dominio externo; no afirman vigencia ni fecha de publicación.
Los avisos actuales conservan su lector independiente y su manejo de error.

La antigua bitácora narrativa pasa a llamarse «Cómo leer este pasaporte»: no es
un historial certificado. Se retira la afirmación sin respaldo de que los datos
fueron publicados antes de salir al canal.

El portal permite elegir guardar producto, vincularse con la empresa, solicitar
titularidad digital o inscribirse en beneficios. Cada confirmación ejecuta una
sola petición. Iniciar sesión, abrir un enlace o recibir un evento en la URL no
ejecuta estas acciones. Se conserva la sesión existente; se retiran los controles
de «presentación limpia» y el OTP duplicado dentro de esta tarjeta.

Las operaciones del API existente tienen efectos relacionados: guardar también
vincula la cuenta con la empresa; vincular también guarda el producto; un intento
de titularidad puede haber guardado la asociación antes de fallar. La interfaz
lo explica. No se presenta esto como una separación de escrituras del servidor.
Ni guardar ni vincular confirman inscripción en beneficios. No se envían mensajes.

Una revisión requerida sin solicitud persistida no se anuncia como enviada.
El éxito exige campos específicos de cada respuesta. Un registro realizado con
confirmación técnica incompleta se muestra sin reenviar la acción. Fallos de red
conservan el contexto y advierten que la operación podría haberse registrado.

## Traspaso de la autorización temporal

Antes, los enlaces al portal sólo transportaban eventId; las acciones recibían
una sesión, pero ninguna capacidad SUN reciente. El nuevo puente la prepara al
pulsar un acceso al portal desde una lectura reciente. La URL del portal sigue
sin contener esa capacidad. La confirmación de negocio ocurre después.

POST `/api/consumer/tap-handoff` acepta JSON acotado a 8 KiB y exige Origin exacto
y contexto de navegador del mismo origen. Comprueba forma, evento y vencimiento;
**no verifica la firma ni concede derechos**. Guarda temporalmente el token en
una cookie por evento `__Host-nexid_tap_<eventId>`, Secure, HttpOnly, SameSite=Strict,
sin Domain y con Path=/, durante como máximo la vigencia restante de cinco minutos.
Conserva hasta tres eventos para acotar las cabeceras. HTTP de desarrollo en
loopback tiene un nombre separado; producción no lo acepta como capacidad.

Sólo los cuatro POST específicos de consumidor reciben el token como cuerpo,
cuando el cliente no aportó ya una capacidad explícita. El evento del destino y
de la cookie deben coincidir. Los lectores y proxies eliminan todo el namespace
de cookies del puente antes de reenviar Cookie. Respuestas privadas/no-store.
No se escribe en localStorage/sessionStorage ni se devuelve el token en JSON.

La API conserva autenticación de consumidor, firma, vínculo con evento/BID/tag/
contador, vencimiento, política actual y consumo único por acción. El puente no
amplía plazos, no fabrica evidencia, no consume el permiso al navegar y no realiza
una nueva validación SUN. Volver desde login no confirma automáticamente nada.

## Validación y publicación

La suite de navegador usa Next/React/BFF reales y un API **sintético y explícito**
en loopback. Ensaya evidencia histórica, tres idiomas, enlaces documentales,
acciones separadas, respuestas inválidas, errores, sesión vencida y pérdida de
capacidad. No certifica persistencia productiva, OTP real ni lectura física.
La CI dedicada conserva resultados, build, controles de secretos, SHA y capturas.
Los datos de prueba no llegan a producción.

La CI detectó una diferencia de espacios de ICU entre Node y Chromium en la
fecha del mapa, que rompía la hidratación y perdía el primer clic. El formato
compartido usa 24 horas y espacios normales; el timeline agro usa zona UTC
explícita. Los accesos que preparan permisos esperan la hidratación. Una prueba
retiene los scripts, comprueba el botón deshabilitado y después exige un único
POST de preparación al liberarlos, sin ejecutar acciones de negocio.

Validación local final: 638 pruebas web, cero fallidas u omitidas; build de
producción y control de secretos correctos. Once comprobaciones integradas de
navegador y ocho vistas 1440/390, claro/oscuro, sin errores JS, desbordes ni
hallazgos axe en las superficies cambiadas. Se comprobó también el acceso
secundario a beneficios y la recuperación de un certificado no disponible.
No constituye certificación WCAG. Treinta pruebas focales de la API compatible
y un smoke aislado con su firmador/consumidor de capacidades conservaron firma,
sesión y consumo único por acción, con adaptador SQL local explícito.

La comprobación física ya observada del evento 715 precede esta versión web.
No se utiliza para dar por aceptado el nuevo flujo de cuenta en el teléfono.
Sin migraciones, cambios de claves, configuración NFC, contador ni TTStatus.
Dashboard y API permanecen en sus releases existentes.

### Evidencia de publicación

Verificado el 22 de septiembre de 2026 a las 00:24 UTC (21 de septiembre en Argentina).

- Commit ejecutado: `6cfd8bb451cef438786a623e336a187728a30f86`, árbol limpio.
- CI: [35671393147](https://github.com/inguillen87/NFC-Tokenizacion/actions/runs/35671393147),
  exitosa sobre ese SHA; 638 pruebas web, build, secretos, 11 comprobaciones de
  navegador y 8 vistas accesibles sin hallazgos en las superficies ensayadas.
  Chromium de CI: `140.0.7339.186`. Artefacto: `nexid-consumer-evidence-actions`.
- Despliegue web: `dpl_DiHkpj5eFdi3SYHpdhnzuLwMbGoj`, READY,
  `meta.gitCommitSha` coincidente y `gitDirty=0`.
- URL inmutable: https://nexid-9hyjgpqdf-marcelos-projects-c26aa499.vercel.app
- Alias productivo: https://nexid.lat, comprobado apuntando al mismo despliegue.
  `/release.json` entrega `2026.09.21-web-evidence-actions.1`.
- Antes y después de promover: seis vistas remotas por instancia (ES/EN/PT,
  390 claro y 1440 oscuro), cero errores JS, desbordes, hallazgos axe o intentos
  de escritura. La consulta anónima sigue sin autenticar una cuenta. Estas
  comprobaciones usan el pasaporte demo público, no una lectura física real.
- Reportes locales ignorados: `artifacts/staged-consumer-release/report.json`,
  `artifacts/production-consumer-release/report.json` y
  `artifacts/ci-35671393147/browser/report.json`.

La documentación posterior al despliegue puede tener otro SHA. El código que
ejecuta producción es exclusivamente el commit indicado arriba.

## Continuación del plan

S8 completo sigue pendiente: al reabrir snapshots, el API actual refresca parte
de la identidad pero puede conservar `product.agro` histórico. Por eso estos
enlaces no se anuncian como documentos actualizados o certificados. Queda por
proyectar contenido editorial vigente con fuente/versión y distinguir datos no
publicados, sin sobreescribir la evidencia de lectura.

Próximo incremento S8b: agregar una proyección `currentEditorial` al lector
`getSunDiagnosticSnapshot` en `apps/api/app/lib/sun-diagnostics.ts`, separada
de `product.agro` histórico. Reutilizar la publicación de
`passport_editorial_heads.published`, el historial de publicación y
`parseEditorialDocument`/`editorialContentDigest`. Resolver la identidad por
`events.tenant_id + events.batch_id`, nunca por BID solamente. El HEAD documental
del worktree API es `07fffb0513694854dff36cc35beaa071883fd929`; el código API
productivo compatible sigue en `1aef6c3827459bb2ddbc2b4907ffc6dda239b30a`.

Criterios de aceptación del siguiente incremento:

1. Lectura con versión 1, publicación 2 y borrador 3: mostrar la publicación 2
   con versión, digest y fecha; conservar fecha/TT/resultado históricos y no
   exponer el borrador.
2. Dos tenants con igual BID: cada evento sólo consulta su publicación y su
   historial de versión correspondiente.
3. Publicación ausente, legado sin versión, integridad inválida y fuente caída
   tienen estados distintos. Nunca etiquetar documentos históricos como vigentes
   ni renovar permisos al reabrir la lectura.

S9 completo también incluye garantía, soporte y otros servicios según política.
La ruta móvil de reporte requiere converger con la persistencia vinculada a
tenant/lote/evento ya existente en el reporte público. No se amplía aquí.

Referencia de producto: GS1 Digital Link contempla una identidad vinculada a
varios recursos; se aplica como índice de acceso, sin afirmar certificación o
cumplimiento normativo: https://ref.gs1.org/standards/digital-link/

Reversa web: `dpl_AKi4ugeindS2DL2sqUx6pcKN8qNX` (web-history.1).
La reversa sólo afecta la web. Las cookies del puente caducan en cinco minutos
y por sí mismas nunca autorizan una acción del API.
