# nexID SDK, CRM y claim seguro - roadmap sprint a sprint

Ultima actualizacion: 2026-07-11

## Principio de producto

nexID no debe confundir lectura con propiedad. Un consumidor puede escanear una botella en gondola para leer informacion, hablar con el sommelier IA, dejar un lead, entrar al marketplace o guardar la marca. Reclamar ownership requiere prueba adicional: tag fisico seguro, token POS/caja de un solo uso, PIN opcional, recibo o validacion de la marca.

## Sprint 1 - Seguridad enterprise del claim

Estado: implementado.

- API key tenant-scoped con scopes: `sdk:verify`, `sdk:claim`, `sdk:products`, `sdk:events`, `sdk:pos`.
- `POST /api/v1/sdk/pos/activate`: emite token `nxpos_...` de un solo uso para POS, caja, ERP o checkout.
- `POST /api/v1/sdk/claim`: consume `posToken`, valida PIN si aplica y evita auto-claim sin identidad fisica segura.
- Uso SDK auditado en `sdk_usage_logs`.
- Claim request auditable con `pos_activation_id` y `pos_validated`.
- Webhooks firmados para `sdk.verify`, `sdk.claim.created`, `sdk.claim.claimed`, `sdk.pos.activated` y `sdk.external_event`.
- Consola dashboard para API keys, claim policy y webhooks.

## Sprint 2 - API server-side y adopcion controlada

Estado: contrato base implementado; paquete publico pendiente de nombre y publicacion propios.

- Pagina publica `/sdk` con explicacion business/dev.
- REST API de produccion en `https://api.nexid.lat`; credenciales solo en backend, BFF, POS o ERP.
- Cliente interno `@product/nexid-server-sdk` marcado como privado. No publicar ni recomendar `@nexid/sdk`: ese nombre pertenece a un paquete ajeno.
- Antes de publicar un paquete se debe controlar el scope npm, compilar artefactos `dist`, versionar semver y documentar soporte server-only.
- Mensaje comercial: QR y SDK reducen barrera de entrada; NFC criptografico protege casos premium.
- Mantener precision tecnica: QR no es anti-copia fuerte; sirve para passport, leads, marketplace, analytics y fidelizacion.

## Sprint 3 - UX mobile post-tap

Estado: siguiente foco inmediato.

- Primer viewport debe responder: que producto es, que puedo hacer ahora, que es opcional y que exige compra.
- Acciones principales: ficha, sommelier IA, comprar/marketplace, verificar compra.
- No forzar registro al primer tap.
- Separar claramente: visitante curioso, comprador, miembro del club y dueño verificado.
- Sommelier IA como burbuja accesible y no como bloque enterrado al final del scroll.

## Sprint 4 - GS1 Digital Link y carriers hibridos

Estado: base implementada, ampliar con matching contra manifiestos reales.

- Resolver `/01/{GTIN}/21/{SERIAL}` hacia passport QR/SDK.
- Normalizar eventos de QR, NFC, GS1 y UHF en el mismo grafo de datos.
- Preparar manifiestos de proveedor para tags NXP NTAG DNA, NTAG 424 DNA TT y UHF/NFC hibridos.

## Sprint 5 - CRM tenant a nivel inversionista

Estado: pendiente.

- Resumen ejecutivo sin demos cruzadas.
- Heatmap real-time por tenant.
- Leads, claims, POS activations, marketplace intent y conversion funnel.
- Alertas de replay/tamper/geovelocity con detalle accionable.
- Exportacion y webhooks para que el cliente opere dentro de su propio stack.

## Benchmark competitivo

- Authena, Qliktag y Selinko validan que el mercado existe: autenticidad, DPP, NFC/QR, trazabilidad y dashboards son categorias reales.
- Qliktag declara APIs enterprise; la ventaja nexID no debe formularse como "ellos no tienen APIs", sino como self-service SDK, menor friccion, integracion barata, UX post-tap clara y politica de claim mas segura.
- La comparacion correcta para ventas: nexID debe ser mas accesible para LATAM, mas flexible para QR/SDK, y suficientemente fuerte para premium con NFC criptografico.

## Reglas duras

- No mostrar secretos ya guardados. API keys y signing secrets solo se muestran al crear.
- No usar datos demo de otros tenants en `demobodega`.
- No llamar "ownership" a un QR copiable sin prueba de compra o marca.
- No prometer tokenizacion/blockchain como obligatoria; venderla como capa premium cuando haya ROI.
- Cada sprint debe cerrar con test local, build/check y smoke de produccion cuando sea viable.
