# NexID — ensayo del delta sobre el esquema observado

## Cierre técnico
Se consultó de nuevo la rama Neon seleccionada mediante transacciones READ ONLY y se obtuvo su esquema, sin copiar filas de clientes. El ledger conserva 79 IDs: 0115 y 0116 ya están registrados; 0117–0121 no lo están. La huella de los IDs ordenados coincide exactamente con el fixture existente.

El SQL de esquema tiene la misma huella que la observación del 24/09. Se restauró sin reescribirlo en un cluster PostgreSQL 17.11 local, dedicado y vacío. Se aplicaron exclusivamente las cinco migraciones mediante `db-apply.mjs --only`, el runner canónico sin modificaciones. Las 48 diferencias históricas permanecieron fuera del ensayo.

El ledger local pasó de 79 a 84. La repetición del delta no ejecutó otra migración. Se verificaron las 162 tablas de base vacías, las nuevas tablas de eventos vacías y las columnas de cancelación. La implementación versionada completó 177 comprobaciones. El cluster temporal se detuvo y se retiró al finalizar.

Esto cierra la duda de compatibilidad DDL con esta copia del esquema observado, que la reconstrucción desde migraciones no resolvía. No demuestra preservación de datos reales, ejecución con el rol efectivo de Vercel, aceptación autenticada del cliente o validación física NFC.

## Herramienta reproducible
`apps/api/scripts/supplier-observed-upgrade-rehearsal.mjs --schema-file <archivo-local-privado>` utiliza el entorno de pruebas efímeras existente. Requiere NODE_ENV y VERCEL_ENV test, la confirmación literal, una URL PostgreSQL local sin parámetros ni fragmentos, rol nexid_e2e y base dedicada inicialmente vacía. No toma credenciales de DATABASE_URL como fallback.

Antes de conectar, valida la huella exacta del esquema, los 79 IDs de ledger y los bytes canónicos de las cinco migraciones. El plan revisado rechaza archivos posteriores, IDs desconocidos, alteraciones de fuentes y deltas fuera de orden. No acepta una URL de descarga ni un destino remoto en argumentos.

La base debe pertenecer a un cluster aislado sin otras bases de usuario. Tres roles locales NOLOGIN, sin atributos elevados, conservan los nombres de propietarios y las ACL del exportador. Son sustitutos locales de nombres, no una reproducción de los privilegios de Neon. El lanzador privado prepara esos roles; el ejecutor versionado no crea cuentas ni cambia roles.

Se incorporó únicamente la versión exacta 17.11 a la lista de binarios locales aceptados. Se mantienen los controles contra Neon, host remoto, URL con overrides, base no vacía y entorno productivo. Los subprocesos reciben sólo variables del sistema operativo y su conexión sintética local; no heredan credenciales de nube ni NODE_OPTIONS arbitrario.

## Evidencia
- 36 nuevas pruebas unitarias de huellas, alcance y controles previos.
- 80 pruebas aprobadas en la combinación de seguridad efímera, plan de upgrade y nuevo módulo; las 36 anteriores están incluidas en ese total.
- 603 regresiones focales de API aprobadas, sin fallos ni omisiones.
- 177 comprobaciones del ejecutor versionado sobre la copia privada del esquema observado.
- No se modificaron SQL de migraciones, runner productivo, handlers, contratos, dashboard o web.

El primer lanzador local usaba la representación textual CIDR de inet_server_addr() para comparar loopback; se corrigió a host(inet_server_addr()). No fue un fallo del producto. Las dos ejecuciones posteriores completaron el ensayo y detuvieron sus clusters.

## Límite productivo y continuación
No se aplicó el delta a Neon ni se activaron flags. La consulta administrativa comprueba la identidad de la rama inspeccionada; todavía no certifica la conexión ni el rol efectivo del deployment API. Sigue pendiente obtener el diagnóstico con la sesión autorizada, cotejar esa identidad y autorizar específicamente la aplicación de 0117–0121 antes del despliegue coordinado con nuevas escrituras desactivadas.
