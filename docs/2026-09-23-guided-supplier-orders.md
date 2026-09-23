# Preparación guiada de pedidos de fábrica

Dashboard .39 continúa la versión .38 en el alta existente `/supplier-orders/create`.
El operador elige el envase, aplica una propuesta y completa nombre, referencia,
cantidad y finalidad. La empresa procede de la sesión cuando está acotada a una
empresa; una cuenta de plataforma conserva la selección manual, validada por el
servidor. Los detalles de chip, portador, material y división del pedido quedan
disponibles en una sección desplegable.

Los siete perfiles cubren PET transparente, etiqueta blanca, dry inlay, precinto
TagTamper con cola, TagTamper destructible, UHF para cajas y UHF sobre metal.
Aplicar un perfil cambia exclusivamente chip, tecnología y material; no cambia
empresa, nombre, referencia, cantidades, finalidad ni notas. UHF deja el modelo
de chip vacío hasta que el operador ingrese el confirmado por el proveedor.
No se asignan cantidades comerciales ni empresas a partir de un correo.

Una orden representa una construcción homogénea. Dividirla genera lotes de esa
misma construcción: no sirve para mezclar adhesivos, antenas o tipos de etiqueta.
Sin división explícita, el tamaño del lote coincide con la cantidad del pedido.
El resumen conserva los límites del API: 100.000.000 unidades y hasta 52 lotes.

## Límites operativos

- La preparación es local y no hace escrituras. Crear sí llama al endpoint
  existente y, para NFC seguro, genera claves en el servidor. Se conservan
  permisos independientes, MFA, preparación SUN de la empresa y custodia actual.
- Pruebas o producción exige una elección explícita. Las pruebas siguen siendo
  no vendibles; producción sigue bloqueada por sus controles de recepción.
- Ningún perfil aprueba materiales, impresión, adhesivo, RF, codificación,
  fabricación, QA ni activación. No incluye offsets o claves en el navegador.
- El bloqueo síncrono impide dos envíos simultáneos. Ante transporte incierto,
  error del servidor o respuesta inválida, el operador debe revisar los pedidos
  antes de habilitar otro envío. Esto no agrega idempotencia al API existente.
- Los borradores sobreviven a errores y cambios de perfil durante la sesión de
  página. No se promete persistencia después de recargar o cerrar la pestaña.
- No hay migración, dependencia nueva, solicitud al proveedor ni orden creada
  para probar producción. El kit de integración y el laboratorio existentes
  siguen siendo los siguientes pasos; no se crea un módulo paralelo.

## Contexto de muestras y verificación pendiente

La solicitud comercial compartida por el usuario comprende siete construcciones
y 410 muestras (350 NFC y 60 UHF). Es una solicitud de cotización y confirmación
técnica, no una respuesta del fabricante ni una compra autorizada por el sistema.
Las primeras 3–5 muestras por construcción son una revisión de ingeniería
propuesta. No sustituyen el manifiesto completo ni la QA existente de 10 unidades
(o todo el lote si tiene menos), ni el plan AQL de producción.

La aceptación debe distinguir criptografía, construcción física y lectura sobre
el envase lleno. Para TT, pedir cierre CC y luego OO con un corte que permanece
abierto. OC corresponde a apertura anterior y circuito actualmente cerrado;
requiere una prueba de reconexión separada. II significa TT no habilitado, no
apertura confirmada. Los valores son dos bytes ASCII (4343, 4F4F, 4F43, 4949).
El offset cero dentro del plaintext ENC debe verificarse contra la posición
efectiva del archivo: no equivale a asumir TTStatusOffset=0 en FileSettings.
No se modificó el verificador TT existente en esta entrega.

NXP documenta que el chip es pasivo: su estado no demuestra vigilancia continua
sin energía. El diseño final debe impedir abrir y reparar el lazo entre
mediciones. Elegir el chip no certifica el adhesivo, la antena o la resistencia
química. Fuentes primarias:

- [NXP NTAG 424 DNA TagTamper, §§9.3 y 10](https://www.nxp.com/docs/en/data-sheet/NT4H2421Tx.pdf)
- [NXP AN12196, §6.5](https://www.nxp.com/docs/en/application-note/AN12196.pdf)
- [NXP AN11941, diseño del lazo](https://www.nxp.com/docs/en/application-note/AN11941.pdf)

## Comparación aplicada

Se adopta el patrón de configuración reutilizable documentado por
[Kezzler](https://kezzler.com/whats-new-on-our-platform-q2-2026/) y la separación
entre identidad del producto y tecnología de portador descrita por
[Digimarc](https://www.digimarc.com/product-digitization). Estas fuentes respaldan
los patrones, no una afirmación de superioridad medida. El incremento concreto
de NexID evita volver a introducir combinaciones de chip, portador y material,
sin convertir una plantilla en aceptación técnica.

## Validación

TypeScript y compilación de producción correctos. Suite completa: 1.212 casos,
1.210 aprobados, cero fallos y dos omisiones opcionales preexistentes. Navegador:
805 comprobaciones en 41 vistas, incluyendo móvil/escritorio, claro/oscuro,
permisos, cambios de perfil, doble envío, errores y vencimiento real de 20 s.
Sin hallazgos graves/críticos de axe, desbordamiento horizontal, excepciones del
cliente ni solicitudes externas inesperadas. Se inspeccionaron las capturas de
móvil claro y escritorio oscuro. Auditoría de dependencias y control de secretos
correctos. Una revisión independiente detectó la combinación UHF con NFC estático;
se corrigió y quedó cubierta por pruebas funcionales.

El recibo de publicación registra por separado las pruebas locales, el CI del
commit, la identidad de Vercel y la lectura autenticada. El harness de navegador
monta el componente real con sesión y transporte sintéticos: no certifica una
orden real, una escritura productiva ni las muestras físicas del proveedor.
