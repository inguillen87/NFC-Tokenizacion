# Alta guiada — continuidad de la candidata avanzada

Se incorpora el incremento de formulario `ca437bfb477b5dfb0dacd07ddedbe8eddd342daf`, creado desde la base productiva `cb2a845d`, a la candidata unificada `f076212a` (código `e439c716`). Rama nueva: `codex/nexid-request-form-integrated-20260925`. Se conservan ambas ascendencias; no se reemplaza la candidata avanzada por el panel productivo antiguo.

La guía, estilos y validación local coinciden con el incremento revisado. El workspace conserva todos los controles avanzados: retirada de acceso, cancelación y secuenciación de lecturas, incertidumbre, comparaciones de versión, cotización, asignación, proveedor, acuse y disponibilidad. Los conflictos del merge se resolvieron manteniendo esos controles y sumando únicamente estado/foco/validación del formulario.

El manifiesto de convergencia conserva las huellas originales salvo el workspace revisado y añade las tres fuentes nuevas de guía. El manifiesto previo de runtime excluye sólo ese workspace de sus fuentes inalteradas. Se agrega una prueba que verifica la coexistencia de la guía con los controles avanzados y se mantiene el navegador de cada circuito en CI.

Validación local: 1.687 pruebas aprobadas, dos omisiones existentes, typecheck y build completos aprobados. El total contiene las mismas 34 pruebas de formulario —no se cuentan como un segundo desarrollo— y una comprobación adicional de integración. El navegador avanzado queda sujeto al workflow del commit integrado; no se atribuyen a esta rama los resultados visuales del artefacto productivo de base.

Esta rama no se promueve a producción ni activa módulos dependientes de migraciones. El despliegue de la mejora de formulario se realiza desde su rama productiva separada. API, base, paquetes, dependencias, recibos, flags y protocolos comerciales permanecen sin cambios.
