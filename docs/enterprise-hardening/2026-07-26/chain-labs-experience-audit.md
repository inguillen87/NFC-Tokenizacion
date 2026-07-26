# Chain Lab IOTA + Polygon — auditoría e implementación enterprise

Fecha: 2026-07-26  
Alcance: experiencia pública de demos y verificadores.  
Fuera de alcance: custodia, contratos, deploys, secretos, endpoints de escritura y configuración de redes.

> **HISTORICAL FEATURE SNAPSHOT.** The API state, browser observations and test
> totals below were captured during this Chain Lab implementation pass. They do
> not represent the latest deployment or complete suite inventory. Preserve
> them as evidence; use
> [`enterprise-product-experience-sprint.md`](enterprise-product-experience-sprint.md)
> for the later consolidated release snapshot.

## Resultado

Se agregó `/demo-lab/chains`, un laboratorio guiado que reutiliza evidencia pública real y separa con claridad dos promesas distintas:

- IOTA: integridad y existencia de evidencia hash-only para auditoría.
- Polygon: ownership, mint, metadata y control de wallet cuando las comprobaciones lo respaldan.

La vista nunca deriva un éxito de una mera configuración. Un estado `Verificado por RPC` exige todas las comprobaciones críticas de esa red. Si falta evidencia, baja a `Evidencia parcial`, `Configurado, sin confirmar` o `No disponible ahora`.

## Inventario anterior

| Superficie | Función existente | Hallazgo |
| --- | --- | --- |
| `/demo-lab` | Hub y simulador comercial por escenario | Explica el recorrido de producto, pero obliga a saltar entre escenarios para comparar redes. |
| `/proof/verify` | Verificador IOTA de hash, anchor, recibo y decoder | Tiene evidencia profunda y límites correctos; resulta denso como primera pantalla para una audiencia no técnica. |
| `/proof/ownership` | Certificado público Polygon Amoy | Explica mint, owner, metadata, firma y límites; vive separado del circuito IOTA. |
| `GET /public/proof/demo-cases` | Catálogo público con casos IOTA y resumen Polygon consultados por RPC | Fuente adecuada para un resumen vivo, sin necesidad de crear otro endpoint. |
| `GET /public/polygon/ownership` | Certificado detallado Polygon | Fuente adecuada para controles de ownership y degradación honesta ante 503. |

El problema era de orquestación y lenguaje, no de ausencia de verificadores.

## Snapshot vivo observado

Consulta de lectura a `https://api.nexid.lat/public/proof/demo-cases` durante esta implementación:

- IOTA EVM testnet: `rpc_verified=true`; 3/3 anchors y 3/3 recibos confirmados; contrato y transacciones públicas presentes.
- Polygon Amoy: `rpc_verified=true`; certificado `confirmed`; mint, metadata y código verificado; ownership bajo wallet demo compradora.
- `signer_configured=false` en ambos resúmenes públicos no se usa como veredicto de lectura. La firma productiva está fuera del alcance y no debe confundirse con evidencia ya publicada.

Este snapshot es temporal. La nueva página vuelve a consultar las fuentes en cada request con `cache: no-store` y timeout de seis segundos.

## Benchmark breve — fuentes primarias

