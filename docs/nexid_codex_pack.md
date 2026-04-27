# nexID — Codex Pack

## Orden recomendado

1. `security-hardening`
2. `event-contract-unification`
3. `consumer-ownership-flow`
4. `global-ops-map`
5. `dashboard-executive-charts`
6. `landing-proof-system`
7. `passport-mobile-ux`
8. `realtime-alerts`
9. `qa-demo-corpus`

---

## Prompt maestro para todos los Codex

```text
Trabajá sobre el repo inguillen87/NFC-Tokenizacion.

Contexto del producto:
- Monorepo con apps/api, apps/web y apps/dashboard.
- nexID valida taps NFC/SUN de tags premium, genera un Digital Product Passport, registra eventos por tenant y expone analytics/live ops.
- El norte de producto es: tap físico → validación criptográfica → passport → asociación al tenant → marketplace/loyalty → dashboard admin en tiempo real.

Reglas obligatorias:
1. No rompas rutas existentes: /sun, /health, /admin/events/stream, /me, /me/marketplace, landing pública y dashboard.
2. No hardcodees secretos, API keys, credenciales demo, tokens ni passwords.
3. No mezcles datos demo con producción. Si existe fallback demo, debe quedar explícitamente gated por env y rotulado como demo.
4. No inventes analytics: toda métrica productiva debe salir de eventos persistidos o agregados derivados de esos eventos.
5. Preservá TypeScript estricto y contratos tipados entre API/dashboard/web.
6. Si cambiás schema, agregá migración versionada y no uses ALTER TABLE runtime en request path.
7. Agregá tests o checks mínimos para cada cambio crítico.
8. Antes de editar, inspeccioná archivos relevantes y describí brevemente el plan.
9. Al terminar, entregá resumen de cambios, archivos tocados, cómo probar y riesgos restantes.

Comandos esperados, ajustando según package scripts reales:
- npm install si agregás dependencias.
- npm run lint
- npm run typecheck o tsc equivalente
- npm run build para las apps afectadas
- tests unitarios/e2e si existen
```

---

## Codex 01 — security-hardening

```text
Título: Security hardening multi-tenant para API admin y eliminación de credenciales/fallbacks inseguros

Objetivo:
Endurecer la capa admin/API sin romper la demo, separando claramente producción de demo y eliminando dependencia exclusiva de una ADMIN_API_KEY global para operaciones multi-tenant sensibles.

Trabajo requerido:
1. Inspeccioná guards/auth helpers de apps/api y apps/dashboard.
2. Detectá endpoints admin protegidos solo por ADMIN_API_KEY.
3. Introducí un modelo de auth por scope:
   - super_admin
   - tenant_admin
   - reseller
   - readonly_demo
4. Si ya existe sesión/role en dashboard, conectala con headers/tokens server-side hacia API.
5. La ADMIN_API_KEY puede quedar como compatibilidad interna, pero:
   - nunca debe ser expuesta al cliente.
   - debe poder deshabilitarse para producción con una env tipo REQUIRE_SCOPED_ADMIN_AUTH=true.
6. Bloqueá fallbacks demo en entornos productivos:
   - no mostrar analytics fake si NODE_ENV=production y DEMO_MODE no está explícitamente activo.
   - agregar bandera visible “DEMO DATA” cuando se usen datos simulados.
7. Buscá credenciales hardcodeadas o docs con passwords reales/sensibles.
   - No las repitas en logs ni en el PR.
   - Reemplazalas por placeholders.
   - Agregá nota de rotación en SECURITY_NOTES.md o docs/security.md.
8. Agregá tests básicos de autorización:
   - sin auth → 401
   - tenant sin scope → 403
   - tenant con scope correcto → 200
   - demo session → solo datos demo rotulados

Archivos probables:
- apps/api/src/**/admin/**
- apps/api/src/lib/auth*
- apps/dashboard/src/**
- docs/**
- .env.example

Criterios de aceptación:
- Ningún endpoint admin sensible depende solamente de una key global en producción.
- No hay credenciales reales en archivos versionados.
- Demo fallback queda explícitamente aislado y rotulado.
- Build/lint/typecheck pasan.

No hacer:
- No reescribir todo el sistema de auth desde cero si existe una base usable.
- No eliminar la demo comercial; aislarla correctamente.
```

