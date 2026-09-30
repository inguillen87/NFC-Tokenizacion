# NexID — corrección de dependencias sobre la rama operativa de API

Base de esta candidata: `9f303e05820838def2f148843d5374a92000280b` (rama de API). Se conserva el cierre de migraciones y de la activación comercial. El directorio `apps/api/src` y `packages/core` se compararon sin diferencias con la fuente publicada `607fe4057458e4436982df2c08785e233b30b86f` antes de preparar la entrega.

Se trasladan exclusivamente las versiones corregidas de @grpc/grpc-js 1.14.5, axios 1.20.0 y nodemailer 10.0.13, el ensayo de compatibilidad local y su workflow. El lockfile de API también recibe Undici 6.29.0 (dependencia de desarrollo) ya validado en el dashboard anterior. El cambio se restringe a cinco entradas del lockfile: la referencia de API a Nodemailer y esos cuatro paquetes; los indicadores `peer` del resto se conservan.

El único cambio de manifiesto es Nodemailer. Su versión mayor nueva requiere Node >=20 y preserva la interfaz de transporte que usa el proveedor OTP. No se modifica la configuración SMTP, no se desactiva la verificación TLS y no se utilizan credenciales reales para probarlo. El ensayo declara la recepción solamente en un servidor SMTP efímero local; no acredita entrega externa ni un correo real a un cliente.

La suite de compatibilidad y las seis guardas HTTP son las mismas que en la candidata de PR #388. Esta rama no incorpora la copia antigua de API que existe en la rama del dashboard. No cambia el contrato editorial, autenticación, flags comerciales, claves NFC, esquema o datos de Neon.

La publicación se hará sólo sobre el SHA que apruebe CI, build de Vercel y controles del candidato. El cambio de dependencia aún no se considera aplicado al runtime por estar en una rama o PR. Se conservarán los despliegues anteriores y se verificará que cotizaciones/cancelación sigan habilitadas y proveedor/acuse permanezcan desactivados.
