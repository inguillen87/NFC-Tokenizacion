# Solicitudes asignadas al equipo NexID

## Resultado previsto

Una empresa solicita sus etiquetas desde su propia cuenta. NexID recibe la
solicitud y el superadmin puede asignar su revisión a un integrante del equipo.
Ese integrante consulta sus solicitudes y pide aclaraciones en el mismo
expediente. La empresa responde desde su acceso habitual.

El perfil interno `supplier_operator` tiene identidad y sesión propias. Su
acceso depende de la asignación de cada solicitud; no obtiene acceso general a
la empresa. No prepara pedidos, genera claves, exporta paquetes, administra
usuarios ni envía mensajes a proveedores. La preparación técnica sigue a cargo
de superadmin con los controles existentes.

## Decisiones de producto

El modelo toma como referencia la separación entre roles y permisos de
[Shopify](https://help.shopify.com/en/manual/your-account/users/roles).
La documentación de [permisos de tienda](https://help.shopify.com/en/manual/your-account/users/roles/permissions/store-permissions)
explica que el alcance puede limitarse a tiendas, pero no a pedidos individuales
dentro de una tienda. Para este proceso NexID añade un límite por solicitud
asignada. Es una decisión específica de este circuito, no una afirmación de
superioridad general sobre ese producto.

La interfaz del técnico se centra en «Mis solicitudes asignadas». No muestra
selectores de empresas ni módulos sin relación con su tarea. El superadmin
selecciona un responsable elegible, revisa el cambio y lo confirma. La ausencia
de operadores registrados se presenta como un estado accionable, sin inventar
personal o asignaciones de ejemplo.

## Integridad y alcance

- El rol admite sólo lectura y aclaraciones de solicitudes asignadas, incluso
  frente a permisos amplios heredados.
- Las lecturas filtran por el usuario autenticado en la base de datos antes de
  aplicar límites. No se concede acceso a toda una empresa para abrir un caso.
- Las asignaciones comparan la revisión de la solicitud y la de su responsable.
  El recibo de cada cambio se conserva junto con su auditoría.
- Reasignar, retirar acceso, pedir una aclaración y preparar el pedido se
  coordinan mediante el bloqueo de la misma solicitud.
- Los reintentos vuelven a comprobar el acceso vigente. Un cambio cuya respuesta
  se perdió conserva su identificador; no se reenvía como una operación nueva.
- Si se retira el acceso mientras un envío permanece sin confirmar, el operador
  puede abandonar explícitamente esa consulta. La interfaz no afirma que el
  mensaje falló ni revela información de la solicitud después de la revocación.
- Registrar un rol en el catálogo no asigna ese rol a ninguna cuenta existente.

## Estado de validación

Implementación local completa: API supera 276 regresiones focales, 1.338 casos
del build y 39 casos de PostgreSQL 17.10; Dashboard supera 1.248 pruebas con dos
omisiones preexistentes, TypeScript y build de producción. El navegador comprueba
147 casos nuevos en 18 vistas, además de la regresión de solicitudes. La revisión
visual incluye 390 y 1.440 px, claro y oscuro, sin fallos de accesibilidad o
desbordamientos. Los transportes e identidades de estas pruebas son sintéticos.

Las migraciones 0115 y 0116 ya pasaron por la rama Neon sin datos de clientes.
Una prueba adicional con el esquema completo verifica asignar, aclarar,
recuperar recibos y revocar. Todos sus registros y perfiles sintéticos se
revirtieron; el control posterior confirma cero residuos. El enum se confirma
en una transacción anterior a la migración que lo utiliza.

La evidencia de CI y publicación se registra en los candidatos Dashboard .42 y
API supplier-requests.3. Ninguna prueba sintética certifica una operación real
de empleados ni de proveedores. El inicio de sesión de Google exige una cuenta
interna existente y autorizada; no crea operadores a partir de un correo nuevo.

## Continuidad

Quedan para incrementos posteriores la cotización y cancelación, proveedor
asignado, comprobante de envío manual, entrega cifrada del paquete y avisos por
WhatsApp autorizados. Ninguna asignación interna confirma una compra, fabricación
o envío a fábrica.