| Referente | Patrón oficial | Aplicación en nexID |
| --- | --- | --- |
| [Stripe Dashboard / Workbench](https://docs.stripe.com/dashboard/basics#monitor-and-test-your-integration) | Separa sandbox de live y muestra requests exitosos/fallidos con su respuesta y referencia. | Banner TESTNET persistente, estado verificable, hora de lectura y error accionable sin convertir una prueba en producción. |
| [Polygon PoS network reference](https://docs.polygon.technology/pos/reference/rpc-endpoints) | Publica Amoy como testnet, chain ID 80002 y su block explorer oficial. | Se nombra Amoy como red de prueba y cada identificador público ofrece salida al explorer solo si el backend devolvió una URL HTTPS válida. |
| [IOTA EVM](https://www.iota.org/products/evm) | La página oficial separa la conexión de testnet y el acceso al explorer del uso productivo de la red. | La experiencia conserva el contexto TESTNET y separa anchor de recibo en cada caso público. |
| [GS1-Conformant Resolver 1.2.0](https://ref.gs1.org/standards/resolver/) | Un identificador conecta un objeto con múltiples recursos humanos o machine-readable y diferencia condiciones de error. | El laboratorio funciona como capa humana; los verificadores y explorers siguen siendo las salidas técnicas y no se oculta la degradación de una fuente. |

## Decisiones de UX

1. Objetivo antes que blockchain: el usuario elige auditoría, ownership o circuito combinado.
2. Roles separados: IOTA no se vende como ownership y Polygon no se vende como autenticidad NFC.
3. Evidencia antes que marketing: cada red muestra checks, métricas, IDs, links y hora de lectura.
4. Límites explícitos: cada bloque distingue `Sí prueba` de `No prueba por sí solo`.
5. Testnet no es producción: el banner y la puerta de producción permanecen visibles en el recorrido.
6. Error honesto: sin IDs o URLs válidas no aparece un link ficticio; el usuario puede reintentar con `router.refresh()`.
7. Continuidad: desde el resumen se abre `/proof/verify?layer=iota#iota-proof` o `/proof/ownership` para la inspección completa.

## Máquina de estados

### IOTA

- `verified`: RPC superior confirmado, uno o más casos, todos los anchors confirmados, todos los recibos confirmados, transacciones públicas HTTPS y contrato presente.
- `partial`: existe alguna confirmación real, pero falta al menos una condición crítica.
- `configured`: RPC/contrato configurado sin confirmación suficiente.
- `unavailable`: no hay configuración ni evidencia pública útil.

### Polygon

- `verified`: RPC y certificado confirmados, metadata verificada, eventos del mint coincidentes, contrato y transacción pública HTTPS presentes.
- `partial`: existe alguna confirmación real, pero el certificado no cierra todas las comprobaciones críticas.
- `configured`: RPC/contrato configurado sin evidencia completa.
- `unavailable`: no hay configuración ni evidencia pública útil.

El estado global es `verified` solo cuando ambas redes están verificadas.

## Seguridad y privacidad

- Solo realiza GET a endpoints públicos existentes.
- No importa ni muestra secretos, claves, custodia o configuración de firma.
- Las URLs externas se aceptan únicamente con protocolo HTTPS.
- Los errores técnicos se normalizan y limitan antes de renderizarse.
- La vista conserva la política pública de privacidad devuelta por la API.
- No existe botón de mint, anchor, claim o escritura on-chain en esta ruta.

## Archivos

- `apps/web/src/app/(public)/demo-lab/chains/page.tsx`
- `apps/web/src/app/(public)/demo-lab/chains/chain-lab-client.tsx`
- `apps/web/src/app/(public)/demo-lab/chains/chain-lab-model.mjs`
- `apps/web/src/app/(public)/demo-lab/chains/chain-lab.module.css`
- `apps/web/tests/chain-lab-experience.test.mjs`
- `apps/web/src/app/(public)/demo-lab/page.tsx` — CTA mínimo al nuevo laboratorio.
- `apps/web/src/app/sitemap.ts` — publicación de la ruta.

## Verificación ejecutada

Los conteos siguientes pertenecen exclusivamente a esta corrida histórica.

- `node --test apps/web/tests/chain-lab-experience.test.mjs`: 6/6.
- `npm test --workspace=web`: 113/113.
- `tsc --noEmit -p apps/web/tsconfig.json`: OK.
- `npm run build --workspace=web`: OK; Next.js registró `/demo-lab/chains` como ruta dinámica.
- API viva `GET /public/proof/demo-cases`: HTTP 200 y evidencia RPC completa en el momento de la lectura.
- Chrome abrió `http://127.0.0.1:3017/demo-lab/chains?goal=dual` y resolvió el título correcto. La política del navegador bloqueó después la inspección automatizada del DOM local; por eso no se declara QA visual completo.

## Pendiente real

Antes de llamar a esta experiencia “mainnet enterprise” todavía se requiere una fase separada con políticas por tenant, presupuesto, separación testnet/mainnet, monitoreo, alertas, SLA, runbook y definición legal de cada prueba. Esta implementación no oculta esa frontera.
