# NexID — remediación de dependencias de correo y transporte

## Alcance
Continuación de la PR #388 sobre `416f4fc53fc1056beaffaab42567c3d47c97a357`. La auditoría señalaba tres dependencias de producción con severidad alta. No se modifican sus umbrales, excepciones, checks obligatorios ni contratos editoriales.

| Paquete | Antes | Candidata corregida | Ruta |
| --- | --- | --- | --- |
| @grpc/grpc-js | 1.14.4 | 1.14.5 | google-gax → gRPC |
| axios | 1.18.1 | 1.20.0 | twilio → Axios |
| nodemailer | 9.1.1 | 10.0.13 | dependencia directa de API |

La actualización dirigida cambia cuatro entradas del lockfile (incluida la referencia de API a Nodemailer) y únicamente esa versión en el manifiesto de API. Las demás entradas/paquetes permanecen idénticos. Axios y gRPC satisfacen los rangos existentes de sus consumidores. El salto mayor de Nodemailer requiere Node >=20; se conserva el contrato Node >=20.11.1 del repositorio y el workflow ejecuta la compatibilidad en Node 20.19.1.

## Verificación local terminada
Instalación limpia con `npm ci --ignore-scripts`, sin usar ni modificar los node_modules compartidos. Quince pruebas nuevas: OTP mediante el proveedor real y SMTP local, autenticación rechazada, destinatario inválido, MIME/Unicode/adjunto en memoria, bloqueo de acceso a archivos/URL, redirecciones cero en ambos adaptadores Axios, cliente real de Twilio con formulario/autenticación sintética, 429 sin reintento, cancelación HTTP, URI inválida, gRPC de éxito/error/plazo y rechazo de identidad SMTPS distinta antes de AUTH.

El ensayo TLS genera un certificado efímero fuera del repositorio, mantiene `rejectUnauthorized: true`, usa sólo IPv4/IPv6 loopback y elimina los archivos al terminar. No se envía correo a Internet, WhatsApp, ni se usan claves reales. Los demás procesos se ejecutan con un entorno limitado a variables del sistema y flags de prueba; no reciben la configuración productiva.

La auditoría `--omit=dev` devuelve cero hallazgos. La auditoría completa conserva ocho hallazgos bajos de la cadena de desarrollo de elliptic/ethers y cero moderados/altos/críticos. No se confunde esto con cero vulnerabilidades totales ni con prueba de ausencia de explotación. Las quince pruebas, TypeScript y las 1.971 pruebas aprobadas del dashboard (dos omisiones preexistentes) pasaron localmente. Las 24 guardas editoriales siguen aprobadas.

## Fuentes primarias revisadas
- gRPC: https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j y release @grpc/grpc-js@1.14.5.
- Axios: https://github.com/axios/axios/releases/tag/v1.20.0 y los avisos vinculados por npm audit.
- Nodemailer: https://github.com/nodemailer/nodemailer/releases/tag/v10.0.0 y https://github.com/nodemailer/nodemailer/releases/tag/v10.0.13; avisos GHSA-v53p-9fqp-m79j y GHSA-6vj9-mwq6-2f5v.

## Puerta de integración y publicación
Esta evidencia local no afirma integración ni despliegue. La PR debe repetir los workflows sobre el nuevo SHA. Las ramas de API y dashboard siguen separadas: desplegar la copia de API de la rama del dashboard sería incorrecto. La corrección debe trasladarse a la rama de API compatible antes de promover su runtime. No cambian Neon, usuarios, claves NFC, autorización SMTP, proveedores ni flags comerciales.
