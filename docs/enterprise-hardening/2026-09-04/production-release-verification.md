# NexID — entrega de producción verificada, 4 de septiembre de 2026

## Estado y alcance

Publicadas dos entregas acotadas: web pública y recorrido de CRM demo aislado. **No se certifica todavía el recorrido físico NFC → tenant Balmec → CRM realtime, ni el ingreso Super Admin real.** No se desplegó la API, no se ejecutaron migraciones productivas y no se cambiaron credenciales. Los cambios pendientes del workspace se conservaron.

La aprobación del usuario habilitó Production; no se crearon previews ni se hizo merge, push o PR. La verificación combina fuentes empaquetadas, tests, build remoto, alias, marcadores públicos y recorridos reales de navegador; `READY` por sí solo no se tomó como aprobación visual.

## Publicaciones

| Superficie | Producción pública | Versión | Deployment | Fuente | Framework | Build remoto |
|---|---|---|---|---|---|---|
| Web | https://nexid.lat y https://nexid.com.ar | `2026.09.04-web.3` | `dpl_9y9aZGgYez3oLBy5iDEh3QRa4RYS` | Commit `1ebbd8ae90c256b428adb7653f445f1d628a3699` | Next.js | 73,4 s, READY |
| CRM demo | https://app.nexid.lat/login | `2026.09.04-dashboard-demo.2` | `dpl_FksoCWUk8bNnz9GraGwPCESWotCN` | Subconjunto aislado y revisado sobre `aa1ae87b5cc635d6814b86a4b4cbd8e6ccfaee0b`, no equivale a HEAD | Next.js | 61,7 s, READY |

URLs inmutables:

- Web: https://nexid-6f5p8v15s-marcelos-projects-c26aa499.vercel.app
- Dashboard: https://nexid-dashboard-gjl4z0mqn-marcelos-projects-c26aa499.vercel.app

Los tres dominios públicos devolvieron sus marcadores `/release.json` esperados a las 21:14 ART (dashboard demo.1 en ese momento). Posteriormente se promovió demo.2 para resolver la botonera móvil detectada en QA. Web usa el campo `version`; dashboard usa `release`. Los alias fueron comprobados antes de promover para no pisar publicaciones paralelas. La protección de las URLs inmutables no se deshabilitó: las comprobaciones autenticadas del candidato se hicieron mediante la CLI oficial y la inspección visual posterior sobre los dominios públicos.

## Web: resultado comprobado

- Identidad visual más visible, fondos coloreados para claro/oscuro, mayor presencia de marca, explicación separada de persona, producto/pasaporte, empresa y otros participantes.
- Acceso directo a Pasaporte digital en navegación de escritorio y menú compacto/móvil, con textos ES/EN/PT.
- Navegación `inicio → pasaporte → quiénes somos → pasaporte` verificada en producción: 1600 px ES/EN, 390 px ES claro/oscuro y smoke del alias `.com.ar`.
- Destino estable aproximadamente a 96 px debajo del borde superior; desplazarse manualmente no es revertido. Sin solapamiento medido de navbar, sin desbordamiento horizontal y sin errores JavaScript/console en esos cinco recorridos.
- 443/443 tests web aprobados en el workspace y en la fuente exportada. Build remoto y comprobación TypeScript aprobados.
- La primera y segunda iteración no resolvieron el fragmento al volver desde otra página en todos los casos. La tercera incorporó restauración tras carga progresiva, fuentes y layout, cancelable ante interacción del usuario y sin polling. Se agregaron siete pruebas funcionales. Los resultados anteriores fallidos no se cuentan como certificación.
- La preferencia de idioma SUN incluida no equivale a prueba nueva sobre un tag físico ni sobre Safari/iPhone real.

Capturas de producción inspeccionadas, fuera del repositorio:

