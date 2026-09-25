# Bandeja accionable — integración con el circuito avanzado

Base: `37675a98` (código de formulario integrado `b95eed1b`). Incremento incorporado: `5919edb8375d894df27523046fc6c83d254d4880`, desde la base productiva `ca437bfb`. Rama: `codex/nexid-inbox-integrated-20260925`.

El merge conserva ambas ascendencias. La resolución parte del workspace avanzado y cambia únicamente import/renderizado/estado local de búsqueda de la bandeja. No sustituye sus guardas por las del panel productivo anterior ni modifica cotización, cancelación, técnicos, proveedor, acuse, disponibilidad, formulario o recibos. El filtro de canceladas se habilita explícitamente sólo en esta combinación compatible.

Las tres fuentes nuevas (modelo, componente y estilos) coinciden con las del commit revisado de bandeja. El manifiesto conserva las huellas previas salvo el workspace combinado y registra las tres nuevas; no se acepta todo el directorio como un baseline sin distinguir su origen. Se incorpora una prueba de coexistencia con los módulos y guardas avanzados. El workflow conserva todas las suites anteriores y añade la nueva bandeja una sola vez.

Validación local: 1.709 pruebas aprobadas, cero fallos y dos omisiones existentes. Typecheck/build completos aprobados. Navegador local integrado: bandeja 142 comprobaciones/13 vistas y lecturas 124/7; sesiones y transportes sintéticos, no registros de clientes. La comparación de API, dependencias, paquetes y metadatos de release frente al padre avanzado debe permanecer sin diferencias.

Los controles de lectura incorporados al panel productivo ya existían en esta candidata: aquí se conservan, no se duplican ni se cuentan como desarrollo nuevo. Las 21 pruebas de bandeja son las mismas del incremento compartido; esta integración añade una prueba propia.

Esta rama no se promueve a producción ni ejecuta el delta 0117–0121. La publicación del bloque compatible de bandeja se hace desde su rama productiva separada. El CI del commit exacto y la promoción canónica se documentan al terminar, sin convertir pruebas sintéticas en aceptación de una sesión real.