---

## Codex 02 — event-contract-unification

```text
Título: Unificar contrato de eventos, risk score y analytics entre API, dashboard y realtime

Objetivo:
Eliminar drift de métricas. Un mismo evento/tap debe producir el mismo riskScore, trust state, verdict y agregados sin importar si se consulta desde overview, analytics, stream o dashboard.

Trabajo requerido:
1. Localizá funciones actuales de:
   - recordTapEvent
   - riskScore
   - analytics overview
   - admin analytics
   - events stream
   - dashboard types
2. Crear una librería compartida de contrato, preferentemente en un paquete compartido si existe packages/*, o en apps/api + mirror de types exportables:
   - NexidTapEvent
   - NexidEventVerdict
   - RiskScoreInput
   - RiskScoreBreakdown
   - computeRiskScore(input)
   - normalizeEvent(row)
   - aggregateTenantMetrics(events | SQL rows)
3. La fórmula de riskScore debe ser única y documentada:
   - replay/duplicate rate
   - tamper/opened rate
   - invalid rate
   - geo anomaly / impossible travel
   - device anomaly
4. Actualizá endpoints para usar la misma función:
   - /admin/overview
   - /admin/analytics
   - /admin/events/stream snapshot
   - cualquier componente dashboard que recalcule localmente
5. Agregá tests unitarios con fixture de eventos:
   - mismo input produce mismo score en overview y analytics.
   - valores nulos no rompen.
   - eventos demo y productivos se distinguen.
6. Si existe ALTER TABLE runtime en recordTapEvent para events, reemplazar por migración versionada o dejar preparado un TODO bloqueante con migración concreta si no puede resolverse completo.

Criterios de aceptación:
- Existe una única fuente de verdad para riskScore y event normalization.
- Dashboard deja de recalcular con fórmulas propias salvo presentación.
- Overview, analytics y stream coinciden para el mismo tenant/rango.
- Tests pasan.

No hacer:
- No cambiar la semántica comercial del score sin documentarla.
- No ocultar diferencias con redondeos arbitrarios.
```

---

## Codex 03 — consumer-ownership-flow

```text
Título: Cerrar flujo real de ownership y asociación consumidor ↔ producto ↔ tenant

Objetivo:
Convertir el CTA de ownership del passport en un flujo real y durable: un consumidor que toca un producto premium válido queda asociado al tenant, guarda el producto y entra al marketplace/loyalty contextual.

Trabajo requerido:
1. Inspeccioná rutas existentes:
   - /sun
   - /public/cta/claim-ownership
   - /api/mobile/passport/[eventId]/consumer/join-tenant
   - /api/mobile/passport/[eventId]/consumer/save-product
   - /me
   - /me/marketplace
   - consumer auth/start/verify si existe
2. Crear o completar schema/migración para ownership real:
   - consumer_product_ownerships
   - tenant_memberships si no existe
   - product_saved_items o equivalente si ya existe usarlo
3. Campos mínimos ownership:
   - id
   - tenant_id
   - consumer_id
   - batch_id
   - tag_id nullable
   - uid_hex
   - event_id
   - status: claimed | blocked_replay | revoked | disputed
   - source: sun_passport | marketplace | admin
   - trust_snapshot jsonb
   - claimed_at
   - updated_at
4. El claim debe validar:
   - evento existe
   - pertenece al tenant/batch
   - status válido/auth ok
   - no replay activo
   - tag no revoked
   - share/action token válido si aplica
5. UX:
   - Desde passport, si no hay sesión consumer, abrir flujo login/OTP liviano.
   - Al verificar identidad, ejecutar join-tenant + save-product + claim ownership.
   - Redirigir a /me o /me/marketplace con tenant contextual.
6. Marketplace:
   - Mostrar tenant/club derivado del último tap o ownership.
   - Evitar marketplace genérico si hay tenant activo.
7. Seguridad:
   - No permitir claim por URL replay reutilizada.
   - No permitir claim de UID ajeno sin token/evento válido.
8. Tests:
   - tap válido + consumer nuevo → membership + ownership + saved item.
   - replay → claim bloqueado.
   - token expirado → 401/403.
   - tenant mismatch → 403.

Criterios de aceptación:
- El CTA “Activar titularidad” deja de ser solo demo y crea ownership real.
- /me muestra el producto asociado.
- /me/marketplace abre contexto del tenant del producto.
- No se rompen CTAs de warranty/provenance/tokenization.
```

