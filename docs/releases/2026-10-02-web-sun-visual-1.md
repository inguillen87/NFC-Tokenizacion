# SUN visual .1 — registro de publicación

## Publicación e identidad

**Publicada y validada con el criterio v4.** La PR [#409](https://github.com/inguillen87/NFC-Tokenizacion/pull/409) se integró y el despliegue final fue promovido después de la verificación Preview→Stage. Los recibos posteriores de LAT y AR están aprobados; el resumen offline final registra `receiptSetAccepted:true` y 253 entradas de evidencia con hashes.

- Release: `2026.10.02-web-sun-visual.1`; scope: `sun-brand-product-gallery-and-type`.
- Fuente probada: `07c00b4a08219b0e0bd9b95a86fc0c74e7060eae`.
- Árbol: `b3f0e911eeffec87b08bb7c3ba21ce182506b2bd`; base: `6eaa0a4b002ffccc00da36f7fe072bdec187f4ba`.
- Merge: `fbf55f73caa5d323af1572d45c8da6a2792e2560`, `2026-10-02T20:35:07Z`; árbol idéntico al de la fuente probada.
- Despliegue WEB final: `dpl_6vgpJa5WXQMA3ZCVDAtPAk8QFVbd`, `https://nexid-cvpnakxnl-marcelos-projects-c26aa499.vercel.app`.
- Promoción real: `2026-10-02T21:16:05.059Z`; estado observado `READY` / `PROMOTED`.
- Manifiesto público: [nexid.lat/release.json](https://nexid.lat/release.json).

`reconciliation-before-2` y `reconciliation-after-2` aprobaron 12/12 controles cada uno, siete aliases WEB y dos aplicaciones separadas. Antes, WEB correspondía a .8/fuente `610ee8995371444782102bc08962fde249bf6c51`/`dpl_9temitcYDsfZxWeKzKW37mWDNvZX`; después, los siete aliases corresponden a `07c00b4`/`6vg` y al manifiesto completo de 12 claves de Git. Se preservaron el redirect WWW de LAT y el acceso autorizado temporal del alias automático, sin persistir cookies.

API conserva fuente `9c10e5c50912d58ee9e1177fa5b7849c2211b69b` y despliegue `dpl_B83ARi352kqBkCAyavxy2U5GnnL4`; dashboard conserva `4d976d385e75d1e9139ebc44f5ba820eaaebb591`, `dpl_G4VyLi49MmAbQLQuMt3979HDBN8X` y el mismo manifiesto de 28 claves. El `/health` de API acredita vida del proceso, no disponibilidad de datos ni operaciones de base de datos.

## Cambio y perímetro

El incremento ajusta identidad de SUN, encabezado, carga, tipografía y movimiento finito. La fotografía suministrada, antes pequeña y sin ampliación, puede abrirse en un diálogo nativo accesible. El diálogo reutiliza la imagen ya decodificada en un canvas acotado, sin otra consulta GET de imagen. Conserva título y canvas como evidencia del servidor, `no-referrer`, ciclo de foco, cierre con ×/Escape/fondo y retorno al trigger conectado.

Es ampliación de una fotografía suministrada; no incorpora una galería de múltiples fotos. Los 18 archivos del incremento respecto de la base no modifican API, dashboard, dependencias, migraciones ni contratos de datos/autenticidad. No agrega GPS ni certificación de TAP físico.

La marca usa el trazado Ni existente con SVG y CSS locales. El incremento no agrega fuentes remotas ni librerías; la biblioteca de animación que entra por el loading global sigue presente. La landing conserva sus logos grandes y su HERO.

## Verificación de la fuente final

CI de `07c00b4`: ocho checks `SUCCESS`, tres workflows de GitHub Actions y GitGuardian. SUN: run `37056868132`; Security: `37056868082`; E2E: `37056868066`. La suite completa de 799 comprobaciones estáticas y el build pasaron para esta fuente. Los 18 informes del artifact contienen **6.124/6.124 checks raw** y **20/20 resultados de ubicación sintética separados**. Los controles nativos de Motion se cuentan una sola vez, dentro de su informe padre. Los campos de cierre ausentes en informes de CI no se infieren.

Las cuatro fases v4 usaron Chromium `140.0.7339.186`, build Playwright `1193`, observado también en el log de CI. Cada fase terminó con 40 vistas, 40 contextos cerrados, navegador cerrado y cero excepciones JavaScript (`pageerror`). El harness aborta todas las solicitudes no GET: Preview registra 40 abortos de inicialización Clerk y LAT 72 de telemetría RUM, con sus errores de consola/red esperados; Stage y AR registran cero. Ninguna respuesta no GET fue recibida y ningún aborto continuó hacia la red. No se declara una consola limpia para Preview o LAT ni una sesión de autenticación real validada.

La matriz pública cubre demo, ausencia de lectura y acceso inválido a 320/390 px, tres idiomas y ambos temas; agrega demo ES a 768/1440 px. Es Chromium de escritorio con viewport responsive y movimiento reducido. La entrada táctil se comprueba por separado en 18 contextos a 320/390/430 px, tres idiomas y dos temas. Los reflows equivalentes a 200% del focal no son zoom nativo ni pruebas de un teléfono físico.

| Fase / recibo | Controles aprobados | Comparación con referencia | Pares totalmente idénticos |
| --- | ---: | --- | ---: |
| Preview / `public-preview-5` | 674/674 | Línea de referencia | No aplica |
| Stage / `public-stage-5` | 716/716 | 40/40 aprobados frente a Preview | 40/40 |
| LAT / `public-production-lat-2` | 714/714 | 40/40 aprobados frente a Stage | 29/40 |
| AR / `public-production-ar-1` | 714/714 | 40/40 aprobados frente a Stage | 40/40 |

El criterio `nexid.sun-visual-public-acceptance.v4` exige bytes originales Git/HTTP exactamente iguales y contrato exacto de geometría y paint de la fotografía y su contexto. **Fuera del bitmap contenido: RGBA 0. Dentro: diferencia máxima 4 por canal RGB y ninguna diferencia alpha.** La región se obtiene de la geometría `contain`, con redondeo piso/techo y recorte a los límites del PNG.

LAT conserva 11 pares distintos en el PNG completo: sus cambios están dentro de esa región, con máximo RGB 4, exterior sin píxeles cambiados y alpha idéntico. El margen interno también cubre píxeles bajo el overlay de ampliación, esquinas redondeadas y sombra; su geometría y paint son exactos, pero **no se declara pixel-exacta por separado la UI dentro del bitmap**. No se afirma que todas las capturas completas sean idénticas.

Los resultados locales de 799 estáticas, 47 first-paint, 144 imagen y 1.102 visuales corresponden al candidato anterior `678dc85c8c3df4f495232b1fd677dadf838dd226`. La corrección final ordenó `zoomable` antes de `priority` en la página; las ocho pruebas focales de API pasaron para `07c00b4`. `touch-stage-1`, sobre el primer Stage `9Vm` de esa misma fuente, pasó 450/450 controles en 18 contextos automatizados; no es certificación de teléfono físico ni Safari.

## Mediciones y límites

`performance-stage-1` registró seis cargas de una consulta sintética inaccesible en el primer Stage `9Vm`, tres por modo. Son mediciones anteriores a la publicación final de `6vg`.

| Modo | Mediana FCP | JS encoded body | CSS encoded body |
| --- | ---: | ---: | ---: |
| Nativo de ese entorno | 696 ms | 331.639 B | 141.697 B |
| Móvil sintético: CPU ×4, latencia 150 ms | 3.284 ms | 331.639 B | 141.697 B |

Los bytes son recursos propios completados observados por `PerformanceResourceTiming`, no todos los assets ni una captura completa de tráfico. No se atribuye una mejora causal, consulta válida, TAP físico, sesión GPS ni tiempos de mapa a estas mediciones. Este registro conserva la separación entre código validado, publicación WEB, datos sintéticos y evidencia física no incluida.

## Historial y evidencia conservada

- `baseline-2`: 44 controles falsos; `candidate-1`: 30 fallos de Tab. El ciclo de foco se corrigió y `candidate-2` pasó 1.102 controles; los originales permanecen rechazados.
- CI inicial de `678dc85`: falló la expectativa de `priority` como última prop; CI final de `07c00b4` corresponde a otra fuente.
- Stage 1: rechazo de una aserción que equiparaba `aliasAssigned` con publicación. Stage 2: dos PNG diferentes, máximo 4. No se convierten en PASS.
- `decoder-probe-1`: ocho capturas y dos pares del modo por defecto exactos, pero GET final fallido; diagnóstico incompleto y sin causa demostrada.
- Preview 3 y Stage 3 pasaron 658/700 controles y 40 pares exactos con Chrome 154. La primera promoción de `9Vm`, a `20:35:26.396Z`, fue real; LAT 1 rechazó cuatro comparaciones de 698 controles y `reconciliation-after-1` quedó incompleto para `nexid.com.ar`. Se revirtió WEB a `9tem`/.8.
- Preview 4 pasó 658 controles con Chromium 140; Stage 4 siguió rechazado: 699/700, 39/40 pares exactos y 3.609 píxeles distintos, máximo 3, en `demo-320-light-es-AR`. Su imagen es JPEG aunque la ruta termine en `.png`.
- V4 es un criterio prospectivo explícito y recibos nuevos. No reclasifica los rechazos v3 ni demuestra la causa de las variaciones anteriores o que el navegador las haya resuelto. Todo el historial no se declara verde.

Evidencia final en `artifacts/sun-visual-refinement/`: `summary.json` (**SHA256 `543bd3e51533cb5d726669b15412f6e9898ca00faed44ce8f6c62d3ad87d298c`**), inventario y metadata de CI, `pr409-merged-final.json`, `promotion-observation-2.json`, los cuatro recibos v4, ambas reconciliaciones `*-2` y los informes históricos enumerados arriba. El resumen conserva el policy literal y los hashes de sus 253 inputs; resume los contadores de comparación y no vuelve a decodificar los PNG. Los archivos originales permanecen sin sobrescribir.