- `C:/Users/guill/AppData/Local/Temp/nexid-navbar-qa-53d4/release-v3-1600-es-AR-light-returned-passport.png`
- `C:/Users/guill/AppData/Local/Temp/nexid-navbar-qa-53d4/release-v3-390-es-AR-light-returned-passport.png`
- `C:/Users/guill/AppData/Local/Temp/nexid-navbar-qa-53d4/release-v3-390-es-AR-dark-returned-passport.png`
- `C:/Users/guill/AppData/Local/Temp/nexid-navbar-qa-53d4/alias-v3-1600-es-AR-light-returned-passport.png`

## Dashboard demo: publicación y límites

Ruta de entrada: `/login` → **Abrir demo simulada**. El POST de sesión devuelve 303 y abre el CRM sin volver al login. Se comprobaron seis eventos ilustrativos, seis ubicaciones en cinco zonas, cartografía cargada y procedencia demo visible. **No son los diez tags físicos del usuario.** La vista demo no se usa como evidencia de actividad productiva, identidad personal ni verificación criptográfica.

- 517/517 tests dashboard aprobados con el runner correcto `node --import tsx --test` (513 antes del ajuste móvil, cuatro pruebas nuevas); TypeScript y build remoto aprobados. Una ejecución anterior sin `--import tsx` falló por resolución de módulos y fue identificada como error de comando, no como regresiones corregidas o pruebas omitidas.
- Mapa con controles y leyenda reorganizados; auditoría de eventos coherente con la fuente demo.
- Navegadores 1440 px claro y 390 px oscuro: acceso demo, Densidad/Eventos/Cercanía, filtros combinados UID+BID+VALID+24 h, retorno Eventos → Centro de control y actividad por hora comprobados sin errores JS ni respuestas API >=400. Hora 12 devuelve tres eventos, hora 00 vacío y restablecer devuelve los diez ilustrativos de esa vista. El retorno confirmó canvas MapLibre y fin de carga; un timeout previo de QA se debía al selector usado.
- QA móvil descubrió que la botonera de tabla no envolvía y ocultaba las exportaciones. Se corrigieron tres líneas de clases responsive en `data-table.tsx`, conservando callbacks y scroll horizontal propio de tabla. El arreglo y sus cuatro tests están en commit `f8069c94`; demo.2 incorpora ese parche. Un `scrollWidth` correcto en HTML no se aceptó como prueba suficiente porque `overflow:clip` ocultaba el defecto.
- QA pública final de demo.2 aprobada en 390 y 1440 px: controles visibles y accesibles por Tab, Actualizar respondió 200, CSV y Excel descargaron, tabla con desplazamiento horizontal propio y página sin contenido oculto fuera del viewport. PDF visible y enfocable; no se automatizó el diálogo nativo de impresión. Cero errores JS/console observados. En móvil, toolbar x37–353; tabla con ancho visible 314 y contenido 1149, desplazamiento sólo dentro de tabla.
- Se incorporó la vista de actividad demo por hora separada de métricas productivas, con fuente explícita.
- El despliegue incluye únicamente 41 archivos seleccionados más el marcador (39 iniciales más componente/test de botonera), sobre la base productiva anterior. No incluye todos los cambios API/dashboard pendientes ni afirma un SHA de Git para un árbol mixto.
- Opt-in explícito `DASHBOARD_BODEGA_DEMO_ACCESS=true` aplicado sólo al build y runtime de esta publicación. No se cambió la configuración global del proyecto. La próxima publicación debe conservar o revisar conscientemente esta opción.
- Los contratos reales de login y resumen productivo se mantuvieron en la base anterior para no adelantar el frontend a una API todavía no publicada.

Captura principal comprobada: `C:/Users/guill/AppData/Local/Temp/nexid-navbar-qa-53d4/dashboard-production-demo-desktop.png`.

Captura final de la corrección móvil inspeccionada: `C:/Users/guill/AppData/Local/Temp/nexid-navbar-qa-53d4/dashboard-2026.09.04-dashboard-demo.2-390-events-toolbar.png`.