---

## Codex 04 — global-ops-map

```text
Título: Reemplazar mapa operativo iframe/SVG por Global Ops Map WebGL enterprise

Objetivo:
Crear un mapa global de operaciones nivel enterprise, con puntos, clusters, arcs y playback de journeys para taps premium. Debe verse como control plane global, no como mapa embebido básico.

Stack sugerido:
- MapLibre GL JS para mapa base vectorial/globe.
- deck.gl para capas ArcLayer, ScatterplotLayer, Heatmap/Hexagon y TripsLayer.
- Dynamic import client-only para evitar problemas SSR.

Trabajo requerido:
1. Inspeccioná componentes actuales:
   - WorldMapRealtime
   - DemoOpsMap
   - RealOpsMap
   - AnalyticsPanels journey map
2. Crear componente reusable:
   - packages/ui/src/components/global-ops-map.tsx o ruta equivalente.
3. Props mínimas:
   - points: { id, city, country, lat, lng, scans, risk, verdict, tenantSlug, lastSeen }
   - routes: { id, fromLat, fromLng, toLat, toLng, uid, risk, taps, firstSeenAt, lastSeenAt }
   - mode: tenant | global | demo
   - selectedPointId
   - onPointSelect
   - playbackEnabled
   - riskOnly
4. Capas:
   - ScatterplotLayer para hubs.
   - ArcLayer para origen → último tap.
   - TripsLayer para playback temporal si hay timestamps.
   - Heatmap o Hexagon para densidad.
5. UI:
   - KPIs superiores: hubs visibles, países, risk nodes, replay/tamper.
   - Drawer lateral al click: detalle de ciudad, UID, tenant, último evento, device, risk.
   - Filtros: tenant, country, risk-only, time window, verdict.
6. Fallback:
   - Si WebGL falla, mostrar lista operacional + mini SVG no interactivo.
   - No mostrar error crudo del navegador como experiencia principal.
7. Integración:
   - Reemplazar RealOpsMap iframe de OpenStreetMap.
   - Mantener DemoOpsMap como wrapper si conviene, pero que use GlobalOpsMap internamente.
8. Dependencias:
   - Agregar maplibre-gl y deck.gl solo donde corresponde.
   - CSS de maplibre cargado correctamente.
9. Performance:
   - Memoizar layers.
   - Limitar rutas visibles por defecto.
   - Usar clustering/agregación para datasets grandes.

Criterios de aceptación:
- Dashboard tenant/global muestra mapa WebGL con puntos reales.
- Al seleccionar un punto se abre detalle.
- Risk-only y playback funcionan.
- Sin WebGL, el usuario ve fallback profesional.
- Build pasa sin errores SSR.
```

---

## Codex 05 — dashboard-executive-charts

