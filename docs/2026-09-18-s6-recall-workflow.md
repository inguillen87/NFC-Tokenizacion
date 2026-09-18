# S6 — Retiros por lote, seguimiento y evidencia

Baseline API 16022a80ae7d45abad58f4e12c485d2f1382f2fe.
Baseline dashboard 1793458ca3cda4da3677163f84cfc9aa472334ab.
Baseline web ac9171b2e683c5d4ae766945f96acf8e3d2bdbc0.
Releases: api-recalls.1 / dashboard.15 / web-recalls.1 (2026-09-18).

## Cierre operativo de esta entrega

Desde Lotes y el expediente del producto se abre Retiro / cuarentena.
Preparar un caso crea sólo un formulario local. Guardar persiste un borrador del
lote; presentar congela esa revisión y otra cuenta autorizada publica el aviso.
El alcance público es TODO el lote, no una selección de UIDs. No cambia el estado
activo de etiquetas, claves, contador, evidencia de tamper ni verificador SUN.

La empresa define destinos, responsable y cantidad objetivo de cada destino.
Las cantidades son declaraciones de seguimiento, no derivaciones de TAPs o de
un inventario físico certificado. Agregar destinos no envía mensajes. Los acuses
se registran por un operador con referencia a comprobante, no se presentan como
una firma del distribuidor. Se registran totales devueltos e inmovilizados, razón,
actor, versión y referencias. Corregir cantidades conserva el movimiento previo.

Solicitar cierre requiere todos los destinos con acuse y todas las cantidades
objetivo conciliadas. La misma cuenta no puede aprobar su solicitud de cierre.
Cerrar conserva la advertencia pública y no libera producto: la revocación de
una etiqueta y la autorización comercial de un producto siguen siendo distintas.
No se permite borrar o editar silenciosamente una advertencia ya publicada.
El levantamiento de cuarentena y la rectificación de avisos publicados requieren
un futuro flujo explícito de revisión, no una modificación directa de esta tabla.

## Publicación en el pasaporte

El pasaporte consulta los avisos usando solamente tenant y BID resueltos por la
respuesta de identidad; no fabrica un aviso con los parámetros de la URL.
El aviso aparece antes del contenido principal, separado de autenticidad NFC y
precinto. Los borradores nunca salen por el endpoint público. Sólo se entregan
título, aviso, instrucciones, contacto, fecha y estado del seguimiento.
No se exponen motivo interno, responsables, referencias de comprobantes o destinos.

Una respuesta sin avisos se presenta como resultado de esa consulta, no como
certificación de inocuidad. En error se informa estado desconocido. Un aviso ya
recibido permanece visible al fallar la actualización; no desaparece por una
caída de red. Cambiar tenant o lote nunca reutiliza el aviso del lote anterior.
El texto público de la empresa se conserva, con controles de UI en es/en/pt.
El indicador antiguo de servicios ahora aclara que habla de observaciones de la
lectura y no determina retiros o restricciones del producto.

Se añade una lectura acotada al abrir el pasaporte y una acción manual de
actualización. No hay polling, broker nuevo ni memoria falsa de tiempo real.
La publicación no empuja mensajes a teléfonos/pantallas ya abiertas: éstos deben
consultar la versión actual. No confundir con una notificación certificada.

## Autorización y persistencia

Se reutilizan autorizaciones existentes de incidentes y gobierno de lotes.
La lectura/escritura exige el rol permitido y permiso de incidentes o batch.lifecycle,
respetando denegaciones explícitas recalls.read/write e incidents:read/write.
Publicar/cerrar exige además rol admin/owner/superadmin, MFA, y autorización de
publicación o lifecycle + aprobación de plan QA. No se conceden roles ni permisos
productivos automáticamente. Se preserva la independencia respecto de autor,
último editor y quien presenta el aviso. El cierre se aprueba por otro responsable.