Fuente aislada, manifiesto y validaciones conservados en:
`C:/Users/guill/AppData/Local/Temp/nexid-dashboard-demo-20260904-9e0fc0c2c8ea40e7b08842835985fca9/`.

Hash SHA256 del árbol de fuente registrado tras el enlace del proyecto y el ajuste demo.2: `062e3c99b1a414c48044e92fefb1442af98e7202f45817a15a05cfe15d8b9f99` (2153 archivos; excluye dependencias enlazadas y artefactos locales). Manifiesto de procedencia preservado junto a este informe como `dashboard-demo-release-manifest.json`.

## Observabilidad y reversión

Las consultas de errores de runtime para ambos deployments, realizadas a las 21:14 ART con ventana solicitada de una hora, devolvieron cero filas y exit 0. Sólo cubren el tiempo disponible desde cada publicación; **no prueban ausencia de fallos futura ni un SLO**. No hay Log Drains configurados en el proyecto web consultado y no se agregaron servicios de monitoreo externo.

Tras promover demo.2 se volvió a comprobar `app.nexid.lat` contra `dpl_FksoCWUk8bNnz9GraGwPCESWotCN` y el marcador `2026.09.04-dashboard-demo.2`. Su consulta de errores de runtime también devolvió cero filas/exit 0 durante esta breve ventana de QA, con los mismos límites.

Rollback previo a esta entrega:

- Web: `dpl_9tWVKuUZ3GnwPpUNP2DVwkEh9Uu8`, `nexid-7f16s1lar-marcelos-projects-c26aa499.vercel.app`.
- Dashboard previo a esta tarea: `dpl_5Ju7PgQjPVTeV4jhL7viEw93BgTs`, `nexid-dashboard-7whh4mvug-marcelos-projects-c26aa499.vercel.app`. Incremento demo.1 anterior al ajuste móvil: `dpl_4Su4caMBmDb7zGMUaEbP8b27y5sH`, `nexid-dashboard-d3oegg2xf-marcelos-projects-c26aa499.vercel.app`, build 52,8 s.
- API sin cambios: `dpl_7CAcNex7ofwMEt2sHxLvoX7h45s2`, SHA base `aa1ae87b5cc635d6814b86a4b4cbd8e6ccfaee0b`.

Antes de cualquier reversión, volver a comprobar el alias para no pisar una publicación paralela. No se ejecutó rollback.

## Pendiente — no presentar como terminado

1. Login real del tenant Balmec, autorización real Super Admin y contratos compatibles con la API productiva.
2. Publicación y operación del backend realtime durable, sin polling de taps, con aislamiento tenant y validación del despliegue/infraestructura correspondiente.
3. Dos lecturas físicas nuevas (sello cerrado y abierto), persistencia, coordenadas consentidas y aparición en el CRM real; no reutilizar como frescos contextos criptográficos antiguos.
4. Safari/iPhone y Chrome/Android físicos, permisos de ubicación e idioma SUN durante un tap válido.
5. Auditoría integral de todos los menús y acciones: esta entrega sólo certifica los recorridos enumerados. El enlace de Riesgo con `filter=risk` requiere revisión adicional; no se certifican creación de campañas, tickets, clientes ni acciones externas.

## Limpieza de disco

Se eliminaron dos archivos `.tar` creados por esta tarea, regenerables desde Git, liberando **381,3 MiB**. Se conservaron fuentes exportadas, evidencia, dependencias y cambios de código.

El usuario autorizó futuras limpiezas de cachés/temporales regenerables cuando hagan falta, sin volver a pedir permiso. Una eliminación adicional de dos cachés `.next/dev/cache` (aprox. 741 MiB) fue bloqueada por la herramienta antes de ejecutarse: **esa acción liberó 0 bytes**, no se reintentó mediante otro mecanismo y no se tocaron archivos personales ni configuración de memoria del sistema.
