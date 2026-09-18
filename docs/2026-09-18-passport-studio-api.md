# S4 — Passport Studio: persistencia, revisión y publicación

API: 2026.09.18-api-passport.1. Base funcional desplegada: 39dc0f40.
Integra la política editorial preparada en 78c457fb, sin alterar SUN/SDM.

La gestión es opt-in por lote. Abrir la página no crea un borrador. Iniciar requiere
batch.product.configure y consentimiento explícito: los editores directos del
contenido quedan bloqueados para ese lote; las propiedades existentes se conservan.
La migración no inscribe ni publica lotes automáticamente.

Flujo: iniciar → guardar → presentar → revisión independiente → publicar.
El autor, último editor y quien presenta la revisión no pueden aprobarla.
Revisión requiere batch.product.review; publicación requiere batch.product.publish.
Se resuelven identidad y empresa desde la sesión autenticada. No se crean cuentas,
roles ni permisos. Los administradores deben disponer de un revisor distinto.

## Persistencia e integridad

Migración 20260918120000_0104_passport_editorial.sql: indicador de gestión en batches,
cabecera por lote, historial editorial y comprobantes idempotentes. La función
SECURITY INVOKER bloquea lote y cabecera, verifica revisión/digest y guarda
contenido público, historial y comprobante en una transacción.
La función de escritura no es ejecutable por PUBLIC. Permisos y actor se verifican
también en la API; el cliente no puede enviarse permisos ni una aprobación propia.

Publicar modifica únicamente los campos públicos y sus alias conocidos. No copia
SDM completo al historial ni reemplaza claves, contador, autenticidad o tamper.
El trigger impide que el PATCH antiguo u otro escritor de aplicación modifique
contenido gestionado por fuera del flujo. El editor legado añade CAS y respuesta
409; otros campos técnicos no editoriales conservan su funcionamiento.

Repetir el mismo operationId+actor+empresa+lote+comando devuelve el comprobante
original. Otro contenido con ese identificador es conflicto. Sin resultado
confirmado no se anuncia un guardado. Las versiones nuevas vuelven a requerir
revisión. Recuperar contenido anterior no publica automáticamente.

## Pruebas ejecutadas

23 comprobaciones sobre PostgreSQL 17.10 real, efímero y local: inicio sin modificar
contenido, permiso, aislamiento, revisión independiente, escrituras concurrentes,
repetición de guardado/publicación, reversión de fallos tras modificar el producto,
segunda revisión, recuperación y preservación de claves/campos técnicos sintéticos.
No se usaron datos ni secretos productivos. El harness ejecuta el servicio real.

Además: pruebas de política y contratos, build completo de API y regresiones
SUN/autenticación/rewards/proveedores/webhooks. La publicación previa permanece
hasta que un usuario autoriza la versión aprobada.

## Límites

Editor de contenido público con plantillas general y agro; no es repositorio de
archivos privados ni verifica documentos externos. Las URLs son declaradas y la
imagen externa solo se carga por acción explícita. Idioma inicial por documento;
no es publicación automática multilingüe. Mantiene hasta diez revisiones completas
en la respuesta de UI, sin borrar el historial persistido.
La aprobación es editorial, no legal ni una prueba de contenido/custodia física.
Los campos específicos de vino se conservan, pero no se editan en este primer
Studio si se activa la gestión; se advierte antes de iniciarla.
SHA-256 es control de integridad, no firma legal. No cambia planes ni agrega IA.

Rollback: API previa dpl_2nyG3jTyBzQs4dMLkjZwBggEoqYj. El esquema es aditivo,
pero una vez inscrito un lote, el trigger debe mantenerse y el editor antiguo no
puede sustituir revisión por un rollback. No desactivar ni borrar evidencia.