La migración aditiva 0106 crea casos, operaciones e índices. Una única función
PostgreSQL bloquea el alcance del lote, valida revisión y guarda caso + recibo +
historial en la misma transacción. Repetir actor/tenant/lote/operationId devuelve
el recibo original; un cuerpo distinto bajo la misma identidad es conflicto.
Dos solicitudes concurrentes no pisan revisiones. La tabla admite un único caso
abierto por lote. No se modificó el watermark de migración global del runtime SUN.

Read models con alcance visible, límites de 30 casos, 50 destinos, 100 responsables
y 500 movimientos por consulta de historial. Las respuestas públicas se limitan
a 20 avisos con indicador de truncamiento. Sin credenciales nuevas ni servicios.
El historial está gobernado por la aplicación, no es inmutable frente a un DBA.

## Informe descargable

HTML imprimible desde una lectura autorizada y actual del caso: identificación,
versión, fechas, cantidades declaradas, denominadores, acuses, referencias, actores
históricos y fuente de datos. Escapa contenido de la empresa. No genera un PDF
firmado ni certifica devoluciones físicas. El informe permite revisión interna y
exportar evidencia sin reconstruir el caso a mano.

Esto no sustituye el informe agregado del piloto con disponibilidad, consumo,
contactos consentidos y métricas históricas. Esa parte de S6 queda pendiente.
También quedan fuera de esta entrega los envíos automáticos por email/WhatsApp,
la acreditación electrónica por el distribuidor y el bloqueo en un ERP externo.

## Evidencia de pruebas

19 escenarios con handlers API reales, autorización por sesión sintética local y
PostgreSQL 17.10 desechable. Incluye alcance ajeno, actor no autorizado, asignación
ajena, cuatro creaciones concurrentes idénticas, edición concurrente, revisión
independiente, borrador privado, publicación, acuses/cantidades, cierre pendiente,
fallo inyectado que revierte actualización e historial, reintento sin duplicación,
informe con fuentes y preservación exacta de configuración de lote/tags/contador.

Navegador de las tres aplicaciones con el runtime Next/React del proyecto y los
handlers reales sobre PostgreSQL local: creación con respuesta perdida, revisión
por otra cuenta, publicación, acuse, 7 devueltas + 3 inmovilizadas, cierre revisado
y descarga del HTML. El pasaporte SUN usa una identidad QR sintética para probar
la presentación real; no se afirma un nuevo TAP físico.

Cuatro vistas del dashboard (1440/390, claro/oscuro) sin incidencias axe en el
módulo. Comprobado aviso público móvil en primera pantalla, texto privado ausente,
aviso cerrado todavía visible y error de actualización que conserva la advertencia.
No equivale a certificación WCAG ni validación normativa.

Suites al cierre local: dashboard 851 pruebas, 849 aprobadas, 0 fallidas, 2 omitidas;
web 566 aprobadas, 0 fallidas; diez pruebas nuevas de política/API incluidas en el
build completo de API. PostgreSQL y navegador se ejecutan sin datos del cliente.

## Publicación segura

Aplicar esquema aditivo, publicar API compatible, luego web y recién después UI.
No crear ni publicar casos sobre Balmec o sobre datos de cliente para probar.
Conservar configuración hash y conteos de 10 etiquetas activas / 10 históricas
inactivas del piloto. Confirmar alias y lectura privada posterior al despliegue.
No aumentar Neon ni cambiar Free; las lecturas/escrituras normales siguen sujetas
al plan, no son una promesa de costo cero ante tráfico ilimitado.

Rollback antes de adopción: API dpl_FLgEm67JVgdP29FBFipm8ktg34du,
web dpl_HrXDR9Gf29e4xzPCVk8WndfKB9rP, dashboard dpl_FUfPG5GVyTkZBN2SHn7CUkpUKv31.
Una vez publicado un aviso real, conservar un render público compatible o resolver
hacia adelante: no revertir la web silenciosamente ocultando una advertencia activa.
