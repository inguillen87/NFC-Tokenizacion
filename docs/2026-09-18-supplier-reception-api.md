# Recepción industrial y autoridad de plataforma — api-reception.1

Base API verificada: 27b06f634ce1743cec8fe5a84747d3506816adf6.
No se usó la revisión anterior a la corrección de Passport Studio.

GET /admin/supplier-reception entrega una proyección de lectura: empresa, conteos,
lotes existentes, pedidos recientes, sublotes y capacidades calculadas con el
mismo evaluador de permisos y restricciones del backend. No crea pedidos,
usuarios o etiquetas y no ejecuta QA, activación ni cambios de membresía.

La lectura se permite con los permisos específicos ya delegados: manifiesto,
operaciones, QA, pedido o lectura de proveedor. No exige batches:* ni convierte
una autorización de lectura en otra de escritura. Se rechaza una consulta de
otra empresa. La sesión global debe estar sin tenant; la cuenta de empresa
permanece ligada a su tenant. Las denegaciones explícitas tienen precedencia.

Los perfiles comparables vienen del catálogo real configurado en la base,
pero no se presentan como permisos efectivos de otro usuario ni suplantan cuentas.
QA operativo y plan de calidad son distintos: el plan pertenece a la empresa;
el superadministrador no asume su aceptación. Se conserva el doble control.

La exportación del pack industrial requiere superadministración también en la
ruta de backend, antes de consultar material cifrado. Los tenant-admin/owner no
pueden obtenerlo por presentar un permiso heredado. No se modificó el cifrado,
las llaves, los controles de evidencia ni el verificador SUN/SDM.

## Contrato de lectura

Sin campos secretos, UID individuales, tokens de sesión, URLs dinámicas SUN,
storage privado ni paquetes cifrados. Máximo 100 empresas autorizadas, 20 lotes,
10 pedidos y 52 sublotes por pedido; respuesta máxima 256 KiB. Los límites son
explícitos, no paginación completa del histórico. Conteos de activas, inactivas
y otros estados permanecen separados. No se convierte un nombre de demo en
proveniencia simulada y no se inventan órdenes para un lote ya existente.

## Evidencia

Nueve pruebas específicas aprobadas sobre autorización, denegaciones, alcance,
plan del cliente, superficie sin escrituras y pack reservado a plataforma.
Build completo de API y su cadena de regresiones aprobados. La lectura se probó
además con PostgreSQL 17.10 local desechable y la función real de consulta.
La autenticación de los casos visuales usó sesiones locales sintéticas; no
constituye validación de login/MFA del dispositivo de Marcelo ni nuevo TAP físico.

No hay migración nueva, cambio de planes, broker, polling, IA ni modificación
de datos productivos en esta entrega. Preserva las migraciones0104/0105 existentes.
Rollback de API: dpl_EqNnXJS8uUuv3cncaP9d8kGUmNxP. Requiere coordinar con la UI
porque la nueva página depende del nuevo endpoint de lectura.
