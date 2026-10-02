# Consumer details 8 — publicada

La versión `2026.10.02-web-consumer-details.8` está publicada y aceptada en
`nexid.lat` y `nexid.com.ar`. La reconciliación real del 2 de octubre de 2026,
a las 18:54 UTC, confirmó cuatro aplicaciones y siete rutas WEB: manifiesto
completo de 12 campos y despliegue de producción correcto en cada ruta.
API y dashboard conservaron sus identidades y contratos públicos.

| Identidad publicada | Valor |
|---|---|
| Fuente revisada | `610ee8995371444782102bc08962fde249bf6c51` |
| Árbol del build | `336aafe024691fef193ca438233a5f61a6cc37ba` |
| Integración [PR #407](https://github.com/inguillen87/NFC-Tokenizacion/pull/407) | `fe29af3bacc12f22a8082edf6b5ad4d9560bf6f7` |
| Despliegue WEB | `dpl_9temitcYDsfZxWeKzKW37mWDNvZX` |

El merge contiene exactamente el árbol revisado. Se promovió a producción
el despliegue existente que había pasado Preview y Stage aislado; no fue
necesario reconstruir el mismo código. La asignación de alias observada
registra `2026-10-02T18:07:07.694Z` (`aliasAssignedAt=1790964427694`).
Este cierre modifica únicamente la documentación.

Fuentes primarias: [manifiesto servido](https://nexid.lat/release.json) e
[identidad del despliegue en Vercel](https://vercel.com/marcelos-projects-c26aa499/nexid-web/9temitcYDsfZxWeKzKW37mWDNvZX).

## Cambios visibles

- El recorrido móvil presenta tarjetas completas, fotos naturales y espacio
  para producto y lote. Conserva la última selección explícita después de un
  swipe; una nueva acción reemplaza esa intención.
- SUN muestra carga y reintento de herramientas, conserva los formularios y
  respeta el foco. La ayuda mantiene su botón renderizado en servidor.
- El mapa conserva navegación de teclado, capas y cierre con Escape. Los
  logos grandes, HERO, animaciones y movimiento reducido se mantienen.

## Validación de esta fuente

Pasaron 799 pruebas locales y el build con QA estático. La CI del código
publicado pasó ocho checks en tres workflows, con 16 informes y 4.878
comprobaciones; los 20 escenarios de ubicación se registran aparte.
Estos resultados corresponden a la fuente indicada arriba. La CI del cierre
documental se registra por separado, sin afirmar una nueva ejecución de SUN.

PRE6 aprobó esta misma fuente, incluido el focal nativo de 54 escenas,
96 recuperaciones, 12 observaciones temporales y cuatro límites 760/761.
La campaña POST13 completó seis ejecuciones únicas: pública, cliente y
animaciones en cada dominio. Queue15 conservó la pública LAT ya aprobada
y ejecutó por primera vez las otras cinco.

| Por cada dominio | Resultado |
|---|---|
| Público | 2.749 controles; 982 originales, 44 vistas, 16 recorridos y 52 PNG |
| Comparación pública con Stage | 44/44 pares con cero diferencias RGBA |
| Cliente | 319 controles; 24/24 pares con cero diferencias RGBA y ocho superficies de cabeceras de privacidad |
| Animaciones | 686 controles y 20 vistas; 29 nativos incluidos una sola vez y dos temas realmente ocultos |

La conciliación final conserva el 308 de `www.nexid.lat` hacia su apex y
el 401 inicial del alias automático, seguido de GET autorizado con cookies
sólo en memoria. No se presentan las siete rutas como HTTP 200 iniciales.
La salud API acredita únicamente el proceso, sin certificar base de datos
ni operaciones autenticadas.

Se observaron seis cargas frías de una consulta SUN sintética e inaccesible,
tres por perfil. La mediana FCP fue 452 ms en `desktopCpuNetwork` y 3.316 ms
en `mobileSynthetic`. No se demuestra una mejora causal de velocidad;
Framer permanece en la descarga inicial. No se midieron GPS ni un TAP físico
de esta versión. El TAP de Balmec comunicado antes pertenece a la versión previa.

## Historia preservada

El candidato anterior `b53112954aea493da6c450153c163a2141651eb8` pasó su CI
pero falló el focal nativo: una finalización tardía del swipe devolvía la
selección a otra tarjeta. Fue rechazado y sus registros permanecen intactos.
Los fallos V6/V7/V8/V9 y las detenciones previas de cola siguen rechazados;
el diagnóstico12 no demuestra su causa ni sustituye las seis matrices aprobadas.

La comprobación suplementaria de Chrome global cero también sigue rechazada:
observó ocho procesos externos al cierre de Motion AR. La auditoría16 verificó
cero navegadores propios bajo el contrato congelado. No se afirma que todas
las comprobaciones suplementarias o históricas hayan pasado.

Los originales de POST13, queue15, benchmark y ledger18 se conservan con sus
hashes. El recibo actual es
`consumer-details-mobile-intent-binding-v20-current-final.json`, SHA256
`919191b7264674d30605108b1b6b014122dfa8ad15d084a18d222ef433c179d3`.
API, dashboard, seguridad NFC, anti-replay, consentimiento, permisos,
contratos, dependencias y migraciones no recibieron cambios de fuente.