```text
Título: Charts ejecutivos y drill-down para dashboard tenant/global

Objetivo:
Elevar el dashboard a nivel SaaS enterprise con charts consistentes, animados y accionables. Mantener Recharts si ya está instalado, pero usarlo mejor.

Trabajo requerido:
1. Inspeccioná AnalyticsPanels y componentes de chart existentes.
2. Crear componentes:
   - TapVelocityChart: taps, valid, replay, tamper por ventana temporal.
   - RiskRadarChart: replay, tamper, invalid, geo anomaly, device anomaly.
   - TrustFunnelChart: tap → valid passport → claim → warranty → marketplace.
   - DeviceRiskMatrix: OS/browser/device vs risk.
   - TopProductsTable mejorada con tokenization y lastSeen.
3. Usar ResponsiveContainer y tooltips custom con tema oscuro premium.
4. Agregar drill-down:
   - Click en día/barra/punto → actualiza filtro local o abre drawer de eventos.
   - Click en risk category → filtra feed/live map.
5. Estados vacíos:
   - Sin datos reales: mostrar instrucciones operativas, no fake charts.
   - Si demo mode activo: badge “Demo data”.
6. Consistencia:
   - Todos los charts consumen el contrato unificado del Codex 02.
   - No recalcular riskScore localmente salvo formato visual.
7. Accesibilidad:
   - Labels legibles.
   - aria-labels para charts clave.
   - Soportar reduced motion.

Criterios de aceptación:
- Dashboard muestra tendencias, radar, funnel y device intelligence con datos reales.
- Drill-down conecta charts con feed/map.
- No hay métricas inventadas en producción.
- Responsive correcto en desktop/tablet/mobile.
```

---

## Codex 06 — landing-proof-system

```text
Título: Landing proof system con hero vivo, storytelling animado y métricas reales anonimizadas

Objetivo:
Convertir la landing en una demo viva del producto: no solo explicar, sino probar que nexID opera taps, riesgo, mapa global y marketplace.

Trabajo requerido:
1. Inspeccioná apps/web/src/app/page.tsx y componentes de landing.
2. Crear endpoint público seguro/anónimo en API:
   - /public/proof/summary
   - No requiere admin key.
   - Devuelve solo agregados no sensibles:
     - tapsToday
     - validRate
     - riskBlocked
     - activeRegions
     - latestPublicEvents anonimizados
     - demoMode boolean
   - Cache corto: 15-60s.
   - Nunca exponer UID completo, emails, tenant secrets ni raw SUN payload.
3. Landing:
   - Hero con live proof cards.
   - Mini global map/globe con puntos anonimizados.
   - Sección “From tap to tenant revenue” con 4 pasos animados.
   - Mock mobile passport + mock dashboard sincronizados visualmente.
4. Motion:
   - Usar motion/react para whileInView, layout, stagger y microinteractions.
   - Respetar prefers-reduced-motion.
5. Copy:
   - Reducir hype genérico.
   - Enfatizar “physical identity infrastructure”, “tenant-level live ops”, “premium product passport”.
6. CTA:
   - “Probar demo SUN” apunta al batch demo.
   - “Ver dashboard demo” apunta al demo lab/admin según rutas existentes.
7. Demo vs prod:
   - Si los datos vienen de demo, badge visible.
   - Si no hay datos, mostrar proof skeleton + CTA para generar tap demo.

Criterios de aceptación:
- Landing carga rápido.
- El hero muestra métricas reales/anónimas o demo rotulada.
- Animaciones suaves y profesionales.
- No hay secretos ni PII en endpoint público.
- SEO básico no se degrada.
```

---

## Codex 07 — passport-mobile-ux

```text
Título: Passport mobile premium UX para /sun

Objetivo:
Mejorar la experiencia mobile-first del Digital Product Passport sin romper el endpoint SUN ni el flujo universal de URL por NFC.

Trabajo requerido:
1. Inspeccioná renderSunHtml y buildPublicContract en apps/api/src/app/sun/route.ts o archivo actual.
2. Mantener compatibilidad:
   - view=json sigue devolviendo JSON.
   - view=html o accept text/html sigue devolviendo HTML.
3. Rediseñar HTML/CSS inline o extraer helper si es razonable:
   - Sticky trust header con estado, score y BID/UID enmascarado.
   - Tabs: Identidad, Provenance, Beneficios, Técnico.
   - Card de producto premium más sobria.
   - Mapa/ruta visual mejorada, con fallback si no hay coords.
   - CTA drawer para registro/claim sin abandonar el contexto.
4. Estados:
   - VALID_CLOSED: habilitar claim/warranty/marketplace.
   - REPLAY_SUSPECT: bloquear claim/warranty/tokenize y explicar claramente.
   - TAMPER/OPENED: permitir provenance, bloquear ownership si aplica.
5. i18n:
   - Mantener es-AR, en, pt-BR.
   - Agregar selector de idioma si se puede con query param lang.
6. Accesibilidad:
   - Botones con labels.
   - Contraste alto.
   - Reduced motion.
7. Tracking:
   - Registrar CTA click si existe endpoint.
   - No duplicar eventos SUN por navegar tabs.

Criterios de aceptación:
- El passport se ve premium en mobile.
- El usuario entiende en menos de 5 segundos si el producto es auténtico, riesgoso o replay.
- CTAs respetan estado de riesgo.
- No se rompe JSON API.
```

