# NexID — cierre publicado del expediente de solicitudes

## Resultado del 27 de septiembre de 2026

Se retomó el incremento ya preparado el 25/09, se verificó nuevamente y se cerró su publicación. No se rehízo ni se contabilizó como desarrollo nuevo el código existente.

`app.nexid.lat` sirve el deployment `dpl_4n4sQwD94bnMHABmGAvgz3PV2NDo`, construido desde `e9079e8b3e45ca9ec741d2348a13eaa3f7d55890`. La base sustituida es `bf80ccc04fa73108f8d103ebcc597a8fb833d423`; el deployment anterior `dpl_Gr3eg2EGMrZ6mRhVZ3QtwcuTtr1Y` queda como punto de reversión.

La promoción reutilizó el candidato Production READY que ya existía: cero builds nuevos, sin cambiar variables, roles, permisos o bases. El dominio se releyó después de publicar. Los deployments de `api.nexid.lat` y `nexid.lat` no cambiaron.

## Cambio visible

Al abrir una solicitud en `/supplier-orders/requests`, el expediente incorpora estado, responsable del tramo de gestión, última actividad, versión y siguiente paso. Empresa, NexID y operación técnica son etapas de responsabilidad derivadas del expediente, no nombres de personas asignadas.

La referencia completa permanece seleccionable. Sólo aparece acceso al pedido cuando existe `order_id`; el vínculo conserva el tenant. La trazabilidad básica usa las fechas presentes de creación, envío y aclaración, sin exponer notas comerciales ni agregar consultas. La guía no concede permisos ni acredita fabricación o recepción física.

La vista se revisó en 320 px claro y 1440 px oscuro. Mantiene contraste, referencias legibles, controles accesibles y flujo vertical sin desbordamiento horizontal en los escenarios comprobados.

## Validación ejecutada en este cierre

- Dashboard completo: 1.449 pruebas aprobadas, cero fallidas, dos omisiones ya existentes; TypeScript aprobado.
- Resumen de expediente: 44 comprobaciones / 8 vistas.
- Bandeja de solicitudes: 142 comprobaciones / 13 vistas.
- Flujo de solicitudes: 287 comprobaciones / 33 vistas.
- Acceso runtime/notificaciones: 62 comprobaciones / 6 vistas.
- Total de navegador repetido: 535 comprobaciones / 60 vistas, todas aprobadas. Componentes reales; sesiones, transporte y datos sintéticos. No es aceptación autenticada de un cliente.
- Auditoría de dependencias aprobada, cero hallazgos productivos altos/críticos; custodia de secretos aprobada. Fuente limpia y `git diff --check` aprobado antes de promover.

El CI original `36177433147` aprobó sobre el SHA publicado e9079e8b, incluyendo build y todas las suites configuradas. El CI avanzado `36177489429` también aprobó sobre bbf5f394. Se verificaron sus resultados existentes; no se anunciaron como nuevas ejecuciones locales ni se repitieron pipelines innecesarios.

## Verificación del deployment y del dominio

Seis controles HTTP aprobaron antes y después de promover: contrato de release idéntico; solicitudes y runtime protegidos por login; ambos endpoints privados devuelven 401 sin sesión; diagnóstico global con selector de tenant devuelve 400. La fecha UTC del control canónico fue 2026-09-28T02:17:38.508Z, todavía 27/09 en Argentina.

El contrato comercial sigue siendo `2026.09.23-dashboard.41`; no se inventa una nueva versión de API o esquema para un incremento visual. La identidad exacta de esta entrega es el SHA y el deployment indicados arriba.

La primera invocación de cierre se detuvo antes de mutar Vercel porque PowerShell trató un banner de stderr como error terminante. Se corrigió el manejo de salida, se repitieron las comprobaciones de identidad y de cambios concurrentes, y recién entonces se promovió. Una consulta agrupada posterior fue rechazada; las conclusiones se basan en la confirmación del proceso de promoción y las lecturas HTTP/control posteriores exitosas.

## Continuidad y límites

Esta entrega cierra exclusivamente el resumen del expediente compatible con la API productiva. Mantiene las mejoras de borradores, conciliación, bandeja y acceso runtime ya publicadas.

La candidata avanzada permanece en `bbf5f39445aacbd4086f900ed7426a3596952937`, con cotización, cancelación, operadores, proveedor y acuse preservados. No se promovió esa rama. La API compatible y la aceptación/autorización del delta productivo 0117–0121 siguen siendo una puerta independiente: no se ejecutaron migraciones históricas por diferencia de conteos.

El próximo cierre productivo de ese circuito requiere verificar la conexión/esquema con autorización global, autorizar sólo el delta previsto, publicar la pareja compatible con escrituras apagadas y aceptar sus flujos antes de habilitarlas. La implementación ya existente no debe duplicarse ni descartarse al retomar.

No hubo TAP físico, uso de una cuenta productiva para modificar solicitudes, cambios de claves NFC, SUN/SDM, contadores, TTStatus, envíos comerciales ni compras. MuniControl y Chatboc no forman parte de esta entrega.

Evidencia sanitizada y trazable: `docs/releases/2026-09-27-request-case-summary-publication.json`. Las capturas y logs detallados permanecen en el directorio local de verificación; no se publican datos de clientes ni informes crudos del control de Vercel.
