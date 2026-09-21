# S6 — Candidato .28 preparado; no es una publicación

Fecha: 21/09/2026. Esta entrega prepara la versión publicable del incremento de conciliación ya validado, sin anunciar otro módulo ni modificar la lógica de retiros probada.

## Evidencia y revisión visual completadas

Se descargó el artefacto 10621022525 de la ejecución 35557122467 y se comprobó su SHA-256 completo: a1ca77beb6cb3be895da996c414c8021fbc6bd24ac7de2696d0fbb301448e372. Su candidate-sha.txt corresponde a c60b233924db262a73e0ef0704501662642ff602. El informe confirma siete recorridos integrados, 962 pruebas aprobadas, cero fallidas, dos omitidas y cuatro superficies visuales automatizadas.

Se revisaron visualmente las cuatro capturas guardadas: 1440/390 píxeles en claro y oscuro. Se inspeccionaron jerarquía de pendientes, identidad de destinos, diferencia entre devueltas/inmovilizadas, estados de acciones, foco visible y adaptación vertical. No se ejecutó desde esas imágenes una sesión real de teclado o lector de pantalla. El dock fijo y la pestaña horizontal forman parte del shell existente; las capturas de página completa no certifican por sí solas cada interacción de scroll ni todos los dispositivos. No se declara certificación WCAG ni comprobación privada productiva.

## Preparación realizada en esta entrega

- Marcador dashboard 2026.09.21-dashboard.28 y notas de la entrega en español, inglés y portugués.
- Dependencias de release alineadas a la combinación ensayada: API consumer-history.1 y web-history.1. No se redepliega ninguna de esas aplicaciones.
- Manifiesto docs/releases/2026-09-21-dashboard.28.candidate.json: fuente S6, evidencia, hashes de capturas, artefacto previo conocido y puertas restantes.
- Comprobaciones para que un CI correcto no cambie automáticamente el estado de candidato a publicado.

La lógica y estilos de conciliación conservan los bytes validados de c60b2339; se cambian metadatos, notas y pruebas de release. Se solicita una sola aceptación de la revisión nueva para verificar su paquete final, no una repetición sin cambios del ensayo anterior.

## Límite de producción comprobado

La lectura de app.nexid.lat mediante el conector Vercel sigue respondiendo 403: la conexión no tiene autorización sobre marcelos-projects-c26aa499. No se modificaron permisos globales de ChatGPT para intentar sustituir esa autorización del proveedor. No se reintentó el canal de ejecución de Desktop Commander pausado por cupo ni se cambió su plan.

No se verificó ahora el alias productivo mediante una vía autorizada. El deployment previo del manifiesto es el último conocido, no una confirmación actual. Antes de desplegar: reautorizar Vercel, leer los tres aliases y sus revisiones, detenerse si hay trabajo concurrente, construir el commit exacto como candidato, probar staging y sólo entonces promover y verificar los dominios.

Ninguna parte de este documento significa que .28 esté en app.nexid.lat. No hay cambio de Neon, migración, clave, contador, TTStatus, aviso público, envío, permiso de cliente ni etiqueta piloto. La conciliación sigue usando declaraciones de operadores: cerrar el seguimiento no libera productos ni levanta el aviso.