---

## Codex 08 — realtime-alerts

```text
Título: Alertas realtime por tenant sobre replay, tamper, geo anomaly y device anomaly

Objetivo:
Agregar un módulo de alertas accionable para admins/tenants, alimentado por eventos reales y publicado por el canal realtime.

Trabajo requerido:
1. Inspeccioná recordTapEvent, event bus, /admin/events/stream y dashboard live monitor.
2. Crear migración:
   - alert_rules
   - security_alerts
3. Tipos de regla:
   - replay_spike
   - tamper_rate
   - invalid_rate
   - geo_velocity/impossible_travel
   - new_country_for_uid
   - suspicious_device_cluster
4. Evaluación:
   - Después de persistir evento, evaluar reglas del tenant.
   - Para cargas altas, dejar estructura para job async, pero implementar mínimo sin bloquear excesivamente el tap.
5. Publicación realtime:
   - Publicar evento compacto tipo security_alert.created.
   - Payload corto: alertId, tenantId, severity, type, createdAt.
   - El dashboard consulta detalle por alertId si necesita más.
6. API admin:
   - GET /admin/alerts
   - POST /admin/alert-rules
   - PATCH /admin/alert-rules/:id
   - PATCH /admin/alerts/:id/ack
7. Dashboard:
   - Alert center o panel superior.
   - Badge en mapa/feed si un evento disparó alerta.
   - Filtros por severity y type.
8. Tests:
   - replay spike genera alerta.
   - tamper rate genera alerta.
   - tenant A no ve alertas de tenant B.

Criterios de aceptación:
- Alertas aparecen en dashboard sin refresh.
- Scope tenant correcto.
- Payload realtime no contiene PII ni raw SUN.
- No bloquea la ruta /sun de forma perceptible.
```

---

## Codex 09 — qa-demo-corpus

```text
Título: Corpus demo canónico + smoke tests end-to-end para SUN, passport, dashboard y marketplace

Objetivo:
Dejar una demo flagship repetible y testeable: 10 tags del batch DEMO-2026-02, eventos simulados realistas, marketplace contextual y dashboard live ops.

Trabajo requerido:
1. Crear/actualizar seeds demo:
   - tenant: demobodega
   - batch: DEMO-2026-02
   - 10 tags con UID enmascarables
   - productos premium wine/cosmetics/events/agro
   - eventos en Mendoza, Buenos Aires, São Paulo, NYC, Madrid
   - algunos replay/tamper controlados
2. Crear script:
   - npm run demo:seed
   - npm run demo:reset
   - npm run demo:emit-taps
3. Smoke tests:
   - /health OK
   - /sun view=json con payload demo devuelve contrato consistente
   - /sun view=html contiene estado, producto y CTAs
   - stream admin recibe evento al emitir tap
   - /me/marketplace con tenant contextual muestra club/marketplace correcto
4. Documentar demo:
   - docs/DEMO_FLAGSHIP.md
   - cómo correr local
   - cómo presentar comercialmente
   - cómo distinguir demo vs producción
5. No usar credenciales reales.
6. No depender de servicios externos para tests básicos.

Criterios de aceptación:
- Una persona nueva puede levantar la demo y ejecutar el recorrido en menos de 20 minutos.
- Los datos del dashboard y marketplace salen del mismo corpus.
- El corpus no contamina producción.
```
