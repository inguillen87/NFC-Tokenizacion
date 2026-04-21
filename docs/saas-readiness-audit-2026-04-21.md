# NFC-Tokenizacion · Auditoría de preparación SaaS (2026-04-21)

## Resumen ejecutivo

El producto **no requiere rehacerse desde cero**: ya cuenta con un núcleo SUN robusto, analytics operativos, gestión de tags, IAM con MFA y una UI con dirección premium. Sin embargo, la plataforma todavía mezcla de forma riesgosa los modos demo y producción, y no cierra completamente los contratos de datos entre SUN mobile, panel admin y capa comercial.

**Diagnóstico corto:** estado actual apto para demo comercial fuerte, pero todavía por debajo de estándar enterprise para venta repetible.

## Fortalezas que deben preservarse

1. **Flujo SUN** con autenticidad, pasaporte de producto, señales técnicas y CTA operativas.
2. **Analytics admin** con KPIs, geo/device, journeys y estado de tokenización.
3. **Inventario de tags** con filtros operativos y exportación.
4. **Base IAM empresarial** (sesiones, MFA, permisos por recurso) útil para escalar a multi-tenant real.

## Brechas críticas para go-to-market

1. **Inconsistencia de corpus demo** (IDs/lotes/presets no unificados).
2. **Dependencia de secretos/configuración oculta** para CTAs clave.
3. **Telemetría móvil no cerrada end-to-end** con enriquecimiento de contexto sobre evento real.
4. **“Realtime” basado en polling** (SSE + refresco periódico), insuficiente para promesa de live ops enterprise.
5. **Riesgos de seguridad de credenciales demo/publicables** y separación demo/prod insuficiente.
6. **CRM super admin incompleto**: existe CRM-lite transaccional, falta modelo comercial completo (Account/Deal/Subscription).

## Objetivo de producto (north star)

Construir una plataforma unificada donde convivan, sobre el mismo contrato de datos:

- **Plano físico**: Account → Tenant → Batch → Tag → Event.
- **Plano comercial**: Account → Deal → Quote/Order → Shipment → Activation → Renewal.

## Roadmap de ejecución (prioridad estricta)

### Fase 1 — Canonización demo (Semana 1)
- Definir un único tenant demo, un único batch demo, exactamente 10 tags y una narrativa única.
- Reusar este corpus en seed, presets SUN, proxy demo, analytics y materiales comerciales.
- Entregable: `demo-canon.json` + validación automatizada de IDs demo.

### Fase 2 — Contrato de telemetría real (Semanas 1-2)
- Cerrar pipeline: tap válido → enriquecimiento `/sun/context` → actualización analytics/tags/live monitor.
- Separar explícitamente evento técnico vs. evento de contexto para trazabilidad.
- Entregable: contrato versionado `sun-event-v1` + pruebas E2E.

### Fase 3 — Realtime útil (Semana 2)
- Mantener SSE actual como fallback.
- Incorporar canal de eventos push (ej: `LISTEN/NOTIFY` o bus gestionado) para scans/alerts/tokenization.
- Entregable: SLA de latencia operativa y dashboard de drift/jitter.

### Fase 4 — Hardening seguridad y separación de ambientes (Semana 3)
- Eliminar defaults sensibles y cualquier secreto/credencial expuesta por variables públicas.
- Etiquetado visible de entorno (demo/sandbox/prod) en UI y APIs.
- Entregable: checklist de seguridad pre-POC + prueba de regresión de CTAs.

### Fase 5 — Super CRM conectado al dato físico (Semanas 4-6)
- Introducir entidades `accounts`, `contacts`, `deals`, `subscriptions`, `reseller_relationships`.
- Integrar eventos físicos (replay, incidentes, activaciones, tokenización) con pipeline comercial.
- Entregable: vistas unificadas por account (operación + revenue + soporte).

## KPI de salida a venta

- **Consistencia demo:** 100% de endpoints críticos responden con corpus canónico.
- **Latencia de actualización live:** p95 < 2s en eventos de scan/alert.
- **Calidad de telemetría:** >95% de taps con contexto geo/device enriquecido.
- **Seguridad:** 0 credenciales hardcodeadas/`NEXT_PUBLIC_*` sensibles.
- **Comercial:** ciclo lead→order→activation trazable por account sin pasos manuales fuera del sistema.

## Criterio de “listo para vender”

El producto queda listo para venta enterprise cuando:

1. La demo y la operación usan el mismo contrato de datos.
2. El monitoreo live deja de depender de polling como camino principal.
3. Los ambientes quedan aislados y auditables.
4. Super admin funciona como control plane comercial + operacional, no solo como panel técnico.

---

## Nota de alcance

Este documento consolida un diagnóstico estratégico para priorizar ejecución de producto y go-to-market. No reemplaza una evaluación legal/compliance ni una auditoría de seguridad ofensiva completa.
