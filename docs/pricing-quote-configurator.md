# Pricing / quote configurator

The public `/pricing` configurator is a scope-discovery tool, not a catalog, supplier quote, invoice or contractual offer. It intentionally returns broad USD planning bands so a buyer can compare architectures without presenting NFC, UHF or IoT as interchangeable commodities.

## Inputs

- vertical and unit quantity;
- preferred carrier: QR/GS1, basic NFC, NTAG 424 DNA, NTAG 424 DNA TagTamper, UHF or IoT/sensor discovery;
- security level;
- printing and packaging conversion;
- nexID commercial modules;
- integration complexity;
- offline operating model;
- optional public proof layer.

Security requirements take precedence over a technically incompatible preferred carrier. For example, a SUN requirement upgrades QR or basic NFC to NTAG 424 DNA. An industrial UHF/IoT workflow that also needs secure consumer validation becomes a hybrid architecture instead of pretending that one carrier provides both capabilities.

## Outputs and commercial boundary

The result includes a recommended package and carrier architecture, total hardware/converted-media band, discovery/setup band, monthly SaaS/operations band, pilot size/duration and a prefilled enterprise quote CTA. The hardware band is a total for the selected scope; the UI does not publish a per-tag price list.

All bands are estimates. A final proposal requires supplier quotes and technical discovery. Tax, freight, duties, financing, reader infrastructure, carrier certification, live-network fees and out-of-scope work remain excluded unless a proposal explicitly includes them.

## Evidence boundaries

- QR/GS1 provides a public identifier but no anti-copy cryptography.
- Basic NFC provides a tap experience but no dynamic SUN evidence.
- NTAG 424 DNA provides dynamic SUN/SDM message evidence and replay signals; it does not prove physical contents.
- NTAG 424 DNA TT adds a reported TT state whose physical meaning depends on validated packaging integration.
- UHF supports bulk reads with dedicated readers; it is not a native consumer-phone experience.
- IoT/sensor pricing remains discovery-dependent because sensor, enclosure, power, calibration and connectivity materially change the architecture.
- Offline capture remains pending until server synchronization. A signed public certificate is not live SUN freshness, current tamper state or ownership proof.

IOTA and Polygon are optional, event-driven modules. IOTA is for grouped integrity evidence at selected milestones or cadence. Polygon is for approved ownership, warranty or certificate actions. Neither is modeled or marketed as a mandatory blockchain write on every NFC tap.

The deterministic budget logic lives in `apps/web/src/components/pricing-quote-model.ts`; presentation and lead handoff live in `apps/web/src/components/pricing-quote-configurator.tsx`.
