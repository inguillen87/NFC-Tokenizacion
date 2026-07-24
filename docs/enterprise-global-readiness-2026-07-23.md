# Enterprise global readiness — 2026-07-23

## Veredicto ejecutivo

nexID tiene una diferenciacion tecnica real en identidad fisica: NFC SUN/SDM, control de replay y tamper, passports por tenant, ownership en Polygon y evidencia hash-only en IOTA. El sprint actual tambien elimina varias condiciones incompatibles con una venta enterprise: writer IOTA V2 nativo e idempotente, firma aislada, verificacion RPC completa, takeover IAM, sesiones con permisos obsoletos, operaciones cross-tenant, diagnosticos SUN con efectos laterales y dependencias productivas vulnerables.

La conclusion profesional sigue siendo: **la plataforma todavia no debe venderse como DPP globalmente conforme ni como infraestructura mainnet enterprise terminada**. Puede venderse como piloto controlado de autenticidad y trazabilidad, siempre que el contrato comercial describa testnet, SLA y limites. Para competir por programas globales falta convertir la ventaja NFC en una capa interoperable y regulatoria: EN 182xx, EU DPP Registry, GS1 Resolver, EPCIS, backup/portabilidad, identidad de operador y assurance operativo.

## Cambio regulatorio que altera la prioridad

La referencia ya no es un DPP europeo hipotetico. La Comision Europea puso en marcha el entorno del [Digital Product Passport Registry el 20 de julio de 2026](https://single-market-economy.ec.europa.eu/news/digital-product-passport-registry-now-live-2026-07-20_en). El Registry ofrece UI y API, prueba de registro, repositorio semantico, verificacion y logging; el primer deadline indicado por la Comision es el **18 de febrero de 2027 para determinados tipos de baterias grandes**, no para todos los productos.

El [Reglamento de Ejecucion (UE) 2026/1778](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AL_202601778) define el Registry, verificacion de operadores, autorizacion, identificadores, repositorio semantico, versionado/logs y transferencia de registros. Al 23 de julio de 2026 figura con fecha de efecto 6 de agosto de 2026; por eso cualquier afirmacion juridica debe revisarse nuevamente en release.

CEN-CENELEC publico la familia EN 18216, 18219, 18220, 18221, 18222, 18223, 18239 y 18246; seis de las ocho normas ya fueron citadas en el OJEU y su aplicacion correcta aporta presuncion de conformidad para los requisitos correspondientes. La descripcion oficial y el alcance estan en [CEN-CENELEC, 15 de julio de 2026](https://www.cencenelec.eu/news-events/news/2026/en-in-the-spotlight/2026-07-15-dpp/).

## Comparacion competitiva honesta

Las capacidades de terceros de esta tabla son claims publicados por cada proveedor; no son una auditoria independiente.

| Referencia | Fortaleza publicada | Donde nexID gana hoy | Brecha que debemos cerrar |
| --- | --- | --- | --- |
| [Avery Dennison atma.io](https://www.averydennison.com/na/en/industries/apparel/products/data-management-applications) | Decenas de miles de millones de items/datos, GS1 Digital Link, EPCIS 2.0, hardware y supply chain global | Autenticidad criptografica NFC SUN/SDM y tamper con una capa de evidencia publica explicable | Escala probada, conectores industriales, GS1/EPCIS certificado y operaciones multi-region |
| [Kezzler](https://kezzler.com/solutions/compliance/) | Base de datos audit-ready, DPP/FSMA 204/battery y workflows de compliance | Prueba fisica NFC mas fuerte y composicion Polygon/IOTA opcional | Perfiles regulatorios, aprobaciones, validacion de campos, integraciones ERP/PIM y reportes de compliance |
| [Scantrust](https://www.scantrust.com/anti-counterfeit-solutions/) | Secure QR con copy detection, investigacion de falsificaciones y tooling de inspectores | SUN dinamico y tamper criptografico no dependen de una grafica QR copiable | Oferta industrial de carriers, workflow de investigacion y evidencia de campo a gran escala |
| [TrusTrace](https://trustrace.com/platform/risk-and-due-diligence) | Supplier mapping multi-tier, due diligence, auditorias y corrective action plans | Identidad item-level y autenticidad del carrier | Supplier evidence, certificados, risk workflows y assurance documental |
| [Spherity VERA](https://www.spherity.com/digital-product-passport) | Verifiable credentials, EU Business Wallet/eIDAS, Registry y data spaces | Evidencia de eventos NFC y DLT dual con roots reproducibles | Identidad verificable del operador, VC, Registry y acceso legitimo interoperable |
| [Arianee](https://www.arianee.com/en/platform) | DPP API-first, portabilidad, protocolo abierto, integraciones y assurance SOC 2 | Seguridad fisica NFC y control de replay/tamper mas especializado | Portabilidad demostrada, archive/continuity, certificaciones y despliegues globales auditados |

No conviene competir copiando el marketing de una product cloud generica. La posicion defendible es **identity assurance for high-risk physical products**, conectada a DPP/GS1/EPCIS. Esa posicion aprovecha el moat NFC y evita prometer que un hash on-chain reemplaza calidad de datos, identidad legal o compliance.

## Baseline tecnico obligatorio

### DPP kernel

- Perfiles versionados por categoria y jurisdiccion, con validacion de semantica, granularidad e identificadores.
- Lifecycle inmutable: draft, approved, registered, superseded, revoked y archived; cada cambio conserva autor, razon y version anterior.
- Separacion explicita entre datos publicos, legitimate-interest, regulatorios y privados.
- Export completo y backup provider independiente; prueba periodica de restore y transferencia de operador.
- Adapter sandbox del EU Registry con identidad de operador, registro, correccion, prueba de registro, logs y reconciliation.

### Interoperabilidad

- Implementar [GS1-Conformant Resolver 1.2.0](https://ref.gs1.org/standards/resolver/): linksets, content/language negotiation, qualifiers, HTTPS, CORS y `/.well-known/gs1resolver`.
- Ejecutar el [conformance test suite oficial de GS1](https://ref.gs1.org/test-suites/resolver/) en CI.
- Adoptar [EPCIS/CBV 2.0.1](https://ref.gs1.org/standards/epcis/artefacts) para capture/query e intercambio de eventos; el modelo interno puede conservar extensiones nexID, pero no debe obligar a cada enterprise a integrar un formato propietario.
- Publicar OpenAPI/AsyncAPI versionados, compatibilidad N/N-1 y contract tests para SDK, webhooks y eventos.

### Assurance enterprise

- KMS/HSM o custodia administrada para IOTA/Polygon; ninguna private key exportable en workloads web.
- Audit log append-only con hash chaining/external sink y comportamiento fail-closed para operaciones criticas.
- Egress gateway para webhooks, outbox durable, retries con jitter, DLQ y proteccion SSRF/DNS rebinding.
- SSO SAML/OIDC, SCIM, MFA fuerte, JIT/provisioning controlado y break-glass auditado.
- RPO/RTO contractual, restore drills, runbooks, SLOs por tenant, trazas correlacionadas y evidencia de incident response.
- Data residency, DPA/subprocessors, DSAR/delete probado, retention/legal hold y subtenant/organization boundaries.

## Roadmap recomendado

### 0–30 dias: convertir el sprint en release candidate

- Aplicar las migraciones `0050` y `0051` primero en una base efimera y staging, nunca directo en produccion.
- Desplegar executor IOTA en red privada con publisher dedicado de testnet y worker de reconciliacion; probar crash despues de broadcast, retry HTTP y recovery por tx hash.
- Completar dashboard tenant scope, webhook egress, rate limit del login y audit de acciones privilegiadas.
- Agregar CI con build completo, tests de aislamiento, `npm audit --omit=dev --audit-level=high`, migracion desde snapshot y rollback rehearsal.

### 31–60 dias: interoperabilidad vendible

- GS1 Resolver 1.2.0 + suite de conformidad.
- EPCIS 2.0.1 capture/query, mapeo de eventos nexID y export de un tenant.
- DPP kernel EN 182xx con schema registry, versionado, archive y policy de acceso.
- OpenAPI/AsyncAPI y SDK con contract tests.

### 61–90 dias: piloto regulatorio y assurance

- Integracion con el entorno de prueba del EU DPP Registry y evidencia de registration/reconciliation.
- Perfil de bateria como primer vertical regulatorio; textiles y otros grupos solo cuando exista el acto aplicable y el perfil de datos correspondiente.
- SSO/SCIM, KMS/HSM, restore multi-region, portability drill y paquete de seguridad para procurement.
- Auditoria externa del boundary NFC/SUN, tenant isolation y proof publication; comenzar SOC 2/ISO 27001 solo con control owners y evidencia continua, no como badge de marketing.

## Claims que deben quedar prohibidos

- “DPP compliant” sin perfil, version de norma, producto/jurisdiccion y evidencia de conformidad.
- “Todos los productos necesitan DPP en 2027”. El deadline confirmado citado arriba aplica primero a determinadas baterias grandes.
- “Blockchain prueba autenticidad fisica”. Prueba integridad/publicacion de datos; la autenticidad depende del carrier, provisionamiento, custodia de claves y proceso.
- “IOTA/Polygon sin costo” o “partnership oficial” sin contrato verificable.
- “Enterprise ready” mientras falten restore drills, SSO/SCIM, KMS/HSM, egress control, audit durable y SLOs medidos.

## Gate comercial

Un piloto puede venderse cuando los tests y runbooks del sprint esten desplegados en staging, el cliente acepte testnet y el scope de datos/tenants sea explicito. Un rollout global requiere cerrar el baseline tecnico anterior y aportar evidencia: resultados de conformance, restore, aislamiento, carga, incident response, key rotation y Registry sandbox. La diferencia entre ambos no es semantica comercial; es riesgo operativo y contractual.
